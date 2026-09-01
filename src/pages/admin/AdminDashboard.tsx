import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  summarizeDashboardAssignments,
  summarizeDashboardContent,
  summarizeDashboardReviewStages,
  type DashboardAssignmentRow,
  type DashboardReviewRunRow,
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

const SectionHeader = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => (
  <div className="mb-2 mt-6">
    <h2 className="text-base font-semibold">{title}</h2>
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
    className="group flex min-h-[116px] flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-[#D6B84A] hover:bg-[#FFFDF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8AA2F]"
  >
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <span aria-hidden className="text-xs text-muted-foreground/50 transition-colors group-hover:text-[#7A6818]">↗</span>
    </div>
    <div className="mt-2 flex items-end gap-1.5">
      <span className="text-[28px] font-semibold leading-none tabular-nums">
        {error ? <span className="text-base font-normal text-destructive">확인 필요</span> : (value ?? "…")}
      </span>
      {!error && value !== null && <span className="pb-0.5 text-xs text-muted-foreground">{unit}</span>}
    </div>
    <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{definition}</p>
  </Link>
);

const REVIEW_STAGE_CARDS = [
  { key: "rules", label: "1. R 검사", definition: "규칙 검사 필요" },
  { key: "openai", label: "2. OpenAI 1차", definition: "1차 검수 대기" },
  { key: "claude", label: "3. Claude 교차", definition: "교차검수 대기" },
  { key: "adjudication", label: "4. OpenAI 정리", definition: "지적별 판정 대기" },
  { key: "professor", label: "5. 교수자 최종 승인", definition: "최종 승인 대기" },
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
        const [scenarioRows, reviewRows, assignmentRows, learnerResult, learnerRecordResult] = await Promise.all([
          fetchAllDashboardRows<DashboardScenarioRow>("시나리오", (from, to) => db
            .from("scenarios")
            .select("scenario_id,content_format,review_status,mission_status,mission_content,updated_at")
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
    >
      {dashboardError && (
        <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          일부 운영 지표를 확인할 수 없습니다. {dashboardError}
        </p>
      )}

      <SectionHeader title="콘텐츠 준비 현황" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard to="/admin/library" label="시나리오 코어" value={snapshot?.content.coreCount ?? null} unit="개" definition="현행 시나리오 코어" error={dashboardError} />
        <MetricCard to="/admin/assembly" label="생성된 학습 미션" value={snapshot?.content.generatedMissionCount ?? null} unit="개" definition="미션 본문 저장 완료" error={dashboardError} />
        <MetricCard to="/admin/review" label="현행 검수 대상" value={snapshot?.content.reviewTargetCount ?? null} unit="개" definition="검수 대기" error={dashboardError} />
        <MetricCard to="/admin/review" label="5단계 최종 승인" value={snapshot?.content.professorFinalizedCount ?? null} unit="개" definition="교수자 승인 완료" error={dashboardError} />
      </div>

      <SectionHeader
        title="콘텐츠 검수 진행 현황"
        description={`검수 대상 ${snapshot ? `${snapshot.content.reviewTargetCount}개` : "…"} · 다음 처리 단계 기준`}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {REVIEW_STAGE_CARDS.map((stage) => (
          <MetricCard key={stage.key} to="/admin/review" label={stage.label} value={snapshot?.review[stage.key] ?? null} unit="개 미션" definition={stage.definition} error={dashboardError} />
        ))}
      </div>

      <SectionHeader title="수업·학습 현황" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard to="/admin/composer" label="수업 편성" value={snapshot?.assignments.missionCount ?? null} unit="개 미션" definition={snapshot ? `${snapshot.assignments.weekCount}개 주차 · 총 ${snapshot.assignments.assignmentCount}건 편성` : "편성 현황"} error={dashboardError} />
        <MetricCard to="/admin/learners" label="승인 학습자" value={snapshot?.approvedLearnerCount ?? null} unit="명" definition="수업 참여 승인 완료" error={dashboardError} />
        <MetricCard to="/admin/decision-traces" label="학습자 수행 기록" value={snapshot?.learnerRecordCount ?? null} unit="건" definition="저장된 미션 수행 로그" error={dashboardError} />
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
