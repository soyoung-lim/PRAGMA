import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, MapPin, ListChecks, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { setTaskMode, setLanguageDirection } from "@/lib/entryGate";
import { DEFAULT_LEARNING_CONTEXT } from "@/lib/learningContext";
import { useProfile } from "@/lib/auth/useProfile";

/**
 * 학습자의 현재 주차.
 * 임시 고정값(1주차). 진행 추적(decision_traces 기반 "완료한 마지막 주차+1")
 * 도입 시 이 함수만 교체하면 됨.
 */
const getCurrentWeek = (): number => 1;

/**
 * ROADMAP — 15주 화행 기반 커리큘럼
 * 정적 주차표. DB나 주차 배정 로직과 무관하게 표시용으로 사용합니다.
 */
type Stage =
  | "시작"
  | "표현 화행"
  | "지시 화행"
  | "응답 화행"
  | "중간점검"
  | "평가 화행"
  | "복합 담화 과업"
  | "기말 종합";

type RoadmapItem = {
  week: number;
  stage: Stage;
  topic: string;
};

const ROADMAP: RoadmapItem[] = [
  { week: 1, stage: "시작", topic: "오리엔테이션" },
  { week: 2, stage: "표현 화행", topic: "감사 표현" },
  { week: 3, stage: "표현 화행", topic: "칭찬·칭찬 응답" },
  { week: 4, stage: "지시 화행", topic: "요청 표현" },
  { week: 5, stage: "지시 화행", topic: "제안 표현" },
  { week: 6, stage: "응답 화행", topic: "수락·동의 표현" },
  { week: 7, stage: "응답 화행", topic: "거절 표현" },
  { week: 8, stage: "중간점검", topic: "판단·수정 종합" },
  { week: 9, stage: "표현 화행", topic: "사과 표현" },
  { week: 10, stage: "평가 화행", topic: "불만·불만 대응" },
  { week: 11, stage: "응답 화행", topic: "반대·의견 정당화" },
  { week: 12, stage: "응답 화행", topic: "고부담 거절" },
  { week: 13, stage: "지시 화행", topic: "고부담 요청" },
  { week: 14, stage: "복합 담화 과업", topic: "입장 조율·조건 협상" },
  { week: 15, stage: "기말 종합", topic: "최종 수행·성장 리포트" },
];

const TODAY = {
  intro: "상황과 원문을 읽고, 후보 표현을 비교·선택·수정한 뒤 최종안을 제출합니다.",
  steps: [
    "오늘의 화행 포인트 보기",
    "상황과 원문 읽기",
    "후보 표현 비교하기",
    "가장 적절한 표현 고르기",
    "부적절한 표현 수정하기",
    "나의 최종안 제출하기",
    "피드백과 성장 리포트 확인하기",
  ],
};

const STAGE_STYLE: Record<Stage, string> = {
  "시작 준비": "bg-muted text-muted-foreground",
  "표현 화행": "bg-muted text-foreground/80",
  "지시 화행": "bg-muted text-foreground/80",
  "응답 화행": "bg-muted text-foreground/80",
  "중간점검": "bg-destructive/10 text-destructive border border-destructive/30",
  "평가 화행": "bg-muted text-foreground/80",
  "복합 과제": "bg-muted text-foreground/80",
  "기말 종합": "bg-destructive/10 text-destructive border border-destructive/30",
};

const Roadmap = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const isProfileComplete = !!profile?.profile_completed;
  // 프로필 미완료 시 활성 주차 없음 → 강조/체크/핀 없이 균일 렌더링
  const activeWeek = isProfileComplete ? getCurrentWeek() : -1;
  const [roadmap] = useState<RoadmapItem[]>(ROADMAP);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 1. Header (dark) */}
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-4 px-6 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-6 w-1.5 rounded-sm bg-accent" aria-hidden />
            <div>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-left text-[20px] font-bold hover:underline sm:text-[22px]"
              >
                AI 기반 한중 통번역 학습 워크플로우
              </button>

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

      <main className="mx-auto w-full max-w-3xl px-6 py-5">
        {/* 2. Top card */}
        <section
          className="rounded-2xl bg-accent p-4 text-accent-foreground"
          aria-label="공통 15주 화행 기반 커리큘럼"
        >
          <div className="flex items-center gap-2 text-[15px] font-bold">
            <MapPin className="h-4 w-4" aria-hidden />
            공통 15주 화행 기반 커리큘럼
          </div>
          <h2 className="mt-2 text-[22px] font-bold leading-snug sm:text-[24px]">
            공통 15주 화행 기반 커리큘럼
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed">
            모든 수업은 같은 15주 화행 흐름을 공유합니다. 실제 수업에서는 학습자 수준, 언어방향, 산출 방식에 따라 과제가 다르게 구성됩니다.
          </p>
          <p className="mt-2 text-[14px] leading-relaxed opacity-90">
            15주 동안 감사, 칭찬, 요청, 제안, 수락·동의, 거절, 사과, 불만, 반대로 이어지는 9개 화행을 다루고, 후반부에는 입장 조율·조건 협상으로 확장합니다.
          </p>
        </section>

        {/* 3. Semester flow */}
        <section className="mt-5">
          <div className="flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-destructive" aria-hidden />
            <h3 className="text-[18px] font-bold">주차별 학습 계획</h3>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { items: roadmap.filter((i) => i.week <= 8), label: "0–8주차 · 중간점검까지" },
              { items: roadmap.filter((i) => i.week >= 9), label: "9–15주차 · 기말 종합까지" },
            ].map((col) => (
              <div key={col.label} className="rounded-2xl border border-border bg-card p-2.5">
                <div className="mb-2 inline-block rounded-full bg-muted px-3 py-1 text-[12px] font-semibold text-muted-foreground">
                  {col.label}
                </div>
                <ol className="space-y-1">
                  {col.items.map((item) => {
                    const isDone = item.week < activeWeek;
                    const isCurrent = item.week === activeWeek;
                    const isFuture = item.week > activeWeek || activeWeek < 0;

                    return (
                      <li
                        key={item.week}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-2 py-1.5",
                          isCurrent && "bg-accent/25"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
                            isDone && "bg-primary text-primary-foreground",
                            isCurrent && "bg-primary text-primary-foreground",
                            isFuture &&
                              "border border-border bg-background text-muted-foreground"
                          )}
                          aria-hidden
                        >
                          {isDone ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : isCurrent ? (
                            <MapPin className="h-3.5 w-3.5" />
                          ) : (
                            item.week
                          )}
                        </div>

                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium",
                            STAGE_STYLE[item.stage],
                            isFuture &&
                              item.stage !== "중간점검" &&
                              item.stage !== "기말 종합" &&
                              "opacity-70"
                          )}
                        >
                          {item.stage}
                        </span>

                        <div
                          className={cn(
                            "min-w-0 flex-1 text-[14px]",
                            isCurrent && "font-bold text-foreground",
                            isDone && "font-semibold text-foreground",
                            isFuture && "text-muted-foreground"
                          )}
                        >
                          <span className="font-semibold">{item.week}·</span> {item.topic}
                        </div>

                        {item.badge && (
                          <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                            {item.badge}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Today's ordered steps */}
        <section className="mt-5">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-destructive" aria-hidden />
            <h3 className="text-[18px] font-bold">오늘 이 순서로 진행합니다</h3>
          </div>
          <p className="mt-2 text-[14px] text-muted-foreground">{TODAY.intro}</p>

          <ol className="mt-3 space-y-1 rounded-2xl border border-border bg-card p-4">
            {TODAY.steps.map((label, idx) => (
              <li
                key={idx}
                className="flex items-center gap-4 rounded-lg px-2 py-1.5"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-[13px] font-semibold text-foreground">
                  {idx + 1}
                </div>
                <div className="text-[15px] text-foreground">{label}</div>
              </li>
            ))}
          </ol>
        </section>

        {/* 5. Completion note (green left border) */}
        <section className="mt-5">
          <div className="flex items-start gap-3 rounded-xl border border-border border-l-4 border-l-emerald-600 bg-card p-3">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <p className="text-[14px] leading-relaxed text-foreground">
              오늘 학습을 마치면 <b>나의 판단 · 수정 · 최종안</b>이 성장 리포트에
              기록되고, 다음 주차 학습에 반영됩니다.
            </p>
          </div>
        </section>

        {/* Workflow preview link — 정적 예시 페이지로 연결 */}
        <section className="mt-5">
          <button
            type="button"
            onClick={() => navigate("/workflow-preview")}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left text-[14px] font-semibold text-foreground hover:bg-muted/50"
          >
            <span>학습이 실제로 어떻게 진행되나요? — 예시 미리보기 보기</span>
            <span aria-hidden>→</span>
          </button>
        </section>

        {/* 6. CTA — 프로필 완료 여부로 분기 */}
        <section className="mt-5">
          {isProfileComplete ? (
            <button
              type="button"
              onClick={() => {
                // TEMP FALLBACK: 통역/번역·언어방향 선택 화면을 우회하고 바로 학습으로 진입.
                // assignments 연결 전까지만 DEFAULT_LEARNING_CONTEXT를 주입한다.
                setTaskMode(DEFAULT_LEARNING_CONTEXT.taskMode);
                setLanguageDirection(DEFAULT_LEARNING_CONTEXT.languageDirection);
                navigate("/scenario");
              }}
              className="w-full rounded-xl bg-accent px-6 py-4 text-[15px] font-bold text-accent-foreground shadow-sm transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              오늘의 학습 시작하기 →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/profile-setup")}
              className="w-full rounded-xl bg-accent px-6 py-4 text-[15px] font-bold text-accent-foreground shadow-sm transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              학습자 프로필 설정하기 →
            </button>
          )}
        </section>
      </main>
    </div>
  );
};

export default Roadmap;
