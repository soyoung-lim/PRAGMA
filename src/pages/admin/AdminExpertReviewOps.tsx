import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, GitCompareArrows, Plus, ShieldCheck, UserRoundCheck } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { AdminShell } from "@/components/AdminShell";
import { ResearchWorkflowGuide } from "@/components/research/ResearchWorkflowGuide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { summarizeExpertReviews, type ExpertReviewSnapshot } from "@/lib/pragma/expertReviewConsensus";
import { ItemLineageSchema, type ItemLineage } from "@/lib/pragma/itemLineage";
import { KO_ZH_CORE_REALIZATION_PACK } from "@/lib/pragma/realizationPack";

type ProfileRow = { user_id: string; email: string | null; full_name: string | null; role: "learner" | "admin" };
type RegistryRow = { id: string; expert_user_id: string; registry_version: number; status: "active" | "retired"; expertise_areas: string[]; qualification_note: string; created_at: string };
type LineageRow = { id: string; scenario_id: string; version_no: number; stage: string; item_lineage: ItemLineage; rule_scope_ids: string[]; risk_scope_ids: string[]; mission_content: Record<string, unknown>; created_at: string };
type AssignmentRow = { id: string; lineage_version_id: string; reviewer_user_id: string; review_round: number; assigned_at: string };
type CandidateAssessment = { band_code: string; rationale_ko: string };
type ClaimAssessment = { verdict: "support" | "revise" | "reject" | "uncertain"; proposed_rule_ids?: string[]; proposed_risk_ids?: string[]; rationale_ko: string };
type ReviewRow = { id: string; lineage_version_id: string; reviewer_user_id: string; review_round: number; overall_verdict: "approve" | "revise" | "reject"; confidence: number; candidate_band_assessments: Record<string, CandidateAssessment>; lineage_claim_assessments: Record<string, ClaimAssessment>; rationale_ko: string; submitted_at: string };
type ResolutionRow = { id: string; lineage_version_id: string; review_round: number; resolution_revision: number; resolution_status: string; final_verdict: string | null; resolved_at: string };

type ResolutionClaimDraft = {
  band_code: string;
  band_rationale_ko: string;
  verdict: "" | "supported" | "revised" | "rejected";
  final_rule_ids: string[];
  final_risk_ids: string[];
  rationale_ko: string;
};

const BAND_OPTIONS = ["too_direct", "within_band", "too_indirect", "too_blunt", "over_elaborate", "insufficient", "excessive", "uncertain"];
const BAND_LABELS: Record<string, string> = {
  too_direct: "너무 직접적",
  within_band: "상황에 적절함",
  too_indirect: "너무 간접적",
  too_blunt: "너무 거침",
  over_elaborate: "지나치게 장황함",
  insufficient: "표현 강도 부족",
  excessive: "표현 강도 과도",
  uncertain: "판단하기 어려움",
};
const REVIEW_STATUS_LABELS: Record<string, string> = {
  unanimous: "두 판정이 모두 일치",
  disagreement: "서로 다른 판정 있음",
  insufficient: "제출 인원 부족",
};
const CLAIM_VERDICT_LABELS: Record<string, string> = {
  support: "타당함",
  revise: "수정 필요",
  reject: "타당하지 않음",
  uncertain: "판단 어려움",
};
const PREVIEW_RULE_LABELS: Record<string, string> = {
  "RR-KOZH-REQ-HEDGE": "요청을 부드럽게 만드는 완화 표현",
  "RR-KOZH-REQ-OPTIONALITY": "상대방에게 선택권을 남기는 표현",
};
const PREVIEW_RISK_LABELS: Record<string, string> = {
  imperative_pressure: "명령처럼 들릴 수 있는 압박 위험",
};
const ruleLabel = (id: string) => KO_ZH_CORE_REALIZATION_PACK.resources.find((item) => item.rule_id === id)?.prompt_label_ko ?? PREVIEW_RULE_LABELS[id] ?? id;
const riskLabel = (id: string) => KO_ZH_CORE_REALIZATION_PACK.risks.find((item) => item.risk_id === id)?.description_ko ?? PREVIEW_RISK_LABELS[id] ?? id;

// 신규 contract tables/RPC는 generated types 재생성 전까지 동적 adapter로 격리한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any; rpc: (name: string, args?: Record<string, unknown>) => any };

const emptyResolutionClaim = (): ResolutionClaimDraft => ({ band_code: "", band_rationale_ko: "", verdict: "", final_rule_ids: [], final_risk_ids: [], rationale_ko: "" });

const PREVIEW_LINEAGE_ID = "20000000-0000-4000-8000-000000000088";
const PREVIEW_PROFILES: ProfileRow[] = [
  { user_id: "30000000-0000-4000-8000-000000000081", email: "expert.a@example.com", full_name: "전문가 A", role: "learner" },
  { user_id: "30000000-0000-4000-8000-000000000082", email: "expert.b@example.com", full_name: "전문가 B", role: "learner" },
];
const PREVIEW_REGISTRY: RegistryRow[] = PREVIEW_PROFILES.map((profile, index) => ({
  id: `40000000-0000-4000-8000-00000000008${index + 1}`,
  expert_user_id: profile.user_id,
  registry_version: 1,
  status: "active",
  expertise_areas: ["중국어 화용론", "한중 통번역"],
  qualification_note: "테스트 전용 전문가 자격 snapshot",
  created_at: "2026-08-15T00:00:00.000Z",
}));
const PREVIEW_LINEAGE: LineageRow = {
  id: PREVIEW_LINEAGE_ID,
  scenario_id: "50000000-0000-4000-8000-000000000088",
  version_no: 3,
  stage: "reviewed",
  rule_scope_ids: ["RR-KOZH-REQ-HEDGE", "RR-KOZH-REQ-OPTIONALITY"],
  risk_scope_ids: ["imperative_pressure"],
  mission_content: {},
  created_at: "2026-08-15T00:00:00.000Z",
  item_lineage: ItemLineageSchema.parse({
    schema_version: "mission_item_lineage_v1",
    claim_status: "model_attribution_pending_review",
    realization_pack_id: "pragma_ko_zh_core",
    realization_pack_version: "1.2.0",
    claims: [
      { claim_id: "ILC-OPS-001", target_path: "mpj_items[0].target", attribution_status: "model_claimed", rule_ids: ["RR-KOZH-REQ-HEDGE"], risk_ids: [], evidence_ids: ["EV-REQ-01"], note_ko: "완화 귀속" },
      { claim_id: "ILC-OPS-002", target_path: "mpj_items[1].target", attribution_status: "model_claimed", rule_ids: [], risk_ids: ["imperative_pressure"], evidence_ids: ["EV-REQ-02"], note_ko: "압박 위험 귀속" },
    ],
  }),
};
const PREVIEW_ASSIGNMENTS: AssignmentRow[] = PREVIEW_PROFILES.map((profile, index) => ({
  id: `60000000-0000-4000-8000-00000000008${index + 1}`,
  lineage_version_id: PREVIEW_LINEAGE_ID,
  reviewer_user_id: profile.user_id,
  review_round: 1,
  assigned_at: "2026-08-15T00:00:00.000Z",
}));
const PREVIEW_REVIEWS: ReviewRow[] = [
  {
    id: "70000000-0000-4000-8000-000000000081", lineage_version_id: PREVIEW_LINEAGE_ID,
    reviewer_user_id: PREVIEW_PROFILES[0].user_id, review_round: 1, overall_verdict: "revise", confidence: 4,
    candidate_band_assessments: {
      "ILC-OPS-001": { band_code: "within_band", rationale_ko: "완화가 적정함" },
      "ILC-OPS-002": { band_code: "too_direct", rationale_ko: "명령 압박이 큼" },
    },
    lineage_claim_assessments: {
      "ILC-OPS-001": { verdict: "support", rationale_ko: "귀속 적절" },
      "ILC-OPS-002": { verdict: "revise", proposed_rule_ids: ["RR-KOZH-REQ-OPTIONALITY"], rationale_ko: "선택권 부재 규칙으로 보완" },
    },
    rationale_ko: "두 번째 claim 수정", submitted_at: "2026-08-15T00:10:00.000Z",
  },
  {
    id: "70000000-0000-4000-8000-000000000082", lineage_version_id: PREVIEW_LINEAGE_ID,
    reviewer_user_id: PREVIEW_PROFILES[1].user_id, review_round: 1, overall_verdict: "reject", confidence: 3,
    candidate_band_assessments: {
      "ILC-OPS-001": { band_code: "within_band", rationale_ko: "완화가 적정함" },
      "ILC-OPS-002": { band_code: "uncertain", rationale_ko: "장면 정보 추가 확인 필요" },
    },
    lineage_claim_assessments: {
      "ILC-OPS-001": { verdict: "support", rationale_ko: "귀속 적절" },
      "ILC-OPS-002": { verdict: "uncertain", rationale_ko: "위험 귀속 근거가 충분하지 않음" },
    },
    rationale_ko: "두 번째 claim 불확실", submitted_at: "2026-08-15T00:12:00.000Z",
  },
];

const AdminExpertReviewOps = ({ preview = false }: { preview?: boolean }) => {
  const { pathname } = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [profiles, setProfiles] = useState<ProfileRow[]>(preview ? PREVIEW_PROFILES : []);
  const [registry, setRegistry] = useState<RegistryRow[]>(preview ? PREVIEW_REGISTRY : []);
  const [lineages, setLineages] = useState<LineageRow[]>(preview ? [PREVIEW_LINEAGE] : []);
  const [assignments, setAssignments] = useState<AssignmentRow[]>(preview ? PREVIEW_ASSIGNMENTS : []);
  const [reviews, setReviews] = useState<ReviewRow[]>(preview ? PREVIEW_REVIEWS : []);
  const [resolutions, setResolutions] = useState<ResolutionRow[]>([]);
  const [loading, setLoading] = useState(!preview);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [registryUserId, setRegistryUserId] = useState("");
  const [expertiseText, setExpertiseText] = useState("중국어 화용론, 한중 통번역");
  const [qualificationNote, setQualificationNote] = useState("");
  const [assignmentLineageId, setAssignmentLineageId] = useState(preview ? PREVIEW_LINEAGE_ID : "");
  const [assignmentExpertId, setAssignmentExpertId] = useState("");
  const [assignmentRound, setAssignmentRound] = useState("1");
  const [selectedLineageId, setSelectedLineageId] = useState(preview ? PREVIEW_LINEAGE_ID : "");
  const [selectedRound, setSelectedRound] = useState("1");
  const [resolutionStatus, setResolutionStatus] = useState<"" | "unanimous" | "consensus_after_discussion" | "researcher_decision" | "unresolved">("");
  const [finalVerdict, setFinalVerdict] = useState<"" | "approve" | "revise" | "reject">("");
  const [resolutionRationale, setResolutionRationale] = useState("");
  const [resolutionDraft, setResolutionDraft] = useState<Record<string, ResolutionClaimDraft>>({});

  const load = useCallback(async () => {
    if (preview) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: admin } = await supabase.rpc("is_admin");
    if (!admin) { setIsAdmin(false); setLoading(false); return; }
    setIsAdmin(true);
    const [profileResult, registryResult, lineageResult, assignmentResult, reviewResult, resolutionResult] = await Promise.all([
      supabase.from("profiles").select("user_id,email,full_name,role").eq("role", "learner").order("email"),
      db.from("pragma_expert_registry_versions").select("*").order("created_at", { ascending: false }),
      db.from("mission_lineage_versions").select("id,scenario_id,version_no,stage,item_lineage,rule_scope_ids,risk_scope_ids,mission_content,created_at").eq("stage", "reviewed").eq("coverage_status", "covered").not("item_lineage", "is", null).order("created_at", { ascending: false }).limit(100),
      db.from("mission_expert_review_assignments").select("id,lineage_version_id,reviewer_user_id,review_round,assigned_at").order("assigned_at", { ascending: false }),
      db.from("mission_expert_reviews").select("id,lineage_version_id,reviewer_user_id,review_round,overall_verdict,confidence,candidate_band_assessments,lineage_claim_assessments,rationale_ko,submitted_at").eq("schema_version", "mission_expert_review_v2").order("submitted_at", { ascending: false }),
      db.from("mission_review_resolutions").select("id,lineage_version_id,review_round,resolution_revision,resolution_status,final_verdict,resolved_at").order("resolved_at", { ascending: false }),
    ]);
    const error = profileResult.error ?? registryResult.error ?? lineageResult.error ?? assignmentResult.error ?? reviewResult.error ?? resolutionResult.error;
    if (error) setMessage(error.message);
    else {
      setProfiles((profileResult.data ?? []) as ProfileRow[]);
      setRegistry((registryResult.data ?? []) as RegistryRow[]);
      const parsedLineages = (lineageResult.data ?? []).map((row: Record<string, unknown>) => ({ ...row, item_lineage: ItemLineageSchema.parse(row.item_lineage) })) as LineageRow[];
      setLineages(parsedLineages);
      setAssignments((assignmentResult.data ?? []) as AssignmentRow[]);
      setReviews((reviewResult.data ?? []) as ReviewRow[]);
      setResolutions((resolutionResult.data ?? []) as ResolutionRow[]);
      const first = parsedLineages[0]?.id ?? "";
      setSelectedLineageId((current) => current || first);
      setAssignmentLineageId((current) => current || first);
    }
    setLoading(false);
  }, [preview]);

  useEffect(() => { void load(); }, [load]);

  const latestRegistry = useMemo(() => {
    const map = new Map<string, RegistryRow>();
    for (const row of registry) if (!map.has(row.expert_user_id)) map.set(row.expert_user_id, row);
    return map;
  }, [registry]);
  const activeExperts = [...latestRegistry.values()].filter((row) => row.status === "active");
  const selectedLineage = lineages.find((row) => row.id === selectedLineageId) ?? null;
  const roundNumber = Number(selectedRound);
  const selectedAssignments = assignments.filter((row) => row.lineage_version_id === selectedLineageId && row.review_round === roundNumber);
  const selectedReviews = reviews.filter((row) => row.lineage_version_id === selectedLineageId && row.review_round === roundNumber);
  const selectedResolutions = resolutions.filter((row) => row.lineage_version_id === selectedLineageId && row.review_round === roundNumber);

  const reviewSummary = useMemo(() => {
    const snapshots: ExpertReviewSnapshot[] = selectedReviews.map((review) => ({
      review_id: review.id,
      reviewer_id: review.reviewer_user_id,
      verdict: review.overall_verdict,
      confidence: review.confidence as 1 | 2 | 3 | 4 | 5,
      candidate_bands: Object.fromEntries(Object.entries(review.candidate_band_assessments).map(([id, assessment]) => [id, assessment.band_code])),
      lineage_claims: review.lineage_claim_assessments,
    }));
    return summarizeExpertReviews(snapshots);
  }, [selectedReviews]);

  useEffect(() => {
    if (!selectedLineage) return;
    setResolutionDraft(Object.fromEntries(selectedLineage.item_lineage.claims.map((claim) => [claim.claim_id, emptyResolutionClaim()])));
    setResolutionStatus(""); setFinalVerdict(""); setResolutionRationale("");
  }, [selectedLineage, selectedRound]);

  const registerExpert = async () => {
    if (!isAdmin || !registryUserId || !qualificationNote.trim()) return;
    setSaving(true); setMessage(null);
    const expertise = expertiseText.split(",").map((item) => item.trim()).filter(Boolean);
    const { error } = await db.rpc("register_pragma_expert", {
      p_expert_user_id: registryUserId,
      p_status: "active",
      p_language_pairs: ["ko_zh"],
      p_expertise_areas: expertise,
      p_qualification_note: qualificationNote.trim(),
    });
    setSaving(false);
    if (error) setMessage(error.message); else { setMessage("전문가의 자격과 전문 분야를 새 이력으로 저장했습니다."); await load(); }
  };

  const assignExpert = async () => {
    if (!isAdmin || !assignmentLineageId || !assignmentExpertId || Number(assignmentRound) < 1) return;
    setSaving(true); setMessage(null);
    const { error } = await db.rpc("assign_mission_expert_review", {
      p_lineage_version_id: assignmentLineageId,
      p_reviewer_user_id: assignmentExpertId,
      p_review_round: Number(assignmentRound),
    });
    setSaving(false);
    if (error) setMessage(error.message); else { setMessage("AI 학습문항을 외부 전문가에게 비공개로 배정했습니다."); await load(); }
  };

  const toggleFinalId = (claimId: string, field: "final_rule_ids" | "final_risk_ids", id: string, checked: boolean) => {
    setResolutionDraft((current) => {
      const before = current[claimId];
      const next = checked ? [...before[field], id] : before[field].filter((value) => value !== id);
      return { ...current, [claimId]: { ...before, [field]: next } };
    });
  };

  const fillUnanimous = () => {
    if (!selectedLineage || reviewSummary.status !== "unanimous" || selectedReviews.length < 2) return;
    const first = selectedReviews[0];
    const next: Record<string, ResolutionClaimDraft> = {};
    for (const claim of selectedLineage.item_lineage.claims) {
      const band = first.candidate_band_assessments[claim.claim_id];
      const assessment = first.lineage_claim_assessments[claim.claim_id];
      const supported = assessment.verdict === "support";
      const revised = assessment.verdict === "revise";
      next[claim.claim_id] = {
        band_code: band.band_code,
        band_rationale_ko: band.rationale_ko,
        verdict: supported ? "supported" : revised ? "revised" : "rejected",
        final_rule_ids: supported ? claim.rule_ids : revised ? assessment.proposed_rule_ids ?? [] : [],
        final_risk_ids: supported ? claim.risk_ids : revised ? assessment.proposed_risk_ids ?? [] : [],
        rationale_ko: assessment.rationale_ko,
      };
    }
    setResolutionDraft(next);
    setResolutionStatus("unanimous");
    setFinalVerdict(first.overall_verdict);
    setResolutionRationale("같은 차수의 두 외부 전문가가 모든 문장과 규칙 연결에서 같은 판단을 제출함");
  };

  const resolutionComplete = Boolean(selectedLineage && selectedReviews.length >= 2 && resolutionStatus && resolutionRationale.trim() && (
    resolutionStatus === "unresolved" || (finalVerdict && selectedLineage.item_lineage.claims.every((claim) => {
      const row = resolutionDraft[claim.claim_id];
      return row?.band_code && row.band_rationale_ko.trim() && row.verdict && row.rationale_ko.trim()
        && (row.verdict === "rejected" || row.final_rule_ids.length + row.final_risk_ids.length > 0);
    }))
  ));

  const proposeResolution = async () => {
    if (!isAdmin || !selectedLineage || !resolutionComplete) return;
    setSaving(true); setMessage(null);
    const resolvedCandidateBands = resolutionStatus === "unresolved" ? null : Object.fromEntries(Object.entries(resolutionDraft).map(([id, row]) => [id, { band_code: row.band_code, rationale_ko: row.band_rationale_ko }]));
    const resolvedClaims = resolutionStatus === "unresolved" ? null : Object.fromEntries(Object.entries(resolutionDraft).map(([id, row]) => [id, { verdict: row.verdict, final_rule_ids: row.final_rule_ids, final_risk_ids: row.final_risk_ids, rationale_ko: row.rationale_ko }]));
    const { error } = await db.rpc("propose_mission_review_resolution", { p_payload: {
      lineage_version_id: selectedLineage.id,
      review_round: roundNumber,
      review_ids: selectedReviews.map((review) => review.id),
      resolution_status: resolutionStatus,
      final_verdict: resolutionStatus === "unresolved" ? "" : finalVerdict,
      resolved_candidate_bands: resolvedCandidateBands,
      resolved_lineage_claims: resolvedClaims,
      rationale_ko: resolutionRationale,
    } });
    setSaving(false);
    if (error) setMessage(error.message); else { setMessage("두 전문가의 최종 결론을 새 이력으로 저장했습니다."); await load(); }
  };

  const profileLabel = (id: string) => {
    const profile = profiles.find((row) => row.user_id === id);
    return profile?.full_name || profile?.email || `${id.slice(0, 8)}…`;
  };

  return (
    <AdminShell title="3단계 · AI 학습문항 외부 전문가 확인" description="AI가 만든 실제 수업용 문장을 외부 전문가 2명에게 독립적으로 배정하고, 서로 다른 판단은 근거와 함께 해결합니다.">
      <ResearchWorkflowGuide current="missions" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={pathname.startsWith("/prototype/") ? "/prototype/research-qa" : "/admin/research-qa"} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> 문항 품질관리 전체 현황</Link>
        <div className="flex flex-wrap gap-2"><Badge variant="outline">등록 외부 전문가 {activeExperts.length}명</Badge><Badge variant="outline">배정 {assignments.length}건</Badge><Badge variant="outline">제출된 판단 {reviews.length}건</Badge><Badge variant="outline">최종 결론 {resolutions.length}건</Badge></div>
      </div>

      <section className="mt-5 rounded-xl border border-[#E5CF72] bg-[#FFF9DF] p-4 text-sm leading-6 text-[#665515]">
        관리자는 문항을 배정하고 최종 결론을 정리하지만 외부 전문가의 판단을 대신할 수 없습니다. ‘두 판단 일치’는 관리자가 임의로 선택하는 상태가 아니라 서버가 실제 답을 비교해 확인합니다.
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2"><UserRoundCheck className="h-5 w-5" /><h2 className="text-lg font-semibold">1. 전문가 자격 확인·등록</h2></div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">전문가 계정, 전문 분야와 선정 근거를 기록합니다. 중국어 모어 화자 1명과 한국어 모어의 고급 중국어·한중 통번역 전문가 1명 조합을 권장합니다.</p>
          <div className="mt-4 grid gap-3"><Select value={registryUserId} onValueChange={setRegistryUserId}><SelectTrigger><SelectValue placeholder="전문가로 등록할 계정 선택" /></SelectTrigger><SelectContent>{profiles.filter((profile) => profile.role === "learner").map((profile) => <SelectItem key={profile.user_id} value={profile.user_id}>{profile.full_name || profile.email || profile.user_id}</SelectItem>)}</SelectContent></Select><Input value={expertiseText} onChange={(event) => setExpertiseText(event.target.value)} placeholder="전문 분야 예: 중국어 화용론, 한중 통번역" /><Textarea value={qualificationNote} onChange={(event) => setQualificationNote(event.target.value)} placeholder="학위, 경력, 모어와 언어 숙달도 등 선정 근거" /><Button onClick={registerExpert} disabled={!isAdmin || saving || !registryUserId || !qualificationNote.trim()}><Plus className="mr-2 h-4 w-4" />전문가 자격 저장</Button></div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /><h2 className="text-lg font-semibold">2. AI 학습문항과 외부 전문가 배정</h2></div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">앱 내부 확인을 마친 같은 AI 학습문항을 같은 차수의 외부 전문가 2명에게 한 명씩 배정합니다. 두 사람은 서로의 답을 볼 수 없습니다.</p>
          <div className="mt-4 grid gap-3"><Select value={assignmentLineageId} onValueChange={setAssignmentLineageId}><SelectTrigger><SelectValue placeholder="확인할 AI 학습문항 선택" /></SelectTrigger><SelectContent>{lineages.map((lineage) => <SelectItem key={lineage.id} value={lineage.id}>문항 {lineage.scenario_id.slice(0, 8)} · 버전 {lineage.version_no}</SelectItem>)}</SelectContent></Select><Select value={assignmentExpertId} onValueChange={setAssignmentExpertId}><SelectTrigger><SelectValue placeholder="배정할 외부 전문가 선택" /></SelectTrigger><SelectContent>{activeExperts.map((expert) => <SelectItem key={expert.expert_user_id} value={expert.expert_user_id}>{profileLabel(expert.expert_user_id)} · 자격 버전 {expert.registry_version}</SelectItem>)}</SelectContent></Select><Input aria-label="확인 차수" type="number" min={1} value={assignmentRound} onChange={(event) => setAssignmentRound(event.target.value)} /><Button onClick={assignExpert} disabled={!isAdmin || saving || !assignmentLineageId || !assignmentExpertId}><Plus className="mr-2 h-4 w-4" />외부 전문가에게 배정</Button></div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><GitCompareArrows className="h-5 w-5" /><h2 className="text-lg font-semibold">3. 두 판단 비교와 최종 결론</h2></div><p className="mt-1 text-sm text-muted-foreground">같은 차수에 배정된 외부 전문가가 모두 제출해야 최종 결론을 저장할 수 있습니다.</p></div>{reviewSummary.status === "unanimous" && <Button variant="outline" onClick={fillUnanimous}><CheckCircle2 className="mr-2 h-4 w-4" />일치한 판단으로 결론 초안 만들기</Button>}</div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_120px]"><Select value={selectedLineageId} onValueChange={setSelectedLineageId}><SelectTrigger><SelectValue placeholder="두 판단을 비교할 AI 학습문항 선택" /></SelectTrigger><SelectContent>{lineages.map((lineage) => <SelectItem key={lineage.id} value={lineage.id}>문항 {lineage.scenario_id.slice(0, 8)} · 버전 {lineage.version_no}</SelectItem>)}</SelectContent></Select><Input aria-label="비교할 확인 차수" type="number" min={1} value={selectedRound} onChange={(event) => setSelectedRound(event.target.value)} /></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">외부 전문가 배정</p><p className="mt-1 text-xl font-semibold">{selectedAssignments.length}명</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">판단 제출</p><p className="mt-1 text-xl font-semibold">{selectedReviews.length}명</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">비교 결과</p><p className="mt-1 text-sm font-semibold">{REVIEW_STATUS_LABELS[reviewSummary.status] ?? reviewSummary.status}</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">저장된 최종 결론</p><p className="mt-1 text-xl font-semibold">{selectedResolutions.length}건</p></div></div>

        {selectedLineage && <div className="mt-5 space-y-4">{selectedLineage.item_lineage.claims.map((claim, claimIndex) => {
          const draft = resolutionDraft[claim.claim_id] ?? emptyResolutionClaim();
          return <article key={claim.claim_id} className="rounded-xl border border-border p-4"><p className="text-sm font-semibold">확인 문장 {claimIndex + 1}</p><details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">내부 추적번호 보기</summary><p className="mt-1 font-mono">{claim.claim_id}</p></details><div className="mt-3 grid gap-2 md:grid-cols-2">{selectedReviews.map((review) => <div key={review.id} className="rounded-lg bg-muted/50 p-3 text-xs leading-5"><p className="font-semibold">{profileLabel(review.reviewer_user_id)} · 확신도 {review.confidence}/5</p><p>상황 적절성: {BAND_LABELS[review.candidate_band_assessments[claim.claim_id]?.band_code] ?? "판정 누락"}</p><p>규칙 연결: {CLAIM_VERDICT_LABELS[review.lineage_claim_assessments[claim.claim_id]?.verdict ?? ""] ?? "판정 누락"}</p></div>)}</div><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-xs font-medium">최종 적절성<Select value={draft.band_code} onValueChange={(value) => setResolutionDraft((current) => ({ ...current, [claim.claim_id]: { ...current[claim.claim_id], band_code: value } }))}><SelectTrigger className="mt-1"><SelectValue placeholder="최종 판단 선택" /></SelectTrigger><SelectContent>{BAND_OPTIONS.map((band) => <SelectItem key={band} value={band}>{BAND_LABELS[band] ?? band}</SelectItem>)}</SelectContent></Select></label><label className="text-xs font-medium">적절성 결론 근거<Textarea className="mt-1 min-h-[70px]" value={draft.band_rationale_ko} onChange={(event) => setResolutionDraft((current) => ({ ...current, [claim.claim_id]: { ...current[claim.claim_id], band_rationale_ko: event.target.value } }))} /></label><label className="text-xs font-medium">규칙·근거 연결의 최종 판단<Select value={draft.verdict} onValueChange={(value) => setResolutionDraft((current) => ({ ...current, [claim.claim_id]: { ...current[claim.claim_id], verdict: value as ResolutionClaimDraft["verdict"], final_rule_ids: [], final_risk_ids: [] } }))}><SelectTrigger className="mt-1"><SelectValue placeholder="최종 판단 선택" /></SelectTrigger><SelectContent><SelectItem value="supported">현재 연결이 타당함</SelectItem><SelectItem value="revised">연결 수정 필요</SelectItem><SelectItem value="rejected">연결을 인정할 수 없음</SelectItem></SelectContent></Select></label><label className="text-xs font-medium">규칙·근거 연결 결론의 이유<Textarea className="mt-1 min-h-[70px]" value={draft.rationale_ko} onChange={(event) => setResolutionDraft((current) => ({ ...current, [claim.claim_id]: { ...current[claim.claim_id], rationale_ko: event.target.value } }))} /></label></div>{draft.verdict !== "rejected" && <div className="mt-3 grid gap-3 rounded-lg border border-border p-3 md:grid-cols-2"><div><p className="text-xs font-semibold">최종 적용 규칙</p>{selectedLineage.rule_scope_ids.map((id) => <label key={id} className="mt-2 flex gap-2 text-xs"><Checkbox checked={draft.final_rule_ids.includes(id)} onCheckedChange={(checked) => toggleFinalId(claim.claim_id, "final_rule_ids", id, checked === true)} />{ruleLabel(id)}</label>)}</div><div><p className="text-xs font-semibold">최종 주의사항</p>{selectedLineage.risk_scope_ids.map((id) => <label key={id} className="mt-2 flex gap-2 text-xs"><Checkbox checked={draft.final_risk_ids.includes(id)} onCheckedChange={(checked) => toggleFinalId(claim.claim_id, "final_risk_ids", id, checked === true)} />{riskLabel(id)}</label>)}</div></div>}</article>;
        })}</div>}

        <div className="mt-5 grid gap-3 md:grid-cols-2"><Select value={resolutionStatus} onValueChange={(value) => setResolutionStatus(value as typeof resolutionStatus)}><SelectTrigger><SelectValue placeholder="결론을 정한 방식" /></SelectTrigger><SelectContent>{reviewSummary.status === "unanimous" && <SelectItem value="unanimous">처음부터 두 판정이 일치함</SelectItem>}<SelectItem value="consensus_after_discussion">의견을 나눈 뒤 합의함</SelectItem><SelectItem value="researcher_decision">논문 저자가 결정함 — 외부 확인 완료로 사용 불가</SelectItem><SelectItem value="unresolved">아직 결론을 내리지 못함</SelectItem></SelectContent></Select><Select value={finalVerdict} onValueChange={(value) => setFinalVerdict(value as typeof finalVerdict)} disabled={resolutionStatus === "unresolved"}><SelectTrigger><SelectValue placeholder="문항의 최종 결과" /></SelectTrigger><SelectContent><SelectItem value="approve">그대로 사용 가능</SelectItem><SelectItem value="revise">수정 후 다시 확인</SelectItem><SelectItem value="reject">학습 문항에서 제외</SelectItem></SelectContent></Select><Textarea className="md:col-span-2" value={resolutionRationale} onChange={(event) => setResolutionRationale(event.target.value)} placeholder="두 판단의 차이, 논의 결과와 최종 결론의 이유" /></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">의견을 나눈 뒤 합의한 경우 두 외부 전문가가 해결안에 각각 동의해야 PRAGMA 학습자 화면에 공개할 수 있습니다.</p><Button onClick={proposeResolution} disabled={!isAdmin || !resolutionComplete || saving || preview}>{preview ? "미리보기 · 저장할 수 없음" : "최종 결론 저장"}</Button></div>
        {message && <p role="status" className="mt-3 rounded-lg bg-muted p-3 text-sm">{message}</p>}
        {!isAdmin && !preview && !loading && <p className="mt-3 text-xs text-destructive">관리자 인증이 필요합니다.</p>}
      </section>
    </AdminShell>
  );
};

export default AdminExpertReviewOps;
