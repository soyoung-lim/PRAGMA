import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, LockKeyhole, PlayCircle, Rocket, Save } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { AdminShell } from "@/components/AdminShell";
import { ResearchWorkflowGuide } from "@/components/research/ResearchWorkflowGuide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type LineageRow = { id: string; scenario_id: string; version_no: number; stage: string; realization_pack_id: string; realization_pack_version: string; mission_content_hash: string; created_at: string };
type MissionResolutionRow = { id: string; lineage_version_id: string; review_round: number; resolution_revision: number; resolution_status: string; final_verdict: string; resolved_at: string };
type GoldCalibrationRow = { id: string; case_id: string; resolution_round: number; resolution_status: string; resolved_case_snapshot: { case_id?: string; realization_pack_id?: string; realization_pack_version?: string }; resolved_at: string };
type RegressionRow = { id: string; realization_pack_id: string; realization_pack_version: string; gate_status: string; evaluator_version: string; report: Record<string, unknown>; evaluation_purpose: string; is_quality_measurement: boolean; source_authority: string; interpretation_note_ko: string; created_at: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any; rpc: (name: string, args?: Record<string, unknown>) => any };

const PREVIEW_LINEAGE: LineageRow = { id: "10000000-0000-4000-8000-000000000051", scenario_id: "20000000-0000-4000-8000-000000000051", version_no: 3, stage: "reviewed", realization_pack_id: "pragma_ko_zh_core", realization_pack_version: "1.2.0", mission_content_hash: "preview-hash", created_at: "2026-08-15T00:00:00.000Z" };
const PREVIEW_RESOLUTION: MissionResolutionRow = { id: "30000000-0000-4000-8000-000000000051", lineage_version_id: PREVIEW_LINEAGE.id, review_round: 1, resolution_revision: 1, resolution_status: "unanimous", final_verdict: "approve", resolved_at: "2026-08-15T00:10:00.000Z" };
const PREVIEW_REGRESSION: RegressionRow = { id: "40000000-0000-4000-8000-000000000051", realization_pack_id: "pragma_ko_zh_core", realization_pack_version: "1.2.0", gate_status: "pass", evaluator_version: "preview-evaluator-v1", report: { mode: "researcher_gold_operational_gate", reference_case_count: 30, gate_status: "pass" }, evaluation_purpose: "operational_gate_check", is_quality_measurement: false, source_authority: "researcher_calibration", interpretation_note_ko: "연구 책임자가 확정한 기준답안 30건으로 품질 점검 자동화의 작동 조건만 확인합니다. 외부 전문가 18건의 내용타당성 확인과 별개입니다.", created_at: "2026-08-15T00:20:00.000Z" };

const AdminMissionRelease = ({ preview = false }: { preview?: boolean }) => {
  const { pathname } = useLocation();
  const [lineages, setLineages] = useState<LineageRow[]>(preview ? [PREVIEW_LINEAGE] : []);
  const [missionResolutions, setMissionResolutions] = useState<MissionResolutionRow[]>(preview ? [PREVIEW_RESOLUTION] : []);
  const [goldCalibrations, setGoldCalibrations] = useState<GoldCalibrationRow[]>([]);
  const [regressions, setRegressions] = useState<RegressionRow[]>(preview ? [PREVIEW_REGRESSION] : []);
  const [lineageId, setLineageId] = useState(preview ? PREVIEW_LINEAGE.id : "");
  const [missionResolutionId, setMissionResolutionId] = useState(preview ? PREVIEW_RESOLUTION.id : "");
  const [regressionId, setRegressionId] = useState(preview ? PREVIEW_REGRESSION.id : "");
  const [evaluatorVersion, setEvaluatorVersion] = useState("");
  const [promptHash, setPromptHash] = useState("");
  const [observationsText, setObservationsText] = useState("[]");
  const [loading, setLoading] = useState(!preview);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (preview) { setLoading(false); return; }
    setLoading(true);
    const [lineageResult, resolutionResult, goldResult, regressionResult] = await Promise.all([
      db.from("mission_lineage_versions").select("id,scenario_id,version_no,stage,realization_pack_id,realization_pack_version,mission_content_hash,created_at").eq("stage", "reviewed").eq("coverage_status", "covered").order("created_at", { ascending: false }),
      db.from("mission_review_resolutions").select("id,lineage_version_id,review_round,resolution_revision,resolution_status,final_verdict,resolved_at").eq("final_verdict", "approve").in("resolution_status", ["unanimous", "consensus_after_discussion"]).order("resolved_at", { ascending: false }),
      db.from("pragma_gold_calibration_resolutions").select("id,case_id,resolution_round,resolution_status,resolved_case_snapshot,resolved_at").eq("resolution_status", "researcher_approved").order("resolved_at", { ascending: false }),
      db.from("pragma_gold_regression_runs").select("id,realization_pack_id,realization_pack_version,gate_status,evaluator_version,report,evaluation_purpose,is_quality_measurement,source_authority,interpretation_note_ko,created_at").order("created_at", { ascending: false }),
    ]);
    const error = lineageResult.error ?? resolutionResult.error ?? goldResult.error ?? regressionResult.error;
    if (error) setMessage(error.message);
    else {
      const loadedLineages = (lineageResult.data ?? []) as LineageRow[];
      setLineages(loadedLineages); setMissionResolutions((resolutionResult.data ?? []) as MissionResolutionRow[]); setGoldCalibrations((goldResult.data ?? []) as GoldCalibrationRow[]); setRegressions((regressionResult.data ?? []) as RegressionRow[]);
      setLineageId((current) => current || loadedLineages[0]?.id || "");
    }
    setLoading(false);
  }, [preview]);
  useEffect(() => { void load(); }, [load]);

  const selectedLineage = lineages.find((item) => item.id === lineageId) ?? null;
  const compatibleMissionResolutions = useMemo(() => missionResolutions.filter((item) => item.lineage_version_id === lineageId), [missionResolutions, lineageId]);
  const compatibleRegressions = useMemo(() => regressions.filter((item) => item.gate_status === "pass" && item.source_authority === "researcher_calibration" && selectedLineage && item.realization_pack_id === selectedLineage.realization_pack_id && item.realization_pack_version === selectedLineage.realization_pack_version), [regressions, selectedLineage]);
  const authoritativeGold = useMemo(() => {
    const latest = new Map<string, GoldCalibrationRow>();
    for (const item of goldCalibrations) {
      const current = latest.get(item.case_id);
      if (!current || item.resolution_round > current.resolution_round) latest.set(item.case_id, item);
    }
    return [...latest.values()];
  }, [goldCalibrations]);
  const goldForPack = authoritativeGold.filter((item) => {
    const snapshot = item.resolved_case_snapshot;
    return snapshot?.realization_pack_id && snapshot.realization_pack_version
      && (!selectedLineage || (snapshot.realization_pack_id === selectedLineage.realization_pack_id && snapshot.realization_pack_version === selectedLineage.realization_pack_version));
  });

  const recordRegression = async () => {
    if (preview || !evaluatorVersion.trim() || !promptHash.trim()) return;
    setSaving(true); setMessage(null);
    try {
      const observations = JSON.parse(observationsText) as unknown;
      if (!Array.isArray(observations)) throw new Error("관측값은 JSON 배열이어야 합니다.");
      const { data, error } = await db.rpc("record_gold_regression_run", {
        p_gold_resolution_ids: goldForPack.map((item) => item.id),
        p_observations: observations,
        p_evaluator_version: evaluatorVersion,
        p_prompt_snapshot_hash: promptHash,
      });
      if (error) throw error;
      setMessage(`기준답안 기반 품질 점검 자동화 기록 ${String(data).slice(0, 8)}을 저장했습니다.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "품질 점검 자동화 기록 저장 실패"); }
    finally { setSaving(false); }
  };

  const release = async () => {
    if (preview || !selectedLineage || !missionResolutionId || !regressionId) return;
    setSaving(true); setMessage(null);
    const { data, error } = await db.rpc("release_mission", {
      p_scenario_id: selectedLineage.scenario_id,
      p_reviewed_lineage_id: selectedLineage.id,
      p_resolution_id: missionResolutionId,
      p_gold_regression_run_id: regressionId,
    });
    setMessage(error ? error.message : `PRAGMA 학습자 화면에서 사용할 확정 문항 ${String(data).slice(0, 8)}을 저장했습니다.`);
    setSaving(false); if (!error) await load();
  };

  return <AdminShell title="4단계 · 정식 학습자료의 학습자 사용 승인" description="기준답안 30개 시스템 게이트, 외부 전문가 18개 내용타당성 확인, 504개 자동 점검 확인·경고 집중 검토를 서로 다른 근거로 확인한 뒤 교수자가 사용을 승인합니다.">
    <div className="space-y-5">
      <ResearchWorkflowGuide current="release" />
      <div className="flex flex-wrap items-center justify-between gap-3"><Button asChild variant="ghost" size="sm"><Link to={pathname.startsWith("/prototype/") ? "/prototype/research-qa" : "/admin/research-qa"}><ArrowLeft className="mr-1 h-4 w-4" />문항 품질관리 전체 현황</Link></Button><Badge className="gap-1 bg-slate-900 text-white"><LockKeyhole className="h-3.5 w-3.5" />필수 조건을 모두 통과해야 공개</Badge></div>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4"><p className="text-xs font-semibold text-slate-500">시스템 판단 게이트</p><p className="mt-2 text-sm leading-6">연구 책임자가 확정한 기준답안 30개로 자동 판정 장치의 작동 조건을 확인합니다.</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs font-semibold text-slate-500">외부 내용타당성 확인</p><p className="mt-2 text-sm leading-6">전문가 2인이 사전 추출한 18개를 독립 확인합니다. 504개의 전문가 검증으로 표현하지 않습니다.</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs font-semibold text-slate-500">정식 문항 504개</p><p className="mt-2 text-sm leading-6">전량 자동 점검 결과를 확인하고 경고 문항을 집중 검토합니다. 전량 정밀검토 주장이 아닙니다.</p></div>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><PlayCircle className="h-5 w-5" />1. 기준답안 30개 기반 시스템 판단 게이트</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">연구 책임자가 확정한 기준답안 모집단 전체로 품질 점검 자동화가 정해진 조건대로 작동하는지 확인합니다. 외부 전문가 18개 내용타당성 확인과는 별도 단계입니다.</p></div><Badge variant="outline">준비된 기준답안 {preview ? 30 : goldForPack.length}/30</Badge></div>
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-950"><strong>해석 경계:</strong> 90%·95%는 기준답안 30개에서 사용하는 내부 운영 통과 조건입니다. 전체 시스템 정확도나 일반화된 품질 측정치로 보고하지 않습니다. 외부 전문가 18개에서는 일치율·카파를 대표 결과로 제시하지 않습니다.</p>
        {goldForPack.length < 30 && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">1단계에서 9개 화행을 포함한 기준답안 30개를 먼저 확정하세요.</p>}
        <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-medium">고급 실행 정보 입력 · 일반적으로 시스템 관리자가 사용</summary>
          <p className="mt-2 text-xs leading-5 text-slate-500">평가 프로그램 버전과 생성 지시의 변조 확인값, 문항별 예측 결과를 기록합니다.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2"><Input value={evaluatorVersion} onChange={(event) => setEvaluatorVersion(event.target.value)} placeholder="평가 프로그램 버전" /><Input value={promptHash} onChange={(event) => setPromptHash(event.target.value)} placeholder="생성 지시 변조 확인값" /></div><Textarea className="mt-3 min-h-40 font-mono text-xs" value={observationsText} onChange={(event) => setObservationsText(event.target.value)} placeholder="문항별 시스템 판정 결과(JSON)" />
        </details>
        <Button className="mt-3" onClick={recordRegression} disabled={preview || saving || goldForPack.length < 30 || !evaluatorVersion.trim() || !promptHash.trim()}><Save className="mr-1 h-4 w-4" />시스템 판단 게이트 기록 저장</Button>
      </section>

      <section className="rounded-xl border bg-white p-5"><h2 className="flex items-center gap-2 font-semibold"><Rocket className="h-5 w-5" />2. 정식 504개는 전체 단위로 교수자가 최종 승인</h2><p className="mt-2 text-sm leading-6 text-slate-600">정식 corpus는 이 화면에서 문항별로 공개하지 않습니다. 504개 자동 결과 확인·경고 집중 검토와 두 독립 게이트가 모두 끝난 뒤 배치 화면에서 전체를 한 번에 승인합니다.</p><Button asChild className="mt-4"><Link to="/admin/batch">정식 504개 최종 승인 화면</Link></Button></section>

      <details className="rounded-xl border bg-white p-5"><summary className="cursor-pointer font-semibold">개별 시험문항 공개 도구 · 정식 504개와 별도</summary><p className="mt-2 text-sm leading-6 text-slate-600">아래 기능은 정식 corpus 밖의 개별 연구용 문항에만 사용합니다.</p><div className="mt-4 grid gap-3"><Select value={lineageId} onValueChange={(value) => { setLineageId(value); setMissionResolutionId(""); setRegressionId(""); }}><SelectTrigger><SelectValue placeholder={loading ? "문항을 불러오는 중…" : "개별 시험문항 선택"} /></SelectTrigger><SelectContent>{lineages.map((item) => <SelectItem key={item.id} value={item.id}>문항 {item.scenario_id.slice(0, 8)} · 버전 {item.version_no}</SelectItem>)}</SelectContent></Select><Select value={missionResolutionId} onValueChange={setMissionResolutionId}><SelectTrigger><SelectValue placeholder="이 문항의 외부 확인 결과" /></SelectTrigger><SelectContent>{compatibleMissionResolutions.map((item) => <SelectItem key={item.id} value={item.id}>{item.review_round}차 확인 · 결론 버전 {item.resolution_revision}</SelectItem>)}</SelectContent></Select><Select value={regressionId} onValueChange={setRegressionId}><SelectTrigger><SelectValue placeholder="시스템 판단 게이트 통과 기록" /></SelectTrigger><SelectContent>{compatibleRegressions.map((item) => <SelectItem key={item.id} value={item.id}>{item.evaluator_version} · 운영 게이트 통과</SelectItem>)}</SelectContent></Select></div><Button className="mt-4" onClick={release} disabled={preview || saving || !selectedLineage || !missionResolutionId || !regressionId}><Rocket className="mr-1 h-4 w-4" />개별 시험문항 사용 승인</Button></details>
      {message && <p className="rounded-lg border bg-white p-3 text-sm">{message}</p>}{preview && <p className="text-xs text-slate-500">미리보기 화면에서는 내용을 저장하거나 공개할 수 없습니다.</p>}
    </div>
  </AdminShell>;
};

export default AdminMissionRelease;
