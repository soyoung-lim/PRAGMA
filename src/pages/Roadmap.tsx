import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, MapPin, ListChecks, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
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
 * ROADMAP — 15주 학습 설계 (16 항목: 0~15주차)
 * 데이터 소스: public.course_weeks 테이블
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

type RoadmapItem = {
  week: number;
  stage: Stage;
  topic: string;
  isExam: boolean;
};

/** 현재 주차는 getCurrentWeek()로 계산 (하드코딩 제거) */




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
  const { profile } = useProfile();
  const isProfileComplete = !!profile?.profile_completed;
  // 프로필 미완료 시 활성 주차 없음 → 강조/체크/핀 없이 균일 렌더링
  const activeWeek = isProfileComplete ? getCurrentWeek() : -1;
  const [roadmap, setRoadmap] = useState<RoadmapItem[] | null>(null);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("course_weeks")
        .select("week_no, course_phase, detail_topic, is_exam_week")
        .order("week_no", { ascending: true });
      if (cancelled) return;
      if (error || !data) {
        setRoadmap([]);
        return;
      }
      setRoadmap(
        data.map((r) => ({
          week: r.week_no as number,
          stage: r.course_phase as Stage,
          topic: r.detail_topic as string,
          isExam: r.is_exam_week as boolean,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        {/* 2. Top card — assignments 연결 전까지 공통 안내 (특정 주차 주제 하드코딩 금지) */}
        <section
          className="rounded-2xl bg-accent p-4 text-accent-foreground"
          aria-label="공통 15주 학습 설계"
        >
          <div className="flex items-center gap-2 text-[15px] font-bold">
            <MapPin className="h-4 w-4" aria-hidden />
            강의계획
          </div>
          <h2 className="mt-2 text-[22px] font-bold leading-snug sm:text-[24px]">
            공통 15주 학습 설계
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed">
            오늘의 학습은 담당 교수자의 주차별 배정에 따라 열립니다. 15주 동안 상황 판단 → 후보 번역안 비교 → 수정·산출 → 통역 수행으로 확장됩니다.
          </p>
        </section>


        {/* 3. Semester flow */}
        <section className="mt-5">
          <div className="flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-destructive" aria-hidden />
            <h3 className="text-[18px] font-bold">주차별 학습 계획</h3>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {roadmap === null ? (
              <div className="col-span-full rounded-2xl border border-border bg-card p-4 text-[14px] text-muted-foreground">
                불러오는 중…
              </div>
            ) : roadmap.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-border bg-card p-4 text-[14px] text-muted-foreground">
                표시할 주차 데이터가 없습니다.
              </div>
            ) : (
            [
              { items: roadmap.filter((i) => i.week <= 7), label: "0–7주차 · 중간점검까지" },
              { items: roadmap.filter((i) => i.week >= 8), label: "8–15주차 · 기말 종합까지" },
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
                          isCurrent && "bg-accent/25",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
                            isDone && "bg-primary text-primary-foreground",
                            isCurrent && "bg-primary text-primary-foreground",
                            isFuture &&
                              "border border-border bg-background text-muted-foreground",
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
                              "opacity-70",
                          )}
                        >
                          {item.stage}
                        </span>

                        <div
                          className={cn(
                            "min-w-0 flex-1 text-[14px]",
                            isCurrent && "font-bold text-foreground",
                            isDone && "font-semibold text-foreground",
                            isFuture && "text-muted-foreground",
                          )}
                        >
                          <span className="font-semibold">{item.week}·</span> {item.topic}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))
            )}

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
