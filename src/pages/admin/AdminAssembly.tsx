// 「학습 미션 조립」 — /admin/assembly (2026-07-30 신설, 사용자·Codex·Claude 수렴안).
//
// 코어(미션 재료)가 학습 콘텐츠(네이티브 MPJ5+DCT1 미션)로 바뀌는 결정적 변환이 이전에는
// 라이브러리 행 안의 작은 버튼으로 숨어 있었다. 이 화면이 그 변환의 정식 작업대다:
//   미션 재료 라이브러리 → [학습 미션 조립] → 검수·승인 → 주차별 편성
//
// 계기판은 누적이 아니라 **상호 배타 4상태**로 보여준다(Codex 지적 — "328 → n"
// 표기는 앞 숫자에 뒤 상태가 포함되는지 모호하다): 코어만 / 미션 생성됨 / 검토완료
// / 이번 세션 조립 실패.
//
// prompt_snapshot_hash 필터는 편의가 아니라 안전장치다 — 서로 다른 생성 계열
// (예: dc8f1494… 신계열 vs 구계열·legacy NULL)을 한 배치에 섞어 조립하는 것은
// 금지사항이다. A2(다중 선택·일괄 조립)는 별도 승인 후 이 화면에 추가된다.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  DOMAIN,
  DIRECTION_LABEL,
  INDUSTRY,
  LEVEL,
  MODE_LABEL,
  SPEECH_ACT_UI,
  type Domain,
  type GenMode,
  type LanguageDirection,
  type LearnerLevel,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import { coreDirection } from "@/lib/pragma/coreSchema";
import { THEME_LABEL, type ThemeCode } from "@/lib/pragma/scenarioTopics";
import { DEFAULT_FEATURE_BY_ACT } from "@/lib/pragma/targetFeatures";
import {
  promoteCore,
  reviewMission,
  supersedeMissionForRework,
  type PromotableCore,
  type PromoteStage,
} from "@/lib/pragma/promoteMission";
import { fetchMissionForReview } from "@/lib/mission/missionDb";
import { MissionPreview } from "@/components/admin/MissionPreview";
import type { MissionRuntime } from "@/lib/pragma/missionSchema";
import { toast } from "sonner";

interface CoreRow {
  scenario_id: string;
  speech_act: SpeechActUI;
  learner_level: LearnerLevel;
  domain: Domain | null;
  industry_sector: string | null;
  mode: GenMode | null;
  source_modality: string | null;
  theme_code: ThemeCode | null;
  topic_code: string | null;
  mission_status: string | null;
  generation_run_id: string | null;
  generation_item_key: string | null;
  prompt_snapshot_hash: string | null;
  core_content: {
    situation_ko?: string;
    relation_ko?: string;
    source_text?: string;
    source_text_ko?: string;
    direction?: string;
  } | null;
}

// 상호 배타 4상태. failed는 DB 상태가 아니라 이번 세션의 조립 시도 결과다.
type AssemblyState = "core_only" | "generated" | "reviewed" | "failed";
const STATE_KO: Record<AssemblyState, string> = {
  core_only: "코어만 (조립 대기)",
  generated: "미션 생성됨 (검수 대기)",
  reviewed: "검토 완료",
  failed: "이번 조립 실패",
};
const STATE_TONE: Record<AssemblyState, string> = {
  core_only: "border-[#DDE1E2] bg-[#F3F5F5] text-[#59656D]",
  generated: "border-[#E7D9B8] bg-[#F8F3E8] text-[#765F1C]",
  reviewed: "border-[#CEE0D4] bg-[#EDF5F0] text-[#38634B]",
  failed: "border-[#E5CFCC] bg-[#F7EFEE] text-[#7B453F]",
};
const STATE_CARD_TONE: Record<AssemblyState, string> = {
  core_only: "border-[#DDE1E2] bg-[#F5F6F6]",
  generated: "border-[#D8E0E3] bg-[#EEF2F4]",
  reviewed: "border-[#D0DDE1] bg-[#E7EEF0]",
  failed: "border-[#E2D5D2] bg-[#F3ECEA]",
};

const ACTS = Object.keys(SPEECH_ACT_UI) as SpeechActUI[];
const LEVELS: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];
const QUERY_TIMEOUT_MS = 15_000;
const LIST_CAP = 50;
// 조회 상한. 495 배치를 두 번 돌리면 코어가 1000을 넘어 상한에 조용히 잘린다
// (2026-07-31 실측 1299건) — 상한에 닿으면 화면에 알린다.
const ROW_CAP = 4000;
const CORE_ROW_SELECT =
  "scenario_id, speech_act, learner_level, domain, industry_sector, mode, source_modality, theme_code, topic_code, mission_status, generation_run_id, generation_item_key, prompt_snapshot_hash, core_content";

const PROGRESS_STEPS = ["미션 생성", "규칙 검사", "AI 품질 점검", "저장"] as const;

const progressIndex = (stage: PromoteStage) => {
  if (stage.phase === "generating" || stage.phase === "preparing") return 0;
  if (stage.phase === "checking") return 1;
  if (stage.phase === "quality") return 2;
  return 3;
};

const progressLabel = (stage: PromoteStage) => {
  if (stage.phase === "preparing") return "조립 조건 확인";
  if (stage.phase === "generating") return `미션 생성 · ${stage.attempt}/${stage.maxAttempts}차`;
  if (stage.phase === "checking") return `규칙 검사 · ${stage.attempt}/${stage.maxAttempts}차`;
  if (stage.phase === "quality") return "AI 품질 점검";
  return "미션 저장";
};

const AdminAssembly = () => {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<CoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 라이브러리 「조립에서 열기」가 넘긴 초기 필터.
  const initAct = searchParams.get("act");
  const initLevel = searchParams.get("level");

  const [fState, setFState] = useState<"all" | AssemblyState>("all");
  const [fAct, setFAct] = useState<"all" | SpeechActUI>(
    ACTS.includes(initAct as SpeechActUI) ? (initAct as SpeechActUI) : "all",
  );
  const [fLevel, setFLevel] = useState<"all" | LearnerLevel>(
    LEVELS.includes(initLevel as LearnerLevel) ? (initLevel as LearnerLevel) : "all",
  );
  const [fMode, setFMode] = useState<"all" | GenMode>("all");
  const [fDirection, setFDirection] = useState<"all" | LanguageDirection>("all");
  const [fRun, setFRun] = useState<string>("all");
  const [fHash, setFHash] = useState<string>("all");
  const [showAll, setShowAll] = useState(false);

  const [busy, setBusy] = useState<string | null>(null);
  const [assemblyProgress, setAssemblyProgress] = useState<{
    id: string;
    stage: PromoteStage;
  } | null>(null);
  // 이번 세션의 조립 실패: scenario_id → 실패 사유(R규칙 포함).
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, { mission: MissionRuntime; warnings: string[] }>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      // scenarios의 신규 조립 메타 컬럼이 생성 타입보다 앞서 배포돼 임시 query builder cast가 필요하다.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const request = (supabase as unknown as { from: (t: string) => any })
        .from("scenarios")
        .select(CORE_ROW_SELECT)
        .eq("content_format", "scenario_core_v1")
        .neq("review_status", "revise_required")
        .order("created_at", { ascending: false })
        .limit(ROW_CAP);
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("조회 시간이 15초를 초과했습니다.")), QUERY_TIMEOUT_MS);
      });
      const { data, error: queryError } = await Promise.race([
        request as PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
        timeout,
      ]);
      if (queryError) throw new Error(queryError.message);
      setRows((data ?? []) as CoreRow[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "코어를 불러오지 못했습니다.");
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const stateOf = useCallback(
    (r: CoreRow): AssemblyState => {
      if (failures[r.scenario_id] && !r.mission_status) return "failed";
      if (r.mission_status === "reviewed") return "reviewed";
      if (r.mission_status === "generated") return "generated";
      return "core_only";
    },
    [failures],
  );

  const runIds = useMemo(
    () => [...new Set(rows.map((r) => r.generation_run_id).filter(Boolean))] as string[],
    [rows],
  );
  const hashes = useMemo(() => {
    const set = new Set(rows.map((r) => r.prompt_snapshot_hash ?? "null"));
    return [...set];
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (fState === "all" || stateOf(r) === fState) &&
          (fAct === "all" || r.speech_act === fAct) &&
          (fLevel === "all" || r.learner_level === fLevel) &&
          (fMode === "all" || r.mode === fMode) &&
          (fDirection === "all" || coreDirection(r.core_content) === fDirection) &&
          (fRun === "all" || r.generation_run_id === fRun) &&
          (fHash === "all" || (r.prompt_snapshot_hash ?? "null") === fHash),
      ),
    [rows, fState, fAct, fLevel, fMode, fDirection, fRun, fHash, stateOf],
  );

  // 계기판 — 필터 적용 결과 기준, 상호 배타.
  const dash = useMemo(() => {
    const d: Record<AssemblyState, number> = { core_only: 0, generated: 0, reviewed: 0, failed: 0 };
    for (const r of filtered) d[stateOf(r)] += 1;
    return d;
  }, [filtered, stateOf]);

  const setStatus = (id: string, status: string) =>
    setRows((prev) => prev.map((r) => (r.scenario_id === id ? { ...r, mission_status: status } : r)));

  const onAssemble = async (r: CoreRow) => {
    setBusy(r.scenario_id);
    setAssemblyProgress({ id: r.scenario_id, stage: { phase: "preparing" } });
    setRowMsg((m) => ({ ...m, [r.scenario_id]: "" }));
    try {
      const res = await promoteCore(r as unknown as PromotableCore, {
        qualityGate: "required_non_fail",
        onProgress: (stage) =>
          setAssemblyProgress((current) =>
            current?.id === r.scenario_id ? { ...current, stage } : current,
          ),
      });
      if (res.ok) {
        setStatus(r.scenario_id, "generated");
        setFailures((f) => {
          const { [r.scenario_id]: _drop, ...rest } = f;
          return rest;
        });
        // 검증②(0-n·94) 결과가 있으면 함께 알린다 — 없으면(호출 실패) 침묵하지 않고 표기.
        const qLabel = res.quality
          ? { pass: "AI점검 통과", warning: "AI점검 주의", fail: "AI점검 결함" }[res.quality.verdict]
          : "AI점검 미실행";
        setRowMsg((m) => ({
          ...m,
          [r.scenario_id]: `생성됨(${res.ruleResult}, 시도 ${res.attempts}회) · ${qLabel} — 눈검사 후 검토 완료 처리`,
        }));
        if (res.mission) {
          const warnings = (res.violations ?? [])
            .filter((v) => v.level === "warning")
            .map((v) => `${v.id}: ${v.message}`);
          // 품질점검은 저장 직전에 붙으므로 엣지 응답 미션에는 없다 — 미리보기용으로 합친다.
          const withQuality = res.quality ? { ...res.mission, quality_check: res.quality } : res.mission;
          setPreview((m) => ({ ...m, [r.scenario_id]: { mission: withQuality, warnings } }));
          setOpenId(r.scenario_id); // 조립 직후 바로 눈검사 뷰 펼침
        }
        if (res.quality?.verdict === "fail") {
          toast.warning("미션 조립됨 — AI 품질점검에서 결함이 보고되었습니다. 눈검사 필요");
        } else {
          toast.success("미션 조립 완료 — 검수 대기(generated)");
        }
      } else {
        const failViolations = (res.violations ?? []).filter((v) => v.level === "fail");
        const failIds = [...new Set(failViolations.map((v) => v.id))];
        const failDetails = failViolations.map((v) => `${v.id}: ${v.message}`).join(" / ");
        const msg = [
          `${res.error ?? "조립 실패"}${failIds.length ? ` · ${failIds.join(",")}` : ""}`,
          failDetails,
        ]
          .filter(Boolean)
          .join(" — ");
        setFailures((f) => ({ ...f, [r.scenario_id]: msg }));
        toast.error(msg);
      }
    } catch (e) {
      const msg = `오류: ${e instanceof Error ? e.message : e}`;
      setFailures((f) => ({ ...f, [r.scenario_id]: msg }));
    } finally {
      setBusy(null);
      setAssemblyProgress(null);
    }
  };

  const onReview = async (r: CoreRow) => {
    setBusy(r.scenario_id);
    try {
      const res = await reviewMission(r.scenario_id);
      if (res.ok) {
        setStatus(r.scenario_id, "reviewed");
        toast.success("검토 완료(reviewed) — 학습자 실행 가능");
      } else {
        toast.error(res.error ?? "검토 처리 실패");
      }
    } finally {
      setBusy(null);
    }
  };

  const onRework = async (r: CoreRow) => {
    setBusy(r.scenario_id);
    setRowMsg((m) => ({ ...m, [r.scenario_id]: "기존 생성물을 보존하고 재작업 코어를 만드는 중…" }));
    try {
      const superseded = await supersedeMissionForRework(r.scenario_id);
      if (superseded.ok === false) {
        toast.error(superseded.error);
        return;
      }

      // RPC가 만든 정확한 run/item 메타를 다시 읽어 provenance에도 새 값을 사용한다.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = await (supabase as unknown as { from: (t: string) => any })
        .from("scenarios")
        .select(CORE_ROW_SELECT)
        .eq("scenario_id", superseded.scenarioId)
        .single();
      if (fetchError || !data) throw new Error(fetchError?.message ?? "재작업 코어 조회 실패");

      const replacement = data as CoreRow;
      setRows((prev) => [replacement, ...prev.filter((row) => row.scenario_id !== r.scenario_id)]);
      setPreview((prev) => {
        const { [r.scenario_id]: _drop, ...rest } = prev;
        return rest;
      });
      setOpenId(null);
      setBusy(null);
      toast.info("기존 미션은 반려 이력으로 보존했습니다. 새 코어를 재조립합니다.");
      await onAssemble(replacement);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "반려·재조립 준비 실패");
    } finally {
      setBusy(null);
    }
  };

  const togglePreview = async (r: CoreRow) => {
    if (openId === r.scenario_id) {
      setOpenId(null);
      return;
    }
    setOpenId(r.scenario_id);
    if (!preview[r.scenario_id]) {
      try {
        const res = await fetchMissionForReview(r.scenario_id);
        if (res) setPreview((m) => ({ ...m, [r.scenario_id]: { mission: res.mission, warnings: [] } }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "미션 조회 실패");
      }
    }
  };

  const visible = showAll ? filtered : filtered.slice(0, LIST_CAP);

  return (
    <AdminShell
      title="학습 미션 조립"
      description="코어를 MPJ 5문항과 직접 산출 과제로 완성하고, 검수 가능한 학습 미션으로 저장합니다."
    >
      <div className="max-w-[1080px]">
      {/* ── 변환 계기판 — 상호 배타 4상태 ── */}
      <section className="rounded-xl border border-[#E2DED2] bg-white p-5">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {(Object.keys(STATE_KO) as AssemblyState[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFState((prev) => (prev === s ? "all" : s))}
              className={[
                "relative overflow-hidden rounded-lg border px-4 pb-3 pt-4 text-left transition-colors",
                STATE_CARD_TONE[s],
                fState === s
                  ? "ring-1 ring-[#233542]"
                  : "hover:brightness-[0.985]",
              ].join(" ")}
            >
              <span className="absolute inset-x-0 top-0 h-1 bg-[#18232D]" />
              <div className="text-[22px] font-bold tabular-nums text-[#182229]">{dash[s]}</div>
              <div className="mt-0.5 text-[12px] font-medium text-[#46515A]">{STATE_KO[s]}</div>
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-[11px] text-muted-foreground">
          카드를 선택하면 해당 상태만 표시합니다. 「이번 조립 실패」는 현재 작업 중 발생한 결과입니다.
        </p>
        {rows.length >= ROW_CAP && (
          <p className="mt-2 rounded-md border border-[#FCD34D] bg-[#FEF3C7] px-3 py-2 text-[12px] text-[#92400E]">
            ⚠️ 조회 상한 {ROW_CAP}건에 도달했습니다 — 최신 {ROW_CAP}건만 보고 있습니다. 아래 숫자를
            전체 현황으로 읽지 마세요.
          </p>
        )}

        {/* ── 학습설계 축과 생성 기준은 역할이 다르므로 시각적으로 분리한다. ── */}
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.45fr_1fr]">
          <div className="rounded-lg border border-[#DDE2E4] border-t-4 border-t-[#18232D] bg-[#F8FAFA] p-3.5 pt-3">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-bold text-[#233542]">학습설계 4축</h3>
                <p className="mt-0.5 text-[11px] text-[#6B7780]">화행 · 수준 · 모드 · 언어방향</p>
              </div>
              <span className="rounded-full bg-[#E7ECEE] px-2 py-1 text-[10.5px] font-semibold text-[#53656F]">
                PRAGMA 편성 기준
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <AxisSel index="1" label="화행" value={fAct} onChange={(v) => setFAct(v as typeof fAct)}
                opts={[["all", "전체"], ...ACTS.map((a) => [a, SPEECH_ACT_UI[a]] as [string, string])]} />
              <AxisSel index="2" label="수준" value={fLevel} onChange={(v) => setFLevel(v as typeof fLevel)}
                opts={[["all", "전체"], ...LEVELS.map((l) => [l, LEVEL[l]] as [string, string])]} />
              <AxisSel index="3" label="모드" value={fMode} onChange={(v) => setFMode(v as typeof fMode)}
                opts={[["all", "전체"], ["translation", MODE_LABEL.translation], ["stt_interpreting", MODE_LABEL.stt_interpreting]]} />
              <AxisSel index="4" label="언어방향" value={fDirection} onChange={(v) => setFDirection(v as typeof fDirection)}
                opts={[["all", "전체"], ...Object.entries(DIRECTION_LABEL)]} />
            </div>
          </div>

          <div className="rounded-lg border border-[#E6E1D5] border-t-4 border-t-[#18232D] bg-[#FBFAF6] p-3.5 pt-3">
            <h3 className="text-[13px] font-bold text-[#3D464D]">생성 기준</h3>
            <p className="mt-0.5 text-[11px] text-[#737069]">같은 생성 조건의 코어만 조립</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <CompactSel label="생성 run" value={fRun} onChange={setFRun}
                opts={[["all", "전체"], ...runIds.map((id) => [id, id.length > 18 ? `${id.slice(0, 18)}…` : id] as [string, string])]} />
              <CompactSel label="프롬프트 계열" value={fHash} onChange={setFHash}
                opts={[["all", "전체"], ...hashes.map((h) => [h, h === "null" ? "legacy·없음" : `${h.slice(0, 10)}…`] as [string, string])]} />
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <p className="mt-4 text-[13px] text-muted-foreground">불러오는 중…</p>
      ) : error ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
          <p>조회 실패: {error} 관리자 로그인 상태를 확인해 주세요.</p>
          <Button size="sm" variant="outline" onClick={() => void loadRows()}>다시 불러오기</Button>
        </div>
      ) : (
        <section className="mt-4 space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <div>
              <h3 className="text-[15px] font-bold text-[#202B33]">조립 큐</h3>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">선택한 조건의 코어 {filtered.length}개</p>
            </div>
            {filtered.length > LIST_CAP && !showAll && (
              <span className="text-[12px] text-muted-foreground">처음 {LIST_CAP}개 표시</span>
            )}
          </div>
          <ul className="space-y-2">
            {visible.map((r) => {
              const st = stateOf(r);
              const isAssembling = busy === r.scenario_id && assemblyProgress?.id === r.scenario_id;
              const contextLabels = [
                r.domain ? DOMAIN[r.domain] : null,
                r.industry_sector
                  ? (INDUSTRY[r.industry_sector as keyof typeof INDUSTRY] ?? r.industry_sector)
                  : null,
                r.theme_code ? THEME_LABEL[r.theme_code] : null,
              ].filter(Boolean) as string[];
              return (
                <li key={r.scenario_id} className="rounded-lg border border-[#E7E2D7] bg-[#FBFAF6] px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={["rounded-md border px-2 py-0.5 text-[11px]", STATE_TONE[st]].join(" ")}>
                      {STATE_KO[st]}
                    </span>
                    <AxisBadge label="화행" value={SPEECH_ACT_UI[r.speech_act]} />
                    <AxisBadge label="수준" value={LEVEL[r.learner_level]} />
                    <AxisBadge label="모드" value={r.mode === "stt_interpreting" ? MODE_LABEL.stt_interpreting : MODE_LABEL.translation} />
                    <AxisBadge label="방향" value={DIRECTION_LABEL[coreDirection(r.core_content)]} />
                  </div>
                  {/* 읽기 폭과 행간을 확보해 태그와 본문이 한 덩어리로 붙어 보이지 않게 한다. */}
                  <p className="mt-3 line-clamp-2 max-w-[54rem] text-[13.5px] font-medium leading-[1.75] text-[#202B33]">
                    {r.core_content?.situation_ko ?? "—"}
                  </p>
                  {contextLabels.length > 0 && (
                    <p className="mt-2 text-[11.5px] text-[#758087]">
                      <span className="font-semibold text-[#5D6970]">맥락</span>
                      <span className="mx-1.5 text-[#B2B8BB]">·</span>
                      {contextLabels.join(" · ")}
                    </p>
                  )}
                  {failures[r.scenario_id] && st === "failed" && (
                    <p className="mt-2.5 rounded-md border border-[#E5CFCC] bg-[#F7EFEE] px-3 py-2 text-[12px] leading-relaxed text-[#7B453F]">
                      {failures[r.scenario_id]}
                    </p>
                  )}
                  <div className={[
                    "mt-3 grid items-center gap-3 border-t border-[#ECE8DE] pt-3",
                    isAssembling ? "sm:grid-cols-[auto_minmax(0,1fr)]" : "sm:grid-cols-1",
                  ].join(" ")}>
                    <div className="flex flex-wrap items-center gap-2">
                      {(st === "core_only" || st === "failed") &&
                        (DEFAULT_FEATURE_BY_ACT[r.speech_act] ? (
                          <Button size="sm" disabled={busy === r.scenario_id} onClick={() => onAssemble(r)}>
                            {isAssembling && <span className="mr-1.5 size-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                            {isAssembling ? "조립 중" : st === "failed" ? "다시 조립" : "미션 조립"}
                          </Button>
                        ) : (
                          <span className="text-[11.5px] text-muted-foreground">화용 초점 카탈로그 없음 — 조립 불가</span>
                        ))}
                      {st === "generated" && (
                        <>
                          <Button size="sm" variant="outline" disabled={busy === r.scenario_id} onClick={() => onReview(r)}>
                            {busy === r.scenario_id ? "처리 중…" : "검토 완료(reviewed)"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy === r.scenario_id}
                            title="현재 생성물은 이력에 보존하고 같은 코어로 새 미션을 조립합니다."
                            onClick={() => onRework(r)}
                          >
                            반려·재조립
                          </Button>
                        </>
                      )}
                      {(st === "generated" || st === "reviewed") && (
                        <Button size="sm" variant="ghost" onClick={() => togglePreview(r)}>
                          {openId === r.scenario_id ? "미션 접기 ▴" : "미션 보기 ▾"}
                        </Button>
                      )}
                      {!isAssembling && rowMsg[r.scenario_id] && (
                        <span className="text-[11.5px] text-muted-foreground">{rowMsg[r.scenario_id]}</span>
                      )}
                    </div>
                    {isAssembling && assemblyProgress && (
                      <AssemblyProgressView stage={assemblyProgress.stage} />
                    )}
                  </div>
                  {openId === r.scenario_id && preview[r.scenario_id] && (
                    <MissionPreview
                      mission={preview[r.scenario_id].mission}
                      warnings={preview[r.scenario_id].warnings}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {filtered.length > LIST_CAP && !showAll && (
            <Button variant="outline" className="w-full" onClick={() => setShowAll(true)}>
              전체 {filtered.length}개 모두 표시
            </Button>
          )}
          {filtered.length === 0 && (
            <p className="rounded-md border border-dashed border-[#EAE4D2] bg-white px-4 py-8 text-center text-[13px] text-muted-foreground">
              조건에 맞는 재료가 없습니다. 필터를 조정하거나 미션 재료 생성에서 코어를 만드세요.
            </p>
          )}
        </section>
      )}
      </div>
    </AdminShell>
  );
};

const SelectField = ({
  value,
  onChange,
  opts,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  opts: [string, string][];
  className?: string;
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`h-8 w-full min-w-0 rounded-md border border-[#D9D7CF] bg-white px-2 text-[12px] text-[#26333B] focus:outline-none focus:ring-2 focus:ring-[#526B78]/20 ${className}`}
  >
    {opts.map(([v, l]) => (
      <option key={v} value={v}>{l}</option>
    ))}
  </select>
);

const AxisSel = ({
  index,
  label,
  value,
  onChange,
  opts,
}: {
  index: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  opts: [string, string][];
}) => (
  <label className="rounded-md border border-[#E1E5E6] bg-white p-2">
    <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#34444D]">
      <span className="flex size-4 items-center justify-center rounded-full bg-[#E7ECEE] text-[9px] text-[#53656F]">{index}</span>
      {label}
    </span>
    <SelectField value={value} onChange={onChange} opts={opts} />
  </label>
);

const CompactSel = ({
  label,
  value,
  onChange,
  opts,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opts: [string, string][];
}) => (
  <label>
    <span className="mb-1 block text-[10.5px] font-medium text-[#696D6C]">{label}</span>
    <SelectField value={value} onChange={onChange} opts={opts} />
  </label>
);

const AxisBadge = ({ label, value }: { label: string; value: string }) => (
  <span className="inline-flex overflow-hidden rounded-md border border-[#D8E0E2] bg-white text-[10.5px]">
    <span className="bg-[#E7ECEE] px-1.5 py-0.5 font-semibold text-[#53656F]">{label}</span>
    <span className="px-1.5 py-0.5 font-medium text-[#26343C]">{value}</span>
  </span>
);

const AssemblyProgressView = ({
  stage,
}: {
  stage: PromoteStage;
}) => {
  const activeIndex = progressIndex(stage);
  return (
    <div className="min-w-0 rounded-md bg-[#F1F4F5] px-3 py-2" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11.5px] font-semibold text-[#233542]">{progressLabel(stage)}</span>
      </div>
      <ol className="mt-1.5 grid grid-cols-4 gap-1.5">
        {PROGRESS_STEPS.map((label, index) => {
          const isActive = index === activeIndex;
          const isDone = index < activeIndex;
          return (
            <li key={label} className="min-w-0">
              <span
                className={[
                  "block h-1 rounded-full transition-colors",
                  isActive ? "bg-[#233542]" : isDone ? "bg-[#6F8794]" : "bg-[#DDE4E6]",
                ].join(" ")}
              />
              <span className={[
                "mt-1 block truncate text-[10px]",
                isActive ? "font-semibold text-[#233542]" : isDone ? "text-[#53656F]" : "text-[#98A1A6]",
              ].join(" ")}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default AdminAssembly;
