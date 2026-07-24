import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCurriculumOutline,
  createCurriculumOutline,
  updateCurriculumOutline,
} from "@/lib/curriculum/api";
import {
  outlineRowToDraft,
  weekRowToDraft,
  createEmptyOutlineDraft,
} from "@/lib/curriculum/mappers";
import {
  createStandard15WeekTemplate,
  STANDARD_TARGET_ACTS,
  STANDARD_MIDTERM_WEEK,
  STANDARD_FINAL_WEEK,
  ROLE_LABEL,
  STAGE_LABEL,
  weekRole,
} from "@/lib/curriculum/template";
import { COURSE_PRESETS } from "@/lib/pragma/scenarioTopics";
import { validateCurriculum } from "@/lib/curriculum/validate";
import type { CurriculumValidationResult } from "@/lib/curriculum/validate";
import type {
  CurriculumOutlineDraft,
  CurriculumWeekDraft,
  CurriculumStatus,
  CurriculumWeekType,
} from "@/lib/curriculum/types";
import {
  SPEECH_ACT_UI,
  LEVEL,
  PDR_POWER,
  PDR_DISTANCE,
  PDR_BURDEN,
  DOMAIN,
  INDUSTRY,
} from "@/lib/pragma/enums";
import type {
  SpeechActUI,
  LearnerLevel,
  LanguageDirection,
  ChannelUI,
  PdrPower,
  PdrDistance,
  PdrBurden,
  Domain,
  IndustrySector,
} from "@/lib/pragma/enums";

// Editor-local labels (channel / language_direction have no shared label map in
// enums.ts; kept local per task scope — no shared enum refactor).
const CHANNEL_LABEL: Record<ChannelUI, string> = {
  email: "이메일",
  messenger: "메신저",
  facetoface: "대면",
  phone: "전화",
};
const LANGUAGE_DIRECTION_LABEL: Record<LanguageDirection, string> = {
  ko_zh: "한→중",
  zh_ko: "중→한",
};
const STATUS_LABEL: Record<CurriculumStatus, string> = {
  draft: "초안",
  published: "게시",
  archived: "보관",
};
const WEEK_TYPE_LABEL: Record<CurriculumWeekType, string> = {
  orientation: "오리엔테이션",
  regular: "정규",
  midterm: "중간",
  final: "기말",
};

const NONE = "__none__";

// Fields that only make sense on a regular week (mirror validate.ts).
const REGULAR_WEEK = "regular";

interface CurriculumEditorProps {
  /** null = create a new outline; otherwise edit the existing one. */
  outlineId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export const CurriculumEditor = ({ outlineId, onClose, onSaved }: CurriculumEditorProps) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outline, setOutline] = useState<CurriculumOutlineDraft | null>(null);
  const [weeks, setWeeks] = useState<CurriculumWeekDraft[]>([]);
  const [saving, setSaving] = useState(false);
  // Validation is only surfaced after a save attempt (avoids nagging on load).
  const [issues, setIssues] = useState<CurriculumValidationResult | null>(null);
  // 프리셋 = 생성 편의(수준 세팅 + 편성기 콘텐츠 채우기 파라미터). outline에 저장 안 됨(7월).
  const [presetCode, setPresetCode] = useState<string>(COURSE_PRESETS[0]?.preset_code ?? "");
  // 주차별 상세 override 펼침 상태(기본 접힘 — 표준 골격은 수기 입력 불요).
  const [openWeek, setOpenWeek] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        if (outlineId === null) {
          if (!cancelled) {
            // 새 과정 = 공통 표준 골격 자동 생성. 중간=8·기말=15·목표화행 9종·15주
            // draft를 미리 채워, 제목·수준·방향·프리셋만 정하면 저장되게 한다.
            setOutline({
              ...createEmptyOutlineDraft(),
              midterm_week: STANDARD_MIDTERM_WEEK,
              final_week: STANDARD_FINAL_WEEK,
              target_speech_acts: [...STANDARD_TARGET_ACTS],
            });
            setWeeks(createStandard15WeekTemplate());
          }
        } else {
          const { outline: row, weeks: weekRows } = await getCurriculumOutline(outlineId);
          if (!cancelled) {
            setOutline(outlineRowToDraft(row));
            setWeeks(weekRows.map(weekRowToDraft));
          }
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "커리큘럼을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [outlineId]);

  const patchOutline = (patch: Partial<CurriculumOutlineDraft>) =>
    setOutline((prev) => (prev ? { ...prev, ...patch } : prev));

  const patchWeek = (index: number, patch: Partial<CurriculumWeekDraft>) =>
    setWeeks((prev) => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)));

  // 프리셋 선택 = 수준을 프리셋 목표 수준으로 맞춘다(편의). 테마·콘텐츠 반영은 편성기.
  const applyPreset = (code: string) => {
    setPresetCode(code);
    const p = COURSE_PRESETS.find((x) => x.preset_code === code);
    if (p) patchOutline({ level: p.target_level });
  };

  const handleSave = async () => {
    if (!outline) return;
    const result = validateCurriculum(outline, weeks);
    setIssues(result);
    if (result.errors.length > 0) {
      toast.error(`저장할 수 없습니다. 오류 ${result.errors.length}건을 확인하세요.`);
      return;
    }
    setSaving(true);
    try {
      if (outlineId === null) {
        await createCurriculumOutline(outline, weeks);
      } else {
        await updateCurriculumOutline(outlineId, outline, weeks);
      }
      toast.success("커리큘럼을 저장했습니다.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const numToInput = (v: number | null) => (v === null ? "" : String(v));
  const inputToNullableNum = (raw: string): number | null => {
    const t = raw.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  const errors = issues?.errors ?? [];
  const warnings = issues?.warnings ?? [];
  const weekNumbers = useMemo(() => Array.from({ length: 15 }, (_, i) => i + 1), []);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        불러오는 중…
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-[13px] text-destructive">
          커리큘럼 조회 실패: {loadError}
        </div>
        <Button variant="outline" onClick={onClose}>
          ← 목록으로
        </Button>
      </div>
    );
  }
  if (!outline) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {outlineId === null ? "새 커리큘럼" : "커리큘럼 편집"}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-[13px] text-destructive">
          <div className="mb-1 font-medium">오류 {errors.length}건 — 저장이 차단됩니다</div>
          <ul className="list-disc space-y-0.5 pl-5">
            {errors.map((e, i) => (
              <li key={`${e.code}-${e.week_no ?? "o"}-${i}`}>
                {e.week_no ? `${e.week_no}주차: ` : ""}
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-400/50 bg-amber-50 p-3 text-[13px] text-amber-800">
          <div className="mb-1 font-medium">경고 {warnings.length}건 — 저장은 가능합니다</div>
          <ul className="list-disc space-y-0.5 pl-5">
            {warnings.map((w, i) => (
              <li key={`${w.code}-${w.week_no ?? "o"}-${i}`}>
                {w.week_no ? `${w.week_no}주차: ` : ""}
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Outline fields ── */}
      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-muted-foreground">기본 정보</h3>
        <p className="text-[12.5px] text-muted-foreground">
          제목·수준·언어 방향·프리셋만 정하면 저장됩니다. 15개 주차는 공통 표준 골격으로 자동 생성되며,
          주차별 상황·P·D·R은 편성기에서 배정하는 시나리오가 정본입니다.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>제목</Label>
            <Input
              value={outline.title}
              onChange={(e) => patchOutline({ title: e.target.value })}
              placeholder="예: 2026-2 중급 통번역"
            />
          </div>
          <div className="space-y-1.5">
            <Label>수준</Label>
            <Select value={outline.level} onValueChange={(v) => patchOutline({ level: v as LearnerLevel })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LEVEL) as LearnerLevel[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {LEVEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>언어 방향</Label>
            <Select
              value={outline.language_direction}
              onValueChange={(v) => patchOutline({ language_direction: v as LanguageDirection })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LANGUAGE_DIRECTION_LABEL) as LanguageDirection[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {LANGUAGE_DIRECTION_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>강좌 프리셋</Label>
            <Select value={presetCode} onValueChange={applyPreset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COURSE_PRESETS.map((p) => (
                  <SelectItem key={p.preset_code} value={p.preset_code}>
                    {p.label} · {LEVEL[p.target_level]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11.5px] text-muted-foreground">
              프리셋의 테마·통역 비율은 편성기 콘텐츠 채우기에서 적용됩니다(이 과정은 9화행을 모두 다룹니다).
            </p>
          </div>
        </div>

        {/* 고급 설정 — 기본값으로 저장 가능. 필요 시에만 조정 */}
        <details className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
          <summary className="cursor-pointer text-[12.5px] font-medium text-muted-foreground">
            고급 설정 (상태·중간/기말 주차·학기 목표 — 기본값으로 저장 가능)
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>상태</Label>
              <Select value={outline.status} onValueChange={(v) => patchOutline({ status: v as CurriculumStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as CurriculumStatus[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {STATUS_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>주차 수 (고정)</Label>
              <Input value={outline.week_count} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>중간고사 주차</Label>
              <Input
                type="number"
                value={numToInput(outline.midterm_week)}
                onChange={(e) => patchOutline({ midterm_week: inputToNullableNum(e.target.value) })}
                placeholder="예: 8"
              />
            </div>
            <div className="space-y-1.5">
              <Label>기말고사 주차</Label>
              <Input
                type="number"
                value={numToInput(outline.final_week)}
                onChange={(e) => patchOutline({ final_week: inputToNullableNum(e.target.value) })}
                placeholder="예: 15"
              />
            </div>
            <div className="space-y-1.5">
              <Label>주당 시나리오 수</Label>
              <Input
                type="number"
                value={String(outline.scenarios_per_week)}
                onChange={(e) => patchOutline({ scenarios_per_week: inputToNullableNum(e.target.value) ?? 0 })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>학기 목표 (선택)</Label>
              <Textarea
                value={outline.semester_goal}
                onChange={(e) => patchOutline({ semester_goal: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        </details>
      </section>

      {/* ── Weeks ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">주차별 골격 (자동 생성)</h3>
          <span className="text-[12px] text-muted-foreground">필요한 주차만 「수정」으로 조정</span>
        </div>
        {weeks.map((w, i) => {
          const isRegular = w.type === REGULAR_WEEK;
          const role = weekRole(w.week_no);
          const open = openWeek === w.week_no;
          return (
            <div key={w.week_no} className="space-y-3 rounded-lg border border-border bg-card p-4">
              {/* 컴팩트 헤더 — 주차·역할·화행·제목(읽기) + 수정 토글 */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex h-7 min-w-[3rem] items-center justify-center rounded-md bg-muted px-2 text-[13px] font-medium">
                  {w.week_no}주차
                </span>
                <span className="rounded bg-[#EEF2F6] px-2 py-0.5 text-[11.5px] font-medium text-[#5B6B76]">
                  {ROLE_LABEL[role]} · {STAGE_LABEL[role]}
                </span>
                {w.speech_act && (
                  <span className="rounded bg-[#FFF3C4] px-2 py-0.5 text-[11.5px] font-medium text-[#6B5518]">
                    {SPEECH_ACT_UI[w.speech_act]}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{w.title || "(제목 없음)"}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[12px]"
                  onClick={() => setOpenWeek(open ? null : w.week_no)}
                >
                  {open ? "닫기" : "수정"}
                </Button>
              </div>

              {open && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-40">
                      <Select
                        value={w.type}
                        onValueChange={(v) => patchWeek(i, { type: v as CurriculumWeekType })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(WEEK_TYPE_LABEL) as CurriculumWeekType[]).map((k) => (
                            <SelectItem key={k} value={k}>
                              {WEEK_TYPE_LABEL[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      className="h-8 flex-1"
                      value={w.title}
                      onChange={(e) => patchWeek(i, { title: e.target.value })}
                      placeholder="주차 제목 (선택)"
                    />
                  </div>

              {isRegular && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <NullableSelect
                    label="화행"
                    value={w.speech_act}
                    options={SPEECH_ACT_UI}
                    onChange={(v) => patchWeek(i, { speech_act: v as SpeechActUI | null })}
                  />
                  <NullableSelect
                    label="채널"
                    value={w.channel}
                    options={CHANNEL_LABEL}
                    onChange={(v) => patchWeek(i, { channel: v as ChannelUI | null })}
                  />
                  <NullableSelect
                    label="P (권력)"
                    value={w.pdr_power}
                    options={PDR_POWER}
                    onChange={(v) => patchWeek(i, { pdr_power: v as PdrPower | null })}
                  />
                  <NullableSelect
                    label="D (거리)"
                    value={w.pdr_distance}
                    options={PDR_DISTANCE}
                    onChange={(v) => patchWeek(i, { pdr_distance: v as PdrDistance | null })}
                  />
                  <NullableSelect
                    label="R (부담)"
                    value={w.pdr_imposition}
                    options={PDR_BURDEN}
                    onChange={(v) => patchWeek(i, { pdr_imposition: v as PdrBurden | null })}
                  />
                  <NullableSelect
                    label="도메인"
                    value={w.domain}
                    options={DOMAIN}
                    onChange={(v) => patchWeek(i, { domain: v as Domain | null })}
                  />
                  <NullableSelect
                    label="산업 분야"
                    value={w.industry}
                    options={INDUSTRY}
                    onChange={(v) => patchWeek(i, { industry: v as IndustrySector | null })}
                  />
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">부하 밴드 (1–5)</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={numToInput(w.curriculum_load_band)}
                      onChange={(e) =>
                        patchWeek(i, { curriculum_load_band: inputToNullableNum(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">시나리오 슬롯</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={numToInput(w.scenario_slots)}
                      onChange={(e) =>
                        patchWeek(i, { scenario_slots: inputToNullableNum(e.target.value) })
                      }
                    />
                  </div>
                </div>
              )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-[12px]">역량 초점 (선택)</Label>
                      <Input
                        className="h-8"
                        value={w.competency_focus}
                        onChange={(e) => patchWeek(i, { competency_focus: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px]">Can-do 목표 (줄바꿈으로 구분)</Label>
                      <Textarea
                        rows={2}
                        value={w.can_do.join("\n")}
                        onChange={(e) =>
                          patchWeek(i, {
                            can_do: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter((s) => s !== ""),
                          })
                        }
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </section>

      <div className="flex justify-end gap-2 pb-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          취소
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </Button>
      </div>
    </div>
  );
};

// Small nullable-select helper (shadcn Select can't hold an empty value, so a
// sentinel option represents "미선택").
function NullableSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: Record<string, string>;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px]">{label}</Label>
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>미선택</SelectItem>
          {Object.keys(options).map((k) => (
            <SelectItem key={k} value={k}>
              {options[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default CurriculumEditor;
