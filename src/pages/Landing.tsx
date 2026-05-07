import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ensureSession } from "@/lib/tracking";

const STEPS = [
  { n: 1, title: "화행 시나리오 선택", sub: "요청·거절·사과" },
  { n: 2, title: "상황 분석 및 이메일 작성", sub: "권력·거리·부담도·화행 전략" },
  { n: 3, title: "AI 번역 후보 생성·비교", sub: "기본 프롬프트 vs 전략 프롬프트" },
  { n: 4, title: "멀티-페르소나 피드백", sub: "의미 재현성 · 관계 적합성 · 리스크 관리" },
  { n: 5, title: "번역 의사결정 리포트", sub: "AI 번역 검토와 수정 판단 기록" },
];

const Landing = () => {
  useEffect(() => {
    ensureSession();
  }, []);
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-base font-bold sm:text-lg">
            <span aria-hidden className="inline-block h-5 w-1 rounded-sm bg-accent" />
            AI 기반 한·중 통번역 의사결정 워크플로우
          </span>
          <Link
            to="/scenario"
            className="hidden rounded-md border border-foreground px-3 py-1.5 text-sm font-medium hover:bg-muted sm:inline-block"
          >
            바로 시작 →
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-8">
        {/* HERO */}
        <section className="text-center">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-[44px]">
            AI 기반 한·중 통번역 의사결정 워크플로우
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            AI 번역 앞에서 무엇을 판단·수정·결정하는지 훈련하고 기록하는 도구
          </p>
        </section>

        {/* WORKFLOW DIAGRAM */}
        <section className="mt-10 sm:mt-14">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 lg:gap-1">
            {STEPS.map((s, idx) => (
              <div key={s.n} className="relative flex items-center">
                <div className="h-full w-full rounded-lg border border-foreground bg-background p-3 text-center">
                  <span className="inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
                    {s.n}
                  </span>
                  <div className="mt-1.5 text-[14px] font-bold leading-snug sm:text-[15px]">
                    {s.title}
                  </div>
                  <div className="mt-1 text-[11px] leading-snug tracking-tight text-muted-foreground">
                    {s.sub}
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="hidden px-1 text-muted-foreground lg:inline"
                  >
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
          <blockquote className="mx-auto mt-6 max-w-3xl border-l-4 border-accent bg-muted/60 px-4 py-3 text-left text-sm text-gray-700">
            이 도구는 'AI가 좋은 번역을 해주는가'가 아니라, '학습자가 AI 번역 앞에서 어떻게 판단하고 수정하는가'를 구조화·기록합니다.
          </blockquote>
        </section>

        {/* CTA */}
        <section className="mt-6 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row sm:gap-4">
          <Link
            to="/scenario"
            className="rounded-lg bg-accent px-8 py-4 text-base font-bold text-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
          >
            학습 시작하기 →
          </Link>
          <Link
            to="/dashboard?demo=true"
            className="rounded-lg border border-foreground bg-background px-8 py-4 text-base font-medium text-foreground transition-colors hover:bg-muted"
          >
            데모 모드로 보기
          </Link>
        </section>
      </main>
    </div>
  );
};

export default Landing;
