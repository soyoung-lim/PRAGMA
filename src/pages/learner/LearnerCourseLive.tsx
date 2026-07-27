import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";
import { getPublishedCourse, type LearnerCourse } from "@/lib/curriculum/learnerCourse";
import { MODE_LABEL, SPEECH_ACT_UI, type SpeechActUI } from "@/lib/pragma/enums";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";

// 편성본 강좌(학습자) — 관리자가 15주 편성기로 배정한 실제 시나리오를 주차별로 보여주고,
// 검토 완료된 미션은 눌러서 실행(러너)까지 잇는다. 편성 → 학습자 실행 루프의 연결부.
// (기존 목업 15주 과정 CourseOverview는 그대로 두고, 이건 DB 편성본을 소비하는 실경로)

const card = "rounded-xl border border-[#EAE4D2] bg-white p-4";

const LearnerCourseLive = () => {
  const navigate = useNavigate();
  const [course, setCourse] = useState<LearnerCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const c = await getPublishedCourse();
        if (!cancelled) setCourse(c);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "강좌를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">{error}</div>
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
