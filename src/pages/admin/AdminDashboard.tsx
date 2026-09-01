import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import {
  DASHBOARD_ROW_CAP,
  DASHBOARD_REVIEW_CRITERIA_VERSION,
  summarizeDashboardAssignments,
  summarizeDashboardContent,
  summarizeDashboardReviewStages,
  type DashboardAssignmentRow,
  type DashboardReviewRunRow,
  type DashboardReviewStageCounts,
  type DashboardScenarioRow,
} from "@/lib/admin/adminDashboardMetrics";
import { ADMIN_PRIORITY_LINKS } from "@/lib/admin/adminNavigation";
import { toast } from "sonner";

// content_review_runs는 2026-08-27 migration 이후 생성 타입을 아직 재발행하지 않았다.
// 이 화면의 예외는 조회 전용이며 선택 컬럼을 DashboardReviewRunRow로 즉시 좁힌다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any };

type DashboardSnapshot = {
  content: ReturnType<typeof summarizeDashboardContent>;
  review: DashboardReviewStageCounts;
  assignments: ReturnType<typeof summarizeDashboardAssignments>;
  legacyCount: number;
  approvedLearnerCount: number;
  learnerRecordCount: number;
};

const LiveBadge = () => (
  <Badge
    variant="outline"
    className="gap-1.5 whitespace-nowrap border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
  >
    <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
    DB 실시간
  </Badge>
);

const SectionHeader = ({
  title,
  description,
  badge = <LiveBadge />,
}: {
  title: string;
  description: string;
  badge?: React.ReactNode;
}) => (
  <div className="mb-3 mt-8">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {badge}
    </div>
    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
  </div>
);

const MetricCard = ({
  to,
  label,
  value,
  unit,
  definition,
  error,
}: {
  to: string;
  label: string;
  value: number | string | null;
  unit: string;
  definition: string;
  error: string | null;
}) => (
  <Link
    to={to}
    className="group flex min-h-[148px] flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-[#D6B84A] hover:bg-[#FFFDF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8AA2F]"
  >
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <div className="mt-3 flex items-end gap-1.5">
      <span className="text-[30px] font-semibold leading-none tabular-nums">
        {error ? <span className="text-base font-normal text-destructive">확인 필요</span> : (value ?? "…")}
      </span>
      {!error && value !== null && <span className="pb-0.5 text-xs text-muted-foreground">{unit}</span>}
    </div>
    <p className="mt-3 text-[11px] leading-4 text-muted-foreground">{definition}</p>
    <span className="mt-auto pt-2 text-[11px] font-medium text-[#7A6818] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
      관련 화면 열기 →
    </span>
  </Link>
);

const REVIEW_STAGE_CARDS = [
  { key: "rules", label: "1. R 검사", definition: "미착수 또는 규칙 오류 수정 후 재검사" },
  { key: "openai", label: "2. OpenAI 1차", definition: "R 검사 완료 · 1차 검수 실행 대기" },
  { key: "claude", label: "3. Claude 교차", definition: "OpenAI 1차 완료 · 독립 교차검수 대기" },
  { key: "adjudication", label: "4. OpenAI 정리", definition: "Claude 완료 · 지적별 수용·보완·기각 대기" },
  { key: "professor", label: "5. 교수자 최종 승인", definition: "AI 단계 완료 · 교수자 판단과 확정 대기" },
] as const;

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

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data } = await supabase.rpc("is_admin");
      if (active) setIsAdmin(Boolean(data));
    })();

    void (async () => {
      try {
        const [scenarioRows, legacyResult, reviewRows, assignmentRows, learnerResult, learnerRecordResult] = await Promise.all([
          fetchAllDashboardRows<DashboardScenarioRow>("시나리오", (from, to) => db
            .from("scenarios")
            .select("scenario_id,content_format,review_status,mission_status,mission_content,updated_at")
            .eq("content_format", "scenario_core_v1")
            .order("scenario_id", { ascending: true })
            .range(from, to)),
          db.from("scenarios").select("scenario_id", { count: "exact" }).eq("content_format", "legacy_v1").limit(1),
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
          ["구버전", legacyResult],
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
          legacyCount: legacyResult.count ?? 0,
          approvedLearnerCount: learnerResult.count ?? 0,
          learnerRecordCount: learnerRecordResult.count ?? 0,
        };
        if (!active) return;
        setSnapshot(next);
        setDashboardError(null);
      } catch (cause) {
        console.error("[dashboard] metrics failed:", cause);
        if (active) setDashboardError(cause instanceof Error ? cause.message : "대시보드 조회 실패");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const reviewQueueTotal = useMemo(
    () => snapshot ? Object.values(snapshot.review).reduce((sum, value) => sum + value, 0) : null,
    [snapshot],
  );

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
      description="콘텐츠 준비·5단계 검수·수업 실행을 서로 다른 분모로 나누어, 지금 필요한 다음 작업을 보여줍니다."
    >
      {dashboardError && (
        <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          일부 운영 지표를 확인할 수 없습니다. {dashboardError}
        </p>
      )}

      <SectionHeader
        title="콘텐츠 준비 현황"
        description="코어·학습 미션·검수 대상·최종 승인 미션을 각각의 단위와 조건으로 집계합니다. 순차 감소 funnel이 아닙니다."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard to="/admin/library" label="시나리오 코어" value={snapshot?.content.coreCount ?? null} unit="개 코어" definition="scenarios 중 scenario_core_v1 형식" error={dashboardError} />
        <MetricCard to="/admin/assembly" label="생성된 학습 미션" value={snapshot?.content.generatedMissionCount ?? null} unit="개 미션" definition="현행 코어에 미션 본문이 저장된 generated·reviewed·released" error={dashboardError} />
        <MetricCard to="/admin/review" label="현행 검수 대상" value={snapshot?.content.reviewTargetCount ?? null} unit="개 미션" definition="현행 코어 · revise_required 제외 · generated 상태" error={dashboardError} />
        <MetricCard to="/admin/review" label="5단계 최종 승인" value={snapshot?.content.professorFinalizedCount ?? null} unit="개 미션" definition="reviewed·released 중 professor_finalized가 저장된 미션" error={dashboardError} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        구버전 형식 {snapshot ? `${snapshot.legacyCount}개` : "…"}는 위 준비·검수 분모에서 제외하고 호환 이력으로만 보존합니다.
      </p>

      <SectionHeader
        title="콘텐츠 검수 진행 현황"
        description={`검수 대상 ${snapshot ? `${snapshot.content.reviewTargetCount}개 미션` : "미션"}을 현재 필요한 다음 단계 한 곳에만 배정합니다.`}
      />
      <div className="mb-3 rounded-lg border border-[#E7D9B8] bg-[#FFFDF4] px-4 py-3 text-xs text-[#655719]">
        생성·저장 시 production quality critic 결과는 이 집계에 포함하지 않습니다. 아래 수치는 현재 버전의 content-review 5단계 대기열입니다.
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {REVIEW_STAGE_CARDS.map((stage) => (
          <MetricCard key={stage.key} to="/admin/review" label={stage.label} value={snapshot?.review[stage.key] ?? null} unit="개 미션" definition={stage.definition} error={dashboardError} />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        단계 합계 {reviewQueueTotal ?? "…"}개 · 같은 미션은 중복 집계하지 않습니다. 규칙 오류가 있는 미션은 원본 수정 후 다시 확인해야 하므로 R 검사에 남습니다.
      </p>

      <SectionHeader title="수업·학습 현황" description="실제 강의계획서 편성, 학습자 승인, 미션 수행 로그만 집계합니다." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard to="/admin/composer" label="수업 편성" value={snapshot ? `${snapshot.assignments.missionCount} / ${snapshot.assignments.weekCount}` : null} unit="미션 / 주차" definition={`전체 강의계획서의 편성 행 ${snapshot ? `${snapshot.assignments.assignmentCount}건` : "…"} · 중복 미션은 한 번만 표시`} error={dashboardError} />
        <MetricCard to="/admin/learners" label="승인 학습자" value={snapshot?.approvedLearnerCount ?? null} unit="명" definition="role=learner · approval_status=approved" error={dashboardError} />
        <MetricCard to="/admin/decision-traces" label="학습자 수행 기록" value={snapshot?.learnerRecordCount ?? null} unit="건" definition="learner_mission_logs에 저장된 미션 실행 로그" error={dashboardError} />
      </div>

      <SectionHeader title="주요 화면 바로가기" description="검수·수업 운영·연구 자료의 실제 작업 화면으로 이동합니다." badge={<Badge variant="outline">운영·연구</Badge>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ADMIN_PRIORITY_LINKS.map((item) => (
          <Link key={item.to} to={item.to} className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-[#D6B84A] hover:bg-[#FFFDF4]">
            <p className="text-sm font-semibold">{item.label.replace(/^3\.\s*/, "")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.pending ? "준비 중인 화면 열기" : "화면 열기"}</p>
          </Link>
        ))}
      </div>

      {isAdmin && (
        <div className="mt-10 flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3">
          <div className="text-sm">
            <p className="font-medium">개발/테스트 도구</p>
            <p className="text-xs text-muted-foreground">내 프로필을 미완료 상태로 되돌려 신규 온보딩 플로우를 재현합니다.</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm" disabled={resetting}>내 프로필 초기화 (테스트용)</Button></AlertDialogTrigger>
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
