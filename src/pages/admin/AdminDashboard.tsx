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
import { isMissionReleasedForLearner } from "@/lib/mission/missionRelease";
import { toast } from "sonner";

type CountState = { value: number | null; error: string | null; loading: boolean };
const initial: CountState = { value: null, error: null, loading: true };

// content_format·mission_status 컬럼과 curriculum_week_scenarios는 아직 생성 타입(types.ts)에
// 없다 — AdminBrowser·composer.ts와 동일한 우회. types 재생성 시 함께 정리한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any };

const LiveBadge = () => (
  <Badge
    variant="outline"
    className="gap-1.5 whitespace-nowrap border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
  >
    <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
    DB 실시간
  </Badge>
);
// 아직 가동하지 않는 단계의 계수 — 0을 "구현됨"으로 오해하지 않도록 배지로 구분한다.
const PendingBadge = () => (
  <Badge
    variant="outline"
    className="whitespace-nowrap border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
  >
    미가동
  </Badge>
);

// 카드마다 「DB 실시간」을 반복하면 라벨과 배지가 서로 밀어내 두 줄로 접힌다
// (좁은 5열에서 "시나리오 코/어", "DB 실시/간"). 실시간 여부는 섹션 헤더가 이미
// 말하므로, 카드 배지는 **그 섹션의 기본과 다를 때만** 단다(미가동 등).
const StatCard = ({
  label,
  state,
  badge,
  note,
}: {
  label: string;
  state: CountState;
  badge?: React.ReactNode;
  note?: string;
}) => (
  <div className="flex flex-col rounded-xl border border-border bg-card p-5">
    {/* 라벨은 항상 한 줄 전체를 쓴다 — 배지를 옆에 두면 좁은 열에서 라벨이 잘린다 */}
    <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
    <p className="mt-3 text-[30px] font-semibold leading-none tabular-nums">
      {state.loading ? (
        <span className="text-muted-foreground">…</span>
      ) : state.error ? (
        <span className="text-base font-normal text-destructive">확인 필요</span>
      ) : (
        state.value ?? 0
      )}
    </p>
    {/* note와 배지를 같은 줄에 둔다. note가 없는 카드도 높이를 유지해 행이 어긋나지 않게. */}
    <div className="mt-2 flex min-h-[22px] items-center justify-between gap-2">
      <span className="truncate text-[11px] text-muted-foreground">{note ?? ""}</span>
      {badge && <span className="shrink-0">{badge}</span>}
    </div>
    {state.error && <p className="mt-1 text-[11px] text-destructive">{state.error}</p>}
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

  // 분리 계수 (생성계약 0-g·46 → 0-q·101) — 코어·미션·검수·검토·실행가능을 한 숫자로 합치지 않는다.
  const [coreN, setCoreN] = useState<CountState>(initial);
  const [legacyN, setLegacyN] = useState<CountState>(initial);
  const [missionGenN, setMissionGenN] = useState<CountState>(initial);
  const [reviewedN, setReviewedN] = useState<CountState>(initial);
  const [runnableN, setRunnableN] = useState<CountState>(initial);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("is_admin");
      setIsAdmin(Boolean(data));
    })();

    const load = async (
      set: (s: CountState) => void,
      run: () => PromiseLike<{ count: number | null; error: unknown }>,
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

    // head:true 카운트는 권한 거부(401)를 삼키고 0을 돌려준다 — 보고용 수치가 "0건"으로
    // 조용히 거짓말하지 않도록 분리 계수는 본문 응답을 받아 실패가 드러나게 한다.
    load(setCoreN, () =>
      db
        .from("scenarios")
        .select("scenario_id", { count: "exact" })
        .eq("content_format", "scenario_core_v1"),
      "scenarios.core_v1",
    );
    load(setLegacyN, () =>
      db
        .from("scenarios")
        .select("scenario_id", { count: "exact" })
        .eq("content_format", "legacy_v1"),
      "scenarios.legacy_v1",
    );
    load(setMissionGenN, () =>
      db
        .from("scenarios")
        .select("scenario_id", { count: "exact" })
        .not("mission_status", "is", null),
      "scenarios.mission_any",
    );
    load(setReviewedN, () =>
      db
        .from("scenarios")
        .select("scenario_id", { count: "exact" })
        .eq("mission_status", "reviewed"),
      "scenarios.mission_reviewed",
    );

    // 실행 가능 = authoritative released 또는 legacy reviewed ∩ 주차 배정.
    (async () => {
      try {
        const [rev, asg] = await Promise.all([
          db.from("scenarios").select("scenario_id,mission_status,release_gate_mode").in("mission_status", ["reviewed", "released"]),
          db.from("curriculum_week_scenarios").select("scenario_id"),
        ]);
        if (rev.error) throw rev.error;
        if (asg.error) throw asg.error;
        const assigned = new Set(
          ((asg.data ?? []) as { scenario_id: string }[]).map((r) => r.scenario_id),
        );
        const n = ((rev.data ?? []) as { scenario_id: string; mission_status: string; release_gate_mode: string | null }[]).filter((r) =>
          assigned.has(r.scenario_id) && isMissionReleasedForLearner(r),
        ).length;
        setRunnableN({ value: n, error: null, loading: false });
      } catch (e) {
        console.error("[dashboard] runnable count failed:", e);
        setRunnableN({
          value: null,
          error: (e as { message?: string })?.message ?? "조회 실패",
          loading: false,
        });
      }
    })();
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
  // 검증②(AI 품질점검)는 아직 파이프라인에 없다 — 0을 정직하게 표기한다(0-q·99·101).
  const aiCheckN: CountState = { value: 0, error: null, loading: false };

  return (
    <AdminShell
      title="운영 대시보드"
      description="콘텐츠 생성부터 검수·편성·학습자 실행까지, 지금 확인하고 처리할 운영 현황을 보여줍니다."
    >
      {/* Row 0: 분리 계수 — 단계별 수량을 한 숫자로 합치지 않는다 (0-g·46 → 0-q·101) */}
      <SectionHeader title="콘텐츠 분리 계수" badge={<LiveBadge />} />
      {/* 1024~1280에서 5열이면 카드가 140px까지 좁아져 라벨이 잘린다 — 그 구간은 3열로. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="① 시나리오 코어" state={coreN} note="검색·편성 단위" />
        <StatCard label="② 미션 생성" state={missionGenN} note="검토 전 포함" />
        <StatCard
          label="③ AI 품질점검"
          state={aiCheckN}
          badge={<PendingBadge />}
          note="검증② 미구현"
        />
        <StatCard label="④ 교수자 검토 완료" state={reviewedN} note="reviewed" />
        <StatCard label="⑤ 실행 가능" state={runnableN} note="reviewed ∩ 주차 배정" />
      </div>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">
            &ldquo;500&rdquo;의 단위 = ① 시나리오 코어
          </span>{" "}
          — 교강사가 15주를 편성할 때 고르는 검색 단위이며, 완성된 학습 미션 수(②·④)와 다릅니다.
        </p>
        <p>
          legacy 시나리오 {legacyN.loading ? "…" : (legacyN.value ?? 0)}건은 위 계수에서 제외 ·
          주차별 수업 패키지 = 0 (미구현).
        </p>
      </div>

      {/* Row 1: 운영 현황 */}
      <SectionHeader title="운영 현황" badge={<LiveBadge />} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="전체 시나리오" state={total} note="legacy 포함 총계" />
        <StatCard label="검수 대기" state={pending} />
        <StatCard label="승인 완료" state={approved} />
        <StatCard label="학습자 수행 기록" state={traces} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        현재 승인 {approvedN}건 · 구조는 500개 수용 가능. 이 행은 코어·미션을 구분하지 않는 전체
        집계입니다 — 보고용 수치는 위 분리 계수를 사용하세요.
      </p>

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
