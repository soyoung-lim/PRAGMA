import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { HomeBrand } from "@/components/HomeBrand";
import { devStubSignIn, IS_DEMO } from "@/lib/auth/useProfile";
import { toast } from "sonner";

const StudentLogin = () => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // Supabase가 Google OAuth를 직접 수행한다(Lovable 브로커 경유 없음) —
  // 그래서 로컬·Railway 어디서 열어도 동작한다. 성공하면 이 탭이 Google로
  // 이동하므로 호출 이후 코드는 실행되지 않는다.
  const handleGoogle = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/learner/home" },
      });
      if (error) {
        toast.error("Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        setBusy(false);
      }
    } catch {
      toast.error("Google 로그인 중 오류가 발생했습니다.");
      setBusy(false);
    }
  };

  // 시연·개발용: 승인·프로필 완료 상태로 만들어 학습 홈까지 한 번에 진입한다.
  const handleDevStub = () => {
    devStubSignIn(undefined, { ready: true });
    navigate("/learner/home", { replace: true });
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
          로그인 후 바로 오늘의 학습을 시작할 수 있습니다.
        </p>

        {IS_DEMO ? (
          <>
            {/* 지금 실제로 동작하는 경로 — 가장 눈에 띄게 */}
            <div className="mt-8 w-full rounded-xl border-2 border-[#FAD338] bg-[#FFFBEA] p-4">
              <div className="text-[11.5px] font-bold text-[#B8860B]">시연용 둘러보기</div>
              <p className="mt-1 text-[13px] leading-relaxed text-foreground/80">
                아래 버튼으로 로그인 없이 바로 학습 화면을 둘러볼 수 있습니다.
              </p>
              <button
                type="button"
                onClick={handleDevStub}
                className="mt-3 w-full rounded-md bg-[#15202B] px-5 py-3 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-[#22303E]"
              >
                임시 학습자로 시작하기 →
              </button>
            </div>

            {/* Google — 인증까지는 되지만 아직 앱으로 복귀하지 못한다 */}
            <div className="mt-4 w-full rounded-xl border border-[#EAE4D2] bg-white p-4">
              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="w-full rounded-md border border-[#EAE4D2] bg-white px-5 py-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 disabled:opacity-60"
              >
                {busy ? "이동 중…" : "Google 계정으로 로그인"}
              </button>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                Google 로그인은 <strong>준비 중</strong>입니다. 인증 서버 이전 작업이 끝나면
                활성화됩니다. 지금은 위의 임시 학습자 버튼을 사용해 주세요.
              </p>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="mt-8 w-full rounded-md border border-[#15202B] bg-white px-5 py-3 text-[15px] font-medium text-[#15202B] shadow-sm transition-colors hover:bg-[#15202B]/[0.04] disabled:opacity-60"
          >
            {busy ? "이동 중…" : "Google 계정으로 로그인"}
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