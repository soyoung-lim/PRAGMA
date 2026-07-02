import { useEffect, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { APPROVAL_STATUS, APP_ROLE, type Profile } from "./constants";

const DEV_STUB_KEY = "dev-stub-session";

// dev-only flag — exposed only in dev builds. Never reachable in production.
export const IS_DEV = import.meta.env.DEV;

// Secondary kill-switch: even in DEV, hide the test entry when
// VITE_ENABLE_TEST_ENTRY === 'false'. Primary gate is import.meta.env.DEV
// so production builds never expose the dev entry regardless of env.
export const IS_DEV_TEST_ENTRY_ENABLED =
  IS_DEV && import.meta.env.VITE_ENABLE_TEST_ENTRY !== "false";

type DevStub = {
  user_id: string;
  email: string;
  approval_status: Profile["approval_status"];
  profile_completed?: boolean;
  full_name?: string;
};

function readDevStub(): DevStub | null {
  if (!IS_DEV) return null;
  try {
    // Clean up legacy stubs that persisted across sessions in localStorage —
    // they made the app look "logged in" without a real account.
    localStorage.removeItem(DEV_STUB_KEY);
    const raw = sessionStorage.getItem(DEV_STUB_KEY);
    return raw ? (JSON.parse(raw) as DevStub) : null;
  } catch {
    return null;
  }
}

function writeDevStub(stub: DevStub | null) {
  if (!IS_DEV) return;
  if (stub) sessionStorage.setItem(DEV_STUB_KEY, JSON.stringify(stub));
  else sessionStorage.removeItem(DEV_STUB_KEY);
}

export function devStubSignIn(email = "dev.learner@example.com") {
  if (!IS_DEV) return;
  const existing = readDevStub();
  const stub: DevStub = existing ?? {
    user_id: `dev-${crypto.randomUUID()}`,
    email,
    approval_status: APPROVAL_STATUS.PENDING,
  };
  writeDevStub(stub);
  window.dispatchEvent(new Event("dev-stub-changed"));
}

export function devStubSignOut() {
  writeDevStub(null);
  window.dispatchEvent(new Event("dev-stub-changed"));
}

export function devStubApproveCurrent() {
  if (!IS_DEV) return;
  const stub = readDevStub();
  if (!stub) return;
  writeDevStub({ ...stub, approval_status: APPROVAL_STATUS.APPROVED });
  window.dispatchEvent(new Event("dev-stub-changed"));
}

export function devStubCompleteProfile(full_name: string) {
  if (!IS_DEV) return;
  const stub = readDevStub();
  if (!stub) return;
  writeDevStub({ ...stub, profile_completed: true, full_name });
  window.dispatchEvent(new Event("dev-stub-changed"));
}

export type UseProfileResult = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  isDevStub: boolean;
  refresh: () => Promise<void>;
};

export function useProfile(): UseProfileResult {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [devStub, setDevStub] = useState<DevStub | null>(() => readDevStub());

  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id,user_id,role,approval_status,profile_completed,email,anonymous_participant_id")
      .eq("user_id", uid)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  const refresh = useCallback(async () => {
    // A real authenticated session always wins over the dev stub.
    const { data: s } = await supabase.auth.getSession();
    if (s.session?.user) {
      writeDevStub(null);
      setDevStub(null);
      setSession(s.session);
      await loadProfile(s.session.user.id);
      setLoading(false);
      return;
    }
    const stub = readDevStub();
    setDevStub(stub);
    if (stub) {
      setSession(null);
      setProfile({
        id: stub.user_id,
        user_id: stub.user_id,
        role: APP_ROLE.LEARNER,
        approval_status: stub.approval_status,
        profile_completed: !!stub.profile_completed,
        email: stub.email,
        anonymous_participant_id: null,
      });
      setLoading(false);
      return;
    }
    setSession(null);
    setProfile(null);
    setLoading(false);
  }, [loadProfile]);

  useEffect(() => {
    // Listen first
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      if (s?.user) {
        // Real sign-in supersedes any dev stub.
        writeDevStub(null);
        setDevStub(null);
        // Defer to avoid recursive supabase calls in callback
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
      }
    });
    void refresh();
    const onStub = () => void refresh();
    window.addEventListener("dev-stub-changed", onStub);
    window.addEventListener("profile-changed", onStub);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("dev-stub-changed", onStub);
      window.removeEventListener("profile-changed", onStub);
    };
  }, [loadProfile, refresh]);

  return { loading, session, profile, isDevStub: !!devStub, refresh };
}