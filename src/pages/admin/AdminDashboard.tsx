import { AdminShell } from "@/components/AdminShell";

const SkeletonCard = ({ label }: { label: string }) => (
  <div className="rounded-xl border border-border bg-card p-5">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-3 text-2xl font-semibold text-muted-foreground/40">—</p>
    <p className="mt-2 text-[11px] text-muted-foreground/60">후속 단계(1A-2)에서 실데이터 연결</p>
  </div>
);

const AdminDashboard = () => (
  <AdminShell
    title="대시보드"
    description="운영 현황 요약 — 카운트와 차트는 후속 단계에서 연결됩니다."
  >
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SkeletonCard label="생성된 시나리오" />
      <SkeletonCard label="검수 대기" />
      <SkeletonCard label="승인 완료" />
      <SkeletonCard label="강의 공개" />
    </div>
  </AdminShell>
);

export default AdminDashboard;