import type { InstructorMissionGuide as InstructorMissionGuideModel } from "@/lib/pragma/instructorGuide";

const sectionClass = "break-inside-avoid rounded-xl border border-[#DDD8CB] bg-white p-5 print:rounded-none print:border-[#BEB7A7] print:p-4";

function GuideSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={sectionClass}>
      <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#233542]">
        <span className="flex size-6 items-center justify-center rounded-full bg-[#FAD338] text-[11px] text-[#15202B]">
          {number}
        </span>
        {title}
      </h3>
      <div className="mt-3 text-[13px] leading-6 text-[#34444D]">{children}</div>
    </section>
  );
}

export function InstructorMissionGuide({ guide }: { guide: InstructorMissionGuideModel }) {
  return (
    <article className="mx-auto max-w-[920px] rounded-2xl bg-[#F7F4EC] p-5 print:max-w-none print:rounded-none print:bg-white print:p-0">
      <header className="break-inside-avoid rounded-xl bg-[#15202B] px-6 py-5 text-white print:rounded-none print:px-4 print:py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FAD338]">PRAGMA 교수자 수업자료</p>
        <h2 className="mt-1 text-xl font-bold">{guide.speechActKo} · MPJ5+DCT1 운영안</h2>
        <p className="mt-2 text-[13px] leading-5 text-[#DCE4E8]">학습목표: {guide.speechActKo} 통합 수행 · 문항 판정 초점: {guide.itemFocusKo}</p>
      </header>

      <div className="mt-4 grid gap-4">
        <GuideSection number={1} title="상황과 핵심 화행 확인">
          <p className="font-medium text-[#202B33]">{guide.situationKo}</p>
          <p className="mt-1 text-[#657178]">관계: {guide.relationKo}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {guide.pdrKo.map((label) => (
              <span key={label} className="rounded-full border border-[#D8D0BC] bg-[#FAF8F2] px-2.5 py-1 text-[11px] font-medium">
                {label}
              </span>
            ))}
          </div>
        </GuideSection>

        <GuideSection number={2} title="대표 오개념과 첫 판단">
          {guide.misconceptionKo ? (
            <p><span className="font-semibold">대표 오개념:</span> {guide.misconceptionKo}</p>
          ) : (
            <p className="text-[#657178]">이 미션에는 구조화된 대표 오개념이 없습니다. MPJ 오답 해설 중 수업에서 다룰 한 가지를 선택하세요.</p>
          )}
          {guide.coreReasonKo && <p className="mt-2"><span className="font-semibold">판단의 핵심:</span> {guide.coreReasonKo}</p>}
          <p className="mt-3 rounded-lg bg-[#F4F1E8] px-3 py-2 text-[12px]">
            정답을 먼저 발표하기보다 학습자에게 첫 판단의 상황 단서와 표현 근거를 각각 말하게 합니다.
          </p>
        </GuideSection>

        <GuideSection number={3} title="P·D·R 최소대조">
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
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border bg-[#FAFBFB] p-3"><span className="font-semibold">상황 A</span><p className="mt-1">{guide.contrast.firstSituationKo}</p></div>
            <div className="rounded-lg border bg-[#FAFBFB] p-3"><span className="font-semibold">상황 B</span><p className="mt-1">{guide.contrast.secondSituationKo}</p></div>
          </div>
        </GuideSection>

        <GuideSection number={4} title="중국어 화용 현미경">
          <p><span className="font-semibold">분석 표현:</span> <span lang="zh" className="text-[15px] text-[#202B33]">{guide.microscope.expression}</span></p>
          <p className="mt-2"><span className="font-semibold">원문의 의도:</span> {guide.microscope.source}</p>
          <p className="mt-2"><span className="font-semibold">기능과 관계적 효과:</span> {guide.microscope.functionAndEffectKo}</p>
          <p className="mt-2"><span className="font-semibold">조정 예시:</span> <span lang="zh">{guide.microscope.adjustmentExample}</span></p>
          {guide.microscope.boundaryPromptKo && (
            <p className="mt-3 rounded-lg border border-[#E8D9AF] bg-[#FFF9E8] px-3 py-2 text-[12px] text-[#6E5B20]">
              <span className="font-semibold">{guide.microscope.boundaryPromptLabelKo ?? "화행 경계 확인"}:</span> {guide.microscope.boundaryPromptKo}
            </p>
          )}
        </GuideSection>

        <GuideSection number={5} title="MPJ·DCT 수행자료 토론">
          <div className="space-y-4">
            {guide.mpjItems.map((item) => (
              <div key={item.id} className="break-inside-avoid border-b border-[#E7E2D7] pb-4 last:border-0 last:pb-0">
                <p className="font-semibold">MPJ{item.id} · {item.titleKo}</p>
                <p className="mt-1 text-[12px] text-[#657178]">설계 의도: {item.designIntentKo}</p>
                <ul className="mt-2 space-y-1.5">
                  {item.candidates.map((candidate, index) => (
                    <li key={`${item.id}-${index}`} className="rounded-md bg-[#FAF8F2] px-3 py-2">
                      <span lang="zh" className="font-medium text-[#202B33]">{candidate.text}</span>
                      {candidate.judgmentKo && <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#53656F]">{candidate.judgmentKo}</span>}
                      <p className="mt-0.5 text-[11.5px] text-[#657178]">{candidate.noteKo}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-5 break-inside-avoid rounded-lg border border-[#D8D0BC] p-3">
            <p className="font-semibold">DCT 허용안 비교</p>
            <p className="mt-1 text-[12px] text-[#657178]">산출 원문: {guide.dct.sourceText}</p>
            <ol className="mt-2 space-y-2">
              {guide.dct.alternatives.map((alternative, index) => (
                <li key={index}><span className="font-semibold">{index + 1}.</span> <span lang="zh">{alternative.text}</span><p className="ml-4 text-[11.5px] text-[#657178]">{alternative.noteKo}</p></li>
              ))}
            </ol>
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
          <p className="mt-3 text-[11px] text-[#707A80] print:hidden">
            실제 학습자 사례는 현재 자동 선별하지 않습니다. 학습자 수행 기록에서 익명화할 MPJ·DCT 사례 1–2건을 교수자가 선택해 사용합니다.
          </p>
        </GuideSection>

        <GuideSection number={6} title="다른 맥락으로 재맥락화">
          <p className="font-medium">{guide.recontextualization.situationKo}</p>
          <p className="mt-1 text-[#657178]">관계: {guide.recontextualization.relationKo}</p>
          <p className="mt-3 rounded-lg bg-[#F4F1E8] px-3 py-2">{guide.recontextualization.promptKo}</p>
          <p className="mt-3 text-[12px] text-[#657178]">2–4주 뒤 5분 회수: 화행 「{guide.speechActKo}」를 다른 관계·부담·매체에 놓고 표현을 하나만 조정하게 합니다.</p>
        </GuideSection>
      </div>
    </article>
  );
}

export default InstructorMissionGuide;
