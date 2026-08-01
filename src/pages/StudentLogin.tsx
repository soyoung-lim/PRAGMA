import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { HomeBrand } from "@/components/HomeBrand";
import { useProfile } from "@/lib/auth/useProfile";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";

const StudentLogin = () => {
  const [busy, setBusy] = useState(false);
  const { loading, session, isDevStub } = useProfile();

  // Supabase가 Google OAuth를 직접 수행한다(Lovable 브로커 경유 없음) —
  // 그래서 로컬·Railway 어디서 열어도 동작한다. 성공하면 이 탭이 Google로
  // 이동하므로 호출 이후 코드는 실행되지 않는다.
  const handleGoogle = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/learner/course" },
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

  // 이미 인증된 학습자는 다시 Google 인증을 요구하지 않는다. /home이 프로필 완료
  // 여부를 확인해 학습 강좌 또는 프로필 작성으로 안전하게 이어 준다.
  if (!loading && (session || isDevStub)) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col items-center justify-center px-5 py-10 sm:pb-[13vh] sm:pt-14">
        {loading ? (
          <p className="text-[13.5px] text-muted-foreground" role="status">
            로그인 상태를 확인하는 중…
          </p>
        ) : (
          <>
            {/* 로그인은 학습의 목적이 아니라 입구다. 역할 → 학습 가치 → 인증 행동의
                순서로 읽히게 하고, 인증 우회는 접근 정책에 따라 제공하지 않는다. */}
            <section className="w-full max-w-[420px] rounded-xl border border-l-[5px] border-[#E8E4D8] border-l-[#FAD338] bg-white p-7 shadow-sm sm:p-8">
              <h1 className="flex items-center gap-2.5 break-keep text-[27px] font-bold leading-[1.25] tracking-[-0.025em] text-[#15202B]">
                <GraduationCap
                  aria-hidden
                  size={25}
                  strokeWidth={1.8}
                  className="shrink-0 text-[#3E4C57]"
                />
                <span>학습 시작하기</span>
              </h1>
              <p className="mt-2.5 break-keep text-[13.5px] leading-relaxed text-[#6B665C]">
                기록을 저장해 다음에 이어서 할 수 있습니다.
              </p>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                aria-busy={busy}
                className="mt-7 inline-flex min-h-12 max-w-full items-center justify-center gap-2.5 rounded-[10px] bg-[#15202B] px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#22303E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
              >
                <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center">
                  <svg viewBox="0 0 48 48" className="h-5 w-5">
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
                <span>{busy ? "Google로 이동하는 중…" : "Google 계정으로 로그인"}</span>
              </button>

              <p className="mt-3 text-left text-[11.5px] leading-relaxed text-[#8A8578]">
                학교·개인 계정 모두 가능합니다. 계정을 바꾸면 기록이 이어지지 않습니다.
              </p>
            </section>

            <Link
              to="/"
              className="group mt-5 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-[#687584] transition-colors hover:text-[#15202B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2"
            >
              <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
                ←
              </span>
              시작 화면으로
            </Link>
          </>
        )}
      </main>
    </div>
  );
};

export default StudentLogin;
