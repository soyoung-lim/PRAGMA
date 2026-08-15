import { useEffect, useMemo, useState } from "react";
import { EyeOff, Save, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { HomeBrand } from "@/components/HomeBrand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  BlindGoldCaseSnapshotSchema,
  makeGoldExpertReview,
  type BlindGoldCaseSnapshot,
} from "@/lib/pragma/goldExpertReview";

type AssignmentRow = {
  id: string;
  calibration_resolution_id: string;
  reviewer_user_id: string;
  review_round: number;
  blind_review: true;
  protocol_version: "gold_expert_review_protocol_v1";
  blind_case_snapshot: BlindGoldCaseSnapshot;
  assigned_at: string;
};
type ReviewRow = { id: string; assignment_id: string; overall_verdict: string; submitted_at: string };
type ResolutionRow = { id: string; review_ids: string[]; resolution_method: string; final_status: string; rationale_ko: string; resolved_at: string };
type SignoffRow = { id: string; resolution_id: string; decision: "agree" | "disagree" };
type CandidateId = "A" | "B" | "C";
type CandidateDraft = { assessed_band_code: string; semantic_fidelity: "" | "pass" | "fail"; rationale_ko: string };

const BANDS = [
  ["too_direct", "과도하게 직접적"], ["within_band", "맥락에 적정"],
  ["too_indirect", "과도하게 간접적"], ["too_blunt", "과도하게 단정적"],
  ["over_elaborate", "과도하게 장황함"], ["insufficient", "강도 부족"],
  ["excessive", "강도 과도"],
] as const;
const SPEECH_ACT_LABELS: Record<string, string> = { request: "요청", refusal: "거절", thanks: "감사", apology: "사과", suggestion: "제안", complaint: "불평", compliment: "칭찬", agreement: "동의", disagreement: "반대" };
const POWER_LABELS: Record<string, string> = { higher: "상대방의 지위가 더 높음", equal: "지위가 비슷함", lower: "상대방의 지위가 더 낮음" };
const DISTANCE_LABELS: Record<string, string> = { close: "가까운 사이", acquaintance: "아는 사이", stranger: "낯선 사이" };
const BURDEN_LABELS: Record<string, string> = { low: "부담이 작음", medium: "부담이 보통", high: "부담이 큼" };
const RESOLUTION_METHOD_LABELS: Record<string, string> = { unanimous: "두 판단이 처음부터 일치", consensus_after_discussion: "의견을 나눈 뒤 합의", researcher_decision: "논문 저자 결정", unresolved: "아직 미해결" };
const FINAL_STATUS_LABELS: Record<string, string> = { approved: "승인", revise: "수정 후 재검토", revised: "수정 후 재검토", rejected: "제외", unresolved: "미해결" };
const emptyCandidate = (): CandidateDraft => ({ assessed_band_code: "", semantic_fidelity: "", rationale_ko: "" });
const emptyCandidates = (): Record<CandidateId, CandidateDraft> => ({ A: emptyCandidate(), B: emptyCandidate(), C: emptyCandidate() });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any };

const PREVIEW_USER = "30000000-0000-4000-8000-000000000071";
const PREVIEW_SNAPSHOT = BlindGoldCaseSnapshotSchema.parse({
  schema_version: "pragma_gold_expert_blind_case_v1",
  case_id: "GOLD-KOZH-REQ-003",
  version: "1.1.0",
  direction: "ko_zh",
  realization_pack_id: "pragma_ko_zh_core",
  realization_pack_version: "1.2.0",
  speech_act: "request",
  target_feature: "request_mitigation_optionality",
  level: "intermediate",
  domain: "school",
  mode: "translation",
  pdr: { power: "higher", distance: "acquaintance", burden: "high" },
  scenario_ko: "학생이 담당 교수에게 과제 마감일을 하루 연장해 달라고 이메일로 요청한다.",
  source_text_ko: "죄송하지만 과제 마감일을 하루 연장해 주실 수 있을까요?",
  preceding_turn_zh: null,
  semantic_invariant_ko: "교수에게 과제 마감일을 하루 연장해 달라고 요청한다.",
  candidates: [
    { candidate_id: "A", text_zh: "老师，把作业截止日期延长一天。" },
    { candidate_id: "B", text_zh: "老师，不好意思，想请问您能不能把作业截止日期延长一天？" },
    { candidate_id: "C", text_zh: "尊敬的老师，如果您方便考虑的话，不知道是否有可能酌情考虑一下延长一天呢？" },
  ],
});
const PREVIEW_ASSIGNMENT: AssignmentRow = {
  id: "10000000-0000-4000-8000-000000000071",
  calibration_resolution_id: "20000000-0000-4000-8000-000000000071",
  reviewer_user_id: PREVIEW_USER,
  review_round: 1,
  blind_review: true,
  protocol_version: "gold_expert_review_protocol_v1",
  blind_case_snapshot: PREVIEW_SNAPSHOT,
  assigned_at: "2026-08-15T00:00:00.000Z",
};

const ExpertGoldReviewQueue = ({ preview = false }: { preview?: boolean }) => {
  const [assignments, setAssignments] = useState<AssignmentRow[]>(preview ? [PREVIEW_ASSIGNMENT] : []);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [resolutions, setResolutions] = useState<ResolutionRow[]>([]);
  const [signoffs, setSignoffs] = useState<SignoffRow[]>([]);
  const [selectedId, setSelectedId] = useState(preview ? PREVIEW_ASSIGNMENT.id : "");
  const [reviewerId, setReviewerId] = useState(preview ? PREVIEW_USER : "");
  const [candidates, setCandidates] = useState(emptyCandidates);
  const [context, setContext] = useState({ scenario_valid: false, pdr_valid: false, semantic_invariant_valid: false });
  const [overall, setOverall] = useState<"" | "approve" | "revise" | "reject">("");
  const [rationale, setRationale] = useState("");
  const [independent, setIndependent] = useState(false);
  const [noConflict, setNoConflict] = useState(false);
  const [proficiency, setProficiency] = useState(false);
  const [loading, setLoading] = useState(!preview);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [signoffDecision, setSignoffDecision] = useState<"" | "agree" | "disagree">("");
  const [signoffRationale, setSignoffRationale] = useState("");

  useEffect(() => {
    if (preview) return;
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!active || !auth.user) { setLoading(false); return; }
      setReviewerId(auth.user.id);
      const [assignmentResult, reviewResult, resolutionResult, signoffResult] = await Promise.all([
        db.from("pragma_gold_expert_review_assignments").select("id,calibration_resolution_id,reviewer_user_id,review_round,blind_review,protocol_version,blind_case_snapshot,assigned_at").eq("reviewer_user_id", auth.user.id).order("assigned_at", { ascending: false }),
        db.from("pragma_gold_expert_reviews").select("id,assignment_id,overall_verdict,submitted_at").eq("reviewer_user_id", auth.user.id),
        db.from("pragma_gold_expert_resolutions").select("id,review_ids,resolution_method,final_status,rationale_ko,resolved_at").order("resolved_at", { ascending: false }),
        db.from("pragma_gold_expert_resolution_signoffs").select("id,resolution_id,decision").eq("reviewer_user_id", auth.user.id),
      ]);
      if (!active) return;
      const error = assignmentResult.error ?? reviewResult.error ?? resolutionResult.error ?? signoffResult.error;
      if (error) setMessage(error.message);
      else {
        const parsed = (assignmentResult.data ?? []).map((row: Record<string, unknown>) => ({
          ...row,
          blind_case_snapshot: BlindGoldCaseSnapshotSchema.parse(row.blind_case_snapshot),
        })) as AssignmentRow[];
        setAssignments(parsed);
        setReviews((reviewResult.data ?? []) as ReviewRow[]);
        setResolutions((resolutionResult.data ?? []) as ResolutionRow[]);
        setSignoffs((signoffResult.data ?? []) as SignoffRow[]);
        setSelectedId(parsed[0]?.id ?? "");
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [preview]);

  const selected = assignments.find((assignment) => assignment.id === selectedId) ?? null;
  const storedReview = reviews.find((review) => review.assignment_id === selectedId);
  const visibleResolution = useMemo(
    () => resolutions.find((resolution) => storedReview && resolution.review_ids.includes(storedReview.id)),
    [resolutions, storedReview],
  );
  const complete = selected && overall && rationale.trim() && independent && noConflict && proficiency
    && Object.values(context).every(Boolean)
    && Object.values(candidates).every((candidate) => candidate.assessed_band_code && candidate.semantic_fidelity && candidate.rationale_ko.trim());

  const submit = async () => {
    if (!selected || !reviewerId || !complete || preview) return;
    setSaving(true); setMessage(null);
    try {
      const review = makeGoldExpertReview({
        assignment_id: selected.id,
        calibration_resolution_id: selected.calibration_resolution_id,
        reviewer_user_id: reviewerId,
        review_round: selected.review_round,
        case_snapshot: selected.blind_case_snapshot,
        independence_declaration: { reviewed_independently: true, conflict_of_interest: false, chinese_proficiency_confirmed: true },
        context_assessment: context,
        candidate_assessments: candidates as Parameters<typeof makeGoldExpertReview>[0]["candidate_assessments"],
        overall_verdict: overall,
        rationale_ko: rationale,
      });
      const { data, error } = await db.from("pragma_gold_expert_reviews").insert({
        assignment_id: review.assignment_id,
        calibration_resolution_id: review.calibration_resolution_id,
        reviewer_user_id: review.reviewer_user_id,
        schema_version: review.schema_version,
        protocol_version: review.protocol_version,
        review_round: review.review_round,
        independence_declaration: review.independence_declaration,
        context_assessment: review.context_assessment,
        candidate_assessments: review.candidate_assessments,
        overall_verdict: review.overall_verdict,
        rationale_ko: review.rationale_ko,
      }).select("id,assignment_id,overall_verdict,submitted_at").single();
      if (error) throw error;
      setReviews((current) => [data as ReviewRow, ...current]);
      setMessage("독립 검토 결과를 제출했습니다. 제출 기록은 나중에 덮어쓰지 않습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "제출에 실패했습니다."); }
    finally { setSaving(false); }
  };

  const submitSignoff = async () => {
    if (!visibleResolution || !reviewerId || !signoffDecision || !signoffRationale.trim() || preview) return;
    setSaving(true);
    const { data, error } = await db.from("pragma_gold_expert_resolution_signoffs").insert({
      resolution_id: visibleResolution.id,
      reviewer_user_id: reviewerId,
      decision: signoffDecision,
      rationale_ko: signoffRationale,
    }).select("id,resolution_id,decision").single();
    if (error) setMessage(error.message);
    else { setSignoffs((current) => [data as SignoffRow, ...current]); setMessage("최종 해결안에 대한 의견을 저장했습니다."); }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-slate-900">
      <header className="bg-[#15202B] px-5 py-4"><div className="mx-auto flex max-w-5xl items-center justify-between"><HomeBrand /><Link to="/expert/reviews" className="text-sm text-slate-300 hover:text-white">AI 학습문항 확인으로 이동 →</Link></div></header>
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-7 sm:px-6">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-semibold text-amber-700">첫 번째 전문가 과제</p><h1 className="mt-1 text-2xl font-semibold">품질검사 기준답안 외부 확인</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">논문 저자가 작성한 대표 사례의 답과 근거가 타당한지 확인하는 단계입니다. 논문 저자의 답과 다른 전문가의 판단은 제출 전까지 보이지 않습니다.</p></div>
            <Badge className="gap-1 bg-slate-900 text-white"><EyeOff className="h-3.5 w-3.5" />독립·비공개 검토</Badge>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <label className="text-sm font-medium">내가 확인할 품질검사 사례</label>
          <Select value={selectedId} onValueChange={(value) => { setSelectedId(value); setCandidates(emptyCandidates()); setContext({ scenario_valid: false, pdr_valid: false, semantic_invariant_valid: false }); setOverall(""); setRationale(""); }}>
            <SelectTrigger className="mt-2"><SelectValue placeholder={loading ? "불러오는 중…" : "배정 없음"} /></SelectTrigger>
            <SelectContent>{assignments.map((assignment) => <SelectItem key={assignment.id} value={assignment.id}>{assignment.blind_case_snapshot.case_id} · {assignment.review_round}차 검토</SelectItem>)}</SelectContent>
          </Select>
        </section>

        {selected && <>
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="font-semibold">1. 대화 상황과 전달 의미 확인</h2>
            <div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline">화행: {SPEECH_ACT_LABELS[selected.blind_case_snapshot.speech_act] ?? selected.blind_case_snapshot.speech_act}</Badge><Badge variant="outline">관계: {POWER_LABELS[selected.blind_case_snapshot.pdr.power] ?? selected.blind_case_snapshot.pdr.power}</Badge><Badge variant="outline">친밀도: {DISTANCE_LABELS[selected.blind_case_snapshot.pdr.distance] ?? selected.blind_case_snapshot.pdr.distance}</Badge><Badge variant="outline">요청 부담: {BURDEN_LABELS[selected.blind_case_snapshot.pdr.burden] ?? selected.blind_case_snapshot.pdr.burden}</Badge></div>
            <p className="mt-2 text-sm">{selected.blind_case_snapshot.scenario_ko}</p>
            <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm"><p><b>한국어 원문</b> · {selected.blind_case_snapshot.source_text_ko}</p><p className="mt-2"><b>유지할 의미</b> · {selected.blind_case_snapshot.semantic_invariant_ko}</p></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">{([
              ["scenario_valid", "상황 설명이 자연스럽다"], ["pdr_valid", "지위·친밀도·부담 설정이 타당하다"], ["semantic_invariant_valid", "반드시 유지할 의미가 타당하다"],
            ] as const).map(([key, label]) => <label key={key} className="flex items-start gap-2 rounded-xl border p-3 text-sm"><Checkbox checked={context[key]} onCheckedChange={(checked) => setContext((current) => ({ ...current, [key]: checked === true }))} disabled={Boolean(storedReview)} /><span>{label}</span></label>)}</div>
          </section>

          <section className="space-y-3"><div><h2 className="font-semibold">2. 중국어 후보 A·B·C를 하나씩 판단</h2><p className="mt-1 text-sm text-slate-600">각 문장이 이 상황에서 얼마나 적절한지, 한국어 원문의 의미를 유지하는지와 그 이유를 적어 주세요.</p></div>{selected.blind_case_snapshot.candidates.map((candidate) => {
            const draft = candidates[candidate.candidate_id];
            return <article key={candidate.candidate_id} className="rounded-2xl border bg-white p-5"><div className="flex gap-3"><Badge>후보 {candidate.candidate_id}</Badge><p className="break-words text-lg leading-relaxed">{candidate.text_zh}</p></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Select value={draft.assessed_band_code} onValueChange={(value) => setCandidates((current) => ({ ...current, [candidate.candidate_id]: { ...current[candidate.candidate_id], assessed_band_code: value } }))} disabled={Boolean(storedReview)}><SelectTrigger><SelectValue placeholder="이 상황에서의 적절성 선택" /></SelectTrigger><SelectContent>{BANDS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Select value={draft.semantic_fidelity} onValueChange={(value: "pass" | "fail") => setCandidates((current) => ({ ...current, [candidate.candidate_id]: { ...current[candidate.candidate_id], semantic_fidelity: value } }))} disabled={Boolean(storedReview)}><SelectTrigger><SelectValue placeholder="원문의 의미 유지 여부" /></SelectTrigger><SelectContent><SelectItem value="pass">핵심 의미를 유지함</SelectItem><SelectItem value="fail">의미가 달라지거나 빠짐</SelectItem></SelectContent></Select></div><Textarea className="mt-3" value={draft.rationale_ko} onChange={(event) => setCandidates((current) => ({ ...current, [candidate.candidate_id]: { ...current[candidate.candidate_id], rationale_ko: event.target.value } }))} placeholder="왜 그렇게 판단했는지 적어 주세요" disabled={Boolean(storedReview)} /></article>;
          })}</section>

          <section className="rounded-2xl border bg-white p-5">
            <h2 className="mb-3 font-semibold">3. 이 품질검사 사례 전체에 대한 종합판정</h2><div className="grid gap-3 md:grid-cols-2"><Select value={overall} onValueChange={(value: "approve" | "revise" | "reject") => setOverall(value)} disabled={Boolean(storedReview)}><SelectTrigger><SelectValue placeholder="사례 전체 결과 선택" /></SelectTrigger><SelectContent><SelectItem value="approve">기준답안으로 사용 가능</SelectItem><SelectItem value="revise">수정 후 다시 확인</SelectItem><SelectItem value="reject">품질검사 사례에서 제외</SelectItem></SelectContent></Select><Textarea value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="종합판정의 이유를 적어 주세요" disabled={Boolean(storedReview)} /></div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">{[
              [independent, setIndependent, "다른 판정을 보지 않고 독립 검토함"], [noConflict, setNoConflict, "이해상충이 없음"], [proficiency, setProficiency, "중국어 판정 전문성을 확인함"],
            ].map(([checked, setter, label]) => <label key={String(label)} className="flex gap-2"><Checkbox checked={checked as boolean} onCheckedChange={(value) => (setter as (value: boolean) => void)(value === true)} disabled={Boolean(storedReview)} /><span>{String(label)}</span></label>)}</div>
            <Button className="mt-5 gap-2" disabled={!complete || saving || preview || Boolean(storedReview)} onClick={submit}><Save className="h-4 w-4" />{storedReview ? "제출 완료" : "내 독립판정 제출"}</Button>
          </section>

          {visibleResolution && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700" /><h2 className="font-semibold">두 전문가의 최종 해결안</h2></div><p className="mt-2 text-sm">{FINAL_STATUS_LABELS[visibleResolution.final_status] ?? visibleResolution.final_status} · {RESOLUTION_METHOD_LABELS[visibleResolution.resolution_method] ?? visibleResolution.resolution_method}</p><p className="mt-1 text-sm text-slate-700">{visibleResolution.rationale_ko}</p>{visibleResolution.resolution_method === "consensus_after_discussion" && !signoffs.some((item) => item.resolution_id === visibleResolution.id) && <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]"><Select value={signoffDecision} onValueChange={(value: "agree" | "disagree") => setSignoffDecision(value)}><SelectTrigger><SelectValue placeholder="해결안 동의 여부" /></SelectTrigger><SelectContent><SelectItem value="agree">동의</SelectItem><SelectItem value="disagree">동의하지 않음</SelectItem></SelectContent></Select><Textarea value={signoffRationale} onChange={(event) => setSignoffRationale(event.target.value)} placeholder="동의하거나 반대하는 이유" /><Button onClick={submitSignoff} disabled={saving || preview || !signoffDecision || !signoffRationale.trim()}>의견 제출</Button></div>}</section>}
        </>}
        {message && <p className="rounded-xl border bg-white p-3 text-sm">{message}</p>}
        {preview && <p className="text-xs text-slate-500">미리보기 화면에서는 제출 기능이 잠겨 있습니다.</p>}
      </main>
    </div>
  );
};

export default ExpertGoldReviewQueue;
