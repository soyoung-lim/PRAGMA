// mission_v1 유효 샘플 (DEV 렌더링·검증 전용).
//
// DB에 승격·검토된 미션이 아직 없으므로, 렌더러를 이 샘플로 검증한다.
// 중국어 예문은 원어민 검토 전 초안(화면에 프로토타입 배지로 명시).
// 구조는 missionSchema.ts의 MissionV1과 정확히 일치해야 한다(parseMission 통과).
//
// 초점 = request_mitigation_optionality (band: too_direct | within_band | too_indirect).

import type { MissionV1 } from "@/lib/pragma/missionSchema";

const COMMON = {
  axis_feature: "request_mitigation_optionality",
  relation_ko: "거래처 담당자 — 몇 번 연락했지만 친밀하지는 않은 사이",
  channel: "messenger" as const,
  pdr: { p: "speaker_lower" as const, d: "acquaintance" as const, r: "mid" as const },
};

export const SAMPLE_MISSION_V1: MissionV1 = {
  schema_version: "mission_v1",
  unit: {
    target_feature: "request_mitigation_optionality",
    target_feature_version: "1.0",
    learner_label: "완화와 선택권",
    closing_ko: "요청은 상대에게 거절할 여지를 남길 때 더 잘 받아들여집니다.",
  },
  mpj_items: [
    {
      ...COMMON,
      id: 1,
      type: "scale4",
      situation_ko: "거래처 담당자에게 회의 일정을 앞당겨 달라고 부탁하려 한다.",
      source_ko: "회의를 하루 앞당길 수 있을까요?",
      target_zh: "把会议提前一天。",
      highlights_zh: ["把会议提前一天"],
      accepted_scale_codes: ["somewhat_inappropriate"],
      explanation_ko:
        "명령형 '把…提前'은 상대에게 선택할 여지를 거의 남기지 않아 이 관계에서는 다소 부적절합니다.",
      recommended_example_zh: "请问会议方便提前一天吗？",
    },
    {
      ...COMMON,
      id: 2,
      type: "judge3",
      situation_ko: "거래처 담당자에게 자료를 다시 보내 달라고 부탁한다.",
      source_ko: "자료를 다시 보내 주실 수 있을까요?",
      target_zh: "麻烦您方便的话再发一下资料，好吗？",
      highlights_zh: ["麻烦您", "方便的话", "好吗"],
      accepted_band_codes: ["within_band"],
      explanation_ko:
        "완화 표지(麻烦您·方便的话)와 선택권을 남기는 종결(好吗)이 균형 있게 쓰여 이 상황에 알맞습니다.",
      recommended_example_zh: "麻烦您方便的话再发一下资料，好吗？",
    },
    {
      ...COMMON,
      id: 3,
      type: "fix_choice",
      situation_ko: "거래처 담당자에게 견적서 수정을 부탁한다.",
      source_ko: "견적서를 좀 수정해 주세요.",
      target_zh: "你改一下报价单。",
      highlights_zh: ["你改一下"],
      accepted_band_codes: ["too_direct"],
      corrections: [
        { zh: "麻烦您改一下报价单，可以吗？", is_valid: true, note_ko: "완화 표지와 선택권 종결을 더해 부담을 낮춤." },
        { zh: "能不能麻烦您帮忙修改一下报价单？", is_valid: true, note_ko: "능원동사 완화로 거절할 여지를 남김." },
        { zh: "赶紧把报价单改了。", is_valid: false, note_ko: "오히려 더 강한 명령형이라 초점에 어긋남." },
        { zh: "报价单。", is_valid: false, note_ko: "요청이 흐려져 의도가 전달되지 않음." },
      ],
      explanation_ko: "명령형 '你改一下'는 선택권을 남기지 않아 부적절합니다. 완화·선택권을 더한 두 안이 알맞습니다.",
      recommended_example_zh: "麻烦您改一下报价单，可以吗？",
    },
    {
      ...COMMON,
      id: 4,
      type: "reason_conf",
      situation_ko: "거래처 담당자에게 결제일을 미뤄 달라고 부탁한다.",
      source_ko: "결제일을 조금만 미뤄 주실 수 있나요?",
      target_zh: "你必须把付款日期往后推。",
      highlights_zh: ["必须", "往后推"],
      accepted_band_codes: ["too_direct"],
      reasons: [
        { id: "r1", text_ko: "'必须'가 상대에게 선택할 여지를 없앤다." },
        { id: "r2", text_ko: "완화 표지나 선택권을 남기는 종결이 전혀 없다." },
        { id: "r3", text_ko: "문법 오류가 있어서 부적절하다." },
        { id: "r4", text_ko: "표현이 너무 길어서 부적절하다." },
      ],
      accepted_reason_ids: ["r1", "r2"],
      explanation_ko: "'必须'는 강제성을 띠어 거절할 여지를 없앱니다. 이 관계·부담에서는 완화가 필요합니다.",
      recommended_example_zh: "请问付款日期能不能稍微往后推几天？",
    },
    {
      ...COMMON,
      id: 5,
      type: "multi_judge",
      situation_ko: "거래처 담당자에게 샘플을 하나 더 보내 달라고 부탁한다.",
      source_ko: "샘플을 하나만 더 보내 주실 수 있을까요?",
      candidates: [
        { zh: "再发一个样品。", accepted_band_codes: ["too_direct"], note_ko: "명령형이라 선택권이 없다." },
        { zh: "能再麻烦您发一个样品吗？", accepted_band_codes: ["within_band"], note_ko: "완화·선택권이 균형 있다." },
        { zh: "如果方便的话，可以再发一个样品吗？", accepted_band_codes: ["within_band"], note_ko: "조건절 포석으로 여지를 남긴다." },
        { zh: "我在想是不是也许可能麻烦您看看能不能考虑再发一个样品呢？", accepted_band_codes: ["too_indirect"], note_ko: "완화가 과해 요청이 흐려진다." },
        { zh: "把样品再发一个过来。", accepted_band_codes: ["too_direct"], note_ko: "把자문 명령형으로 부담이 크다." },
      ],
      explanation_ko: "완화와 선택권이 균형 잡힌 2·3번이 알맞고, 1·5번은 과소(직접적), 4번은 과잉(우회적)입니다.",
      recommended_example_zh: "能再麻烦您发一个样品吗？",
    },
  ],
  production_task: {
    mode: "translation",
    source_modality: "written",
    situation_ko: "거래처 담당자에게 다음 주 미팅 장소를 변경해 달라고 부탁하는 메시지를 보낸다.",
    relation_ko: "거래처 담당자 — 몇 번 연락했지만 친밀하지는 않은 사이",
    channel: "messenger",
    pdr: { p: "speaker_lower", d: "acquaintance", r: "mid" },
    source_text_ko: "다음 주 미팅 장소를 저희 쪽 근처로 바꿔 주실 수 있을까요?",
    preceding_turn_zh: null,
    reference_alternatives: [
      { zh: "麻烦您看看下周的会议地点方便改到我们这边附近吗？", note_ko: "완화 표지 + 선택권을 남기는 종결." },
      { zh: "如果方便的话，下周会议能不能改到我们公司附近？", note_ko: "조건절 포석으로 거절할 여지를 남김." },
    ],
  },
};
