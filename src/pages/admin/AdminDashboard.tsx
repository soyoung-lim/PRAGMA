import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  BookOpenCheck,
  CalendarDays,
  CircleCheckBig,
  Database,
  RefreshCw,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
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
import {
  DASHBOARD_ROW_CAP,
  DASHBOARD_REVIEW_CRITERIA_VERSION,
  dominantDashboardReviewStage,
  summarizeDashboardAssignments,
  summarizeDashboardContent,
  summarizeDashboardReviewStages,
  type DashboardAssignmentRow,
  type DashboardReviewRunRow,
  type DashboardReviewQueueStage,
  type DashboardReviewStageCounts,
  type DashboardScenarioRow,
} from "@/lib/admin/adminDashboardMetrics";
import { toast } from "sonner";

// content_review_runs는 2026-08-27 migration 이후 생성 타입을 아직 재발행하지 않았다.
// 이 화면의 예외는 조회 전용이며 선택 컬럼을 DashboardReviewRunRow로 즉시 좁힌다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any };

type DashboardSnapshot = {
  content: ReturnType<typeof summarizeDashboardContent>;
  review: DashboardReviewStageCounts;
  assignments: ReturnType<typeof summarizeDashboardAssignments>;
  approvedLearnerCount: number;
  learnerRecordCount: number;
};

type DashboardMetricKey =
  | "core"
  | "mission"
  | "reviewTarget"
  | "finalized"
  | `review.${DashboardReviewQueueStage}`
  | "assignments"
  | "learners"
  | "records";

type Accent = "gold" | "navy" | "green";

const ACCENT_STYLES: Record<Accent, { bar: string; icon: string }> = {
  gold: { bar: "bg-[#D6B632]", icon: "bg-[#FFF5BE] text-[#796713]" },
  navy: { bar: "bg-[#49667E]", icon: "bg-[#EAF0F4] text-[#334E63]" },
  green: { bar: "bg-[#4E9C73]", icon: "bg-[#E8F5ED] text-[#317253]" },
};

function dashboardMetricValues(snapshot: DashboardSnapshot): Record<DashboardMetricKey, number> {
  return {
    core: snapshot.content.coreCount,
    mission: snapshot.content.generatedMissionCount,
    reviewTarget: snapshot.content.reviewTargetCount,
    finalized: snapshot.content.professorFinalizedCount,
    "review.rules": snapshot.review.rules,
    "review.openai": snapshot.review.openai,
    "review.claude": snapshot.review.claude,
    "review.adjudication": snapshot.review.adjudication,
    "review.professor": snapshot.review.professor,
    assignments: snapshot.assignments.missionCount,
    learners: snapshot.approvedLearnerCount,
    records: snapshot.learnerRecordCount,
  };
}

const SectionHeader = ({
  title,
  description,
  meta,
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
}) => (
  <div className="mb-2 mt-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {meta}
    </div>
    {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
  </div>
);

const MetricCard = ({
  to,
  label,
  value,
  unit,
  definition,
  error,
  icon: Icon,
  accent,
  changed = false,
}: {
  to: string;
  label: string;
  value: number | string | null;
  unit: string;
  definition: string;
  error: string | null;
  icon: LucideIcon;
  accent: Accent;
  changed?: boolean;
}) => (
  <Link
    to={to}
    className={[
      "group relative flex min-h-[116px] flex-col overflow-hidden rounded-lg border bg-card p-4 shadow-[0_1px_2px_rgba(21,32,43,0.04)]",
      "motion-safe:transition-all motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 hover:border-[#D6B84A] hover:shadow-md",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8AA2F]",
      changed ? "border-[#D6B84A] bg-[#FFFBE8] ring-2 ring-[#F4D85E]/35" : "border-border",
    ].join(" ")}
  >
    <span aria-hidden className={["absolute inset-x-0 top-0 h-0.5", ACCENT_STYLES[accent].bar].join(" ")} />
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <span className={["rounded-md p-1.5 motion-safe:transition-transform group-hover:scale-105", ACCENT_STYLES[accent].icon].join(" ")}>
        <Icon aria-hidden className="h-3.5 w-3.5" />
      </span>
    </div>
    <div className="mt-2 flex items-end gap-1.5">
      {value === null && !error ? (
        <span aria-label="불러오는 중" className="h-7 w-16 rounded bg-muted motion-safe:animate-pulse" />
      ) : (
        <span className="text-[28px] font-semibold leading-none tabular-nums">
          {error ? <span className="text-base font-normal text-destructive">확인 필요</span> : value}
        </span>
      )}
      {!error && value !== null && <span className="pb-0.5 text-xs text-muted-foreground">{unit}</span>}
    </div>
    <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{definition}</p>
  </Link>
);

const REVIEW_STAGE_CARDS = [
  { key: "rules", step: 1, label: "R 검사", definition: "규칙 검사 필요" },
  { key: "openai", step: 2, label: "OpenAI 1차", definition: "1차 검수 대기" },
  { key: "claude", step: 3, label: "Claude 교차", definition: "교차검수 대기" },
  { key: "adjudication", step: 4, label: "OpenAI 정리", definition: "지적별 판정 대기" },
  { key: "professor", step: 5, label: "교수자 최종 승인", definition: "최종 승인 대기" },
] as const;

const REVIEW_STAGE_LABELS = Object.fromEntries(
  REVIEW_STAGE_CARDS.map((stage) => [stage.key, stage.label]),
) as Record<DashboardReviewQueueStage, string>;

const ReviewPipeline = ({
  review,
  dominant,
  error,
  changedKeys,
}: {
  review: DashboardReviewStageCounts | null;
  dominant: DashboardReviewQueueStage | null;
  error: string | null;
  changedKeys: ReadonlySet<DashboardMetricKey>;
}) => (
  <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
    <span aria-hidden className="absolute left-[9%] right-[9%] top-[29px] hidden h-0.5 bg-gradient-to-r from-[#D6B632] via-[#49667E] to-[#4E9C73] opacity-45 xl:block" />
    {REVIEW_STAGE_CARDS.map((stage) => {
      const value = review?.[stage.key] ?? null;
      const active = dominant === stage.key;
      const changed = changedKeys.has(`review.${stage.key}`);
      return (
        <Link
          key={stage.key}
          to="/admin/review"
          className={[
            "group relative z-10 min-h-[112px] overflow-hidden rounded-lg border bg-card p-3.5 shadow-[0_1px_2px_rgba(21,32,43,0.04)]",
            "motion-safe:transition-all motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 hover:border-[#6D879B] hover:shadow-md",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49667E]",
            active ? "border-[#D6B84A] bg-[#FFFBE8] shadow-sm" : "border-border",
            changed ? "ring-2 ring-[#F4D85E]/40" : "",
          ].join(" ")}
        >
          <div className="flex items-center gap-2">
            <span className={[
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              active ? "bg-[#FAD338] text-[#15202B]" : "bg-[#EAF0F4] text-[#3D5A70]",
            ].join(" ")}>
              {stage.step}
            </span>
            <span className="text-xs font-semibold text-[#33414D]">{stage.label}</span>
          </div>
          <div className="mt-2 flex items-end gap-1.5">
            {value === null && !error ? (
              <span aria-label="불러오는 중" className="h-7 w-12 rounded bg-muted motion-safe:animate-pulse" />
            ) : (
              <span className="text-[27px] font-semibold leading-none tabular-nums">
                {error ? <span className="text-sm font-normal text-destructive">확인 필요</span> : value}
              </span>
            )}
            {!error && value !== null && <span className="pb-0.5 text-[11px] text-muted-foreground">개</span>}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{stage.definition}</p>
        </Link>
      );
    })}
  </div>
);

const LiveDatabaseStatus = ({
  lastUpdatedAt,
  refreshing,
  delayed,
  onRefresh,
}: {
  lastUpdatedAt: Date | null;
  refreshing: boolean;
  delayed: boolean;
  onRefresh: () => void;
}) => {
  const timeLabel = lastUpdatedAt?.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <div
      aria-live="polite"
      title="화면이 열려 있을 때 30초마다 운영 DB를 다시 확인합니다."
      className={[
        "inline-flex h-9 items-center gap-2 rounded-full border bg-white px-3 text-[11px] shadow-sm",
        delayed ? "border-amber-200 text-amber-800" : "border-emerald-200 text-emerald-700",
      ].join(" ")}
    >
      <span className="relative flex h-2 w-2">
        {!delayed && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />}
        <span className={["relative inline-flex h-2 w-2 rounded-full", delayed ? "bg-amber-500" : "bg-emerald-500"].join(" ")} />
      </span>
      <span className="font-semibold">{delayed ? "갱신 지연" : "LIVE · 운영 DB"}</span>
      <span className="text-muted-foreground">{timeLabel ? `${timeLabel} 갱신` : "연결 중"}</span>
      <button
        type="button"
        aria-label="운영 현황 새로고침"
        onClick={onRefresh}
        disabled={refreshing}
        className="-mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
      >
        <RefreshCw aria-hidden className={["h-3.5 w-3.5", refreshing ? "motion-safe:animate-spin" : ""].join(" ")} />
      </button>
    </div>
  );
};

const DASHBOARD_PAGE_SIZE = 1000;

async function fetchAllDashboardRows<T>(
  label: string,
  queryPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from <= DASHBOARD_ROW_CAP; from += DASHBOARD_PAGE_SIZE) {
    const { data, error } = await queryPage(from, from + DASHBOARD_PAGE_SIZE - 1);
    if (error) throw new Error(`${label} 집계 실패: ${error.message}`);
    const page = (data ?? []) as T[];
    if (from === DASHBOARD_ROW_CAP && page.length > 0) {
      throw new Error(`${label} 집계가 안전 조회 상한 ${DASHBOARD_ROW_CAP}건을 초과했습니다.`);
    }
    rows.push(...page);
    if (page.length < DASHBOARD_PAGE_SIZE) return rows;
  }
  return rows;
}

const AdminDashboard = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [changedKeys, setChangedKeys] = useState<Set<DashboardMetricKey>>(() => new Set());
  const mountedRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const previousMetricsRef = useRef<Record<DashboardMetricKey, number> | null>(null);
  const changeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data } = await supabase.rpc("is_admin");
      if (active) setIsAdmin(Boolean(data));
    })();

    return () => {
      active = false;
    };
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    if (mountedRef.current) setRefreshing(true);

    try {
      const [scenarioRows, reviewRows, assignmentRows, learnerResult, learnerRecordResult] = await Promise.all([
        fetchAllDashboardRows<DashboardScenarioRow>("시나리오", (from, to) => db
          .from("scenarios")
          .select("scenario_id,content_format,review_status,mission_status,updated_at,mission_schema_version:mission_content->>schema_version,authoring_stage:mission_content->authoring->>stage")
          .eq("content_format", "scenario_core_v1")
          .order("scenario_id", { ascending: true })
          .range(from, to)),
        fetchAllDashboardRows<DashboardReviewRunRow>("검수 이력", (from, to) => db
          .from("content_review_runs")
          .select("target_id,kind,criteria_version,rules,openai_review,claude_review,adjudication,approved_at,created_at")
          .eq("kind", "mission")
          .eq("criteria_version", DASHBOARD_REVIEW_CRITERIA_VERSION)
          .order("created_at", { ascending: false })
          .range(from, to)),
        fetchAllDashboardRows<DashboardAssignmentRow>("수업 편성", (from, to) => db
          .from("curriculum_week_scenarios")
          .select("outline_id,week_no,scenario_id")
          .order("outline_id", { ascending: true })
          .order("week_no", { ascending: true })
          .order("scenario_id", { ascending: true })
          .range(from, to)),
        db.from("profiles").select("id", { count: "exact" }).eq("role", "learner").eq("approval_status", "approved").limit(1),
        db.from("learner_mission_logs").select("id", { count: "exact" }).limit(1),
      ]);

      const results = [
        ["승인 학습자", learnerResult],
        ["학습 수행", learnerRecordResult],
      ] as const;
      for (const [label, result] of results) {
        if (result.error) throw new Error(`${label} 집계 실패: ${result.error.message}`);
      }

      const next: DashboardSnapshot = {
        content: summarizeDashboardContent(scenarioRows),
        review: summarizeDashboardReviewStages(scenarioRows, reviewRows),
        assignments: summarizeDashboardAssignments(assignmentRows),
        approvedLearnerCount: learnerResult.count ?? 0,
        learnerRecordCount: learnerRecordResult.count ?? 0,
      };
      if (!mountedRef.current) return;

      const nextMetrics = dashboardMetricValues(next);
      const previous = previousMetricsRef.current;
      if (previous) {
        const changed = new Set(
          (Object.keys(nextMetrics) as DashboardMetricKey[]).filter(
            (key) => previous[key] !== nextMetrics[key],
          ),
        );
        setChangedKeys(changed);
        if (changeTimerRef.current) window.clearTimeout(changeTimerRef.current);
        if (changed.size > 0) {
          changeTimerRef.current = window.setTimeout(() => setChangedKeys(new Set()), 900);
        }
      }
      previousMetricsRef.current = nextMetrics;
      setSnapshot(next);
      setLastUpdatedAt(new Date());
      setDashboardError(null);
    } catch (cause) {
      console.error("[dashboard] metrics failed:", cause);
      if (mountedRef.current) {
        setDashboardError(cause instanceof Error ? cause.message : "대시보드 조회 실패");
      }
    } finally {
      refreshInFlightRef.current = false;
      if (mountedRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refreshDashboard();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshDashboard();
    }, 30_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshDashboard();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (changeTimerRef.current) window.clearTimeout(changeTimerRef.current);
    };
  }, [refreshDashboard]);

  const dominantReviewStage = useMemo(
    () => snapshot ? dominantDashboardReviewStage(snapshot.review) : null,
    [snapshot],
  );
  const displayError = snapshot ? null : dashboardError;

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
    } catch (cause) {
      console.error("[reset-profile] failed:", cause);
      toast.error(`초기화 실패: ${(cause as Error).message}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <AdminShell
      title="운영 대시보드"
      description="콘텐츠 준비, 검수, 수업 현황을 한눈에 확인합니다."
      headerMeta={(
        <LiveDatabaseStatus
          lastUpdatedAt={lastUpdatedAt}
          refreshing={refreshing}
          delayed={Boolean(dashboardError)}
          onRefresh={() => void refreshDashboard()}
        />
      )}
    >
      {displayError && (
        <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          운영 지표를 처음 불러오지 못했습니다. {displayError}
        </p>
      )}

      <SectionHeader title="콘텐츠 준비 현황" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard to="/admin/library" label="시나리오 코어" value={snapshot?.content.coreCount ?? null} unit="개" definition="현행 시나리오 코어" error={displayError} icon={Database} accent="gold" changed={changedKeys.has("core")} />
        <MetricCard to="/admin/assembly" label="생성된 학습 미션" value={snapshot?.content.generatedMissionCount ?? null} unit="개" definition="미션 본문 저장 완료" error={displayError} icon={BookOpenCheck} accent="gold" changed={changedKeys.has("mission")} />
        <MetricCard to="/admin/review" label="현행 검수 대상" value={snapshot?.content.reviewTargetCount ?? null} unit="개" definition="검수 대기" error={displayError} icon={ShieldCheck} accent="gold" changed={changedKeys.has("reviewTarget")} />
        <MetricCard to="/admin/review" label="5단계 최종 승인" value={snapshot?.content.professorFinalizedCount ?? null} unit="개" definition="교수자 승인 완료" error={displayError} icon={CircleCheckBig} accent="gold" changed={changedKeys.has("finalized")} />
      </div>

      <SectionHeader
        title="콘텐츠 검수 진행 현황"
        description={`검수 대상 ${snapshot ? `${snapshot.content.reviewTargetCount}개` : "…"} · 다음 처리 단계 기준`}
        meta={dominantReviewStage && snapshot ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5CC57] bg-[#FFF8D7] px-2.5 py-1 text-[11px] font-medium text-[#6F5E15]">
            <Activity aria-hidden className="h-3.5 w-3.5" />
            현재 집중 · {REVIEW_STAGE_LABELS[dominantReviewStage]} {snapshot.review[dominantReviewStage]}개
          </span>
        ) : undefined}
      />
      <ReviewPipeline
        review={snapshot?.review ?? null}
        dominant={dominantReviewStage}
        error={displayError}
        changedKeys={changedKeys}
      />

      <SectionHeader title="수업·학습 현황" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard to="/admin/composer" label="수업 편성" value={snapshot?.assignments.missionCount ?? null} unit="개 미션" definition={snapshot ? `${snapshot.assignments.weekCount}개 주차 · 총 ${snapshot.assignments.assignmentCount}건 편성` : "편성 현황"} error={displayError} icon={CalendarDays} accent="green" changed={changedKeys.has("assignments")} />
        <MetricCard to="/admin/learners" label="승인 학습자" value={snapshot?.approvedLearnerCount ?? null} unit="명" definition="수업 참여 승인 완료" error={displayError} icon={Users} accent="green" changed={changedKeys.has("learners")} />
        <MetricCard to="/admin/decision-traces" label="학습자 수행 기록" value={snapshot?.learnerRecordCount ?? null} unit="건" definition="저장된 미션 수행 로그" error={displayError} icon={Activity} accent="green" changed={changedKeys.has("records")} />
      </div>

      {isAdmin && (
        <div className="mt-4 flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-xs text-muted-foreground" disabled={resetting}>프로필 초기화 테스트</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>내 프로필을 초기화하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>내 프로필을 미완료 상태로 되돌립니다. 다음 로그인 때 프로필 설정 화면부터 다시 시작합니다. 계속할까요?</AlertDialogDescription>
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
