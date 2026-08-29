type Phase = "core-pilot" | "core-priority" | "core-full" | "mission" | "audit";

// The app client persists auth in browser localStorage. The unattended Node runner
// only needs the session for this process, so provide an in-memory implementation
// before dynamically importing modules that share the app client.
const memoryStorage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    get length() { return memoryStorage.size; },
    clear() { memoryStorage.clear(); },
    getItem(key: string) { return memoryStorage.get(key) ?? null; },
    key(index: number) { return [...memoryStorage.keys()][index] ?? null; },
    removeItem(key: string) { memoryStorage.delete(key); },
    setItem(key: string, value: string) { memoryStorage.set(key, value); },
  } satisfies Storage,
});

const phase = process.argv[2] as Phase | undefined;
const runId = process.argv[3];
const phases: Phase[] = ["core-pilot", "core-priority", "core-full", "mission", "audit"];

if (!phase || !phases.includes(phase) || !runId) {
  throw new Error(`사용법: npm run content:batch -- <${phases.join("|")}> <generation-run-id>`);
}

const email = process.env.PRAGMA_BATCH_ADMIN_EMAIL;
const password = process.env.PRAGMA_BATCH_ADMIN_PASSWORD;
if (!email || !password) {
  throw new Error("PRAGMA_BATCH_ADMIN_EMAIL과 PRAGMA_BATCH_ADMIN_PASSWORD가 필요합니다.");
}

const [
  { supabase },
  { loadExistingCoreRunItems, runCoreBatch },
  { LOCK_COURSE_PRIORITY_CORE_PLAN, LOCK_FULL_CORE_PLAN, LOCK_PILOT_CORE_PLAN },
  { loadLockMissionBatchCores, runMissionBatch },
  { auditLockCandidates, loadLockCandidateRows },
] = await Promise.all([
  import("../src/integrations/supabase/client"),
  import("../src/lib/pragma/coreBatchRun"),
  import("../src/lib/pragma/contentFunnelPlan"),
  import("../src/lib/pragma/missionBatchRun"),
  import("../src/lib/pragma/lockCandidateAudit"),
]);

const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
if (signInError) throw new Error(`관리자 로그인 실패: ${signInError.message}`);

if (phase === "audit") {
  const promptHash = process.argv[4] ?? process.env.PRAGMA_LOCK_PROMPT_SNAPSHOT_HASH;
  if (!promptHash) throw new Error("audit에는 확정한 LOCK prompt snapshot hash가 필요합니다.");
  const summary = auditLockCandidates(
    await loadLockCandidateRows(runId === "all-current" ? undefined : runId),
    promptHash,
  );
  const { rows, ...compactSummary } = summary;
  console.log(JSON.stringify(
    process.env.PRAGMA_BATCH_AUDIT_DETAIL === "1" ? summary : compactSummary,
    null,
    2,
  ));
  if (!summary.targetMet || !summary.directionMinimumsMet) process.exitCode = 1;
} else if (phase === "mission") {
  const cores = await loadLockMissionBatchCores(runId);
  const requestedScenarioIds = new Set(
    (process.env.PRAGMA_BATCH_SCENARIO_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const selectedCores = requestedScenarioIds.size > 0
    ? cores.filter((core) => requestedScenarioIds.has(core.scenario_id))
    : cores;
  if (requestedScenarioIds.size > 0 && selectedCores.length !== requestedScenarioIds.size) {
    throw new Error(`요청한 scenario ID 중 현재 run에 없는 값이 있습니다: ${[...requestedScenarioIds].join(",")}`);
  }
  const results = await runMissionBatch(selectedCores, {
    concurrency: 1,
    retryFailedGenerated: true,
    stopOnBandTargetingRepeat: true,
    onProgress: (done, total, last) => {
      process.stdout.write(`\rmission ${done}/${total} last=${last.scenarioId} ${last.ok ? "ok" : "fail"}`);
    },
  });
  process.stdout.write("\n");
  const failed = results.filter((item) => !item.ok);
  const regenerationCounts = results.map((item) => item.candidateRegenerationCount ?? 0);
  const regenerationTotal = regenerationCounts.reduce((sum, count) => sum + count, 0);
  console.log(JSON.stringify({
    phase,
    runId,
    total: results.length,
    failed: failed.length,
    reused: results.filter((item) => item.reused).length,
    firstPassEligible: results.filter((item) =>
      item.firstPassQualityVerdict === "pass" || item.firstPassQualityVerdict === "warning").length,
    finalEligible: results.filter((item) =>
      item.qualityVerdict === "pass" || item.qualityVerdict === "warning").length,
    candidateRegenerationTotal: regenerationTotal,
    candidateRegenerationAveragePerMission: results.length ? regenerationTotal / results.length : 0,
    candidateRegenerationMaxPerCandidate: Math.max(0, ...results.map((item) => item.candidateRegenerationMaxPerCandidate ?? 0)),
    failures: failed.map((item) => ({
      scenarioId: item.scenarioId,
      rules: item.violations?.filter((violation) => violation.level === "fail"),
      error: item.error ?? "unknown",
    })),
  }, null, 2));
  if (failed.length > 0) process.exitCode = 1;
} else {
  const plan = phase === "core-pilot"
    ? LOCK_PILOT_CORE_PLAN
    : phase === "core-priority"
      ? LOCK_COURSE_PRIORITY_CORE_PLAN
      : LOCK_FULL_CORE_PLAN;
  const requestedIndexes = new Set(
    (process.env.PRAGMA_BATCH_ITEM_INDEXES ?? "")
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter(Number.isInteger),
  );
  const selectedPlan = requestedIndexes.size > 0
    ? plan.filter((item) => requestedIndexes.has(item.itemIndex))
    : plan;
  if (requestedIndexes.size > 0 && selectedPlan.length !== requestedIndexes.size) {
    throw new Error(`요청한 item index 중 현재 phase에 없는 값이 있습니다: ${[...requestedIndexes].join(",")}`);
  }
  const existingItems = await loadExistingCoreRunItems(runId);
  const results = await runCoreBatch(
    selectedPlan.map((item) => item.cell),
    {
      runId,
      itemIndexes: selectedPlan.map((item) => item.itemIndex),
      existingItems,
      concurrency: 3,
      onProgress: (done, total, last) => {
        process.stdout.write(`\rcore ${done}/${total} index=${last.index} ${last.ok ? "ok" : "fail"}`);
      },
    },
  );
  process.stdout.write("\n");
  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({
    phase,
    runId,
    total: results.length,
    failed: failed.length,
    reused: results.filter((item) => item.reused).length,
    failures: failed.map((item) => ({
      index: item.index,
      error: item.ruleFailFirst ?? item.error ?? "unknown",
    })),
  }, null, 2));
  if (failed.length > 0) process.exitCode = 1;
}

await supabase.auth.signOut();
