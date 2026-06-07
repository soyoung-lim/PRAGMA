import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { lovable } from "@/integrations/lovable";
import { HomeBrand } from "@/components/HomeBrand";
import { devStubSignIn, IS_DEV } from "@/lib/auth/useProfile";
import { toast } from "sonner";

const StudentLogin = () => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/profile-setup",
      });
      if (result.error) {
        toast.error("Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      navigate("/profile-setup", { replace: true });
    } catch {
      toast.error("Google 로그인 중 오류가 발생했습니다.");
      setBusy(false);
    }
  };

  const handleDevStub = () => {
    devStubSignIn();
    navigate("/profile-setup", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16">
        <h1 className="text-center text-2xl font-bold tracking-tight">학습자 로그인</h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Google 계정으로 로그인한 뒤 간단한 프로필을 작성하면 바로 학습을 시작할 수 있습니다.
        </p>
        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="mt-8 w-full rounded-md border border-[#15202B] bg-white px-5 py-3 text-[15px] font-medium text-[#15202B] shadow-sm transition-colors hover:bg-[#15202B]/[0.04] disabled:opacity-60"
        >
          {busy ? "이동 중…" : "Google 계정으로 로그인"}
        </button>
        {IS_DEV && (
          <button
            type="button"
            onClick={handleDevStub}
            className="mt-3 w-full rounded-md border border-dashed border-muted-foreground/40 bg-transparent px-5 py-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/40"
          >
            [DEV] 임시 학습자로 로그인 (stub)
          </button>
        )}
        <Link to="/" className="mt-6 text-sm text-muted-foreground hover:text-foreground">
          ← 처음으로
        </Link>
      </main>
    </div>
  );
};

export default StudentLogin;