import { useMemo, useRef, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  DIRECTION_LABEL,
  DOMAIN,
  INDUSTRY,
  LEVEL,
  MODE_LABEL,
  SPEECH_ACT_UI,
  type LanguageDirection,
  type LearnerLevel,
} from "@/lib/pragma/enums";
import {
  DEFAULT_QUOTA,
  FINAL_CORPUS_QUOTA_504,
  ZH_KO_VALIDATION_ACTS,
  ZH_KO_VALIDATION_QUOTA,
  auditTopicCompatibility,
  auditTopicCoverage,
  buildBatchPlan,
  interpretingCount,
  summarizePlan,
  type BatchQuota,
} from "@/lib/pragma/batchPlan";
import { preflightAdminBatch } from "@/lib/pragma/adminBatchPreflight";
import {
  loadExistingCoreRunItems,
  runCoreBatch,
  type CoreCellResult,
} from "@/lib/pragma/coreBatchRun";
import {
  abortFinalCorpusRun,
  closeFinalCorpusRun,
  getFinalCorpusReadiness,
  getFinalCorpusReleaseReadiness,
  getFinalCorpusRunState,
  prepareFinalCorpusRun,
  releaseFinalCorpus,
  type FinalCorpusReadiness,
  type FinalCorpusReleaseReadiness,
  type FinalCorpusRunState,
} from "@/lib/pragma/finalCorpusGeneration";
import {
  CORE_QUALITY_AXES,
  runCoreQualityPilot,
  type CoreQualityAxis,
  type CoreQualityPilotResult,
} from "@/lib/pragma/coreQualityAudit";
import { THEME_LABEL } from "@/lib/pragma/scenarioTopics";
import { toast } from "sonner";

// 배치 생성 — 셀 목록을 순회하며 기존 생성기를 반복 호출한다.
//
// 이 화면의 핵심은 '실행'이 아니라 **실행 전 분포 검산**이다.
// 화행 × 수준만 채우면 개수는 늘어도 도메인·산업·통역이 한쪽으로 쏠리고,
// 교강사가 "직장 · 무역" 필터를 눌렀을 때 0건이 나온다.
// 그래서 계획을 먼저 보여주고, 무엇이 몇 개 생기는지 눈으로 확인한 뒤 돌린다.
//
// AI 호출 전에는 관리자 세션을 선행 검사해 비용 낭비를 막는다.
// 최종 접근 제어는 다른 /admin/* 화면과 동일하게 DB(RLS·is_admin)가 맡는다.

const LEVEL_ORDER: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];
const CORE_AXIS_LABEL: Record<CoreQualityAxis, string> = {
  speech_act: "화행",
  power: "P",
  distance: "D",
  burden: "R",
  domain: "도메인",
  industry: "산업",
  mode: "모드",
  context_spec: "역할·의무",
  referents: "행위자·대상",
  decision_authority: "결정 권한",
  topic_seed: "시드",
  adjacency: "인접쌍",
};

const coreRunStorageKey = (direction: LanguageDirection) =>
  `pragma:admin-core-batch-run:${direction}`;

const createCoreRunId = (direction: LanguageDirection) =>
  `core_${direction}_${Date.now()}`;

const getOrCreateCoreRunId = (direction: LanguageDirection) => {
  const fresh = createCoreRunId(direction);
  if (typeof window === "undefined") return fresh;
  const key = coreRunStorageKey(direction);
  const stored = window.localStorage.getItem(key);
  if (stored) return stored;
  window.localStorage.setItem(key, fresh);
  return fresh;
};

const persistCoreRunId = (direction: LanguageDirection, runId: string) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(coreRunStorageKey(direction), runId);
  }
};

const FINAL_CORPUS_RUN_STORAGE_KEY = "pragma:admin-final-corpus-run:ko_zh";

const getStoredFinalCorpusRunId = () =>
  typeof window === "undefined" ? "" : window.localStorage.getItem(FINAL_CORPUS_RUN_STORAGE_KEY) ?? "";

const persistFinalCorpusRunId = (runId: string) => {
  if (typeof window === "undefined") return;
  if (runId) window.localStorage.setItem(FINAL_CORPUS_RUN_STORAGE_KEY, runId);
  else window.localStorage.removeItem(FINAL_CORPUS_RUN_STORAGE_KEY);
};

const parseSelectedPlanIndexes = (raw: string, total: number) => {
  const tokens = raw.split(/[\s,]+/).filter(Boolean);
  const invalid = tokens.some((token) => {
    const value = Number(token);
    return !Number.isInteger(value) || value < 1 || value > total;
  });
  const indexes = Array.from(
    new Set(
      tokens
        .map(Number)
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= total)
        .map((value) => value - 1),
    ),
  ).sort((a, b) => a - b);
  return { indexes, invalid };
};

const AdminBatch = () => {
  const [quota, setQuota] = useState<BatchQuota>(DEFAULT_QUOTA);
  // 언어 방향(0-l·89) — zh_ko는 검증 쿼터(18셀·승격 가능 3화행)로 자동 전환.
  const [direction, setDirection] = useState<LanguageDirection>("ko_zh");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CoreCellResult[]>([]);
  const [done, setDone] = useState(0);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResults, setAuditResults] = useState<CoreQualityPilotResult[]>([]);
  const [auditDone, setAuditDone] = useState(0);
  const [coreRunId, setCoreRunId] = useState(() => getOrCreateCoreRunId("ko_zh"));
  const [selectedCellNumbers, setSelectedCellNumbers] = useState("");
  const [activeTotal, setActiveTotal] = useState(0);
  const [finalPackId, setFinalPackId] = useState("");
  const [finalRationale, setFinalRationale] = useState("");
  const [finalRunId, setFinalRunId] = useState(getStoredFinalCorpusRunId);
  const [finalReadiness, setFinalReadiness] = useState<FinalCorpusReadiness | null>(null);
  const [finalRunState, setFinalRunState] = useState<FinalCorpusRunState | null>(null);
  const [finalReleaseReadiness, setFinalReleaseReadiness] = useState<FinalCorpusReleaseReadiness | null>(null);
  const [finalPreparing, setFinalPreparing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const switchDirection = (d: LanguageDirection) => {
    if (running) return;
    setDirection(d);
    setQuota(d === "zh_ko" ? ZH_KO_VALIDATION_QUOTA : DEFAULT_QUOTA);
    setCoreRunId(getOrCreateCoreRunId(d));
    if (d !== "ko_zh") setFinalRunState(null);
  };

  const targetActs = direction === "zh_ko" ? ZH_KO_VALIDATION_ACTS : undefined;
  const targetActCount = targetActs?.length ?? Object.keys(SPEECH_ACT_UI).length;
  const topicCoverage = useMemo(() => auditTopicCoverage(targetActs), [targetActs]);
  const topicCompatibility = useMemo(
    () => auditTopicCompatibility(targetActs),
    [targetActs],
  );
  const plan = useMemo(
    () =>
      topicCoverage.missing.length === 0 && topicCompatibility.length === 0
        ? buildBatchPlan(quota, direction, targetActs)
        : [],
    [
      quota,
      direction,
      targetActs,
      topicCoverage.missing.length,
      topicCompatibility.length,
    ],
  );
  // 54셀 감사는 zh_ko 검증일 때 대상 화행(요청·거절·감사)만으로 좁힌다 —
  // 안 그러면 애초에 카탈로그가 없어 대상도 아닌 6화행이 "빈 셀"로 오경고된다.
  const summary = useMemo(() => summarizePlan(plan, targetActs), [plan, targetActs]);
  const selectedPlan = useMemo(
    () => parseSelectedPlanIndexes(selectedCellNumbers, plan.length),
    [selectedCellNumbers, plan.length],
  );
  const isLargeKoZhBatch = direction === "ko_zh" && summary.total >= 400;
  const isApprovedFullBatch =
    direction === "ko_zh" &&
    summary.total === 504 &&
    summary.emptyActPdrCells.length === 0 &&
    summary.minActPdrCount >= 2 &&
    summary.emptyActLevelModeCells.length === 0 &&
    summary.minActLevelModeCount >= 3;
  const fullBatchBlocked = isLargeKoZhBatch && !isApprovedFullBatch;

  const setLevelQuota = (level: LearnerLevel, value: number) =>
    setQuota((q) => ({ ...q, perLevel: { ...q.perLevel, [level]: Math.max(0, value) } }));

  const loadFullBatchPreset = () => {
    if (running) return;
    setDirection("ko_zh");
    setQuota(FINAL_CORPUS_QUOTA_504);
    const storedFinalRun = getStoredFinalCorpusRunId();
    if (storedFinalRun) {
      setFinalRunId(storedFinalRun);
      setCoreRunId(storedFinalRun);
    } else {
      const next = createCoreRunId("ko_zh");
      persistCoreRunId("ko_zh", next);
      setCoreRunId(next);
    }
  };

  const refreshFinalReadiness = async () => {
    if (!finalPackId.trim()) {
      toast.error("9화행으로 확장·승인된 realization pack ID를 입력해 주세요.");
      return null;
    }
    try {
      const readiness = await getFinalCorpusReadiness(finalPackId.trim());
      setFinalReadiness(readiness);
      if (!readiness.generation_allowed) {
        toast.info(`아직 lock 불가: ${readiness.missing_requirements.join(", ")}`);
      }
      return readiness;
    } catch (error) {
      toast.error((error as Error).message);
      return null;
    }
  };

  const prepareFinalRun = async () => {
    if (!isApprovedFullBatch || !finalRationale.trim()) {
      toast.error("승인된 504 계획과 lock 근거를 먼저 준비해 주세요.");
      return;
    }
    const preflight = await preflightAdminBatch();
    if ("message" in preflight) {
      toast.error(preflight.message);
      return;
    }
    const readiness = await refreshFinalReadiness();
    if (!readiness?.generation_allowed) return;
    if (!window.confirm("현재 규칙·문헌·Gold·prompt hash를 고정하고 최종 504 신규 생성 run을 시작할까요?")) return;

    setFinalPreparing(true);
    try {
      const runId = await prepareFinalCorpusRun({
        packId: finalPackId.trim(),
        rationaleKo: finalRationale.trim(),
        cells: plan,
      });
      setFinalRunId(runId);
      persistFinalCorpusRunId(runId);
      setCoreRunId(runId);
      persistCoreRunId("ko_zh", runId);
      setFinalRunState(await getFinalCorpusRunState(runId));
      toast.success("최종 코퍼스 lock과 504 run이 시작됐습니다.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setFinalPreparing(false);
    }
  };

  const refreshFinalRunState = async () => {
    if (!finalRunId) return;
    try {
      const [runState, releaseState] = await Promise.all([
        getFinalCorpusRunState(finalRunId),
        getFinalCorpusReleaseReadiness(finalRunId),
      ]);
      setFinalRunState(runState);
      setFinalReleaseReadiness(releaseState);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const closeFinalRun = async () => {
    if (!finalRunId || !finalRationale.trim()) return;
    try {
      await closeFinalCorpusRun(finalRunId, finalRationale.trim());
      await refreshFinalRunState();
      toast.success("504개 신규 코어 run을 닫았습니다. 미션 생성·검수·release는 다음 게이트입니다.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const abortFinalRun = async () => {
    if (!finalRunId || !finalRationale.trim()) return;
    if (!window.confirm("이 최종 코퍼스 run을 중단할까요? 저장된 candidate는 증거로 보존됩니다.")) return;
    try {
      await abortFinalCorpusRun(finalRunId, finalRationale.trim());
      await refreshFinalRunState();
      persistFinalCorpusRunId("");
      toast.success("run을 중단했고 기존 candidate는 변경 없이 보존했습니다.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const releaseFinalRunCorpus = async () => {
    if (!finalRunId || !finalRationale.trim() || !finalReleaseReadiness?.release_allowed) return;
    if (!window.confirm("504개 모두의 개별 전문가 release를 불변 manifest로 묶고 최종 corpus로 확정할까요?")) return;
    try {
      const releaseId = await releaseFinalCorpus(finalRunId, finalRationale.trim());
      await refreshFinalRunState();
      toast.success(`최종 504 corpus를 release했습니다: ${releaseId}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const start = async () => {
    if (fullBatchBlocked) {
      toast.error("400건 이상 본배치는 승인된 504 프리셋과 243·54셀 게이트를 모두 충족해야 합니다.");
      return;
    }
    if (isApprovedFullBatch && !finalRunId) {
      toast.error("최종 504는 먼저 규칙·문헌·Gold를 lock한 서버 run이 있어야 합니다.");
      return;
    }
    const preflight = await preflightAdminBatch();
    if ("message" in preflight) {
      toast.error(preflight.message);
      return;
    }

    let existingItems: Awaited<ReturnType<typeof loadExistingCoreRunItems>>;
    try {
      existingItems = await loadExistingCoreRunItems(coreRunId);
    } catch {
      toast.error("기존 배치 진행 상태를 읽지 못했습니다. 다시 로그인한 뒤 실행해 주세요.");
      return;
    }
    if (existingItems.size > 0) {
      toast.info(`같은 배치 ID로 저장된 ${existingItems.size}건은 AI 호출 없이 건너뜁니다.`);
    }

    setRunning(true);
    setResults([]);
    setDone(0);
    setActiveTotal(plan.length);
    setAuditResults([]);
    setAuditDone(0);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const onProgress = (d: number, _total: number, last: CoreCellResult) => {
      setDone(d);
      setResults((prev) => [...prev, last]);
    };
    const activeRunId = isApprovedFullBatch ? finalRunId : coreRunId;
    const out = await runCoreBatch(plan, {
      runId: activeRunId,
      finalCorpusRunId: isApprovedFullBatch ? finalRunId : undefined,
      existingItems,
      concurrency: 3,
      signal: ctrl.signal,
      onProgress,
    });
    setResults(out);
    setRunning(false);
    abortRef.current = null;
  };

  const startSelected = async () => {
    if (selectedPlan.invalid || selectedPlan.indexes.length === 0) {
      toast.error("현재 계획 안의 셀 번호를 쉼표로 입력해 주세요.");
      return;
    }
    if (isApprovedFullBatch && !finalRunId) {
      toast.error("최종 504의 선택 재시도도 같은 lock된 서버 run 안에서만 가능합니다.");
      return;
    }
    const preflight = await preflightAdminBatch();
    if ("message" in preflight) {
      toast.error(preflight.message);
      return;
    }

    const selectedCells = selectedPlan.indexes.map((index) => plan[index]);
    const nextRunId = isApprovedFullBatch ? finalRunId : createCoreRunId(direction);
    if (!isApprovedFullBatch) {
      persistCoreRunId(direction, nextRunId);
      setCoreRunId(nextRunId);
    }
    const existingItems = isApprovedFullBatch
      ? await loadExistingCoreRunItems(nextRunId)
      : undefined;
    setRunning(true);
    setResults([]);
    setDone(0);
    setActiveTotal(selectedCells.length);
    setAuditResults([]);
    setAuditDone(0);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const out = await runCoreBatch(selectedCells, {
      runId: nextRunId,
      finalCorpusRunId: isApprovedFullBatch ? finalRunId : undefined,
      existingItems,
      itemIndexes: selectedPlan.indexes,
      concurrency: 3,
      signal: ctrl.signal,
      onProgress: (count, _total, last) => {
        setDone(count);
        setResults((previous) => [...previous, last]);
      },
    });
    setResults(out);
    setRunning(false);
    abortRef.current = null;
  };

  const stop = () => abortRef.current?.abort();

  const startFreshCoreRun = () => {
    if (running) return;
    if (
      results.length > 0
      && !window.confirm("새 배치 ID를 만들면 다음 실행은 기존 저장분을 건너뛰지 않습니다. 계속할까요?")
    ) {
      return;
    }
    const next = createCoreRunId(direction);
    if (isApprovedFullBatch) {
      setFinalRunId("");
      setFinalRunState(null);
      persistFinalCorpusRunId("");
    }
    persistCoreRunId(direction, next);
    setCoreRunId(next);
    setResults([]);
    setDone(0);
    setAuditResults([]);
    setAuditDone(0);
    toast.success("새 배치 ID를 만들었습니다.");
  };

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;
  const reusedCount = results.filter(
    (result) => result.ok && "reused" in result && result.reused,
  ).length;
  const warnCount = results.filter((r) => r.ok && r.ruleResult === "warning").length;
  const failures = results.filter((r) => !r.ok);
  const auditableCoreResults = results.filter(
    (result): result is CoreCellResult =>
      result.ok && Boolean(result.coreContent),
  );
  const auditPass = auditResults.filter((result) => result.check?.verdict === "pass").length;
  const auditWarning = auditResults.filter((result) => result.check?.verdict === "warning").length;
  const auditFail = auditResults.filter((result) => result.check?.verdict === "fail").length;
  const auditErrors = auditResults.filter((result) => !result.ok).length;

  const startCoreAudit = async () => {
    if (auditRunning || auditableCoreResults.length === 0) return;
    setAuditRunning(true);
    setAuditResults([]);
    setAuditDone(0);
    const out = await runCoreQualityPilot(auditableCoreResults, {
      concurrency: 2,
      onProgress: (count, _total, last) => {
        setAuditDone(count);
        setAuditResults((previous) => [...previous, last]);
      },
    });
    setAuditResults(out);
    setAuditRunning(false);
  };

  return (
    <AdminShell
      title="배치 생성"
      description="셀 목록을 순회해 시나리오를 일괄 생성합니다. 생성물은 검수 대기 상태로 저장됩니다."
    >
      {/* ── 생성 설정 (코어·방향·할당량 압축) ── */}
      <section className="rounded-xl border border-[#EAE4D2] bg-white p-4">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              생성 방식
            </div>
            <div className="mt-1.5">
              <Badge variant="secondary" className="px-2.5 py-1 font-semibold">
                시나리오 코어 · v1.4
              </Badge>
            </div>
          </div>

          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              언어 방향
            </div>
            <div className="mt-1.5 flex gap-1.5">
              <Button
                size="sm"
                variant={direction === "ko_zh" ? "default" : "outline"}
                onClick={() => switchDirection("ko_zh")}
                disabled={running}
              >
                {DIRECTION_LABEL.ko_zh}
              </Button>
              <Button
                size="sm"
                variant={direction === "zh_ko" ? "default" : "outline"}
                onClick={() => switchDirection("zh_ko")}
                disabled={running}
              >
                {DIRECTION_LABEL.zh_ko} · 3화행 검증
              </Button>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={loadFullBatchPreset}
            disabled={running}
          >
            최종 504 본배치 프리셋
          </Button>
        </div>

        <p className="mt-2.5 text-[12px] text-muted-foreground">
          상황·원문·태그만 생성해 코어 뱅크를 채웁니다(scenario_core_v1).{" "}
          {direction === "zh_ko"
            ? "중→한은 요청·거절·감사 3화행의 전달 커버리지 18셀을 우선 검증합니다."
            : "본 배치는 연구 구인 243셀(화행×P×D×R)과 전달 커버리지 54셀(화행×수준×모드)을 별도로 검산합니다."}
        </p>

        <div className="mt-3 border-t border-[#EAE4D2] pt-3">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            {LEVEL_ORDER.map((lv) => (
              <div key={lv} className="w-[104px]">
                <Label className="text-[11.5px] text-muted-foreground">{LEVEL[lv]}</Label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={quota.perLevel[lv]}
                  disabled={running}
                  onChange={(e) => setLevelQuota(lv, Number(e.target.value))}
                  className="mt-1 h-8 text-[13px]"
                />
                <p className="mt-1 text-[10.5px] text-muted-foreground">
                  →{" "}
                  {targetActCount * (quota.perLevel[lv] + interpretingCount(quota.perLevel[lv], quota.interpretingRatio))}
                  개
                </p>
              </div>
            ))}
            <div className="w-[104px]">
              <Label className="text-[11.5px] text-muted-foreground">통역 비율</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={quota.interpretingRatio}
                disabled={running}
                onChange={(e) =>
                  setQuota((q) => ({ ...q, interpretingRatio: Number(e.target.value) }))
                }
                className="mt-1 h-8 text-[13px]"
              />
              <p className="mt-1 text-[10.5px] text-muted-foreground">
                번역 건수 대비 통역 생성 비율
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 실행 전 분포 검산 ── */}
      <section className="mt-4 rounded-xl border border-[#EAE4D2] bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-bold">이대로 실행하면 생기는 것</h3>
          <span className="text-[20px] font-bold">{summary.total}개</span>
        </div>

        {topicCoverage.missing.length > 0 && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-900">
            ⛔ 화행·도메인 일치 topic이 없어 실행을 차단했습니다:{" "}
            {topicCoverage.missing
              .map(({ speechAct, domain }) => `${SPEECH_ACT_UI[speechAct]}×${DOMAIN[domain]}`)
              .join(", ")}
          </p>
        )}
        {topicCoverage.wildcardOnly.length > 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900">
            ⚠️ 명시 topic 없이 화행 중립 시드에만 의존하는 비블로커 조합:{" "}
            {topicCoverage.wildcardOnly
              .map(({ speechAct, domain }) => `${SPEECH_ACT_UI[speechAct]}×${DOMAIN[domain]}`)
              .join(", ")}
          </p>
        )}
        {topicCompatibility.length > 0 && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-900">
            ⛔ P·D·모드와 호환되는 topic이 없는 조합 {topicCompatibility.length}개가 있어 실행을
            차단했습니다. topic 카탈로그의 역할·매체 제약을 먼저 조정해야 합니다.
          </p>
        )}
        {fullBatchBlocked && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-900">
            ⛔ 400건 이상 실행은 승인된 504건 계획만 허용합니다. 504 프리셋을 불러오고
            243 구인셀과 54 전달셀이 모두 채워지는지 확인하십시오.
          </p>
        )}
        {isApprovedFullBatch && (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-900">
            ✅ 승인된 최종 504 본배치 계획입니다. 243 구인셀과 54 전달셀 게이트를 모두 충족합니다.
          </p>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Dist title="수준별" rows={LEVEL_ORDER.map((l) => [LEVEL[l], summary.byLevel[l] ?? 0])} />
          <Dist
            title="주제 · 도메인별"
            rows={Object.entries(DOMAIN).map(([k, label]) => [label, summary.byDomain[k] ?? 0])}
          />
          <Dist
            title="주제 · 산업별 (직장 도메인 안에서)"
            rows={Object.entries(INDUSTRY).map(([k, label]) => [label, summary.byIndustry[k] ?? 0])}
          />
          <Dist
            title="과업 유형"
            rows={[
              [MODE_LABEL.translation, summary.translation],
              [MODE_LABEL.stt_interpreting, summary.interpreting],
            ]}
          />
        </div>

        <div className="mt-4 rounded-lg bg-[#FAF8F2] px-4 py-3">
          <div className="text-[12.5px] font-semibold">시나리오 테마별 (theme) — 프리셋 선반이 비지 않게</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(THEME_LABEL).map(([k, label]) => (
              <Badge key={k} variant="secondary" className="font-normal">
                {label} {summary.byTheme[k] ?? 0}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-[#FAF8F2] px-4 py-3">
          <div className="text-[12.5px] font-semibold">화행별</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(SPEECH_ACT_UI).map(([k, label]) => (
              <Badge key={k} variant="secondary" className="font-normal">
                {label} {summary.bySpeechAct[k] ?? 0}
              </Badge>
            ))}
          </div>
        </div>

        {(() => {
          const cellUnitLabel = targetActs ? `${targetActs.length * 3 * 2}셀(${targetActs.length}화행 검증)` : "54셀";
          return summary.emptyActLevelModeCells.length > 0 ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900">
              ⚠️ 화행 × 수준 × 모드 {cellUnitLabel}(생성 수준 한정) 중 <b>{summary.emptyActLevelModeCells.length}셀이 빕니다</b>:{" "}
              {summary.emptyActLevelModeCells.join(", ")}
            </p>
          ) : (
            <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-900">
              ✅ {cellUnitLabel}(생성 수준 한정)이 모두 채워집니다 · 셀당 최소 {summary.minActLevelModeCount}개
              {summary.minActLevelModeCount < 3 && (
                <span className="text-amber-800">
                  {" "}— 500 본 배치는 셀당 ≥3 권장(현재 {summary.underMinCells.length}셀이 3 미만)
                </span>
              )}
            </p>
          );
        })()}

        {summary.emptyActPdrCells.length > 0 ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900">
            ⚠️ 연구 구인 행렬 {targetActCount * 27}셀(화행 × P × D × R) 중{" "}
            <b>{summary.emptyActPdrCells.length}셀이 빕니다.</b>{" "}
            소규모 스모크에서는 허용되지만 504건 최종 본배치에서는 0이어야 합니다.
          </p>
        ) : (
          <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-900">
            ✅ 연구 구인 행렬 {targetActCount * 27}셀이 모두 채워집니다 · 셀당 최소{" "}
            {summary.minActPdrCount}개
          </p>
        )}
      </section>

      {isApprovedFullBatch && (
        <section className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-bold">최종 코퍼스 lock · 신규 504 전용</h3>
              <p className="mt-1 max-w-3xl text-[12px] text-muted-foreground">
                기존 시나리오는 모두 <code>test_only</code>입니다. 9화행 pack·문헌 evidence·prompt·Gold·회귀·RLS가
                같은 버전으로 승인된 뒤 발급된 run만 <code>final_candidate</code>를 새 INSERT할 수 있습니다.
              </p>
            </div>
            <Badge variant={finalRunState?.status === "generating" ? "default" : "secondary"}>
              {finalRunState?.status ?? (finalRunId ? "run 확인 필요" : "lock 전")}
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="final-pack-id" className="text-[11.5px] text-muted-foreground">
                승인된 9화행 realization pack ID
              </Label>
              <Input
                id="final-pack-id"
                value={finalPackId}
                onChange={(event) => setFinalPackId(event.target.value)}
                placeholder="예: pragma_ko_zh_nine_act_v1"
                disabled={running || finalPreparing || Boolean(finalRunId)}
                className="mt-1 h-8 font-mono text-[12px]"
              />
            </div>
            <div>
              <Label htmlFor="final-lock-rationale" className="text-[11.5px] text-muted-foreground">
                lock / 종료 판단 근거
              </Label>
              <Input
                id="final-lock-rationale"
                value={finalRationale}
                onChange={(event) => setFinalRationale(event.target.value)}
                placeholder="규칙·문헌·Gold·생성계약 최종 승인 근거"
                disabled={running || finalPreparing}
                className="mt-1 h-8 text-[12px]"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={refreshFinalReadiness}
              disabled={running || finalPreparing || !finalPackId.trim()}
            >
              readiness 확인
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={prepareFinalRun}
              disabled={running || finalPreparing || Boolean(finalRunId) || !finalRationale.trim()}
            >
              {finalPreparing ? "lock 중…" : "현재 정본 lock + 504 run 시작"}
            </Button>
            {finalRunId && (
              <>
                <Button type="button" size="sm" variant="outline" onClick={refreshFinalRunState} disabled={running}>
                  run 상태 새로고침
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={closeFinalRun}
                  disabled={running || finalRunState?.status !== "generating" || !finalRationale.trim()}
                >
                  504 코어 run 닫기
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={abortFinalRun}
                  disabled={running || finalRunState?.status === "closed" || finalRunState?.status === "aborted" || !finalRationale.trim()}
                >
                  run 중단
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={releaseFinalRunCorpus}
                  disabled={running || !finalReleaseReadiness?.release_allowed || !finalRationale.trim()}
                >
                  504 전체 최종 release
                </Button>
              </>
            )}
          </div>

          {finalReadiness && !finalReadiness.generation_allowed && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900">
              아직 lock 불가 · {finalReadiness.missing_requirements.join(" · ")}
            </p>
          )}
          {finalReadiness?.generation_allowed && (
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-900">
              readiness 통과 · pack {finalReadiness.pack_version} · lock 실행 가능
            </p>
          )}
          {finalRunId && (
            <div className="mt-3 rounded-lg bg-white px-3 py-2 text-[11.5px]">
              <div>서버 run · <code className="break-all">{finalRunId}</code></div>
              {finalRunState && (
                <div className="mt-1 text-muted-foreground">
                  {finalRunState.current_item_count}/{finalRunState.target_count} 신규 코어 · 남음 {finalRunState.remaining_item_count}
                </div>
              )}
              {finalReleaseReadiness && (
                <div className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-3">
                  <span>미션 생성 {finalReleaseReadiness.requirements.missions_generated.count}/504</span>
                  <span>개별 전문가 release {finalReleaseReadiness.requirements.missions_individually_released.count}/504</span>
                  <span>권위 lineage bundle {finalReleaseReadiness.requirements.authoritative_lineage_bundle.count}/504</span>
                  <span className="sm:col-span-3 font-medium text-foreground">
                    {finalReleaseReadiness.existing_release_id
                      ? `최종 corpus release 완료 · ${finalReleaseReadiness.existing_release_id}`
                      : finalReleaseReadiness.release_allowed
                        ? "504개 전체 조건 충족 · 불변 corpus manifest 생성 가능"
                        : "일부 승인으로는 final_release 불가"}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── 실행 ── */}
      <section className="mt-4 rounded-xl border border-[#EAE4D2] bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#FAF8F2] px-3 py-2.5">
          <div className="min-w-0 text-[12px] text-muted-foreground">
            배치 ID{" "}
            <code className="break-all font-mono text-[11.5px] text-foreground">
              {coreRunId}
            </code>
            <span className="ml-2">중단 후 같은 ID로 다시 실행하면 저장 완료 항목을 건너뜁니다.</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={startFreshCoreRun}
            disabled={running}
          >
            새 배치 ID
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={start}
            disabled={
              running ||
              summary.total === 0 ||
              topicCoverage.missing.length > 0 ||
              topicCompatibility.length > 0 ||
              fullBatchBlocked ||
              (isApprovedFullBatch && !finalRunId)
            }
          >
            {running ? "생성 중…" : `${summary.total}개 생성 시작`}
          </Button>
          {running && (
            <Button variant="outline" onClick={stop}>
              중단
            </Button>
          )}
          {results.length > 0 && (
            <span className="text-[13px] text-muted-foreground">
              성공 {okCount}
              {reusedCount > 0 ? ` (기존 ${reusedCount}건 건너뜀)` : ""}
              {warnCount > 0 ? ` (경고 ${warnCount})` : ""} · 실패 {failCount}
            </span>
          )}
        </div>

        <div className="mt-4 border-t border-[#EAE4D2] pt-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <Label htmlFor="selected-core-cells" className="text-[11.5px] text-muted-foreground">
                검수용 선택 재생성 · 현재 계획의 셀 번호
              </Label>
              <Input
                id="selected-core-cells"
                value={selectedCellNumbers}
                onChange={(event) => setSelectedCellNumbers(event.target.value)}
                placeholder="예: 13, 14, 17"
                disabled={running}
                className="mt-1 h-8 text-[13px]"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={startSelected}
              disabled={
                running ||
                selectedPlan.invalid ||
                selectedPlan.indexes.length === 0 ||
                plan.length === 0
              }
            >
              선택 {selectedPlan.indexes.length}셀 · {isApprovedFullBatch ? "미저장 셀 재시도" : "새 ID로 생성"}
            </Button>
          </div>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">
            {isApprovedFullBatch
              ? "최종 run에서는 아직 저장되지 않은 실패 셀만 같은 plan identity로 재시도합니다. 이미 저장된 final candidate는 덮어쓰지 않습니다."
              : "전체 재실행 없이 사람 검수에서 탈락한 셀만 교체합니다. 실행할 때마다 새 배치 ID를 발급하며, 코어 생성 프롬프트와 해당 해시는 바뀌지 않습니다."}
          </p>
          {selectedPlan.indexes.length > 0 && !selectedPlan.invalid && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedPlan.indexes.map((index) => {
                const cell = plan[index];
                return (
                  <Badge key={index} variant="secondary" className="font-normal">
                    #{index + 1} {SPEECH_ACT_UI[cell.speech_act_ui]} · {LEVEL[cell.level]} ·{" "}
                    {MODE_LABEL[cell.mode]}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {(running || results.length > 0) && (
          <div className="mt-4">
            <Progress value={(done / Math.max(1, activeTotal)) * 100} />
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              {done} / {activeTotal}
            </p>
          </div>
        )}

        <p className="mt-4 text-[12.5px] text-muted-foreground">
          생성물은 <b>검수 대기</b>(needs_review · archived_only)로 저장됩니다.
          {isApprovedFullBatch
            ? " 최종 504는 먼저 final_candidate이며, 미션 생성·검수·release 게이트 전에는 final_release나 학습자 자료가 아닙니다."
            : " 승인 화면을 거쳐야 학습자에게 노출됩니다."}
        </p>

        {failures.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="text-[13px] font-semibold text-red-900">
              실패 {failures.length}건 — 조건과 사유
            </div>
            <ul className="mt-2 space-y-1 text-[12px] text-red-900">
              {failures.slice(0, 20).map((f) => (
                <li key={f.index}>
                  {SPEECH_ACT_UI[f.cell.speech_act_ui]} · {LEVEL[f.cell.level]} ·{" "}
                  {DOMAIN[f.cell.domain]} — {f.ruleFailFirst ?? f.error}
                  {typeof f.coreContent?.situation_ko === "string" && (
                    <span className="mt-0.5 block pl-3 text-[11px] text-red-800">
                      생성 상황 · {f.coreContent.situation_ko}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {failures.length > 20 && (
              <p className="mt-2 text-[12px] text-red-900">
                …외 {failures.length - 20}건 (같은 사유일 가능성이 높습니다)
              </p>
            )}
          </div>
        )}

        {auditableCoreResults.length > 0 && !running && (
          <div className="mt-4 rounded-lg border border-[#EAE4D2] bg-[#FAF8F2] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold">코어 축 준수 AI 비평 파일럿</div>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  감사 표시 전용이며 저장·배치 게이트가 아닙니다. 18건 눈검사와 대조해
                  BLOCKER 11건 중 9건 이상 검출하고 수용 4건을 fail로 오판하지 않을 때만 확대합니다.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={startCoreAudit}
                disabled={auditRunning}
              >
                {auditRunning
                  ? `비평 중 ${auditDone}/${auditableCoreResults.length}`
                  : `${auditableCoreResults.length}건 비평 실행`}
              </Button>
            </div>

            {auditResults.length > 0 && (
              <div className="mt-3">
                <p className="text-[12.5px] font-semibold">
                  pass {auditPass} · warning {auditWarning} · fail {auditFail} · 호출 실패 {auditErrors}
                </p>
                <ul className="mt-2 max-h-80 space-y-2 overflow-auto text-[11.5px]">
                  {auditResults.map((result) => {
                    const cell = result.source.cell;
                    const core = result.source.coreContent as {
                      situation_ko?: string;
                      relation_ko?: string;
                      source_text?: string;
                      preceding_turn?: string | null;
                      context_spec?: {
                        role_pair?: { speaker_ko?: string; addressee_ko?: string };
                        decision_authority?: string;
                      };
                    };
                    const flaggedAxes = result.check
                      ? CORE_QUALITY_AXES.filter(
                          (axis) => result.check?.axes[axis].verdict !== "pass",
                        )
                      : [];
                    return (
                      <li key={result.index} className="rounded-md border bg-white px-3 py-2">
                        <div className="font-semibold">
                          #{result.index + 1} {SPEECH_ACT_UI[cell.speech_act_ui]} · {DOMAIN[cell.domain]} ·{" "}
                          {MODE_LABEL[cell.mode]} — {result.check?.verdict ?? "error"}
                        </div>
                        <div className="mt-0.5 text-muted-foreground">
                          {result.check?.summary_ko ?? result.error}
                        </div>
                        {flaggedAxes.map((axis) => (
                          <div key={axis} className="mt-1 text-amber-900">
                            {CORE_AXIS_LABEL[axis]} {result.check?.axes[axis].verdict}:{" "}
                            {result.check?.axes[axis].reason_ko}
                          </div>
                        ))}
                        {result.check && result.check.verdict !== "pass" && (
                          <div className="mt-2 space-y-0.5 rounded bg-[#FAF8F2] px-2.5 py-2 text-[11px] leading-relaxed">
                            <div>상황 · {core.situation_ko ?? "—"}</div>
                            <div>관계 · {core.relation_ko ?? "—"}</div>
                            {core.preceding_turn && <div>상대의 직전 발화 · {core.preceding_turn}</div>}
                            <div>원문 · {core.source_text ?? "—"}</div>
                            {core.context_spec?.role_pair && (
                              <div>
                                기대 역할 · {core.context_spec.role_pair.speaker_ko ?? "—"} →{" "}
                                {core.context_spec.role_pair.addressee_ko ?? "—"}
                              </div>
                            )}
                            {core.context_spec?.decision_authority && (
                              <div>결정 권한 · {core.context_spec.decision_authority}</div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </AdminShell>
  );
};

const Dist = ({ title, rows }: { title: string; rows: [string, number][] }) => (
  <div className="rounded-lg bg-[#FAF8F2] px-4 py-3">
    <div className="text-[12.5px] font-semibold">{title}</div>
    <ul className="mt-2 space-y-1">
      {rows.map(([label, n]) => (
        <li key={label} className="flex items-baseline justify-between text-[12.5px]">
          <span className="text-muted-foreground">{label}</span>
          <span className={n === 0 ? "font-semibold text-amber-700" : "font-semibold"}>{n}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default AdminBatch;
