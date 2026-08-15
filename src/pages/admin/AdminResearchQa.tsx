import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { AdminShell } from "@/components/AdminShell";
import { ResearchWorkflowGuide } from "@/components/research/ResearchWorkflowGuide";
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
import { REVIEW_WORKLOAD } from "@/lib/pragma/reviewWorkload";

type LiveMetricKey = "lineage" | "expertReviews" | "events" | "improvements" | "calibrationReviews" | "calibrationResolutions" | "goldExpertReviews" | "goldExpertResolutions" | "goldRegressionRuns" | "finalLocks" | "finalRuns" | "finalMissionBatches" | "finalReleases";
type LiveMetric = { value: number | null; error: string | null };
type ExpansionRequirement = { passed: boolean; [key: string]: unknown };
type ExpansionReadiness = {
  expansion_allowed: boolean;
  pack_id: string;
  pack_version: string | null;
  missing_requirements: string[];
  requirements: Record<string, ExpansionRequirement>;
};
type PermissionVerification = {
  id: string;
  contract_version: string;
  status: "pass";
  source_commit_ref: string;
  run_ref: string;
  result: {
    status?: string;
    research_rows_created?: number;
    role_accounts_distinct?: boolean;
    expert_visible_assignment_count?: number;
    learner_event_count_unchanged?: boolean;
    learner_visible_event_count?: number;
  };
  verified_at: string;
};

const LIVE_TABLES: Array<{ key: LiveMetricKey; label: string; table: string }> = [
  { key: "lineage", label: "저장된 문항 버전", table: "mission_lineage_versions" },
  { key: "expertReviews", label: "AI 학습문항 외부 전문가 판단", table: "mission_expert_reviews" },
  { key: "events", label: "학습자 수행 기록", table: "learner_mission_events" },
  { key: "improvements", label: "개선 후보", table: "pragma_improvement_candidates" },
  { key: "calibrationReviews", label: "기준답안 연구자 판정 초안", table: "pragma_gold_calibration_reviews" },
  { key: "calibrationResolutions", label: "기준답안 연구자 판정 확정본", table: "pragma_gold_calibration_resolutions" },
  { key: "goldExpertReviews", label: "기준답안 외부 전문가 판단", table: "pragma_gold_expert_reviews" },
  { key: "goldExpertResolutions", label: "외부 전문가가 확인한 기준답안", table: "pragma_gold_expert_resolutions" },
  { key: "goldRegressionRuns", label: "기준답안 기반 품질 점검 자동화", table: "pragma_gold_regression_runs" },
  { key: "finalLocks", label: "최종 자료 생성 잠금", table: "pragma_final_corpus_generation_locks" },
  { key: "finalRuns", label: "최종 504개 생성 작업", table: "pragma_final_corpus_generation_runs" },
  { key: "finalMissionBatches", label: "최종 504개 문항 생성 작업", table: "pragma_final_corpus_mission_batches" },
  { key: "finalReleases", label: "학습자 공개용 자료 묶음", table: "pragma_final_corpus_releases" },
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
  attested_pack_release: "코드와 규칙집 버전 확인",
  researcher_gold: "연구자 판정 기준답안 30개",
  expert_gold: "외부 전문가가 확인한 9화행 층화표본 18개",
  gold_regression: "기준답안 기반 품질 점검 자동화 통과",
  released_vertical_slice: "요청·거절·감사 공개 표본",
  consented_completion_sample: "화행별 동의 참여자 3명 이상",
  flywheel_refresh: "표본 사용 후 개선 신호 점검",
  live_rls_smoke: "관리자·전문가·학습자 권한 검사",
};

const FINAL_READINESS_LABELS: Record<string, string> = {
  attested_release: "코드로 확인된 현재 규칙집",
  nine_act_scope: "승인된 9화행 범위",
  researcher_gold_population: "시스템 판단용 연구자 기준답안 30개·화행별 3개",
  external_content_validity: "고정 시드 층화표본 18개 외부 내용타당성 확인",
  system_judgment_gate: "기준답안 30개 기반 시스템 판단 게이트",
  live_rls_smoke: "세 사용자 역할의 실제 권한 검사",
};
const EVIDENCE_SOURCE_LABELS: Record<string, string> = {
  literature: "학술문헌",
  researcher_observation: "연구 책임자의 관찰",
  design_rationale: "설계 근거",
};
const EVIDENCE_VERIFICATION_LABELS: Record<string, string> = {
  source_verified: "원문 대조 완료",
  researcher_observation: "관찰 기록",
  design_rationale: "설계 근거 기록",
  pending: "확인 대기",
};
const EVIDENCE_LIFECYCLE_LABELS: Record<string, string> = {
  active: "현재 사용",
  superseded: "새 근거로 교체",
  retired: "사용 중단",
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

const Gate = ({ title, state, detail }: {
  title: string;
  state: "ok" | "pending" | "blocked";
  detail: string;
}) => (
  <li className="flex gap-3 border-b border-border py-4 last:border-0">
    <span aria-hidden className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#15202B]" />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{title}</p>
        <StatusBadge tone={state}>{state === "ok" ? "완료" : state === "pending" ? "검토 대기" : "앞 단계 필요"}</StatusBadge>
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
  const [permissionVerification, setPermissionVerification] = useState<PermissionVerification | null>(null);
  const [permissionVerificationError, setPermissionVerificationError] = useState<string | null>(null);

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
      const parsedFinal = asFinalReadiness(finalReadinessResult.data);
      const permissionRequirement = parsedFinal?.requirements.live_rls_smoke as { verification_id?: unknown } | undefined;
      const verificationId = typeof permissionRequirement?.verification_id === "string"
        ? permissionRequirement.verification_id
        : null;
      const permissionResult = verificationId
        ? await db.from("pragma_operational_verifications")
          .select("id,contract_version,status,source_commit_ref,run_ref,result,verified_at")
          .eq("id", verificationId)
          .limit(1)
        : { data: [], error: null };
      if (active) {
        setLive(Object.fromEntries(entries) as Record<LiveMetricKey, LiveMetric>);
        const parsed = asExpansionReadiness(readinessResult.data);
        setReadiness(parsed);
        setReadinessError(readinessResult.error?.message ?? (parsed ? null : "readiness 응답 형식 확인 필요"));
        setFinalReadiness(parsedFinal);
        setFinalReadinessError(finalReadinessResult.error?.message ?? (parsedFinal ? null : "최종 코퍼스 readiness 응답 확인 필요"));
        setPermissionVerification(((permissionResult.data ?? [])[0] as PermissionVerification | undefined) ?? null);
        setPermissionVerificationError(permissionResult.error?.message ?? null);
        setLoadingLive(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const liveHasError = Object.values(live).some((metric) => metric.error);

  return (
    <AdminShell
      title="품질 검증과 공개 전체 현황"
      description="기준답안 판정부터 AI 학습문항 자동 점검과 학습자 공개까지, 수업 전에 마쳐야 할 네 단계의 진행 상태를 확인합니다."
    >
      <ResearchWorkflowGuide current="overview" />
      <section className="rounded-xl border border-[#E5CF72] bg-[#FFF9DF] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#5E4B00]">현재 자료는 품질확인용 시험 자료이며 정식 학습자료가 아닙니다</p>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#74611A]">
              품질검사 기준답안 30개와 시험용 AI 학습문항으로 규칙을 먼저 확인합니다. 규칙·문헌·외부 전문가 판단기준을 확정한 뒤
              정식 학습자료 504개를 모두 새로 생성합니다.
            </p>
          </div>
          <StatusBadge tone="blocked">정식 자료 생성 전</StatusBadge>
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="중국어 표현 규칙집" value={`v${summary.pack.version}`} note={`${summary.pack.status === "seed" ? "초기 시험본" : summary.pack.status} · 한→중`} />
        <Stat label="준비된 화행" value={`${summary.pack.covered_speech_act_count}/${summary.pack.total_speech_act_count}`} note={summary.pack.covered_speech_acts.map((act) => SPEECH_ACT_UI[act]).join(" · ")} />
        <Stat label="표현 규칙 / 주의사항" value={`${summary.pack.rule_count} / ${summary.pack.risk_count}`} note="각 문항에 연결해 확인 가능" />
        <Stat label="등록 근거 / 원문 확인" value={`${summary.evidence.total_count} / ${summary.evidence.source_verified_count}`} note="변경·삭제 이력까지 보존" />
        <Stat label="정식 학습자료" value={`0 / ${summary.final_corpus.planned_item_count}`} note={`최소 ${summary.final_corpus.target_minimum}개 · 확정 후 전량 신규 생성`} />
      </section>

      <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">9월 수업 전 연구자·외부 전문가 판정 업무량</h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-amber-950/80">
              시스템은 504개 전량을 점검하고 연구 책임자는 자동 통과 결과를 전부 확인하되 경고 문항에 시간을 집중합니다.
              외부 전문가 2명은 서버가 사전 추출한 18개만 독립 확인합니다.
            </p>
          </div>
          <Badge variant="outline" className="border-amber-400 bg-white text-amber-900">전문가 전수 검토 없음</Badge>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-amber-200 bg-white p-4">
            <p className="text-xs font-semibold text-amber-800">연구 책임자 · 기준답안 30개</p>
            <p className="mt-2 text-2xl font-semibold">필수 입력 {REVIEW_WORKLOAD.researcher.requiredInputCount.toLocaleString()}개</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">선택 판정 300개 + 서술 근거 120개, 이후 확정 동작 30회</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-white p-4">
            <p className="text-xs font-semibold text-amber-800">외부 전문가 1인 · 9화행 층화표본 18개</p>
            <p className="mt-2 text-2xl font-semibold">필수 입력 {REVIEW_WORKLOAD.goldExpertPerPerson.requiredInputCount.toLocaleString()}개</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">최초 화행별 2개 · 목표 {REVIEW_WORKLOAD.goldExpertPerPerson.estimatedMinutes[0]}분, 최대 {REVIEW_WORKLOAD.goldExpertPerPerson.estimatedMinutes[1]}분 · 지적 화행만 예비 사례 추가</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-white p-4">
            <p className="text-xs font-semibold text-amber-800">연구 책임자 · 504개 자동 결과 확인</p>
            <p className="mt-2 text-2xl font-semibold">약 {REVIEW_WORKLOAD.researcherFinalCorpus.estimatedHours[0]}~{REVIEW_WORKLOAD.researcherFinalCorpus.estimatedHours[1]}시간</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">자동 통과 여부 전수 확인 + 경고·의심 문항 집중 검토. 전량 정밀검토 주장이 아님</p>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-amber-950/75">
          45~60분은 아직 실제 측정값이 아닙니다. 먼저 5개 표본으로 예비검토를 하고, 60분을 넘으면 화행 수를 줄이지 않고 반복 입력과 서술 항목을 간소화합니다.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">나머지 6개 화행으로 확장할 준비</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              요청·거절·감사 3개 화행의 품질을 충분히 확인해야 나머지 6개 화행의 규칙을 추가할 수 있습니다.
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
          모든 항목이 충족되기 전에는 시스템이 4개 이상의 화행을 정식 규칙집으로 승인하지 않습니다.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-violet-200 bg-violet-50/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">정식 학습자료 504개를 새로 만들 준비</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              시험용 자료의 이름만 바꿔 재사용하지 않습니다. 아래 여섯 조건을 같은 규칙집 버전으로 충족한 뒤 새로 생성합니다.
            </p>
          </div>
          <StatusBadge tone={finalReadiness?.generation_allowed ? "ok" : finalReadinessError ? "blocked" : "pending"}>
            {finalReadiness?.generation_allowed ? "생성 가능" : finalReadinessError ? "확인 필요" : "아직 생성 불가"}
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
                <div key={key} className="rounded-lg border border-border bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">{label}</span>
                    <StatusBadge tone={passed ? "ok" : "blocked"}>{passed ? "충족" : "미충족"}</StatusBadge>
                  </div>
                  {key === "live_rls_smoke" && (
                    <details className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
                      <summary className="cursor-pointer font-medium text-foreground">권한 검사 결과 자세히 보기</summary>
                      {permissionVerificationError ? (
                        <p className="mt-2">검사 기록 조회 실패: {permissionVerificationError}</p>
                      ) : permissionVerification ? (
                        <div className="mt-3 space-y-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <p><strong className="text-foreground">검사 결과:</strong> 통과</p>
                            <p><strong className="text-foreground">검사 시각:</strong> {new Date(permissionVerification.verified_at).toLocaleString("ko-KR")}</p>
                            <p><strong className="text-foreground">검사 규약:</strong> {permissionVerification.contract_version}</p>
                            <p><strong className="text-foreground">코드 버전:</strong> {permissionVerification.source_commit_ref.slice(0, 12)}</p>
                            <p><strong className="text-foreground">서로 다른 3계정:</strong> {permissionVerification.result.role_accounts_distinct ? "확인" : "확인 필요"}</p>
                            <p><strong className="text-foreground">검사 중 연구자료 생성:</strong> {permissionVerification.result.research_rows_created ?? "—"}건</p>
                            <p><strong className="text-foreground">전문가 본인 배정 조회:</strong> {permissionVerification.result.expert_visible_assignment_count ?? "—"}건</p>
                            <p><strong className="text-foreground">학습자 기록 수 불변:</strong> {permissionVerification.result.learner_event_count_unchanged ? "확인" : "확인 필요"}</p>
                          </div>
                          <div className="rounded-md bg-muted/50 p-3">
                            <p className="font-medium text-foreground">이 검사에서 확인한 접근 경계</p>
                            <ul className="mt-1 list-disc space-y-1 pl-5">
                              <li>관리자만 공개·전문가 등록·개선 판정 기능을 실행할 수 있음</li>
                              <li>외부 전문가는 본인에게 배정된 검토만 볼 수 있음</li>
                              <li>학습자는 전문가 배정과 관리자 기능에 접근할 수 없음</li>
                              <li>실패 경로 검사 중 학습자 수행기록과 연구자료가 추가되지 않음</li>
                            </ul>
                          </div>
                          <p>실행 기록: {permissionVerification.run_ref}</p>
                        </div>
                      ) : (
                        <p className="mt-2">아직 실제 관리자·외부 전문가·학습자 계정으로 권한검사를 실행하지 않았습니다.</p>
                      )}
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>504 = 9화행 × 56 · 243 P/D/R 셀 ≥2 · 54 화행/수준/모드 셀 ≥3</span>
          <Link to="/admin/batch" className="rounded-md border border-border bg-background px-3 py-1.5 font-medium text-foreground hover:bg-muted">
            504개 생성 화면
          </Link>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_.92fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">학습자 공개 전 확인 항목</h2>
              <p className="mt-1 text-sm text-muted-foreground">네 단계 안에서 확인해야 할 근거와 시스템 조건입니다. 별도의 단계 번호가 아닙니다.</p>
            </div>
            <Badge variant="outline">시험용 → 학습자 공개용</Badge>
          </div>
          <ol className="mt-3">
            <Gate title="문헌과 중국어 규칙 연결 확인" state="ok" detail={`규칙집 ${summary.pack.version} · 원문 확인 문헌 ${summary.evidence.source_verified_count}건 · 기본 검사 통과`} />
            <Gate title="품질검사 기준답안 30개 연구자 판정" state="pending" detail={`대표 상황 30개 · 중국어 후보 90개 · 아직 확인할 의미 판단 ${summary.calibration.pending_semantic_count}건`} />
            <Gate title="사전 추출 18개 외부 내용타당성 확인" state="pending" detail="서버 고정 시드로 화행별 2개를 먼저 추출합니다. 지적 화행은 사전 등록 규칙대로 예비 사례를 추가 확인합니다." />
            <Gate title="504개 자동 점검 확인·경고 집중 검토" state="blocked" detail="자동 점검 결과는 전부 확인하지만 모든 문항을 수동으로 정밀 판정했다는 의미는 아닙니다." />
            <Gate title="교수자가 정식 학습자료 504개 공개 승인" state="blocked" detail="앞의 모든 조건을 통과한 뒤 PRAGMA 학습자 화면에서 사용할 수 있게 최종 승인합니다." />
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={pathname.startsWith("/prototype/") ? "/prototype/research-qa-calibration" : "/admin/research-qa/calibration"}
              className="inline-flex rounded-md bg-[#15202B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#263747]"
            >
              1. 품질검사 기준답안 연구자 판정
            </Link>
            <Link
              to={pathname.startsWith("/prototype/") ? "/prototype/gold-expert-ops" : "/admin/research-qa/gold-experts"}
              className="inline-flex rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:bg-muted"
            >
              2. 기준답안 외부 전문가 확인
            </Link>
            <Link
              to={pathname.startsWith("/prototype/") ? "/prototype/final-review" : "/admin/research-qa/final-review"}
              className="inline-flex rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:bg-muted"
            >
              3. 504개 자동 결과 확인·경고 검토
            </Link>
            <Link
              to={pathname.startsWith("/prototype/") ? "/prototype/mission-release" : "/admin/research-qa/releases"}
              className="inline-flex rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold transition hover:bg-muted"
            >
              4. 통과 문항을 학습자에게 공개
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">품질 검증에 연결된 운영 기록</h2>
              <p className="mt-1 text-sm text-muted-foreground">실제 관리자 로그인 후 서버에 저장된 건수를 확인할 수 있습니다.</p>
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
            이 건수는 절차가 실제 데이터베이스와 연결되었는지 확인하는 운영 기록이며, 문항 품질을 대표하는 성능 수치가 아닙니다.
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">이 문항이 왜 이렇게 만들어졌는지 추적</h2>
            <p className="mt-1 text-sm text-muted-foreground">각 문항을 문헌 근거, 중국어 규칙, 생성 버전까지 거슬러 확인할 수 있습니다.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/prompt-harness" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">생성 규칙 확인</Link>
            <Link to="/admin/generator" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">문항 생성 화면</Link>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Stat label="문항별 생성근거 기록" value="1판" note="모든 중국어 목표문장에 적용" />
          <Stat label="AI 생성 규칙" value="4판" note="같은 버전으로 재현 가능" />
          <Stat label="문항당 연결 근거" value="최대 5개" note="규칙·위험·문헌 연결" />
          <Stat label="저장된 생성 지시" value={`${summary.lineage.prompt_count}종`} note="원문 대신 변조 확인값 보존" />
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>근거가 자동 연결되지 않은 문항의 경고선</span>
            <span>{summary.lineage.warning_unattributed_ratio * 100}%</span>
          </div>
          <Progress value={summary.lineage.warning_unattributed_ratio * 100} className="mt-2 h-2" />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">20% 이하는 전문가가 근거를 보완할 수 있지만, 20%를 넘으면 저장을 막습니다.</p>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">문헌·설계 근거의 변경 이력</h2>
        <p className="mt-1 text-sm text-muted-foreground">문헌이 추가·교체·삭제되어도 과거 근거를 지우지 않고 변경 이유와 함께 보존합니다.</p>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>내부 근거번호</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>근거 확인 상태</TableHead>
                <TableHead>현재 상태</TableHead>
                <TableHead>출처</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.evidence.items.map((item) => (
                <TableRow key={item.evidence_id}>
                  <TableCell className="font-mono text-xs">{item.evidence_id}</TableCell>
                  <TableCell>{EVIDENCE_SOURCE_LABELS[item.source_kind] ?? item.source_kind}</TableCell>
                  <TableCell>{EVIDENCE_VERIFICATION_LABELS[item.verification_status] ?? item.verification_status}</TableCell>
                  <TableCell><StatusBadge tone="ok">{EVIDENCE_LIFECYCLE_LABELS[item.lifecycle_status] ?? item.lifecycle_status}</StatusBadge></TableCell>
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
