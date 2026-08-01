export type LoungeCornerId = "theater" | "meme" | "decoder";
export type LoungeDifficulty = "easy" | "medium" | "challenge";

// 라운지 목업 — 판정·저장·연구 기록 없음(UX 시공간 분리 원칙).
//
// 세 코너 모두 한 코너당 여러 장면을 좌우로 넘긴다. 장면은 아무거나 늘리지 않고
// 관계·채널이 서로 다르게 잡는다(친구 1:1 / 동료 단체방 / 상위자) — 코어와 같은 축을
// 쓰면 "표현이 아니라 관계·장면에 따라 번역이 달라진다"는 감각이 재미 콘텐츠에서도
// 그대로 남는다. `contrast`는 그 감각을 한 줄로 굳히는 자리다(설명 아님, 대비 한 줄).

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

/**
 * 라운지 홈 카드에 띄우는 첫 장면 맛보기 — 코너를 설명하는 문장 대신 실제 장면
 * 한 줄을 보여준다. 문구를 따로 쓰지 않고 각 코너의 첫 장면에서 그대로 가져와,
 * 콘텐츠가 바뀌면 홈도 같이 바뀌게 한다.
 */
export function cornerPreview(id: LoungeCornerId): { line: string; context: string } {
  if (id === "theater") {
    return { line: THEATER_ITEMS[0].title, context: THEATER_ITEMS[0].context };
  }
  if (id === "meme") {
    return { line: MEME_ITEMS[0].captions[0].text, context: MEME_ITEMS[0].context };
  }
  return { line: DECODER_MOCK_ITEMS[0].message, context: DECODER_MOCK_ITEMS[0].context };
}

export type TheaterItem = {
  difficulty: LoungeDifficulty;
  context: string;
  title: string;
  subtitle: string;
  line: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  modelInterpretation: string;
  contrast: string;
};

export const THEATER_ITEMS: TheaterItem[] = [
  {
    difficulty: "medium",
    context: "사장 → 팀원들 · 회의실",
    title: "老板又画饼了…",
    subtitle: "회의가 끝났는데 왜 배가 더 고프지?",
    line: "等项目成功了，奖金肯定少不了你们的。",
    question: "이 장면에서 画饼은 어떤 뉘앙스일까요?",
    options: ["계획을 진심으로 칭찬함", "미래 보상을 내세운 희망고문", "점심 메뉴를 제안함"],
    answer: 1,
    explanation:
      "아직 없는 보상을 약속하며 지금의 수고를 요구하는 말을 비꼬는 표현입니다.",
    modelInterpretation: "사장이 또 희망고문하네.",
    contrast:
      "동료끼리는 “또 희망고문이네”가 통하지만, 그 자리에 사장이 있으면 “구체적인 일정이 궁금합니다”처럼 바꿔야 합니다.",
  },
  {
    difficulty: "easy",
    context: "친구 → 친구들 · 단체 채팅방",
    title: "他又咕咕咕了",
    subtitle: "세 번째 약속이 또 미뤄졌다",
    line: "抱歉抱歉，我又咕咕咕了…下次一定！",
    question: "咕咕咕는 이 장면에서 어떤 뜻일까요?",
    options: ["비둘기 소리를 흉내 냄", "약속을 또 못 지켰다는 자백", "새 약속을 제안함"],
    answer: 1,
    explanation:
      "약속을 펑크 내는 것을 비둘기 울음소리로 자조하는 인터넷 표현입니다. 下次一定과 짝을 이루면 “다음엔 꼭”이라는 상투적 다짐이 됩니다.",
    modelInterpretation: "미안미안, 나 또 펑크야… 다음엔 진짜 갈게!",
    contrast:
      "친구끼리는 “또 펑크야”가 자연스럽지만, 업무 상대에게는 자조를 빼고 “일정을 맞추지 못했습니다”로 적습니다.",
  },
  {
    difficulty: "challenge",
    context: "동료 → 동료 · 야근 중인 사무실",
    title: "卷不动了",
    subtitle: "다들 남아 있는데 나만 먼저 나가도 될까",
    line: "我是真的卷不动了，先撤了啊。",
    question: "卷不动了는 어떤 심정일까요?",
    options: [
      "경쟁에 더 뛰어들겠다는 각오",
      "과열 경쟁을 더는 못 버티겠다는 자조",
      "서류를 말아 정리하겠다는 뜻",
    ],
    answer: 1,
    explanation:
      "内卷의 卷에서 온 말로, 소모적인 경쟁 상태를 더는 버틸 수 없다는 자조입니다.",
    modelInterpretation: "나 진짜 더는 못 버티겠다, 먼저 갈게.",
    contrast:
      "동료끼리는 “못 버티겠다”가 자연스럽지만, 상사에게는 “오늘은 먼저 들어가 보겠습니다”처럼 자조를 덜어냅니다.",
  },
];

export type MemeItem = {
  difficulty: LoungeDifficulty;
  context: string;
  title: string;
  gloss: string;
  condition: string;
  captions: { id: string; text: string }[];
  contrast: string;
};

export const MEME_ITEMS: MemeItem[] = [
  {
    difficulty: "challenge",
    context: "동료 → 동료 · 회사 단체방",
    title: "脆皮打工人",
    gloss: "조금만 무리해도 바로 삐걱거리는 요즘 직장인의 자조 밈",
    condition: "회사 단톡방에 올려도 안 잘리는 번역으로!",
    captions: [
      { id: "a", text: "출근은 했는데 내구도가 로그아웃했습니다" },
      { id: "b", text: "오늘도 유리몸으로 단단히 버티는 중" },
      { id: "c", text: "업무 능력보다 먼저 소진되는 체력" },
    ],
    contrast:
      "같은 자조도 동료 단톡방에서는 웃음이 되지만, 상사에게 직접 보내면 업무 회피로 읽힐 수 있습니다.",
  },
  {
    difficulty: "easy",
    context: "친구 → 친구들 · 단체 채팅방",
    title: "显眼包",
    gloss: "어디서든 눈에 띄는 행동으로 웃음을 주는 사람",
    condition: "친구를 놀리듯, 그러나 상처 주지 않게!",
    captions: [
      { id: "a", text: "오늘도 관종력 만렙 찍었네" },
      { id: "b", text: "어딜 가나 눈에 띄는 우리 반 광대" },
      { id: "c", text: "존재 자체가 하이라이트" },
    ],
    contrast:
      "친한 사이에서 “관종력”은 애정 표현이지만, 잘 모르는 사이에서는 놀림으로만 들립니다.",
  },
  {
    difficulty: "medium",
    context: "후배 → 선배 · 1:1 메시지",
    title: "尊嘟假嘟",
    gloss: "真的假的를 애교스럽게 뭉갠 말투 — “진짜야 가짜야?”",
    condition: "선배에게 보내도 어색하지 않게!",
    captions: [
      { id: "a", text: "진짜요…? 에이 설마요" },
      { id: "b", text: "이거 실화인가요?" },
      { id: "c", text: "정말인가요? 믿기지가 않아서요" },
    ],
    contrast:
      "친구에겐 “에이 설마”가 딱 맞지만, 선배에겐 애교체를 덜고 놀라움만 남기는 편이 안전합니다.",
  },
];

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
  contrast: string;
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
    decodedMeaning:
      "666은 ‘잘한다, 대단하다’는 온라인 감탄입니다. 여기서는 앞의 强了와 함께 진심 어린 칭찬으로 쓰였습니다.",
    koreanLine: "와, 순발력 미쳤다. 진짜 잘했어!",
    koreanReason: "친한 동급생의 즉각적인 칭찬이라 숫자를 직역하지 않고 강한 감탄으로 살렸습니다.",
    contrast:
      "같은 칭찬도 교수님께 보낼 때는 “순발력이 정말 좋으셨습니다”처럼 숫자 표현을 빼는 편이 안전합니다.",
  },
  {
    difficulty: "easy",
    code: "233",
    context: "친구 → 친구들 · 단체 채팅방",
    message: "救命，看到这个错别字我直接23333",
    question: "이 메시지를 친구들 단체방의 한국어로 옮긴다면?",
    options: ["살려줘, 이 오타 보고 나 진짜 터졌어ㅋㅋ", "이 오타는 반드시 공식적으로 수정해야 합니다.", "도움이 급하니 지금 전화해줘."],
    answer: 0,
    decodedMeaning:
      "233은 ‘ㅋㅋㅋ’처럼 크게 웃는 반응입니다. 이 장면에서는 친구들끼리 오타를 함께 웃는 가벼운 공유에 가깝습니다.",
    koreanLine: "살려줘, 이 오타 보고 나 진짜 터졌어ㅋㅋ",
    koreanReason: "친구들끼리 실수를 함께 웃는 장면이라 공격적인 ‘비웃음’보다 가벼운 공유 반응으로 옮겼습니다.",
    contrast:
      "친구끼리는 “ㅋㅋ”가 자연스럽지만, 업무 단톡방에서 남의 오타에 웃으면 놀림으로 읽힙니다.",
  },
  {
    difficulty: "medium",
    code: "大聪明 🙂",
    context: "동료 → 잘못된 파일을 올린 동료 · 프로젝트 단체방",
    message: "你可真是个大聪明 🙂",
    question: "이 장면의 말맛을 가장 잘 살린 한국어는?",
    options: ["정말 똑똑하시네요.", "너 참 똑똑한 짓 했다 🙂", "파일을 다시 올려주시겠어요?"],
    answer: 1,
    decodedMeaning:
      "大聪明은 문자 그대로 ‘아주 똑똑한 사람’이지만, 실수 직후의 칭찬형 문장과 🙂가 만나 장난 섞인 비꼼이 됩니다.",
    koreanLine: "너 참 똑똑한 짓 했다 🙂",
    koreanReason: "칭찬형 문장과 실수 맥락이 충돌하고 미소 이모지가 덧붙어, 날을 세우지 않은 비꼼으로 옮겼습니다.",
    contrast:
      "같은 말도 실수 직후가 아니라 정말 좋은 아이디어 뒤에 나오면 순수한 감탄이 됩니다.",
  },
  {
    difficulty: "medium",
    code: "行吧……",
    context: "팀원 → 일정을 다시 바꾸자는 팀장 · 업무 채팅",
    message: "行吧……那就按你说的改。",
    question: "관계와 말줄임표를 함께 살린 한국어는?",
    options: ["네! 너무 좋습니다. 당장 바꿀게요!", "뭐… 알겠습니다. 말씀하신 대로 바꿀게요.", "결정은 다음 회의로 미루겠습니다."],
    answer: 1,
    decodedMeaning:
      "行吧는 기본적으로 수락이지만, 길어진 말끝이 유보와 마지못함을 더합니다. 거절은 아니지만 적극적인 동의도 아닙니다.",
    koreanLine: "뭐… 알겠습니다. 말씀하신 대로 바꿀게요.",
    koreanReason: "업무 관계의 존대는 유지하되 말줄임표에 담긴 유보와 마지못함을 ‘뭐…’로 살렸습니다.",
    contrast:
      "친구에게라면 “뭐 그러든가”로 충분하지만, 팀장에게는 유보를 남기되 존대를 지켜야 합니다.",
  },
  {
    difficulty: "challenge",
    code: "社恐发作了",
    context: "동급생 → 저녁 모임을 제안한 친구들 · 단체 채팅방",
    message: "今晚我就不去了，社恐发作了 😂",
    question: "친구 사이의 자조적 거절로 가장 자연스러운 번역은?",
    options: ["오늘 낯가림 모드라 나는 빠질게 😂", "나는 여러분과 관계를 끊겠습니다.", "오늘 모임에 화가 나서 참석하지 않습니다."],
    answer: 0,
    decodedMeaning:
      "社恐发作了는 여기서 의학적 진술보다 ‘오늘은 사람 만날 기운이 없다’는 자조적 설명입니다. 😂가 거절의 부담을 더 낮춥니다.",
    koreanLine: "오늘 낯가림 모드라 나는 빠질게 😂",
    koreanReason: "의학적 표현처럼 직역하지 않고, 친구 사이에서 거절의 부담을 낮추는 자조적 말투로 옮겼습니다.",
    contrast:
      "친구에겐 자조가 통하지만, 교수님께는 “오늘은 참석이 어렵습니다”처럼 사유를 담백하게 적습니다.",
  },
];
