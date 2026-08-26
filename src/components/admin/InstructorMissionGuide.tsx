import type { InstructorMissionGuide as InstructorMissionGuideModel } from "@/lib/pragma/instructorGuide";
import {
  instructorGuideTimingPlan,
  instructorGuideTimingTotal,
  type InstructorGuideTimingPlan,
} from "@/lib/pragma/instructorGuideTiming";

export const INSTRUCTOR_GUIDE_STEP_COUNT = 6;

export type InstructorGuideAudience = "instructor" | "student";
export type InstructorGuideDisplayMode = "document" | "projector";

const documentSectionClass = "break-inside-avoid rounded-xl border border-[#DDD8CB] bg-white p-5 print:rounded-none print:border-[#BEB7A7] print:p-4";
const projectorSectionClass = "mx-auto min-h-[calc(100vh-10rem)] w-full max-w-[1280px] rounded-2xl border border-[#DDD8CB] bg-[#FFFDF7] p-7 shadow-sm sm:p-10 lg:p-12";

function GuideSection({
  number,
  title,
  displayMode,
  active,
  children,
}: {
  number: number;
  title: string;
  displayMode: InstructorGuideDisplayMode;
  active: boolean;
  children: React.ReactNode;
}) {
  if (displayMode === "projector" && !active) return null;
  return (
    <section className={displayMode === "projector" ? projectorSectionClass : documentSectionClass} data-guide-step={number}>
      <h3 className={`flex items-center gap-3 font-bold text-[#233542] ${displayMode === "projector" ? "text-2xl sm:text-3xl" : "text-[15px]"}`}>
        <span className={`flex shrink-0 items-center justify-center rounded-full bg-[#FAD338] text-[#15202B] ${displayMode === "projector" ? "size-11 text-lg" : "size-6 text-[11px]"}`}>
          {number}
        </span>
        {title}
      </h3>
      <div className={`mt-4 text-[#34444D] ${displayMode === "projector" ? "text-lg leading-8 sm:text-xl sm:leading-9" : "text-[13px] leading-6"}`}>
        {children}
      </div>
    </section>
  );
}

function WritingSpace({ prompt, lines = 3 }: { prompt: string; lines?: number }) {
  return (
    <div className="mt-3 rounded-lg border border-dashed border-[#BEB7A7] bg-[#FFFEFA] px-3 py-3">
      <p className="text-[12px] font-semibold text-[#53656F]">{prompt}</p>
      <div className="mt-2 space-y-3" aria-hidden>
        {Array.from({ length: lines }, (_, index) => <div key={index} className="h-4 border-b border-[#D8D0BC]" />)}
      </div>
    </div>
  );
}

function WithheldAnswer() {
  return (
    <div className="rounded-xl border border-dashed border-[#D7C572] bg-[#FFF9DE] px-5 py-5 text-center text-[#66551E]" data-answer-state="withheld">
      <p className="font-semibold">먼저 학습자의 판단과 근거를 확인하세요.</p>
      <p className="mt-1 text-sm">교수자 해설은 상단의 「해설 공개」를 누르면 나타납니다.</p>
    </div>
  );
}

export function InstructorMissionGuide({
  guide,
  audience = "instructor",
  displayMode = "document",
  activeStep = 1,
  answersRevealed = true,
  timingPlan = instructorGuideTimingPlan(30),
}: {
  guide: InstructorMissionGuideModel;
  audience?: InstructorGuideAudience;
  displayMode?: InstructorGuideDisplayMode;
  activeStep?: number;
  answersRevealed?: boolean;
  timingPlan?: InstructorGuideTimingPlan;
}) {
  const showAnswers = audience === "instructor" && (displayMode === "document" || answersRevealed);
  const sectionProps = (number: number) => ({ displayMode, active: activeStep === number });

  return (
    <article
      className={displayMode === "projector"
        ? "h-full bg-[#F7F4EC]"
        : "mx-auto max-w-[920px] rounded-2xl bg-[#F7F4EC] p-5 print:max-w-none print:rounded-none print:bg-white print:p-0"}
      data-audience={audience}
      data-display-mode={displayMode}
    >
      {displayMode === "document" && (
        <>
          <header className="break-inside-avoid rounded-xl bg-[#15202B] px-6 py-5 text-white print:rounded-none print:px-4 print:py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FAD338]">
              {audience === "instructor" ? "PRAGMA 교수자 수업자료" : "PRAGMA 학생 활동지"}
            </p>
            <h2 className="mt-1 text-xl font-bold">{guide.speechActKo} · MPJ5+DCT1 {audience === "instructor" ? "운영안" : "활동지"}</h2>
            <p className="mt-2 text-[13px] leading-5 text-[#DCE4E8]">학습목표: {guide.speechActKo} 통합 수행 · 문항 판정 초점: {guide.itemFocusKo}</p>
          </header>
          {audience === "instructor" && (
            <section className="mt-4 break-inside-avoid rounded-xl border border-[#DDD8CB] bg-white p-5 print:rounded-none print:border-[#BEB7A7] print:p-4" aria-label="수업 시간 운영표">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7A6418]">수업 시간 프리셋</p>
                  <h3 className="mt-1 text-[15px] font-bold text-[#233542]">{timingPlan.preset}분 · {timingPlan.labelKo}</h3>
                  <p className="mt-1 text-[12px] text-[#657178]">{timingPlan.descriptionKo}</p>
                </div>
                <span className="rounded-full bg-[#FAD338] px-3 py-1 text-[12px] font-bold text-[#15202B]">총 {instructorGuideTimingTotal(timingPlan)}분</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-left text-[12px] leading-5">
                  <thead><tr className="border-b border-[#D8D0BC] text-[#53656F]"><th className="pb-2 pr-3">활동</th><th className="w-16 pb-2 pr-3">시간</th><th className="pb-2 pr-3">진행 방법</th><th className="pb-2">학습 산출물</th></tr></thead>
                  <tbody>
                    {timingPlan.activities.map((activity) => (
                      <tr key={activity.id} className="border-b border-[#EEEAE0] last:border-0">
                        <td className="py-2 pr-3 font-semibold text-[#233542]">{activity.labelKo}</td>
                        <td className="py-2 pr-3">{activity.minutes}분</td>
                        <td className="py-2 pr-3 text-[#53656F]">{activity.howKo}</td>
                        <td className="py-2 text-[#53656F]">{activity.outputKo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <div className={displayMode === "projector" ? "h-full" : "mt-4 grid gap-4"}>
        <GuideSection number={1} title="상황과 핵심 화행 확인" {...sectionProps(1)}>
          <p className="font-medium text-[#202B33]">{guide.situationKo}</p>
          <p className="mt-1 text-[#657178]">관계: {guide.relationKo}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {guide.pdrKo.map((label) => (
              <span key={label} className="rounded-full border border-[#D8D0BC] bg-[#FAF8F2] px-2.5 py-1 text-[11px] font-medium">
                {label}
              </span>
            ))}
          </div>
          {guide.burdenMeaningKo && (
            <p className="mt-3 rounded-lg bg-[#F4F1E8] px-3 py-2 text-[12px]">
              <span className="font-semibold">이 화행의 R:</span> {guide.burdenMeaningKo}
            </p>
          )}
          {audience === "student" && <WritingSpace prompt="이 상황에서 가장 중요한 관계·부담 단서를 적어보세요." lines={2} />}
        </GuideSection>

        <GuideSection number={2} title="대표 오개념과 첫 판단" {...sectionProps(2)}>
          {showAnswers ? (
            <div data-answer-state="revealed">
              {guide.misconceptionKo ? (
                <p><span className="font-semibold">대표 오개념:</span> {guide.misconceptionKo}</p>
              ) : (
                <p className="text-[#657178]">이 미션에는 구조화된 대표 오개념이 없습니다. MPJ 오답 해설 중 수업에서 다룰 한 가지를 선택하세요.</p>
              )}
              {guide.coreReasonKo && <p className="mt-2"><span className="font-semibold">판단의 핵심:</span> {guide.coreReasonKo}</p>}
              <p className="mt-3 rounded-lg bg-[#F4F1E8] px-3 py-2 text-[12px]">
                정답을 먼저 발표하기보다 학습자에게 첫 판단의 상황 단서와 표현 근거를 각각 말하게 합니다.
              </p>
            </div>
          ) : audience === "student" ? (
            <WritingSpace prompt="나의 첫 판단과 그 판단을 뒷받침하는 상황 단서를 적어보세요." lines={4} />
          ) : (
            <WithheldAnswer />
          )}
        </GuideSection>

        <GuideSection number={3} title="P·D·R 최소대조" {...sectionProps(3)}>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border bg-[#FAFBFB] p-3"><span className="font-semibold">상황 A</span><p className="mt-1">{guide.contrast.firstSituationKo}</p></div>
            <div className="rounded-lg border bg-[#FAFBFB] p-3"><span className="font-semibold">상황 B</span><p className="mt-1">{guide.contrast.secondSituationKo}</p></div>
          </div>
          {showAnswers ? (
            <div className="mt-3" data-answer-state="revealed">
              {guide.contrast.verified ? (
                <>
                  <p><span className="font-semibold">유지:</span> 화행·핵심 명제·{guide.contrast.preservedKo.join(" · ")}</p>
                  <p className="mt-1"><span className="font-semibold">핵심 변화:</span> {guide.contrast.changedKo}</p>
                </>
              ) : (
                <p className="rounded-lg border border-[#E8D9AF] bg-[#FFF9E8] px-3 py-2 text-[#6E5B20]">
                  MPJ1과 MPJ2에서 P·D·R 한 축만 바뀌었다고 자동 확인할 수 없습니다. 특정 축의 효과라고 단정하지 말고 두 상황의 복합 차이로 다루세요.
                </p>
              )}
            </div>
          ) : audience === "student" ? (
            <WritingSpace prompt="두 상황에서 유지된 조건과 달라진 조건을 비교해보세요." lines={3} />
          ) : (
            <div className="mt-3"><WithheldAnswer /></div>
          )}
        </GuideSection>

        <GuideSection number={4} title="중국어 화용 현미경" {...sectionProps(4)}>
          <p><span className="font-semibold">분석 표현:</span> <span lang="zh" className="text-[15px] text-[#202B33]">{guide.microscope.expression}</span></p>
          <p className="mt-2"><span className="font-semibold">원문의 의도:</span> {guide.microscope.source}</p>
          {showAnswers ? (
            <div data-answer-state="revealed">
              <p className="mt-2"><span className="font-semibold">기능과 관계적 효과:</span> {guide.microscope.functionAndEffectKo}</p>
              <p className="mt-2"><span className="font-semibold">조정 예시:</span> <span lang="zh">{guide.microscope.adjustmentExample}</span></p>
              {guide.microscope.boundaryPromptKo && (
                <p className="mt-3 rounded-lg border border-[#E8D9AF] bg-[#FFF9E8] px-3 py-2 text-[12px] text-[#6E5B20]">
                  <span className="font-semibold">{guide.microscope.boundaryPromptLabelKo ?? "화행 경계 확인"}:</span> {guide.microscope.boundaryPromptKo}
                </p>
              )}
            </div>
          ) : audience === "student" ? (
            <WritingSpace prompt="이 표현의 기능과 상대에게 줄 관계적 인상을 분석해보세요." lines={4} />
          ) : (
            <div className="mt-3"><WithheldAnswer /></div>
          )}
        </GuideSection>

        <GuideSection number={5} title="MPJ·DCT 수행자료 토론" {...sectionProps(5)}>
          <div className="space-y-4">
            {guide.mpjItems.map((item) => (
              <div key={item.id} className="break-inside-avoid border-b border-[#E7E2D7] pb-4 last:border-0 last:pb-0">
                <p className="font-semibold">MPJ{item.id} · {item.titleKo}</p>
                {showAnswers && <p className="mt-1 text-[12px] text-[#657178]">설계 의도: {item.designIntentKo}</p>}
                <ul className="mt-2 space-y-1.5">
                  {item.candidates.map((candidate, index) => (
                    <li key={`${item.id}-${index}`} className="rounded-md bg-[#FAF8F2] px-3 py-2">
                      <span lang="zh" className="font-medium text-[#202B33]">{candidate.text}</span>
                      {showAnswers && candidate.judgmentKo && <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#53656F]">{candidate.judgmentKo}</span>}
                      {showAnswers && <p className="mt-0.5 text-[11.5px] text-[#657178]">{candidate.noteKo}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-5 break-inside-avoid rounded-lg border border-[#D8D0BC] p-3">
            <p className="font-semibold">DCT 직접 산출</p>
            <p className="mt-1 text-[12px] text-[#657178]">산출 원문: {guide.dct.sourceText}</p>
            {showAnswers ? (
              <div data-answer-state="revealed">
                <p className="mt-3 font-semibold">수정 후 참고안 비교</p>
                <ol className="mt-2 space-y-2">
                  {guide.dct.alternatives.map((alternative, index) => (
                    <li key={index}><span className="font-semibold">{index + 1}.</span> <span lang="zh">{alternative.text}</span><p className="ml-4 text-[11.5px] text-[#657178]">{alternative.noteKo}</p></li>
                  ))}
                </ol>
              </div>
            ) : audience === "student" ? (
              <WritingSpace prompt="최초안을 작성하고, 최소 피드백을 받은 뒤 수정안을 다시 적어보세요." lines={6} />
            ) : (
              <div className="mt-3"><WithheldAnswer /></div>
            )}
          </div>
          <div className="mt-4 rounded-lg bg-[#F4F1E8] px-3 py-3 text-[12px]">
            <p className="font-semibold">토론 질문</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>MPJ에서는 판단했지만 DCT에서 같은 원리를 적용하지 못했다면 어떤 상황 단서가 산출에서 사라졌는가?</li>
              <li>{guide.dct.alternatives.length > 1
                ? "복수 허용안은 각각 상대와의 관계를 어떤 인상으로 만드는가?"
                : "제시된 허용안과 다른 전략으로도 가능한 응답을 만든다면 관계적 인상이 어떻게 달라지는가?"}</li>
              <li>경계형 후보가 다른 현실적 맥락에서는 가능해지는지, 가능하다면 무엇이 달라져야 하는가?</li>
            </ul>
          </div>
          {audience === "instructor" && (
            <p className="mt-3 text-[11px] text-[#707A80] print:hidden">
              실제 학습자 사례는 현재 자동 선별하지 않습니다. 수업에서 수집된 수행 기록 중 익명화할 MPJ·DCT 사례 1–2건을 교수자가 선택해 사용합니다.
            </p>
          )}
        </GuideSection>

        <GuideSection number={6} title="다른 맥락으로 재맥락화" {...sectionProps(6)}>
          <p className="font-medium">{guide.recontextualization.situationKo}</p>
          <p className="mt-1 text-[#657178]">관계: {guide.recontextualization.relationKo}</p>
          <p className="mt-3 rounded-lg bg-[#F4F1E8] px-3 py-2">{guide.recontextualization.promptKo}</p>
          {audience === "instructor" ? (
            <p className="mt-3 text-[12px] text-[#657178]">2–4주 뒤 5분 회수: 화행 「{guide.speechActKo}」를 다른 관계·부담·매체에 놓고 표현을 하나만 조정하게 합니다.</p>
          ) : (
            <WritingSpace prompt="새로운 맥락에 맞게 표현을 하나 조정하고 그 이유를 적어보세요." lines={4} />
          )}
        </GuideSection>
      </div>
    </article>
  );
}

export default InstructorMissionGuide;
