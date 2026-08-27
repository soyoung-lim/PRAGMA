import { supabase } from "@/integrations/supabase/client";
import type { ProfessorFindingDecision, ReviewInspection, ReviewTarget } from "../../../supabase/functions/_shared/contentReview";
export type ContentReviewApproval = { reviewId: string; contentHash: string; professorNote: string };

export async function contentReviewRequest(target: ReviewTarget, action = "inspect"): Promise<ReviewInspection> {
  const { data, error } = await supabase.functions.invoke("content-review", { body: { target, action } });
  if (error) {
    let message = "검수 서비스를 사용할 수 없습니다. 관리자 로그인과 content-review Edge·DB 배포 상태를 확인하세요.";
    if (error.context instanceof Response) {
      try { message = (await error.context.json())?.error || message; } catch { /* transport error */ }
    }
    throw new Error(message);
  }
  if (data?.error || !data?.contentHash) throw new Error(data?.error ?? "검수 응답이 올바르지 않습니다.");
  return data as ReviewInspection;
}
export async function approveContentReview(approval: ContentReviewApproval): Promise<void> {
  // New RPC pending generated type refresh; keep the exception local.
  const { error } = await (supabase as any).rpc("approve_content_review", {
    p_review_id: approval.reviewId, p_content_hash: approval.contentHash, p_note: approval.professorNote,
  });
  if (error) throw new Error(error.message);
}
export async function saveProfessorDecisions(reviewId: string, contentHash: string, decisions: ProfessorFindingDecision[]): Promise<void> {
  const { error } = await (supabase as any).rpc("save_content_review_decisions", {
    p_review_id: reviewId, p_content_hash: contentHash, p_decisions: decisions,
  });
  if (error) throw new Error(error.message);
}
