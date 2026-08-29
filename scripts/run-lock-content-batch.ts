import { supabase } from "../src/integrations/supabase/client";
import { loadExistingCoreRunItems, runCoreBatch } from "../src/lib/pragma/coreBatchRun";
import {
  LOCK_COURSE_PRIORITY_CORE_PLAN,
  LOCK_FULL_CORE_PLAN,
  LOCK_PILOT_CORE_PLAN,
} from "../src/lib/pragma/contentFunnelPlan";
import { loadLockMissionBatchCores, runMissionBatch } from "../src/lib/pragma/missionBatchRun";
import { auditLockCandidates, loadLockCandidateRows } from "../src/lib/pragma/lockCandidateAudit";

type Phase = "core-pilot" | "core-priority" | "core-full" | "mission" | "audit";

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

const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
if (signInError) throw new Error(`관리자 로그인 실패: ${signInError.message}`);

if (phase === "audit") {
  const promptHash = process.argv[4] ?? process.env.PRAGMA_LOCK_PROMPT_SNAPSHOT_HASH;
  if (!promptHash) throw new Error("audit에는 확정한 LOCK prompt snapshot hash가 필요합니다.");
  const summary = auditLockCandidates(await loadLockCandidateRows(), promptHash);
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.targetMet || !summary.directionMinimumsMet) process.exitCode = 1;
} else if (phase === "mission") {
  const cores = await loadLockMissionBatchCores(runId);
  const results = await runMissionBatch(cores, {
    concurrency: 2,
    onProgress: (done, total, last) => {
      process.stdout.write(`\rmission ${done}/${total} last=${last.scenarioId} ${last.ok ? "ok" : "fail"}`);
    },
  });
  process.stdout.write("\n");
  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({ phase, runId, total: results.length, failed: failed.length, reused: results.filter((item) => item.reused).length }, null, 2));
  if (failed.length > 0) process.exitCode = 1;
} else {
  const plan = phase === "core-pilot"
    ? LOCK_PILOT_CORE_PLAN
    : phase === "core-priority"
      ? LOCK_COURSE_PRIORITY_CORE_PLAN
      : LOCK_FULL_CORE_PLAN;
  const existingItems = await loadExistingCoreRunItems(runId);
  const results = await runCoreBatch(
    plan.map((item) => item.cell),
    {
      runId,
      itemIndexes: plan.map((item) => item.itemIndex),
      existingItems,
      concurrency: 3,
      onProgress: (done, total, last) => {
        process.stdout.write(`\rcore ${done}/${total} index=${last.index} ${last.ok ? "ok" : "fail"}`);
      },
    },
  );
  process.stdout.write("\n");
  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({ phase, runId, total: results.length, failed: failed.length, reused: results.filter((item) => item.reused).length }, null, 2));
  if (failed.length > 0) process.exitCode = 1;
}

await supabase.auth.signOut();
