import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, EyeOff, LogOut, Save, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { HomeBrand } from "@/components/HomeBrand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  EXPERT_REVIEW_PROTOCOL_VERSION,
  makeMissionExpertReviewSubmission,
  resolveExpertReviewTargetText,
  type MissionExpertAssignmentSnapshot,
  type MissionExpertLineageSnapshot,
} from "@/lib/pragma/expertReviewProtocol";
import { ItemLineageSchema, type ItemLineageClaim } from "@/lib/pragma/itemLineage";

type CandidateDraft = { band_code: string; rationale_ko: string };
type ClaimDraft = {
  verdict: "" | "support" | "revise" | "reject" | "uncertain";
  proposed_rule_ids: string[];
  proposed_risk_ids: string[];
  rationale_ko: string;
};
type AssignmentRow = MissionExpertAssignmentSnapshot & { assigned_at: string };
type ReviewRow = { id: string; assignment_id: string; submitted_at: string; overall_verdict: string };
type ResolutionRow = { id: string; lineage_version_id: string; review_ids: string[]; resolution_status: string; final_verdict: string | null; resolution_revision: number; rationale_ko: string; resolved_at: string };
type SignoffRow = { id: string; resolution_id: string; decision: "agree" | "disagree"; signed_at: string };

const BAND_OPTIONS = [
  ["too_direct", "과도하게 직접적"], ["within_band", "목표 적절성 대역"],
  ["too_indirect", "과도하게 간접적"], ["too_blunt", "과도하게 단정적"],
  ["over_elaborate", "과도하게 장황함"], ["insufficient", "강도 부족"],
  ["excessive", "강도 과도"], ["uncertain", "판정 유보"],
] as const;

const CLAIM_VERDICTS = [
  ["support", "연결 지지"], ["revise", "연결 수정"],
  ["reject", "연결 기각"], ["uncertain", "판정 유보"],
] as const;

// 신규 moat tables는 타입 재생성 전까지 동적 table adapter를 사용한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any };

const previewLineage: MissionExpertLineageSnapshot = {
  id: "20000000-0000-4000-8000-000000000099",
  rule_scope_ids: ["RR-KOZH-REQ-OPTIONALITY", "RR-KOZH-REQ-HEDGE"],
  risk_scope_ids: ["imperative_pressure"],
  mission_content: {
    mpj_items: [
      { target: "麻烦你把照片发给我。" },
      { candidates: [{ text: "现在马上把照片发给我。" }, { text: "方便的话，可以把照片发给我吗？" }] },
    ],
  },
  item_lineage: ItemLineageSchema.parse({
    schema_version: "mission_item_lineage_v1",
    claim_status: "model_attribution_pending_review",
    realization_pack_id: "pragma_ko_zh_core",
    realization_pack_version: "1.2.0",
    claims: [
      { claim_id: "ILC-PREVIEW-001", target_path: "mpj_items[0].target", attribution_status: "model_claimed", rule_ids: ["RR-KOZH-REQ-HEDGE"], risk_ids: [], evidence_ids: ["EV-REQ-01"], note_ko: "麻烦을 완화 자원으로 귀속" },
      { claim_id: "ILC-PREVIEW-002", target_path: "mpj_items[1].candidates[0]", attribution_status: "model_claimed", rule_ids: [], risk_ids: ["imperative_pressure"], evidence_ids: ["EV-REQ-02"], note_ko: "马上 명령 압박 위험" },
      { claim_id: "ILC-PREVIEW-003", target_path: "mpj_items[1].candidates[1]", attribution_status: "model_claimed", rule_ids: ["RR-KOZH-REQ-OPTIONALITY"], risk_ids: [], evidence_ids: ["EV-REQ-01"], note_ko: "方便的话·可以로 선택권을 실현" },
    ],
  }),
};

const previewAssignment: AssignmentRow = {
  id: "10000000-0000-4000-8000-000000000099",
  lineage_version_id: previewLineage.id,
  reviewer_user_id: "30000000-0000-4000-8000-000000000099",
  review_round: 1,
  protocol_version: EXPERT_REVIEW_PROTOCOL_VERSION,
  blind_review: true,
  assigned_at: "2026-08-14T14:00:00.000Z",
};

const ExpertReviewQueue = ({ preview = false }: { preview?: boolean }) => {
  const [assignments, setAssignments] = useState<AssignmentRow[]>(preview ? [previewAssignment] : []);
  const [lineages, setLineages] = useState<MissionExpertLineageSnapshot[]>(preview ? [previewLineage] : []);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [resolutions, setResolutions] = useState<ResolutionRow[]>([]);
  const [signoffs, setSignoffs] = useState<SignoffRow[]>([]);
  const [selectedId, setSelectedId] = useState(previewAssignment.id);
  const [reviewerId, setReviewerId] = useState(preview ? previewAssignment.reviewer_user_id : "");
  const [loading, setLoading] = useState(!preview);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bands, setBands] = useState<Record<string, CandidateDraft>>({});
  const [claims, setClaims] = useState<Record<string, ClaimDraft>>({});
  const [overallVerdict, setOverallVerdict] = useState<"" | "approve" | "revise" | "reject">("");
  const [confidence, setConfidence] = useState("");
  const [rationale, setRationale] = useState("");
  const [independent, setIndependent] = useState(false);
  const [noConflict, setNoConflict] = useState(false);
  const [proficiency, setProficiency] = useState(false);
  const [signoffDecision, setSignoffDecision] = useState<"" | "agree" | "disagree">("");
  const [signoffRationale, setSignoffRationale] = useState("");

  useEffect(() => {
    if (preview) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { setLoading(false); return; }
      const uid = authData.user.id;
      const [assignmentResult, reviewResult, resolutionResult, signoffResult] = await Promise.all([
        db.from("mission_expert_review_assignments").select("id,lineage_version_id,reviewer_user_id,review_round,protocol_version,blind_review,assigned_at").eq("reviewer_user_id", uid).order("assigned_at", { ascending: false }),
        db.from("mission_expert_reviews").select("id,assignment_id,submitted_at,overall_verdict").eq("reviewer_user_id", uid).order("submitted_at", { ascending: false }),
        db.from("mission_review_resolutions").select("id,lineage_version_id,review_ids,resolution_status,final_verdict,resolution_revision,rationale_ko,resolved_at").order("resolved_at", { ascending: false }),
        db.from("mission_review_resolution_signoffs").select("id,resolution_id,decision,signed_at").eq("reviewer_user_id", uid).order("signed_at", { ascending: false }),
      ]);
      if (!active) return;
      if (assignmentResult.error || reviewResult.error || resolutionResult.error || signoffResult.error) {
        setMessage(assignmentResult.error?.message ?? reviewResult.error?.message ?? resolutionResult.error?.message ?? signoffResult.error?.message ?? "배정 목록을 불러오지 못했습니다.");
        setLoading(false);
        return;
      }
      const loadedAssignments = (assignmentResult.data ?? []) as AssignmentRow[];
      const lineageIds = [...new Set(loadedAssignments.map((item) => item.lineage_version_id))];
      const lineageResult = lineageIds.length
        ? await db.from("mission_lineage_versions").select("id,item_lineage,rule_scope_ids,risk_scope_ids,mission_content").in("id", lineageIds)
        : { data: [], error: null };
      if (!active) return;
      if (lineageResult.error) setMessage(lineageResult.error.message);
      else {
        setAssignments(loadedAssignments);
        setReviews((reviewResult.data ?? []) as ReviewRow[]);
        setResolutions((resolutionResult.data ?? []) as ResolutionRow[]);
        setSignoffs((signoffResult.data ?? []) as SignoffRow[]);
        setLineages((lineageResult.data ?? []).map((row: Record<string, unknown>) => ({
          id: String(row.id),
          item_lineage: ItemLineageSchema.parse(row.item_lineage),
          rule_scope_ids: row.rule_scope_ids as string[],
          risk_scope_ids: row.risk_scope_ids as string[],
          mission_content: row.mission_content as Record<string, unknown>,
        })));
        setSelectedId(loadedAssignments[0]?.id ?? "");
        setReviewerId(uid);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [preview]);

  const assignment = assignments.find((item) => item.id === selectedId) ?? null;
  const lineage = assignment ? lineages.find((item) => item.id === assignment.lineage_version_id) ?? null : null;
  const submitted = assignment ? reviews.find((item) => item.assignment_id === assignment.id) ?? null : null;

  useEffect(() => {
    if (!lineage) return;
    setBands(Object.fromEntries(lineage.item_lineage.claims.map((claim) => [claim.claim_id, { band_code: "", rationale_ko: "" }])));
    setClaims(Object.fromEntries(lineage.item_lineage.claims.map((claim) => [claim.claim_id, { verdict: "", proposed_rule_ids: [], proposed_risk_ids: [], rationale_ko: "" }])));
    setOverallVerdict(""); setConfidence(""); setRationale("");
    setIndependent(false); setNoConflict(false); setProficiency(false); setMessage(null);
    setSignoffDecision(""); setSignoffRationale("");
  }, [lineage]);

  const complete = useMemo(() => {
    if (!lineage || !assignment || submitted) return false;
    const everyBand = lineage.item_lineage.claims.every((claim) => bands[claim.claim_id]?.band_code && bands[claim.claim_id]?.rationale_ko.trim());
    const everyClaim = lineage.item_lineage.claims.every((claim) => {
      const item = claims[claim.claim_id];
      if (!item?.verdict || !item.rationale_ko.trim()) return false;
      return item.verdict !== "revise" || item.proposed_rule_ids.length + item.proposed_risk_ids.length > 0;
    });
    return Boolean(everyBand && everyClaim && overallVerdict && confidence && rationale.trim() && independent && noConflict && proficiency);
  }, [assignment, bands, claims, confidence, independent, lineage, noConflict, overallVerdict, proficiency, rationale, submitted]);

  const toggleId = (claimId: string, field: "proposed_rule_ids" | "proposed_risk_ids", id: string, checked: boolean) => {
    setClaims((current) => {
      const before = current[claimId];
      const next = checked ? [...before[field], id] : before[field].filter((item) => item !== id);
      return { ...current, [claimId]: { ...before, [field]: next } };
    });
  };

  const submit = async () => {
    if (!assignment || !lineage || !complete || preview) return;
    setSaving(true); setMessage(null);
    try {
      const submission = makeMissionExpertReviewSubmission({
        assignment, lineage, reviewerUserId: reviewerId,
        independenceDeclaration: { reviewed_independently: true, conflict_of_interest: false, chinese_proficiency_confirmed: true },
        overallVerdict: overallVerdict as "approve" | "revise" | "reject",
        confidence: Number(confidence),
        candidateBandAssessments: bands as Parameters<typeof makeMissionExpertReviewSubmission>[0]["candidateBandAssessments"],
        lineageClaimAssessments: claims as Parameters<typeof makeMissionExpertReviewSubmission>[0]["lineageClaimAssessments"],
        rationaleKo: rationale,
      });
      const { data, error } = await db.from("mission_expert_reviews").insert({
        assignment_id: submission.assignment_id,
        lineage_version_id: submission.lineage_version_id,
        reviewer_user_id: submission.reviewer_user_id,
        schema_version: submission.schema_version,
        protocol_version: submission.protocol_version,
        review_round: submission.review_round,
        independence_declaration: submission.independence_declaration,
        overall_verdict: submission.overall_verdict,
        confidence: submission.confidence,
        candidate_band_assessments: submission.candidate_band_assessments,
        rule_findings: submission.rule_findings,
        lineage_claim_assessments: submission.lineage_claim_assessments,
        rationale_ko: submission.rationale_ko,
      }).select("id,assignment_id,submitted_at,overall_verdict").single();
      if (error) throw error;
      setReviews((current) => [data as ReviewRow, ...current]);
      setMessage("독립 판정을 append-only로 제출했습니다. 다른 검토자의 판정은 계속 공개되지 않습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "전문가 판정 제출에 실패했습니다.");
    } finally { setSaving(false); }
  };

  const latestResolution = assignment
    ? resolutions
      .filter((item) => item.lineage_version_id === assignment.lineage_version_id && submitted && item.review_ids.includes(submitted.id))
      .sort((a, b) => b.resolution_revision - a.resolution_revision)[0] ?? null
    : null;
  const existingSignoff = latestResolution
    ? signoffs.find((item) => item.resolution_id === latestResolution.id) ?? null
    : null;

  const submitSignoff = async () => {
    if (!latestResolution || !reviewerId || !signoffDecision || !signoffRationale.trim() || preview) return;
    setSaving(true); setMessage(null);
    const { data, error } = await db.from("mission_review_resolution_signoffs").insert({
      resolution_id: latestResolution.id,
      reviewer_user_id: reviewerId,
      decision: signoffDecision,
      rationale_ko: signoffRationale.trim(),
    }).select("id,resolution_id,decision,signed_at").single();
    setSaving(false);
    if (error) setMessage(error.message);
    else {
      setSignoffs((current) => [data as SignoffRow, ...current]);
      setMessage("resolution sign-off를 append-only로 제출했습니다.");
    }
  };

  const signOut = async () => { if (!preview) await supabase.auth.signOut(); window.location.assign("/"); };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B]"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"><HomeBrand /><div className="flex items-center gap-4"><Link to={preview ? "/prototype/expert-gold-reviews" : "/expert/gold-reviews"} className="text-sm text-[#AAB8C2] hover:text-white">Gold 검토</Link><button onClick={signOut} className="flex items-center gap-2 text-sm text-[#AAB8C2]"><LogOut className="h-4 w-4" /> 나가기</button></div></div></header>
      <main className="mx-auto max-w-7xl px-6 py-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3"><span className="w-[5px] rounded bg-[#FAD338]" /><div><h1 className="text-3xl font-bold">Blind Expert Review</h1><p className="mt-1 text-sm text-muted-foreground">중국어 문장 대역과 AI provenance claim을 서로 독립적으로 판정합니다.</p></div></div>
          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700"><EyeOff className="mr-1 h-3.5 w-3.5" /> peer review 비공개</Badge>
        </div>

        <section className="mt-5 rounded-xl border border-[#E5CF72] bg-[#FFF9DF] p-4 text-sm leading-6 text-[#665515]">
          제출 전에는 다른 검토자의 결과를 볼 수 없습니다. `uncertain`도 유효한 판정이며, 불확실성을 억지 합의로 바꾸지 않습니다. 제출된 행은 수정·삭제하지 않습니다.
        </section>

        {loading ? <p className="mt-8 text-sm text-muted-foreground">배정 목록을 불러오는 중…</p> : assignments.length === 0 ? (
          <section className="mt-6 rounded-xl border border-dashed border-border p-10 text-center"><p className="text-sm text-muted-foreground">현재 배정된 검토가 없습니다.</p></section>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">My queue</p>
              <div className="mt-3 space-y-2">
                {assignments.map((item, index) => {
                  const done = reviews.some((review) => review.assignment_id === item.id);
                  return <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-lg border p-3 text-left ${selectedId === item.id ? "border-[#D6AD00] bg-[#FFF8D1]" : "border-border"}`}><div className="flex justify-between"><span className="font-mono text-xs">MISSION-{String(index + 1).padStart(2, "0")}</span><Badge variant="outline" className={done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>{done ? "제출 완료" : "대기"}</Badge></div><p className="mt-2 text-xs text-muted-foreground">round {item.review_round} · {item.protocol_version}</p></button>;
                })}
              </div>
            </aside>

            {assignment && lineage && <div className="space-y-5">
              <section className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-xs text-muted-foreground">lineage {lineage.id.slice(0, 8)}… · round {assignment.review_round}</p><h2 className="mt-1 text-xl font-semibold">목표어 문장 {lineage.item_lineage.claims.length}개 전수 판정</h2></div><Badge variant="outline">pack v{lineage.item_lineage.realization_pack_version}</Badge></div>
                {submitted && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline h-4 w-4" />{new Date(submitted.submitted_at).toLocaleString("ko-KR")} 제출 완료 · {submitted.overall_verdict}</p>}
              </section>

              {!submitted && lineage.item_lineage.claims.map((claim: ItemLineageClaim, index) => {
                const text = resolveExpertReviewTargetText(lineage.mission_content, claim.target_path);
                const claimDraft = claims[claim.claim_id];
                return <article key={claim.claim_id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#15202B] text-xs font-semibold text-white">{index + 1}</span><div className="min-w-0"><p className="font-mono text-xs text-muted-foreground">{claim.claim_id} · {claim.target_path}</p><p className="mt-2 text-lg leading-8" lang="zh">{text ?? "대상 문장을 찾을 수 없음"}</p></div></div>
                  <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs leading-5"><p><strong>모델 주장:</strong> rule [{claim.rule_ids.join(", ") || "없음"}] · risk [{claim.risk_ids.join(", ") || "없음"}]</p><p className="mt-1 text-muted-foreground">{claim.note_ko}</p></div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium">독립 band 판정<Select value={bands[claim.claim_id]?.band_code ?? ""} onValueChange={(value) => setBands((current) => ({ ...current, [claim.claim_id]: { ...current[claim.claim_id], band_code: value } }))}><SelectTrigger className="mt-2"><SelectValue placeholder="대역 선택" /></SelectTrigger><SelectContent>{BAND_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label>
                    <label className="text-sm font-medium">band 판정 근거<Textarea className="mt-2 min-h-[76px]" value={bands[claim.claim_id]?.rationale_ko ?? ""} onChange={(event) => setBands((current) => ({ ...current, [claim.claim_id]: { ...current[claim.claim_id], rationale_ko: event.target.value } }))} /></label>
                    <label className="text-sm font-medium">provenance 판정<Select value={claimDraft?.verdict ?? ""} onValueChange={(value) => setClaims((current) => ({ ...current, [claim.claim_id]: { ...current[claim.claim_id], verdict: value as ClaimDraft["verdict"], proposed_rule_ids: [], proposed_risk_ids: [] } }))}><SelectTrigger className="mt-2"><SelectValue placeholder="claim 판정" /></SelectTrigger><SelectContent>{CLAIM_VERDICTS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label>
                    <label className="text-sm font-medium">provenance 판정 근거<Textarea className="mt-2 min-h-[76px]" value={claimDraft?.rationale_ko ?? ""} onChange={(event) => setClaims((current) => ({ ...current, [claim.claim_id]: { ...current[claim.claim_id], rationale_ko: event.target.value } }))} /></label>
                  </div>
                  {claimDraft?.verdict === "revise" && <div className="mt-4 grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 md:grid-cols-2"><div><p className="text-xs font-semibold text-amber-900">대체 rule</p>{lineage.rule_scope_ids.map((id) => <label key={id} className="mt-2 flex items-center gap-2 text-xs"><Checkbox checked={claimDraft.proposed_rule_ids.includes(id)} onCheckedChange={(checked) => toggleId(claim.claim_id, "proposed_rule_ids", id, checked === true)} />{id}</label>)}</div><div><p className="text-xs font-semibold text-amber-900">대체 risk</p>{lineage.risk_scope_ids.map((id) => <label key={id} className="mt-2 flex items-center gap-2 text-xs"><Checkbox checked={claimDraft.proposed_risk_ids.includes(id)} onCheckedChange={(checked) => toggleId(claim.claim_id, "proposed_risk_ids", id, checked === true)} />{id}</label>)}</div></div>}
                </article>;
              })}

              {!submitted && <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-lg font-semibold">종합 판정과 독립성 선언</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">미션 종합 판정<Select value={overallVerdict} onValueChange={(value) => setOverallVerdict(value as typeof overallVerdict)}><SelectTrigger className="mt-2"><SelectValue placeholder="판정 선택" /></SelectTrigger><SelectContent><SelectItem value="approve">콘텐츠 승인</SelectItem><SelectItem value="revise">수정 필요</SelectItem><SelectItem value="reject">기각</SelectItem></SelectContent></Select></label><label className="text-sm font-medium">확신도<Select value={confidence} onValueChange={setConfidence}><SelectTrigger className="mt-2"><SelectValue placeholder="1~5" /></SelectTrigger><SelectContent>{[1,2,3,4,5].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></label></div>
                <label className="mt-4 block text-sm font-medium">종합 근거<Textarea className="mt-2 min-h-[90px]" value={rationale} onChange={(event) => setRationale(event.target.value)} /></label>
                <div className="mt-4 space-y-3 rounded-lg bg-muted/50 p-4 text-sm"><label className="flex items-start gap-3"><Checkbox checked={independent} onCheckedChange={(checked) => setIndependent(checked === true)} /><span>다른 검토자의 판정을 보지 않고 독립적으로 검토했습니다.</span></label><label className="flex items-start gap-3"><Checkbox checked={noConflict} onCheckedChange={(checked) => setNoConflict(checked === true)} /><span>이 미션·연구와 관련된 이해상충이 없습니다.</span></label><label className="flex items-start gap-3"><Checkbox checked={proficiency} onCheckedChange={(checked) => setProficiency(checked === true)} /><span>중국어 표현의 자연성과 화용 대역을 판정할 전문성을 확인합니다.</span></label></div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-xs leading-5 text-muted-foreground"><ShieldCheck className="mr-1 inline h-4 w-4" />모든 claim의 band와 provenance 판정이 완전해야 제출할 수 있습니다.</p><Button onClick={submit} disabled={!complete || saving || preview}><Save className="mr-2 h-4 w-4" />{preview ? "미리보기 · 저장 잠김" : saving ? "제출 중…" : "독립 판정 제출"}</Button></div>
                {message && <p role="status" className="mt-3 rounded-lg bg-muted p-3 text-sm">{message}</p>}
              </section>}

              {submitted && latestResolution?.resolution_status === "consensus_after_discussion" && <section className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
                <h2 className="text-lg font-semibold">Discussion resolution sign-off</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">revision {latestResolution.resolution_revision} · 최종 판정 {latestResolution.final_verdict}. 다른 전문가의 원 판정은 공개하지 않고, 해결안 자체에 동의하는지만 별도로 기록합니다.</p>
                <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm leading-6">{latestResolution.rationale_ko}</p>
                {existingSignoff ? <p className="mt-4 text-sm font-medium text-emerald-700"><CheckCircle2 className="mr-2 inline h-4 w-4" />{existingSignoff.decision} sign-off 제출 완료</p> : <div className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]"><Select value={signoffDecision} onValueChange={(value) => setSignoffDecision(value as typeof signoffDecision)}><SelectTrigger><SelectValue placeholder="해결안 동의 여부" /></SelectTrigger><SelectContent><SelectItem value="agree">동의</SelectItem><SelectItem value="disagree">동의하지 않음</SelectItem></SelectContent></Select><Textarea value={signoffRationale} onChange={(event) => setSignoffRationale(event.target.value)} placeholder="동의·이견 근거" /><div className="md:col-span-2 flex justify-end"><Button onClick={submitSignoff} disabled={!signoffDecision || !signoffRationale.trim() || saving || preview}>sign-off 제출</Button></div></div>}
              </section>}
            </div>}
          </div>
        )}
      </main>
    </div>
  );
};

export default ExpertReviewQueue;
