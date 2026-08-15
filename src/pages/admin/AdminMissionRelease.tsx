import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, LockKeyhole, PlayCircle, Rocket, Save } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type LineageRow = { id: string; scenario_id: string; version_no: number; stage: string; realization_pack_id: string; realization_pack_version: string; mission_content_hash: string; created_at: string };
type MissionResolutionRow = { id: string; lineage_version_id: string; review_round: number; resolution_revision: number; resolution_status: string; final_verdict: string; resolved_at: string };
type GoldResolutionRow = { id: string; calibration_resolution_id: string; review_round: number; resolution_revision: number; resolution_method: string; final_status: string; resolved_case_snapshot: { case_id?: string; realization_pack_id?: string; realization_pack_version?: string }; resolved_at: string };
type RegressionRow = { id: string; realization_pack_id: string; realization_pack_version: string; gate_status: string; evaluator_version: string; report: Record<string, unknown>; created_at: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any; rpc: (name: string, args?: Record<string, unknown>) => any };

const PREVIEW_LINEAGE: LineageRow = { id: "10000000-0000-4000-8000-000000000051", scenario_id: "20000000-0000-4000-8000-000000000051", version_no: 3, stage: "reviewed", realization_pack_id: "pragma_ko_zh_core", realization_pack_version: "1.2.0", mission_content_hash: "preview-hash", created_at: "2026-08-15T00:00:00.000Z" };
const PREVIEW_RESOLUTION: MissionResolutionRow = { id: "30000000-0000-4000-8000-000000000051", lineage_version_id: PREVIEW_LINEAGE.id, review_round: 1, resolution_revision: 1, resolution_status: "unanimous", final_verdict: "approve", resolved_at: "2026-08-15T00:10:00.000Z" };
const PREVIEW_REGRESSION: RegressionRow = { id: "40000000-0000-4000-8000-000000000051", realization_pack_id: "pragma_ko_zh_core", realization_pack_version: "1.2.0", gate_status: "pass", evaluator_version: "preview-evaluator-v1", report: { mode: "expert_release_gate", case_count: 30, band_accuracy: 0.93, semantic_accuracy: 0.97, gate_status: "pass" }, created_at: "2026-08-15T00:20:00.000Z" };

const AdminMissionRelease = ({ preview = false }: { preview?: boolean }) => {
  const { pathname } = useLocation();
  const [lineages, setLineages] = useState<LineageRow[]>(preview ? [PREVIEW_LINEAGE] : []);
  const [missionResolutions, setMissionResolutions] = useState<MissionResolutionRow[]>(preview ? [PREVIEW_RESOLUTION] : []);
  const [goldResolutions, setGoldResolutions] = useState<GoldResolutionRow[]>([]);
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
      db.from("pragma_gold_expert_resolutions").select("id,calibration_resolution_id,review_round,resolution_revision,resolution_method,final_status,resolved_case_snapshot,resolved_at").eq("final_status", "expert_approved").in("resolution_method", ["unanimous", "consensus_after_discussion"]).order("resolved_at", { ascending: false }),
      db.from("pragma_gold_regression_runs").select("id,realization_pack_id,realization_pack_version,gate_status,evaluator_version,report,created_at").order("created_at", { ascending: false }),
    ]);
    const error = lineageResult.error ?? resolutionResult.error ?? goldResult.error ?? regressionResult.error;
    if (error) setMessage(error.message);
    else {
      const loadedLineages = (lineageResult.data ?? []) as LineageRow[];
      setLineages(loadedLineages); setMissionResolutions((resolutionResult.data ?? []) as MissionResolutionRow[]); setGoldResolutions((goldResult.data ?? []) as GoldResolutionRow[]); setRegressions((regressionResult.data ?? []) as RegressionRow[]);
      setLineageId((current) => current || loadedLineages[0]?.id || "");
    }
    setLoading(false);
  }, [preview]);
  useEffect(() => { void load(); }, [load]);

  const selectedLineage = lineages.find((item) => item.id === lineageId) ?? null;
  const compatibleMissionResolutions = useMemo(() => missionResolutions.filter((item) => item.lineage_version_id === lineageId), [missionResolutions, lineageId]);
  const compatibleRegressions = useMemo(() => regressions.filter((item) => item.gate_status === "pass" && selectedLineage && item.realization_pack_id === selectedLineage.realization_pack_id && item.realization_pack_version === selectedLineage.realization_pack_version), [regressions, selectedLineage]);
  const authoritativeGold = useMemo(() => {
    const latest = new Map<string, GoldResolutionRow>();
    for (const item of goldResolutions) {
      const current = latest.get(item.calibration_resolution_id);
      if (!current || item.review_round > current.review_round || (item.review_round === current.review_round && item.resolution_revision > current.resolution_revision)) latest.set(item.calibration_resolution_id, item);
    }
    return [...latest.values()];
  }, [goldResolutions]);
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
      setMessage(`Gold regression run ${String(data).slice(0, 8)}을 서버 계산으로 저장했습니다.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "회귀 저장 실패"); }
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
    setMessage(error ? error.message : `released lineage ${String(data).slice(0, 8)}을 append했습니다.`);
    setSaving(false); if (!error) await load();
  };

  return <AdminShell title="Authoritative Release" description="covered 미션은 내부 reviewed 상태로는 학습자에게 공개되지 않으며, 전문가 resolution과 expert-approved Gold 회귀를 모두 통과해야 합니다.">
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><Button asChild variant="ghost" size="sm"><Link to={pathname.startsWith("/prototype/") ? "/prototype/research-qa" : "/admin/research-qa"}><ArrowLeft className="mr-1 h-4 w-4" />QA Console</Link></Button><Badge className="gap-1 bg-slate-900 text-white"><LockKeyhole className="h-3.5 w-3.5" />server-enforced</Badge></div>

      <section className="rounded-xl border bg-white p-5"><h2 className="flex items-center gap-2 font-semibold"><PlayCircle className="h-5 w-5" />Expert release regression 기록</h2><p className="mt-2 text-sm text-slate-600">현재 pack의 최신 expert-approved Gold {goldForPack.length}건을 서버가 직접 불러와 완전성·중복·대역 90%·의미 95%를 계산합니다. 최소 30건 미만이면 저장이 거부됩니다.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><Input value={evaluatorVersion} onChange={(event) => setEvaluatorVersion(event.target.value)} placeholder="evaluator version" /><Input value={promptHash} onChange={(event) => setPromptHash(event.target.value)} placeholder="exact prompt snapshot hash" /></div><Textarea className="mt-3 min-h-40 font-mono text-xs" value={observationsText} onChange={(event) => setObservationsText(event.target.value)} placeholder='[{"case_id":"...","candidate_id":"A","predicted_band_code":"...","predicted_semantic_fidelity":"pass"}]' /><Button className="mt-3" onClick={recordRegression} disabled={preview || saving || goldForPack.length < 30 || !evaluatorVersion.trim() || !promptHash.trim()}><Save className="mr-1 h-4 w-4" />서버 계산 회귀 저장</Button></section>

      <section className="rounded-xl border bg-white p-5"><h2 className="flex items-center gap-2 font-semibold"><Rocket className="h-5 w-5" />Covered mission release</h2><div className="mt-4 grid gap-3"><Select value={lineageId} onValueChange={(value) => { setLineageId(value); setMissionResolutionId(""); setRegressionId(""); }}><SelectTrigger><SelectValue placeholder={loading ? "불러오는 중…" : "covered reviewed lineage"} /></SelectTrigger><SelectContent>{lineages.map((item) => <SelectItem key={item.id} value={item.id}>{item.scenario_id.slice(0, 8)} · lineage v{item.version_no} · {item.realization_pack_version}</SelectItem>)}</SelectContent></Select><Select value={missionResolutionId} onValueChange={setMissionResolutionId}><SelectTrigger><SelectValue placeholder="최신 approve 전문가 resolution" /></SelectTrigger><SelectContent>{compatibleMissionResolutions.map((item) => <SelectItem key={item.id} value={item.id}>round {item.review_round} · revision {item.resolution_revision} · {item.resolution_status}</SelectItem>)}</SelectContent></Select><Select value={regressionId} onValueChange={setRegressionId}><SelectTrigger><SelectValue placeholder="같은 pack의 passing Gold regression" /></SelectTrigger><SelectContent>{compatibleRegressions.map((item) => <SelectItem key={item.id} value={item.id}>{item.evaluator_version} · {String(item.report.band_accuracy ?? "—")} / {String(item.report.semantic_accuracy ?? "—")}</SelectItem>)}</SelectContent></Select></div><Button className="mt-4" onClick={release} disabled={preview || saving || !selectedLineage || !missionResolutionId || !regressionId}><Rocket className="mr-1 h-4 w-4" />released snapshot append</Button><p className="mt-2 text-xs text-slate-500">release RPC는 uncertain·revised·rejected·unattributed claim, 오래된 resolution, 서명 없는 토론 합의, pack이 다른 회귀를 모두 거부합니다.</p></section>
      {message && <p className="rounded-lg border bg-white p-3 text-sm">{message}</p>}{preview && <p className="text-xs text-slate-500">preview는 저장을 잠그고 gate 구조만 보여줍니다.</p>}
    </div>
  </AdminShell>;
};

export default AdminMissionRelease;
