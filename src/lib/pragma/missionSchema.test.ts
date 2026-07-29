import { describe, expect, it } from "vitest";

import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";
import { normalizeMission } from "@/lib/pragma/missionSchema";
import { checkMission, type CheckContext } from "@/lib/pragma/missionRules";

const context: CheckContext = {
  speech_act: "request",
  level: "intermediate",
  domain: "work",
  theme_code: "career_workplace",
  topic_code: "schedule_change",
  mode: "translation",
  source_modality: "written",
};

const provenance = {
  model: "gpt-4.1",
  prompt_version: "mission_v3_mpj4",
  mission_content_hash: "mission-v3-test",
  generated_at: "2026-07-28T07:30:00Z",
  generation_attempt: 1,
};

function missionV3() {
  const legacy = normalizeMission(SAMPLE_MISSION_V1).data!;
  return {
    ...legacy,
    schema_version: "mission_v3" as const,
    mpj_items: legacy.mpj_items.slice(0, 4),
    provenance,
  };
}

describe("mission_v3 MPJ4 contract", () => {
  it("accepts the four-item order and keeps legacy MPJ5 readable", () => {
    const current = normalizeMission(missionV3());
    expect(current.ok).toBe(true);
    expect(current.data?.schema_version).toBe("mission_v3");
    expect(current.data?.mpj_items.map((item) => item.type)).toEqual([
      "scale4",
      "judge3",
      "fix_choice",
      "reason_conf",
    ]);

    const legacy = normalizeMission(SAMPLE_MISSION_V1);
    expect(legacy.ok).toBe(true);
    expect(legacy.data?.schema_version).toBe("mission_v2");
    expect(legacy.data?.mpj_items).toHaveLength(5);
    expect(legacy.data?.mpj_items[4].type).toBe("multi_judge");
  });

  it("rejects multi_judge and a fifth item in mission_v3", () => {
    const base = normalizeMission(SAMPLE_MISSION_V1).data!;
    expect(
      normalizeMission({
        ...missionV3(),
        mpj_items: [
          ...base.mpj_items.slice(0, 3),
          base.mpj_items[4],
        ],
      }).ok,
    ).toBe(false);
    expect(
      normalizeMission({
        ...missionV3(),
        mpj_items: base.mpj_items,
      }).ok,
    ).toBe(false);
  });

  it("applies the new R1 order without weakening legacy checks", () => {
    const valid = checkMission(missionV3(), context);
    expect(
      valid.violations.filter((item) => item.id === "R1" && item.level === "fail"),
    ).toEqual([]);

    const current = missionV3();
    const invalid = checkMission(
      {
        ...current,
        mpj_items: [
          current.mpj_items[1],
          current.mpj_items[0],
          current.mpj_items[2],
          current.mpj_items[3],
        ],
      },
      context,
    );
    expect(
      invalid.violations.some((item) => item.id === "R1" && item.level === "fail"),
    ).toBe(true);
  });
});

const provenanceV4 = {
  ...provenance,
  prompt_version: "mission_v4_mpj3_dct1",
  mission_content_hash: "mission-v4-test",
  generated_at: "2026-07-29T00:30:00Z",
};

function missionV4() {
  const legacy = normalizeMission(SAMPLE_MISSION_V1).data!;
  const fix = legacy.mpj_items[2];
  const oldReason = legacy.mpj_items[3];
  const oldMulti = legacy.mpj_items[4];
  if (fix.type !== "fix_choice" || oldReason.type !== "reason_conf" || oldMulti.type !== "multi_judge") {
    throw new Error("legacy fixture order changed");
  }
  const anchorPdr = legacy.production_task.pdr;
  return {
    ...legacy,
    schema_version: "mission_v4" as const,
    unit: {
      ...legacy.unit,
      closing_ko:
        "요청은 상대에게 거절할 여지를 얼마나 남기느냐로 무게가 정해집니다. 친밀·저부담이면 직접형도 알맞고, 초면·고부담이면 선택권을 남기는 표현이 어울립니다.",
    },
    mpj_items: [
      {
        ...fix,
        id: 1,
        channel: "messenger" as const,
        pdr: anchorPdr,
        situation_ko:
          "거래처 담당자는 일정 변경을 내부 팀과 다시 조율해야 한다. 몇 차례 연락했지만 아직 친하지 않은 상대에게 메신저로 변경을 부탁한다.",
      },
      {
        id: 2,
        type: "reason" as const,
        axis_feature: oldReason.axis_feature,
        channel: "messenger" as const,
        situation_ko:
          "거래처 담당자는 결제일을 바꾸려면 회계팀 승인을 다시 받아야 한다. 몇 차례 업무 연락만 한 상대에게 메신저로 연기를 부탁한다.",
        relation_ko: oldReason.relation_ko,
        pdr: anchorPdr,
        source: oldReason.source,
        preceding_turn: oldReason.preceding_turn,
        target: oldReason.target,
        highlights: oldReason.highlights,
        problem_band_code: "too_direct",
        reasons: [
          { id: "r1", text_ko: "'必须'가 상대의 선택권을 없애는 것이 가장 큰 문제다.", kind: "primary" as const },
          { id: "r2", text_ko: "업무 요청은 언제나 길게 말해야 하기 때문이다.", kind: "pragmatic_misconception" as const },
          { id: "r3", text_ko: "중국어 문법상 동사를 쓸 수 없기 때문이다.", kind: "meaning_grammar_context" as const },
        ],
        accepted_reason_id: "r1",
        explanation_ko: oldReason.explanation_ko,
        recommended_example: oldReason.recommended_example,
      },
      {
        ...oldMulti,
        id: 3,
        channel: "messenger" as const,
        pdr: { ...anchorPdr, r: "high" as const },
        situation_ko:
          "추가 샘플 발송은 상대가 물류 일정을 전면 재조정해야 하는 큰 부탁이다. 몇 차례 연락했지만 친하지 않은 거래처 담당자에게 메신저로 요청한다.",
        candidates: oldMulti.candidates.slice(0, 4),
      },
    ],
    provenance: provenanceV4,
  };
}

describe("mission_v4 MPJ3 + DCT contract", () => {
  it("accepts Judge3+FixChoice → Reason → MultiJudge and preserves older versions", () => {
    const parsed = normalizeMission(missionV4());
    expect(parsed.ok).toBe(true);
    expect(parsed.data?.schema_version).toBe("mission_v4");
    expect(parsed.data?.mpj_items.map((item) => item.type)).toEqual([
      "fix_choice",
      "reason",
      "multi_judge",
    ]);

    expect(normalizeMission(missionV3()).ok).toBe(true);
    expect(normalizeMission(SAMPLE_MISSION_V1).ok).toBe(true);
  });

  it("passes deterministic v4 structure rules", () => {
    const checked = checkMission(missionV4(), context);
    expect(checked.violations.filter((item) => item.level === "fail")).toEqual([]);
  });

  it("rejects repeated Judge3/ReasonConf and five-candidate MultiJudge", () => {
    const current = missionV4();
    const legacy = normalizeMission(SAMPLE_MISSION_V1).data!;
    expect(
      normalizeMission({
        ...current,
        mpj_items: [current.mpj_items[0], legacy.mpj_items[3], current.mpj_items[2]],
      }).ok,
    ).toBe(false);
    expect(
      normalizeMission({
        ...current,
        mpj_items: [
          current.mpj_items[0],
          current.mpj_items[1],
          { ...current.mpj_items[2], candidates: legacy.mpj_items[4].type === "multi_judge" ? legacy.mpj_items[4].candidates : [] },
        ],
      }).ok,
    ).toBe(false);
  });

  it("fails ambiguous primary reasons and an uncontrolled PDR contrast", () => {
    const current = missionV4();
    const bad = {
      ...current,
      mpj_items: [
        current.mpj_items[0],
        {
          ...current.mpj_items[1],
          reasons: current.mpj_items[1].type === "reason"
            ? current.mpj_items[1].reasons.map((reason) => ({ ...reason, kind: "primary" as const }))
            : [],
        },
        {
          ...current.mpj_items[2],
          pdr: { p: "speaker_higher", d: "close", r: "high" },
        },
      ],
    };
    const checked = checkMission(bad, context);
    expect(checked.violations.some((item) => item.id === "R4" && item.level === "fail")).toBe(true);
    expect(checked.violations.some((item) => item.id === "R5" && item.level === "fail")).toBe(true);
  });
});
