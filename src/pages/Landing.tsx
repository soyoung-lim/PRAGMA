import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ensureSession } from "@/lib/tracking";
import { HomeBrand } from "@/components/HomeBrand";
import { IS_DEV_TEST_ENTRY_ENABLED } from "@/lib/auth/useProfile";
import { devTestEntrySignIn } from "@/lib/auth/devTestEntry";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";

const Landing = () => {
  const navigate = useNavigate();
  const [devBusy, setDevBusy] = useState(false);
  useEffect(() => {
    ensureSession();
  }, []);

  const handleDevEntry = async () => {
    setDevBusy(true);
    const res = await devTestEntrySignIn();
    if (!res.ok) {
      toast.error(res.message);
      setDevBusy(false);
      return;
    }
    navigate("/scenario", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 sm:py-24">
        <section className="text-center">
          <h1 className="text-[32px] font-bold leading-[1.15] tracking-tight sm:text-[38px] lg:text-[44px]">
            AI 기반 한·중 통번역 학습 워크플로우
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
            상황을 이해하고, 여러 번역안을 비교하며, 피드백을 바탕으로 나만의 최종안을 만들어갑니다.
          </p>
        </section>

        <section className="mt-12 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            to="/student-login"
            className="group flex flex-col items-start rounded-xl border border-[#15202B] bg-[#FAD338] px-6 py-7 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#E8B91F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
          >
            <span className="flex items-center gap-2 text-[20px] font-bold text-[#15202B]">
              <span aria-hidden>👤</span> 학습자 입장
            </span>
            <span className="mt-3 text-[14px] leading-relaxed text-[#15202B]/80">
              시나리오를 선택하고 AI 번역안을 비교·평가하며 통번역 의사결정 역량을 키웁니다.
            </span>
            <span className="mt-5 inline-flex items-center gap-1 rounded-md border border-[#15202B] bg-transparent px-4 py-2 text-[14px] font-medium text-[#15202B]">
              학습 시작하기 →
            </span>
          </Link>

          <Link
            to="/admin-login"
            className="group flex flex-col items-start rounded-xl border border-[#15202B] bg-[#FAFAFA] px-6 py-7 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
          >
            <span className="flex items-center gap-2 text-[20px] font-bold text-[#15202B]">
              <span aria-hidden>⚙️</span> 교수자 입장
            </span>
            <span className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
              AI로 시나리오를 생성·검수하고 학습자 데이터를 분석·관리합니다.
            </span>
            <span className="mt-5 inline-flex items-center gap-1 rounded-md border border-[#15202B] bg-transparent px-4 py-2 text-[14px] font-medium text-[#15202B]">
              관리자 영역 진입 →
            </span>
          </Link>
        </section>

        {IS_DEV_TEST_ENTRY_ENABLED && (
          <section className="mt-10 w-full max-w-md">
            <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 p-4 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                DEV ONLY · 본실험에는 노출되지 않음
              </div>
              <button
                type="button"
                onClick={handleDevEntry}
                disabled={devBusy}
                className="mt-2 w-full rounded-md border border-muted-foreground/40 bg-background px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted/60 disabled:opacity-60"
              >
                {devBusy ? "진입 중…" : "테스트 진입 (TEST-DEV-001 → /scenario)"}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Landing;
