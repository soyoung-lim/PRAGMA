import { useNavigate } from "react-router-dom";
import { Check, MapPin, ListChecks, CircleDot, Target } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ROADMAP — 15주 학습 설계 (16 항목: 0~15주차)
 * 나중에 DB(assignments/curriculum) 로 옮길 지점.
 */
type Stage =
  | "시작 준비"
  | "정형 화행"
  | "대인 화행"
  | "음성 통역"
  | "중간점검"
  | "고부담 화행"
  | "복합 과제"
  | "기말 종합";

type RoadmapItem = { week: number; stage: Stage; topic: string };

const ROADMAP: RoadmapItem[] = [
  { week: 0, stage: "시작 준비", topic: "학습자 프로필 설정" },
  { week: 1, stage: "정형 화행", topic: "감사 표현" },
  { week: 2, stage: "정형 화행", topic: "칭찬 · 칭찬 응답" },
  { week: 3, stage: "대인 화행", topic: "요청할 때 직접성 조절하기" },
  { week: 4, stage: "대인 화행", topic: "제안할 때 직접성 조절하기" },
  { week: 5, stage: "대인 화행", topic: "동의 · 반대 표현" },
  { week: 6, stage: "음성 통역", topic: "정형 · 대인 화행 통역 맛보기" },
  { week: 7, stage: "중간점검", topic: "번역 판단 · 수정 + 짧은 통역" },
  { week: 8, stage: "고부담 화행", topic: "사과 표현" },
  { week: 9, stage: "고부담 화행", topic: "거절 표현" },
  { week: 10, stage: "고부담 화행", topic: "불만 · 불만 대응" },
  { week: 11, stage: "복합 과제", topic: "설득 · 조율" },
  { week: 12, stage: "복합 과제", topic: "협상" },
  { week: 13, stage: "음성 통역", topic: "고부담 화행 통역" },
  { week: 14, stage: "음성 통역", topic: "복합 과제 통역" },
  { week: 15, stage: "기말 종합", topic: "최종 통번역 수행 · 성장 리포트" },
];

/** 나중에 assignments 에서 읽어올 지점 */
const CURRENT_WEEK = 4;

/** 나중에 scenarios/assignments 에서 읽어올 지점 */
const TODAY = {
  weekLabel: "4주차 학습",
  title: "오늘의 주제: 제안할 때 직접성 조절하기",
  goal: "원문의 의미를 유지하며, 제안 표현의 강도를 조절하기",
  intro: "상대에게 부담이 큰 요청을, 너무 직접적으로 말하지 않기",
  steps: [
    "오늘의 화용 포인트 보기",
    "상황과 원문 읽기",
    "후보 번역문 비교하기",
    "가장 적절한 표현 고르기",
    "부적절한 표현 수정하기",
    "나의 최종 번역안 제출하기",
    "피드백과 성장 리포트 확인하기",
  ],
};

const STAGE_STYLE: Record<Stage, string> = {
  "시작 준비": "bg-muted text-muted-foreground",
  "정형 화행": "bg-muted text-foreground/80",
  "대인 화행": "bg-muted text-foreground/80",
  "음성 통역": "bg-muted text-foreground/80",
  "중간점검": "bg-destructive/10 text-destructive border border-destructive/30",
  "고부담 화행": "bg-muted text-foreground/80",
  "복합 과제": "bg-muted text-foreground/80",
  "기말 종합": "bg-destructive/10 text-destructive border border-destructive/30",
};

const Roadmap = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 1. Header (dark) */}
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-4 px-6 py-6">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-6 w-1.5 rounded-sm bg-accent" aria-hidden />
            <div>
              <h1 className="text-[20px] font-bold sm:text-[22px]">
                AI 기반 한중 통번역 학습 워크플로우
              </h1>
              <p className="mt-1 text-[13px] text-primary-foreground/70">
                상황에 맞는 표현을 판단하고 수정하는 화용 의사결정 훈련
              </p>
            </div>
          </div>
          <div className="shrink-0 pt-1">
            <span className="inline-block rounded-lg border border-accent px-3 py-1.5 text-[12px] font-semibold text-accent">
              강의계획 · 15주차 학습 설계
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        {/* 2. Today card (yellow) */}
        <section
          className="rounded-2xl bg-accent p-6 text-accent-foreground"
          aria-label="오늘의 학습"
        >
          <div className="flex items-center gap-2 text-[15px] font-bold">
            <MapPin className="h-4 w-4" aria-hidden />
            {TODAY.weekLabel}
          </div>
          <h2 className="mt-2 text-[22px] font-bold leading-snug sm:text-[24px]">
            {TODAY.title}
          </h2>
          <p className="mt-3 flex items-start gap-2 text-[14px] leading-relaxed">
            <Target className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">오늘의 목표</span> — {TODAY.goal}
            </span>
          </p>
        </section>

        {/* 3. Semester flow */}
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-destructive" aria-hidden />
            <h3 className="text-[17px] font-bold">이번 학기 학습 흐름</h3>
          </div>

          <ol className="mt-4 space-y-1.5 rounded-2xl border border-border bg-card p-3">
            {ROADMAP.map((item) => {
              const isDone = item.week < CURRENT_WEEK;
              const isCurrent = item.week === CURRENT_WEEK;
              const isFuture = item.week > CURRENT_WEEK;

              return (
                <li
                  key={item.week}
                  className={cn(
                    "flex items-center gap-4 rounded-xl px-3 py-2.5",
                    isCurrent && "bg-accent/25",
                  )}
                >
                  {/* circle */}
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
                      isDone && "bg-primary text-primary-foreground",
                      isCurrent && "bg-primary text-primary-foreground",
                      isFuture &&
                        "border border-border bg-background text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {isDone ? (
                      <Check className="h-4 w-4" />
                    ) : isCurrent ? (
                      <MapPin className="h-4 w-4" />
                    ) : (
                      item.week
                    )}
                  </div>

                  {/* week label */}
                  <div
                    className={cn(
                      "w-14 shrink-0 text-[14px] font-bold",
                      isFuture && "text-muted-foreground",
                    )}
                  >
                    {item.week}주차
                  </div>

                  {/* stage badge */}
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
                      STAGE_STYLE[item.stage],
                      isFuture &&
                        item.stage !== "중간점검" &&
                        item.stage !== "기말 종합" &&
                        "opacity-70",
                    )}
                  >
                    {item.stage}
                  </span>

                  {/* topic */}
                  <div
                    className={cn(
                      "text-[14px]",
                      isCurrent && "font-bold text-foreground",
                      isDone && "font-semibold text-foreground",
                      isFuture && "text-muted-foreground",
                    )}
                  >
                    {item.topic}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* 4. Today's ordered steps */}
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-destructive" aria-hidden />
            <h3 className="text-[17px] font-bold">오늘 이 순서로 진행합니다</h3>
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">{TODAY.intro}</p>

          <ol className="mt-4 space-y-1 rounded-2xl border border-border bg-card p-5">
            {TODAY.steps.map((label, idx) => (
              <li
                key={idx}
                className="flex items-center gap-4 rounded-lg px-2 py-2.5"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-[12px] font-semibold text-foreground">
                  {idx + 1}
                </div>
                <div className="text-[14px] text-foreground">{label}</div>
              </li>
            ))}
          </ol>
        </section>

        {/* 5. Completion note (green left border) */}
        <section className="mt-8">
          <div className="flex items-start gap-3 rounded-xl border border-border border-l-4 border-l-emerald-600 bg-card p-4">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <p className="text-[13.5px] leading-relaxed text-foreground">
              오늘 학습을 마치면 <b>나의 판단 · 수정 · 최종안</b>이 성장 리포트에
              기록되고, 다음 주차 학습에 반영됩니다.
            </p>
          </div>
        </section>

        {/* 6. CTA */}
        <section className="mt-8">
          <button
            type="button"
            onClick={() => navigate("/entry/task-mode")}
            className="w-full rounded-xl bg-accent px-6 py-4 text-[15px] font-bold text-accent-foreground shadow-sm transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            오늘의 학습 시작하기 →
          </button>
        </section>
      </main>
    </div>
  );
};

export default Roadmap;
