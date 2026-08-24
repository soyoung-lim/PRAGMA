// mission_v4 개발 미리보기 전용 샘플.
// 원격 DB·Edge 배포 없이 승인된 MPJ4+DCT 화면 흐름을 확인하는 데만 사용한다.
// import.meta.env.DEV로 보호된 ?preview=v4 경로에서만 선택된다.

import type { MissionV4, MissionV5Legacy, MissionV5Native } from "@/lib/pragma/missionSchema";

const ANCHOR_PDR = {
  p: "speaker_lower",
  d: "acquaintance",
  r: "mid",
} as const;

export const SAMPLE_MISSION_V4: MissionV4 = {
  schema_version: "mission_v4",
  direction: "ko_zh",
  unit: {
    target_feature: "request_mitigation_optionality",
    target_feature_version: "1.0",
    learner_label: "완화와 선택권",
    closing_ko:
      "요청은 상대에게 거절할 여지를 얼마나 남기느냐로 무게가 정해집니다. 친밀·저부담이면 직접형도 알맞고, 초면·고부담이면 선택권을 남기는 표현이 어울립니다.",
  },
  mpj_items: [
    {
      id: 1,
      type: "scale4",
      axis_feature: "request_mitigation_optionality",
      channel: "messenger",
      situation_ko:
        "나는 같은 프로젝트를 오래 함께한 친한 동료에게 메신저를 보내고 있다. 상대가 이미 정리해 둔 최신 파일 하나를 공유해 달라는 가벼운 부탁이다.",
      relation_ko: "친한 프로젝트 동료 · 오래 함께한 사이",
      pdr: {
        p: "equal",
        d: "close",
        r: "low",
      },
      preceding_turn: "我已经把最新的文件整理好了。",
      source: "업데이트된 파일 좀 보내 줘.",
      target: "把更新后的文件发我一下。",
      highlights: ["发我一下"],
      accepted_scale_codes: ["very_appropriate", "somewhat_appropriate"],
      reference_scale_code: "somewhat_appropriate",
      explanation_ko:
        "친한 동료에게 이미 준비된 파일을 부탁하는 낮은 부담의 상황이라, 간결한 직접형도 충분히 자연스럽습니다.",
      recommended_example: "把更新后的文件发我一下。",
    },
    {
      id: 2,
      type: "fix_choice",
      axis_feature: "request_mitigation_optionality",
      channel: "messenger",
      situation_ko:
        "나는 거래처 일정 담당자에게 다음 주 수요일로 잡힌 회의를 하루 앞당길 수 있는지 물으려 한다. 몇 차례 연락했지만 아직 친하지 않고, 변경하려면 상대는 내부 일정을 다시 맞춰야 한다.",
      relation_ko: "거래처 일정 담당자 · 몇 차례 연락한 사이",
      pdr: ANCHOR_PDR,
      // 하루 앞당기면 오늘이 되는 일정이면 요청 자체가 성립하지 않는다. 변경 전 일정을
      // 다음 주 수요일로 두어 앞당긴 결과(화요일)가 논리적으로 성립하게 한다.
      preceding_turn: "原定下周三的会议时间，我已经跟内部团队确认好了。",
      source: "회의를 하루 앞당길 수 있을까요?",
      target: "把会议提前一天。",
      highlights: ["把会议提前一天"],
      accepted_band_codes: ["too_direct"],
      // 네 후보 모두 같은 명제(회의를 하루 앞당김)와 같은 요청 의도를 유지하고,
      // 직접성·완화·선택권 정도만 다르다. 务必 같은 노골적 오답 표지를 쓰지 않고
      // 길이도 11~20자로 붙여, 문법·길이·과장성만으로는 소거할 수 없게 한다.
      corrections: [
        {
          text: "请问会议方便提前一天吗？",
          is_valid: true,
          note_ko: "가능한지 먼저 물어, 상대가 내부 일정을 조정할 수 있는지 답할 자리를 남깁니다.",
        },
        {
          text: "如果您那边方便，会议可以提前一天吗？",
          is_valid: true,
          note_ko: "조건절로 상대의 일정 부담을 먼저 인정하고 요청을 꺼냅니다.",
        },
        {
          text: "会议提前一天吧，麻烦您安排一下。",
          is_valid: false,
          note_ko: "부탁하는 말투지만 변경을 이미 정해진 일로 두어, 상대가 가능한지 답할 자리가 없습니다.",
        },
        {
          text: "会议提前一天的事，您有空的时候再看看就行。",
          is_valid: false,
          note_ko: "요청은 전하지만 언제 답해야 하는지가 열려 있어, 일정을 다시 맞춰야 하는 상대가 무엇을 결정할지 알기 어렵습니다.",
        },
      ],
      explanation_ko:
        "상대가 일정 조정 권한을 갖고 있고 변경 부담도 있으므로, 명령형보다 가능 여부를 묻는 두 수정안이 이 관계에 더 알맞습니다.",
      recommended_example: "请问会议方便提前一天吗？",
    },
    {
      id: 3,
      type: "reason",
      axis_feature: "request_mitigation_optionality",
      channel: "messenger",
      situation_ko:
        "나는 거래처 결제 담당자에게 결제일을 사흘 미룰 수 있는지 물으려 한다. 업무 연락만 몇 차례 한 사이이고, 변경하려면 상대는 회계팀 승인을 다시 받아야 한다.",
      relation_ko: "거래처 결제 담당자 · 업무상 아는 사이",
      pdr: ANCHOR_PDR,
      preceding_turn: "付款日期已经按原计划录入系统了。",
      source: "결제일을 사흘 미뤄 주실 수 있을까요?",
      target: "你必须把付款日期推迟三天。",
      highlights: ["必须"],
      problem_band_code: "too_direct",
      reasons: [
        {
          id: "r1",
          text_ko: "호칭 ‘你’가 업무상 아는 사이인 상대와의 거리를 충분히 표시하지 못했기 때문이다.",
          kind: "pragmatic_misconception",
        },
        {
          id: "r2",
          text_ko: "‘必须’가 상대의 조정 권한과 선택권을 사실상 없애기 때문이다.",
          kind: "primary",
        },
        {
          id: "r3",
          text_ko: "변경 기간을 ‘사흘’로 구체적으로 밝혀 상대가 조정 범위를 선택하기 어렵기 때문이다.",
          kind: "meaning_grammar_context",
        },
      ],
      accepted_reason_id: "r2",
      explanation_ko:
        "문법이나 길이보다 핵심 문제는 강제 표현 ‘必须’가 이 관계에서 상대의 선택권을 지운다는 점입니다.",
      recommended_example: "请问付款日期可以推迟三天吗？",
    },
    {
      id: 4,
      type: "multi_judge",
      axis_feature: "request_mitigation_optionality",
      channel: "messenger",
      situation_ko:
        "나는 오늘 출고를 이미 마감한 거래처 담당자에게 샘플 하나를 더 보내 달라고 부탁하려 한다. 몇 차례 연락했지만 친하지 않고, 추가 발송을 위해 상대는 물류 일정을 다시 열어야 한다.",
      relation_ko: "거래처 물류 담당자 · 몇 차례 연락한 사이",
      pdr: {
        p: "speaker_lower",
        d: "acquaintance",
        r: "high",
      },
      preceding_turn: "我们今天已经截止出货了，现在再加可能有点困难。",
      source: "샘플을 오늘 안으로 하나 더 보내 주실 수 있을까요?",
      candidates: [
        {
          text: "今天再发一个样品。",
          accepted_band_codes: ["too_direct"],
          note_ko: "마감 후 일정을 다시 열어야 하는 큰 부담에 비해 선택권이 없습니다.",
        },
        {
          text: "如果方便的话，能否请您今天再寄一个样品？",
          accepted_band_codes: ["within_band"],
          note_ko: "상대의 가능 여부를 확인하면서 요청 목적을 분명히 전합니다.",
        },
        {
          text: "麻烦您看看今天是否可以再安排寄一个样品？",
          accepted_band_codes: ["within_band"],
          note_ko: "일정 확인의 여지를 남기는 다른 적절한 전략입니다.",
        },
        {
          // 33자짜리 과잉 완화문은 길이만으로 소거됐다. 명제는 그대로 두고 응답 기대만
          // 열어 두는 형태로 바꿔 다른 후보와 길이대(10~21자)를 맞춘다.
          text: "今天再寄一个样品的事，您方便的时候再回复也行。",
          accepted_band_codes: ["too_indirect"],
          note_ko: "요청은 전하지만 언제 답할지를 열어 두어, 오늘 안에 처리해야 한다는 점이 흐려집니다.",
        },
        {
          text: "今天还能再寄一个样品吗？",
          accepted_band_codes: ["too_direct"],
          note_ko: "가능 여부는 묻지만 이미 마감한 일정을 다시 여는 부담을 거의 고려하지 않습니다.",
        },
      ],
      explanation_ko:
        "같은 요청 의미라도 큰 부담에서는 명령형이 과소하고, 완화를 겹겹이 쌓은 표현은 과잉입니다. 가운데 두 안처럼 선택권과 명료성을 함께 유지할 수 있습니다.",
      recommended_example: "如果方便的话，能否请您今天再寄一个样品？",
    },
  ],
  production_task: {
    mode: "translation",
    source_modality: "written",
    channel: "messenger",
    situation_ko:
      "나는 거래처 배송 담당자에게 이번 주문의 배송지를 새 사무실로 바꿀 수 있는지 물으려 한다. 몇 차례 연락했지만 아직 친하지 않고, 변경하려면 상대는 운송장을 다시 발급해야 한다.",
    relation_ko: "거래처 배송 담당자 · 업무상 아는 사이",
    pdr: ANCHOR_PDR,
    source_text: "이번 주문의 배송지를 저희 새 사무실로 바꿔 주실 수 있을까요?",
    preceding_turn: "这次订单还是寄到原来的地址，对吗？",
    vocabulary_hints: [
      { source: "배송지", target: "收货地址" },
      { source: "새 사무실", target: "新办公室" },
    ],
    reference_alternatives: [
      {
        text: "请问这次订单的收货地址方便改成我们的新办公室吗？",
        note_ko: "가능 여부를 물어 선택권을 남깁니다.",
      },
      {
        text: "如果您那边方便，可以把这次订单的收货地址改到我们的新办公室吗？",
        note_ko: "상대의 처리 부담을 조건절로 인정합니다.",
      },
    ],
  },
  provenance: {
    model: "local-preview",
    prompt_version: "mission_v4_mpj4_dct1_context_v3",
    mission_content_hash: "local-preview-not-stored",
    generated_at: "2026-07-29T01:25:00+09:00",
    generation_attempt: 1,
  },
};

// ── mission_v5 미리보기 샘플 — 미니 담화형 DCT (DEC-20260730-01) ──────────
// MPJ 4문항은 v4 샘플을 그대로 재사용한다(구성 불변). DCT 원문만 2~4문장
// 담화로 바꾸고 화용 집중 구간을 지정한다. ?preview=v5 경로 전용.
const V5_SOURCE_TEXT =
  "지난번 주문은 잘 받았습니다. 그런데 이번 주부터 사무실을 옮기게 되어서요. 가능하시다면 이번 주문의 배송지를 새 사무실로 바꿔 주실 수 있을까요? 번거롭게 해드려 죄송합니다.";

export const SAMPLE_MISSION_V5: MissionV5Legacy = {
  ...SAMPLE_MISSION_V4,
  schema_version: "mission_v5",
  production_task: {
    ...SAMPLE_MISSION_V4.production_task,
    source_text: V5_SOURCE_TEXT,
    focal_segments: [
      {
        text: "가능하시다면 이번 주문의 배송지를 새 사무실로 바꿔 주실 수 있을까요?",
        role: "head",
      },
      { text: "번거롭게 해드려 죄송합니다.", role: "support" },
    ],
    // 참고 산출안은 담화 **전체**를 옮긴 완성안이어야 한다(R29). v4의 한 문장짜리를
    // 상속하면 데모 채우기·참고 표현이 "요청문만 옮기면 된다"고 거짓 안내한다
    // (2026-07-30 실화면에서 발견).
    reference_alternatives: [
      {
        text: "上次的订单已经收到了，谢谢。不过我们这周开始要搬办公室，如果方便的话，这次订单的收货地址能改成我们的新办公室吗？麻烦您了，实在不好意思。",
        note_ko: "가능 여부를 물어 선택권을 남기고, 앞뒤의 감사·상황 설명·사과까지 함께 옮깁니다.",
      },
      {
        text: "上次的订单我们已经顺利收到了。因为这周要搬到新办公室，想请您帮忙把这次订单的收货地址改一下，不知道方便吗？给您添麻烦了。",
        note_ko: "이유를 먼저 밝히고 부탁으로 넘어가는 순서로 부담을 낮춥니다.",
      },
    ],
  },
  provenance: {
    ...SAMPLE_MISSION_V4.provenance!,
    prompt_version: "mission_v5_mpj4_minidiscourse_v1",
  },
};

const V5_SCALE = SAMPLE_MISSION_V5.mpj_items[0] as Extract<
  MissionV5Legacy["mpj_items"][number],
  { type?: "scale4" }
>;
const V5_FIX = SAMPLE_MISSION_V5.mpj_items[1] as Extract<
  MissionV5Legacy["mpj_items"][number],
  { type?: "fix_choice" }
>;
const V5_REASON = SAMPLE_MISSION_V5.mpj_items[2] as Extract<
  MissionV5Legacy["mpj_items"][number],
  { type?: "reason" }
>;
const V5_MULTI = SAMPLE_MISSION_V5.mpj_items[3] as Extract<
  MissionV5Legacy["mpj_items"][number],
  { type?: "multi_judge" }
>;

/** 현행 생성 계약과 같은 독립 맥락 대비 문항을 가진 네이티브 MPJ5 샘플. */
export const SAMPLE_MISSION_V5_NATIVE: MissionV5Native = {
  ...SAMPLE_MISSION_V5,
  diagnostic_dimensions: [
    {
      code: "force_calibration",
      evidence_refs: ["mpj:2", "mpj:3", "mpj:4", "mpj:5"],
      evidence_ko: "직접성 강도가 관계와 부담에 맞는지 여러 판단 형식에서 확인한다.",
    },
    {
      code: "relational_calibration",
      evidence_refs: ["mpj:1", "mpj:2", "dct"],
      evidence_ko: "관계와 접촉 이력에 따라 같은 요청 전략의 적절성이 달라진다.",
    },
    {
      code: "burden_optionality",
      evidence_refs: ["mpj:2", "dct"],
      evidence_ko: "자료를 다시 찾아야 하는 부담과 상대의 선택 가능성을 함께 조절한다.",
    },
  ],
  mpj_items: [
    { ...V5_SCALE, id: 1, preceding_turn: null },
    {
      id: 2,
      type: "judge3",
      axis_feature: "request_mitigation_optionality",
      channel: "messenger",
      situation_ko:
        "나는 거래처 자료 담당자에게 이미 마감한 보고서의 원본 파일을 다시 보내 달라고 요청하려 한다. 몇 차례 업무 연락만 한 사이이고, 상대는 보관 자료를 다시 찾아야 한다.",
      relation_ko: "거래처 자료 담당자 · 몇 차례 연락한 사이",
      pdr: ANCHOR_PDR,
      preceding_turn: null,
      source: "보고서 원본 파일을 다시 보내 주세요.",
      target: "把报告的原文件再发给我。",
      highlights: ["发给我"],
      accepted_band_codes: ["too_direct"],
      explanation_ko:
        "상대가 보관 자료를 다시 찾아야 하는 상황에서는 가능 여부를 묻지 않은 직접형이 부담에 비해 강하게 들릴 수 있습니다.",
      recommended_example: "请问方便把报告的原文件再发给我吗？",
    },
    { ...V5_FIX, id: 3, preceding_turn: null },
    { ...V5_REASON, id: 4, preceding_turn: null },
    {
      ...V5_MULTI,
      id: 5,
      preceding_turn: null,
      candidates: [
        { ...V5_MULTI.candidates[0], comparison_role: "worst" },
        { ...V5_MULTI.candidates[1], comparison_role: "best" },
        { ...V5_MULTI.candidates[2], comparison_role: "middle" },
        { ...V5_MULTI.candidates[3], comparison_role: "middle" },
      ],
    },
  ],
  provenance: {
    ...SAMPLE_MISSION_V5.provenance!,
    prompt_version: "mission_v5_mpj5_minidiscourse_v3_streamlined",
    content_release_id: "pragma_content_candidate_20260824_02",
  },
};
