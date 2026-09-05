import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { contentReviewRequest } from "./contentReviewApi";
import { prepareContentReview, reviewStageLabel } from "./reviewPreparation";
import type { ReviewInspection, ReviewTarget } from "../../../supabase/functions/_shared/contentReview";

export type ReviewQueueEntry = {
  target: ReviewTarget; label: string;
  status: "waiting" | "running" | "ready" | "approved" | "held" | "stopped";
  message: string; inspection?: ReviewInspection;
};
type QueueSnapshot = { active: boolean; stopping: boolean; entries: ReviewQueueEntry[] };
let snapshot: QueueSnapshot = { active: false, stopping: false, entries: [] };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getSnapshot = () => snapshot;
const publish = (patch: Partial<QueueSnapshot>) => { snapshot = { ...snapshot, ...patch }; listeners.forEach((listener) => listener()); };
export const reviewTargetKey = (target: ReviewTarget) => `${target.kind}:${target.targetId}:${target.weekNo ?? 0}`;
export function useReviewPreparationQueue() { return useSyncExternalStore(subscribe, getSnapshot, getSnapshot); }
export function stopReviewPreparation() { if (snapshot.active) publish({ stopping: true }); }

// The queue survives route changes in this tab. Reload/close stops dispatching;
// completed stages remain on the server and a new explicit start reuses them.
export async function startReviewPreparation(targets: Array<{ target: ReviewTarget; label: string }>) {
  if (snapshot.active || !targets.length) return;
  const unique = [...new Map(targets.map((item) => [reviewTargetKey(item.target), item])).values()];
  publish({ active: true, stopping: false, entries: unique.map((item) => ({ ...item, status: "waiting", message: "대기" })) });
  let unsubscribe = () => {};
  const update = (index: number, patch: Partial<ReviewQueueEntry>) => publish({ entries: snapshot.entries.map((entry, i) => i === index ? { ...entry, ...patch } : entry) });
  try {
    const { data, error } = await supabase.auth.getSession();
    const actorId = data.session?.user.id;
    if (error || !actorId) throw new Error("관리자 로그인을 확인하고 다시 시작하세요.");
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== actorId) stopReviewPreparation();
    });
    unsubscribe = () => auth.subscription.unsubscribe();
    for (let index = 0; index < unique.length; index++) {
      if (snapshot.stopping) break;
      update(index, { status: "running", message: "현재 버전 확인" });
      try {
        const result = await prepareContentReview(unique[index].target, {
          request: contentReviewRequest, stopped: () => snapshot.stopping,
          onStage: (stage) => update(index, { message: reviewStageLabel(stage) }),
          onInspection: (inspection) => update(index, { inspection }),
        });
        update(index, result);
      } catch (cause) {
        update(index, { status: "held", message: cause instanceof Error ? cause.message : "검토 실패 · 자동 재시도하지 않습니다." });
      }
    }
  } catch (cause) {
    publish({ entries: snapshot.entries.map((entry) => ({ ...entry, status: "held", message: cause instanceof Error ? cause.message : "실행 실패" })) });
  } finally {
    unsubscribe();
    publish({ active: false, stopping: false, entries: snapshot.entries.map((entry) => entry.status === "waiting" ? { ...entry, status: "stopped", message: "시작 전 중단" } : entry) });
  }
}
