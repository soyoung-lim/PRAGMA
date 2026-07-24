import { useMemo, useRef, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  DOMAIN,
  INDUSTRY,
  LEVEL,
  MODE_LABEL,
  SPEECH_ACT_UI,
  type LearnerLevel,
} from "@/lib/pragma/enums";
import {
  DEFAULT_QUOTA,
  buildBatchPlan,
  interpretingCount,
  summarizePlan,
  type BatchQuota,
} from "@/lib/pragma/batchPlan";
import { runBatch, type BatchCellResult } from "@/lib/pragma/batchRun";
import { runCoreBatch, type CoreCellResult } from "@/lib/pragma/coreBatchRun";
import { THEME_LABEL } from "@/lib/pragma/scenarioTopics";

type AnyResult = BatchCellResult | CoreCellResult;
type GenMode = "core" | "legacy";

// 배치 생성 — 셀 목록을 순회하며 기존 생성기를 반복 호출한다.
//
// 이 화면의 핵심은 '실행'이 아니라 **실행 전 분포 검산**이다.
// 화행 × 수준만 채우면 개수는 늘어도 도메인·산업·통역이 한쪽으로 쏠리고,
// 교강사가 "직장 · 무역" 필터를 눌렀을 때 0건이 나온다.
// 그래서 계획을 먼저 보여주고, 무엇이 몇 개 생기는지 눈으로 확인한 뒤 돌린다.
//
// 접근 제어는 다른 /admin/* 화면과 동일하게 DB(RLS·is_admin)에 맡긴다.
// 저장 RPC가 관리자만 허용하므로 비관리자 세션은 전건 실패로 드러난다.

const LEVEL_ORDER: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];

const AdminBatch = () => {
  const [quota, setQuota] = useState<BatchQuota>(DEFAULT_QUOTA);
  const [genMode, setGenMode] = useState<GenMode>("core");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<AnyResult[]>([]);
  const [done, setDone] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const plan = useMemo(() => buildBatchPlan(quota), [quota]);
  const summary = useMemo(() => summarizePlan(plan), [plan]);

  const setLevelQuota = (level: LearnerLevel, value: number) =>
    setQuota((q) => ({ ...q, perLevel: { ...q.perLevel, [level]: Math.max(0, value) } }));

  const start = async () => {
    setRunning(true);
    setResults([]);
    setDone(0);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const onProgress = (d: number, _total: number, last: AnyResult) => {
      setDone(d);
      setResults((prev) => [...prev, last]);
    };
    const out =
      genMode === "core"
        ? await runCoreBatch(plan, {
            runId: `core_${Date.now()}`,
            concurrency: 3,
            signal: ctrl.signal,
            onProgress,
          })
        : await runBatch(plan, { concurrency: 3, signal: ctrl.signal, onProgress });
    setResults(out);
    setRunning(false);
    abortRef.current = null;
  };

  const stop = () => abortRef.current?.abort();

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;
  const warnCount = results.filter(
    (r) => r.ok && "ruleResult" in r && r.ruleResult === "warning",
  ).length;
  const failures = results.filter((r) => !r.ok);

  return (
    <AdminShell
      title="배치 생성"
      description="셀 목록을 순회해 시나리오를 일괄 생성합니다. 생성물은 검수 대기 상태로 저장됩니다."
    >
      {/* ── 생성 모드 ── */}
      <section className="rounded-xl border border-[#EAE4D2] bg-white p-5">
        <h3 className="text-[15px] font-bold">생성 모드</h3>
        <div className="mt-3 flex gap-2">
          <Button
            variant={genMode === "core" ? "default" : "outline"}
            onClick={() => !running && setGenMode("core")}
            disabled={running}
          >
            시나리오 코어 (v1.4)
          </Button>
          <Button
            variant={genMode === "legacy" ? "default" : "outline"}
            onClick={() => !running && setGenMode("legacy")}
            disabled={running}
          >
            레거시 (candidates)
          </Button>
        </div>
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          {genMode === "core"
            ? "상황·원문·태그만 생성해 500개 뱅크를 채웁니다(scenario_core_v1). 미션(MPJ+DCT)은 편성 선별분만 승격 생성."
            : "⚠️ 구버전 — candidates+feedback(판단형 셸용). 신규 뱅크에는 코어 모드를 쓰세요."}
        </p>
      </section>

      {/* ── 할당량 ── */}
      <section className="mt-4 rounded-xl border border-[#EAE4D2] bg-white p-5">
        <h3 className="text-[15px] font-bold">할당량</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          수준별로 <b>화행당 번역 개수</b>를 정합니다(통역은 아래 비율로 자동, 셀당 최소 1 보장). 중급이
          실증 코호트라 기본값이 가장 두껍습니다. 화행9 × 수준3 × <b>모드2 = 54셀</b>이 감사 단위입니다.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {LEVEL_ORDER.map((lv) => (
            <div key={lv}>
              <Label className="text-[13px]">{LEVEL[lv]}</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={quota.perLevel[lv]}
                disabled={running}
                onChange={(e) => setLevelQuota(lv, Number(e.target.value))}
                className="mt-1"
              />
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                화행9 × (번역 {quota.perLevel[lv]} + 통역{" "}
                {interpretingCount(quota.perLevel[lv], quota.interpretingRatio)}) ={" "}
                {9 * (quota.perLevel[lv] + interpretingCount(quota.perLevel[lv], quota.interpretingRatio))}개
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 max-w-[240px]">
          <Label className="text-[13px]">통역 비율</Label>
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
            className="mt-1"
          />
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            대면·전화 = 통역, 이메일·메신저 = 번역
          </p>
        </div>
      </section>

      {/* ── 실행 전 분포 검산 ── */}
      <section className="mt-4 rounded-xl border border-[#EAE4D2] bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-bold">이대로 실행하면 생기는 것</h3>
          <span className="text-[20px] font-bold">{summary.total}개</span>
        </div>

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
          <div className="text-[12.5px] font-semibold">강좌 테마별 (theme) — 프리셋 선반이 비지 않게</div>
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

        {summary.emptyActLevelModeCells.length > 0 ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900">
            ⚠️ 화행 × 수준 × 모드 54셀(생성 수준 한정) 중 <b>{summary.emptyActLevelModeCells.length}셀이 빕니다</b>:{" "}
            {summary.emptyActLevelModeCells.join(", ")}
          </p>
        ) : (
          <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-900">
            ✅ 54셀(생성 수준 한정)이 모두 채워집니다 · 셀당 최소 {summary.minActLevelModeCount}개
            {summary.minActLevelModeCount < 3 && (
              <span className="text-amber-800">
                {" "}— 500 본 배치는 셀당 ≥3 권장(현재 {summary.underMinCells.length}셀이 3 미만)
              </span>
            )}
          </p>
        )}
      </section>

      {/* ── 실행 ── */}
      <section className="mt-4 rounded-xl border border-[#EAE4D2] bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={start} disabled={running || summary.total === 0}>
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
              {genMode === "core" && warnCount > 0 ? ` (경고 ${warnCount})` : ""} · 실패 {failCount}
            </span>
          )}
        </div>

        {(running || results.length > 0) && (
          <div className="mt-4">
            <Progress value={(done / Math.max(1, plan.length)) * 100} />
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              {done} / {plan.length}
            </p>
          </div>
        )}

        <p className="mt-4 text-[12.5px] text-muted-foreground">
          생성물은 <b>검수 대기</b>(needs_review · archived_only)로 저장됩니다. 승인 화면을 거쳐야
          학습자에게 노출됩니다.
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
                  {DOMAIN[f.cell.domain]} — {f.error}
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
