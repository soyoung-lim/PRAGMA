import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, DatabaseZap, GitBranch, LockKeyhole, PackageCheck, RefreshCw } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { PACK_RELEASE_MANIFEST_DRAFT } from "@/lib/pragma/packReleaseManifest.generated";
import { packManifestReleaseScopeMatches } from "@/lib/pragma/packReleaseManifest";

type CandidateRow = {
  id: string;
  candidate_key: string;
  signal_type: "learner_dissent_cluster" | "expert_disagreement" | "gold_regression_drift";
  target_feature: string | null;
  content_hash: string | null;
  realization_pack_id: string | null;
  realization_pack_version: string | null;
  source_refs: string[];
  metrics: Record<string, unknown>;
  suggested_action: string;
  proposed_change: Record<string, unknown> | null;
  evidence_fingerprint: string;
  source_window_start: string | null;
  source_window_end: string | null;
  created_at: string;
};
type SourceRow = { id: string; candidate_id: string; source_type: string; source_id: string; source_field: string; source_snapshot: Record<string, unknown>; added_at: string };
type DecisionRow = { id: string; candidate_id: string; decision: "triage" | "approve" | "reject" | "applied"; note_ko: string; resulting_pack_id: string | null; resulting_pack_version: string | null; resulting_gold_case_ids: string[]; resulting_pack_release_id: string | null; gold_regression_run_id: string | null; decided_at: string };
type PackReleaseRow = { id: string; pack_id: string; pack_version: string; artifact_hash: string; prompt_snapshot_hash: string; evidence_snapshot_hash: string; source_commit_ref: string; release_note_ko: string; source_candidate_id: string | null; manifest_attestation_id: string | null; created_at: string };
type ManifestAttestationRow = { id: string; canonicalization_version: string; pack_id: string; pack_version: string; scope_speech_acts: string[]; artifact_hash: string; prompt_snapshot_hash: string; evidence_snapshot_hash: string; source_commit_ref: string; build_run_ref: string; attested_at: string };
type RegressionRow = { id: string; realization_pack_id: string; realization_pack_version: string; gate_status: string; evaluator_version: string; report: Record<string, unknown>; created_at: string };

const PREVIEW_CANDIDATE: CandidateRow = {
  id: "51000000-0000-4000-8000-000000000001",
  candidate_key: "expert:preview-fingerprint",
  signal_type: "expert_disagreement",
  target_feature: "request_mitigation_optionality",
  content_hash: "24adf002ee1d-preview",
  realization_pack_id: "pragma_ko_zh_request_refusal_thanks_v1",
  realization_pack_version: "1.2.0",
  source_refs: ["expert-review:5200…001", "expert-review:5200…002", "claim:ILC-003"],
  metrics: { reviewer_count: 2, review_round: 1, candidate_disagreement_keys: ["ILC-003"], lineage_claim_disagreement_keys: ["ILC-003"] },
  suggested_action: "resolve_expert_boundary_case",
  proposed_change: null,
  evidence_fingerprint: "a".repeat(64),
  source_window_start: "2026-08-14T23:00:00.000Z",
  source_window_end: "2026-08-14T23:10:00.000Z",
  created_at: "2026-08-15T00:00:00.000Z",
};
const PREVIEW_SOURCES: SourceRow[] = [
  { id: "s1", candidate_id: PREVIEW_CANDIDATE.id, source_type: "mission_expert_review", source_id: "52000000-0000-4000-8000-000000000001", source_field: "round:1", source_snapshot: { overall_verdict: "approve" }, added_at: PREVIEW_CANDIDATE.created_at },
  { id: "s2", candidate_id: PREVIEW_CANDIDATE.id, source_type: "mission_claim_disagreement", source_id: "53000000-0000-4000-8000-000000000001", source_field: "round:1:claim:ILC-003", source_snapshot: { review_count: 2 }, added_at: PREVIEW_CANDIDATE.created_at },
];
const PREVIEW_DECISION: DecisionRow = { id: "d1", candidate_id: PREVIEW_CANDIDATE.id, decision: "triage", note_ko: "중국어 완화 실현 경계 사례로 검토", resulting_pack_id: null, resulting_pack_version: null, resulting_gold_case_ids: [], resulting_pack_release_id: null, gold_regression_run_id: null, decided_at: "2026-08-15T00:10:00.000Z" };
const PREVIEW_ATTESTATION: ManifestAttestationRow = {
  id: "54000000-0000-4000-8000-000000000001",
  canonicalization_version: PACK_RELEASE_MANIFEST_DRAFT.canonicalization_version,
  pack_id: PACK_RELEASE_MANIFEST_DRAFT.pack_id,
  pack_version: PACK_RELEASE_MANIFEST_DRAFT.pack_version,
  scope_speech_acts: PACK_RELEASE_MANIFEST_DRAFT.scope_speech_acts,
  artifact_hash: PACK_RELEASE_MANIFEST_DRAFT.artifact_hash,
  prompt_snapshot_hash: PACK_RELEASE_MANIFEST_DRAFT.prompt_snapshot_hash,
  evidence_snapshot_hash: PACK_RELEASE_MANIFEST_DRAFT.evidence_snapshot_hash,
  source_commit_ref: PACK_RELEASE_MANIFEST_DRAFT.source_commit_ref,
  build_run_ref: "preview-ci-run",
  attested_at: "2026-08-15T00:15:00.000Z",
};

const LABELS: Record<CandidateRow["signal_type"], string> = {
  learner_dissent_cluster: "학습자 이견 cluster",
  expert_disagreement: "전문가 경계 이견",
  gold_regression_drift: "Gold 회귀 drift",
};

const short = (value: string | null | undefined, size = 10) => value ? `${value.slice(0, size)}${value.length > size ? "…" : ""}` : "—";
const latestDecision = (candidateId: string, decisions: DecisionRow[]) => decisions
  .filter((item) => item.candidate_id === candidateId)
  .sort((a, b) => b.decided_at.localeCompare(a.decided_at))[0] ?? null;

const AdminImprovementFlywheel = ({ preview = false }: { preview?: boolean }) => {
  const { pathname } = useLocation();
  const [candidates, setCandidates] = useState<CandidateRow[]>(preview ? [PREVIEW_CANDIDATE] : []);
  const [sources, setSources] = useState<SourceRow[]>(preview ? PREVIEW_SOURCES : []);
  const [decisions, setDecisions] = useState<DecisionRow[]>(preview ? [PREVIEW_DECISION] : []);
  const [releases, setReleases] = useState<PackReleaseRow[]>([]);
  const [attestations, setAttestations] = useState<ManifestAttestationRow[]>(preview ? [PREVIEW_ATTESTATION] : []);
  const [regressions, setRegressions] = useState<RegressionRow[]>([]);
  const [candidateId, setCandidateId] = useState(preview ? PREVIEW_CANDIDATE.id : "");
  const [decisionNote, setDecisionNote] = useState("");
  const [releaseNote, setReleaseNote] = useState("");
  const [packReleaseId, setPackReleaseId] = useState("");
  const [regressionId, setRegressionId] = useState("");
  const [goldCaseIds, setGoldCaseIds] = useState("");
  const [applyNote, setApplyNote] = useState("");
  const [loading, setLoading] = useState(!preview);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (preview) { setLoading(false); return; }
    setLoading(true);
    const [candidateResult, sourceResult, decisionResult, releaseResult, attestationResult, regressionResult] = await Promise.all([
      supabase.from("pragma_improvement_candidates").select("id,candidate_key,signal_type,target_feature,content_hash,realization_pack_id,realization_pack_version,source_refs,metrics,suggested_action,proposed_change,evidence_fingerprint,source_window_start,source_window_end,created_at").order("created_at", { ascending: false }),
      supabase.from("pragma_improvement_candidate_sources").select("id,candidate_id,source_type,source_id,source_field,source_snapshot,added_at").order("added_at", { ascending: false }),
      supabase.from("pragma_improvement_decisions").select("id,candidate_id,decision,note_ko,resulting_pack_id,resulting_pack_version,resulting_gold_case_ids,resulting_pack_release_id,gold_regression_run_id,decided_at").order("decided_at", { ascending: false }),
      supabase.from("pragma_realization_pack_releases").select("id,pack_id,pack_version,artifact_hash,prompt_snapshot_hash,evidence_snapshot_hash,source_commit_ref,release_note_ko,source_candidate_id,manifest_attestation_id,created_at").order("created_at", { ascending: false }),
      supabase.from("pragma_pack_manifest_attestations").select("id,canonicalization_version,pack_id,pack_version,scope_speech_acts,artifact_hash,prompt_snapshot_hash,evidence_snapshot_hash,source_commit_ref,build_run_ref,attested_at").order("attested_at", { ascending: false }),
      supabase.from("pragma_gold_regression_runs").select("id,realization_pack_id,realization_pack_version,gate_status,evaluator_version,report,created_at").eq("gate_status", "pass").order("created_at", { ascending: false }),
    ]);
    const error = candidateResult.error ?? sourceResult.error ?? decisionResult.error ?? releaseResult.error ?? attestationResult.error ?? regressionResult.error;
    if (error) setMessage(error.message);
    else {
      const loaded = (candidateResult.data ?? []) as CandidateRow[];
      setCandidates(loaded);
      setSources((sourceResult.data ?? []) as SourceRow[]);
      setDecisions((decisionResult.data ?? []) as DecisionRow[]);
      setReleases((releaseResult.data ?? []) as PackReleaseRow[]);
      setAttestations((attestationResult.data ?? []) as ManifestAttestationRow[]);
      setRegressions((regressionResult.data ?? []) as RegressionRow[]);
      setCandidateId((current) => loaded.some((item) => item.id === current) ? current : loaded[0]?.id ?? "");
    }
    setLoading(false);
  }, [preview]);
  useEffect(() => { void load(); }, [load]);

  const selected = candidates.find((item) => item.id === candidateId) ?? null;
  const selectedSources = sources.filter((item) => item.candidate_id === candidateId);
  const selectedDecisions = decisions.filter((item) => item.candidate_id === candidateId);
  const currentDecision = latestDecision(candidateId, decisions);
  const candidateReleases = releases.filter((item) => item.source_candidate_id === candidateId);
  const selectedRelease = releases.find((item) => item.id === packReleaseId) ?? null;
  const compatibleRegressions = regressions.filter((item) => selectedRelease && item.realization_pack_id === selectedRelease.pack_id && item.realization_pack_version === selectedRelease.pack_version);
  const latestPackRelease = useMemo(
    () => releases.find((item) => item.pack_id === PACK_RELEASE_MANIFEST_DRAFT.pack_id) ?? null,
    [releases],
  );
  const exactManifestAttestation = attestations.find((item) =>
    item.canonicalization_version === PACK_RELEASE_MANIFEST_DRAFT.canonicalization_version
    && item.pack_id === PACK_RELEASE_MANIFEST_DRAFT.pack_id
    && item.pack_version === PACK_RELEASE_MANIFEST_DRAFT.pack_version
    && JSON.stringify(item.scope_speech_acts) === JSON.stringify(PACK_RELEASE_MANIFEST_DRAFT.scope_speech_acts)
    && item.artifact_hash === PACK_RELEASE_MANIFEST_DRAFT.artifact_hash
    && item.prompt_snapshot_hash === PACK_RELEASE_MANIFEST_DRAFT.prompt_snapshot_hash
    && item.evidence_snapshot_hash === PACK_RELEASE_MANIFEST_DRAFT.evidence_snapshot_hash
    && item.source_commit_ref === PACK_RELEASE_MANIFEST_DRAFT.source_commit_ref
  ) ?? null;
  const counts = useMemo(() => ({
    open: candidates.filter((item) => !["reject", "applied"].includes(latestDecision(item.id, decisions)?.decision ?? "")).length,
    applied: decisions.filter((item) => item.decision === "applied").length,
  }), [candidates, decisions]);

  const materialize = async () => {
    if (preview) return;
    setSaving(true); setMessage(null);
    const { data, error } = await supabase.rpc("materialize_pragma_improvement_candidates", {
      p_window_start: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      p_window_end: new Date().toISOString(),
      p_min_distinct_attempts: 3,
      p_min_distinct_participants: 3,
    });
    setMessage(error ? error.message : `집계 run ${short(String(data), 8)}을 저장했습니다. 규칙은 자동 변경되지 않았습니다.`);
    setSaving(false); if (!error) await load();
  };

  const decide = async (decision: "triage" | "approve" | "reject") => {
    if (preview || !selected || !decisionNote.trim()) return;
    setSaving(true); setMessage(null);
    const { error } = await supabase.rpc("record_pragma_improvement_decision", { p_candidate_id: selected.id, p_decision: decision, p_note_ko: decisionNote.trim() });
    setMessage(error ? error.message : `${decision} 판정을 append했습니다.`);
    setSaving(false); if (!error) { setDecisionNote(""); await load(); }
  };

  const recordRelease = async () => {
    const isBaseline = !latestPackRelease;
    if (preview || !exactManifestAttestation || (!isBaseline && !selected)) return;
    setSaving(true); setMessage(null);
    const { data, error } = await supabase.rpc("record_pragma_realization_pack_release", {
      p_pack_id: PACK_RELEASE_MANIFEST_DRAFT.pack_id,
      p_pack_version: PACK_RELEASE_MANIFEST_DRAFT.pack_version,
      p_artifact_hash: PACK_RELEASE_MANIFEST_DRAFT.artifact_hash,
      p_prompt_snapshot_hash: PACK_RELEASE_MANIFEST_DRAFT.prompt_snapshot_hash,
      p_evidence_snapshot_hash: PACK_RELEASE_MANIFEST_DRAFT.evidence_snapshot_hash,
      p_source_commit_ref: PACK_RELEASE_MANIFEST_DRAFT.source_commit_ref,
      p_release_note_ko: releaseNote.trim(),
      p_manifest_attestation_id: exactManifestAttestation.id,
      p_source_candidate_id: isBaseline ? null : selected!.id,
    });
    setMessage(error ? error.message : `${isBaseline ? "baseline" : "candidate-linked"} pack manifest ${short(String(data), 8)}를 append했습니다.`);
    setSaving(false); if (!error) { setPackReleaseId(String(data)); await load(); }
  };

  const apply = async () => {
    const ids = [...new Set(goldCaseIds.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))];
    if (preview || !selected || !packReleaseId || !regressionId || !applyNote.trim() || ids.length === 0) return;
    setSaving(true); setMessage(null);
    const { error } = await supabase.rpc("apply_pragma_improvement_candidate", {
      p_candidate_id: selected.id,
      p_note_ko: applyNote.trim(),
      p_pack_release_id: packReleaseId,
      p_resulting_gold_case_ids: ids,
      p_gold_regression_run_id: regressionId,
    });
    setMessage(error ? error.message : "새 pack manifest·외부 승인 Gold·passing regression을 묶어 applied를 append했습니다.");
    setSaving(false); if (!error) await load();
  };

  const canDecide = currentDecision?.decision !== "approve" && currentDecision?.decision !== "reject" && currentDecision?.decision !== "applied";
  const isBaselineRelease = !latestPackRelease;
  const draftMatchesReleaseScope = packManifestReleaseScopeMatches(
    PACK_RELEASE_MANIFEST_DRAFT,
    latestPackRelease,
    selected,
  );
  const manifestReady = draftMatchesReleaseScope && !PACK_RELEASE_MANIFEST_DRAFT.git_dirty && !!exactManifestAttestation;

  return <AdminShell title="Data Improvement Flywheel" description="학습자 이견·전문가 경계 이견·Gold drift를 서버가 근거 후보로 묶고, 연구자가 새 pack·Gold 영향·회귀를 확인한 뒤에만 반영합니다.">
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm"><Link to={pathname.startsWith("/prototype/") ? "/prototype/research-qa" : "/admin/research-qa"}><ArrowLeft className="mr-1 h-4 w-4" />QA Console</Link></Button>
        <Badge className="gap-1 bg-slate-900 text-white"><LockKeyhole className="h-3.5 w-3.5" />human decision only · no auto-apply</Badge>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">불변 후보</p><p className="mt-1 text-2xl font-semibold">{candidates.length}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">검토 중</p><p className="mt-1 text-2xl font-semibold">{counts.open}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">폐쇄 loop</p><p className="mt-1 text-2xl font-semibold">{counts.applied}</p></div>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><DatabaseZap className="h-5 w-5" />서버 신호 집계</h2><p className="mt-1 text-sm text-slate-600">최근 180일, 서로 다른 학습자 3명·attempt 3개, 현재 동의, exact released lineage를 요구합니다. 사용한 source UUID는 다시 소비하지 않습니다.</p></div><Button onClick={materialize} disabled={preview || saving}><RefreshCw className="mr-1 h-4 w-4" />신규 근거만 집계</Button></div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Candidate queue</h2>
          <div className="mt-3 space-y-2">
            {candidates.map((item) => {
              const state = latestDecision(item.id, decisions)?.decision ?? "open";
              return <button key={item.id} type="button" onClick={() => { setCandidateId(item.id); setPackReleaseId(""); setRegressionId(""); }} className={`w-full rounded-lg border p-3 text-left ${candidateId === item.id ? "border-amber-400 bg-amber-50" : "hover:bg-slate-50"}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{LABELS[item.signal_type]}</span><Badge variant={state === "applied" ? "default" : state === "reject" ? "destructive" : "secondary"}>{state}</Badge></div><p className="mt-1 truncate font-mono text-xs text-slate-500">{item.target_feature ?? item.candidate_key}</p><p className="mt-1 text-xs text-slate-500">pack {item.realization_pack_version ?? "—"} · {item.source_refs.length} refs</p></button>;
            })}
            {!loading && candidates.length === 0 && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">집계된 후보가 없습니다.</p>}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-xl border bg-white p-5">
            <h2 className="flex items-center gap-2 font-semibold"><GitBranch className="h-5 w-5" />Evidence snapshot</h2>
            {selected ? <><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-slate-500">scope</p><p className="mt-1 text-sm">{selected.realization_pack_id}@{selected.realization_pack_version}</p></div><div><p className="text-xs text-slate-500">fingerprint</p><p className="mt-1 font-mono text-xs">{short(selected.evidence_fingerprint, 18)}</p></div><div><p className="text-xs text-slate-500">feature / content</p><p className="mt-1 font-mono text-xs">{selected.target_feature ?? "—"} · {short(selected.content_hash, 14)}</p></div><div><p className="text-xs text-slate-500">source window</p><p className="mt-1 text-xs">{selected.source_window_start?.slice(0, 16) ?? "—"} → {selected.source_window_end?.slice(0, 16) ?? "—"}</p></div></div><pre className="mt-4 max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(selected.metrics, null, 2)}</pre><div className="mt-3 flex flex-wrap gap-2">{selectedSources.map((source) => <Badge key={source.id} variant="outline">{source.source_type} · {source.source_field || short(source.source_id, 8)}</Badge>)}</div></> : <p className="mt-3 text-sm text-slate-500">후보를 선택하세요.</p>}
          </section>

          <section className="rounded-xl border bg-white p-5">
            <h2 className="font-semibold">연구자 판정</h2><p className="mt-1 text-sm text-slate-600">상태는 open/triage → approve 또는 reject로만 진행합니다. approve 뒤에는 새 manifest와 검증 근거 없이는 applied가 될 수 없습니다.</p>
            <Textarea className="mt-3" value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder="판정 근거를 한국어로 기록" />
            <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => decide("triage")} disabled={preview || saving || !selected || !decisionNote.trim() || !canDecide}>triage</Button><Button onClick={() => decide("approve")} disabled={preview || saving || !selected || !decisionNote.trim() || !canDecide}>approve</Button><Button variant="destructive" onClick={() => decide("reject")} disabled={preview || saving || !selected || !decisionNote.trim() || !canDecide}>reject</Button></div>
            <div className="mt-4 space-y-2">{selectedDecisions.map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><div className="flex justify-between gap-2"><Badge variant="secondary">{item.decision}</Badge><span className="text-xs text-slate-500">{item.decided_at.slice(0, 16)}</span></div><p className="mt-2">{item.note_ko}</p></div>)}</div>
          </section>

          <section className="rounded-xl border bg-white p-5">
            <h2 className="flex items-center gap-2 font-semibold"><PackageCheck className="h-5 w-5" />Realization Pack release manifest</h2><p className="mt-1 text-sm text-slate-600">첫 행은 현재 pack의 baseline manifest입니다. 그다음부터는 approve 후보와 strictly greater semver가 강제됩니다.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2"><Input value={PACK_RELEASE_MANIFEST_DRAFT.pack_id} readOnly aria-label="자동 계산 pack id" /><Input value={PACK_RELEASE_MANIFEST_DRAFT.pack_version} readOnly aria-label="자동 계산 pack semver" /><Input value={PACK_RELEASE_MANIFEST_DRAFT.artifact_hash} readOnly aria-label="자동 계산 pack artifact SHA-256" /><Input value={PACK_RELEASE_MANIFEST_DRAFT.prompt_snapshot_hash} readOnly aria-label="자동 계산 pack prompt surface SHA-256" /><Input value={PACK_RELEASE_MANIFEST_DRAFT.evidence_snapshot_hash} readOnly aria-label="자동 계산 evidence snapshot SHA-256" /><Input value={PACK_RELEASE_MANIFEST_DRAFT.source_commit_ref} readOnly aria-label="자동 계산 full git commit" /></div><Textarea className="mt-3" value={releaseNote} onChange={(event) => setReleaseNote(event.target.value)} placeholder="무엇이 왜 바뀌었는지" /><div className="mt-3 flex flex-wrap items-center gap-2"><Button onClick={recordRelease} disabled={preview || saving || !manifestReady || !releaseNote.trim() || (!isBaselineRelease && (!selected || currentDecision?.decision !== "approve"))}><PackageCheck className="mr-1 h-4 w-4" />{latestPackRelease ? "candidate-linked manifest append" : "baseline manifest append"}</Button><Badge variant={manifestReady ? "secondary" : "destructive"}>{PACK_RELEASE_MANIFEST_DRAFT.git_dirty ? "source dirty · commit 후 재생성 필요" : !draftMatchesReleaseScope ? "현재 pack의 approve candidate 선택 필요" : !exactManifestAttestation ? "CI/service attestation 대기" : `attested · ${short(exactManifestAttestation.build_run_ref, 18)}`}</Badge></div>
          </section>

          <section className="rounded-xl border bg-white p-5">
            <h2 className="font-semibold">Gold impact + passing regression으로 폐쇄</h2><p className="mt-1 text-sm text-slate-600">이 후보로 만든 새 pack manifest, 그 pack에서 외부 승인된 영향 Gold case, 같은 pack의 passing 30+ regression이 모두 있어야 합니다.</p>
            <div className="mt-3 grid gap-3"><Select value={packReleaseId} onValueChange={(value) => { setPackReleaseId(value); setRegressionId(""); }}><SelectTrigger><SelectValue placeholder="이 후보의 새 pack manifest" /></SelectTrigger><SelectContent>{candidateReleases.map((item) => <SelectItem key={item.id} value={item.id}>{item.pack_id}@{item.pack_version} · {short(item.source_commit_ref, 12)}</SelectItem>)}</SelectContent></Select><Select value={regressionId} onValueChange={setRegressionId}><SelectTrigger><SelectValue placeholder="같은 pack의 passing Gold regression" /></SelectTrigger><SelectContent>{compatibleRegressions.map((item) => <SelectItem key={item.id} value={item.id}>{item.evaluator_version} · band {String(item.report.band_accuracy ?? "—")} / semantic {String(item.report.semantic_accuracy ?? "—")}</SelectItem>)}</SelectContent></Select><Textarea value={goldCaseIds} onChange={(event) => setGoldCaseIds(event.target.value)} placeholder="실제 영향 Gold case ID (쉼표 또는 줄바꿈)" /><Textarea value={applyNote} onChange={(event) => setApplyNote(event.target.value)} placeholder="반영 결과와 검증 요약" /></div><Button className="mt-3" onClick={apply} disabled={preview || saving || currentDecision?.decision !== "approve" || !packReleaseId || !regressionId || !goldCaseIds.trim() || !applyNote.trim()}>applied evidence bundle append</Button>
          </section>
        </div>
      </div>

      {message && <p className="rounded-lg border bg-white p-3 text-sm">{message}</p>}
      {preview && <p className="text-xs text-slate-500">preview는 실데이터 대신 계약 예시를 보여주며 모든 쓰기를 잠급니다.</p>}
    </div>
  </AdminShell>;
};

export default AdminImprovementFlywheel;
