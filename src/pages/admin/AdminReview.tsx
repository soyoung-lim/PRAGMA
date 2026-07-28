import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { MissionPreview } from "@/components/admin/MissionPreview";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  isRapidReviewCandidate,
  missionQualityVerdict,
  promptMatchOf,
  rapidReviewCandidateIds,
  type PromptMatch,
  type ReviewVerdict,
} from "@/lib/pragma/adminReviewQueue";
import {
  DIRECTION_LABEL,
  DOMAIN,
  LEVEL,
  MODE_LABEL,
  SPEECH_ACT_UI,
  type Domain,
  type GenMode,
  type LanguageDirection,
  type LearnerLevel,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import { normalizeMission, type MissionV2 } from "@/lib/pragma/missionSchema";
import { PROMPT_SNAPSHOT } from "@/lib/pragma/promptSnapshot.generated";
import { reviewMission } from "@/lib/pragma/promoteMission";

type ReviewScope = "mission" | "core";
type QueueStatus = "pending" | "reviewed" | "all";
type QualityFilter = ReviewVerdict | "candidate" | "all";
type PromptFilter = PromptMatch | "all";

interface ReviewRow {
  scenario_id: string;
  title: string;
  speech_act: string;
  learner_level: string | null;
  domain: string | null;
  mode: string | null;
  language_direction: string | null;
  review_status: string | null;
  mission_status: string | null;
  auto_check_result: string | null;
  generation_run_id: string | null;
  generation_item_key: string | null;
  prompt_snapshot_hash: string | null;
  target_feature: string | null;
  target_feature_version: string | null;
  core_content: Record<string, unknown> | null;
  mission_content: unknown;
  mission_reviewed_at: string | null;
  created_at: string;
}

const db = supabase as unknown as {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => {
          limit: (count: number) => Promise<{ data: unknown; error: { message?: string } | null }>;
        };
      };
    };
  };
};

const REVIEW_SELECT = [
  "scenario_id",
  "title",
  "speech_act",
  "learner_level",
  "domain",
  "mode",
  "language_direction",
  "review_status",
  "mission_status",
  "auto_check_result",
  "generation_run_id",
  "generation_item_key",
  "prompt_snapshot_hash",
  "target_feature",
  "target_feature_version",
  "core_content",
  "mission_content",
  "mission_reviewed_at",
  "created_at",
].join(",");

const QUALITY_LABEL: Record<ReviewVerdict, string> = {
  pass: "AI 통과",
  warning: "AI 주의",
  fail: "AI 결함",
  missing: "AI 미점검",
};

const QUALITY_CLASS: Record<ReviewVerdict, string> = {
  pass: "border-emerald-300 bg-emerald-50 text-emerald-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  fail: "border-red-300 bg-red-50 text-red-900",
  missing: "border-slate-300 bg-slate-50 text-slate-700",
};

const PROMPT_LABEL: Record<PromptMatch, string> = {
  current: "현재 지문",
  different: "다른 지문",
  missing: "지문 없음",
};

function selectLabel(map: Record<string, string>, value: string | null): string {
  return value ? map[value] ?? value : "—";
}

function directionLabel(value: string | null): string {
  if (value === "ko-zh") return DIRECTION_LABEL.ko_zh;
  if (value === "zh-ko") return DIRECTION_LABEL.zh_ko;
  return selectLabel(DIRECTION_LABEL, value);
}

function textFromCore(core: Record<string, unknown> | null, key: string): string {
  const value = core?.[key];
  return typeof value === "string" ? value : "";
}

function qualitySummary(missionContent: unknown): string {
  if (!missionContent || typeof missionContent !== "object" || Array.isArray(missionContent)) {
    return "";
  }
  const quality = (missionContent as Record<string, unknown>).quality_check;
  if (!quality || typeof quality !== "object" || Array.isArray(quality)) return "";
  const summary = (quality as Record<string, unknown>).summary_ko;
  return typeof summary === "string" ? summary : "";
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-[#EAE4D2] bg-white px-4 py-3">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{note}</div>
    </div>
  );
}

const AdminReview = () => {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scope, setScope] = useState<ReviewScope>("mission");
  const [statusFilter, setStatusFilter] = useState<QueueStatus>("pending");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");
  const [promptFilter, setPromptFilter] = useState<PromptFilter>("all");
  const [runFilter, setRunFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [humanPassedIds, setHumanPassedIds] = useState<Set<string>>(new Set());
  const [rapidIds, setRapidIds] = useState<string[]>([]);
  const [rapidIndex, setRapidIndex] = useState(0);
  const [rapidOpen, setRapidOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalProgress, setApprovalProgress] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db
      .from("scenarios")
      .select(REVIEW_SELECT)
      .eq("content_format", "scenario_core_v1")
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) {
      setLoadError(error.message ?? "검수 큐 조회 실패");
      setRows([]);
    } else {
      setLoadError(null);
      setRows((data ?? []) as ReviewRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedIds(new Set());
    setHumanPassedIds(new Set());
    setExpandedId(null);
  }, [scope, runFilter]);

  const runs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.generation_run_id) continue;
      counts.set(row.generation_run_id, (counts.get(row.generation_run_id) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const stats = useMemo(() => {
    const missionPending = rows.filter((row) => row.mission_status === "generated");
    return {
      cores: rows.length,
      corePending: rows.filter((row) => row.review_status === "needs_review").length,
      missionPending: missionPending.length,
      aiPass: missionPending.filter(
        (row) => missionQualityVerdict(row.mission_content) === "pass",
      ).length,
      reviewed: rows.filter((row) => row.mission_status === "reviewed").length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (scope === "mission") {
        if (statusFilter === "pending" && row.mission_status !== "generated") return false;
        if (statusFilter === "reviewed" && row.mission_status !== "reviewed") return false;
      } else {
        if (statusFilter === "pending" && row.review_status !== "needs_review") return false;
        if (statusFilter === "reviewed" && row.review_status !== "approved") return false;
      }

      if (runFilter && row.generation_run_id !== runFilter) return false;

      const promptMatch = promptMatchOf(
        row.prompt_snapshot_hash,
        PROMPT_SNAPSHOT.core_surface_hash,
      );
      if (promptFilter !== "all" && promptMatch !== promptFilter) return false;

      if (scope === "mission") {
        const quality = missionQualityVerdict(row.mission_content);
        if (qualityFilter === "candidate") {
          if (!isRapidReviewCandidate(row, PROMPT_SNAPSHOT.core_surface_hash)) return false;
        } else if (qualityFilter !== "all" && quality !== qualityFilter) {
          return false;
        }
      } else if (
        qualityFilter !== "all" &&
        qualityFilter !== "candidate" &&
        row.auto_check_result !== qualityFilter
      ) {
        return false;
      }

      if (!query) return true;
      const haystack = [
        row.title,
        row.speech_act,
        row.target_feature,
        row.generation_item_key,
        textFromCore(row.core_content, "situation_ko"),
        textFromCore(row.core_content, "source_text"),
        textFromCore(row.core_content, "source_text_ko"),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [
    rows,
    scope,
    statusFilter,
    runFilter,
    promptFilter,
    qualityFilter,
    search,
  ]);

  const visibleRows = filtered.slice(0, 150);
  const currentRapidRow = rapidIds.length
    ? rows.find((row) => row.scenario_id === rapidIds[rapidIndex]) ?? null
    : null;
  const currentRapidMission = useMemo(() => {
    if (!currentRapidRow) return null;
    const parsed = normalizeMission(currentRapidRow.mission_content);
    return parsed.ok && parsed.data ? parsed.data : null;
  }, [currentRapidRow]);
  const approvalReadyIds = [...selectedIds].filter((id) => humanPassedIds.has(id));

  const chooseSafeCandidates = () => {
    if (!runFilter) {
      toast.error("먼저 하나의 run ID를 선택하십시오.");
      return;
    }
    const ids = rapidReviewCandidateIds(
      filtered,
      PROMPT_SNAPSHOT.core_surface_hash,
      25,
    );
    setSelectedIds(new Set(ids));
    setHumanPassedIds(new Set());
    if (ids.length === 0) {
      toast.warning("현재 조건에서 안전한 빠른 검수 후보가 없습니다.");
    } else {
      toast.success(`${ids.length}건을 선택했습니다. 사람 검수를 시작하십시오.`);
    }
  };

  const startRapidReview = () => {
    const ids = [...selectedIds].filter((id) =>
      rows.some(
        (row) =>
          row.scenario_id === id &&
          isRapidReviewCandidate(row, PROMPT_SNAPSHOT.core_surface_hash),
      ),
    );
    if (!runFilter || ids.length === 0) {
      toast.error("단일 run ID에서 안전 후보를 먼저 선택하십시오.");
      return;
    }
    setRapidIds(ids);
    setRapidIndex(0);
    setRapidOpen(true);
  };

  const advanceRapid = (passed: boolean) => {
    const id = rapidIds[rapidIndex];
    if (id) {
      setHumanPassedIds((previous) => {
        const next = new Set(previous);
        if (passed && currentRapidMission) next.add(id);
        else next.delete(id);
        return next;
      });
    }
    if (rapidIndex < rapidIds.length - 1) {
      setRapidIndex((index) => index + 1);
    } else {
      setRapidOpen(false);
      toast.success("빠른 사람 검수가 끝났습니다. 통과 표시된 항목만 승인할 수 있습니다.");
    }
  };

  const approvePassed = async () => {
    if (!runFilter || approvalReadyIds.length === 0 || approving) return;
    setApproving(true);
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (let index = 0; index < approvalReadyIds.length; index += 1) {
      const id = approvalReadyIds[index];
      setApprovalProgress(`${index + 1}/${approvalReadyIds.length}`);
      const result = await reviewMission(id);
      if (result.ok) succeeded.push(id);
      else failed.push(id);
    }

    if (succeeded.length) {
      const reviewedAt = new Date().toISOString();
      setRows((previous) =>
        previous.map((row) =>
          succeeded.includes(row.scenario_id)
            ? { ...row, mission_status: "reviewed", mission_reviewed_at: reviewedAt }
            : row,
        ),
      );
      setSelectedIds((previous) => {
        const next = new Set(previous);
        succeeded.forEach((id) => next.delete(id));
        return next;
      });
      setHumanPassedIds((previous) => {
        const next = new Set(previous);
        succeeded.forEach((id) => next.delete(id));
        return next;
      });
    }

    setApprovalProgress("");
    setApproving(false);
    if (failed.length) {
      toast.error(`${succeeded.length}건 승인, ${failed.length}건 실패. 실패 항목은 선택 상태로 남겼습니다.`);
    } else {
      toast.success(`${succeeded.length}건을 교수자 검토 완료로 승인했습니다.`);
    }
  };

  const renderMissionPreview = (row: ReviewRow) => {
    const parsed = normalizeMission(row.mission_content);
    if (!parsed.ok || !parsed.data) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-[12px] text-red-900">
          미션 스키마를 읽을 수 없습니다. 이 항목은 빠른 승인 대상이 아닙니다.
        </div>
      );
    }
    return <MissionPreview mission={parsed.data} />;
  };

  return (
    <AdminShell
      title="통합 검수·승인"
      description="코어 상태와 학습 미션의 교수자 실행 게이트를 분리해 확인합니다."
    >
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-950">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <b>현재 누적 자료는 테스트·회귀 생성물을 포함합니다.</b> 큐에 보인다는 이유만으로 본
            콘텐츠가 아닙니다. 본배치에서는 반드시 해당 run ID를 하나 선택하고, 사람 미리보기를
            통과한 미션만 승인하십시오. AI 품질점검은 승인자가 아니라 검수 순서를 돕는 보조 장치입니다.
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="코어 전체" value={stats.cores} note="scenario_core_v1" />
        <Stat label="코어 상태·대기" value={stats.corePending} note="학습자 실행 게이트 아님" />
        <Stat label="미션 검수 대기" value={stats.missionPending} note="mission_status=generated" />
        <Stat label="AI 통과·대기" value={stats.aiPass} note="교수자 승인 전" />
        <Stat label="교수자 검토 완료" value={stats.reviewed} note="mission_status=reviewed" />
      </div>

      <div className="mt-5 rounded-xl border border-[#EAE4D2] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg border border-[#D8D0BC] bg-[#F7F5EF] p-1">
            <button
              type="button"
              onClick={() => {
                setScope("mission");
                setStatusFilter("pending");
                setQualityFilter("all");
              }}
              className={`rounded-md px-3 py-1.5 text-[12.5px] ${
                scope === "mission" ? "bg-[#15202B] font-semibold text-white" : "text-[#5C6470]"
              }`}
            >
              학습 미션 검수
            </button>
            <button
              type="button"
              onClick={() => {
                setScope("core");
                setStatusFilter("pending");
                setQualityFilter("all");
              }}
              className={`rounded-md px-3 py-1.5 text-[12.5px] ${
                scope === "core" ? "bg-[#15202B] font-semibold text-white" : "text-[#5C6470]"
              }`}
            >
              코어 상태 확인
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        </div>

        {scope === "core" && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
            코어의 <code>review_status</code>는 보관·선별 메타데이터다. 실제 학습자 실행 여부는
            미션의 <code>mission_status=reviewed</code>와 수업 편성이 함께 결정한다. 이 화면에서는
            코어를 일괄 승인하지 않는다.
          </p>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-[11.5px] text-muted-foreground">
            상태
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as QueueStatus)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-[12.5px] text-foreground"
            >
              <option value="pending">{scope === "mission" ? "미션 검수 대기" : "코어 상태·대기"}</option>
              <option value="reviewed">{scope === "mission" ? "교수자 검토 완료" : "코어 승인 상태"}</option>
              <option value="all">전체</option>
            </select>
          </label>
          <label className="text-[11.5px] text-muted-foreground">
            {scope === "mission" ? "AI 품질점검" : "코어 규칙검사"}
            <select
              value={qualityFilter}
              onChange={(event) => setQualityFilter(event.target.value as QualityFilter)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-[12.5px] text-foreground"
            >
              <option value="all">전체</option>
              {scope === "mission" && <option value="candidate">안전한 빠른 검수 후보</option>}
              <option value="pass">통과</option>
              <option value="warning">주의</option>
              <option value="fail">결함</option>
              <option value="missing">미점검</option>
            </select>
          </label>
          <label className="text-[11.5px] text-muted-foreground">
            run ID
            <select
              value={runFilter}
              onChange={(event) => setRunFilter(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-[12px] text-foreground"
            >
              <option value="">전체 — 승인 전 단일 run 선택 필수</option>
              {runs.map(([run, count]) => (
                <option key={run} value={run}>
                  {run} ({count})
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11.5px] text-muted-foreground">
            코어 prompt 지문
            <select
              value={promptFilter}
              onChange={(event) => setPromptFilter(event.target.value as PromptFilter)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-[12.5px] text-foreground"
            >
              <option value="all">전체</option>
              <option value="current">현재 지문 일치</option>
              <option value="different">다른 지문</option>
              <option value="missing">지문 없음</option>
            </select>
          </label>
          <label className="text-[11.5px] text-muted-foreground">
            검색
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="제목·화행·item key"
              className="mt-1 h-9 text-[12.5px]"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px]">
          <span className="text-muted-foreground">
            조건 결과 {filtered.length.toLocaleString()}건
            {filtered.length > visibleRows.length && ` · 화면에는 최근 ${visibleRows.length}건 표시`}
          </span>
          <span className="break-all font-mono text-[10.5px] text-muted-foreground">
            current prompt {PROMPT_SNAPSHOT.core_surface_hash.slice(0, 12)}…
          </span>
        </div>
      </div>

      {scope === "mission" && (
        <div className="sticky top-[72px] z-20 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D8D0BC] bg-[#FFFDF7]/95 px-4 py-3 shadow-sm backdrop-blur">
          <div>
            <div className="text-[13px] font-semibold">
              선택 {selectedIds.size}건 · 사람 검수 통과 {approvalReadyIds.length}건
            </div>
            <div className="text-[11px] text-muted-foreground">
              자동 선택은 최대 25건. 실제 승인 전 각 미션을 한 번씩 확인해야 한다.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={chooseSafeCandidates}
              disabled={!runFilter || loading}
            >
              안전 후보 최대 25건 선택
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedIds(new Set());
                setHumanPassedIds(new Set());
              }}
              disabled={selectedIds.size === 0}
            >
              선택 해제
            </Button>
            <Button
              size="sm"
              onClick={startRapidReview}
              disabled={!runFilter || selectedIds.size === 0}
              className="bg-[#15202B] text-white hover:bg-[#15202B]/90"
            >
              빠른 사람 검수 시작
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  disabled={approvalReadyIds.length === 0 || approving}
                  className="bg-emerald-700 text-white hover:bg-emerald-800"
                >
                  {approving ? (
                    <>
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      승인 {approvalProgress}
                    </>
                  ) : (
                    `검수 통과 ${approvalReadyIds.length}건 승인`
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>교수자 검토 완료로 승인할까요?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <span className="block">
                      사람 미리보기에서 통과시킨 {approvalReadyIds.length}건만 승인한다.
                    </span>
                    <span className="block break-all font-mono text-[11px]">
                      run: {runFilter}
                    </span>
                    <span className="block">
                      각 항목은 기존 review_mission 경로를 거쳐 승인자와 시각이 기록된다. 향후
                      게시 수업에 편성되면 학습자가 실행할 수 있다.
                    </span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void approvePassed()}>
                    {approvalReadyIds.length}건 승인
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {loading && (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            검수 큐를 불러오는 중…
          </div>
        )}
        {!loading && loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            조회 실패: {loadError}
          </div>
        )}
        {!loading && !loadError && visibleRows.length === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            현재 조건에 해당하는 항목이 없습니다.
          </div>
        )}
        {!loading &&
          !loadError &&
          visibleRows.map((row) => {
            const quality = missionQualityVerdict(row.mission_content);
            const promptMatch = promptMatchOf(
              row.prompt_snapshot_hash,
              PROMPT_SNAPSHOT.core_surface_hash,
            );
            const candidate =
              scope === "mission" &&
              Boolean(runFilter) &&
              row.generation_run_id === runFilter &&
              isRapidReviewCandidate(row, PROMPT_SNAPSHOT.core_surface_hash);
            const selected = selectedIds.has(row.scenario_id);
            const humanPassed = humanPassedIds.has(row.scenario_id);
            const expanded = expandedId === row.scenario_id;
            const situation =
              textFromCore(row.core_content, "situation_ko") ||
              textFromCore(row.core_content, "situation");
            const source =
              textFromCore(row.core_content, "source_text") ||
              textFromCore(row.core_content, "source_text_ko");

            return (
              <article
                key={row.scenario_id}
                className={`rounded-xl border bg-white p-4 ${
                  selected ? "border-[#15202B] ring-1 ring-[#15202B]" : "border-[#EAE4D2]"
                }`}
              >
                <div className="flex items-start gap-3">
                  {scope === "mission" && (
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={!candidate}
                      aria-label={`${row.title} 빠른 검수 선택`}
                      title={
                        candidate
                          ? "빠른 사람 검수 후보로 선택"
                          : "현재 조건에서는 빠른 검수 후보가 아닙니다"
                      }
                      onChange={(event) => {
                        setSelectedIds((previous) => {
                          const next = new Set(previous);
                          if (event.target.checked) next.add(row.scenario_id);
                          else next.delete(row.scenario_id);
                          return next;
                        });
                        if (!event.target.checked) {
                          setHumanPassedIds((previous) => {
                            const next = new Set(previous);
                            next.delete(row.scenario_id);
                            return next;
                          });
                        }
                      }}
                      className="mt-1 h-4 w-4 accent-[#15202B]"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="mr-1 text-[14px] font-semibold">{row.title}</h3>
                      <Badge variant="outline">
                        {selectLabel(SPEECH_ACT_UI, row.speech_act)}
                      </Badge>
                      <Badge variant="outline">
                        {selectLabel(LEVEL, row.learner_level)}
                      </Badge>
                      <Badge variant="outline">{directionLabel(row.language_direction)}</Badge>
                      <Badge variant="outline">
                        {selectLabel(MODE_LABEL, row.mode)}
                      </Badge>
                      {scope === "mission" && (
                        <Badge variant="outline" className={QUALITY_CLASS[quality]}>
                          {QUALITY_LABEL[quality]}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          promptMatch === "current"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                            : "border-amber-300 bg-amber-50 text-amber-900"
                        }
                      >
                        {PROMPT_LABEL[promptMatch]}
                      </Badge>
                      {humanPassed && (
                        <Badge className="bg-emerald-700 text-white">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          사람 검수 통과
                        </Badge>
                      )}
                    </div>

                    {situation && <p className="mt-2 text-[13px]">{situation}</p>}
                    {source && (
                      <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">
                        원문 · {source}
                      </p>
                    )}
                    {scope === "mission" && qualitySummary(row.mission_content) && (
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        AI 점검 · {qualitySummary(row.mission_content)}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10.5px] text-muted-foreground">
                      <span>run {row.generation_run_id ?? "—"}</span>
                      <span>item {row.generation_item_key ?? "—"}</span>
                      <span>
                        feature {row.target_feature ?? "—"} v{row.target_feature_version ?? "—"}
                      </span>
                      <span>
                        core rule {row.auto_check_result ?? "—"} ·{" "}
                        {scope === "mission"
                          ? `mission ${row.mission_status ?? "없음"}`
                          : `core ${row.review_status ?? "—"}`}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(expanded ? null : row.scenario_id)}
                    aria-expanded={expanded}
                  >
                    {expanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <span className="ml-1">{expanded ? "접기" : "미리보기"}</span>
                  </Button>
                </div>

                {expanded && (
                  <div className="mt-3 border-t border-[#EAE4D2] pt-3">
                    <div className="mb-2 grid gap-2 text-[12px] sm:grid-cols-3">
                      <div className="rounded-lg bg-[#F7F5EF] px-3 py-2">
                        영역 · {selectLabel(DOMAIN, row.domain)}
                      </div>
                      <div className="rounded-lg bg-[#F7F5EF] px-3 py-2">
                        P/D/R · {textFromCore(row.core_content, "relation_ko") || "—"}
                      </div>
                      <div className="rounded-lg bg-[#F7F5EF] px-3 py-2">
                        생성 · {row.created_at.slice(0, 16).replace("T", " ")}
                      </div>
                    </div>
                    {scope === "mission" ? (
                      renderMissionPreview(row)
                    ) : (
                      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border bg-slate-50 p-3 text-[11.5px] leading-relaxed">
                        {JSON.stringify(row.core_content, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </article>
            );
          })}
      </div>

      <Dialog open={rapidOpen} onOpenChange={setRapidOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              빠른 사람 검수 {rapidIds.length ? rapidIndex + 1 : 0}/{rapidIds.length}
            </DialogTitle>
          </DialogHeader>
          {currentRapidRow && (
            <div>
              <div className="rounded-lg border border-[#EAE4D2] bg-[#F7F5EF] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{currentRapidRow.title}</b>
                  <Badge variant="outline">
                    {selectLabel(SPEECH_ACT_UI, currentRapidRow.speech_act)}
                  </Badge>
                  <Badge variant="outline">
                    {directionLabel(currentRapidRow.language_direction)}
                  </Badge>
                </div>
                <p className="mt-2 text-[12.5px]">
                  {textFromCore(currentRapidRow.core_content, "situation_ko")}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  원문 ·{" "}
                  {textFromCore(currentRapidRow.core_content, "source_text") ||
                    textFromCore(currentRapidRow.core_content, "source_text_ko")}
                </p>
                <p className="mt-2 break-all font-mono text-[10.5px] text-muted-foreground">
                  run {currentRapidRow.generation_run_id} · item{" "}
                  {currentRapidRow.generation_item_key}
                </p>
              </div>
              {currentRapidMission ? (
                <MissionPreview mission={currentRapidMission as MissionV2} />
              ) : (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900">
                  미션 스키마를 읽을 수 없어 검수 통과 처리할 수 없습니다.
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setRapidIndex((index) => Math.max(0, index - 1))}
              disabled={rapidIndex === 0}
            >
              이전
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => advanceRapid(false)}>
                보류 후 다음
              </Button>
              <Button
                onClick={() => advanceRapid(true)}
                disabled={!currentRapidMission}
                className="bg-emerald-700 text-white hover:bg-emerald-800"
              >
                검수 통과 후 다음
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default AdminReview;
