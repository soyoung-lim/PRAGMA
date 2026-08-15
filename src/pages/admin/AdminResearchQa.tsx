import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { SPEECH_ACT_UI } from "@/lib/pragma/enums";
import { RESEARCH_QA_SUMMARY } from "@/lib/pragma/researchQaSummary";
import type { FinalCorpusReadiness } from "@/lib/pragma/finalCorpusGeneration";

type LiveMetricKey = "lineage" | "expertReviews" | "events" | "improvements" | "calibrationReviews" | "calibrationResolutions" | "goldExpertReviews" | "goldExpertResolutions" | "goldRegressionRuns" | "finalLocks" | "finalRuns";
type LiveMetric = { value: number | null; error: string | null };
type ExpansionRequirement = { passed: boolean; [key: string]: unknown };
type ExpansionReadiness = {
  expansion_allowed: boolean;
  pack_id: string;
  pack_version: string | null;
  missing_requirements: string[];
  requirements: Record<string, ExpansionRequirement>;
};

const LIVE_TABLES: Array<{ key: LiveMetricKey; label: string; table: string }> = [
  { key: "lineage", label: "미션 lineage 버전", table: "mission_lineage_versions" },
  { key: "expertReviews", label: "독립 전문가 검토", table: "mission_expert_reviews" },
  { key: "events", label: "학습 수행 event", table: "learner_mission_events" },
  { key: "improvements", label: "개선 후보", table: "pragma_improvement_candidates" },
  { key: "calibrationReviews", label: "Seed 연구자 판정", table: "pragma_gold_calibration_reviews" },
  { key: "calibrationResolutions", label: "Seed 해결본", table: "pragma_gold_calibration_resolutions" },
  { key: "goldExpertReviews", label: "Gold 외부 전문가 검토", table: "pragma_gold_expert_reviews" },
  { key: "goldExpertResolutions", label: "Gold 외부 전문가 해결본", table: "pragma_gold_expert_resolutions" },
  { key: "goldRegressionRuns", label: "Gold release 회귀", table: "pragma_gold_regression_runs" },
  { key: "finalLocks", label: "최종 코퍼스 lock", table: "pragma_final_corpus_generation_locks" },
  { key: "finalRuns", label: "최종 504 생성 run", table: "pragma_final_corpus_generation_runs" },
];

const initialLive = Object.fromEntries(
  LIVE_TABLES.map(({ key }) => [key, { value: null, error: null }]),
) as Record<LiveMetricKey, LiveMetric>;

// 표 정의를 한 배열에서 순회하기 위해 동적 table 이름에만 제한적으로 사용한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

const READINESS_LABELS: Record<string, string> = {
  attested_pack_release: "CI가 증명한 pack release",
  researcher_gold: "연구자 승인 Gold 30건",
  expert_gold: "외부 전문가 승인 Gold 30건",
  gold_regression: "passing Gold 회귀",
  released_vertical_slice: "요청·거절·감사 released 표본",
  consented_completion_sample: "화행별 동의 참여자 3명 이상",
  flywheel_refresh: "표본 이후 개선 flywheel 집계",
  live_rls_smoke: "동일 커밋 3역할 RLS smoke",
};

const FINAL_READINESS_LABELS: Record<string, string> = {
  attested_release: "현재 CI-attested pack release",
  nine_act_scope: "승인된 9화행 범위",
  researcher_gold: "현재 pack 연구자 Gold 30건",
  expert_gold: "현재 pack 전문가 Gold 30건·화행별 3건",
  gold_regression: "현재 pack passing 회귀",
  live_rls_smoke: "동일 커밋 3역할 RLS smoke",
};

const asExpansionReadiness = (value: unknown): ExpansionReadiness | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<ExpansionReadiness>;
  if (typeof item.expansion_allowed !== "boolean" || typeof item.pack_id !== "string"
    || !Array.isArray(item.missing_requirements) || !item.requirements || typeof item.requirements !== "object") return null;
  return item as ExpansionReadiness;
};

const asFinalReadiness = (value: unknown): FinalCorpusReadiness | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<FinalCorpusReadiness>;
  if (typeof item.generation_allowed !== "boolean" || typeof item.pack_id !== "string"
    || !Array.isArray(item.missing_requirements) || !item.requirements || typeof item.requirements !== "object") return null;
  return item as FinalCorpusReadiness;
};

const StatusBadge = ({ tone, children }: { tone: "ok" | "pending" | "blocked"; children: string }) => {
  const classes = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    pending: "border-amber-200 bg-amber-50 text-amber-800",
    blocked: "border-slate-200 bg-slate-50 text-slate-600",
  }[tone];
  return <Badge variant="outline" className={classes}>{children}</Badge>;
};

const Stat = ({ label, value, note }: { label: string; value: string; note: string }) => (
  <div className="rounded-xl border border-border bg-card p-5">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">{note}</p>
  </div>
);

const Gate = ({ index, title, state, detail }: {
  index: number;
  title: string;
  state: "ok" | "pending" | "blocked";
  detail: string;
}) => (
  <li className="flex gap-3 border-b border-border py-4 last:border-0">
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#15202B] text-xs font-semibold text-white">
      {index}
    </span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{title}</p>
        <StatusBadge tone={state}>{state === "ok" ? "계약 확인" : state === "pending" ? "인간 검토 대기" : "선행 gate 필요"}</StatusBadge>
      </div>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  </li>
);

const AdminResearchQa = () => {
  const { pathname } = useLocation();
  const summary = RESEARCH_QA_SUMMARY;
  const [live, setLive] = useState(initialLive);
  const [loadingLive, setLoadingLive] = useState(true);
  const [readiness, setReadiness] = useState<ExpansionReadiness | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [finalReadiness, setFinalReadiness] = useState<FinalCorpusReadiness | null>(null);
  const [finalReadinessError, setFinalReadinessError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
      if (adminError || !isAdmin) {
        if (active) {
          setLive(Object.fromEntries(
            LIVE_TABLES.map(({ key }) => [key, { value: null, error: "관리자 인증 필요" }]),
          ) as Record<LiveMetricKey, LiveMetric>);
          setLoadingLive(false);
          setReadinessError("관리자 인증 필요");
        }
        return;
      }
      const entries = await Promise.all(
        LIVE_TABLES.map(async ({ key, table }) => {
          const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
          return [key, {
            value: error ? null : count ?? 0,
            error: error ? (error.message ?? "조회 실패") : null,
          }] as const;
        }),
      );
      const readinessResult = await db.rpc("get_pragma_moat_expansion_readiness", {
        p_pack_id: summary.pack.id,
      });
      const finalReadinessResult = await db.rpc("get_pragma_final_corpus_generation_readiness", {
        p_pack_id: summary.pack.id,
      });
      if (active) {
        setLive(Object.fromEntries(entries) as Record<LiveMetricKey, LiveMetric>);
        const parsed = asExpansionReadiness(readinessResult.data);
        setReadiness(parsed);
        setReadinessError(readinessResult.error?.message ?? (parsed ? null : "readiness 응답 형식 확인 필요"));
        const parsedFinal = asFinalReadiness(finalReadinessResult.data);
        setFinalReadiness(parsedFinal);
        setFinalReadinessError(finalReadinessResult.error?.message ?? (parsedFinal ? null : "최종 코퍼스 readiness 응답 확인 필요"));
        setLoadingLive(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const liveHasError = Object.values(live).some((metric) => metric.error);

  return (
    <AdminShell
      title="Research & QA Console"
      description="문헌 근거에서 중국어 실현 규칙, 생성 문항, 전문가 판정과 dataset release까지 이어지는 연구 계보를 확인합니다."
    >
      <section className="rounded-xl border border-[#E5CF72] bg-[#FFF9DF] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#5E4B00]">현재 자산은 calibration 전용입니다</p>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#74611A]">
              Seed Gold 30건과 smoke 미션은 최종 학습 bank가 아닙니다. 규칙·문헌·전문가 기준·생성계약을
              lock한 뒤 새 release에서 500개 이상을 전부 새로 생성합니다.
            </p>
          </div>
          <StatusBadge tone="blocked">최종 corpus 미생성</StatusBadge>
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Realization Pack" value={`v${summary.pack.version}`} note={`${summary.pack.status} · 한→중`} />
        <Stat label="화행 수직 표본" value={`${summary.pack.covered_speech_act_count}/${summary.pack.total_speech_act_count}`} note={summary.pack.covered_speech_acts.map((act) => SPEECH_ACT_UI[act]).join(" · ")} />
        <Stat label="규칙 / 위험" value={`${summary.pack.rule_count} / ${summary.pack.risk_count}`} note="문항 귀속 가능한 ID" />
        <Stat label="근거 / 원문 확인" value={`${summary.evidence.total_count} / ${summary.evidence.source_verified_count}`} note="모든 근거 lifecycle active" />
        <Stat label="최종 콘텐츠" value={`0 / ${summary.final_corpus.planned_item_count}`} note={`최소 ${summary.final_corpus.target_minimum} · lock 후 전량 신규 생성`} />
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">3화행 → 9화행 확장 readiness</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              서버가 현재 pack의 인간 검토·회귀·release·학습자 표본·운영 검증을 다시 계산합니다.
            </p>
          </div>
          <StatusBadge tone={readiness?.expansion_allowed ? "ok" : readinessError ? "blocked" : "pending"}>
            {readiness?.expansion_allowed ? "확장 허용" : readinessError ? "조회 필요" : "확장 잠금"}
          </StatusBadge>
        </div>
        {readinessError ? (
          <p className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">{readinessError}</p>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries(READINESS_LABELS).map(([key, label]) => {
              const passed = readiness?.requirements[key]?.passed === true;
              return (
                <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
                  <span className="text-sm">{label}</span>
                  <StatusBadge tone={passed ? "ok" : "blocked"}>{passed ? "충족" : "미충족"}</StatusBadge>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          상태가 모두 충족돼 관리자가 확장 근거를 append하기 전에는 CI도 4개 이상 화행을 포함한 manifest를 attestation할 수 없습니다.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-violet-200 bg-violet-50/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">최종 504 신규 생성 readiness</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              기존 행의 이름만 바꾸는 승격은 금지됩니다. 이 여섯 조건을 같은 pack version으로 만족해야 lock/run을 발급합니다.
            </p>
          </div>
          <StatusBadge tone={finalReadiness?.generation_allowed ? "ok" : finalReadinessError ? "blocked" : "pending"}>
            {finalReadiness?.generation_allowed ? "생성 허용" : finalReadinessError ? "조회 필요" : "최종 생성 잠금"}
          </StatusBadge>
        </div>
        {finalReadinessError ? (
          <p className="mt-4 rounded-lg bg-background p-4 text-sm text-muted-foreground">{finalReadinessError}</p>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries(FINAL_READINESS_LABELS).map(([key, label]) => {
              const requirement = finalReadiness?.requirements[key] as { passed?: boolean } | undefined;
              const passed = requirement?.passed === true;
              return (
                <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
                  <span className="text-sm">{label}</span>
                  <StatusBadge tone={passed ? "ok" : "blocked"}>{passed ? "충족" : "미충족"}</StatusBadge>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>504 = 9화행 × 56 · 243 P/D/R 셀 ≥2 · 54 화행/수준/모드 셀 ≥3</span>
          <Link to="/admin/batch" className="rounded-md border border-border bg-background px-3 py-1.5 font-medium text-foreground hover:bg-muted">
            최종 504 lock 화면
          </Link>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_.92fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Release gate</h2>
              <p className="mt-1 text-sm text-muted-foreground">폭을 넓히기 전에 3화행 수직 표본을 끝까지 검증합니다.</p>
            </div>
            <Badge variant="outline">test_only → final_release</Badge>
          </div>
          <ol className="mt-3">
            <Gate index={1} title="근거와 규칙의 기계적 계약" state="ok" detail={`pack ${summary.pack.version} · 문헌 locator ${summary.evidence.source_verified_count}건 · engineering self-consistency ${summary.calibration.engineering_regression.gate_status}`} />
            <Gate index={2} title="연구자 calibration 검토" state="pending" detail={`30 cases · 90 candidates · 의미 충실성 ${summary.calibration.pending_semantic_count}건이 아직 pending`} />
            <Gate index={3} title="2인 독립 전문가 검토와 이견 해결" state="pending" detail="모든 item-lineage claim을 support/revise/reject/uncertain으로 판정하고 누락을 합의로 세지 않습니다." />
            <Gate index={4} title="Expert release regression" state="blocked" detail={`현재 ${summary.calibration.expert_release_regression.gate_status}. 승인 Gold가 생기기 전에는 실행 가능한 평가로 표시하지 않습니다.`} />
            <Gate index={5} title="최종 500+ corpus release" state="blocked" detail={summary.final_corpus.generation_gate} />
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={pathname.startsWith("/prototype/") ? "/prototype/research-qa-calibration" : "/admin/research-qa/calibration"}
              className="inline-flex rounded-md bg-[#15202B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#263747]"
            >
              Seed Gold 30건 독립 판정
            </Link>
            <Link
              to={pathname.startsWith("/prototype/") ? "/prototype/expert-review-ops" : "/admin/research-qa/expert-reviews"}
              className="inline-flex rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:bg-muted"
            >
              전문가 배정·이견 해결
            </Link>
            <Link
              to={pathname.startsWith("/prototype/") ? "/prototype/gold-expert-ops" : "/admin/research-qa/gold-experts"}
              className="inline-flex rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:bg-muted"
            >
              Gold 외부 전문가 2인 검토
            </Link>
            <Link
              to={pathname.startsWith("/prototype/") ? "/prototype/mission-release" : "/admin/research-qa/releases"}
              className="inline-flex rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:bg-muted"
            >
              Gold 회귀·covered 공개
            </Link>
            <Link
              to={pathname.startsWith("/prototype/") ? "/prototype/improvement-flywheel" : "/admin/research-qa/improvements"}
              className="inline-flex rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:bg-muted"
            >
              데이터 개선 Flywheel
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">운영 누적 현황</h2>
              <p className="mt-1 text-sm text-muted-foreground">로그인한 관리자에게만 보이는 원격 DB 계수입니다.</p>
            </div>
            <StatusBadge tone={loadingLive ? "pending" : liveHasError ? "blocked" : "ok"}>
              {loadingLive ? "조회 중" : liveHasError ? "관리자 인증 필요" : "DB 연결"}
            </StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {LIVE_TABLES.map(({ key, label }) => {
              const metric = live[key];
              return (
                <div key={key} className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {loadingLive ? "…" : metric.error ? "확인 필요" : metric.value}
                  </p>
                  {metric.error && <p className="mt-1 text-xs text-destructive">권한 또는 연결을 확인하세요.</p>}
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg bg-muted/50 p-4 text-xs leading-5 text-muted-foreground">
            원본 오디오와 불필요한 클릭은 계수 대상이 아닙니다. 연구 export는 현재 동의·정책 버전과 정확한
            mission lineage를 서버가 확인한 event만 포함합니다.
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">문헌 → 규칙 → 문항 추적 계약</h2>
            <p className="mt-1 text-sm text-muted-foreground">비밀 prompt 원문 대신 버전·해시·검증 상태만 공개합니다.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/prompt-harness" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">프롬프트 정본</Link>
            <Link to="/admin/export" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">연구 export</Link>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Stat label="Item lineage schema" value={summary.lineage.schema_version.replace("mission_", "")} note="모든 학습자 노출 목표문장" />
          <Stat label="Mission contract" value="v4" note={summary.lineage.mission_prompt_version} />
          <Stat label="Attribution" value="≤ 5" note={`${summary.lineage.attribution_prompt_version} · batch`} />
          <Stat label="Prompt snapshot" value={`${summary.lineage.prompt_count}종`} note={`${summary.lineage.prompt_surface_hash.slice(0, 12)}…`} />
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>model_unattributed 경고 허용선</span>
            <span>{summary.lineage.warning_unattributed_ratio * 100}%</span>
          </div>
          <Progress value={summary.lineage.warning_unattributed_ratio * 100} className="mt-2 h-2" />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">0을 억지로 목표로 삼지 않습니다. 1~20%는 전문가 보완 경고, 초과하면 저장을 차단합니다.</p>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">근거 lifecycle</h2>
        <p className="mt-1 text-sm text-muted-foreground">문헌이 바뀌어도 기존 ID를 지우지 않고 superseded·retired 이력으로 보존합니다.</p>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evidence ID</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>검증 상태</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead>출처</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.evidence.items.map((item) => (
                <TableRow key={item.evidence_id}>
                  <TableCell className="font-mono text-xs">{item.evidence_id}</TableCell>
                  <TableCell>{item.source_kind}</TableCell>
                  <TableCell>{item.verification_status}</TableCell>
                  <TableCell><StatusBadge tone="ok">{item.lifecycle_status}</StatusBadge></TableCell>
                  <TableCell className="max-w-[260px] truncate">{item.citation_key ?? "내부 관찰·설계 근거"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </AdminShell>
  );
};

export default AdminResearchQa;
