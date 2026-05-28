import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ensureSession } from "@/lib/tracking";
import { enterDemoMode } from "@/lib/demo";
import { HomeBrand } from "@/components/HomeBrand";
import { WORKFLOW_STEPS } from "@/lib/workflowSteps";

const STEPS = [
  { n: 1, title: WORKFLOW_STEPS[1].full, sub: "요청·거절 화행 시나리오" },
  { n: 2, title: WORKFLOW_STEPS[2].full, sub: "기본 vs 전략 프롬프트" },
  { n: 3, title: WORKFLOW_STEPS[3].full, sub: "의미 충실 · 관계 유지 · 리스크 관리" },
  { n: 4, title: WORKFLOW_STEPS[4].full, sub: "AI 번역 참고 → 최종안 확정" },
  { n: 5, title: WORKFLOW_STEPS[5].full, sub: "학습 흐름 시각화" },
];

const Landing = () => {
  const navigate = useNavigate();
  useEffect(() => {
    ensureSession();
  }, []);
  const handleDemo = () => {
    enterDemoMode();
    navigate("/scenario");
  };
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/dashboard"
              className="text-sm text-[#8899A6] transition-colors hover:text-[#F1EFE8]"
            >
              관리자 영역 →
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 py-16 sm:py-24">
        {/* HERO */}
        <section className="text-center">
          <h1 className="text-[32px] font-bold leading-[1.15] tracking-tight sm:text-[38px] lg:text-[44px] lg:whitespace-nowrap">
            AI 기반 한·중 통번역 학습 워크플로우
          </h1>
          <p className="mt-3 text-[16px] leading-snug text-muted-foreground sm:text-[17px]">
            AI 번역안을 상황에 맞게 고르고 다듬는 번역 의사결정 능력을 기릅니다.
          </p>
        </section>

        {/* WORKFLOW DIAGRAM */}
        <section className="mt-10 w-full">
          <div className="flex flex-col items-stretch gap-3 sm:grid sm:grid-cols-2 sm:gap-3 lg:flex lg:flex-row lg:items-stretch lg:justify-between lg:gap-0">
            {STEPS.map((s, idx) => (
              <div key={s.n} className="flex items-center lg:flex-1">
                <div className="relative w-full rounded-lg border border-[#15202B] bg-[#FAFAFA] px-3 pt-3 pb-3.5 text-center shadow-sm">
                  <span className="mx-auto mb-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#FAD338] text-[10px] font-bold text-[#15202B]">
                    {s.n}
                  </span>
                  <div className="text-[15px] font-bold leading-tight tracking-tight">
                    {s.title}
                  </div>
                  <div className="mt-1 text-[13px] leading-snug text-muted-foreground">
                    {s.sub}
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="hidden shrink-0 px-1.5 text-base font-medium text-foreground lg:inline-block"
                  >
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[13px] text-muted-foreground">
            비선형 학습 — 언제든 이전 단계로 돌아가 수정 가능합니다
          </p>
        </section>

        {/* CTA */}
        <section className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-3">
          <Link
            to="/scenario"
            className="rounded-md bg-[#FAD338] px-7 py-3 text-[16px] font-bold text-[#15202B] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:bg-[#E8B91F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
          >
            학습 시작하기 →
          </Link>
          <button
            type="button"
            onClick={handleDemo}
            className="rounded-md border border-[#15202B] bg-transparent px-7 py-3 text-[16px] font-medium text-[#15202B] transition-colors hover:bg-[#15202B]/[0.04]"
          >
            데모 모드로 보기
          </button>
        </section>
      </main>
    </div>
  );
};

export default Landing;
