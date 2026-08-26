import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  SYLLABUS_EVALUATION_ROWS,
  hasSyllabusEvaluationWeights,
  syllabusEvaluationTotal,
  type CurriculumSyllabusSettings,
  type SyllabusEvaluationKey,
} from "@/lib/curriculum/syllabusSettings";

interface CurriculumSyllabusSettingsFormProps {
  settings: CurriculumSyllabusSettings;
  onChange: (settings: CurriculumSyllabusSettings) => void;
  onSave: () => void;
}

export function CurriculumSyllabusSettingsForm({
  settings,
  onChange,
  onSave,
}: CurriculumSyllabusSettingsFormProps) {
  const total = syllabusEvaluationTotal(settings);
  const hasWeights = hasSyllabusEvaluationWeights(settings);
  const totalIsValid = !hasWeights || total === 100;

  const updateText = (
    key: "instructorName" | "scheduleLocation" | "attendanceAssignmentPolicy" | "materials",
    value: string,
  ) => onChange({ ...settings, [key]: value });

  const updateWeight = (key: SyllabusEvaluationKey, value: string) => {
    const parsed = value === "" ? null : Number(value);
    onChange({
      ...settings,
      evaluationWeights: {
        ...settings.evaluationWeights,
        [key]: parsed === null || !Number.isFinite(parsed)
          ? null
          : Math.min(100, Math.max(0, Math.round(parsed))),
      },
    });
  };

  return (
    <section className="mb-4 rounded-xl border border-[#D7E3DC] bg-[#F8FCF9] p-4 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-[#15202B]">강의계획서 교수자 입력</h2>
          <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
            15주 내용은 저장된 편성을 그대로 사용합니다. 아래 운영 정보만 이 브라우저에 교과목별로 저장합니다.
          </p>
        </div>
        <Button size="sm" onClick={onSave} disabled={!totalIsValid}>
          교수자 항목 저장
        </Button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-[12px] font-medium text-[#42515A]">
          담당교수
          <Input
            className="mt-1 bg-white"
            value={settings.instructorName}
            onChange={(event) => updateText("instructorName", event.target.value)}
            placeholder="예: 홍길동"
          />
        </label>
        <label className="text-[12px] font-medium text-[#42515A]">
          수업시간·강의실
          <Input
            className="mt-1 bg-white"
            value={settings.scheduleLocation}
            onChange={(event) => updateText("scheduleLocation", event.target.value)}
            placeholder="예: 화 3–4교시 · 000호"
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[12px] font-semibold text-[#42515A]">평가 비중</h3>
          <span className={[
            "rounded-full px-2 py-1 text-[11px] font-semibold",
            totalIsValid ? "bg-[#EAF5F1] text-[#2F6F63]" : "bg-red-50 text-red-800",
          ].join(" ")}>
            합계 {total}%{!totalIsValid ? " · 100%로 맞춰주세요" : ""}
          </span>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {SYLLABUS_EVALUATION_ROWS.map((row) => (
            <label key={row.key} className="rounded-lg border border-[#DCE5E0] bg-white p-2.5 text-[11.5px]">
              <span className="block min-h-8 font-medium text-[#26333B]">{row.label}</span>
              <span className="mt-1 flex items-center gap-1">
                <Input
                  aria-label={`${row.label} 비중`}
                  className="h-8 w-20"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.evaluationWeights[row.key] ?? ""}
                  onChange={(event) => updateWeight(row.key, event.target.value)}
                />
                <span>%</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-[12px] font-medium text-[#42515A]">
          출결·과제 정책
          <Textarea
            className="mt-1 min-h-20 bg-white text-[12px]"
            value={settings.attendanceAssignmentPolicy}
            onChange={(event) => updateText("attendanceAssignmentPolicy", event.target.value)}
            placeholder="출결 기준과 과제 제출 정책을 입력하세요."
          />
        </label>
        <label className="text-[12px] font-medium text-[#42515A]">
          교재·참고자료
          <Textarea
            className="mt-1 min-h-20 bg-white text-[12px]"
            value={settings.materials}
            onChange={(event) => updateText("materials", event.target.value)}
            placeholder="사용할 교재와 참고자료를 입력하세요."
          />
        </label>
      </div>
    </section>
  );
}

export default CurriculumSyllabusSettingsForm;
