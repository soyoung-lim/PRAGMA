import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getCurriculumOutline,
  listCurriculumOutlines,
  updateCurriculumCompositionAxes,
} from "@/lib/curriculum/api";
import type { CurriculumOutlineRow, CurriculumWeekRow } from "@/lib/curriculum/types";
import {
  listCoreScenarios,
  listWeekAssignments,
  saveWeekAssignments,
  type ComposerCore,
  type WeekAssignment,
} from "@/lib/curriculum/composer";
import { isReviewedMission } from "@/lib/curriculum/composerEligibility";
import {
  addAssignment,
  buildAutomaticAssignments,
  assignmentStructureIssues,
  duplicateScenarioIds,
  filterManualCandidates,
  removeAssignment,
  type AssignedItem,
  type AssignMap,
} from "@/lib/curriculum/composerPlanning";
import {
  DIRECTION_LABEL,
  LEVEL,
  MODE_LABEL,
  SPEECH_ACT_UI,
  type LanguageDirection,
  type LearnerLevel,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import {
  COURSE_PRESETS,
  THEME_CODES,
  THEME_LABEL,
  type CoursePreset,
  type ThemeCode,
} from "@/lib/pragma/scenarioTopics";
import { getTargetFeature, DEFAULT_FEATURE_BY_ACT } from "@/lib/pragma/targetFeatures";
import { CurriculumEditor } from "./CurriculumEditor";

// 15주 편성기 (태스크 D) — 관리자구조md §6-2 + 계약 0-g·47.
// 흐름: 강좌 골격 선택 → 수준·주제·모드·언어방향 조절 → 자동 채우기
//       → 주차별 수동 교체 → 저장. 편성 후보와 저장 대상은 검토 완료 미션으로 제한한다.
// 읽기 전용 데이터는 scenario_core_v1 코어. 저장은 curriculum_week_scenarios.
//
// 네 편성 축을 한 화면에 둔다(지도교수 요구). 프리셋은 주제·모드 비율을 빠르게
// 채우는 편의일 뿐이며, 교강사가 모든 축을 개별 조정한다.

const LEVELS: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];
const DIRECTIONS: LanguageDirection[] = ["ko_zh", "zh_ko"];

const themePolicyKey = (themes: ThemeCode[]) => [...themes].sort().join("|");

const AdminComposer = () => {
  const [outlines, setOutlines] = useState<CurriculumOutlineRow[]>([]);
  const [cores, setCores] = useState<ComposerCore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 선택된 커리큘럼은 URL(?outline=)에 보관 → 새로고침해도 유지되고 저장분이 다시 뜬다.
  const [searchParams, setSearchParams] = useSearchParams();
  const outlineId = searchParams.get("outline") ?? "";
  const setOutlineId = (id: string) =>
    setSearchParams(id ? { outline: id } : {}, { replace: true });

  const [outline, setOutline] = useState<CurriculumOutlineRow | null>(null);
  const [weeks, setWeeks] = useState<CurriculumWeekRow[]>([]);
  const [loadingOutline, setLoadingOutline] = useState(false);
  const [structureEditor, setStructureEditor] = useState<"new" | "current" | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // 수준·방향도 편성기의 교강사 조절 축이다. 저장 시 outline 메타에 함께 반영한다.
  const [level, setLevel] = useState<LearnerLevel>("intermediate");
  const [direction, setDirection] = useState<LanguageDirection>("ko_zh");
  // 테마·통역비율 = 프리셋과 독립. 프리셋 선택 시 여기에 복사(빠른 채우기).
  const [themes, setThemes] = useState<ThemeCode[]>([]);
  const [interpRatio, setInterpRatio] = useState<number>(0.3);
  const [policyBaseline, setPolicyBaseline] = useState<{
    themeKey: string;
    interpretingRatio: number;
  } | null>(null);
  const [presetCode, setPresetCode] = useState<string>("");

  const [assign, setAssign] = useState<AssignMap>({});
  const [loadedAssignments, setLoadedAssignments] = useState<WeekAssignment[] | null>(null);
  const [addingWeek, setAddingWeek] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoFillShortages, setAutoFillShortages] = useState<
    Array<{ weekNo: number; missingSlots: number }>
  >([]);

  const preset: CoursePreset | undefined = useMemo(
    () => COURSE_PRESETS.find((p) => p.preset_code === presetCode),
    [presetCode],
  );

  // 제작 파이프라인 전체 통계 대신, 지금 선택한 편성 조건에서 실제로 쓸 수 있는
  // 검토 완료 미션 수만 보여준다. 부족 원인은 설명하되 내부 상태명은 노출하지 않는다.
  const availableMissionCount = useMemo(
    () =>
      cores.filter(
        (core) =>
          core.direction === direction &&
          core.learner_level === level &&
          core.mission_status === "reviewed" &&
          (themes.length === 0 || themes.includes(core.theme_code as ThemeCode)),
      ).length,
    [cores, direction, level, themes],
  );

  const coreById = useMemo(() => {
    const m: Record<string, ComposerCore> = {};
    for (const c of cores) m[c.scenario_id] = c;
    return m;
  }, [cores]);

  // ── 초기 로드: 커리큘럼 목록 + 코어 전건 ──
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
  }, [reloadToken]);

  // ── 커리큘럼 선택 시: 주차 골격 + 기존 배정 로드(새로고침 복원 경로) ──
  useEffect(() => {
    if (!outlineId) {
      setOutline(null);
      setWeeks([]);
      setAssign({});
      setLoadedAssignments(null);
      setLevel("intermediate");
      setDirection("ko_zh");
      setThemes([]);
      setInterpRatio(0.3);
      setPolicyBaseline(null);
      setPresetCode("");
      setAutoFillShortages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingOutline(true);
      setLoadedAssignments(null);
      setError(null);
      try {
        const [{ outline: o, weeks: w }, existing] = await Promise.all([
          getCurriculumOutline(outlineId),
          listWeekAssignments(outlineId),
        ]);
        if (cancelled) return;
        setOutline(o);
        setWeeks(w);
        setLevel(o.level as LearnerLevel);
        setDirection(o.language_direction as LanguageDirection);
        const hasStoredPolicy =
          Array.isArray(o.composition_theme_codes) &&
          typeof o.target_interpreting_ratio === "number";
        if (hasStoredPolicy) {
          const storedThemes = o.composition_theme_codes.filter((theme): theme is ThemeCode =>
            THEME_CODES.includes(theme as ThemeCode),
          );
          setThemes(storedThemes);
          setInterpRatio(o.target_interpreting_ratio);
          setPolicyBaseline({
            themeKey: themePolicyKey(storedThemes),
            interpretingRatio: o.target_interpreting_ratio,
          });
        } else {
          setPolicyBaseline(null);
        }
        setPresetCode("");
        setAutoFillShortages([]);
        setAssign(assignmentsToMap(existing));
        setLoadedAssignments(existing);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "교과목을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoadingOutline(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [outlineId]);

  // migration 적용 전 만들어진 legacy outline은 저장된 정책 열이 없을 수 있다.
  // 그 경우에만 실제 배정에서 주제·비율을 역산해 이전 동작을 보존한다.
  useEffect(() => {
    if (!outlineId || loadedAssignments === null || cores.length === 0) return;
    if (
      outline &&
      Array.isArray(outline.composition_theme_codes) &&
      typeof outline.target_interpreting_ratio === "number"
    ) {
      return;
    }
    const assignedCores = loadedAssignments
      .map((item) => cores.find((core) => core.scenario_id === item.scenario_id))
      .filter((core): core is ComposerCore => Boolean(core));
    if (assignedCores.length === 0) {
      setThemes([]);
      setInterpRatio(0.3);
      setPolicyBaseline({ themeKey: "", interpretingRatio: 0.3 });
      setPresetCode("");
      return;
    }
    const assignedThemes = [...new Set(
      assignedCores
        .map((core) => core.theme_code)
        .filter((theme): theme is ThemeCode => Boolean(theme)),
    )];
    const legacyThemes = assignedThemes.length === THEME_CODES.length ? [] : assignedThemes;
    const legacyRatio =
      assignedCores.filter((core) => core.mode === "stt_interpreting").length /
      assignedCores.length;
    setThemes(legacyThemes);
    setInterpRatio(legacyRatio);
    setPolicyBaseline({
      themeKey: themePolicyKey(legacyThemes),
      interpretingRatio: legacyRatio,
    });
    setPresetCode("");
  }, [cores, loadedAssignments, outline, outlineId]);

  // ── 프리셋 적용 = 주제·통역비율 빠른 채우기. 네 축의 정본은 현재 화면 선택값 ──
  const applyPreset = (code: string) => {
    setPresetCode(code);
    const p = COURSE_PRESETS.find((x) => x.preset_code === code);
    if (!p) return;
    setThemes(p.included_themes);
    setInterpRatio(p.translation_interpreting_ratio);
  };

  const toggleTheme = (t: ThemeCode) =>
    setThemes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  // 편성 조건이 바뀌면 직전 자동 채우기의 부족 경고는 더 이상 현재 조건을 설명하지 않는다.
  useEffect(() => {
    setAutoFillShortages([]);
  }, [level, direction, themes, interpRatio]);

  // ── 자동 채우기 (수준·주제·모드 비율·언어방향 = 현재 선택값) ──
  const autoFill = (allowThemeExpansion = false) => {
    if (!outline) return;
    const result = buildAutomaticAssignments({
      weeks,
      cores,
      level,
      direction,
      themes,
      interpretingRatio: interpRatio,
      defaultScenariosPerWeek: outline.scenarios_per_week ?? 3,
      allowThemeExpansion,
    });
    setAssign(result.assignments);
    setAutoFillShortages(result.shortages);
    setAddingWeek(null);
    if (result.shortages.length > 0) {
      toast.warning(
        `자동 채우기 완료 — ${result.shortages.length}개 주차에 미션이 부족합니다. 선택 주제는 유지했습니다.`,
      );
    } else {
      toast.success(
        `자동 채우기 완료 — ${result.filledWeeks}개 주차에 미션 ${result.totalAssigned}개 (저장 전)`,
      );
    }
    if (result.expandedThemeWeeks.length > 0) {
      toast.info(`교수자 승인으로 ${result.expandedThemeWeeks.length}개 주차의 주제 범위를 확대했습니다.`);
    }
  };

  const removeItem = (weekNo: number, scenarioId: string) =>
    setAssign((prev) => removeAssignment(prev, weekNo, scenarioId));

  const addItem = (weekNo: number, c: ComposerCore) =>
    setAssign((prev) => addAssignment(prev, weekNo, c));

  const handleSave = async () => {
    if (!outlineId) return;
    const flat: WeekAssignment[] = [];
    for (const [weekNoStr, items] of Object.entries(assign)) {
      const weekNo = Number(weekNoStr);
      items.forEach((it, i) =>
        flat.push({ week_no: weekNo, scenario_id: it.scenario_id, position: i, slot_role: it.slot_role }),
      );
    }
    const unreviewed = flat.filter((item) => !isReviewedMission(coreById[item.scenario_id]));
    if (unreviewed.length > 0) {
      toast.error(`검토 완료되지 않은 미션 ${unreviewed.length}개를 편성에서 제거한 뒤 저장하세요.`);
      return;
    }
    const duplicates = duplicateScenarioIds(assign);
    if (duplicates.length > 0) {
      toast.error(`같은 시나리오가 여러 주차에 중복 배정되어 있습니다 (${duplicates.length}개).`);
      return;
    }
    const structureIssues = assignmentStructureIssues(
      assign,
      coreById,
      weeks,
      level,
      direction,
      outline?.scenarios_per_week ?? 0,
    );
    if (structureIssues.length > 0) {
      toast.error(
        `주차 계획과 맞지 않는 배정 ${structureIssues.length}건이 있습니다. 자동 채우기하거나 교체한 뒤 저장하세요.`,
      );
      return;
    }
    setSaving(true);
    try {
      // 현재 배정이 새 축과 호환됨을 먼저 확인했으므로, 축을 바꿔도 기존 편성이
      // 불일치 상태가 되지 않는다. 주차 골격은 이 전용 API가 건드리지 않는다.
      const compositionUpdate = await updateCurriculumCompositionAxes(outlineId, {
        level,
        language_direction: direction,
        composition_theme_codes: themes,
        target_interpreting_ratio: interpRatio,
      });
      await saveWeekAssignments(outlineId, flat);
      // 저장 직후 DB에서 두 층을 다시 읽어와 실제 반영을 확인(라운드트립 증명).
      const [{ outline: reloadedOutline, weeks: reloadedWeeks }, reloaded] = await Promise.all([
        getCurriculumOutline(outlineId),
        listWeekAssignments(outlineId),
      ]);
      const reloadedHasPolicy =
        Array.isArray(reloadedOutline.composition_theme_codes) &&
        typeof reloadedOutline.target_interpreting_ratio === "number";
      const savedThemes = reloadedHasPolicy
        ? reloadedOutline.composition_theme_codes.filter(
            (theme): theme is ThemeCode => THEME_CODES.includes(theme as ThemeCode),
          )
        : themes;
      const savedRatio = reloadedHasPolicy
        ? reloadedOutline.target_interpreting_ratio
        : interpRatio;
      const hydratedOutline = reloadedHasPolicy
        ? reloadedOutline
        : {
            ...reloadedOutline,
            composition_theme_codes: savedThemes,
            target_interpreting_ratio: savedRatio,
          };
      setOutline(hydratedOutline);
      setWeeks(reloadedWeeks);
      setLevel(reloadedOutline.level as LearnerLevel);
      setDirection(reloadedOutline.language_direction as LanguageDirection);
      setThemes(savedThemes);
      setInterpRatio(savedRatio);
      setPolicyBaseline({
        themeKey: themePolicyKey(savedThemes),
        interpretingRatio: savedRatio,
      });
      setOutlines((prev) => prev.map((item) => (item.id === outlineId ? hydratedOutline : item)));
      setAssign(assignmentsToMap(reloaded));
      toast.success(`편성 저장 완료 — DB에서 ${reloaded.length}개 확인`);
      if (!compositionUpdate.compositionPolicyPersisted) {
        toast.warning("DB 확장 전 호환 모드: 주제·통역 목표는 다음 접속 때 실제 배정에서 복원됩니다.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const assignedModeCounts = useMemo(() => {
    let interpreting = 0;
    let translation = 0;
    for (const items of Object.values(assign)) {
      for (const item of items) {
        const core = coreById[item.scenario_id];
        if (!core) continue;
        if (core.mode === "stt_interpreting") interpreting += 1;
        else translation += 1;
      }
    }
    return { interpreting, translation };
  }, [assign, coreById]);

  const axesDirty = Boolean(
    outline &&
      ((outline.level as LearnerLevel) !== level ||
        (outline.language_direction as LanguageDirection) !== direction ||
        (policyBaseline !== null &&
          (policyBaseline.themeKey !== themePolicyKey(themes) ||
            policyBaseline.interpretingRatio !== interpRatio))),
  );
  const weekColumnBreak = Math.ceil(weeks.length / 2);

  const handleStructureSaved = (saved: {
    outline: CurriculumOutlineRow;
    weeks: CurriculumWeekRow[];
  }) => {
    setStructureEditor(null);
    setOutline(saved.outline);
    setWeeks(saved.weeks);
    setOutlineId(saved.outline.id);
    setReloadToken((token) => token + 1);
  };

  if (structureEditor) {
    return (
      <AdminShell
        title="AI 15주 교과목 설계"
        compact
        description={
          structureEditor === "new"
            ? "새 교과목의 최소 정보만 정하면 표준 15주 강의 계획을 자동으로 준비합니다."
            : "필요한 주차 계획만 수정하고 저장하면 AI 편성 화면으로 돌아갑니다."
        }
      >
        <section className="rounded-xl border border-[#D7E3DC] bg-[#F8FCF9] p-5">
          <CurriculumEditor
            outlineId={structureEditor === "new" ? null : outlineId}
            assignments={assign}
            coreById={coreById}
            compositionLevel={level}
            compositionDirection={direction}
            compositionThemes={themes}
            compositionInterpretingRatio={interpRatio}
            onClose={() => setStructureEditor(null)}
            onSaved={handleStructureSaved}
          />
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="AI 15주 교과목 설계"
      description="수준·주제·통번역 모드·언어방향별로 15주 강의 계획을 AI가 편성합니다."
      compact
    >
      <div className="w-full max-w-[960px]">
      <section
        aria-label="교과목 설계 흐름"
        className="relative mb-3 overflow-hidden rounded-xl border border-[#D8D3C6] bg-white shadow-[0_6px_18px_rgba(21,32,43,0.07)]"
      >
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-[#15202B]" />
        <div className="grid divide-y divide-[#EAE4D2] pt-1 md:grid-cols-3 md:divide-x md:divide-y-0">
          {[
            {
              step: "1",
              title: "교과목 설정",
              copy: "교과목명·수준·언어방향 설정",
            },
            {
              step: "2",
              title: "AI 자동 편성",
              copy: "주제·통번역 모드 비율 기반 미션 배정",
            },
            {
              step: "3",
              title: "주차별 조정",
              copy: "필요한 주차의 미션 추가·제거",
            },
          ].map(({ step, title, copy }) => (
            <div key={step} className="flex items-start gap-2.5 px-4 py-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#15202B] text-[11px] font-semibold text-white">
                {step}
              </span>
              <div className="min-w-0">
                <span className="text-[15px] font-semibold leading-tight text-[#15202B]">{title}</span>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 상단 컨트롤 ── */}
      <section>
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
            {error} (관리자 로그인이 필요합니다)
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E2DED2] bg-white p-3 text-[13px] shadow-[0_4px_14px_rgba(21,32,43,0.04)]">
          <span className="shrink-0 rounded-full bg-[#EEF2F1] px-3 py-1.5 font-semibold text-[#365F58]">
            1 · 교과목
          </span>
          <select
            aria-label="교과목 선택"
            value={outlineId}
            onChange={(event) => setOutlineId(event.target.value)}
            disabled={loading}
            className="h-9 min-w-[280px] max-w-[620px] flex-1 rounded-md border border-[#D9DED9] bg-white px-3"
          >
            <option value="">— 교과목 선택 —</option>
            {outlines.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} · {LEVEL[item.level as LearnerLevel] ?? item.level}
              </option>
            ))}
          </select>

          <Button className="h-9" variant="outline" onClick={() => setStructureEditor("new")}>
            새 교과목
          </Button>
          <Button
            className="h-9"
            variant="outline"
            onClick={() => setStructureEditor("current")}
            disabled={!outlineId}
          >
            주차 계획 수정
          </Button>
          <Button
            className="ml-auto h-9"
            variant="outline"
            onClick={handleSave}
            disabled={!outlineId || saving}
          >
            {saving ? "저장 중…" : "교과목 편성 저장"}
          </Button>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-[#CFC9B9] bg-white shadow-[0_10px_26px_rgba(21,32,43,0.09)]">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1E2F3A] px-4 py-3 text-white">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FAD338]">
                    핵심 자동화
                  </span>
                  {axesDirty && (
                    <Badge className="border-0 bg-[#FAD338] font-normal text-[#15202B] hover:bg-[#FAD338]">
                      저장 전 변경
                    </Badge>
                  )}
                </div>
                <h2 className="mt-0.5 text-[18px] font-semibold leading-tight">2 · AI 자동 편성</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                  <span className="whitespace-nowrap text-[11.5px] font-semibold text-[#F1EFE8]">
                    프리셋 · 빠른 시작
                  </span>
                  <select
                    value={presetCode}
                    onChange={(event) => applyPreset(event.target.value)}
                    className="h-9 min-w-[210px] rounded-md border border-white/20 bg-white px-2 text-[15px] text-[#15202B]"
                  >
                    <option value="">— 직접 설정 —</option>
                    {COURSE_PRESETS.map((item) => (
                      <option key={item.preset_code} value={item.preset_code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  className="h-9 bg-[#FAD338] text-[14px] font-semibold text-[#15202B] hover:bg-[#EAC42E]"
                  onClick={() => (outline ? autoFill(false) : setStructureEditor("new"))}
                  disabled={loadingOutline}
                >
                  {outline ? "AI 자동 채우기" : "AI 편성 시작"}
                </Button>
              </div>
            </div>

            <div className="px-4 py-3.5 text-[13px]">
            <div className="grid max-w-[900px] gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(180px,210px)_minmax(180px,210px)_minmax(300px,420px)]">
              <label className="rounded-lg border border-[#E2DED2] bg-[#FAF9F5] p-3">
                <span className="flex items-center gap-2 font-semibold text-[#15202B]">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E5E7E8] text-[11px]">1</span>
                  수준
                </span>
                <select
                  value={level}
                  onChange={(event) => setLevel(event.target.value as LearnerLevel)}
                  className="mt-1.5 h-8 w-full rounded-md border border-[#D8D4C8] bg-white px-2"
                >
                  {LEVELS.map((item) => (
                    <option key={item} value={item}>{LEVEL[item]}</option>
                  ))}
                </select>
              </label>
              <label className="rounded-lg border border-[#E2DED2] bg-[#FAF9F5] p-3">
                <span className="flex items-center gap-2 font-semibold text-[#15202B]">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E5E7E8] text-[11px]">2</span>
                  언어방향
                </span>
                <select
                  value={direction}
                  onChange={(event) => setDirection(event.target.value as LanguageDirection)}
                  className="mt-1.5 h-8 w-full rounded-md border border-[#D8D4C8] bg-white px-2"
                >
                  {DIRECTIONS.map((item) => (
                    <option key={item} value={item}>{DIRECTION_LABEL[item]}</option>
                  ))}
                </select>
              </label>
              <div className="rounded-lg border border-[#E2DED2] bg-[#FAF9F5] p-3 sm:col-span-2 lg:col-span-1">
                <span className="flex items-center gap-2 font-semibold text-[#15202B]">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E5E7E8] text-[11px]">3</span>
                  통번역 모드 비율
                </span>
                <div className="mt-1.5 flex h-8 items-center gap-2 rounded-md border border-[#D8D4C8] bg-white px-3">
                  <span className="text-[12px]">번역</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(interpRatio * 100)}
                    onChange={(event) => setInterpRatio(Number(event.target.value) / 100)}
                    className="min-w-32 flex-1"
                    aria-label="통역 비율"
                  />
                  <span className="whitespace-nowrap tabular-nums">
                    통역 {Math.round(interpRatio * 100)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2.5 rounded-lg border border-[#D8D3C6] border-t-2 border-t-[#FAD338] bg-[#FBFAF6] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold text-[#15202B]">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E5E7E8] text-[11px]">4</span>
                  주제
                  <span className="font-normal text-[#766C54]">
                    {themes.length === 0 ? `전체 ${THEME_CODES.length}개` : `선택 ${themes.length}개`}
                  </span>
                </span>
                <span className="text-[11.5px] text-muted-foreground">
                  여러 주제를 함께 선택해 강의 맥락을 넓힐 수 있습니다.
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setThemes([])}
                  className={`rounded-md border px-3 py-1 transition ${
                    themes.length === 0
                      ? "border-[#15202B] bg-[#15202B] text-white"
                      : "border-[#EAE4D2] bg-white hover:bg-[#FAF8F2]"
                  }`}
                >
                  전체
                </button>
                {THEME_CODES.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => toggleTheme(theme)}
                    className={`rounded-md border px-3 py-1 transition ${
                      themes.includes(theme)
                        ? "border-[#FAD338] bg-[#FFF3C4] text-[#15202B]"
                        : "border-[#EAE4D2] bg-white hover:bg-[#FAF8F2]"
                    }`}
                  >
                    {THEME_LABEL[theme]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#EAE4D2] pt-2.5 text-[11.5px] text-muted-foreground">
              {outline ? (
                <span>
                  현재 배정 · 번역 {assignedModeCounts.translation}개 / 통역 {assignedModeCounts.interpreting}개
                </span>
              ) : (
                <span className="font-medium text-[#365F58]">교과목 생성 전 편성 조건</span>
              )}
              <span
                className={`inline-flex rounded-full px-3 py-0.5 font-medium ${
                  availableMissionCount > 0
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-amber-50 text-amber-900"
                }`}
              >
                자동 편성 가능 {availableMissionCount}개
              </span>
              <span>
                {outline
                  ? "각 주차 미션은 아래에서 직접 교체할 수 있습니다."
                  : "현재 설정은 새 교과목에 그대로 적용됩니다."}
              </span>
            </div>

            {autoFillShortages.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                <span>
                  선택 주제를 지키면서 채우지 못한 주차가 {autoFillShortages.length}개 있습니다: {" "}
                  {autoFillShortages.map((item) => `${item.weekNo}주차 ${item.missingSlots}개`).join(", ")}
                </span>
                {themes.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => autoFill(true)}>
                    다른 주제까지 확대해 다시 채우기
                  </Button>
                )}
              </div>
            )}
            </div>
          </div>

        {/* 선택한 프리셋이 학기 전체에서 무엇을 반복시키는지 교수자에게 설명한다. */}
        {preset && (
          <div className="mt-3 rounded-lg border border-[#EAE4D2] bg-[#FAF7EE] p-3 text-[13px] leading-relaxed">
            <span className="font-medium">반복 원칙 · {preset.label}</span>
            <p className="mt-1">{preset.repetition_principle}</p>
          </div>
        )}
      </section>

      {/* ── 편성표 ── */}
      {!outlineId ? (
        <div className="mt-4 rounded-lg border border-dashed border-[#CFC9B9] bg-white/55 px-4 py-3 text-[12px] text-muted-foreground">
          교과목을 만들거나 기존 교과목을 선택하면 15주 미션 배치가 이곳에 나타납니다.
        </div>
      ) : loadingOutline ? (
        <p className="mt-4 text-[13px] text-muted-foreground">주차 골격을 불러오는 중…</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 border-l-4 border-[#FAD338] pl-3">
            <div>
              <h2 className="text-[18px] font-semibold">3 · 주차별 미션 조정</h2>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                AI 편성 결과를 확인하고, 필요한 주차에서 미션을 추가하거나 제거하세요.
              </p>
            </div>
            <span className="text-[12px] text-muted-foreground">
              현재 {assignedModeCounts.translation + assignedModeCounts.interpreting}개 배정
            </span>
          </div>

          <div className="mt-2.5 grid items-start gap-3 xl:grid-cols-2">
            {[weeks.slice(0, weekColumnBreak), weeks.slice(weekColumnBreak)].map((column, columnIndex) => (
              <div
                key={columnIndex === 0 ? "weeks-1-8" : "weeks-9-15"}
                className="overflow-hidden rounded-xl border border-[#EAE4D2] bg-white shadow-[0_4px_16px_rgba(21,32,43,0.04)] divide-y divide-[#EAE4D2]"
              >
                {column.map((w) => (
                  <WeekRow
                    key={w.id}
                    week={w}
                    items={assign[w.week_no] ?? []}
                    assignments={assign}
                    coreById={coreById}
                    candidates={cores}
                    level={level}
                    themes={themes}
                    direction={direction}
                    adding={addingWeek === w.week_no}
                    onToggleAdd={() =>
                      setAddingWeek((cur) => (cur === w.week_no ? null : w.week_no))
                    }
                    onAdd={(c) => addItem(w.week_no, c)}
                    onRemove={(sid) => removeItem(w.week_no, sid)}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
      </div>
    </AdminShell>
  );
};

function assignmentsToMap(rows: WeekAssignment[]): AssignMap {
  const m: AssignMap = {};
  for (const a of rows) {
    (m[a.week_no] ??= []).push({ scenario_id: a.scenario_id, slot_role: a.slot_role });
  }
  return m;
}

// ── 주차 한 행 ──────────────────────────────────────────────────────────
function WeekRow({
  week,
  items,
  assignments,
  coreById,
  candidates,
  level,
  themes,
  direction,
  adding,
  onToggleAdd,
  onAdd,
  onRemove,
}: {
  week: CurriculumWeekRow;
  items: AssignedItem[];
  assignments: AssignMap;
  coreById: Record<string, ComposerCore>;
  candidates: ComposerCore[];
  level: LearnerLevel;
  themes: ThemeCode[];
  /** 현재 편성 언어 방향 — 후보 필터 절대 조건(0-l·91, 오배정 창 방지) */
  direction: LanguageDirection;
  adding: boolean;
  onToggleAdd: () => void;
  onAdd: (c: ComposerCore) => void;
  onRemove: (scenarioId: string) => void;
}) {
  const act = week.speech_act as SpeechActUI | null;
  const isAssignable = week.type === "regular";
  // 미션에 확정된 초점이 없을 때만 주차 화행의 기본 초점을 보조값으로 사용한다.
  // 교수자 화면에서는 연구 구현 단계명 대신 실제 학습 초점만 보여준다.
  const plannedFeatureCode = act ? DEFAULT_FEATURE_BY_ACT[act] : undefined;
  const plannedLabel = plannedFeatureCode
    ? getTargetFeature(plannedFeatureCode)?.learner_label ?? plannedFeatureCode
    : null;
  const displayTitle = week.type === "orientation" ? "오리엔테이션" : week.title ?? "";

  const cands = filterManualCandidates(candidates, {
    act,
    level,
    direction,
    themes,
    assignments,
  });

  return (
    <div className={`px-3 py-2 ${isAssignable ? "bg-white" : "bg-[#FAF8F2]"}`}>
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        <span className="inline-flex h-6 min-w-[3rem] items-center justify-center rounded-md bg-[#ECEFF1] px-2 text-[12px] font-semibold text-[#46515A]">
          {week.week_no}주차
        </span>
        <span className="text-[13.5px] font-medium">{displayTitle}</span>
        {items.length > 0 && (
          <span className="ml-auto text-[11.5px] text-muted-foreground">미션 {items.length}개</span>
        )}
        {isAssignable ? (
          <Button
            className={`${items.length > 0 ? "" : "ml-auto"} h-7 px-2 text-[12px] font-normal text-[#59636B] hover:bg-[#F3F1EA]`}
            variant="ghost"
            size="sm"
            onClick={onToggleAdd}
          >
            {adding ? "닫기" : "+ 미션"}
          </Button>
        ) : null}
      </div>

      {/* 주차 흐름을 끊지 않도록 배정 미션은 별도 카드가 아닌 구분선 목록으로 표시한다. */}
      {items.length > 0 && (
        <div className="mt-2.5 border-t border-[#F0EBDD]">
          {items.map((item) => {
            const core = coreById[item.scenario_id];
            const feature = core?.target_feature ? getTargetFeature(core.target_feature) : undefined;
            const featureLabel = core?.target_feature
              ? feature?.learner_label ?? core.target_feature
              : plannedLabel ?? "초점 미지정";
            return (
              <div
                key={item.scenario_id}
                className="border-b border-[#F0EBDD] py-2.5 last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  <p
                    className="line-clamp-2 min-w-0 flex-1 text-[12.5px] leading-relaxed"
                    title={core?.situation_ko ?? "누락된 시나리오"}
                  >
                    {core?.situation_ko ?? "(누락된 시나리오)"}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRemove(item.scenario_id)}
                    className="shrink-0 text-[11.5px] text-red-700 hover:underline"
                  >
                    제거
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-[#ECEFF1] px-2 py-0.5 text-[#52616B]">
                    {core
                      ? core.mode === "stt_interpreting"
                        ? MODE_LABEL.stt_interpreting
                        : MODE_LABEL.translation
                      : "모드 미지정"}
                  </span>
                  <span className="rounded-full bg-[#EAF5F1] px-2 py-0.5 text-[#2F6F63]">
                    {featureLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 후보 추가 패널 */}
      {adding && isAssignable && (
        <div className="mt-3 rounded-lg border border-dashed border-[#D8D0BC] bg-[#FAF8F2] p-3">
          <p className="mb-2 text-[11.5px] text-muted-foreground">
            현재 방향·수준·주제와 맞는 검토 완료 미션만 표시됩니다.
          </p>
          {cands.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">
              조건에 맞는 후보 코어가 없습니다
              {act ? ` (${SPEECH_ACT_UI[act]} · ${LEVEL[level]}${themes.length ? " · 선택 주제" : ""})` : ""}.
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
                      {c.mode === "stt_interpreting" ? MODE_LABEL.stt_interpreting : MODE_LABEL.translation}
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
