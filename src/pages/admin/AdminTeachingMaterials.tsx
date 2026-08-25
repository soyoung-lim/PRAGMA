import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminShell } from "@/components/AdminShell";
import { InstructorMissionGuide } from "@/components/admin/InstructorMissionGuide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { LEVEL, SPEECH_ACT_UI, type LearnerLevel, type SpeechActUI } from "@/lib/pragma/enums";
import { buildInstructorMissionGuide } from "@/lib/pragma/instructorGuide";
import { normalizeMission, type MissionRuntime } from "@/lib/pragma/missionSchema";
import { isMissionReleasedForLearner } from "@/lib/mission/missionRelease";

type TeachingMission = {
  scenarioId: string;
  speechAct: SpeechActUI | null;
  learnerLevel: LearnerLevel | null;
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
  const [speechActFilter, setSpeechActFilter] = useState<"all" | SpeechActUI>("all");
  const [levelFilter, setLevelFilter] = useState<"all" | LearnerLevel>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          missionStatus: row.mission_status,
          releaseGateMode: row.release_gate_mode ?? "legacy_reviewed",
          reviewedAt: row.mission_reviewed_at ?? null,
          mission: mission.data,
        } satisfies TeachingMission];
      });
      setMissions(parsed);
      const requested = searchParams.get("mission");
      setSelectedId((current) => {
        if (current && parsed.some((mission) => mission.scenarioId === current)) return current;
        if (requested && parsed.some((mission) => mission.scenarioId === requested)) return requested;
        return parsed[0]?.scenarioId ?? "";
      });
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
  const guide = selected
    ? buildInstructorMissionGuide(
        selected.mission,
        selected.speechAct ? SPEECH_ACT_UI[selected.speechAct] : "화행",
      )
    : null;
  const learnerVisible = selected
    ? isMissionReleasedForLearner({
        mission_status: selected.missionStatus,
        release_gate_mode: selected.releaseGateMode,
      })
    : false;

  const chooseMission = (scenarioId: string) => {
    setSelectedId(scenarioId);
    setSearchParams({ mission: scenarioId }, { replace: true });
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
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <div className="text-[11.5px] text-[#657178]">
                <span className={learnerVisible ? "font-semibold text-[#2E7D5B]" : "font-semibold text-[#8A6A18]"}>
                  {learnerVisible ? "학습자 사용 가능" : "내부 검토 완료 · 공개 gate 전"}
                </span>
                <span className="mx-2">·</span>
                미션 {selected.scenarioId}
              </div>
              <Button size="sm" onClick={() => window.print()}>인쇄·PDF 저장</Button>
            </div>
          )}
        </section>

        {loading && <p className="rounded-xl border bg-white px-5 py-10 text-center text-sm text-muted-foreground">승인된 미션을 불러오는 중…</p>}
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="rounded-xl border border-dashed bg-white px-5 py-10 text-center text-sm text-muted-foreground">조건에 맞는 승인 미션이 없습니다.</p>
        )}
        {guide && <InstructorMissionGuide guide={guide} />}
      </div>
    </AdminShell>
  );
};

export default AdminTeachingMaterials;
