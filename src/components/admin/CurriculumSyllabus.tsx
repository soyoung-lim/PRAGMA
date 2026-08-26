import type { ComposerCore } from "@/lib/curriculum/composer";
import type { AssignedItem, AssignMap } from "@/lib/curriculum/composerPlanning";
import type { CurriculumOutlineRow, CurriculumWeekRow } from "@/lib/curriculum/types";
import {
  DIRECTION_LABEL,
  DOMAIN,
  LEVEL,
  MODE_LABEL,
  SPEECH_ACT_UI,
  type Domain,
  type LanguageDirection,
  type LearnerLevel,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import { COURSE_MODE_LABEL, type CourseMode } from "@/lib/curriculum/courseModePolicy";

interface CurriculumSyllabusProps {
  outline: CurriculumOutlineRow;
  weeks: CurriculumWeekRow[];
  assignments: AssignMap;
  coreById: Record<string, ComposerCore>;
}

const weekTypeLabel: Record<string, string> = {
  orientation: "오리엔테이션",
  midterm: "중간 점검",
  final: "기말 점검",
};

function assignmentTitle(item: AssignedItem, coreById: Record<string, ComposerCore>) {
  const core = coreById[item.scenario_id];
  if (!core) return "배정 미션 확인 필요";
  const mode = core.mode === "stt_interpreting" ? MODE_LABEL.stt_interpreting : MODE_LABEL.translation;
  return `${mode} · ${core.situation_ko || "상황 제목 없음"}`;
}

export function CurriculumSyllabus({
  outline,
  weeks,
  assignments,
  coreById,
}: CurriculumSyllabusProps) {
  const targetActs = (outline.target_speech_acts ?? [])
    .map((act) => SPEECH_ACT_UI[act as SpeechActUI] ?? act)
    .join(" · ");

  return (
    <article className="curriculum-syllabus mx-auto max-w-[1000px] bg-white text-[#15202B]">
      <header className="border-b-4 border-[#15202B] pb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#486C65]">PRAGMA COURSE SYLLABUS</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight">{outline.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#52616B]">
          {outline.semester_goal || "학기 목표는 교과목 편성 화면에서 입력합니다."}
        </p>
      </header>

      <section className="mt-5 grid gap-px overflow-hidden rounded-lg border border-[#CCD5D1] bg-[#CCD5D1] sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["수준", LEVEL[outline.level as LearnerLevel] ?? outline.level],
          ["언어 방향", DIRECTION_LABEL[outline.language_direction as LanguageDirection] ?? outline.language_direction],
          ["강좌 수행모드", COURSE_MODE_LABEL[outline.course_mode as CourseMode] ?? outline.course_mode],
          ["주차·미션", `${outline.week_count}주 · 화행 주차당 ${outline.scenarios_per_week}세트`],
          ["영역", DOMAIN[outline.domain as Domain] ?? outline.domain],
          ["핵심 화행", targetActs || "주차 계획 참조"],
          ["담당교수", "________________"],
          ["수업시간·강의실", "________________"],
        ].map(([label, value]) => (
          <div key={label} className="bg-[#F7F9F8] px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#65756F]">{label}</p>
            <p className="mt-1 text-[12.5px] font-medium leading-snug">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6">
        <h2 className="border-l-4 border-[#FAD338] pl-2 text-lg font-bold">학습 운영 원칙</h2>
        <div className="mt-2 grid gap-2 text-[12px] leading-relaxed sm:grid-cols-2">
          <p className="rounded-md bg-[#F7F9F8] px-3 py-2">같은 화행의 완결 미션 2세트를 수행하며, 각 세트는 MPJ5+DCT1로 구성합니다.</p>
          <p className="rounded-md bg-[#F7F9F8] px-3 py-2">MPJ 수행 뒤 5 POINT LESSON으로 핵심 판단 근거를 확인합니다.</p>
          <p className="rounded-md bg-[#F7F9F8] px-3 py-2">DCT는 최초 산출 → 최소 피드백 → 수정 → 참고안 비교 순서로 진행합니다.</p>
          <p className="rounded-md bg-[#F7F9F8] px-3 py-2">교수자는 승인된 미션의 6단계 수업자료와 학생 활동지를 함께 활용합니다.</p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="border-l-4 border-[#FAD338] pl-2 text-lg font-bold">주차별 수업 계획</h2>
        <div className="mt-2 overflow-hidden rounded-lg border border-[#C9D2CE]">
          <table className="w-full table-fixed border-collapse text-left text-[11px] leading-snug">
            <thead className="bg-[#15202B] text-white">
              <tr>
                <th className="w-[7%] px-2 py-2">주차</th>
                <th className="w-[15%] px-2 py-2">화행·주제</th>
                <th className="w-[24%] px-2 py-2">학습목표</th>
                <th className="w-[27%] px-2 py-2">미션 세트 A</th>
                <th className="w-[27%] px-2 py-2">미션 세트 B</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => {
                const items = assignments[week.week_no] ?? [];
                const title = week.speech_act
                  ? SPEECH_ACT_UI[week.speech_act as SpeechActUI] ?? week.speech_act
                  : weekTypeLabel[week.type] ?? week.title ?? "주차 계획";
                const goals = week.can_do?.length
                  ? week.can_do.join(" · ")
                  : week.competency_focus || week.title || "교수자 계획 참조";

                return (
                  <tr key={week.id} className="border-t border-[#DDE3E0] align-top even:bg-[#F8FAF9]">
                    <td className="px-2 py-2 font-bold">{week.week_no}</td>
                    <td className="px-2 py-2 font-semibold">{title}</td>
                    <td className="px-2 py-2">{goals}</td>
                    <td className="px-2 py-2">{items[0] ? assignmentTitle(items[0], coreById) : "—"}</td>
                    <td className="px-2 py-2">{items[1] ? assignmentTitle(items[1], coreById) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["평가 방법", "________________________________\n________________________________"],
          ["출결·과제 정책", "________________________________\n________________________________"],
          ["교재·참고자료", "________________________________\n________________________________"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[#CCD5D1] p-3">
            <h2 className="text-[12px] font-bold">{label} · 교수자 기입</h2>
            <p className="mt-2 whitespace-pre-line text-[11px] leading-7 text-[#65756F]">{value}</p>
          </div>
        ))}
      </section>

      <footer className="mt-6 border-t border-[#CCD5D1] pt-3 text-[10px] text-[#65756F]">
        이 문서는 PRAGMA에 저장된 교과목·주차·미션 편성의 현재 화면 상태를 바탕으로 작성되었습니다.
      </footer>
    </article>
  );
}

export default CurriculumSyllabus;
