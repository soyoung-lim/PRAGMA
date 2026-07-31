import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { useLearnerCourse } from "@/lib/curriculum/useLearnerCourse";
import { MODE_LABEL, SPEECH_ACT_UI, type SpeechActUI } from "@/lib/pragma/enums";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import { hasIntroArc } from "@/lib/mission/mockIntroArc";

// 학습자 강좌 정본 — 관리자가 15주 편성기로 배정한 실제 시나리오를 주차별로 보여주고,
// 검토 완료된 미션은 눌러서 실행(러너)까지 잇는다. 편성 → 학습자 실행 루프의 연결부다.

const card = "rounded-xl border border-[#EAE4D2] bg-white p-4";

const LearnerCourseLive = () => {
  const navigate = useNavigate();
  const { data: course = null, error, isPending: loading } = useLearnerCourse();

  const assignedTotal =
    course?.weeks.reduce((s, w) => s + w.scenarios.length, 0) ?? 0;

  return (
    <LearnerJourneyShell headerRight={<span className="text-[12px] text-[#8899A6]">편성 강좌</span>}>
      <div className="pb-24">
        <h2 className="text-[18px] font-bold">내 강좌</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          담당 교강사가 편성한 주차별 과제입니다. 준비된 미션을 눌러 시작하세요.
        </p>

        {loading ? (
          <p className="mt-6 text-[13px] text-muted-foreground">불러오는 중…</p>
        ) : error ? (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
            {error instanceof Error ? error.message : "강좌를 불러오지 못했습니다."}
          </div>
        ) : !course ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#EAE4D2] bg-white px-6 py-10 text-center text-[13px] text-muted-foreground">
            아직 게시된 편성 강좌가 없습니다.
          </div>
        ) : (
          <>
            <div className={`mt-4 ${card}`}>
              <div className="text-[14.5px] font-semibold">{course.outline.title}</div>
              <div className="mt-1 text-[12.5px] text-muted-foreground">
                검토 완료 과제 {assignedTotal}개
              </div>
            </div>

            <ol className="mt-4 space-y-3">
              {course.weeks.map((w) => {
                const act = w.speech_act as SpeechActUI | null;
                const isEval = w.type === "midterm" || w.type === "final";
                return (
                  <li key={w.week_no} className={card}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-7 min-w-[3.2rem] items-center justify-center rounded-md bg-[#15202B] px-2 text-[12.5px] font-semibold text-white">
                        {w.week_no}주차
                      </span>
                      <span className="text-[14px] font-medium">{w.title}</span>
                      {act && <Badge variant="secondary" className="font-normal">{SPEECH_ACT_UI[act]}</Badge>}
                      {isEval && (
                        <Badge variant="secondary" className="bg-[#EAE4D2] font-normal text-[#5B5446]">
                          평가 주차
                        </Badge>
                      )}
                    </div>

                    {w.can_do.length > 0 && (
                      <ul className="mt-2 space-y-1 text-[12.5px] text-muted-foreground">
                        {w.can_do.slice(0, 2).map((canDo) => (
                          <li key={canDo}>✓ {canDo}</li>
                        ))}
                      </ul>
                    )}

                    {/* 학습 노트는 예습·복습면이다. Roever 교수 단계의 Hook·귀납·원리
                        설명은 목표 특징 최초 도입 시 1회 도는 도입 아크(IntroArc)이지
                        이 노트가 아니므로, 여기에 '원리' 이름을 붙이지 않는다. */}
                    <button
                      type="button"
                      onClick={() => navigate(`/learner/course/week/${w.week_no}/note`)}
                      className="mt-3 inline-flex items-center rounded-md border border-[#15202B] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#15202B] transition-colors hover:bg-[#F7F4EA]"
                    >
                      주차 학습 노트 보기 →
                    </button>

                    {/* 이 주차의 목표 특징에 도입 아크가 있으면, 미션 앞에 먼저 둔다.
                        Roever 교수 단계(Hook → 귀납 → 원리 → 수용)를 거친 뒤 산출로 간다. */}
                    {w.scenarios.some((s) => hasIntroArc(s.target_feature)) && (
                      <div className="mt-3 rounded-lg border border-[#F0E3B8] bg-[#FFFBEA] px-3.5 py-3">
                        <div className="text-[12.5px] font-bold text-[#6B5518]">
                          이 표현 방식은 이번이 처음이에요
                        </div>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-[#7A6631]">
                          장면을 먼저 보고, 무엇이 차이를 만드는지 찾은 다음 미션으로 넘어갑니다.
                        </p>
                        <button
                          type="button"
                          onClick={() => navigate(`/learner/course/week/${w.week_no}/intro`)}
                          className="mt-2 inline-flex items-center rounded-md bg-[#15202B] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#22303C]"
                        >
                          먼저 배우기 →
                        </button>
                      </div>
                    )}

                    {w.scenarios.length === 0 ? (
                      <p className="mt-2 text-[12.5px] text-muted-foreground">
                        {isEval ? "평가 주차입니다." : "아직 배정된 과제가 없습니다."}
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {w.scenarios.map((s) => {
                          const feat = s.target_feature ? getTargetFeature(s.target_feature) : undefined;
                          return (
                            <li
                              key={s.scenario_id}
                              className="flex items-center gap-3 rounded-lg bg-[#FAF8F2] px-3.5 py-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-[13.5px]">{s.situation_ko}</p>
                                <p className="mt-0.5 flex flex-wrap gap-1.5 text-[11.5px] text-muted-foreground">
                                  <span>{s.mode === "stt_interpreting" ? MODE_LABEL.stt_interpreting : MODE_LABEL.translation}</span>
                                  {s.target_feature && <span>· {feat?.learner_label ?? "핵심 미지정"}</span>}
                                </p>
                              </div>
                              {s.runnable ? (
                                <Button
                                  size="sm"
                                  onClick={() => navigate(`/learner/practice/${s.scenario_id}`)}
                                >
                                  미션 시작 →
                                </Button>
                              ) : (
                                <span className="shrink-0 rounded-md bg-[#EFEBDD] px-2.5 py-1 text-[11.5px] text-[#8A8272]">
                                  준비 중
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
      <LearnerBottomNav />
    </LearnerJourneyShell>
  );
};

export default LearnerCourseLive;
