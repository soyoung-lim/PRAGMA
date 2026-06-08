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
    const raw = localStorage.getItem(DEV_STUB_KEY);
    return raw ? (JSON.parse(raw) as DevStub) : null;
  } catch {
    return null;
  }
}

function writeDevStub(stub: DevStub | null) {
  if (!IS_DEV) return;
  if (stub) localStorage.setItem(DEV_STUB_KEY, JSON.stringify(stub));
  else localStorage.removeItem(DEV_STUB_KEY);
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
    const { data: s } = await supabase.auth.getSession();
    setSession(s.session ?? null);
    if (s.session?.user) {
      await loadProfile(s.session.user.id);
    } else {
      setProfile(null);
    }
    setLoading(false);
  }, [loadProfile]);

  useEffect(() => {
    // Listen first
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      if (s?.user) {
        // Defer to avoid recursive supabase calls in callback
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
      }
    });
    void refresh();
    const onStub = () => void refresh();
    window.addEventListener("dev-stub-changed", onStub);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("dev-stub-changed", onStub);
    };
  }, [loadProfile, refresh]);

  return { loading, session, profile, isDevStub: !!devStub, refresh };
}