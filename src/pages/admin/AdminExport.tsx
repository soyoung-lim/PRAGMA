import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";

const PendingBadge = () => (
  <Badge
    variant="outline"
    className="border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
  >
    준비 중
  </Badge>
);

const Page = () => (
  <AdminShell
    title="연구 데이터 관리"
    description="연구 참여 동의, 익명화, 데이터 완전성과 내보내기 이력을 한곳에서 관리합니다."
  >
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-base font-semibold">연구 진행 상태</h2>
      <PendingBadge />
    </div>

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">실증 데이터 준비 상태</h3>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["수행 기록 저장", "구현됨"],
              ["관리자 개별 기록 조회", "구현됨"],
              ["학습자 미션 수행 기록", "구현됨"],
              ["집단 분석", "로그 축적 후 활성화"],
              ["실증 대상 규모", "9월 학부 수업 40명 내외"],
            ].map(([label, value]) => (
              <tr key={label} className="border-b border-border/50 last:border-0">
                <td className="py-2 pr-4 text-muted-foreground">{label}</td>
                <td className="py-2 text-right font-medium">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">연구 데이터 적격성</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          참여 동의, 익명 식별자, 완료 여부, 필수 응답과 결측 상태를 점검한 뒤 연구 포함·제외
          대상을 확정하는 영역입니다.
        </p>
        <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-center text-xs text-muted-foreground">
          적격성 규칙과 데이터 완전성 집계는 후속 단계에서 연결됩니다.
        </div>
      </div>
    </div>

    <div className="mt-6 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">연구용 데이터 내보내기</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            포함 기준과 익명화 점검을 통과한 학습·시나리오 데이터만 버전과 생성 이력을 남겨
            내보냅니다.
          </p>
        </div>
        <PendingBadge />
      </div>
    </div>
  </AdminShell>
);

export default Page;
