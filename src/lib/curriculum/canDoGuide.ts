import type { CurriculumWeekDraft } from "./types";
import {
  DOMAIN,
  SPEECH_ACT_UI,
  type LanguageDirection,
} from "@/lib/pragma/enums";

const CHANNEL_LABEL: Record<
  NonNullable<CurriculumWeekDraft["channel"]>,
  string
> = {
  email: "이메일",
  messenger: "메신저",
  facetoface: "대면",
  phone: "전화",
};

const DIRECTION_LABEL: Record<LanguageDirection, string> = {
  ko_zh: "한→중",
  zh_ko: "중→한",
};

export function buildCanDoSuggestions(
  week: Pick<CurriculumWeekDraft, "speech_act" | "domain" | "channel">,
  direction: LanguageDirection,
): [string, string] {
  const channel = week.channel ? CHANNEL_LABEL[week.channel] : "통번역";
  const situation = week.domain
    ? `${DOMAIN[week.domain]}의 ${channel} 상황`
    : `주어진 ${channel} 상황`;
  const action = week.speech_act
    ? `‘${SPEECH_ACT_UI[week.speech_act]}’ 소통 행동`
    : "목표 소통 행동";
  const mode =
    week.channel === "email" || week.channel === "messenger"
      ? "번역"
      : week.channel === "facetoface" || week.channel === "phone"
        ? "통역"
        : "통번역";

  return [
    `${situation}에서 ${action}을 관계와 부담에 맞게 수행할 수 있다.`,
    `${DIRECTION_LABEL[direction]} ${mode}에서 전달할 의미를 유지하며 상대에게 주는 인상을 점검하고 표현을 다듬을 수 있다.`,
  ];
}
