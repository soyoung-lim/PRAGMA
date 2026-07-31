import type { MyMissionLogEntry } from "@/lib/mission/missionLog";

type PreviewSeed = Pick<
  MyMissionLogEntry,
  "speechAct" | "sourceText" | "firstResponse" | "revisedResponse" | "featureId"
> &
  Partial<
    Pick<
      MyMissionLogEntry,
      | "level"
      | "taskType"
      | "targetLang"
      | "revisionScope"
      | "revisionSource"
      | "pragmaticBandCode"
    >
  >;

const seeds: PreviewSeed[] = [
  {
    speechAct: "request",
    sourceText: "다음 주 미팅 장소를 저희 쪽 근처로 바꿔 주실 수 있을까요?",
    firstResponse: "麻烦您把下周的会议地点改到我们公司附近。",
    revisedResponse: "如果方便的话，下周会议能不能改到我们公司附近？",
    featureId: "request_mitigation_optionality",
    pragmaticBandCode: "too_direct",
  },
  {
    speechAct: "request",
    sourceText: "오늘 중으로 수정본을 보내 주실 수 있나요?",
    firstResponse: "如果方便的话，今天把修改版发给我。",
    revisedResponse: "如果方便的话，今天能不能把修改版发给我？",
    featureId: "request_mitigation_optionality",
    pragmaticBandCode: "within_band",
  },
  {
    speechAct: "refusal",
    sourceText: "이번 주 금요일 회식에 참석하기는 어려울 것 같습니다.",
    firstResponse: "这周五不行。",
    revisedResponse: "不好意思，这周五我有安排，改天再一起吃饭吧。",
    featureId: "refusal_softening",
  },
  {
    speechAct: "request",
    sourceText: "지난 회의 자료를 다시 공유해 주시겠어요?",
    firstResponse: "麻烦您再发一下上次的会议资料。",
    revisedResponse: "麻烦您再发一下上次的会议资料，可以吗？",
    featureId: "request_mitigation_optionality",
    pragmaticBandCode: "too_direct",
  },
  {
    speechAct: "thanks",
    sourceText: "자료를 보내 주셔서 감사합니다.",
    firstResponse: "谢谢您发资料。",
    revisedResponse: "谢谢您发资料。",
    featureId: "gratitude_calibration",
    revisionScope: null,
    revisionSource: "learner_free",
  },
  {
    speechAct: "request",
    sourceText: "잠깐 통화할 수 있을까요?",
    firstResponse: "如果方便的话，现在可以打个电话吗？",
    revisedResponse: "如果您现在方便的话，能不能通个电话？",
    featureId: "request_mitigation_optionality",
    pragmaticBandCode: "within_band",
  },
  {
    speechAct: "apology",
    sourceText: "제가 확인을 놓쳐 답변이 늦었습니다. 죄송합니다.",
    firstResponse: "对不起，回复晚了。",
    revisedResponse: "对不起，是我没有及时确认，让您久等了。",
    featureId: "apology_accountability_repair",
  },
  {
    speechAct: "request",
    sourceText: "배송 일정을 하루 앞당겨 주실 수 있을까요?",
    firstResponse: "麻烦您把发货时间提前一天。",
    revisedResponse: "如果方便的话，发货时间可以提前一天吗？",
    featureId: "request_mitigation_optionality",
    pragmaticBandCode: "too_direct",
  },
  {
    speechAct: "proposal",
    sourceText: "다음 회의는 온라인으로 진행하는 게 어떨까요?",
    firstResponse: "下次会议改成线上。",
    revisedResponse: "要不下次会议改成线上，您看怎么样？",
    featureId: "proposal_optionality_clarity",
  },
  {
    speechAct: "refusal",
    sourceText: "오늘까지 검토를 끝내기는 어렵지만 내일 오전에는 가능합니다.",
    firstResponse: "今天不行。",
    revisedResponse: "不好意思，今天恐怕来不及，明天上午可以完成。",
    featureId: "refusal_softening",
  },
  {
    speechAct: "request",
    sourceText: "계약서의 금액 부분을 한 번 확인해 주세요.",
    firstResponse: "麻烦您确认一下合同里的金额。",
    revisedResponse: "麻烦您确认一下合同里的金额，您看方便吗？",
    featureId: "request_mitigation_optionality",
    pragmaticBandCode: "too_direct",
  },
  {
    speechAct: "complaint",
    sourceText: "같은 배송 지연이 세 번 반복되어 일정에 차질이 생겼습니다.",
    firstResponse: "这个配送不好。",
    revisedResponse: "配送已经连续三次延误，给我们的日程造成了影响，请尽快确认。",
    featureId: "complaint_problem_accountability",
  },
  {
    speechAct: "request",
    sourceText: "회의 시작 시간을 30분 늦출 수 있을까요?",
    firstResponse: "会议能不能晚三十分钟开始？",
    revisedResponse: "如果大家方便的话，会议能不能晚三十分钟开始？",
    featureId: "request_mitigation_optionality",
    pragmaticBandCode: "within_band",
  },
  {
    speechAct: "compliment",
    sourceText: "이번 발표는 사례 구성이 특히 명확했습니다.",
    firstResponse: "你讲得真好。",
    revisedResponse: "你讲得真好。",
    featureId: "compliment_grounding_sensitivity",
    revisionScope: null,
    revisionSource: "learner_free",
  },
  {
    speechAct: "request",
    sourceText: "서명한 문서를 오늘 안에 회신해 주시겠어요?",
    firstResponse: "麻烦您今天回复签好的文件。",
    revisedResponse: "如果方便的话，能不能请您今天回复签好的文件？",
    featureId: "request_mitigation_optionality",
    pragmaticBandCode: "too_direct",
  },
];

/** localhost 화면 검토용. production에서는 LearnerRecords가 이 배열을 사용하지 않는다. */
export const LEARNER_REPORT_PREVIEW_ENTRIES: MyMissionLogEntry[] = seeds.map(
  (seed, index) => {
    const first = seed.firstResponse ?? null;
    const revisedResponse = seed.revisedResponse ?? null;
    const revised = Boolean(
      first && revisedResponse && first !== revisedResponse,
    );

    return {
      id: `report-preview-${index + 1}`,
      createdAtIso: new Date(
        Date.UTC(2026, 6, 31 - index * 7, 6),
      ).toISOString(),
      speechAct: seed.speechAct,
      level: seed.level ?? "intermediate",
      taskType: seed.taskType ?? "translation",
      targetLang: seed.targetLang ?? "zh",
      sourceText: seed.sourceText,
      firstResponse: first,
      revisedResponse,
      revised,
      featureId: seed.featureId,
      featureVersion: "1.0",
      feedbackRubricVersion: "feedback-rubric-v1",
      pragmaticBandCode: seed.pragmaticBandCode ?? null,
      revisionScope:
        seed.revisionScope === undefined
          ? revised
            ? "feature"
            : null
          : seed.revisionScope,
      revisionSource:
        seed.revisionSource ?? (revised ? "system_assigned" : "learner_free"),
    };
  },
);
