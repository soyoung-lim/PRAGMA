import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CountState = { value: number | null; error: string | null; loading: boolean };
const initial: CountState = { value: null, error: null, loading: true };

const LiveBadge = () => (
  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
    ● DB 실시간
  </Badge>
);
const ExampleBadge = () => (
  <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200">
    예시 레이아웃 · 로그 축적 후 활성화
  </Badge>
);

const StatCard = ({
  label,
  state,
}: {
  label: string;
  state: CountState;
}) => (
  <div className="rounded-xl border border-border bg-card p-5">
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">{label}</p>
      <LiveBadge />
    </div>
    <p className="mt-3 text-3xl font-semibold">
      {state.loading ? "…" : state.error ? (
        <span className="text-base font-normal text-destructive">확인 필요</span>
      ) : (
        state.value ?? 0
      )}
    </p>
    {state.error && (
      <p className="mt-1 text-[11px] text-destructive">{state.error}</p>
    )}
  </div>
);

// Placeholder chart primitives — pure CSS/SVG, gray skeletons.
const HBarSkeleton = ({ labels }: { labels: string[] }) => {
  const widths = [92, 78, 64, 50, 38];
  return (
    <div className="space-y-2.5">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-3">
          <div className="w-32 shrink-0 text-xs text-muted-foreground">{l}</div>
          <div className="h-4 flex-1 rounded bg-muted/50">
            <div
              className="h-full rounded bg-muted-foreground/25"
              style={{ width: `${widths[i] ?? 40}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const VBarSkeleton = ({ labels }: { labels: string[] }) => {
  const heights = [70, 55, 82, 40, 65, 48, 58, 72, 35];
  return (
    <div>
      <div className="flex h-40 items-end gap-2">
        {labels.map((l, i) => (
          <div key={l} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-muted-foreground/25"
              style={{ height: `${heights[i % heights.length]}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {labels.map((l) => (
          <div key={l} className="flex-1 text-center text-[10px] text-muted-foreground">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
};

const DonutSkeleton = ({ items }: { items: string[] }) => {
  const values = [35, 25, 22, 18];
  let cum = 0;
  const total = values.reduce((a, b) => a + b, 0);
  const R = 40;
  const C = 2 * Math.PI * R;
  const shades = ["#a3a3a3", "#bdbdbd", "#d4d4d4", "#e5e5e5"];
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
        {values.map((v, i) => {
          const frac = v / total;
          const dash = frac * C;
          const gap = C - dash;
          const offset = -cum;
          cum += dash;
          return (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={shades[i]}
              strokeWidth="14"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
            />
          );
        })}
      </svg>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        {items.map((it, i) => (
          <li key={it} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: shades[i] }}
            />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
};

const PlaceholderCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-border bg-card p-5">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold">{title}</h3>
      <span className="text-[10px] text-orange-700">예시</span>
    </div>
    {children}
    <p className="mt-3 text-[11px] text-muted-foreground">
      막대 높이·도넛 비율은 예시이며 실제 수치·순위가 아닙니다.
    </p>
  </div>
);

const SectionHeader = ({
  title,
  badge,
}: {
  title: string;
  badge: React.ReactNode;
}) => (
  <div className="mb-3 mt-8 flex items-center gap-3">
    <h2 className="text-base font-semibold">{title}</h2>
    {badge}
  </div>
);

const AdminDashboard = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [total, setTotal] = useState<CountState>(initial);
  const [pending, setPending] = useState<CountState>(initial);
  const [approved, setApproved] = useState<CountState>(initial);
  const [traces, setTraces] = useState<CountState>(initial);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("is_admin");
      setIsAdmin(Boolean(data));
    })();

    const load = async (
      set: (s: CountState) => void,
      run: () => Promise<{ count: number | null; error: unknown }>,
      label: string,
    ) => {
      try {
        const { count, error } = await run();
        if (error) throw error;
        set({ value: count ?? 0, error: null, loading: false });
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e);
        console.error(`[dashboard] ${label} count failed:`, e);
        set({ value: null, error: msg, loading: false });
      }
    };

    load(setTotal, () =>
      supabase.from("scenarios").select("*", { count: "exact", head: true }),
      "scenarios.total",
    );
    load(setPending, () =>
      supabase
        .from("scenarios")
        .select("*", { count: "exact", head: true })
        .eq("review_status", "needs_review"),
      "scenarios.needs_review",
    );
    load(setApproved, () =>
      supabase
        .from("scenarios")
        .select("*", { count: "exact", head: true })
        .eq("review_status", "approved"),
      "scenarios.approved",
    );
    load(setTraces, () =>
      supabase.from("decision_traces").select("*", { count: "exact", head: true }),
      "decision_traces.total",
    );
  }, []);

  const handleReset = async () => {
    setResetting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) {
        toast.error("로그인 정보가 없습니다.");
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .update({ profile_completed: false })
        .eq("user_id", uid)
        .select("user_id, profile_completed");
      if (error) throw error;
      console.log("[reset-profile] updated rows:", data);
      toast.success("초기화됨. 로그아웃 후 다시 로그인하면 프로필 설정부터 시작합니다.");
      window.dispatchEvent(new Event("profile-changed"));
    } catch (e) {
      console.error("[reset-profile] failed:", e);
      toast.error("초기화 실패: " + (e as Error).message);
    } finally {
      setResetting(false);
    }
  };

  const approvedN = approved.value ?? 0;

  const speechActs = ["감사", "칭찬", "사과", "요청", "제안", "동의", "반대", "거절", "불만"];
  const errorTypes = [
    "직접성 조절 실패",
    "부담 완화 부족",
    "격식 오판",
    "의미·책임 추가",
    "관계 거리 오판",
  ];
  const pdrItems = ["P 오판", "D 오판", "R 오판", "복합 오판"];
  const failedChallenge = ["directness", "formality", "imposition"];

  return (
    <AdminShell
      title="대시보드"
      description="학습자 집단 현황 종합 분석 허브 — 운영 현황(실시간)과 집단 분석(로그 축적 후 활성화)."
    >
      {/* Row 1: 운영 현황 */}
      <SectionHeader title="운영 현황" badge={<LiveBadge />} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="전체 시나리오" state={total} />
        <StatCard label="검수 대기" state={pending} />
        <StatCard label="승인 완료" state={approved} />
        <StatCard label="학습자 수행 기록" state={traces} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        현재 승인 {approvedN}건 · 구조는 500개 수용 가능.
      </p>

      {/* Row 2: 학습자 집단 종합 분석 */}
      <SectionHeader title="학습자 집단 종합 분석" badge={<ExampleBadge />} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlaceholderCard title="고질적 오류 유형 Top 5">
          <HBarSkeleton labels={errorTypes} />
        </PlaceholderCard>
        <PlaceholderCard title="화행별 평균 판단 정확도">
          <VBarSkeleton labels={speechActs} />
        </PlaceholderCard>
      </div>

      {/* Row 3: P/D/R · 화용 진단 */}
      <SectionHeader title="P/D/R · 화용 진단" badge={<ExampleBadge />} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlaceholderCard title="P/D/R 판단 오류 분포">
          <DonutSkeleton items={pdrItems} />
        </PlaceholderCard>
        <PlaceholderCard title="failed_challenge 분포">
          <VBarSkeleton labels={failedChallenge} />
        </PlaceholderCard>
      </div>

      {/* Row 4: 연구 진행 상태 */}
      <SectionHeader title="연구 진행 상태" badge={null} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">실증 데이터 준비 상태</h3>
          <table className="w-full text-sm">
            <tbody>
              {[
                ["decision_traces 저장", "구현됨"],
                ["관리자 조회", "구현됨"],
                ["학습자 5단계 수행 기록", "구현됨"],
                ["집단 분석 차트", "로그 축적 후 활성화"],
                ["실증 대상 규모", "9월 학부 수업 40명 내외"],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-4 text-muted-foreground">{k}</td>
                  <td className="py-2 text-right font-medium">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">다음 구현 우선순위</h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            <li>프로필 기반 수준·주차별 자동 배정(assignments)</li>
            <li>프롬프트 관리 → 생성 연결</li>
            <li>HSK 어휘 검증 로그(배치 확장 전 선행)</li>
            <li>배치 대량 확장(500 수용 구조 채우기)</li>
            <li>집단 분석 실데이터 연결(로그 40명 누적 시 차트 가동)</li>
          </ol>
        </div>
      </div>

      {/* Bottom: dev/test tools */}
      {isAdmin && (
        <div className="mt-10 flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3">
          <div className="text-sm">
            <p className="font-medium">개발/테스트 도구</p>
            <p className="text-xs text-muted-foreground">
              내 프로필을 미완료 상태로 되돌려 신규 온보딩 플로우를 재현합니다.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={resetting}>
                내 프로필 초기화 (테스트용)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>내 프로필을 초기화하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  내 프로필을 미완료 상태로 되돌립니다. 다음 로그인 때 프로필 설정 화면부터 다시
                  시작합니다. 계속할까요?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>계속</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </AdminShell>
  );
};

export default AdminDashboard;
