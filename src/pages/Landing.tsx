import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ensureSession } from "@/lib/tracking";
import { seedDemoData } from "@/lib/demo";

const STEPS = [
  { n: 1, title: "화행·시나리오 선택", sub: "요청·거절·사과" },
  { n: 2, title: "상황 판단·원문 작성", sub: "P·D·R·화행 전략" },
  { n: 3, title: "AI 번역 비교", sub: "기본형 vs 화용 정보 반영형" },
  { n: 4, title: "페르소나 피드백", sub: "수신자·교수자·리스크 관점" },
  { n: 5, title: "의사결정 리포트", sub: "판단·수정·최종 결정 기록" },
];

const Landing = () => {
  const navigate = useNavigate();
  useEffect(() => {
    ensureSession();
  }, []);
  const handleDemo = () => {
    seedDemoData();
    navigate("/scenario");
  };
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b-2 border-foreground/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-base font-bold sm:text-lg">
            <span aria-hidden className="inline-block h-4 w-[2px] rounded-full bg-accent" />
            AI 기반 한·중 통번역 학습 워크플로우
          </span>
          <Link
            to="/scenario"
            className="hidden rounded-md border border-foreground/80 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:inline-block"
          >
            바로 시작 →
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 py-16 sm:py-24">
        {/* HERO */}
        <section className="text-center">
          <h1 className="text-4xl font-bold sm:text-5xl lg:text-[56px]">
            AI 기반 한·중 통번역 학습 워크플로우
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-[17px]">
            화용적 의사결정과 멀티-페르소나 피드백을 통합한 학습 시스템
          </p>
        </section>

        {/* WORKFLOW DIAGRAM */}
        <section className="mt-12 w-full sm:mt-14">
          <div className="flex flex-col items-stretch gap-3 sm:grid sm:grid-cols-2 sm:gap-3 lg:flex lg:flex-row lg:items-stretch lg:justify-between lg:gap-0">
            {STEPS.map((s, idx) => (
              <div key={s.n} className="flex items-center lg:flex-1">
                <div className="relative w-full rounded-2xl border-[1.5px] border-[#1D2230] bg-card px-4 pt-7 pb-5 text-center shadow-sm">
                  <span
                    className="absolute -top-3 left-1/2 inline-flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full text-xs font-bold text-[#1D2230] ring-2 ring-card"
                    style={{ backgroundColor: "#E8C547" }}
                  >
                    {s.n}
                  </span>
                  <div className="text-[15px] font-bold leading-snug sm:text-[16px]">
                    {s.title}
                  </div>
                  <div className="mt-2 text-[12px] leading-snug text-muted-foreground">
                    {s.sub}
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="hidden shrink-0 px-2 text-2xl font-bold text-foreground lg:inline-block"
                  >
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            비선형 학습 — 언제든 이전 단계로 돌아가 수정 가능합니다
          </p>
        </section>

        {/* CTA */}
        <section className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            to="/scenario"
            className="rounded-lg px-10 py-4 text-base font-bold text-[#1D2230] shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
            style={{ backgroundColor: "#EBD68A" }}
          >
            학습 시작하기 →
          </Link>
          <button
            type="button"
            onClick={handleDemo}
            className="rounded-lg border-2 border-foreground/80 bg-card px-10 py-4 text-base font-medium text-foreground transition-colors hover:bg-muted"
          >
            데모 모드로 보기
          </button>
        </section>
      </main>
    </div>
  );
};

export default Landing;
