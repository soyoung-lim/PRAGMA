import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// DEV-only email/password admin login for localhost testing.
//
// Never active in production: `import.meta.env.DEV` is statically replaced with
// `false` at build time, so this component returns null (and its render site in
// Landing is dead-code-eliminated). It does NOT touch the Lovable Google OAuth
// flow, RLS, is_admin, or any service-role key. Credentials are typed by the
// operator at runtime — nothing is hardcoded here or read from VITE env vars.
//
// Requires an existing Supabase Auth user whose profiles.role = 'admin'
// (created/promoted via the Supabase dashboard — see dev-log / report).
export function DevAdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hooks above are always called; the guard is after them (rules-of-hooks).
  if (!import.meta.env.DEV) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setBusy(false);
      return;
    }
    navigate("/admin/generator", { replace: true });
  };

  return (
    <section className="mt-4 w-full max-w-md">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 p-4"
      >
        <div className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          DEV ONLY · admin 로그인 (localhost)
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin 이메일"
          autoComplete="off"
          className="mt-2 w-full rounded-md border border-muted-foreground/40 bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          autoComplete="off"
          className="mt-2 w-full rounded-md border border-muted-foreground/40 bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
        />
        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          className="mt-2 w-full rounded-md border border-muted-foreground/40 bg-background px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted/60 disabled:opacity-60"
        >
          {busy ? "로그인 중…" : "DEV admin 로그인 → /admin/generator"}
        </button>
        {error && (
          <div className="mt-2 text-[12px] text-destructive">{error}</div>
        )}
      </form>
    </section>
  );
}

export default DevAdminLogin;
