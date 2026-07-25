// 담화 슬롯 골격 — 한→중(L2 방향) 산출 지원 (계약 0-q·97, 0-i·62 파생 제약).
//
// 문제: ko_zh 산출은 빈 입력창 하나였다. 학습자가 막히는 지점이 화용 판단이 아니라
// 어휘·문법이 되어, 과제가 재려는 것(화용 조절)이 아닌 것을 재게 된다(구인 오염).
// 처방: 새 과제 유형을 만들지 않고 **기존 산출 단계의 지원량만** 수준별로 조절한다.
//
// 원칙 3가지 — 바꾸지 말 것:
//  ① 슬롯은 "무엇을 말할 차례인가"만 알려준다. **예문(완성 문장) 금지** —
//     참고 표현(reference_alternatives)은 제출 후 공개가 원칙이다.
//  ② 힌트는 카탈로그 relevant_resources에서 **고르기만** 한다(신규 생성·새 AI 호출 금지).
//     같은 자원 범주를 1부 인계 화면에서 이미 칩으로 보여주므로 새 정보 노출이 아니다.
//  ③ 구인 불변 — 같은 과제·같은 판정 기준이고 **지원량만** 수준별로 다르다.

import type { SpeechActUI } from "@/lib/pragma/enums";

export interface DiscourseSlot {
  /** 학습자에게 보이는 기능 라벨 */
  label: string;
  /** 이 슬롯에 붙일 카탈로그 자원을 찾는 키워드(부분 일치). 없으면 힌트 없음. */
  resourceMatch?: string;
}

/** 카탈로그 초점이 없는 화행·미지정 시 폴백 — 조직만 알려주는 최소 골격. */
const GENERIC_SLOTS: DiscourseSlot[] = [
  { label: "도입" },
  { label: "핵심" },
  { label: "마무리" },
];

// 화행별 담화 순서(결정론 상수). 현재 카탈로그가 있는 3화행 + 폴백.
// 나머지 6화행은 카탈로그 확장 시 같은 구조로 추가한다.
export const DISCOURSE_SLOTS: Partial<Record<SpeechActUI, DiscourseSlot[]>> = {
  request: [
    { label: "호칭·인사", resourceMatch: "부담 예고" },
    { label: "배경·이유", resourceMatch: "포석" },
    { label: "요청", resourceMatch: "능원동사" },
    { label: "선택권 남기기", resourceMatch: "종결" },
  ],
  refusal: [
    { label: "공감·유감", resourceMatch: "사과" },
    { label: "사유", resourceMatch: "이유 제시" },
    { label: "거절", resourceMatch: "완화 표지" },
    { label: "대안·여지", resourceMatch: "대안" },
  ],
  thanks: [
    { label: "감사", resourceMatch: "강도 부사" },
    { label: "무엇이 고마웠는지", resourceMatch: "부연" },
    { label: "마무리 — 정도 맞추기", resourceMatch: "절제" },
  ],
};

export function slotsForAct(act?: string | null): DiscourseSlot[] {
  if (!act) return GENERIC_SLOTS;
  return DISCOURSE_SLOTS[act as SpeechActUI] ?? GENERIC_SLOTS;
}

/**
 * 슬롯에 붙일 힌트를 카탈로그 자원 목록에서 고른다(복사·생성 아님).
 * 카탈로그 문구가 바뀌면 힌트도 자동으로 따라간다 — 정본은 targetFeatures.ts.
 */
export function hintForSlot(slot: DiscourseSlot, resources: string[]): string | undefined {
  if (!slot.resourceMatch) return undefined;
  return resources.find((r) => r.includes(slot.resourceMatch!));
}

/**
 * 수준별 지원량. ⚠️ CEFR 절대 수준(A1/B1/C1)과 동일시하지 않는다 —
 * PRAGMA 학습자는 중국어 전공자이므로 **과제 내 상대 지원량**으로만 쓴다(0-q·97).
 *   guided = 골격 + 힌트 펼침 / hinted = 골격만, 힌트 접힘 / open = 전체 접힘(기본 자유 산출)
 */
export type SupportTier = "guided" | "hinted" | "open";

export function supportTier(level?: string | null): SupportTier {
  if (level === "beginner_intermediate") return "guided";
  if (level === "advanced") return "open";
  return "hinted";
}

export const SLOT_NUMERALS = ["①", "②", "③", "④", "⑤"] as const;
