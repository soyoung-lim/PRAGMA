import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { stopReviewPreparation, useReviewPreparationQueue, reviewTargetKey } from "@/lib/pragma/reviewPreparationQueue";

export function ReviewPreparationStatus() {
  const queue = useReviewPreparationQueue();
  if (!queue.entries.length) return null;
  const finished = queue.entries.filter((entry) => !["waiting", "running"].includes(entry.status)).length;
  return <section aria-label="AI 검토 진행" className="mb-4 rounded-xl border border-[#D8D3C4] bg-[#FCFBF6] p-4 text-sm print:hidden">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="font-semibold">AI 검토 {queue.active ? "진행 중" : "실행 결과"} · {finished}/{queue.entries.length}건</p>
      {queue.active && <Button size="sm" variant="outline" disabled={queue.stopping} onClick={stopReviewPreparation}>{queue.stopping ? "현재 호출 완료 후 중단" : "이후 실행 중단"}</Button>}
    </div>
    <p className="mt-1 text-xs text-muted-foreground">화면을 이동해도 계속됩니다. 이 탭을 닫거나 새로고침하면 이후 실행이 멈춥니다. 완료된 검토는 서버에 보존되며, 교수자 승인은 별도로 합니다.</p>
    <details className="mt-2" open={queue.entries.length <= 3 || undefined}><summary className="cursor-pointer">건별 결과 보기</summary>
      <ul className="mt-2 max-h-60 space-y-2 overflow-auto">{queue.entries.map((entry) => <li key={reviewTargetKey(entry.target)} className="flex flex-wrap gap-x-3 gap-y-1 border-t pt-2">
        <Link className="font-medium underline" to={entry.target.kind === "mission" ? `/admin/review?scenarioId=${entry.target.targetId}` : `/admin/package?courseId=${entry.target.targetId}&weekNo=${entry.target.weekNo}`}>{entry.label}</Link>
        <span className={entry.status === "held" ? "text-amber-800" : "text-muted-foreground"}>{entry.message}</span>
      </li>)}</ul>
    </details>
  </section>;
}
