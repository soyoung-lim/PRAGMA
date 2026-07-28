export type LoungeCornerId = "theater" | "meme" | "decoder";
export type LoungeDifficulty = "easy" | "medium" | "challenge";

export const LOUNGE_CORNERS: Array<{
  id: LoungeCornerId;
  emoji: string;
  title: string;
  eyebrow: string;
  description: string;
  badge: string;
  accent: string;
}> = [
  {
    id: "theater",
    emoji: "🎬",
    title: "생생극장",
    eyebrow: "짧은 장면, 긴 여운",
    description: "교과서 밖 중국어의 뉘앙스를 한 장면으로 느껴봅니다.",
    badge: "NEW",
    accent: "#FF6B4A",
  },
  {
    id: "meme",
    emoji: "😂",
    title: "밈 배틀",
    eyebrow: "같은 밈, 다른 번역",
    description: "같은 밈을 서로 다른 한국어 캡션으로 옮겨봅니다.",
    badge: "투표중",
    accent: "#8D6BFF",
  },
  {
    id: "decoder",
    emoji: "💬",
    title: "해독실",
    eyebrow: "중국어 디지털 장면 해독",
    description: "숫자와 온라인 말투를 관계 속 뉘앙스와 번역으로 풀어봅니다.",
    badge: "NEW",
    accent: "#19A974",
  },
];

export const THEATER_MOCK = {
  difficulty: "medium" as LoungeDifficulty,
  week: 6,
  title: "老板又画饼了…",
  subtitle: "회의가 끝났는데 왜 배가 더 고프지?",
  line: "等项目成功了，奖金肯定少不了你们的。",
  question: "이 장면에서 画饼은 어떤 뉘앙스일까요?",
  options: ["계획을 진심으로 칭찬함", "미래 보상을 내세운 희망고문", "점심 메뉴를 제안함"],
  answer: 1,
  explanation: "아직 없는 보상을 약속하며 현재의 수고를 요구하는 말을 비꼬는 표현입니다.",
  modelInterpretation: "사장이 또 희망고문하네.",
};

export const MEME_MOCK = {
  difficulty: "challenge" as LoungeDifficulty,
  title: "脆皮打工人",
  gloss: "조금만 무리해도 바로 삐걱거리는 요즘 직장인의 자조 밈",
  condition: "회사 단톡방에 올려도 안 잘리는 번역으로!",
  captions: [
    { id: "a", text: "출근은 했는데 내구도가 로그아웃했습니다" },
    { id: "b", text: "오늘도 유리몸으로 단단히 버티는 중" },
    { id: "c", text: "업무 능력보다 먼저 소진되는 체력" },
  ],
};

export type DecoderItem = {
  difficulty: LoungeDifficulty;
  code: string;
  context: string;
  message: string;
  question: string;
  options: string[];
  answer: number;
  decodedMeaning: string;
  koreanLine: string;
  koreanReason: string;
};

export const DECODER_MOCK_ITEMS: DecoderItem[] = [
  {
    difficulty: "easy",
    code: "666",
    context: "동급생 → 발표를 막 끝낸 친구 · 위챗 1:1",
    message: "你临场反应也太强了，666！",
    question: "이 메시지를 한국어로 옮길 때 가장 가까운 반응은?",
    options: ["와, 순발력 미쳤다. 진짜 잘했어!", "발표 망했네. 다음엔 하지 마.", "일단 6시 6분 6초에 다시 보자."],
    answer: 0,
    decodedMeaning: "666은 ‘잘한다, 대단하다’는 온라인 감탄입니다. 여기서는 앞의 强了와 함께 진심 어린 칭찬으로 쓰였습니다.",
    koreanLine: "와, 순발력 미쳤다. 진짜 잘했어!",
    koreanReason: "친한 동급생의 즉각적인 칭찬이라 숫자를 직역하지 않고 강한 감탄으로 살렸습니다.",
  },
  {
    difficulty: "easy",
    code: "233",
    context: "친구 → 친구들 · 단체 채팅방",
    message: "救命，看到这个错别字我直接23333",
    question: "이 메시지를 친구들 단체방의 한국어로 옮긴다면?",
    options: ["살려줘, 이 오타 보고 나 진짜 터졌어ㅋㅋ", "이 오타는 반드시 공식적으로 수정해야 합니다.", "도움이 급하니 지금 전화해줘."],
    answer: 0,
    decodedMeaning: "233은 ‘ㅋㅋㅋ’처럼 크게 웃는 반응입니다. 이 장면에서는 친구들끼리 오타를 함께 웃는 가벼운 공유에 가깝습니다.",
    koreanLine: "살려줘, 이 오타 보고 나 진짜 터졌어ㅋㅋ",
    koreanReason: "친구들끼리 실수를 함께 웃는 장면이라 공격적인 ‘비웃음’보다 가벼운 공유 반응으로 옮겼습니다.",
  },
  {
    difficulty: "medium",
    code: "大聪明 🙂",
    context: "동료 → 잘못된 파일을 올린 동료 · 프로젝트 단체방",
    message: "你可真是个大聪明 🙂",
    question: "이 장면의 말맛을 가장 잘 살린 한국어는?",
    options: ["정말 똑똑하시네요.", "너 참 똑똑한 짓 했다 🙂", "파일을 다시 올려주시겠어요?"],
    answer: 1,
    decodedMeaning: "大聪明은 문자 그대로 ‘아주 똑똑한 사람’이지만, 실수 직후의 칭찬형 문장과 🙂가 만나 장난 섞인 비꼼이 됩니다.",
    koreanLine: "너 참 똑똑한 짓 했다 🙂",
    koreanReason: "칭찬형 문장과 실수 맥락이 충돌하고 미소 이모지가 덧붙어, 날을 세우지 않은 비꼼으로 옮겼습니다.",
  },
  {
    difficulty: "medium",
    code: "行吧……",
    context: "팀원 → 일정을 다시 바꾸자는 팀장 · 업무 채팅",
    message: "行吧……那就按你说的改。",
    question: "관계와 말줄임표를 함께 살린 한국어는?",
    options: ["네! 너무 좋습니다. 당장 바꿀게요!", "뭐… 알겠습니다. 말씀하신 대로 바꿀게요.", "결정은 다음 회의로 미루겠습니다."],
    answer: 1,
    decodedMeaning: "行吧는 기본적으로 수락이지만, 길어진 말끝이 유보와 마지못함을 더합니다. 거절은 아니지만 적극적인 동의도 아닙니다.",
    koreanLine: "뭐… 알겠습니다. 말씀하신 대로 바꿀게요.",
    koreanReason: "업무 관계의 존대는 유지하되 말줄임표에 담긴 유보와 마지못함을 ‘뭐…’로 살렸습니다.",
  },
  {
    difficulty: "challenge",
    code: "社恐发作了",
    context: "동급생 → 저녁 모임을 제안한 친구들 · 단체 채팅방",
    message: "今晚我就不去了，社恐发作了 😂",
    question: "친구 사이의 자조적 거절로 가장 자연스러운 번역은?",
    options: ["오늘 낯가림 모드라 나는 빠질게 😂", "나는 여러분과 관계를 끊겠습니다.", "오늘 모임에 화가 나서 참석하지 않습니다."],
    answer: 0,
    decodedMeaning: "社恐发作了는 여기서 의학적 진술보다 ‘오늘은 사람 만날 기운이 없다’는 자조적 설명입니다. 😂가 거절의 부담을 더 낮춥니다.",
    koreanLine: "오늘 낯가림 모드라 나는 빠질게 😂",
    koreanReason: "의학적 표현처럼 직역하지 않고, 친구 사이에서 거절의 부담을 낮추는 자조적 말투로 옮겼습니다.",
  },
];
