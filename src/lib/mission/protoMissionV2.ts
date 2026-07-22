// 프로토타입 미션 v2 — 흐름 검증 전용. DB·AI 연결 없음.
//
// 왜 만드는가: 기존 /scenario(산출 먼저 → 분석 4블록)가 무겁고, 단원에서 이미
// 가르친 것을 미션마다 반복하고 있었다. Roever의 수업 단계에서 미션은 ⑤산출인데
// ②③④가 다시 들어가 있던 셈이다.
//
// 새 흐름 = ④수용(MPJ 여러 개로 감각 쌓기) → ⑤산출(새 상황 1회) → 피드백 → 수정
//
// ⚠️ 이 파일의 중국어 예문은 흐름 판단용 초안이다. **원어민 검토 전**이며
//    확정 콘텐츠가 아니다. 판정 라벨도 검토 대상이다.
//
// MPJ 설계 제약 (선택지 통제 — 이게 깨지면 문항이 화용을 측정하지 못한다):
//   · 사실 정보와 발화 의도는 원문과 동일
//   · 문법적으로 모두 성립 (한 선택지만 비문이면 문법으로 정답을 맞힘)
//   · 차이는 **목표 화용 요소(직접성·완화)에서만** 발생
//
// 목표 화용 요소: 요청의 직접성과 완화 (request_directness_mitigation)
// 수준: 중급 · HSK5

export type Judgment = "under" | "ok" | "over";

export const JUDGMENT_LABEL: Record<Judgment, string> = {
  under: "너무 직접",
  ok: "알맞음",
  over: "과잉 공손",
};

/** 변형 6종 — 어느 것이 학습자에게 유효한지 고르기 위한 쇼케이스 */
export type MpjVariant =
  | "scale5" // ① 적절성 5점 척도
  | "politeness5" // ② 과잉공손 전용 척도
  | "correctFree" // ③ 판정 + 자유 교정
  | "correctChoice" // ④ 판정 + 교정 선택지(복수 정답)
  | "reasonConfidence" // ⑤ 판정 + 이유 + 확신도
  | "multiUtterance"; // ⑥ 한 상황 다중 발화

export const VARIANT_LABEL: Record<MpjVariant, string> = {
  scale5: "① 적절성 5점 척도",
  politeness5: "② 과잉공손 전용 척도",
  correctFree: "③ 판정 + 자유 교정",
  correctChoice: "④ 판정 + 교정 선택지",
  reasonConfidence: "⑤ 판정 + 이유 + 확신도",
  multiUtterance: "⑥ 한 상황 다중 발화",
};

export interface MpjSituation {
  headline: string;
  relation: string;
  channel: string;
  /** 학습자 화면에 P·D·R 용어는 노출하지 않는다 — 설계 확인용 */
  internalPdr: string;
}

export interface MpjItemBase {
  id: string;
  variant: MpjVariant;
  situation: MpjSituation;
  sourceText: string;
  /** 경계 사례 — 확신도 정확성 분석에서 제외해야 하는 문항 */
  borderline?: boolean;
}

export interface MpjSingle extends MpjItemBase {
  variant: "scale5" | "politeness5" | "correctFree" | "correctChoice" | "reasonConfidence";
  candidate: string;
  truth: Judgment;
  feedback: string;
  /** correctChoice 전용 */
  fixOptions?: { zh: string; correct: boolean; note: string }[];
  /** reasonConfidence 전용 — P·D·R 판단을 이유 선택지에 녹인다
   *  (관계 3지선다 화면을 지워도 맥락 인식 데이터가 남는 장치) */
  reasons?: { key: string; label: string; correct: boolean }[];
}

export interface MpjMulti extends MpjItemBase {
  variant: "multiUtterance";
  candidates: { zh: string; truth: Judgment; note: string }[];
}

export type MpjItem = MpjSingle | MpjMulti;

// ── 변형 6종 × 서로 다른 상황 ────────────────────────────────
// 상황은 모두 다르되 화행(요청)·목표 화용 요소·수준은 평행하게 유지한다.

export const MPJ_ITEMS: MpjItem[] = [
  {
    id: "mpj-1",
    variant: "scale5",
    situation: {
      headline: "지도교수님께 대학원 추천서를 부탁하는 이메일을 씁니다.",
      relation: "지도교수 · 평소 수업에서만 뵙는 사이",
      channel: "이메일",
      internalPdr: "P: 내가 낮음 / D: 지인 / R: 높음",
    },
    sourceText:
      "교수님, 혹시 대학원 지원에 필요한 추천서를 써주실 수 있을까요? 마감은 다음 달 15일입니다.",
    candidate: "老师，请给我写一封推荐信。截止日期是下个月15号。",
    truth: "under",
    feedback:
      "정보는 다 담겼지만 '请给我写'는 지시에 가깝습니다. 부담이 큰 부탁인데 완화도 이유도 없어 갑작스럽게 읽힙니다.",
  },
  {
    id: "mpj-2",
    variant: "politeness5",
    situation: {
      headline: "카페에서 직원에게 콘센트를 써도 되는지 묻습니다.",
      relation: "카페 직원 · 초면",
      channel: "대면",
      internalPdr: "P: 동등 / D: 초면 / R: 낮음",
    },
    sourceText: "여기 콘센트 사용해도 될까요?",
    candidate:
      "您好，非常抱歉打扰您，冒昧请问一下，不知道这里的插座是否可以使用？给您添麻烦了，实在不好意思。",
    truth: "over",
    feedback:
      "표준적인 서비스 상황이라 부담이 낮습니다. 사과를 두 번 얹으면 오히려 거리를 두는 느낌이 됩니다.",
  },
  {
    id: "mpj-3",
    variant: "correctFree",
    situation: {
      headline: "같이 사는 룸메이트에게 에어컨 온도를 조절해달라고 합니다.",
      relation: "룸메이트 · 편한 사이",
      channel: "대면",
      internalPdr: "P: 동등 / D: 친밀 / R: 낮음",
    },
    sourceText: "에어컨 좀 약하게 틀어도 될까? 좀 추워서.",
    candidate: "把空调关小一点。",
    truth: "under",
    feedback:
      "친한 사이라도 把자 명령형만 쓰면 통보로 들립니다. 원문의 '좀 추워서'(이유)가 빠진 것도 큽니다.",
  },
  {
    id: "mpj-4",
    variant: "correctChoice",
    situation: {
      headline: "조교에게 과제 마감일을 확인합니다.",
      relation: "조교 · 몇 번 이야기해 본 사이",
      channel: "위챗",
      internalPdr: "P: 상대가 조금 위 / D: 지인 / R: 낮음",
    },
    sourceText: "조교님, 과제 마감이 이번 주 금요일 맞나요?",
    candidate: "喂，作业什么时候交？",
    truth: "under",
    feedback: "'喂'는 전화를 받을 때나 부르는 말에 가깝고, 호칭과 완화가 모두 없습니다.",
    fixOptions: [
      {
        zh: "助教您好，请问作业的截止日期是这周五吗？",
        correct: true,
        note: "호칭 + 请问으로 부드럽게 열었습니다.",
      },
      {
        zh: "助教，想确认一下，作业是这周五交吗？",
        correct: true,
        note: "'확인하고 싶다'는 완충이 들어가 자연스럽습니다.",
      },
      { zh: "作业交了没？", correct: false, note: "여전히 호칭도 완화도 없습니다." },
      {
        zh: "尊敬的助教，恳请您告知作业截止之日期。",
        correct: false,
        note: "위챗 메시지에 서면 공문투 — 이번엔 과잉입니다.",
      },
    ],
  },
  {
    id: "mpj-5",
    variant: "reasonConfidence",
    situation: {
      headline: "동아리 선배에게 지난주 회의록을 공유해달라고 합니다.",
      relation: "동아리 선배 · 알지만 아직 어색한 사이",
      channel: "위챗",
      internalPdr: "P: 내가 낮음 / D: 지인 / R: 중간",
    },
    sourceText: "선배, 지난주 회의록 좀 공유해주실 수 있을까요?",
    candidate: "学长，上周的会议记录能发我一下吗？",
    truth: "ok",
    feedback:
      "호칭 + '能…吗'로 선택권을 열었습니다. 중간 부담에는 이 정도가 무리 없습니다.",
    reasons: [
      { key: "power", label: "상대가 윗사람인데 존대가 부족하다", correct: false },
      { key: "burden", label: "부담에 비해 표현이 과하다", correct: false },
      { key: "fit", label: "관계와 부담에 맞는 완화가 들어 있다", correct: true },
      { key: "meaning", label: "원문의 의미가 달라졌다", correct: false },
    ],
  },
  {
    id: "mpj-6",
    variant: "multiUtterance",
    situation: {
      headline: "팀 프로젝트 조원에게 자료 정리를 맡아달라고 합니다.",
      relation: "같은 조 조원 · 이번 학기에 처음 같은 조",
      channel: "위챗",
      internalPdr: "P: 동등 / D: 지인 / R: 중간",
    },
    sourceText: "이번 자료 정리는 네가 맡아줄 수 있어? 내가 발표 준비를 해야 해서.",
    borderline: true,
    candidates: [
      { zh: "资料整理你来做。", truth: "under", note: "통보에 가깝고 이유가 없습니다." },
      { zh: "我需要你整理资料。", truth: "under", note: "'내가 필요하다'는 요청이 아니라 요구로 들립니다." },
      {
        zh: "这次资料整理你能帮忙吗？我要准备发表。",
        truth: "ok",
        note: "'帮忙' + 이유. 동등한 사이의 기본형입니다.",
      },
      {
        zh: "如果方便的话，这次的资料整理能不能麻烦你？我这边要准备发表。",
        truth: "ok",
        note: "선택권 + 부담 인정. 조금 더 정중하지만 과하지 않습니다.",
      },
      {
        zh: "非常抱歉打扰，恳请您承担本次资料整理工作，不胜感激。",
        truth: "over",
        note: "조원 사이에 공문투 — 거리가 생깁니다.",
      },
    ],
  },
];

// ── ② 적용 — MPJ에서 보지 않은 새 상황 ──────────────────────
// 같은 화행·같은 목표 화용 요소·비슷한 난이도. 참고 표현은 노출하지 않는다.

export const PRODUCTION_TASK = {
  situation: {
    headline: "인턴십 담당자에게 면접 일정 조정을 요청하는 이메일을 씁니다.",
    relation: "인턴십 담당자 · 아직 만난 적 없음",
    channel: "이메일",
    internalPdr: "P: 내가 낮음 / D: 초면 / R: 중간~높음",
  },
  sourceText:
    "안녕하세요. 다음 주 화요일 면접에 참석하기 어려울 것 같습니다. 같은 주 다른 날로 조정이 가능할지 여쭙고 싶습니다. 불편을 드려 죄송합니다.",
};

// ── ③ 피드백 — 세 영역만 ────────────────────────────────────
// ⚠️ 프로토타입에서는 학습자 답과 무관한 고정 예시다. 화면에 그렇게 표시한다.

export type FidelityStatus = "pass" | "warning" | "fail";

export const MOCK_FEEDBACK = {
  meaning: {
    status: "pass" as FidelityStatus,
    text: "일정 조정 요청과 사과가 모두 전달되었습니다. 원문의 '같은 주 다른 날'이라는 조건도 유지됐습니다.",
  },
  feature: {
    text: "완화 장치가 한 겹 들어갔습니다. 초면이고 상대가 결정권을 가진 상황이라, 조정을 요청하는 부분에 선택권을 여는 표현을 하나 더 얹으면 더 부드러워집니다.",
  },
  alternatives: [
    {
      zh: "不知道能否将面试改到同一周的其他时间？",
      note: "'不知道能否'로 판단을 상대에게 넘깁니다.",
    },
    {
      zh: "如果方便的话，可以调整到同一周的其他日期吗？",
      note: "조건절로 거절할 여지를 남깁니다.",
    },
  ],
};

/** ④ 수정 범위 — 피드백 결과에 따라 달라진다 (고정 '한 곳 수정' 폐기) */
export const REVISION_SCOPE: Record<
  "fail" | "warning" | "featureGap" | "clear",
  { label: string; guide: string }
> = {
  fail: {
    label: "전체 다시 쓰기",
    guide: "원문의 의미가 바뀌었습니다. 처음부터 다시 옮겨 보세요.",
  },
  warning: {
    label: "빠진 구간 수정",
    guide: "원문에 있던 내용이 일부 빠졌습니다. 그 부분을 채워 보세요.",
  },
  featureGap: {
    label: "목표 표현 중심 수정",
    guide: "의미는 잘 전달됐습니다. 이번 주 목표인 완화 표현만 손봐 보세요.",
  },
  clear: {
    label: "선택적 미세 조정",
    guide: "의미도 화용도 무리가 없습니다. 손대고 싶은 곳이 없으면 그대로 마쳐도 됩니다.",
  },
};

export const CLOSING_LINE =
  "이번 미션의 핵심 — 부담이 있는 요청에서는 핵심 요청 앞에 짧은 포석을, 뒤에 선택할 여지를 함께 두면 상대가 편하게 받습니다.";
