// 도입 아크(lesson_arc) mock — 새 목표 특징을 처음 배울 때 1회. UI 목업 전용.
//
// 미션 사이클(산출 먼저)과 순서가 반대다: 입력 먼저(장면→관찰→명시→수용) 후
// 미션 1개로 합류. 학습자에게는 이론 용어를 노출하지 않는다(4층 UI LOCK 매핑):
//   Orientation=장면 만나기 / Inductive=차이 찾기 /
//   Metapragmatic=원리 이해 / MPJ=감각 확인
//
// ⚠️ 도입 사례와 산출 문항은 다른 자극을 쓴다(intro_example_item ≠ production_item).
// 같은 목표 특징·유사 P·D·R은 허용하되 인물·사건·원문은 겹치지 않게 한다 —
// 여기는 리웨이/노트, 미션은 샤오린/발표자료다.

export const INTRO_STEPS = ["장면 만나기", "차이 찾기", "원리 이해", "감각 확인"] as const;
export type IntroStep = (typeof INTRO_STEPS)[number];

/** 이 아크가 도입하는 전략군. 완료 시 LearnerFeatureState에 기록된다. */
export const INTRO_FEATURE_ID = "request_directness_mitigation";

/** ① 장면 만나기 — 화용 실패 장면. 규칙은 아직 설명하지 않는다. */
export const HOOK_SCENE = {
  eyebrow: "요청 · 직접성과 완화",
  title: "어느 유학생의 3분 침묵",
  lead: "민준 씨, 이번 학기 처음 같은 조가 된 리웨이에게 위챗으로 부탁을 보냈는데…",
  direction: "밤 9시, 위챗. 아직 서로 존댓말도 어색한 사이.",
  lines: [
    { who: "민준", zh: "把上次的课件发我一下。", note: null },
    { who: null, zh: null, note: "읽음 표시. 답장 없는 3분." },
    { who: "리웨이", zh: "哦，好。", note: "파일만 툭. 그 뒤로 대화 끊김" },
  ],
  closing:
    "문법은 완벽했습니다. 그런데 왜 차가워졌을까요? — 규칙 설명은 잠시 미뤄두고, 같은 상황을 잘 넘긴 사람들을 먼저 봅시다.",
};

/** ② 차이 찾기 — 검수된 참조 사례에서 탭으로 발견하는 단서. 3개 이상이면 진행. */
export const CLUES = [
  { zh: "李伟，在忙吗？", why: "상황 묻기 — 본론 전에 상대 사정 확인" },
  { zh: "不好意思，", why: "완충 표현 — 부탁의 문을 부드럽게 엶" },
  { zh: "我上次的课堂笔记没记全，", why: "이유 제시 — 왜 부탁하는지 먼저" },
  { zh: "不方便的话也没关系~", why: "선택권 부여 — 거절할 여지를 열어둠" },
];
export const CLUE_TAIL = "你的笔记能发我看看吗？";
export const CLUES_REQUIRED = 3;

/** 단일 규범 금지 — 정답 하나가 아니라 적절 대역 + 경계를 함께 보여준다. */
export const REFERENCE_CASES = {
  good: {
    label: "사례 B · 더 간결해도 적절",
    zh: "李伟，不好意思，笔记能发我一下吗？谢啦~",
  },
  edge: {
    label: "경계 · 문법은 맞는데 과해요",
    zh: "尊敬的李伟同学，恳请您将笔记发送于我，不胜感激。",
  },
};

/** ③ 원리 이해 — P·D·R을 학습자 언어로. 이론 용어(P/D/R) 자체는 노출하지 않는다. */
export const PRINCIPLE_TABLE = [
  { k: "상대와의 지위", v: "같은 학년 동급생 = 동등 → 존칭은 오히려 거리감", hi: false },
  { k: "가까움", v: "아직 어색한 사이 → 반말 명령형은 위험", hi: true },
  { k: "부탁의 부담", v: "노트 전체 공유 = 중간 부담 → 완충 한 겹 + 출구", hi: true },
];
export const PRINCIPLE_LEAD =
  "어색한 사이의 중간 부담이라면 완충 한 마디와 선택권이면 충분한 경우가 많아요. 겹겹이 쌓으면(경계 사례) 오히려 거리를 둡니다 — 많을수록 좋은 게 아니라 상황에 맞는 만큼.";
export const STRATEGY_MAP_UNLOCK =
  "요청 전략 지도가 열렸어요 — 방금 찾은 4개 단서가 지도의 전략들이에요.";

/** ④ 감각 확인 — 과소/적정/과잉 3분류. 화행에 단일정답 객관식은 쓰지 않는다(Roever). */
export type ClassLabel = "under" | "ok" | "over";
export const CLASS_LABELS: { key: ClassLabel; label: string }[] = [
  { key: "under", label: "너무 직접" },
  { key: "ok", label: "알맞음" },
  { key: "over", label: "과잉 공손" },
];
export const CLASSIFY_PROMPT =
  "상황: 처음 보는 옆자리 학생에게 펜을 빌립니다. 각 발화를 분류해 보세요 — 정답 문장 하나를 고르는 게 아니에요.";
export const CLASSIFY_ITEMS: { zh: string; truth: ClassLabel; fb: string }[] = [
  { zh: "笔借我。", truth: "under", fb: "처음 보는 사이엔 갑작스럽게 들려요 (과소완화)." },
  {
    zh: "同学，不好意思，笔能借我用一下吗？",
    truth: "ok",
    fb: "완충 한 마디 + 의문형 — 이 상황의 적정 범위예요.",
  },
  {
    zh: "尊敬的同学，恳请您将笔借予我一用，不胜感激。",
    truth: "over",
    fb: "펜 하나에 이 격식 — 과잉이에요.",
  },
];

export const ARC_CLOSING = {
  allRight: "감 잡으셨어요 — 완화는 상황에 맞는 만큼만.",
  partial: "분류를 다시 살펴보세요 — 피드백을 참고해서.",
  cta: "이제 직접 해볼 차례 — 미션 1개",
};
