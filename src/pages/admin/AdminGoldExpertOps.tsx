import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, GitCompareArrows, Plus, Save, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { SEED_GOLD_CASES, SeedGoldCaseSchema, type SeedGoldCase } from "@/lib/pragma/seedGoldSet";

type ProfileRow = { user_id: string; email: string | null; full_name: string | null };
type RegistryRow = { id: string; expert_user_id: string; status: string; registry_version: number };
type CalibrationRow = { id: string; case_id: string; case_version: string; resolution_status: string; resolved_case_snapshot: SeedGoldCase; resolved_at: string };
type AssignmentRow = { id: string; calibration_resolution_id: string; reviewer_user_id: string; review_round: number; assigned_at: string };
type CandidateAssessment = { assessed_band_code: string; semantic_fidelity: "pass" | "fail"; rationale_ko: string };
type ReviewRow = { id: string; calibration_resolution_id: string; reviewer_user_id: string; review_round: number; context_assessment: Record<string, boolean>; candidate_assessments: Record<"A" | "B" | "C", CandidateAssessment>; overall_verdict: string; rationale_ko: string; submitted_at: string };
type ResolutionRow = { id: string; calibration_resolution_id: string; review_round: number; resolution_revision: number; resolution_method: string; final_status: string; resolved_at: string };
type CandidateDraft = { assessed_band_code: string; semantic_fidelity: "" | "pass" | "fail"; rationale_ko: string };
type CandidateId = "A" | "B" | "C";

const BANDS = ["too_direct", "within_band", "too_indirect", "too_blunt", "over_elaborate", "insufficient", "excessive"];
const emptyCandidate = (): CandidateDraft => ({ assessed_band_code: "", semantic_fidelity: "", rationale_ko: "" });
const emptyCandidates = (): Record<CandidateId, CandidateDraft> => ({ A: emptyCandidate(), B: emptyCandidate(), C: emptyCandidate() });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any; rpc: (name: string, args?: Record<string, unknown>) => any };

const PREVIEW_CALIBRATION_ID = "20000000-0000-4000-8000-000000000061";
const PREVIEW_EXPERTS: ProfileRow[] = [
  { user_id: "30000000-0000-4000-8000-000000000061", email: "expert.a@example.com", full_name: "전문가 A" },
  { user_id: "30000000-0000-4000-8000-000000000062", email: "expert.b@example.com", full_name: "전문가 B" },
];
const previewSeed = SEED_GOLD_CASES.find((item) => item.case_id === "GOLD-KOZH-REQ-003") ?? SEED_GOLD_CASES[0];
const PREVIEW_CASE = SeedGoldCaseSchema.parse({
  ...previewSeed,
  candidates: previewSeed.candidates.map((candidate) => ({ ...candidate, semantic_fidelity: "pass" })),
  review: {
    status: "researcher_approved",
    researcher_reviewer_id: "40000000-0000-4000-8000-000000000061",
    expert_reviews: [],
    note_ko: "preview 연구자 승인",
  },
  provenance: { ...previewSeed.provenance, supersedes_case_id: previewSeed.case_id },
});
const PREVIEW_CALIBRATION: CalibrationRow = { id: PREVIEW_CALIBRATION_ID, case_id: PREVIEW_CASE.case_id, case_version: PREVIEW_CASE.version, resolution_status: "researcher_approved", resolved_case_snapshot: PREVIEW_CASE, resolved_at: "2026-08-15T00:00:00.000Z" };
const PREVIEW_ASSIGNMENTS: AssignmentRow[] = PREVIEW_EXPERTS.map((expert, index) => ({ id: `50000000-0000-4000-8000-00000000006${index + 1}`, calibration_resolution_id: PREVIEW_CALIBRATION_ID, reviewer_user_id: expert.user_id, review_round: 1, assigned_at: "2026-08-15T00:01:00.000Z" }));
const baseCandidateAssessments: Record<CandidateId, CandidateAssessment> = {
  A: { assessed_band_code: "too_direct", semantic_fidelity: "pass", rationale_ko: "상위자 대상 명령성이 큼" },
  B: { assessed_band_code: "within_band", semantic_fidelity: "pass", rationale_ko: "선택권과 부담 예고가 적정" },
  C: { assessed_band_code: "too_indirect", semantic_fidelity: "pass", rationale_ko: "완화가 과잉 중첩됨" },
};
const PREVIEW_REVIEWS: ReviewRow[] = [
  { id: "60000000-0000-4000-8000-000000000061", calibration_resolution_id: PREVIEW_CALIBRATION_ID, reviewer_user_id: PREVIEW_EXPERTS[0].user_id, review_round: 1, context_assessment: { scenario_valid: true, pdr_valid: true, semantic_invariant_valid: true }, candidate_assessments: baseCandidateAssessments, overall_verdict: "approve", rationale_ko: "전문가 A 승인", submitted_at: "2026-08-15T00:10:00.000Z" },
  { id: "60000000-0000-4000-8000-000000000062", calibration_resolution_id: PREVIEW_CALIBRATION_ID, reviewer_user_id: PREVIEW_EXPERTS[1].user_id, review_round: 1, context_assessment: { scenario_valid: true, pdr_valid: true, semantic_invariant_valid: true }, candidate_assessments: { ...baseCandidateAssessments, C: { ...baseCandidateAssessments.C, assessed_band_code: "within_band", rationale_ko: "격식 이메일에서는 허용 가능" } }, overall_verdict: "revise", rationale_ko: "후보 C 대역 이견", submitted_at: "2026-08-15T00:12:00.000Z" },
];

const AdminGoldExpertOps = ({ preview = false }: { preview?: boolean }) => {
  const { pathname } = useLocation();
  const [profiles, setProfiles] = useState<ProfileRow[]>(preview ? PREVIEW_EXPERTS : []);
  const [registry, setRegistry] = useState<RegistryRow[]>(preview ? PREVIEW_EXPERTS.map((expert, index) => ({ id: `70000000-0000-4000-8000-00000000006${index + 1}`, expert_user_id: expert.user_id, status: "active", registry_version: 1 })) : []);
  const [calibrations, setCalibrations] = useState<CalibrationRow[]>(preview ? [PREVIEW_CALIBRATION] : []);
  const [assignments, setAssignments] = useState<AssignmentRow[]>(preview ? PREVIEW_ASSIGNMENTS : []);
  const [reviews, setReviews] = useState<ReviewRow[]>(preview ? PREVIEW_REVIEWS : []);
  const [resolutions, setResolutions] = useState<ResolutionRow[]>([]);
  const [selectedCalibrationId, setSelectedCalibrationId] = useState(preview ? PREVIEW_CALIBRATION_ID : "");
  const [selectedExpertId, setSelectedExpertId] = useState("");
  const [round, setRound] = useState("1");
  const [method, setMethod] = useState<"" | "unanimous" | "consensus_after_discussion" | "researcher_decision" | "unresolved">("");
  const [finalStatus, setFinalStatus] = useState<"" | "expert_approved" | "revise_required" | "rejected" | "unresolved">("");
  const [context, setContext] = useState({ scenario_valid: false, pdr_valid: false, semantic_invariant_valid: false });
  const [candidates, setCandidates] = useState(emptyCandidates);
  const [rationale, setRationale] = useState("");
  const [loading, setLoading] = useState(!preview);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (preview) { setLoading(false); return; }
    setLoading(true);
    const [profileResult, registryResult, calibrationResult, assignmentResult, reviewResult, resolutionResult] = await Promise.all([
      db.from("profiles").select("user_id,email,full_name"),
      db.from("pragma_expert_registry_versions").select("id,expert_user_id,status,registry_version").eq("status", "active"),
      db.from("pragma_gold_calibration_resolutions").select("id,case_id,case_version,resolution_status,resolved_case_snapshot,resolved_at").eq("resolution_status", "researcher_approved").order("resolved_at", { ascending: false }),
      db.from("pragma_gold_expert_review_assignments").select("id,calibration_resolution_id,reviewer_user_id,review_round,assigned_at").order("assigned_at", { ascending: false }),
      db.from("pragma_gold_expert_reviews").select("id,calibration_resolution_id,reviewer_user_id,review_round,context_assessment,candidate_assessments,overall_verdict,rationale_ko,submitted_at").order("submitted_at", { ascending: false }),
      db.from("pragma_gold_expert_resolutions").select("id,calibration_resolution_id,review_round,resolution_revision,resolution_method,final_status,resolved_at").order("resolved_at", { ascending: false }),
    ]);
    const error = profileResult.error ?? registryResult.error ?? calibrationResult.error ?? assignmentResult.error ?? reviewResult.error ?? resolutionResult.error;
    if (error) setMessage(error.message);
    else {
      setProfiles((profileResult.data ?? []) as ProfileRow[]);
      setRegistry((registryResult.data ?? []) as RegistryRow[]);
      const parsed = (calibrationResult.data ?? []).map((row: Record<string, unknown>) => ({ ...row, resolved_case_snapshot: SeedGoldCaseSchema.parse(row.resolved_case_snapshot) })) as CalibrationRow[];
      setCalibrations(parsed); setAssignments((assignmentResult.data ?? []) as AssignmentRow[]); setReviews((reviewResult.data ?? []) as ReviewRow[]); setResolutions((resolutionResult.data ?? []) as ResolutionRow[]);
      setSelectedCalibrationId((current) => current || parsed[0]?.id || "");
    }
    setLoading(false);
  }, [preview]);
  useEffect(() => { void load(); }, [load]);

  const selected = calibrations.find((item) => item.id === selectedCalibrationId) ?? null;
  const roundNumber = Number(round) || 1;
  const selectedAssignments = assignments.filter((item) => item.calibration_resolution_id === selectedCalibrationId && item.review_round === roundNumber);
  const selectedReviews = reviews.filter((item) => item.calibration_resolution_id === selectedCalibrationId && item.review_round === roundNumber);
  const profileLabel = (id: string) => profiles.find((profile) => profile.user_id === id)?.full_name || profiles.find((profile) => profile.user_id === id)?.email || id.slice(0, 8);
  const eligibleExperts = useMemo(() => {
    const active = new Set(registry.filter((item) => item.status === "active").map((item) => item.expert_user_id));
    return profiles.filter((profile) => active.has(profile.user_id));
  }, [profiles, registry]);
  const allSubmitted = selectedAssignments.length >= 2 && selectedAssignments.length === selectedReviews.length;
  const disagreement = selectedReviews.length >= 2 && (
    new Set(selectedReviews.map((review) => JSON.stringify(review.context_assessment))).size > 1
    || new Set(selectedReviews.map((review) => JSON.stringify(review.candidate_assessments))).size > 1
    || new Set(selectedReviews.map((review) => review.overall_verdict)).size > 1
  );

  const assign = async () => {
    if (!selectedCalibrationId || !selectedExpertId || preview) return;
    setSaving(true); const { error } = await db.rpc("assign_gold_expert_review", { p_calibration_resolution_id: selectedCalibrationId, p_reviewer_user_id: selectedExpertId, p_review_round: roundNumber });
    setMessage(error ? error.message : "blind Gold expert assignment를 추가했습니다."); setSaving(false); if (!error) await load();
  };
  const fillFromReview = (review: ReviewRow) => {
    setContext({ ...review.context_assessment } as typeof context);
    setCandidates(review.candidate_assessments as Record<CandidateId, CandidateDraft>);
    setMethod(disagreement ? "consensus_after_discussion" : "unanimous");
    setFinalStatus(review.overall_verdict === "approve" ? "expert_approved" : review.overall_verdict === "reject" ? "rejected" : "revise_required");
    setRationale(disagreement ? "전문가 이견을 claim별로 해결함" : "독립 전문가 판정이 일치함");
  };
  const resolve = async () => {
    if (!selected || !method || !finalStatus || !rationale.trim() || !allSubmitted || preview) return;
    const unresolved = finalStatus === "unresolved";
    if (!unresolved && (!Object.values(context).every((value) => typeof value === "boolean") || !Object.values(candidates).every((item) => item.assessed_band_code && item.semantic_fidelity && item.rationale_ko.trim()))) return;
    setSaving(true);
    const { error } = await db.rpc("propose_gold_expert_resolution", { p_payload: {
      calibration_resolution_id: selected.id, review_round: roundNumber, review_ids: selectedReviews.map((review) => review.id),
      resolution_method: method, final_status: finalStatus,
      resolved_context_assessment: unresolved ? null : context,
      resolved_candidate_assessments: unresolved ? null : candidates,
      rationale_ko: rationale,
    } });
    setMessage(error ? error.message : "Gold expert resolution revision을 저장했습니다."); setSaving(false); if (!error) await load();
  };

  return <AdminShell title="Gold 외부 전문가 운영" description="researcher-approved snapshot을 기대 라벨 없는 blind A/B/C로 2인 검토하고, 이견 해결본을 별도 보존합니다.">
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><Button asChild variant="ghost" size="sm"><Link to={pathname.startsWith("/prototype/") ? "/prototype/research-qa" : "/admin/research-qa"}><ArrowLeft className="mr-1 h-4 w-4" />QA Console</Link></Button><Badge className="gap-1 bg-slate-900 text-white"><ShieldCheck className="h-3.5 w-3.5" />Gold expert v1</Badge></div>
      <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">연구자 승인본 선택</h2><Select value={selectedCalibrationId} onValueChange={setSelectedCalibrationId}><SelectTrigger className="mt-3"><SelectValue placeholder={loading ? "불러오는 중…" : "승인본 없음"} /></SelectTrigger><SelectContent>{calibrations.map((item) => <SelectItem key={item.id} value={item.id}>{item.case_id} · {item.case_version}</SelectItem>)}</SelectContent></Select>{selected && <p className="mt-3 text-sm text-slate-600">{selected.resolved_case_snapshot.scenario_ko}</p>}</section>

      <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">같은 round의 blind 전문가 배정</h2><div className="mt-3 grid gap-3 md:grid-cols-[1fr_120px_auto]"><Select value={selectedExpertId} onValueChange={setSelectedExpertId}><SelectTrigger><SelectValue placeholder="활성 ko→zh 전문가" /></SelectTrigger><SelectContent>{eligibleExperts.map((expert) => <SelectItem key={expert.user_id} value={expert.user_id}>{profileLabel(expert.user_id)}</SelectItem>)}</SelectContent></Select><Select value={round} onValueChange={setRound}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1,2,3].map((value) => <SelectItem key={value} value={String(value)}>round {value}</SelectItem>)}</SelectContent></Select><Button onClick={assign} disabled={preview || saving || !selectedExpertId || !selectedCalibrationId}><Plus className="mr-1 h-4 w-4" />배정</Button></div><div className="mt-4 flex flex-wrap gap-2">{selectedAssignments.map((item) => <Badge key={item.id} variant="outline">{profileLabel(item.reviewer_user_id)} · {selectedReviews.some((review) => review.reviewer_user_id === item.reviewer_user_id) ? "제출" : "대기"}</Badge>)}</div></section>

      <section className="rounded-xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">전문가 이견 matrix</h2><Badge variant={disagreement ? "destructive" : "secondary"} className="gap-1"><GitCompareArrows className="h-3.5 w-3.5" />{selectedReviews.length < 2 ? "2인 제출 대기" : disagreement ? "이견 있음" : "판정 일치"}</Badge></div><div className="mt-4 overflow-x-auto"><table className="min-w-[700px] w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">전문가</th><th className="p-2">종합</th><th className="p-2">상황/PDR/의미</th><th className="p-2">A</th><th className="p-2">B</th><th className="p-2">C</th><th className="p-2"></th></tr></thead><tbody>{selectedReviews.map((review) => <tr key={review.id} className="border-b"><td className="p-2">{profileLabel(review.reviewer_user_id)}</td><td className="p-2">{review.overall_verdict}</td><td className="p-2">{Object.values(review.context_assessment).map((value) => value ? "✓" : "×").join(" / ")}</td>{(["A","B","C"] as const).map((id) => <td key={id} className="p-2">{review.candidate_assessments[id].assessed_band_code}<br/><span className="text-xs text-slate-500">{review.candidate_assessments[id].semantic_fidelity}</span></td>)}<td className="p-2"><Button size="sm" variant="outline" onClick={() => fillFromReview(review)}>초안 사용</Button></td></tr>)}</tbody></table></div></section>

      <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">append-only 해결본</h2><div className="mt-3 grid gap-3 md:grid-cols-2"><Select value={method} onValueChange={(value: typeof method) => setMethod(value)}><SelectTrigger><SelectValue placeholder="해결 방식" /></SelectTrigger><SelectContent><SelectItem value="unanimous">실제 일치</SelectItem><SelectItem value="consensus_after_discussion">토론 후 합의</SelectItem><SelectItem value="researcher_decision">연구자 결정(승인 불가)</SelectItem><SelectItem value="unresolved">미해결</SelectItem></SelectContent></Select><Select value={finalStatus} onValueChange={(value: typeof finalStatus) => setFinalStatus(value)}><SelectTrigger><SelectValue placeholder="최종 상태" /></SelectTrigger><SelectContent><SelectItem value="expert_approved">외부 전문가 승인</SelectItem><SelectItem value="revise_required">수정 필요</SelectItem><SelectItem value="rejected">기각</SelectItem><SelectItem value="unresolved">미해결</SelectItem></SelectContent></Select></div>
        {finalStatus !== "unresolved" && <><div className="mt-4 grid gap-2 sm:grid-cols-3">{(["scenario_valid","pdr_valid","semantic_invariant_valid"] as const).map((key) => <label key={key} className="flex gap-2 text-sm"><Checkbox checked={context[key]} onCheckedChange={(checked) => setContext((current) => ({ ...current, [key]: checked === true }))}/><span>{key}</span></label>)}</div><div className="mt-4 grid gap-3 lg:grid-cols-3">{(["A","B","C"] as const).map((id) => <div key={id} className="rounded-lg border p-3"><b>{id}</b><Select value={candidates[id].assessed_band_code} onValueChange={(value) => setCandidates((current) => ({ ...current, [id]: { ...current[id], assessed_band_code: value } }))}><SelectTrigger className="mt-2"><SelectValue placeholder="최종 대역" /></SelectTrigger><SelectContent>{BANDS.map((band) => <SelectItem key={band} value={band}>{band}</SelectItem>)}</SelectContent></Select><Select value={candidates[id].semantic_fidelity} onValueChange={(value: "pass" | "fail") => setCandidates((current) => ({ ...current, [id]: { ...current[id], semantic_fidelity: value } }))}><SelectTrigger className="mt-2"><SelectValue placeholder="의미" /></SelectTrigger><SelectContent><SelectItem value="pass">pass</SelectItem><SelectItem value="fail">fail</SelectItem></SelectContent></Select><Textarea className="mt-2" value={candidates[id].rationale_ko} onChange={(event) => setCandidates((current) => ({ ...current, [id]: { ...current[id], rationale_ko: event.target.value } }))} placeholder="해결 근거" /></div>)}</div></>}
        <Textarea className="mt-4" value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="resolution 전체 근거" /><Button className="mt-4" onClick={resolve} disabled={preview || saving || !allSubmitted || !method || !finalStatus || !rationale.trim()}><Save className="mr-1 h-4 w-4" />resolution revision 저장</Button><p className="mt-2 text-xs text-slate-500">토론 후 합의로 승인하면 포함된 두 전문가의 별도 agree 서명이 모두 있어야 회귀·release에 사용할 수 있습니다.</p>
      </section>
      <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">누적 상태</h2><p className="mt-2 text-sm">연구자 승인 {calibrations.length} · 배정 {assignments.length} · 외부 검토 {reviews.length} · 해결본 {resolutions.length}</p></section>
      {message && <p className="rounded-lg border bg-white p-3 text-sm">{message}</p>}{preview && <p className="text-xs text-slate-500">개발 preview에서는 DB 쓰기가 잠겨 있습니다.</p>}
    </div>
  </AdminShell>;
};

export default AdminGoldExpertOps;
