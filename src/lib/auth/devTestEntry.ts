// Dev-only test entry: signs in anonymously, promotes the profile to
// approved + completed with the marker id 'TEST-DEV-001', so the workflow
// (and decision_traces insert under RLS) works without going through the
// real Google login + profile wizard + admin approval flow.
//
// Gated by IS_DEV_TEST_ENTRY_ENABLED at the call site; this module also
// re-checks IS_DEV so production builds never execute it even if imported.

import { supabase } from "@/integrations/supabase/client";
import { IS_DEV } from "./useProfile";

export async function devTestEntrySignIn(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!IS_DEV) {
    return { ok: false, message: "Dev test entry is disabled in production." };
  }

  // 1) Always start from a clean session so re-clicks behave predictably.
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }

  // 2) Anonymous sign-in -> creates a real auth.users row, valid JWT, RLS works.
  const { data: signInData, error: signInErr } = await supabase.auth.signInAnonymously();
  if (signInErr || !signInData.session) {
    return {
      ok: false,
      message:
        "Anonymous sign-in failed. Enable 'Allow anonymous sign-ins' in the project's Auth settings, then try again.",
    };
  }

  // 3) Promote profile to approved + completed + TEST-DEV-001.
  //    RPC is SECURITY DEFINER and gated to anonymous sessions only.
  const { error: rpcErr } = await supabase.rpc("ensure_test_dev_profile");
  if (rpcErr) {
    return { ok: false, message: `Profile promote failed: ${rpcErr.message}` };
  }

  return { ok: true };
}