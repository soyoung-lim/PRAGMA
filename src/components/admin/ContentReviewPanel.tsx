import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { approveContentReview, contentReviewRequest, type ContentReviewApproval } from "@/lib/pragma/contentReviewApi";
import { CONTENT_REVIEW_STEPS, nextReviewStage, type ModelReview, type ReviewResult, type ReviewTarget } from "../../../supabase/functions/_shared/contentReview";

const verdictLabel = { pass: "지적 없음", warning: "확인 필요", fail: "수정 검토 필요" };
const decisionLabel = { accept: "수용", refine: "보완", reject: "기각" };

export function ContentReviewPanel({ target, onApprove, approvalDisabled = false, refreshKey = "", historicalApproval = false }: {
  target: ReviewTarget; onApprove?: (approval: ContentReviewApproval) => Promise<void>;
  approvalDisabled?: boolean; refreshKey?: string; historicalApproval?: boolean;
}) {
  const queryClient = useQueryClient();
  const key = ["content-review", target.kind, target.targetId, target.weekNo ?? 0, refreshKey];
  const query = useQuery({ queryKey: key, queryFn: () => contentReviewRequest(target), retry: false, staleTime: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const state = query.data;
  useEffect(() => { setConfirmed(false); setNote(""); }, [state?.contentHash]);
  const run = state?.run ?? null;
  const next = nextReviewStage(run);
  const stepIndex = next === "approved" ? 5 : CONTENT_REVIEW_STEPS.findIndex((step) => step.key === next);
  const locked = run?.running_stage && run.lease_until && Date.parse(run.lease_until) > Date.now();
  const blocked = run?.rules.verdict === "fail";
  const dependencyBlocked = state?.dependencies.some((item) => !item.approved);
  const ready = Boolean(state && next === "professor" && !dependencyBlocked && !blocked && !approvalDisabled);
  const runNext = async () => {
    setBusy(true); setError(null);
    try {
      if (next === "professor") {
        if (!run || !ready || !confirmed || note.trim().length < 10) return;
        const approval = { reviewId: run.id, contentHash: state!.contentHash, professorNote: note.trim() };
        await (onApprove ?? approveContentReview)(approval);
        await query.refetch();
      } else if (next !== "approved") {
        const result = await contentReviewRequest(target, next);
        queryClient.setQueryData(key, result);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "검수 처리 실패"); }
    finally { setBusy(false); }
  };
  return <section aria-label="콘텐츠 5단계 검수" className="my-4 space-y-4 rounded-xl border border-[#D8D3C4] bg-white p-4 text-sm">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="font-bold">현재 버전 검수</h3>
        <p className="mt-1 text-xs text-muted-foreground">{target.kind === "mission" ? "코어·MPJ5·DCT1 전체" : "편성 후 공통 수업자료·교수자 고유 메모"} · 수정하면 새 버전을 검수합니다.</p>
      </div>
      <Button size="sm" variant="outline" disabled={busy || query.isFetching} onClick={() => void query.refetch()}>결과 새로고침</Button>
    </div>
    <ol className="grid gap-2 sm:grid-cols-5">
      {CONTENT_REVIEW_STEPS.map((step, index) => <li key={step.key} aria-current={index === stepIndex ? "step" : undefined}
        className={`rounded-lg border p-2 text-xs ${index < stepIndex && state ? "border-emerald-200 bg-emerald-50" : index === stepIndex ? "border-[#D6B931] bg-[#FFF9D7]" : "bg-[#F8F7F3]"}`}>
        <strong>{index + 1}. {step.label}</strong>
        <span className="mt-1 block">{!state ? "확인 중" : index === 0 && blocked ? "오류 · 수정 필요" : index < stepIndex ? "실행 완료" : index === stepIndex ? "현재 단계" : "미실행"}</span>
      </li>)}
    </ol>
    {query.isPending && <p role="status">저장된 콘텐츠와 검수 이력을 확인하는 중…</p>}
    {query.isError && <p role="alert" className="text-red-800">{query.error.message}</p>}
    {state && <>
      <p className="text-xs text-muted-foreground">버전 {state.contentHash.slice(0, 12)} · 규칙 검사는 무료, AI 단계는 각각 유료 호출 1회입니다. 성공한 단계는 재호출하지 않습니다.</p>
      {!run && <p className="rounded-lg bg-amber-50 p-3">{state.history.length ? "내용 또는 기준이 달라져 재검토가 필요합니다. 이전 결과는 아래 이력에 보존됩니다." : historicalApproval ? "기존 교수자 승인은 유지됩니다. 이 버전의 5단계 검수 기록은 아직 없습니다." : "이 버전은 아직 검수하지 않았습니다. 규칙 검사부터 시작하세요."}</p>}
      {run && <>
        <ReviewFindings title="1. 규칙 검사" result={run.rules} />
        {run.openai_review && <ReviewFindings title="2. OpenAI 검수" result={run.openai_review.result} metadata={run.openai_review} />}
        {run.claude_review && <div className="space-y-3 rounded-lg border p-3">
          <h4 className="font-semibold">3. Claude 원문 · 4. OpenAI 재검토</h4>
          <p>{run.claude_review.result.summary_ko}</p>
          <p className="text-xs text-muted-foreground">{run.claude_review.model} · {run.claude_review.checked_at}</p>
          {!run.claude_review.result.findings.length && <p>Claude 지적 없음. OpenAI 재검토 단계도 별도로 기록합니다.</p>}
          {run.claude_review.result.findings.map((finding) => {
            const decision = run.adjudication?.result.decisions.find((item) => item.finding_id === finding.id);
            return <div key={finding.id} className="grid gap-3 rounded border p-3 md:grid-cols-2">
              <div><strong>Claude · {finding.issue_ko}</strong><p className="mt-1">{finding.reason_ko}</p>
                {finding.quote && <blockquote className="my-2 border-l-2 pl-2">{finding.quote}</blockquote>}
                <p className="text-xs">제안: {finding.suggestion_ko}</p><code className="break-all text-[10px]">{finding.where}</code></div>
              <div className="rounded bg-[#F8F7F3] p-3">{decision ? <>
                <strong>OpenAI · {decisionLabel[decision.decision]}{decision.needs_professor ? " · 교수자 확인 필요" : ""}</strong>
                <p className="mt-1">{decision.rationale_ko}</p>
                {decision.proposed_change_ko && <p className="mt-2 text-xs">제안: {decision.proposed_change_ko}</p>}
                {decision.evidence_quote && <blockquote className="mt-2 border-l-2 pl-2">{decision.evidence_quote}</blockquote>}
              </> : "OpenAI 재검토 전"}</div>
            </div>;
          })}
          {run.adjudication && <p className="text-xs">{run.adjudication.result.summary_ko} · {run.adjudication.model}</p>}
          <p className="text-xs text-muted-foreground">수용·보완은 수정 제안이며 자동 수정되지 않습니다. 기각된 지적도 교수자에게 그대로 표시됩니다.</p>
        </div>}
      </>}
      {state.dependencies.length > 0 && <div className="rounded-lg border p-3"><h4 className="font-semibold">재사용 미션 해설</h4>
        <p className="mt-1 text-xs">주차 자료 승인 전 연결 미션의 현재 버전 검수도 완료해야 합니다. 같은 해설을 출력 형식별로 중복 감사하지 않습니다.</p>
        <ul className="mt-2 space-y-1">{state.dependencies.map((item, index) => <li key={item.id}><Link className="underline" to={`/admin/review?scenarioId=${item.id}`}>미션 {index + 1} 검수</Link> · {item.approved ? "현재 버전 승인" : "검수 필요"}</li>)}</ul>
      </div>}
      {blocked && <p className="text-red-800">규칙 오류를 수정·저장해야 AI 검수를 진행할 수 있습니다. 원본은 자동으로 수정하지 않습니다.</p>}
      {run?.last_error && <p role="alert" className="text-red-800">직전 실행: {run.last_error} 재시도에는 비용이 다시 발생할 수 있습니다.</p>}
      {locked && <p role="status">{run?.running_stage} 실행 중입니다. 결과를 새로고침하세요. 응답이 없으면 실행 잠금 만료 후 수동 재시도할 수 있습니다.</p>}
      {next === "professor" && <div className="space-y-2 border-t pt-3">
        <h4 className="font-semibold">5. 교수자 승인</h4>
        <p className="text-xs">양쪽 지적을 확인하고, 수정하지 않는 지적이 있다면 승인 근거에 설명하세요. 내용 수정이 필요하면 먼저 수정·저장한 후 새 버전을 검수합니다.</p>
        {onApprove && <p className="text-xs text-muted-foreground">미션 승인 시 기존 근거 귀속·최종화 API가 추가 실행됩니다.</p>}
        <Textarea aria-label="교수자 승인 근거" value={note} onChange={(event) => setNote(event.target.value)} placeholder="수업 사용 적합성과 남은 지적에 대한 교수자 판단을 10자 이상 기록하세요." />
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />현재 원본·OpenAI·Claude·재검토 결과를 확인했습니다.</label>
        {approvalDisabled && <p className="text-amber-800">저장하지 않은 수정 또는 기존 결함의 교수자 판단 근거를 먼저 확인하세요.</p>}
      </div>}
      {next !== "approved" && <Button disabled={busy || query.isFetching || Boolean(locked) || blocked || (next === "claude" && !state.models.claude)
        || (next === "professor" && (!ready || !confirmed || note.trim().length < 10))} onClick={() => void runNext()}>
        {busy ? "처리 중…" : next === "rules" ? "규칙 검사 시작 · 무료" : next === "professor" ? "교수자 승인·확정" : `${CONTENT_REVIEW_STEPS[stepIndex].label} 실행 · 유료`}
      </Button>}
      {next === "claude" && !state.models.claude && <p className="text-amber-800">Claude 감사 모델이 설정되지 않았습니다. 운영 환경의 CLAUDE_AUDIT_MODEL을 먼저 설정해야 합니다.</p>}
      {next === "approved" && <p className="rounded bg-emerald-50 p-3">현재 버전 교수자 승인 · {run?.approved_at}<span className="mt-1 block">{run?.professor_note}</span></p>}
      <details><summary className="cursor-pointer text-xs">검수 대상 원본·이력</summary>
        <p className="my-2 text-xs">현재 정적 콘텐츠 원본을 검수합니다. 개별 학습자 실시간 피드백을 전수 감사했다는 뜻은 아닙니다.</p>
        <pre className="max-h-72 overflow-auto rounded bg-[#F7F7F5] p-3 text-[11px]">{JSON.stringify(state.snapshot, null, 2)}</pre>
        <ul className="mt-2 space-y-1 text-xs">{state.history.map((item) => <li key={item.id}>{item.created_at} · {item.content_hash.slice(0, 12)} · {item.approved_at ? "당시 승인" : "검수 이력"}</li>)}</ul>
      </details>
    </>}
    {error && <p role="alert" className="text-red-800">{error}</p>}
  </section>;
}

function ReviewFindings({ title, result, metadata }: { title: string; result: ReviewResult; metadata?: ModelReview<ReviewResult> }) {
  return <details open={result.findings.length > 0} className="rounded-lg border p-3">
    <summary className="cursor-pointer font-semibold">{title} · {verdictLabel[result.verdict]} · {result.findings.length}건</summary>
    <p className="mt-2">{result.summary_ko}</p>
    {metadata && <p className="mt-1 text-xs text-muted-foreground">{metadata.model} · {metadata.checked_at}</p>}
    <ul className="mt-2 space-y-3">{result.findings.map((finding) => <li key={finding.id} className="border-t pt-2">
      <strong>{finding.issue_ko}</strong><p>{finding.reason_ko}</p>
      {finding.quote && <blockquote className="my-1 border-l-2 pl-2">{finding.quote}</blockquote>}
      <p className="text-xs">제안: {finding.suggestion_ko}</p>
    </li>)}</ul>
  </details>;
}
