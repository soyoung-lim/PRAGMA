// 학습자 워크플로우 표시 정본 — 홈·강좌·미션·기록이 같은 단계 정의를 공유한다.
//
// 교수자 화면은 파이프라인이 메뉴로 보이는데 학습자 화면은 과제함처럼 평평했다.
// 원인은 콘텐츠가 아니라 화면마다 단계 이름·순서가 제각각이라 하나의 여정으로
// 읽히지 않은 것이다. 그래서 이름과 순서를 이 파일 한 곳에서만 정한다.
//
// 원칙:
//  - 학습자에게는 행동 동사를 보이고, 연구 표기(MPJ·DCT)는 작은 보조 라벨로만 남긴다.
//  - 이 단계들은 순서가 있는 한 번의 수행이다. 전역 메뉴로 펼치지 않는다
//    (건너뛰기가 가능해 보이면 첫 산출 측정이 오염된다).
//  - 표시층 정본이다. 판정·저장·생성계약은 이 파일에 의존하지 않는다.

export type LearnerWorkflowStepKey =
  | "scenario"
  | "judge"
  | "produce"
  | "feedback"
  | "revise";

export interface LearnerWorkflowStep {
  key: LearnerWorkflowStepKey;
  /** 학습자에게 보이는 이름 — 행동 동사 */
  label: string;
  /** 연구·설계 표기. 보조 라벨로만 쓴다. */
  aside: string;
  /** 미리보기 한 줄 설명 */
  detail: string;
}

/** mission_v4·v5 정본 문항 수. v1·v2 legacy만 5문항이었다. */
export const MPJ_ITEM_COUNT = 4;

export function learnerWorkflowSteps(
  options: { interpreting?: boolean; mpjCount?: number } = {},
): LearnerWorkflowStep[] {
  const { interpreting = false, mpjCount = MPJ_ITEM_COUNT } = options;
  return [
    {
      key: "scenario",
      label: "장면 이해하기",
      aside: "상황",
      detail: "누구에게, 어떤 자리에서, 무엇을 말해야 하는지 읽습니다.",
    },
    {
      key: "judge",
      label: "표현 비교하기",
      aside: `MPJ ${mpjCount}`,
      detail: `비슷해 보이는 표현이 어떻게 다르게 들리는지 ${mpjCount}번 판단합니다.`,
    },
    {
      key: "produce",
      label: interpreting ? "직접 통역하기" : "직접 번역하기",
      aside: "DCT",
      detail: interpreting
        ? "상황에 맞게 직접 말해 옮깁니다."
        : "상황에 맞게 직접 옮겨 씁니다.",
    },
    {
      key: "feedback",
      label: "피드백 살피기",
      aside: "진단",
      detail: "의미 전달 · 문법 정확성 · 상황 적절성으로 나눠 확인합니다.",
    },
    {
      key: "revise",
      label: "다시 다듬기",
      aside: "수정",
      detail: "고칠 지점을 하나 정해 다시 씁니다.",
    },
  ];
}

/** 홈·강좌에서 한 줄로 예고할 때 쓰는 표기. 단계 이름을 줄이지 않는다. */
export function learnerWorkflowSummary(
  options: { interpreting?: boolean } = {},
): string {
  return learnerWorkflowSteps(options)
    .map((step) => step.label)
    .join(" → ");
}

// ⚠️ 주차 화면에 「① 원리 익히기 → ② 미션」을 두었다가 되돌렸다. Roever 교수 단계의
// Hook·Orientation → 귀납 관찰 → 명시적 원리 설명 → 수용은 주차 학습 노트가 아니라
// 목표 특징 최초 도입 시 1회 도는 도입 아크(IntroArc·L1~L4)다. 노트는 예습·복습면이므로
// 여기에 '원리' 이름을 붙이면 논문의 교수 단계 대응이 어긋난다.
