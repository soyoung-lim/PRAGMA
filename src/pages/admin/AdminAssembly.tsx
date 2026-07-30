// 「학습 미션 조립」 — /admin/assembly (2026-07-30 신설, 사용자·Codex·Claude 수렴안).
//
// 코어(미션 재료)가 학습 콘텐츠(MPJ4+DCT1 미션)로 바뀌는 결정적 변환이 이전에는
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
import { Badge } from "@/components/ui/badge";
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
import { promoteCore, reviewMission, type PromotableCore } from "@/lib/pragma/promoteMission";
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
  core_only: "border-[#EAE4D2] bg-[#FAF8F2] text-[#5B5446]",
  generated: "border-[#FCD34D] bg-[#FEF3C7] text-[#92400E]",
  reviewed: "border-[#6EE7B7] bg-[#D1FAE5] text-[#065F46]",
  failed: "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]",
};

const ACTS = Object.keys(SPEECH_ACT_UI) as SpeechActUI[];
const LEVELS: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];
const QUERY_TIMEOUT_MS = 15_000;
const LIST_CAP = 50;

const shortHash = (h: string | null) => (h ? `${h.slice(0, 8)}…` : "legacy·없음");

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
      const request = (supabase as unknown as { from: (t: string) => any })
        .from("scenarios")
        .select(
          "scenario_id, speech_act, learner_level, domain, industry_sector, mode, source_modality, theme_code, topic_code, mission_status, generation_run_id, generation_item_key, prompt_snapshot_hash, core_content",
        )
        .eq("content_format", "scenario_core_v1")
        .order("created_at", { ascending: false })
        .limit(1000);
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

  const mixedSeries = useMemo(
    () => fHash === "all" && new Set(filtered.map((r) => r.prompt_snapshot_hash ?? "null")).size > 1,
    [filtered, fHash],
  );

  const setStatus = (id: string, status: string) =>
    setRows((prev) => prev.map((r) => (r.scenario_id === id ? { ...r, mission_status: status } : r)));

  const onAssemble = async (r: CoreRow) => {
    setBusy(r.scenario_id);
    setRowMsg((m) => ({ ...m, [r.scenario_id]: "조립 중… (게이트1 프롬프트, 최대 3회)" }));
    try {
      const res = await promoteCore(r as unknown as PromotableCore);
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
        const failIds = (res.violations ?? []).filter((v) => v.level === "fail").map((v) => v.id);
        const msg = `${res.error ?? "조립 실패"}${failIds.length ? ` · ${failIds.join(",")}` : ""}`;
        setFailures((f) => ({ ...f, [r.scenario_id]: msg }));
        toast.error(msg);
      }
    } catch (e) {
      const msg = `오류: ${e instanceof Error ? e.message : e}`;
      setFailures((f) => ({ ...f, [r.scenario_id]: msg }));
    } finally {
      setBusy(null);
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
      description="저장된 미션 재료(코어)를 학습 콘텐츠(MPJ 4문항 + 직접 산출 1)로 완성하는 작업대입니다. 조립된 미션은 검수·승인을 거쳐야 학습자에게 노출됩니다."
    >
      {/* ── 변환 계기판 — 상호 배타 4상태 ── */}
      <section className="rounded-xl border border-[#EAE4D2] bg-white p-5">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {(Object.keys(STATE_KO) as AssemblyState[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFState((prev) => (prev === s ? "all" : s))}
              className={[
                "rounded-lg border px-3 py-2.5 text-left transition",
                STATE_TONE[s],
                fState === s ? "ring-2 ring-[#1d2336]" : "hover:brightness-95",
              ].join(" ")}
            >
              <div className="text-[20px] font-bold tabular-nums">{dash[s]}</div>
              <div className="text-[11.5px]">{STATE_KO[s]}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          네 상태는 서로 겹치지 않습니다. 카드를 누르면 해당 상태만 필터됩니다 · 「이번 조립 실패」는
          이 세션에서 시도한 결과이며 저장되지 않습니다.
        </p>

        {/* ── 필터 ── */}
        <div className="mt-4 flex flex-wrap gap-3 text-[12.5px]">
          <Sel label="화행" value={fAct} onChange={(v) => setFAct(v as typeof fAct)}
            opts={[["all", "전체"], ...ACTS.map((a) => [a, SPEECH_ACT_UI[a]] as [string, string])]} />
          <Sel label="수준" value={fLevel} onChange={(v) => setFLevel(v as typeof fLevel)}
            opts={[["all", "전체"], ...LEVELS.map((l) => [l, LEVEL[l]] as [string, string])]} />
          <Sel label="모드" value={fMode} onChange={(v) => setFMode(v as typeof fMode)}
            opts={[["all", "전체"], ["translation", MODE_LABEL.translation], ["stt_interpreting", MODE_LABEL.stt_interpreting]]} />
          <Sel label="언어 방향" value={fDirection} onChange={(v) => setFDirection(v as typeof fDirection)}
            opts={[["all", "전체"], ...Object.entries(DIRECTION_LABEL)]} />
          <Sel label="생성 run" value={fRun} onChange={setFRun}
            opts={[["all", "전체"], ...runIds.map((id) => [id, id.length > 22 ? `${id.slice(0, 22)}…` : id] as [string, string])]} />
          <Sel label="프롬프트 계열" value={fHash} onChange={setFHash}
            opts={[["all", "전체"], ...hashes.map((h) => [h, h === "null" ? "legacy·없음" : `${h.slice(0, 12)}…`] as [string, string])]} />
        </div>

        {/* 계열 혼합 경고 — 금지사항의 UI 안전장치 */}
        {mixedSeries && (
          <p className="mt-3 rounded-md border border-[#FCD34D] bg-[#FEF3C7] px-3 py-2 text-[12px] text-[#92400E]">
            ⚠️ 지금 목록에 <b>서로 다른 프롬프트 계열</b>이 섞여 있습니다. 서로 다른 계열의 생성물을
            한 묶음으로 조립·편성하지 않기로 확정돼 있으니, 조립 전에 「프롬프트 계열」 필터로
            한 계열을 선택하세요.
          </p>
        )}
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
            <h3 className="text-[14px] font-bold">조립 큐 — {filtered.length}개</h3>
            {filtered.length > LIST_CAP && !showAll && (
              <span className="text-[12px] text-muted-foreground">처음 {LIST_CAP}개 표시</span>
            )}
          </div>
          <ul className="space-y-2">
            {visible.map((r) => {
              const st = stateOf(r);
              return (
                <li key={r.scenario_id} className="rounded-lg bg-[#FAF8F2] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={["rounded-md border px-2 py-0.5 text-[11px]", STATE_TONE[st]].join(" ")}>
                      {STATE_KO[st]}
                    </span>
                    <Badge variant="secondary" className="font-normal">{SPEECH_ACT_UI[r.speech_act]}</Badge>
                    <Badge variant="secondary" className="font-normal">{LEVEL[r.learner_level]}</Badge>
                    <Badge variant="secondary" className="font-normal">
                      {r.mode === "stt_interpreting" ? MODE_LABEL.stt_interpreting : MODE_LABEL.translation}
                    </Badge>
                    <Badge variant="secondary" className="font-normal">{DIRECTION_LABEL[coreDirection(r.core_content)]}</Badge>
                    {r.domain && <Badge variant="secondary" className="font-normal">{DOMAIN[r.domain]}</Badge>}
                    {r.industry_sector && (
                      <Badge variant="secondary" className="font-normal">
                        {INDUSTRY[r.industry_sector as keyof typeof INDUSTRY] ?? r.industry_sector}
                      </Badge>
                    )}
                    {r.theme_code && <Badge variant="secondary" className="font-normal">{THEME_LABEL[r.theme_code]}</Badge>}
                    <Badge variant="outline" className="font-mono text-[10px] font-normal" title={r.prompt_snapshot_hash ?? "legacy"}>
                      {shortHash(r.prompt_snapshot_hash)}
                    </Badge>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[13px] font-medium">{r.core_content?.situation_ko ?? "—"}</p>
                  {failures[r.scenario_id] && st === "failed" && (
                    <p className="mt-1 rounded-md border border-[#FCA5A5] bg-[#FEE2E2] px-2.5 py-1.5 text-[12px] text-[#991B1B]">
                      {failures[r.scenario_id]}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {(st === "core_only" || st === "failed") &&
                      (DEFAULT_FEATURE_BY_ACT[r.speech_act] ? (
                        <Button size="sm" disabled={busy === r.scenario_id} onClick={() => onAssemble(r)}>
                          {busy === r.scenario_id ? "조립 중…" : st === "failed" ? "다시 조립" : "미션 조립"}
                        </Button>
                      ) : (
                        <span className="text-[11.5px] text-muted-foreground">화용 초점 카탈로그 없음 — 조립 불가</span>
                      ))}
                    {st === "generated" && (
                      <Button size="sm" variant="outline" disabled={busy === r.scenario_id} onClick={() => onReview(r)}>
                        {busy === r.scenario_id ? "처리 중…" : "검토 완료(reviewed)"}
                      </Button>
                    )}
                    {(st === "generated" || st === "reviewed") && (
                      <Button size="sm" variant="ghost" onClick={() => togglePreview(r)}>
                        {openId === r.scenario_id ? "미션 접기 ▴" : "미션 보기 ▾"}
                      </Button>
                    )}
                    {rowMsg[r.scenario_id] && (
                      <span className="text-[11.5px] text-muted-foreground">{rowMsg[r.scenario_id]}</span>
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
    </AdminShell>
  );
};

const Sel = ({
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
  <label className="flex items-center gap-1.5">
    <span className="text-muted-foreground">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 max-w-[220px] rounded-md border border-[#EAE4D2] bg-white px-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#1d2336]/30"
    >
      {opts.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  </label>
);

export default AdminAssembly;
