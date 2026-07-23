import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurriculumOutline, listCurriculumOutlines } from "@/lib/curriculum/api";
import type { CurriculumOutlineRow, CurriculumWeekRow } from "@/lib/curriculum/types";
import {
  listCoreScenarios,
  listWeekAssignments,
  saveWeekAssignments,
  type ComposerCore,
  type WeekAssignment,
} from "@/lib/curriculum/composer";
import {
  LEVEL,
  MODE_LABEL,
  SPEECH_ACT_UI,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import {
  COURSE_PRESETS,
  THEME_LABEL,
  type CoursePreset,
} from "@/lib/pragma/scenarioTopics";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";

// 15주 편성기 (태스크 D) — 관리자구조md §6-2 + 계약 0-g·47.
// 흐름: outline 선택 → 프리셋으로 주차별 시나리오 자동 채우기 → 수동 교체 → 저장.
// 편성표에 화용 초점(target_feature)·미션 검토상태 열 필수(RQ2 증명 장치).
// 읽기 전용 데이터는 scenario_core_v1 코어. 저장은 curriculum_week_scenarios.

type AssignedItem = { scenario_id: string; slot_role: string };
type AssignMap = Record<number, AssignedItem[]>;

const slotRoleFor = (c: ComposerCore) =>
  c.mode === "stt_interpreting" ? "interpreting" : "primary";

const missionStatusLabel = (s: string | null) =>
  s === "reviewed" ? "미션 검토완료" : s === "generated" ? "미션 생성됨" : "코어(미승격)";

/** 후보 중 통역 비율을 최대한 맞춰 slots개를 고른다(부족하면 남는 것으로 채움). */
function pickByRatio(cands: ComposerCore[], slots: number, interpRatio: number): ComposerCore[] {
  if (cands.length <= slots) return cands.slice(0, slots);
  const interp = cands.filter((c) => c.mode === "stt_interpreting");
  const trans = cands.filter((c) => c.mode !== "stt_interpreting");
  const wantInterp = Math.min(interp.length, Math.round(slots * interpRatio));
  const picked = [...interp.slice(0, wantInterp), ...trans.slice(0, slots - wantInterp)];
  if (picked.length < slots) {
    const chosen = new Set(picked.map((c) => c.scenario_id));
    for (const c of cands) {
      if (picked.length >= slots) break;
      if (!chosen.has(c.scenario_id)) picked.push(c);
    }
  }
  return picked.slice(0, slots);
}

const AdminComposer = () => {
  const [outlines, setOutlines] = useState<CurriculumOutlineRow[]>([]);
  const [cores, setCores] = useState<ComposerCore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [outlineId, setOutlineId] = useState<string>("");
  const [outline, setOutline] = useState<CurriculumOutlineRow | null>(null);
  const [weeks, setWeeks] = useState<CurriculumWeekRow[]>([]);
  const [loadingOutline, setLoadingOutline] = useState(false);

  const [presetCode, setPresetCode] = useState<string>(COURSE_PRESETS[0].preset_code);
  const [assign, setAssign] = useState<AssignMap>({});
  const [addingWeek, setAddingWeek] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const preset: CoursePreset | undefined = useMemo(
    () => COURSE_PRESETS.find((p) => p.preset_code === presetCode),
    [presetCode],
  );

  const coreById = useMemo(() => {
    const m: Record<string, ComposerCore> = {};
    for (const c of cores) m[c.scenario_id] = c;
    return m;
  }, [cores]);

  // ── 초기 로드: outline 목록 + 코어 전건 ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [os, cs] = await Promise.all([listCurriculumOutlines(), listCoreScenarios()]);
        if (cancelled) return;
        setOutlines(os);
        setCores(cs);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── outline 선택 시: 주차 골격 + 기존 배정 로드 ──
  useEffect(() => {
    if (!outlineId) {
      setOutline(null);
      setWeeks([]);
      setAssign({});
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingOutline(true);
      setError(null);
      try {
        const [{ outline: o, weeks: w }, existing] = await Promise.all([
          getCurriculumOutline(outlineId),
          listWeekAssignments(outlineId),
        ]);
        if (cancelled) return;
        setOutline(o);
        setWeeks(w);
        const m: AssignMap = {};
        for (const a of existing) {
          (m[a.week_no] ??= []).push({ scenario_id: a.scenario_id, slot_role: a.slot_role });
        }
        setAssign(m);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "커리큘럼을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoadingOutline(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [outlineId]);

  // ── 자동 채우기 ──
  const autoFill = () => {
    if (!outline) return;
    const next: AssignMap = {};
    let filledWeeks = 0;
    for (const w of weeks) {
      if (w.type !== "regular" || !w.speech_act) continue;
      const act = w.speech_act as SpeechActUI;
      const slots = w.scenario_slots ?? outline.scenarios_per_week ?? 3;
      // 1차: 화행 + 수준 + 프리셋 테마
      let cands = cores.filter(
        (c) =>
          c.speech_act === act &&
          c.learner_level === outline.level &&
          (!preset || (c.theme_code != null && preset.included_themes.includes(c.theme_code))),
      );
      // 부족하면 테마 조건 완화(화행 + 수준만)
      if (cands.length < slots) {
        cands = cores.filter((c) => c.speech_act === act && c.learner_level === outline.level);
      }
      const picked = pickByRatio(cands, slots, preset?.translation_interpreting_ratio ?? 0);
      if (picked.length > 0) {
        next[w.week_no] = picked.map((c) => ({ scenario_id: c.scenario_id, slot_role: slotRoleFor(c) }));
        filledWeeks += 1;
      }
    }
    setAssign(next);
    setAddingWeek(null);
    const total = Object.values(next).reduce((s, arr) => s + arr.length, 0);
    toast.success(`자동 채우기 완료 — ${filledWeeks}개 주차에 시나리오 ${total}개 배정`);
  };

  const removeItem = (weekNo: number, scenarioId: string) =>
    setAssign((prev) => ({
      ...prev,
      [weekNo]: (prev[weekNo] ?? []).filter((it) => it.scenario_id !== scenarioId),
    }));

  const addItem = (weekNo: number, c: ComposerCore) =>
    setAssign((prev) => {
      const cur = prev[weekNo] ?? [];
      if (cur.some((it) => it.scenario_id === c.scenario_id)) return prev;
      return { ...prev, [weekNo]: [...cur, { scenario_id: c.scenario_id, slot_role: slotRoleFor(c) }] };
    });

  const handleSave = async () => {
    if (!outlineId) return;
    const flat: WeekAssignment[] = [];
    for (const [weekNoStr, items] of Object.entries(assign)) {
      const weekNo = Number(weekNoStr);
      items.forEach((it, i) =>
        flat.push({ week_no: weekNo, scenario_id: it.scenario_id, position: i, slot_role: it.slot_role }),
      );
    }
    setSaving(true);
    try {
      await saveWeekAssignments(outlineId, flat);
      toast.success(`편성 저장 완료 — 시나리오 ${flat.length}개`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const totalAssigned = useMemo(
    () => Object.values(assign).reduce((s, arr) => s + arr.length, 0),
    [assign],
  );

  return (
    <AdminShell
      title="15주 편성기"
      description="커리큘럼 골격의 각 주차에 실제 시나리오를 배정합니다. 프리셋으로 자동 채운 뒤 교체하고, 화용 초점·검토상태를 확인해 저장합니다."
    >
      {/* ── 상단 컨트롤 ── */}
      <section className="rounded-xl border border-[#EAE4D2] bg-white p-5">
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
            {error} (관리자 로그인이 필요합니다)
          </p>
        )}
        <div className="flex flex-wrap items-end gap-4 text-[13px]">
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">커리큘럼</span>
            <select
              value={outlineId}
              onChange={(e) => setOutlineId(e.target.value)}
              disabled={loading}
              className="min-w-[240px] rounded-md border border-[#EAE4D2] bg-white px-2 py-1.5"
            >
              <option value="">— 커리큘럼 선택 —</option>
              {outlines.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title} · {LEVEL[o.level as keyof typeof LEVEL] ?? o.level}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">프리셋 (자동 채우기 기준)</span>
            <select
              value={presetCode}
              onChange={(e) => setPresetCode(e.target.value)}
              className="min-w-[240px] rounded-md border border-[#EAE4D2] bg-white px-2 py-1.5"
            >
              {COURSE_PRESETS.map((p) => (
                <option key={p.preset_code} value={p.preset_code}>
                  {p.label} · {LEVEL[p.target_level]}
                </option>
              ))}
            </select>
          </label>

          <Button onClick={autoFill} disabled={!outline || loadingOutline}>
            자동 채우기
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={!outlineId || saving}>
            {saving ? "저장 중…" : "편성 저장"}
          </Button>
        </div>

        {/* 프리셋 반복 원칙 1문장 — RQ2 증명 장치 */}
        {preset && (
          <div className="mt-4 rounded-lg border border-[#EAE4D2] bg-[#FAF7EE] p-3 text-[13px] leading-relaxed">
            <span className="font-medium">반복 원칙 · {preset.label}</span>
            <span className="ml-1 text-muted-foreground">
              (통역 {Math.round(preset.translation_interpreting_ratio * 100)}% · 테마{" "}
              {preset.included_themes.map((t) => THEME_LABEL[t]).join("·")})
            </span>
            <p className="mt-1">{preset.repetition_principle}</p>
          </div>
        )}
      </section>

      {/* ── 편성표 ── */}
      {!outlineId ? (
        <p className="mt-4 text-[13px] text-muted-foreground">
          위에서 커리큘럼을 선택하면 주차별 편성표가 나타납니다.
        </p>
      ) : loadingOutline ? (
        <p className="mt-4 text-[13px] text-muted-foreground">주차 골격을 불러오는 중…</p>
      ) : (
        <>
          <div className="mt-4 text-[13px] text-muted-foreground">
            배정된 시나리오 <span className="font-semibold text-foreground">{totalAssigned}</span>개 ·
            코어 뱅크 {cores.length}개
          </div>

          <div className="mt-3 space-y-3">
            {weeks.map((w) => (
              <WeekRow
                key={w.id}
                week={w}
                items={assign[w.week_no] ?? []}
                coreById={coreById}
                candidates={cores}
                outlineLevel={outline?.level ?? null}
                adding={addingWeek === w.week_no}
                onToggleAdd={() =>
                  setAddingWeek((cur) => (cur === w.week_no ? null : w.week_no))
                }
                onAdd={(c) => addItem(w.week_no, c)}
                onRemove={(sid) => removeItem(w.week_no, sid)}
              />
            ))}
          </div>
        </>
      )}
    </AdminShell>
  );
};

// ── 주차 한 행 ──────────────────────────────────────────────────────────
function WeekRow({
  week,
  items,
  coreById,
  candidates,
  outlineLevel,
  adding,
  onToggleAdd,
  onAdd,
  onRemove,
}: {
  week: CurriculumWeekRow;
  items: AssignedItem[];
  coreById: Record<string, ComposerCore>;
  candidates: ComposerCore[];
  outlineLevel: string | null;
  adding: boolean;
  onToggleAdd: () => void;
  onAdd: (c: ComposerCore) => void;
  onRemove: (scenarioId: string) => void;
}) {
  const act = week.speech_act as SpeechActUI | null;
  const isAssignable = week.type === "regular";

  // 후보: 화행(있으면) + 수준 일치, 이미 배정된 것 제외
  const assignedIds = new Set(items.map((it) => it.scenario_id));
  const cands = candidates.filter(
    (c) =>
      !assignedIds.has(c.scenario_id) &&
      (act ? c.speech_act === act : true) &&
      (outlineLevel ? c.learner_level === outlineLevel : true),
  );

  return (
    <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 min-w-[3.2rem] items-center justify-center rounded-md bg-[#15202B] px-2 text-[13px] font-semibold text-white">
          {week.week_no}주차
        </span>
        <span className="text-[14px] font-medium">{week.title ?? ""}</span>
        {act && <Badge variant="secondary" className="font-normal">{SPEECH_ACT_UI[act]}</Badge>}
        {!isAssignable && (
          <Badge variant="secondary" className="bg-[#EAE4D2] font-normal text-[#5B5446]">
            {week.type === "orientation"
              ? "오리엔테이션"
              : week.type === "midterm"
                ? "중간평가"
                : week.type === "final"
                  ? "기말평가"
                  : "특수 주차"}
          </Badge>
        )}
        <span className="ml-auto text-[12px] text-muted-foreground">
          배정 {items.length}
          {week.scenario_slots ? ` / 슬롯 ${week.scenario_slots}` : ""}
        </span>
        <Button variant="outline" size="sm" onClick={onToggleAdd}>
          {adding ? "닫기" : "＋ 추가"}
        </Button>
      </div>

      {/* 배정 편성표 — 화용 초점·검토상태 열 필수(0-g·47) */}
      {items.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-3 font-medium">상황</th>
                <th className="py-1 pr-3 font-medium">모드</th>
                <th className="py-1 pr-3 font-medium">화용 초점</th>
                <th className="py-1 pr-3 font-medium">검토상태</th>
                <th className="py-1 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const c = coreById[it.scenario_id];
                const feat = c?.target_feature ? getTargetFeature(c.target_feature) : undefined;
                const reviewed = c?.mission_status === "reviewed";
                return (
                  <tr key={it.scenario_id} className="border-t border-[#F0EBDD]">
                    <td className="py-1.5 pr-3">{c?.situation_ko ?? "(누락된 시나리오)"}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {c ? (c.mode === "stt_interpreting" ? MODE_LABEL.stt_interpreting : MODE_LABEL.translation) : "—"}
                    </td>
                    <td className="py-1.5 pr-3">
                      {c?.target_feature ? (
                        feat?.learner_label ?? c.target_feature
                      ) : (
                        <span className="text-amber-600">미지정</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className={reviewed ? "text-emerald-700" : "text-muted-foreground"}>
                        {missionStatusLabel(c?.mission_status ?? null)}
                      </span>
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => onRemove(it.scenario_id)}
                        className="text-[12px] text-red-700 hover:underline"
                      >
                        제거
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 후보 추가 패널 */}
      {adding && (
        <div className="mt-3 rounded-lg border border-dashed border-[#D8D0BC] bg-[#FAF8F2] p-3">
          {cands.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">
              조건에 맞는 후보 코어가 없습니다{act ? ` (${SPEECH_ACT_UI[act]} · ${LEVEL[outlineLevel as keyof typeof LEVEL] ?? outlineLevel})` : ""}.
            </p>
          ) : (
            <ul className="max-h-60 space-y-1.5 overflow-y-auto">
              {cands.slice(0, 40).map((c) => (
                <li
                  key={c.scenario_id}
                  className="flex items-center gap-2 rounded-md bg-white px-3 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]">{c.situation_ko || "(상황 없음)"}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {c.theme_code ? THEME_LABEL[c.theme_code] : "—"} ·{" "}
                      {c.mode === "stt_interpreting" ? MODE_LABEL.stt_interpreting : MODE_LABEL.translation} ·{" "}
                      {missionStatusLabel(c.mission_status)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onAdd(c)}>
                    추가
                  </Button>
                </li>
              ))}
              {cands.length > 40 && (
                <li className="px-3 py-1 text-[11.5px] text-muted-foreground">
                  … 외 {cands.length - 40}개(상위 40개만 표시)
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminComposer;
