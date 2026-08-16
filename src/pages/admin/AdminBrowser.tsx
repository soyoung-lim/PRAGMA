import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
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
import { fetchMissionForReview } from "@/lib/mission/missionDb";
import { MissionPreview } from "@/components/admin/MissionPreview";
import type { MissionRuntime } from "@/lib/pragma/missionSchema";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { buildGeneratorPrefillPath } from "@/lib/pragma/adminGeneratorPrefill";

// 시나리오 브라우저 — 뱅크의 "풍부함"을 화행 9 × 수준 3 그리드로 가시화한다.
// 교강사가 수준·주제·모드로 걸러 어떤 셀에 무엇이 있는지 보고, 칸을 눌러 미리본다.
// 읽기 전용. 데이터는 scenario_core_v1(코어)만. RLS(is_admin)로 admin만 전건 조회.

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
  scenario_p: string | null;
  scenario_d: string | null;
  scenario_r: string | null;
  review_status: string | null;
  mission_status: string | null;
  generation_run_id: string | null;
  generation_item_key: string | null;
  prompt_snapshot_hash: string | null;
  core_content: {
    situation_ko?: string;
    relation_ko?: string;
    source_text?: string;
    source_text_ko?: string;
    preceding_turn?: string | null;
    preceding_turn_zh?: string | null;
    direction?: string;
    /** 실제 자료 기반 생성의 출처(0-q·98). 순수 AI 생성에는 없다. */
    provenance?: { source_type?: string; source_ref?: string | null } | null;
  } | null;
}

// 생성 소스 1차 구분(2026-07-30, 사용자·Codex 합의): 세부 출처(문구/이미지/유튜브)는
// provenance에 보존돼 있지만 95%가 AI 생성이라 카드마다 배지를 달면 소음이다 —
// 화면은 "실제 자료 기반"만 배지·필터로 구분한다.
const isAuthentic = (cc: CoreRow["core_content"]) => !!cc?.provenance?.source_type;
const AUTHENTIC_SOURCE_KO: Record<string, string> = {
  authentic_text: "직접 문구",
  authentic_image: "이미지 캡처",
  authentic_youtube: "YouTube 자막",
};

const ACTS = Object.keys(SPEECH_ACT_UI) as SpeechActUI[];
const LEVELS: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];
const LEVEL_CELL_TONE: Record<LearnerLevel, { rgb: string; text: string }> = {
  beginner_intermediate: { rgb: "255, 241, 184", text: "#7A6418" },
  intermediate: { rgb: "220, 233, 223", text: "#496557" },
  advanced: { rgb: "220, 232, 240", text: "#4B6575" },
};
const CORE_QUERY_TIMEOUT_MS = 15_000;
// 495 배치를 두 번 돌리면 코어가 1000을 넘어 상한에 조용히 잘린다(2026-07-31 실측 1299).
const ROW_CAP = 4000;

const AdminBrowser = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fMode, setFMode] = useState<"all" | GenMode>("all");
  const [fDomain, setFDomain] = useState<"all" | Domain>("all");
  const [fTheme, setFTheme] = useState<"all" | ThemeCode>("all");
  const [fDirection, setFDirection] = useState<"all" | LanguageDirection>("all");
  const [fSource, setFSource] = useState<"all" | "ai" | "authentic">("all");
  const [sel, setSel] = useState<{ act: SpeechActUI; level: LearnerLevel } | null>(null);
  // 눈검사 미리보기 — scenario_id → {mission, warnings}. openId = 펼친 행.
  const [preview, setPreview] = useState<Record<string, { mission: MissionRuntime; warnings: string[] }>>({});
  const [openId, setOpenId] = useState<string | null>(null);

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

  // 2026-07-30: 조립·검토 액션은 /admin/assembly로 이관 — 이 화면은 조회 전용.
  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const request = supabase
        .from("scenarios")
        .select(
          "scenario_id, speech_act, learner_level, domain, industry_sector, mode, source_modality, theme_code, topic_code, scenario_p, scenario_d, scenario_r, review_status, mission_status, generation_run_id, generation_item_key, prompt_snapshot_hash, core_content",
        )
        .eq("content_format", "scenario_core_v1")
        .order("created_at", { ascending: false })
        .limit(ROW_CAP);
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("조회 시간이 15초를 초과했습니다.")),
          CORE_QUERY_TIMEOUT_MS,
        );
      });
      const { data, error: queryError } = await Promise.race([
        request as PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
        timeout,
      ]);
      if (queryError) throw new Error(queryError.message);
      setRows((data ?? []) as CoreRow[]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "시나리오 코어를 불러오지 못했습니다.",
      );
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (fMode === "all" || r.mode === fMode) &&
          (fDomain === "all" || r.domain === fDomain) &&
          (fTheme === "all" || r.theme_code === fTheme) &&
          (fDirection === "all" || coreDirection(r.core_content) === fDirection) &&
          (fSource === "all" ||
            (fSource === "authentic" ? isAuthentic(r.core_content) : !isAuthentic(r.core_content))),
      ),
    [rows, fMode, fDomain, fTheme, fDirection, fSource],
  );

  // (act|level) → { total, translation, interpreting } (54셀 감사 대응 — 계약 0-j·73)
  const counts = useMemo(() => {
    const m: Record<string, { total: number; t: number; i: number }> = {};
    for (const r of filtered) {
      const k = `${r.speech_act}|${r.learner_level}`;
      const c = (m[k] ??= { total: 0, t: 0, i: 0 });
      c.total += 1;
      if (r.mode === "stt_interpreting") c.i += 1;
      else c.t += 1;
    }
    return m;
  }, [filtered]);

  const cellRows = useMemo(
    () => (sel ? filtered.filter((r) => r.speech_act === sel.act && r.learner_level === sel.level) : []),
    [filtered, sel],
  );

  const reviewed = filtered.filter((r) => r.mission_status === "reviewed").length;
  const interp = filtered.filter((r) => r.mode === "stt_interpreting").length;
  const translated = filtered.length - interp;
  const hasActiveFilters =
    fMode !== "all" ||
    fDomain !== "all" ||
    fTheme !== "all" ||
    fDirection !== "all" ||
    fSource !== "all";
  const maxCellCount = Math.max(0, ...Object.values(counts).map((count) => count.total));

  return (
    // 2026-07-30: 「미션 조립」→「시나리오 라이브러리」(URL도 /admin/library).
    // 이 화면은 조회·필터(라이브러리)가 절반, 코어→미션 승격이 절반이다 —
    // promoteCore·reviewMission이 여기서 실행된다. 승격 기능은 이름 대신 설명이 말한다.
    <AdminShell
      title="학습 콘텐츠 코어 라이브러리"
      description="화행·수준·통번역 모드에 따라 코어를 조회하고, 선택한 코어를 학습 미션으로 조립합니다."
    >
      <div className="max-w-[1080px]">
        {/* ── 요약 ── */}
        <section className="rounded-xl border border-[#E2DED2] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(21,32,43,0.04)]">
          <div className="flex flex-wrap items-end gap-3">
            <div
              className="flex min-w-[350px] shrink-0 flex-wrap items-center gap-x-3.5 gap-y-1 rounded-lg bg-[#F5F5F2] px-3.5 py-2"
              aria-label="코어 현황"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[13.5px] font-semibold text-[#42505A]">코어</span>
                <span className="text-[24px] font-bold tabular-nums text-[#15202B]">{filtered.length}</span>
                {hasActiveFilters && (
                  <span className="text-[11.5px] text-muted-foreground">전체 {rows.length} 중</span>
                )}
              </div>
              <span className="h-6 w-px bg-[#D8D8D2]" aria-hidden="true" />
              <div className="grid gap-1 leading-none">
                <span className="text-[11.5px] font-medium text-[#7A8288]">모드 구성</span>
                <span className="text-[12.5px] font-semibold text-[#4E5A62]">번역 {translated} · 통역 {interp}</span>
              </div>
              <span className="h-6 w-px bg-[#D8D8D2]" aria-hidden="true" />
              <div className="grid gap-1 leading-none">
                <span className="text-[11.5px] font-medium text-[#5C7B67]">수업 배치</span>
                <span className="text-[12.5px] font-bold text-[#33684A]">가능 {reviewed}</span>
              </div>
              {rows.length >= ROW_CAP && (
                <span className="rounded bg-[#FEF3C7] px-2 py-0.5 text-[10.5px] text-[#92400E]">
                  최신 {ROW_CAP}건만 표시
                </span>
              )}
            </div>

            {/* ── 필터 ── */}
            <div className="flex flex-wrap items-end gap-2 border-l border-[#E0DDD4] pl-3 text-[12px]" aria-label="코어 필터">
              <span className="mb-1.5 mr-0.5 text-[11px] font-bold tracking-[0.08em] text-[#6C747A]">필터</span>
              <Filter className="w-full sm:w-[96px]" label="모드" value={fMode} onChange={(v) => setFMode(v as typeof fMode)}
                opts={[["all", "전체"], ["translation", MODE_LABEL.translation], ["stt_interpreting", MODE_LABEL.stt_interpreting]]} />
              <Filter className="w-full sm:w-[92px]" label="도메인" value={fDomain} onChange={(v) => setFDomain(v as typeof fDomain)}
                opts={[["all", "전체"], ...Object.entries(DOMAIN)]} />
              <Filter className="w-full sm:w-[148px]" label="시나리오 테마" value={fTheme} onChange={(v) => setFTheme(v as typeof fTheme)}
                opts={[["all", "전체"], ...Object.entries(THEME_LABEL)]} />
              <Filter className="w-full sm:w-[108px]" label="언어 방향" value={fDirection} onChange={(v) => setFDirection(v as typeof fDirection)}
                opts={[["all", "전체"], ...Object.entries(DIRECTION_LABEL)]} />
              <Filter className="w-full sm:w-[126px]" label="생성 소스" value={fSource} onChange={(v) => setFSource(v as typeof fSource)}
                opts={[["all", "전체"], ["ai", "AI 생성"], ["authentic", "실제 자료 기반"]]} />
            </div>
          </div>
        </section>

      {loading ? (
        <p className="mt-4 text-[13px] text-muted-foreground">불러오는 중…</p>
      ) : error ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
          <p>조회 실패: {error} 관리자 로그인 상태를 확인해 주세요.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadRows()}>
            다시 불러오기
          </Button>
        </div>
      ) : (
        <>
          {/* ── 27칸 그리드 ── */}
          <section className="mt-4 overflow-x-auto rounded-xl border border-[#E2DED2] bg-white px-5 py-4 shadow-[0_6px_18px_rgba(21,32,43,0.04)]">
            <div className="max-w-[980px]">
            {/* 화행 × 수준이 이 화면의 본론이다. 전폭이면 칸 하나가 330px가 되어 숫자 사이가
                  벌어지고 화행 라벨은 저 멀리 왼쪽에 남는다 — 표를 내용 폭까지만 넓히고
                  라벨을 칸 쪽으로 붙인다. */}
            <table className="w-full min-w-[620px] border-separate border-spacing-x-1.5 border-spacing-y-1 text-[13px]">
              <thead>
                <tr>
                  <th className="w-[82px] pr-2 text-right text-[11.5px] font-semibold text-muted-foreground">
                    화행
                  </th>
                  {LEVELS.map((lv) => (
                    <th key={lv} className="px-2 py-1 text-center font-semibold">{LEVEL[lv]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACTS.map((act) => (
                  <tr key={act}>
                    <td className="py-1 pr-3 text-right text-[13.5px] font-bold text-foreground">
                      {SPEECH_ACT_UI[act]}
                    </td>
                    {LEVELS.map((lv) => {
                      const c = counts[`${act}|${lv}`] ?? { total: 0, t: 0, i: 0 };
                      const n = c.total;
                      const active = sel?.act === act && sel?.level === lv;
                      const density = maxCellCount > 0 ? n / maxCellCount : 0;
                      const tone = LEVEL_CELL_TONE[lv];
                      return (
                        <td key={lv} className="text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (n > 0) {
                                setSel({ act, level: lv });
                                return;
                              }
                              navigate(
                                buildGeneratorPrefillPath({
                                  speechAct: act,
                                  level: lv,
                                  mode: fMode === "all" ? undefined : fMode,
                                  domain: fDomain === "all" ? undefined : fDomain,
                                  direction: fDirection === "all" ? undefined : fDirection,
                                  theme: fTheme === "all" ? undefined : fTheme,
                                }),
                              );
                            }}
                            aria-label={
                              n === 0
                                ? `${SPEECH_ACT_UI[act]} · ${LEVEL[lv]} 조건으로 개별 생성 화면 열기`
                                : `${SPEECH_ACT_UI[act]} · ${LEVEL[lv]} 코어 ${n}개 보기`
                            }
                            className={`flex h-10 w-full cursor-pointer flex-col items-center justify-center rounded-md leading-none transition-[filter] duration-150 hover:brightness-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E2F3A]/50 ${
                              active
                                ? "bg-[#1E2F3A] text-white shadow-[0_3px_9px_rgba(30,47,58,0.18)]"
                                : n === 0
                                  ? "border border-dashed border-amber-300 bg-[#FAF8F2] text-amber-700 hover:bg-amber-50"
                                  : "text-[#15202B]"
                            }`}
                            style={
                              !active && n > 0
                                ? { backgroundColor: `rgba(${tone.rgb}, ${0.6 + density * 0.4})` }
                                : undefined
                            }
                            title={
                              n === 0
                                ? "조건을 자동 입력한 개별 생성 화면으로 이동합니다. 생성은 자동 시작되지 않습니다."
                                : `번역 ${c.t} / 통역 ${c.i}`
                            }
                          >
                            <span className="text-[14px] font-semibold">{n}</span>
                            {n === 0 ? (
                              <span className="text-[10.5px]">채우기 →</span>
                            ) : (
                              <span
                                className={`text-[10.5px] ${active ? "text-white/70" : ""}`}
                                style={!active ? { color: tone.text } : undefined}
                              >
                                번{c.t} · 통{c.i}
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>

          {/* ── 셀 상세 ── */}
          {sel && (
            <section className="mt-4 max-w-[900px] rounded-xl border border-[#E2DED2] bg-white px-5 py-4 shadow-[0_6px_18px_rgba(21,32,43,0.04)]">
              <h3 className="text-[15px] font-bold text-[#15202B]">
                {SPEECH_ACT_UI[sel.act]} · {LEVEL[sel.level]} — {cellRows.length}개
              </h3>
              <ul className="mt-2.5 divide-y divide-[#EAE4D2] overflow-hidden rounded-lg border border-[#EAE4D2]">
                {cellRows.map((r) => (
                  <li key={r.scenario_id} className="bg-[#FCFBF8] px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="font-normal">
                        {r.domain ? DOMAIN[r.domain] : "—"}
                      </Badge>
                      {r.industry_sector && (
                        <Badge variant="secondary" className="font-normal">
                          {INDUSTRY[r.industry_sector as keyof typeof INDUSTRY] ?? r.industry_sector}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="font-normal">
                        {r.mode === "stt_interpreting" ? MODE_LABEL.stt_interpreting : MODE_LABEL.translation}
                      </Badge>
                      {r.theme_code && (
                        <Badge variant="secondary" className="font-normal">{THEME_LABEL[r.theme_code]}</Badge>
                      )}
                      <Badge variant="secondary" className="font-normal">{DIRECTION_LABEL[coreDirection(r.core_content)]}</Badge>
                      {isAuthentic(r.core_content) && (
                        <Badge className="bg-[#FBEFD9] font-normal text-[#7A4A0A] hover:bg-[#FBEFD9]"
                          title={`세부 출처: ${AUTHENTIC_SOURCE_KO[r.core_content?.provenance?.source_type ?? ""] ?? r.core_content?.provenance?.source_type}${r.core_content?.provenance?.source_ref ? ` · ${r.core_content.provenance.source_ref}` : ""}`}>
                          실제 자료 기반
                        </Badge>
                      )}
                    </div>
                    {/* 상황·관계·발화·원문은 줄글이다 — 전폭이면 한 줄 90자가 넘는다. */}
                    <p className="mt-1 max-w-[78ch] text-[13px] font-medium leading-relaxed line-clamp-2">
                      {r.core_content?.situation_ko ?? "—"}
                    </p>
                    {r.core_content?.relation_ko && (
                      <p className="mt-0.5 max-w-[78ch] text-[12px] text-muted-foreground line-clamp-1">
                        관계 · {r.core_content.relation_ko}
                      </p>
                    )}
                    {(r.core_content?.preceding_turn ?? r.core_content?.preceding_turn_zh) && (
                      <p className="mt-1 max-w-[78ch] whitespace-pre-wrap rounded-md border border-[#E5E0D5] bg-white px-2.5 py-1.5 text-[12.5px] leading-relaxed text-foreground">
                        <span className="mr-1 font-medium text-muted-foreground">상대의 직전 발화 ·</span>
                        {r.core_content?.preceding_turn ?? r.core_content?.preceding_turn_zh}
                      </p>
                    )}
                    <details className="mt-1 max-w-[78ch] text-[10.5px] text-muted-foreground">
                      <summary className="w-fit cursor-pointer select-none font-medium text-[#68737B] hover:text-[#15202B]">
                        세부 정보
                      </summary>
                      <div className="mt-1.5 space-y-1.5 rounded-md border border-[#E5E0D5] bg-white px-2.5 py-2">
                        <p className="text-[12px] leading-relaxed">
                          원문 · {r.core_content?.source_text ?? r.core_content?.source_text_ko ?? "—"}
                        </p>
                        <p className="font-mono leading-relaxed">
                          topic {r.topic_code ?? "—"} · P {r.scenario_p ?? "—"} · D {r.scenario_d ?? "—"} · R {r.scenario_r ?? "—"}
                        </p>
                        {(r.generation_run_id || r.prompt_snapshot_hash) && (
                          <p className="break-all font-mono leading-relaxed">
                          run {r.generation_run_id ?? "—"} · item {r.generation_item_key ?? "—"} · prompt{" "}
                          {r.prompt_snapshot_hash ?? "—"}
                          </p>
                        )}
                      </div>
                    </details>

                    {/* ── 조회 전용 — 조립·검토는 학습 미션 조립 화면에서 ── */}
                    <div className="mt-1.5 flex max-w-[78ch] flex-wrap items-center gap-2">
                      {(r.mission_status === "generated" || r.mission_status === "reviewed") && (
                        <Button size="sm" variant="ghost" onClick={() => togglePreview(r)}>
                          {openId === r.scenario_id ? "미션 접기 ▴" : "미션 보기 ▾"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto h-8 px-2.5 text-[12px]"
                        onClick={() =>
                          navigate(`/admin/assembly?act=${r.speech_act}&level=${r.learner_level}`)
                        }
                      >
                        조립에서 열기 →
                      </Button>
                    </div>

                    {openId === r.scenario_id && preview[r.scenario_id] && (
                      <MissionPreview
                        mission={preview[r.scenario_id].mission}
                        warnings={preview[r.scenario_id].warnings}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      </div>
    </AdminShell>
  );
};

const Filter = ({
  label,
  className,
  value,
  onChange,
  opts,
}: {
  label: string;
  className?: string;
  value: string;
  onChange: (v: string) => void;
  opts: [string, string][];
}) => (
  <label className={`grid gap-1 ${className ?? ""}`}>
    <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full rounded-md border border-[#D8D4C8] bg-[#FCFBF8] px-2 text-[12.5px] text-[#15202B]"
    >
      {opts.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  </label>
);

export default AdminBrowser;
