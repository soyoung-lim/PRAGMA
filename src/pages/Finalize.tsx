import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";
import { useStageTimer } from "@/lib/learningSessions";
import { isDemoMode } from "@/lib/demo";
import { TRANSLATION_LABELS, TRANSLATION_CARD_BG } from "@/lib/translationLabels";
import { PageTitle } from "@/components/PageTitle";

type ActId = "request" | "refusal";
type Choice = "A" | "B" | "C";

const ACT_STORAGE_KEY = "step1-speech-act";
const STEP2_BEST_KEY = "step2-best";
const FINALIZE_STORAGE_KEY = "step4-final-translation";

const SOURCE_TEXT: Record<ActId, string> = {
  request: "이번 자료 전달 일정을 10일 정도 연장해 주실 수 있을지 검토 부탁드립니다.",
  refusal: "검토해 봤는데 이번에는 프로모션 비용 인하가 어려울 것 같습니다.",
};

const TRANSLATIONS: Record<ActId, Record<Choice, string>> = {
  request: {
    A: "请将本次资料提交时间延后十天。",
    B: "不知贵方是否方便将本次资料提交时间延后十天,烦请考虑。",
    C: "由于我方仍需等待艺人方面的最终确认,恳请贵方酌情考虑将本次资料提交时间延后十天。由此可能给贵方上线安排带来的不便,我们深表歉意。",
  },
  refusal: {
    A: "我们研究过了,这次不能降低推广费用。",
    B: "我们内部讨论过了,这次推广费用方面确实很难再调整,还请您理解。",
    C: "感谢贵方一直以来的支持。关于此次推广费用调整,我们已认真进行内部讨论,但由于项目预算和执行安排已经基本确定,实在难以再下调。还请您理解,我们也会继续积极配合后续活动推进。",
  },
};

interface FeedbackBlock {
  receiver: { impression: string; reconsider: string };
  expert: { strength: string; revision: string };
}

const FEEDBACK: Record<ActId, Record<Choice, FeedbackBlock>> = {
  request: {
    A: {
      receiver: {
        impression: "요청 내용은 분명하지만, 첫 협업 상대로부터 받기에는 조금 직접적으로 느껴질 수 있습니다.",
        reconsider: "이유나 양해 표현이 없어, 상대 일정에 미치는 영향을 충분히 고려했다는 느낌이 약할 수 있습니다.",
      },
      expert: {
        strength: "10일 연장을 요청한다는 핵심 의미는 정확히 전달되었습니다.",
        revision: "명령처럼 보이는 구조를 줄이고, 사유와 상대가 결정할 여지를 남기는 표현을 보완해 보세요.",
      },
    },
    B: {
      receiver: {
        impression: "정중하고 실무적으로 무리 없이 받아들일 수 있는 요청입니다.",
        reconsider: "다만 왜 일정 조정이 필요한지에 대한 설명이 없어, 첫 협업에서는 다소 정보가 부족하게 느껴질 수 있습니다.",
      },
      expert: {
        strength: "원문의 완곡한 요청 느낌이 자연스럽게 살아 있습니다.",
        revision: "현재의 정중함을 유지하면서, 사유나 상대 일정에 대한 고려를 한 문장 정도 더 드러내면 좋습니다.",
      },
    },
    C: {
      receiver: {
        impression: "사유와 상대 일정에 대한 배려가 함께 보여, 첫 협업에서도 비교적 안정적으로 받아들일 수 있습니다.",
        reconsider: "다만 사과 표현이 다소 무겁게 느껴질 수 있어, 요청 단계에 맞는 강도인지 생각해 볼 필요가 있습니다.",
      },
      expert: {
        strength: "사유 제시, 상대 배려, 검토 요청의 완곡함이 잘 드러납니다.",
        revision: "원문보다 사과의 강도가 높아졌으므로, 이 정도로 정중하게 강화할 필요가 있는지 스스로 판단해 보세요.",
      },
    },
  },
  refusal: {
    A: {
      receiver: {
        impression: "거절 의도는 분명하지만, 여러 번 연락해 온 실무 관계에서 받기에는 다소 짧고 단정적으로 느껴질 수 있습니다.",
        reconsider: "양해 표현이나 검토 과정에 대한 언급이 없어, 이번 제안을 충분히 검토했다는 느낌이 약하게 전달될 수 있습니다.",
      },
      expert: {
        strength: "비용 인하가 어렵다는 핵심 메시지는 정확히 전달되었습니다.",
        revision: "원문의 '검토해 봤는데', '어려울 것 같습니다'에 담긴 완곡함이 약해졌습니다. 거절의 명확성은 유지하면서 양해 표현을 한 줄 정도 보완해 보세요.",
      },
    },
    B: {
      receiver: {
        impression: "격식과 양해 표현이 잘 갖춰져, 공식 답변으로 무리 없이 받을 만한 톤입니다.",
        reconsider: "다만 앞으로의 협업에 대한 언급이 없어, 관계가 이어진다는 느낌은 다소 약하게 남을 수 있습니다.",
      },
      expert: {
        strength: "거절 사유와 양해 요청이 격식 있게 잘 전달되었습니다.",
        revision: "여러 번 연락해 온 관계라는 점을 고려하면, 후속 협업에 대한 의지를 한 문장 정도 더 드러내면 좋습니다.",
      },
    },
    C: {
      receiver: {
        impression: "감사 표현과 후속 협업 의지가 함께 담겨, 거절이지만 협업 관계를 계속 이어가려는 의지가 분명히 전해집니다.",
        reconsider: "다만 후속 협업 의지가 비교적 강하게 표현되어, 다음 협의에서 그 기대만큼 조정이 어려울 경우 오히려 부담이 될 수 있습니다.",
      },
      expert: {
        strength: "감사 표현, 거절 사유, 양해, 후속 협업 의지가 자연스럽게 흐르고 있습니다.",
        revision: "후속 협업에 대한 표현이 실제로 약속할 수 있는 범위와 맞는지 스스로 점검해 보세요.",
      },
    },
  },
};

interface Step4Data {
  finalTranslation?: string;
  justification?: string;
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
    {children}
  </div>
);

const Finalize = () => {
  const navigate = useNavigate();
  const demo = isDemoMode();
  const [act, setAct] = useState<ActId | null>(null);
  const [best, setBest] = useState<Choice | null>(null);
  const [finalTranslation, setFinalTranslation] = useState("");
  const [justification, setJustification] = useState("");
  const [refOpen, setRefOpen] = useState(true);

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/finalize" }, "/finalize");
    try {
      const a = localStorage.getItem(ACT_STORAGE_KEY);
      if (a === "request" || a === "refusal") setAct(a);
      const b = localStorage.getItem(STEP2_BEST_KEY);
      if (b === "A" || b === "B" || b === "C") setBest(b);
      const raw = localStorage.getItem(FINALIZE_STORAGE_KEY);
      if (raw) {
        const d: Step4Data = JSON.parse(raw);
        if (d.finalTranslation) setFinalTranslation(d.finalTranslation);
        if (d.justification) setJustification(d.justification);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        FINALIZE_STORAGE_KEY,
        JSON.stringify({ finalTranslation, justification }),
      );
    } catch {
      /* ignore */
    }
  }, [finalTranslation, justification]);

  useStageTimer(4);

  const justOk = justification.trim().length >= 50;
  const transOk = finalTranslation.trim().length >= 1;
  const canProceed = demo || (justOk && transOk);

  const fb = act && best ? FEEDBACK[act][best] : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={4} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <PageTitle
          title="최종 번역안 확정"
          description="AI 번역안 비교와 피드백을 거쳐, 본인이 최종 확정한 중국어 번역안을 작성해 주세요. AI 번역안을 참고할 수는 있지만, 최종안은 본인의 판단과 표현으로 다듬어 확정해 주세요."
        />

        {/* Reference panel (collapsed by default) */}
        <section className="mt-6 rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF]">
          <button
            type="button"
            onClick={() => setRefOpen((v) => !v)}
            aria-expanded={refOpen}
            className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted/60"
          >
            <span>이전 단계 자료</span>
            <span aria-hidden className="text-xs text-muted-foreground">
              {refOpen ? "▲" : "▼"}
            </span>
          </button>
          {refOpen && (
            <div className="space-y-6 border-t border-foreground/10 px-5 py-5 text-foreground/80">
              <div>
                <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
                  Step 1 — 한국어 원문 (출발어)
                </div>
                <p className="rounded-md border-[0.5px] border-[#D3D1C7] border-l-[3px] border-l-[#15202B] bg-[#FFFFFF] p-4 text-[17px] font-semibold leading-relaxed text-[#15202B]">
                  {act ? SOURCE_TEXT[act] : "[Step 1에서 화행을 먼저 선택해주세요]"}
                </p>
              </div>

              <div>
                <SectionLabel>Step 2 — 번역안 A · B · C</SectionLabel>
                {act ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {(["A", "B", "C"] as Choice[]).map((c) => (
                      <div
                        key={c}
                        className="rounded-md border-[0.5px] border-[#D3D1C7] p-3"
                        style={{ backgroundColor: TRANSLATION_CARD_BG[c] }}
                      >
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold text-foreground/70">번역안 {c}</span>
                          <span className="text-[12px] font-normal text-[#5C6A7A]">· {TRANSLATION_LABELS[act][c]}</span>
                        </div>
                        <p className="mt-1.5 text-[14px] font-medium leading-relaxed text-[#15202B]">
                          {TRANSLATIONS[act][c]}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">[Step 1에서 화행을 먼저 선택해주세요]</p>
                )}
              </div>

              <div>
                <SectionLabel>Step 3 — 두 관점 피드백</SectionLabel>
                {fb ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-md border-[0.5px] border-[#E8D5C4] bg-[#F8EDE3] p-3">
                      <div className="text-[15px] font-bold text-[#4A2F1A]">
                        이메일 수신자 페르소나
                      </div>
                      <div className="mt-1 text-[12px] font-normal text-[#A88766]">
                        중국어권 비즈니스 커뮤니케이션 담당자 관점
                      </div>
                      <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-[#15202B]">
                        <p><span className="font-semibold text-[#A88766]">수용 양상</span> — {fb.receiver.impression}</p>
                        <p><span className="font-semibold text-[#A88766]">재고 지점</span> — {fb.receiver.reconsider}</p>
                      </div>
                    </div>
                    <div className="rounded-md border-[0.5px] border-[#CDD6CF] bg-[#E8EFE9] p-3">
                      <div className="text-[15px] font-bold text-[#1A2820]">
                        통번역 교수자 페르소나
                      </div>
                      <div className="mt-1 text-[12px] font-normal text-[#3F5852]">
                        한·중 통번역 분석의 학술적 관점
                      </div>
                      <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-[#15202B]">
                        <p><span className="font-semibold text-[#3F5852]">전달 강점</span> — {fb.expert.strength}</p>
                        <p><span className="font-semibold text-[#3F5852]">개선 방향</span> — {fb.expert.revision}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    [Step 2에서 가장 적절한 번역안을 먼저 선택해주세요]
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Always-visible source text pairing with author area — hero pair */}
        <section className="mt-8 rounded-xl border-[0.5px] border-[#D3D1C7] border-l-[4px] border-l-[#15202B] bg-[#FFFFFF] p-7">
          <div className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
            번역해야 할 한국어 원문 (출발어)
          </div>
          <p className="text-[19px] font-semibold leading-relaxed text-[#15202B]">
            {act ? SOURCE_TEXT[act] : "[Step 1에서 화행을 먼저 선택해주세요]"}
          </p>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-foreground/15" />
            <span>↓ 본인이 직접 작성하는 중국어 번역 (도착어)</span>
            <span className="h-px flex-1 bg-foreground/15" />
          </div>

          <label htmlFor="final-translation" className="text-[13px] font-bold uppercase tracking-wide text-[#15202B]">
            본인이 결정한 최종 중국어 번역을 직접 작성하세요
          </label>
          <textarea
            id="final-translation"
            value={finalTranslation}
            onChange={(e) => !demo && setFinalTranslation(e.target.value)}
            readOnly={demo}
            placeholder="여기에 본인이 최종 확정한 중국어 번역안을 입력하세요. 번역안 A/B/C 중 하나를 그대로 붙여 넣지 말고, 본인의 판단으로 다듬어 확정해 주세요."
            rows={6}
            maxLength={2000}
            className="mt-3 w-full resize-y rounded-md border border-foreground/20 bg-background p-4 text-[17px] font-medium leading-relaxed text-[#15202B] focus:border-[#15202B] focus:outline-none focus:ring-2 focus:ring-[#15202B]/40"
          />
          <div className="mt-2 flex justify-end">
            <span className="text-xs text-muted-foreground">{finalTranslation.length}자</span>
          </div>
        </section>

        {/* Justification */}
        <section className="mt-6 rounded-lg border-[0.5px] border-[#D3D1C7] bg-[#FFFFFF] p-6">
          <label htmlFor="final-justification" className="text-sm font-semibold">
            이 번역안을 최종으로 결정한 이유를 자유롭게 적어주세요 (최소 50자)
          </label>
          <textarea
            id="final-justification"
            value={justification}
            onChange={(e) => !demo && setJustification(e.target.value)}
            readOnly={demo}
            placeholder="예) 처음에는 B가 적절하다고 봤지만, 전문가 관점 피드백을 보고 상대 입장이 더 잘 드러나는 표현이 필요하다고 느껴 격식을 유지하면서도 협력 의사를 한 문장 더 넣었습니다."
            rows={4}
            maxLength={2000}
            className="mt-3 w-full resize-y rounded-md border border-foreground/20 bg-background p-3 text-sm leading-relaxed focus:border-[#15202B] focus:outline-none focus:ring-2 focus:ring-[#15202B]/40"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {!justOk && justification.length > 0 ? "조금 더 적어주세요" : ""}
            </span>
            <span className="text-xs text-muted-foreground">{justification.length}자</span>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-12 border-t border-border pt-6">
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!canProceed}
              onClick={() => canProceed && navigate("/dashboard")}
              className={[
                "rounded-lg px-6 py-3 text-base font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                canProceed
                  ? "bg-[#FAD338] text-[#15202B] hover:bg-[#E8B91F]"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              ].join(" ")}
            >
              내 판단 리포트 보기 →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Finalize;
