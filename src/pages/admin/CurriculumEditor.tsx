import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { createCurriculumWeekTemplate } from "@/lib/curriculum/template";
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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        if (outlineId === null) {
          if (!cancelled) {
            setOutline(createEmptyOutlineDraft());
            setWeeks(createCurriculumWeekTemplate());
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

  const toggleTargetAct = (act: SpeechActUI, checked: boolean) =>
    setOutline((prev) => {
      if (!prev) return prev;
      const has = prev.target_speech_acts.includes(act);
      if (checked && !has) return { ...prev, target_speech_acts: [...prev.target_speech_acts, act] };
      if (!checked && has)
        return { ...prev, target_speech_acts: prev.target_speech_acts.filter((a) => a !== act) };
      return prev;
    });

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
          <div className="space-y-1.5">
            <Label>도메인</Label>
            <Select value={outline.domain} onValueChange={(v) => patchOutline({ domain: v as Domain })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DOMAIN) as Domain[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {DOMAIN[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>산업 분야 (선택)</Label>
            <Select
              value={outline.industry ?? NONE}
              onValueChange={(v) => patchOutline({ industry: v === NONE ? null : (v as IndustrySector) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>미설정</SelectItem>
                {(Object.keys(INDUSTRY) as IndustrySector[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {INDUSTRY[k]}
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
          <div className="space-y-1.5 sm:col-span-2">
            <Label>목표 화행</Label>
            <div className="flex flex-wrap gap-3 pt-1">
              {(Object.keys(SPEECH_ACT_UI) as SpeechActUI[]).map((act) => (
                <label key={act} className="flex items-center gap-1.5 text-[13px]">
                  <Checkbox
                    checked={outline.target_speech_acts.includes(act)}
                    onCheckedChange={(c) => toggleTargetAct(act, c === true)}
                  />
                  {SPEECH_ACT_UI[act]}
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Weeks ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">주차별 설계</h3>
        {weeks.map((w, i) => {
          const isRegular = w.type === REGULAR_WEEK;
          return (
            <div key={w.week_no} className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-7 min-w-[3rem] items-center justify-center rounded-md bg-muted px-2 text-[13px] font-medium">
                  {w.week_no}주차
                </span>
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
