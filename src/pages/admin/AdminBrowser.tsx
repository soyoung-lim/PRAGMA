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
import { DEFAULT_FEATURE_BY_ACT } from "@/lib/pragma/targetFeatures";
import { promoteCore, reviewMission, type PromotableCore } from "@/lib/pragma/promoteMission";
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
  } | null;
}

const ACTS = Object.keys(SPEECH_ACT_UI) as SpeechActUI[];
const LEVELS: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];
const CORE_QUERY_TIMEOUT_MS = 15_000;

const AdminBrowser = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fMode, setFMode] = useState<"all" | GenMode>("all");
  const [fDomain, setFDomain] = useState<"all" | Domain>("all");
  const [fTheme, setFTheme] = useState<"all" | ThemeCode>("all");
  const [fDirection, setFDirection] = useState<"all" | LanguageDirection>("all");
  const [sel, setSel] = useState<{ act: SpeechActUI; level: LearnerLevel } | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // 승격 중인 scenario_id
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});
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

  const setStatus = (id: string, status: string) =>
    setRows((prev) => prev.map((r) => (r.scenario_id === id ? { ...r, mission_status: status } : r)));

  const onGenerate = async (r: CoreRow) => {
    setBusy(r.scenario_id);
    setRowMsg((m) => ({ ...m, [r.scenario_id]: "미션 생성 중… (게이트1 프롬프트, 최대 3회)" }));
    try {
      const res = await promoteCore(r as unknown as PromotableCore);
      if (res.ok) {
        setStatus(r.scenario_id, "generated");
        // 검증②(0-n·94) 결과가 있으면 함께 알린다 — 없으면(호출 실패) 침묵하지 않고 표기.
        const qLabel = res.quality
          ? { pass: "AI점검 통과", warning: "AI점검 주의", fail: "AI점검 결함" }[res.quality.verdict]
          : "AI점검 미실행";
        setRowMsg((m) => ({ ...m, [r.scenario_id]: `생성됨(${res.ruleResult}, 시도 ${res.attempts}회) · ${qLabel} — 눈검사 후 검토 완료 처리` }));
        if (res.mission) {
          const warnings = (res.violations ?? []).filter((v) => v.level === "warning").map((v) => `${v.id}: ${v.message}`);
          // 품질점검은 저장 직전에 붙으므로 엣지 응답 미션에는 없다 — 미리보기용으로 합친다.
          const withQuality = res.quality ? { ...res.mission, quality_check: res.quality } : res.mission;
          setPreview((m) => ({ ...m, [r.scenario_id]: { mission: withQuality, warnings } }));
          setOpenId(r.scenario_id); // 생성 직후 바로 눈검사 뷰 펼침
        }
        if (res.quality?.verdict === "fail") {
          toast.warning("미션 생성됨 — AI 품질점검에서 결함이 보고되었습니다. 눈검사 필요");
        } else {
          toast.success("미션 생성됨 — 검토 대기");
        }
      } else {
        setRowMsg((m) => ({ ...m, [r.scenario_id]: `실패: ${res.error}${res.violations?.length ? " · " + res.violations.filter((v) => v.level === "fail").map((v) => v.id).join(",") : ""}` }));
        toast.error(res.error ?? "미션 생성 실패");
      }
    } catch (e) {
      setRowMsg((m) => ({ ...m, [r.scenario_id]: `오류: ${e instanceof Error ? e.message : e}` }));
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
        setRowMsg((m) => ({ ...m, [r.scenario_id]: "검토 완료 — 학습자 실행 가능" }));
        toast.success("검토 완료(reviewed) — 학습자 실행 가능");
      } else {
        toast.error(res.error ?? "검토 처리 실패");
      }
    } finally {
      setBusy(null);
    }
  };

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      // supabase 생성 타입(types.ts)이 v1.4 신규 컬럼을 아직 모른다 → 이 쿼리만 캐스트로 우회.
      // (백로그: `supabase gen types`로 types.ts 재생성하면 코드 전역에서 신규 컬럼 타입 확보)
      const request = (supabase as unknown as {
        from: (t: string) => any;
      })
        .from("scenarios")
        .select(
          "scenario_id, speech_act, learner_level, domain, industry_sector, mode, source_modality, theme_code, topic_code, scenario_p, scenario_d, scenario_r, review_status, mission_status, generation_run_id, generation_item_key, prompt_snapshot_hash, core_content",
        )
        .eq("content_format", "scenario_core_v1")
        .order("created_at", { ascending: false })
        .limit(1000);
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
          (fDirection === "all" || coreDirection(r.core_content) === fDirection),
      ),
    [rows, fMode, fDomain, fTheme, fDirection],
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

  return (
    // 메뉴명과 헤드라인을 통일한다(2026-07-26). 이 화면은 조회만 하는 브라우저가
    // 아니라 **코어를 골라 미션으로 승격하는 곳**이다 — promoteCore·reviewMission이
    // 여기서 실행된다. 「시나리오 브라우저」라는 이름은 그 사실을 가렸다.
    <AdminShell
      title="미션 조립"
      description="상황별 코어를 소통 행동(화행) × 수준으로 살펴보고, 부족한 조건은 생성 화면에서 바로 채웁니다."
    >
      {/* ── 요약 ── */}
      <section className="rounded-xl border border-[#EAE4D2] bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-4">
          <div>
            <div className="text-[24px] font-bold">{filtered.length}</div>
            <div className="text-[12px] text-muted-foreground">코어 (필터 적용)</div>
          </div>
          <div className="text-[13px] text-muted-foreground">
            전체 {rows.length} · 통역 {interp} · 미션 검토완료 {reviewed}
          </div>
        </div>

        {/* ── 필터 ── */}
        <div className="mt-4 flex flex-wrap gap-4 text-[13px]">
          <Filter label="모드" value={fMode} onChange={(v) => setFMode(v as typeof fMode)}
            opts={[["all", "전체"], ["translation", MODE_LABEL.translation], ["stt_interpreting", MODE_LABEL.stt_interpreting]]} />
          <Filter label="도메인" value={fDomain} onChange={(v) => setFDomain(v as typeof fDomain)}
            opts={[["all", "전체"], ...Object.entries(DOMAIN)]} />
          <Filter label="시나리오 테마" value={fTheme} onChange={(v) => setFTheme(v as typeof fTheme)}
            opts={[["all", "전체"], ...Object.entries(THEME_LABEL)]} />
          <Filter label="언어 방향" value={fDirection} onChange={(v) => setFDirection(v as typeof fDirection)}
            opts={[["all", "전체"], ...Object.entries(DIRECTION_LABEL)]} />
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
          <section className="mt-4 overflow-x-auto rounded-xl border border-[#EAE4D2] bg-white p-5">
            <table className="w-full min-w-[520px] border-separate border-spacing-1 text-[13px]">
              <thead>
                <tr>
                  <th className="w-[104px] text-left font-semibold text-muted-foreground">
                    소통 행동(화행) \ 수준
                  </th>
                  {LEVELS.map((lv) => (
                    <th key={lv} className="px-2 py-1 text-center font-semibold">{LEVEL[lv]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACTS.map((act) => (
                  <tr key={act}>
                    <td className="py-1 font-medium">{SPEECH_ACT_UI[act]}</td>
                    {LEVELS.map((lv) => {
                      const c = counts[`${act}|${lv}`] ?? { total: 0, t: 0, i: 0 };
                      const n = c.total;
                      const active = sel?.act === act && sel?.level === lv;
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
                            className={`flex h-11 w-full flex-col items-center justify-center rounded-md leading-none transition ${
                              active
                                ? "bg-[#1a1a1a] text-white"
                                : n === 0
                                  ? "border border-dashed border-amber-300 bg-[#FAF8F2] text-amber-700 hover:bg-amber-50"
                                  : "bg-[#FFF7CC] hover:bg-[#FFEE99]"
                            }`}
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
                              <span className={`text-[10.5px] ${active ? "text-white/70" : "text-[#8A7A2A]"}`}>
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
          </section>

          {/* ── 셀 상세 ── */}
          {sel && (
            <section className="mt-4 rounded-xl border border-[#EAE4D2] bg-white p-5">
              <h3 className="text-[15px] font-bold">
                {SPEECH_ACT_UI[sel.act]} · {LEVEL[sel.level]} — {cellRows.length}개
              </h3>
              <ul className="mt-3 space-y-2">
                {cellRows.map((r) => (
                  <li key={r.scenario_id} className="rounded-lg bg-[#FAF8F2] px-4 py-3">
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
                      {r.topic_code && (
                        <Badge variant="outline" className="font-mono text-[10.5px] font-normal">
                          {r.topic_code}
                        </Badge>
                      )}
                      <Badge variant="outline" className="font-normal">
                        P {r.scenario_p ?? "—"} · D {r.scenario_d ?? "—"} · R {r.scenario_r ?? "—"}
                      </Badge>
                      <Badge variant="secondary" className="font-normal">{DIRECTION_LABEL[coreDirection(r.core_content)]}</Badge>
                      <Badge
                        variant="secondary"
                        className={`font-normal ${r.mission_status === "reviewed" ? "bg-emerald-100 text-emerald-900" : ""}`}
                      >
                        {r.mission_status === "reviewed"
                          ? "미션 검토완료"
                          : r.mission_status === "generated"
                            ? "미션 생성됨"
                            : "코어(검수 대기)"}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-[13px] font-medium">{r.core_content?.situation_ko ?? "—"}</p>
                    {r.core_content?.relation_ko && (
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        관계 · {r.core_content.relation_ko}
                      </p>
                    )}
                    {(r.core_content?.preceding_turn ?? r.core_content?.preceding_turn_zh) && (
                      <p className="mt-1 whitespace-pre-wrap rounded-md border border-[#E5E0D5] bg-white px-2.5 py-2 text-[12.5px] text-foreground">
                        <span className="mr-1 font-medium text-muted-foreground">상대의 직전 발화 ·</span>
                        {r.core_content?.preceding_turn ?? r.core_content?.preceding_turn_zh}
                      </p>
                    )}
                    <p className="mt-1 text-[12.5px] text-muted-foreground line-clamp-2">
                      원문 · {r.core_content?.source_text ?? r.core_content?.source_text_ko ?? ""}
                    </p>
                    {(r.generation_run_id || r.prompt_snapshot_hash) && (
                      <p className="mt-1 break-all font-mono text-[10.5px] text-muted-foreground">
                        run {r.generation_run_id ?? "—"} · item {r.generation_item_key ?? "—"} · prompt{" "}
                        {r.prompt_snapshot_hash ?? "—"}
                      </p>
                    )}

                    {/* ── 승격 액션 ── */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {!r.mission_status && (
                        DEFAULT_FEATURE_BY_ACT[r.speech_act] ? (
                          <Button size="sm" variant="outline" disabled={busy === r.scenario_id}
                            onClick={() => onGenerate(r)}>
                            {busy === r.scenario_id ? "생성 중…" : "미션 생성"}
                          </Button>
                        ) : (
                          <span className="text-[11.5px] text-muted-foreground">화용 초점 카탈로그 없음 — 승격 불가</span>
                        )
                      )}
                      {r.mission_status === "generated" && (
                        <Button size="sm" disabled={busy === r.scenario_id} onClick={() => onReview(r)}>
                          {busy === r.scenario_id ? "처리 중…" : "검토 완료(reviewed)"}
                        </Button>
                      )}
                      {(r.mission_status === "generated" || r.mission_status === "reviewed") && (
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
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </AdminShell>
  );
};

const Filter = ({
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
  <label className="flex items-center gap-2">
    <span className="text-muted-foreground">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-[#EAE4D2] bg-white px-2 py-1"
    >
      {opts.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  </label>
);

export default AdminBrowser;
