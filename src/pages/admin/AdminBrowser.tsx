import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  DOMAIN,
  INDUSTRY,
  LEVEL,
  MODE_LABEL,
  SPEECH_ACT_UI,
  type Domain,
  type GenMode,
  type LearnerLevel,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import { THEME_LABEL, type ThemeCode } from "@/lib/pragma/scenarioTopics";
import { DEFAULT_FEATURE_BY_ACT } from "@/lib/pragma/targetFeatures";
import { promoteCore, reviewMission, type PromotableCore } from "@/lib/pragma/promoteMission";
import { fetchMissionForReview } from "@/lib/mission/missionDb";
import { MissionPreview } from "@/components/admin/MissionPreview";
import type { MissionV1 } from "@/lib/pragma/missionSchema";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  review_status: string | null;
  mission_status: string | null;
  core_content: { situation_ko?: string; source_text_ko?: string } | null;
}

const ACTS = Object.keys(SPEECH_ACT_UI) as SpeechActUI[];
const LEVELS: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];

const AdminBrowser = () => {
  const [rows, setRows] = useState<CoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fMode, setFMode] = useState<"all" | GenMode>("all");
  const [fDomain, setFDomain] = useState<"all" | Domain>("all");
  const [fTheme, setFTheme] = useState<"all" | ThemeCode>("all");
  const [sel, setSel] = useState<{ act: SpeechActUI; level: LearnerLevel } | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // 승격 중인 scenario_id
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});
  // 눈검사 미리보기 — scenario_id → {mission, warnings}. openId = 펼친 행.
  const [preview, setPreview] = useState<Record<string, { mission: MissionV1; warnings: string[] }>>({});
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
        setRowMsg((m) => ({ ...m, [r.scenario_id]: `생성됨(${res.ruleResult}, 시도 ${res.attempts}회) — 눈검사 후 검토 완료 처리` }));
        if (res.mission) {
          const warnings = (res.violations ?? []).filter((v) => v.level === "warning").map((v) => `${v.id}: ${v.message}`);
          setPreview((m) => ({ ...m, [r.scenario_id]: { mission: res.mission!, warnings } }));
          setOpenId(r.scenario_id); // 생성 직후 바로 눈검사 뷰 펼침
        }
        toast.success("미션 생성됨 — 검토 대기");
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

  useEffect(() => {
    (async () => {
      // supabase 생성 타입(types.ts)이 v1.4 신규 컬럼을 아직 모른다 → 이 쿼리만 캐스트로 우회.
      // (백로그: `supabase gen types`로 types.ts 재생성하면 코드 전역에서 신규 컬럼 타입 확보)
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => any;
      })
        .from("scenarios")
        .select(
          "scenario_id, speech_act, learner_level, domain, industry_sector, mode, source_modality, theme_code, topic_code, review_status, mission_status, core_content",
        )
        .eq("content_format", "scenario_core_v1")
        .order("created_at", { ascending: false });
      if (error) setError(error.message);
      else setRows((data ?? []) as CoreRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (fMode === "all" || r.mode === fMode) &&
          (fDomain === "all" || r.domain === fDomain) &&
          (fTheme === "all" || r.theme_code === fTheme),
      ),
    [rows, fMode, fDomain, fTheme],
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
    <AdminShell
      title="시나리오 브라우저"
      description="뱅크를 화행 × 수준 격자로 봅니다. 수준·주제·모드로 걸러 어떤 칸에 무엇이 있는지 확인하고, 칸을 눌러 미리봅니다."
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
          <Filter label="강좌 테마" value={fTheme} onChange={(v) => setFTheme(v as typeof fTheme)}
            opts={[["all", "전체"], ...Object.entries(THEME_LABEL)]} />
        </div>
      </section>

      {loading ? (
        <p className="mt-4 text-[13px] text-muted-foreground">불러오는 중…</p>
      ) : error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
          조회 실패: {error} (관리자 로그인이 필요합니다)
        </p>
      ) : (
        <>
          {/* ── 27칸 그리드 ── */}
          <section className="mt-4 overflow-x-auto rounded-xl border border-[#EAE4D2] bg-white p-5">
            <table className="w-full min-w-[520px] border-separate border-spacing-1 text-[13px]">
              <thead>
                <tr>
                  <th className="w-[80px] text-left font-semibold text-muted-foreground">화행 \ 수준</th>
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
                            disabled={n === 0}
                            onClick={() => setSel({ act, level: lv })}
                            className={`flex h-11 w-full flex-col items-center justify-center rounded-md leading-none transition ${
                              active
                                ? "bg-[#1a1a1a] text-white"
                                : n === 0
                                  ? "bg-[#FAF8F2] text-amber-600"
                                  : "bg-[#FFF7CC] hover:bg-[#FFEE99]"
                            }`}
                            title="번역 / 통역"
                          >
                            <span className="text-[14px] font-semibold">{n}</span>
                            {n > 0 && (
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
                    <p className="mt-1 text-[12.5px] text-muted-foreground line-clamp-2">
                      {r.core_content?.source_text_ko ?? ""}
                    </p>

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
