// mission_v4 개발 미리보기 전용 샘플.
// 원격 DB·Edge 배포 없이 승인된 MPJ4+DCT 화면 흐름을 확인하는 데만 사용한다.
// import.meta.env.DEV로 보호된 ?preview=v4 경로에서만 선택된다.

import type { MissionV4 } from "@/lib/pragma/missionSchema";

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
      relation_ko: "친한 프로젝트 동료 사이 · 낮은 부담",
      pdr: {
        p: "equal",
        d: "close",
        r: "low",
      },
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
        "상대는 거래처의 일정 조정 권한을 가진 담당자이고, 나는 실무 지원을 맡고 있다. 몇 차례 연락했지만 친하지 않으며, 회의를 하루 앞당기면 상대가 내부 일정을 다시 맞춰야 한다.",
      relation_ko: "실무 지원자 → 거래처 일정 담당자 · 몇 차례 연락한 사이",
      pdr: ANCHOR_PDR,
      source: "회의를 하루 앞당길 수 있을까요?",
      target: "把会议提前一天。",
      highlights: ["把会议提前一天"],
      accepted_band_codes: ["too_direct"],
      corrections: [
        {
          text: "请问会议方便提前一天吗？",
          is_valid: true,
          note_ko: "가능 여부를 물어 상대의 선택권을 남깁니다.",
        },
        {
          text: "如果您那边方便，会议可以提前一天吗？",
          is_valid: true,
          note_ko: "조건절로 상대의 일정 부담을 인정합니다.",
        },
        {
          text: "请务必把会议提前一天。",
          is_valid: false,
          note_ko: "요청 의도는 유지하지만 ‘务必’가 강제성을 더합니다.",
        },
        {
          text: "不知道是否有那么一点可能考虑一下把会议提前一天呢？",
          is_valid: false,
          note_ko: "완화를 과도하게 겹쳐 요청의 초점이 흐려집니다.",
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
        "상대는 거래처 결제일을 조정할 권한이 있고, 나는 계약 실무를 보조하고 있다. 업무 연락만 몇 차례 한 사이에서 결제일을 미루면 상대가 회계팀 승인을 다시 받아야 한다.",
      relation_ko: "계약 실무 보조자 → 거래처 결제 담당자 · 업무상 아는 사이",
      pdr: ANCHOR_PDR,
      source: "결제일을 사흘 미뤄 주실 수 있을까요?",
      target: "你必须把付款日期推迟三天。",
      highlights: ["必须"],
      problem_band_code: "too_direct",
      reasons: [
        {
          id: "r1",
          text_ko: "‘必须’가 상대의 조정 권한과 선택권을 사실상 없애기 때문이다.",
          kind: "primary",
        },
        {
          id: "r2",
          text_ko: "업무 요청은 관계와 부담에 상관없이 항상 길게 말해야 하기 때문이다.",
          kind: "pragmatic_misconception",
        },
        {
          id: "r3",
          text_ko: "중국어에서는 결제일 뒤에 기간 표현을 쓸 수 없기 때문이다.",
          kind: "meaning_grammar_context",
        },
      ],
      accepted_reason_id: "r1",
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
        "거래처 창고는 오늘 출고를 이미 마감했고, 추가 발송에는 물류 일정을 다시 열어야 한다. 몇 차례 연락했지만 친하지 않은 담당자에게 샘플 한 개를 오늘 안에 더 보내 달라고 부탁한다.",
      relation_ko: "실무 지원자 → 거래처 물류 담당자 · 몇 차례 연락한 사이",
      pdr: {
        p: "speaker_lower",
        d: "acquaintance",
        r: "high",
      },
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
          text: "不知道您是否也许能考虑一下，方便的时候看看今天有没有可能再寄一个样品呢？",
          accepted_band_codes: ["too_indirect"],
          note_ko: "완화가 지나치게 겹쳐 오늘 발송이라는 핵심 요청이 흐려집니다.",
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
      "상대는 거래처의 배송지 변경 권한을 가진 담당자이고, 나는 주문 실무를 보조하고 있다. 몇 차례 연락했지만 친하지 않으며, 배송지를 바꾸면 상대가 운송장을 다시 발급해야 한다.",
    relation_ko: "주문 실무 보조자 → 거래처 배송 담당자 · 업무상 아는 사이",
    pdr: ANCHOR_PDR,
    source_text: "이번 주문의 배송지를 저희 새 사무실로 바꿔 주실 수 있을까요?",
    preceding_turn: null,
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
    prompt_version: "mission_v4_mpj4_dct1",
    mission_content_hash: "local-preview-not-stored",
    generated_at: "2026-07-29T01:25:00+09:00",
    generation_attempt: 1,
  },
};
