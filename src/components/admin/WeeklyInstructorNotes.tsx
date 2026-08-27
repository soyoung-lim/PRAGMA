import type { LearnerCourseWeek } from "@/lib/curriculum/learnerCourse";
import type { InstructorMissionGuide } from "@/lib/pragma/instructorGuide";
import { FEATURE_CODES_BY_ACT, getTargetFeature } from "@/lib/pragma/targetFeatures";

export interface WeeklyMissionNotes {
  scenarioId: string;
  label: string;
  guide: InstructorMissionGuide;
}

/** 관리자 페이지에서만 가져온다. 공용 자료 모델·프로젝터·HTML은 이 컴포넌트를 사용하지 않는다. */
export function WeeklyInstructorNotes({ week, direction, missions }: {
  week: LearnerCourseWeek;
  direction: string;
  missions: WeeklyMissionNotes[];
}) {
  const features = (week.speech_act ? FEATURE_CODES_BY_ACT[week.speech_act] : [])
    .flatMap((code) => { const feature = getTargetFeature(code); return feature ? [feature] : []; });
  return <section aria-label="교수자 전용 메모" className="space-y-4 rounded-xl border border-[#DBD3BD] bg-[#FFFCF2] p-5">
    <div>
      <h2 className="text-lg font-bold">교수자 전용 메모</h2>
      <p className="mt-1 text-xs text-muted-foreground">공용 화면·유인물·HTML에 포함되지 않습니다. 기존 검토 기준과 배정 미션의 해설을 참고합니다.</p>
    </div>
    {features.map((feature) => <div key={feature.code} className="rounded-lg border bg-white p-4">
      <h3 className="font-semibold">{feature.learner_label}</h3>
      <p className="mt-2 text-sm leading-6">{direction === "zh_ko" ? feature.counter_rule_note_zh_ko ?? feature.counter_rule_note : feature.counter_rule_note}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
        {(direction === "zh_ko" ? feature.excluded_confounds_zh_ko ?? feature.excluded_confounds : feature.excluded_confounds).map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    </div>)}
    <p className="text-sm leading-6">주차의 목표와 핵심 설명을 확인한 뒤 편성된 미션으로 연결합니다. 수행 후에는 학생이 선택·수정한 이유를 기존 기록과 함께 확인합니다.</p>
    <h3 className="font-bold">미션별 핵심 해설</h3>
    {missions.map(({ scenarioId, label, guide }) => <details key={scenarioId} className="rounded-lg border bg-white p-4">
      <summary className="cursor-pointer font-semibold">{label} · {guide.speechActKo}</summary>
      <p className="mt-3 text-sm leading-6">{guide.situationKo}</p>
      {guide.misconceptionKo && <p className="mt-2 text-sm"><strong>예상 오개념:</strong> {guide.misconceptionKo}</p>}
      {guide.coreReasonKo && <p className="mt-2 text-sm"><strong>지도 핵심:</strong> {guide.coreReasonKo}</p>}
      {guide.mpjItems.map((item) => <details key={item.id} className="mt-3 rounded border p-3 text-sm">
        <summary className="cursor-pointer font-semibold">MPJ {item.id} · {item.titleKo}</summary>
        <p className="mt-2">{item.designIntentKo}</p>
        <ul className="mt-2 space-y-3">{item.candidates.map((candidate, index) => <li key={index}>
          <p>{candidate.text}</p>
          <p className="text-[#53656F]">{candidate.judgmentKo && `${candidate.judgmentKo} · `}{candidate.noteKo}</p>
        </li>)}</ul>
      </details>)}
      <details className="mt-3 rounded border p-3 text-sm">
        <summary className="cursor-pointer font-semibold">DCT · 참고 산출과 해설</summary>
        <p className="mt-2">{guide.dct.sourceText}</p>
        <ul className="mt-3 space-y-3">{guide.dct.alternatives.map((alternative, index) => <li key={index}>
          <p>{alternative.text}</p><p className="text-[#53656F]">{alternative.noteKo}</p>
        </li>)}</ul>
      </details>
    </details>)}
    {!missions.length && <p className="text-sm text-muted-foreground">확인할 미션 해설이 없습니다. 미션 편성·공개 상태를 확인해 주세요.</p>}
  </section>;
}
