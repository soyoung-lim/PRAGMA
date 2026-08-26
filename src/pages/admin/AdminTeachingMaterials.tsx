import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { AdminShell } from "@/components/AdminShell";
import {
  INSTRUCTOR_GUIDE_STEP_COUNT,
  InstructorMissionGuide,
  InstructorMissionPairComparison,
  type InstructorGuideAudience,
} from "@/components/admin/InstructorMissionGuide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  LEVEL,
  SPEECH_ACT_UI,
  type LanguageDirection,
  type LearnerLevel,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import { buildInstructorMissionGuide } from "@/lib/pragma/instructorGuide";
import {
  INSTRUCTOR_GUIDE_TIMING_PRESETS,
  instructorGuideTimingPlan,
  isCompatibleInstructorGuideSecondary,
  parseInstructorGuideTimingPreset,
  shouldClearInstructorGuideSecondary,
  type InstructorGuideTimingPreset,
} from "@/lib/pragma/instructorGuideTiming";
import { normalizeMission, type MissionRuntime } from "@/lib/pragma/missionSchema";
import { isMissionReleasedForLearner } from "@/lib/mission/missionRelease";

type TeachingMission = {
  scenarioId: string;
  speechAct: SpeechActUI | null;
  learnerLevel: LearnerLevel | null;
  mode: string | null;
  direction: LanguageDirection;
  missionStatus: string;
  releaseGateMode: string | null;
  reviewedAt: string | null;
  mission: MissionRuntime;
};

const db = supabase as unknown as { from: (table: string) => any };
const ROW_CAP = 1000;

const AdminTeachingMaterials = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [missions, setMissions] = useState<TeachingMission[]>([]);
  const [selectedId, setSelectedId] = useState(searchParams.get("mission") ?? "");
  const [secondaryId, setSecondaryId] = useState(searchParams.get("mission2") ?? "");
  const [speechActFilter, setSpeechActFilter] = useState<"all" | SpeechActUI>("all");
  const [levelFilter, setLevelFilter] = useState<"all" | LearnerLevel>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectorOpen, setProjectorOpen] = useState(false);
  const [projectorStep, setProjectorStep] = useState(1);
  const [projectorMissionIndex, setProjectorMissionIndex] = useState<0 | 1>(0);
  const [answersRevealed, setAnswersRevealed] = useState(false);
  const [printAudience, setPrintAudience] = useState<InstructorGuideAudience>("instructor");
  const [timingPreset, setTimingPreset] = useState<InstructorGuideTimingPreset>(() => (
    parseInstructorGuideTimingPreset(searchParams.get("timing"))
  ));

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data, error: queryError } = await db
        .from("scenarios")
        .select("scenario_id,speech_act,learner_level,mission_status,release_gate_mode,mission_reviewed_at,mission_content")
        .in("mission_status", ["reviewed", "released"])
        .not("mission_content", "is", null)
        .order("mission_reviewed_at", { ascending: false, nullsFirst: false })
        .limit(ROW_CAP);
      if (cancelled) return;
      if (queryError) {
        setError(`수업자료 미션 조회 실패: ${queryError.message}`);
        setLoading(false);
        return;
      }
      const parsed = (data ?? []).flatMap((row: any) => {
        const mission = normalizeMission(row.mission_content);
        if (!mission.ok || !mission.data) return [];
        return [{
          scenarioId: row.scenario_id,
          speechAct: row.speech_act ?? null,
          learnerLevel: row.learner_level ?? null,
          mode: mission.data.production_task.mode,
          direction: mission.data.direction,
          missionStatus: row.mission_status,
          releaseGateMode: row.release_gate_mode ?? "legacy_reviewed",
          reviewedAt: row.mission_reviewed_at ?? null,
          mission: mission.data,
        } satisfies TeachingMission];
      });
      setMissions(parsed);
      setSelectedId((current) => {
        if (current && parsed.some((mission) => mission.scenarioId === current)) return current;
        return parsed[0]?.scenarioId ?? "";
      });
      setSecondaryId((current) => (
        current && parsed.some((mission) => mission.scenarioId === current) ? current : ""
      ));
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return missions.filter((mission) => {
      const situation = mission.mission.production_task.situation_ko.toLowerCase();
      return (speechActFilter === "all" || mission.speechAct === speechActFilter)
        && (levelFilter === "all" || mission.learnerLevel === levelFilter)
        && (!query || situation.includes(query) || mission.scenarioId.toLowerCase().includes(query));
    });
  }, [missions, speechActFilter, levelFilter, search]);

  useEffect(() => {
    if (filtered.length > 0 && !filtered.some((mission) => mission.scenarioId === selectedId)) {
      setSelectedId(filtered[0].scenarioId);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((mission) => mission.scenarioId === selectedId) ?? null;
  const secondaryCandidates = selected
    ? missions.filter((mission) => isCompatibleInstructorGuideSecondary(selected, mission))
    : [];
  const selectedSecondary = secondaryCandidates.find((mission) => mission.scenarioId === secondaryId) ?? null;
  const guide = selected
    ? buildInstructorMissionGuide(
        selected.mission,
        selected.speechAct ? SPEECH_ACT_UI[selected.speechAct] : "화행",
      )
    : null;
  const secondaryGuide = timingPreset === 90 && selectedSecondary
    ? buildInstructorMissionGuide(
        selectedSecondary.mission,
        selectedSecondary.speechAct ? SPEECH_ACT_UI[selectedSecondary.speechAct] : "화행",
      )
    : null;
  const timingPlan = instructorGuideTimingPlan(timingPreset);
  const pairReady = timingPreset !== 90 || secondaryGuide !== null;

  useEffect(() => {
    if (shouldClearInstructorGuideSecondary(loading, secondaryId, selectedSecondary?.scenarioId ?? null)) {
      setSecondaryId("");
      const next = new URLSearchParams(searchParams);
      next.delete("mission2");
      setSearchParams(next, { replace: true });
    }
  }, [loading, secondaryId, selectedSecondary, searchParams, setSearchParams]);

  useEffect(() => {
    if (!projectorOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const moveTo = (step: number) => {
      setProjectorStep(Math.max(1, Math.min(INSTRUCTOR_GUIDE_STEP_COUNT, step)));
      setAnswersRevealed(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProjectorOpen(false);
        return;
      }
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        if (projectorStep === INSTRUCTOR_GUIDE_STEP_COUNT && projectorMissionIndex === 0 && secondaryGuide) {
          setProjectorMissionIndex(1);
          setProjectorStep(1);
          setAnswersRevealed(false);
          return;
        }
        setProjectorStep((current) => {
          const next = Math.min(INSTRUCTOR_GUIDE_STEP_COUNT, current + 1);
          if (next !== current) setAnswersRevealed(false);
          return next;
        });
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        if (projectorStep === 1 && projectorMissionIndex === 1) {
          setProjectorMissionIndex(0);
          setProjectorStep(INSTRUCTOR_GUIDE_STEP_COUNT);
          setAnswersRevealed(false);
          return;
        }
        setProjectorStep((current) => {
          const next = Math.max(1, current - 1);
          if (next !== current) setAnswersRevealed(false);
          return next;
        });
      }
      if (event.key === "Enter" && projectorStep >= 2 && projectorStep <= 5) {
        event.preventDefault();
        setAnswersRevealed((current) => !current);
      }
      if (event.key >= "1" && event.key <= String(INSTRUCTOR_GUIDE_STEP_COUNT)) {
        moveTo(Number(event.key));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [projectorMissionIndex, projectorOpen, projectorStep, secondaryGuide]);

  const learnerVisible = selected
    ? isMissionReleasedForLearner({
        mission_status: selected.missionStatus,
        release_gate_mode: selected.releaseGateMode,
      })
    : false;
  const activeProjectorGuide = projectorMissionIndex === 1 && secondaryGuide ? secondaryGuide : guide;

  const chooseMission = (scenarioId: string) => {
    setSelectedId(scenarioId);
    setSecondaryId("");
    const next = new URLSearchParams(searchParams);
    next.set("mission", scenarioId);
    next.delete("mission2");
    setSearchParams(next, { replace: true });
  };

  const chooseSecondaryMission = (scenarioId: string) => {
    setSecondaryId(scenarioId);
    const next = new URLSearchParams(searchParams);
    if (scenarioId) next.set("mission2", scenarioId);
    else next.delete("mission2");
    setSearchParams(next, { replace: true });
  };

  const chooseTimingPreset = (preset: InstructorGuideTimingPreset) => {
    setTimingPreset(preset);
    const next = new URLSearchParams(searchParams);
    next.set("timing", String(preset));
    if (preset !== 90) next.delete("mission2");
    setSearchParams(next, { replace: true });
    if (preset !== 90) setSecondaryId("");
  };

  const openProjector = () => {
    if (!pairReady) return;
    setProjectorStep(1);
    setProjectorMissionIndex(0);
    setAnswersRevealed(false);
    setProjectorOpen(true);
  };

  const moveProjector = (step: number) => {
    setProjectorStep(Math.max(1, Math.min(INSTRUCTOR_GUIDE_STEP_COUNT, step)));
    setAnswersRevealed(false);
  };

  const moveToPreviousProjectorStep = () => {
    if (projectorStep === 1 && projectorMissionIndex === 1) {
      setProjectorMissionIndex(0);
      moveProjector(INSTRUCTOR_GUIDE_STEP_COUNT);
      return;
    }
    moveProjector(projectorStep - 1);
  };

  const moveToNextProjectorStep = () => {
    if (projectorStep === INSTRUCTOR_GUIDE_STEP_COUNT && projectorMissionIndex === 0 && secondaryGuide) {
      setProjectorMissionIndex(1);
      moveProjector(1);
      return;
    }
    moveProjector(projectorStep + 1);
  };

  const printGuide = (audience: InstructorGuideAudience) => {
    if (!pairReady) return;
    flushSync(() => setPrintAudience(audience));
    window.print();
    setPrintAudience("instructor");
  };

  return (
    <AdminShell
      title="수업 자료 생성"
      description="승인된 MPJ5+DCT1 미션을 웹앱 수행자료 중심의 교수자 수업안으로 조립합니다."
    >
      <div className="max-w-[1080px]">
        <section className="mb-5 rounded-xl border border-[#E2DED2] bg-white p-4 print:hidden">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[120px] flex-1">
              <span className="mb-1 block text-[11px] font-semibold text-[#53656F]">화행</span>
              <select value={speechActFilter} onChange={(event) => setSpeechActFilter(event.target.value as "all" | SpeechActUI)} className="h-9 w-full rounded-md border bg-white px-2 text-[12px]">
                <option value="all">전체 화행</option>
                {Object.entries(SPEECH_ACT_UI).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="min-w-[120px] flex-1">
              <span className="mb-1 block text-[11px] font-semibold text-[#53656F]">수준</span>
              <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as "all" | LearnerLevel)} className="h-9 w-full rounded-md border bg-white px-2 text-[12px]">
                <option value="all">전체 수준</option>
                {Object.entries(LEVEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="min-w-[220px] flex-[2]">
              <span className="mb-1 block text-[11px] font-semibold text-[#53656F]">상황 검색</span>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="상황 또는 미션 ID" className="h-9 text-[12px]" />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-[11px] font-semibold text-[#53656F]">승인 미션 {filtered.length}개</span>
            <select value={selectedId} onChange={(event) => chooseMission(event.target.value)} className="h-10 w-full rounded-md border bg-[#FAFBFB] px-3 text-[12px]">
              {filtered.map((mission) => (
                <option key={mission.scenarioId} value={mission.scenarioId}>
                  {mission.speechAct ? SPEECH_ACT_UI[mission.speechAct] : "화행 미상"} · {mission.learnerLevel ? LEVEL[mission.learnerLevel] : "수준 미상"} · {mission.mission.production_task.situation_ko}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <div className="mt-3 border-t pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-[#53656F]">수업 시간</span>
                {INSTRUCTOR_GUIDE_TIMING_PRESETS.map((preset) => (
                  <Button key={preset} size="sm" variant={timingPreset === preset ? "default" : "outline"} onClick={() => chooseTimingPreset(preset)}>
                    {preset}분
                  </Button>
                ))}
                <span className="text-[11.5px] text-[#657178]">{timingPlan.labelKo}</span>
              </div>
              {timingPreset === 90 && (
                <div className="mt-3 rounded-lg border border-[#E8D9AF] bg-[#FFF9E8] p-3">
                  <p className="text-[11.5px] text-[#6E5B20]">
                    90분은 같은 화행·수준·언어방향·수행모드의 독립 미션 1·2를 순서대로 운영합니다.
                  </p>
                  <label className="mt-2 block">
                    <span className="mb-1 block text-[11px] font-semibold text-[#53656F]">미션 2</span>
                    <select
                      value={secondaryId}
                      onChange={(event) => chooseSecondaryMission(event.target.value)}
                      className="h-10 w-full rounded-md border bg-white px-3 text-[12px]"
                    >
                      <option value="">두 번째 승인 미션 선택</option>
                      {secondaryCandidates.map((mission) => (
                        <option key={mission.scenarioId} value={mission.scenarioId}>
                          {mission.mission.production_task.situation_ko}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!secondaryGuide && (
                    <p className="mt-2 text-[11px] font-semibold text-[#8A5A18]">
                      두 번째 미션을 선택하면 두 활동지·교실 화면·비교 활동이 함께 열립니다.
                    </p>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11.5px] text-[#657178]">
                  <span className={learnerVisible ? "font-semibold text-[#2E7D5B]" : "font-semibold text-[#8A6A18]"}>
                    {learnerVisible ? "학습자 사용 가능" : "내부 검토 완료 · 공개 gate 전"}
                  </span>
                  <span className="mx-2">·</span>
                  미션 {selected.scenarioId}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={!pairReady} onClick={openProjector}>교실 큰 화면</Button>
                  <Button size="sm" variant="outline" disabled={!pairReady} onClick={() => printGuide("student")}>학생 활동지 인쇄</Button>
                  <Button size="sm" disabled={!pairReady} onClick={() => printGuide("instructor")}>교수자용 인쇄·PDF</Button>
                </div>
              </div>
            </div>
          )}
        </section>

        {loading && <p className="rounded-xl border bg-white px-5 py-10 text-center text-sm text-muted-foreground">승인된 미션을 불러오는 중…</p>}
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="rounded-xl border border-dashed bg-white px-5 py-10 text-center text-sm text-muted-foreground">조건에 맞는 승인 미션이 없습니다.</p>
        )}
        {guide && (
          <>
            <InstructorMissionGuide
              guide={guide}
              audience={printAudience}
              timingPlan={timingPlan}
              missionLabel={secondaryGuide && timingPreset === 90 ? "미션 1" : undefined}
            />
            {secondaryGuide && timingPreset === 90 && (
              <>
                <div className="mt-5 print:mt-0 print:[break-before:page]">
                  <InstructorMissionGuide
                    guide={secondaryGuide}
                    audience={printAudience}
                    timingPlan={null}
                    missionLabel="미션 2"
                  />
                </div>
                <InstructorMissionPairComparison
                  firstGuide={guide}
                  secondGuide={secondaryGuide}
                  audience={printAudience}
                />
              </>
            )}
          </>
        )}
      </div>

      {projectorOpen && activeProjectorGuide && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#F7F4EC] text-[#15202B] print:hidden" role="dialog" aria-modal="true" aria-label="교실 큰 화면">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8D0BC] bg-[#15202B] px-4 py-3 text-white sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FAD338]">PRAGMA 교실 화면</p>
              <h2 className="mt-0.5 text-lg font-bold sm:text-xl">
                {activeProjectorGuide.speechActKo} · MPJ5+DCT1
                {secondaryGuide && timingPreset === 90 ? ` · 미션 ${projectorMissionIndex + 1}` : ""}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {projectorStep >= 2 && projectorStep <= 5 && (
                <Button
                  size="sm"
                  variant={answersRevealed ? "secondary" : "outline"}
                  className={answersRevealed ? "" : "border-[#FAD338] bg-transparent text-[#FAD338] hover:bg-[#263746] hover:text-[#FAD338]"}
                  onClick={() => setAnswersRevealed((current) => !current)}
                >
                  {answersRevealed ? "해설 숨기기" : "해설 공개"}
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-white hover:bg-[#263746] hover:text-white" onClick={() => setProjectorOpen(false)}>닫기 · Esc</Button>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <InstructorMissionGuide
              guide={activeProjectorGuide}
              displayMode="projector"
              activeStep={projectorStep}
              answersRevealed={answersRevealed}
              timingPlan={timingPlan}
            />
          </main>

          <footer className="flex items-center justify-between gap-3 border-t border-[#D8D0BC] bg-white px-4 py-3 sm:px-6">
            <Button
              variant="outline"
              disabled={projectorStep === 1 && projectorMissionIndex === 0}
              onClick={moveToPreviousProjectorStep}
            >
              ← 이전
            </Button>
            <p className="text-sm font-bold" aria-live="polite">
              {secondaryGuide && timingPreset === 90 ? `미션 ${projectorMissionIndex + 1} · ` : ""}
              {projectorStep} / {INSTRUCTOR_GUIDE_STEP_COUNT}
            </p>
            {projectorStep === INSTRUCTOR_GUIDE_STEP_COUNT && (!secondaryGuide || projectorMissionIndex === 1) ? (
              <Button onClick={() => setProjectorOpen(false)}>수업자료로 돌아가기</Button>
            ) : (
              <Button onClick={moveToNextProjectorStep}>
                {projectorStep === INSTRUCTOR_GUIDE_STEP_COUNT && projectorMissionIndex === 0 ? "미션 2로 →" : "다음 →"}
              </Button>
            )}
          </footer>
        </div>
      )}
    </AdminShell>
  );
};

export default AdminTeachingMaterials;
