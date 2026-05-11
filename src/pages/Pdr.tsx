import { useEffect, useState } from "react";
import { WorkflowHeader } from "@/components/WorkflowHeader";
import { ensureSession, logAction } from "@/lib/tracking";

type Choice = "A" | "B" | "C";
type ActId = "request" | "refusal";
const OPTIONS: Choice[] = ["A", "B", "C"];
const ACT_STORAGE_KEY = "step1-speech-act";

const SOURCE_TEXT: Record<ActId, string> = {
  request:
    "안녕하십니까. 이번 온라인 팬 이벤트 페이지 개발 건과 관련하여 부득이하게 일정 조정을 요청드리고자 합니다. 베타 테스트 과정에서 팬 인증 기능과 결제 연동 기능에 추가 수정이 필요한 문제가 확인되어, 당초 이번 주 금요일로 예정된 최종 파일 전달 일정을 10일 정도 연장해 주실 수 있을지 검토 부탁드립니다. 귀사의 공개 일정과 사전 홍보에 부담을 드릴 수 있다는 점을 잘 알고 있으며, 수정 범위와 임시 대응 방안을 함께 공유드리겠습니다.",
  refusal:
    "안녕하세요. 보내주신 다음 달 디지털 캠페인 단가 조정 요청은 내부적으로 검토했습니다. 요청하신 20% 인하는 현재 아티스트 IP 계약 기준과 제작 비용 구조상 이번 캠페인에는 적용하기 어렵습니다. 다만 콘텐츠 제공 범위, 노출 기간, 결제 일정 등 단가 외의 조건은 조정 가능한지 함께 검토하고 싶습니다. 이번 건은 양해 부탁드리며, 이후 캠페인에서도 현실적인 협력 방안을 계속 논의하겠습니다.",
};

const TRANSLATIONS: Record<ActId, Record<Choice, string>> = {
  request: {
    A: "您好。关于此次线上粉丝活动页面开发事宜,我们希望调整交付时间。测试过程中发现,粉丝认证功能和支付对接功能还需要进一步修改,因此原定本周五交付的最终文件,希望可以延后十天左右。此次调整可能会影响贵公司的公开安排和前期宣传,我们会分享修改范围和临时方案。",
    B: "您好。关于本次线上粉丝活动页面开发项目,我方需就交付安排向贵公司提出调整申请。由于Beta测试过程中发现粉丝认证功能和支付对接功能仍需进一步修改,烦请贵公司评估,能否将原定本周五的最终文件交付时间延后十天左右。我方了解此次调整可能影响贵公司的公开安排及前期宣传,后续将及时同步修改范围和临时应对方案。",
    C: "您好。关于本次线上粉丝活动页面开发项目,我方需就交付安排向贵公司提出调整请求。由于Beta测试过程中发现粉丝认证功能和支付对接功能仍需进一步修改,为确保最终交付质量,烦请贵公司评估是否可将原定本周五的最终文件交付时间延后十天左右。我方充分理解此次调整可能给贵公司的公开安排及前期宣传带来不便。为尽量减少影响,我方将尽快同步修改范围和临时应对方案,并希望就后续推进安排与贵公司进一步协商。",
  },
  refusal: {
    A: "您好。关于您提出的下个月数字营销活动单价调整请求,我们内部已经讨论过。由于目前艺人IP合约标准和制作成本结构的限制,本次活动暂时无法进行20%的降价。不过,单价以外的条件,例如内容范围、投放周期、付款时间等,可以一起看看是否有调整空间。此次情况请您理解,之后的活动我们也会继续讨论可行的合作方案。",
    B: "您好。关于贵方提出的下月数字营销活动单价调整需求,我方已进行内部评估。由于当前艺人IP合约标准及制作成本结构所限,贵方提出的20%下调暂无法适用于本次活动。不过,单价之外的条件,例如内容提供范围、投放周期、付款节点等,我方可与贵方共同评估是否存在调整空间。本次情况还请贵方理解,后续合作中我方也将继续与贵方沟通切实可行的协作方案。",
    C: "您好。感谢贵方提出下月数字营销活动单价调整方案。我方已认真进行内部评估,也理解贵方在预算和执行节奏上的考虑。由于当前艺人IP合约标准及制作成本结构所限,本次活动暂时无法按20%的比例下调,还请贵方理解。不过,我方愿与贵方一起进一步评估单价之外的调整空间,例如内容提供范围、投放周期、付款节点等,以尽可能找到双方都可执行的合作方式。后续也希望继续与贵方保持沟通,推进更可行的协作方案。",
  },
};

const Pdr = () => {
  const [act, setAct] = useState<ActId | null>(null);
  const [best, setBest] = useState<Choice | null>(null);
  const [worst, setWorst] = useState<Choice | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    ensureSession();
    logAction("page_visit", { page: "/pdr" }, "/pdr");
    try {
      const saved = localStorage.getItem(ACT_STORAGE_KEY);
      if (saved === "request" || saved === "refusal") setAct(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setBestSafe = (c: Choice) => {
    setBest(c);
    if (worst === c) setWorst(null);
    logAction("selection", { field: "best", value: c });
  };
  const setWorstSafe = (c: Choice) => {
    if (best === c) return;
    setWorst(c);
    logAction("selection", { field: "worst", value: c });
  };

  const reasonOk = reason.trim().length >= 30;
  const canProceed = !!best && !!worst && best !== worst && reasonOk;

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );

  const RadioRow = ({
    name,
    value,
    onChange,
    disabledValue,
  }: {
    name: string;
    value: Choice | null;
    onChange: (c: Choice) => void;
    disabledValue?: Choice | null;
  }) => (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((c) => {
        const disabled = disabledValue === c;
        const checked = value === c;
        return (
          <label
            key={c}
            className={[
              "flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors",
              disabled
                ? "cursor-not-allowed border-foreground/10 bg-muted/40 text-muted-foreground"
                : checked
                ? "border-[#E5C97A] bg-[#FAF1D7] font-semibold"
                : "border-foreground/20 bg-background hover:bg-muted/40",
            ].join(" ")}
          >
            <input
              type="radio"
              name={name}
              className="accent-[#E8C547]"
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(c)}
            />
            <span>번역안 {c}</span>
          </label>
        );
      })}
    </div>
  );

  const sourceText = act
    ? SOURCE_TEXT[act]
    : "[Step 1에서 한국어 원문을 먼저 선택해주세요]";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={2} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold sm:text-3xl">번역안 비교</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          세 가지 AI 번역안을 비교하고, 어느 쪽이 가장 적절하고 가장 부적절한지 골라보세요.
        </p>

        {/* Source text reference */}
        <div className="mt-6 rounded-lg border border-foreground/30 bg-[#FAF7EC] p-4">
          <SectionLabel>번역해야 할 한국어 원문</SectionLabel>
          <p className="text-sm leading-relaxed text-foreground">{sourceText}</p>
        </div>

        {/* 3 translation cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {OPTIONS.map((c) => (
            <div
              key={c}
              className="flex flex-col rounded-lg border border-foreground bg-background p-5"
            >
              <div className="text-base font-bold">번역안 {c}</div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {act
                  ? TRANSLATIONS[act][c]
                  : `[번역안 ${c} — Step 1을 먼저 선택해주세요]`}
              </p>
            </div>
          ))}
        </div>

        {/* Selection inputs */}
        <div className="mt-6 space-y-6 rounded-lg border border-foreground/30 bg-[#FAF7EC] p-6">
          <div>
            <div className="text-sm font-semibold">가장 적절하다고 생각하는 번역안은?</div>
            <div className="mt-3">
              <RadioRow name="best" value={best} onChange={setBestSafe} disabledValue={worst} />
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold">가장 부적절하다고 생각하는 번역안은?</div>
            <div className="mt-3">
              <RadioRow name="worst" value={worst} onChange={setWorstSafe} disabledValue={best} />
            </div>
          </div>
        </div>

        {/* Reason */}
        <div className="mt-6 rounded-lg border border-foreground/30 bg-background p-6">
          <label htmlFor="reason" className="text-sm font-semibold">
            왜 그렇게 판단했는지 자유롭게 적어주세요
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예) 번역안 C가 격식이 있으면서도 상대에게 부담을 덜 주는 표현이라고 생각했습니다."
            rows={5}
            className="mt-3 w-full resize-y rounded-md border border-foreground/20 bg-background p-3 text-sm leading-relaxed focus:border-[#E5C97A] focus:outline-none focus:ring-2 focus:ring-[#E8C547]/40"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {!reasonOk && reason.length > 0 ? "조금 더 설명해 주세요" : ""}
            </span>
            <span className="text-xs text-muted-foreground">{reason.length}자</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            이 선택과 이유는 평가가 아닙니다. 본인의 판단을 그대로 적어주세요.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={!canProceed}
              className={[
                "rounded-lg px-6 py-3 text-base font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                canProceed
                  ? "bg-[#E8C547] text-[#1D2230] hover:brightness-95"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              ].join(" ")}
            >
              피드백 확인하기 →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pdr;
