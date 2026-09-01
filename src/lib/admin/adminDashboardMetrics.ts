import { CONTENT_REVIEW_VERSION } from "../../../supabase/functions/_shared/contentReview";

export const DASHBOARD_ROW_CAP = 4000;
export const DASHBOARD_REVIEW_CRITERIA_VERSION = CONTENT_REVIEW_VERSION;

export type DashboardScenarioRow = {
  scenario_id: string;
  content_format: string;
  review_status: string | null;
  mission_status: string | null;
  mission_schema_version: string | null;
  authoring_stage: string | null;
  updated_at: string | null;
};

export type DashboardReviewRunRow = {
  target_id: string;
  kind: string;
  criteria_version: string;
  rules_verdict: string | null;
  openai_response_id: string | null;
  claude_response_id: string | null;
  adjudication_response_id: string | null;
  created_at: string;
};

export type DashboardAssignmentRow = {
  outline_id: string;
  week_no: number;
  scenario_id: string;
};

export type DashboardReviewQueueStage =
  | "rules"
  | "openai"
  | "claude"
  | "adjudication"
  | "professor";

export type DashboardReviewStageCounts = Record<DashboardReviewQueueStage, number>;

const REVIEW_QUEUE_STAGES: readonly DashboardReviewQueueStage[] = [
  "rules",
  "openai",
  "claude",
  "adjudication",
  "professor",
];

function hasMissionContent(row: DashboardScenarioRow): boolean {
  return Boolean(row.mission_schema_version);
}

function isProfessorFinalized(row: DashboardScenarioRow): boolean {
  return row.authoring_stage === "professor_finalized";
}

/** `/admin/review`의 기본 「미션 생성됨(검수 대기)」 분모와 같은 조건이다. */
export function isDashboardReviewTarget(row: DashboardScenarioRow): boolean {
  return row.content_format === "scenario_core_v1"
    && row.review_status !== "revise_required"
    && row.mission_status === "generated"
    && hasMissionContent(row);
}

export function summarizeDashboardContent(rows: readonly DashboardScenarioRow[]) {
  const currentCoreRows = rows.filter((row) => row.content_format === "scenario_core_v1");
  return {
    coreCount: currentCoreRows.length,
    generatedMissionCount: currentCoreRows.filter(
      (row) => ["generated", "reviewed", "released"].includes(row.mission_status ?? "")
        && hasMissionContent(row),
    ).length,
    reviewTargetCount: currentCoreRows.filter(isDashboardReviewTarget).length,
    professorFinalizedCount: currentCoreRows.filter(
      (row) => ["reviewed", "released"].includes(row.mission_status ?? "")
        && isProfessorFinalized(row),
    ).length,
  };
}

function runIsCurrentForRow(run: DashboardReviewRunRow, row: DashboardScenarioRow): boolean {
  if (!row.updated_at) return true;
  const runTime = Date.parse(run.created_at);
  const rowTime = Date.parse(row.updated_at);
  if (!Number.isFinite(runTime) || !Number.isFinite(rowTime)) return false;
  return runTime >= rowTime;
}

/**
 * 현재 generated 미션이 다음에 처리해야 할 단계를 하나만 반환한다.
 *
 * 생성 시 저장된 `mission_content.quality_check`(production quality critic)는 의도적으로
 * 읽지 않는다. 콘텐츠가 마지막 검수 run 뒤 수정됐다면 과거 결과를 재사용하지 않고 R 검사로
 * 되돌린다. R fail도 원본 수정 뒤 R을 다시 확인해야 하므로 rules에 남긴다.
 */
export function nextDashboardReviewStage(
  row: DashboardScenarioRow,
  runs: readonly DashboardReviewRunRow[],
): DashboardReviewQueueStage {
  const run = runs
    .filter(
      (candidate) => candidate.kind === "mission"
        && candidate.criteria_version === DASHBOARD_REVIEW_CRITERIA_VERSION
        && candidate.target_id === row.scenario_id
        && runIsCurrentForRow(candidate, row),
    )
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];

  if (!run || run.rules_verdict === "fail") return "rules";
  if (!run.openai_response_id) return "openai";
  if (!run.claude_response_id) return "claude";
  if (!run.adjudication_response_id) return "adjudication";
  // generated 상태인데 승인 run이 남은 비정상 경우도 교수자 작업대에서 확인해야 한다.
  return "professor";
}

export function summarizeDashboardReviewStages(
  rows: readonly DashboardScenarioRow[],
  runs: readonly DashboardReviewRunRow[],
): DashboardReviewStageCounts {
  const counts = Object.fromEntries(
    REVIEW_QUEUE_STAGES.map((stage) => [stage, 0]),
  ) as DashboardReviewStageCounts;
  for (const row of rows.filter(isDashboardReviewTarget)) {
    counts[nextDashboardReviewStage(row, runs)] += 1;
  }
  return counts;
}

export function dominantDashboardReviewStage(
  counts: DashboardReviewStageCounts,
): DashboardReviewQueueStage | null {
  let dominant: DashboardReviewQueueStage | null = null;
  let highest = 0;
  for (const stage of REVIEW_QUEUE_STAGES) {
    if (counts[stage] > highest) {
      dominant = stage;
      highest = counts[stage];
    }
  }
  return dominant;
}

export function summarizeDashboardAssignments(rows: readonly DashboardAssignmentRow[]) {
  return {
    assignmentCount: rows.length,
    missionCount: new Set(rows.map((row) => row.scenario_id)).size,
    weekCount: new Set(rows.map((row) => `${row.outline_id}:${row.week_no}`)).size,
  };
}
