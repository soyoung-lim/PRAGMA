import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { HomeBrand } from "@/components/HomeBrand";
import { supabase } from "@/integrations/supabase/client";

const ID_DOMAIN = "l2-pragmatics.app";
const toEmail = (input: string) => input.trim().includes("@")
  ? input.trim()
  : `${input.trim()}@${ID_DOMAIN}`;

const ExpertLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: toEmail(account),
      password,
    });
    if (signInError || !data.user) {
      setError(signInError?.message ?? "로그인에 실패했습니다.");
      setBusy(false);
      return;
    }
    navigate((location.state as { from?: string } | null)?.from ?? "/expert/reviews", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-[#15202B]"><div className="mx-auto max-w-6xl px-6 py-4"><HomeBrand /></div></header>
      <main className="mx-auto max-w-md px-6 py-16">
        <div className="flex items-stretch gap-3">
          <span aria-hidden className="w-[5px] rounded-sm bg-[#FAD338]" />
          <div><h1 className="text-2xl font-bold">독립 전문가 로그인</h1><p className="mt-2 text-sm text-muted-foreground">배정된 검토자 계정만 자신의 blind review queue를 볼 수 있습니다.</p></div>
        </div>
        <form onSubmit={submit} className="mt-8 space-y-3 rounded-xl border border-border bg-card p-6">
          <label className="block text-sm font-medium">아이디 또는 이메일
            <input className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2" value={account} onChange={(event) => setAccount(event.target.value)} autoComplete="username" />
          </label>
          <label className="block text-sm font-medium">비밀번호
            <input type="password" className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <button type="submit" disabled={busy || !account.trim() || !password} className="w-full rounded-md bg-[#FAD338] px-4 py-2.5 text-sm font-semibold text-[#15202B] disabled:opacity-50">
            {busy ? "로그인 중…" : "검토 작업대 입장"}
          </button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
      </main>
    </div>
  );
};

export default ExpertLogin;

