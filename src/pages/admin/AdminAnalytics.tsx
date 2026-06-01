import { AdminShell } from "@/components/AdminShell";

const Page = () => (
  <AdminShell
    title="관리자 종합 분석"
    description="화행 단위 학습 성과와 운영 지표를 종합적으로 분석합니다."
  >
    <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
      관리자 종합 분석은 개인별 진단 정확도 검증이 아니라, 워크플로우가 산출한 학습 기록과 리포트 결과를 집단 단위로 요약하는 운영 분석 화면입니다.
    </div>
    <div className="mt-4 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <p className="text-sm text-muted-foreground">이 화면은 후속 단계에서 구현됩니다.</p>
    </div>
  </AdminShell>
);

export default Page;