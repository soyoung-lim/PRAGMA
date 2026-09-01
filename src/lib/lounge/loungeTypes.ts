export type LoungeModuleId = "decode" | "culture" | "literal";

export type LoungeLanguageDirection = "zh_ko" | "ko_zh";

export type LoungeReviewStatus = "draft" | "source_checked" | "researcher_approved";

export type LoungeChoice = {
  id: string;
  label: string;
};

export type LoungeSourceRef = {
  label: string;
  url?: string;
  checked_at?: string;
};

type LoungeItemBase = {
  id: string;
  module: LoungeModuleId;
  title: string;
  language_direction: LoungeLanguageDirection;
  context: string;
  source_text: string;
  prompt: string;
  choices: LoungeChoice[];
  answer_id: string;
  quick_point: string;
  source_refs: LoungeSourceRef[];
  review_status: LoungeReviewStatus;
};

export type DecodeLoungeItem = LoungeItemBase & {
  module: "decode";
  meaning: string;
  why: string;
  contrast: string;
};

export type CultureLoungeItem = LoungeItemBase & {
  module: "culture";
  verified_facts: string[];
  cultural_context: string;
  translation_interpretation: string;
};

export type LiteralIssueLayer =
  | "false_friend"
  | "collocation"
  | "word_sense";

export type LiteralLoungeItem = LoungeItemBase & {
  module: "literal";
  issue_layer: LiteralIssueLayer;
  adjusted_translation: string;
  why_awkward: string;
};

export type LoungeItem = DecodeLoungeItem | CultureLoungeItem | LiteralLoungeItem;

export type LoungeModuleMeta = {
  id: LoungeModuleId;
  title: string;
  eyebrow: string;
  description: string;
  accent: string;
  soft: string;
  scene: string;
};

export const LOUNGE_MODULES: LoungeModuleMeta[] = [
  {
    id: "decode",
    title: "해독실",
    eyebrow: "표현 해독",
    description: "숫자·유행어·말투의 숨은 뜻을 풉니다.",
    accent: "#176F68",
    soft: "#E2F4F0",
    scene: "#287F77",
  },
  {
    id: "culture",
    title: "문화코드",
    eyebrow: "생활문화",
    description: "관습·제도·사회현상이 품은 장면을 읽습니다.",
    accent: "#5A4FA4",
    soft: "#EFEDFB",
    scene: "#6558A8",
  },
  {
    id: "literal",
    title: "직역 함정",
    eyebrow: "단어 대응",
    description: "닮은 한자·단어 사이에서 자연스러운 표현을 고릅니다.",
    accent: "#A94E3E",
    soft: "#FBECE7",
    scene: "#B85B49",
  },
];

export const isLoungeModuleId = (value?: string): value is LoungeModuleId =>
  value === "decode" || value === "culture" || value === "literal";

export const loungeModuleMeta = (id: LoungeModuleId) =>
  LOUNGE_MODULES.find((module) => module.id === id)!;
