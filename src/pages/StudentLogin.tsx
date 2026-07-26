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
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>

      <main className="mx-auto flex w-full flex-1 flex-col items-center justify-center px-6 py-12">
        {/* 입구 카드 — 랜딩과 같은 언어(잉크 테두리 + 노랑 한 점). 입구이므로 가볍게 유지한다. */}
        <section className="w-full max-w-[420px] rounded-xl border border-[#E4E0D4] bg-white px-7 py-7 shadow-sm">
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-[9px] bg-[#FAD338] text-[#15202B]"
          >
            {/* 이모지는 플랫폼마다 색이 달라 브랜드를 벗어난다 — 단색 아이콘으로 고정 */}
            <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
              <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M4.8 20c0-3.6 3.2-5.8 7.2-5.8s7.2 2.2 7.2 5.8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>

          <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight text-[#15202B]">
            학습자 로그인
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
            로그인 후 오늘의 학습을 이어갈 수 있습니다.
          </p>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#15202B] px-5 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-[#22303E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2 disabled:opacity-60"
          >
            <span aria-hidden className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-white">
              <svg viewBox="0 0 48 48" className="h-[14px] w-[14px]">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.97-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
            </span>
            {busy ? "이동 중…" : "Google로 계속하기"}
          </button>

          {/* 대비책 — 과거 Google 로그인이 막힌 이력이 있어 우회 수단을 남긴다(보조 위계) */}
          {IS_DEMO && (
            <>
              <div className="mt-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-[#EDE9DD]" />
                <span className="text-[11px] text-muted-foreground">또는</span>
                <span className="h-px flex-1 bg-[#EDE9DD]" />
              </div>

              <button
                type="button"
                onClick={handleDevStub}
                className="mt-4 w-full rounded-lg border border-[#E4E0D4] bg-transparent px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-[#15202B]/[0.04] hover:text-[#15202B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2"
              >
                로그인 없이 둘러보기 →
              </button>
            </>
          )}
        </section>

        <Link
          to="/"
          className="mt-4 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ← 시작 화면으로
        </Link>
      </main>
    </div>
  );
};

export default StudentLogin;