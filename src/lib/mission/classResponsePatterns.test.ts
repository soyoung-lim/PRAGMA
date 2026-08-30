import { describe, expect, it } from "vitest";
import {
  aggregateMissionResponses,
  missionPatternFromCounts,
  parseJudgmentEnvelope,
  type ClassResponseLogRow,
} from "./classResponsePatterns";
import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";

const MISSION_ID = "mission-1";

const envelope = (responses: unknown[], dissent = false) => ({
  schema_version: "mpj_response_v2",
  responses,
  learner_dissent: dissent
    ? { kind: "learner_dissent", at: "feedback", conditions: ["p"], reason_ko: "이유", created_at: "2026-08-30T00:00:00Z" }
    : null,
});

const row = (profile: string, judgment: unknown, completedAt = "2026-08-30T10:00:00Z"): ClassResponseLogRow => ({
  mission_id: MISSION_ID,
  profile_id: profile,
  completed_at: completedAt,
  context_judgment: judgment,
});

describe("parseJudgmentEnvelope", () => {
  it("봉투에서 응답 배열과 이견 여부를 꺼낸다", () => {
    const parsed = parseJudgmentEnvelope(envelope([{ item_id: 1, item_type: "scale4" }], true));
    expect(parsed.responses).toHaveLength(1);
    expect(parsed.dissent).toBe(true);
  });

  it("legacy 이견 단독 형태도 이견 1건으로 읽는다", () => {
    const parsed = parseJudgmentEnvelope({ kind: "learner_dissent", at: "feedback", conditions: [], reason_ko: "", created_at: "" });
    expect(parsed.responses).toHaveLength(0);
    expect(parsed.dissent).toBe(true);
  });

  it("null·비객체 입력은 빈 결과로 처리한다", () => {
    expect(parseJudgmentEnvelope(null)).toEqual({ responses: [], dissent: false });
    expect(parseJudgmentEnvelope("oops")).toEqual({ responses: [], dissent: false });
  });

  it("서버 choice count를 같은 문항 라벨과 분포로 복원한다", () => {
    const pattern = missionPatternFromCounts({
      missionId: MISSION_ID,
      learners: 6,
      dissents: 1,
      mission: SAMPLE_MISSION_V5_NATIVE,
      counts: [
        { item_id: 1, item_type: "scale4", axis: "scale", choice_key: "somewhat_appropriate", count: 4 },
        { item_id: 1, item_type: "scale4", axis: "scale", choice_key: "very_inappropriate", count: 2 },
      ],
    });
    expect(pattern.learners).toBe(6);
    expect(pattern.items[0].groups[0].choices).toEqual([
      { key: "somewhat_appropriate", label: "다소 적절", count: 4 },
      { key: "very_inappropriate", label: "매우 부적절", count: 2 },
    ]);
  });

});

describe("aggregateMissionResponses", () => {
  it("문항별 선택 분포를 학습자 수 기준으로 센다", () => {
    const rows = [
      row("a", envelope([{ item_id: 1, item_type: "scale4", scale_code: "somewhat_appropriate" }])),
      row("b", envelope([{ item_id: 1, item_type: "scale4", scale_code: "somewhat_appropriate" }])),
      row("c", envelope([{ item_id: 1, item_type: "scale4", scale_code: "very_inappropriate" }], true)),
    ];
    const pattern = aggregateMissionResponses(MISSION_ID, rows, SAMPLE_MISSION_V5_NATIVE);
    expect(pattern.learners).toBe(3);
    expect(pattern.dissents).toBe(1);
    const scaleGroup = pattern.items[0].groups.find((group) => group.heading === "적절성 판단");
    expect(scaleGroup?.total).toBe(3);
    expect(scaleGroup?.choices[0]).toMatchObject({ label: "다소 적절", count: 2 });
    expect(scaleGroup?.choices[1]).toMatchObject({ label: "매우 부적절", count: 1 });
  });

  it("같은 학습자의 재시도는 최신 완료 1건만 센다", () => {
    const rows = [
      row("a", envelope([{ item_id: 1, item_type: "scale4", scale_code: "very_appropriate" }]), "2026-08-30T09:00:00Z"),
      row("a", envelope([{ item_id: 1, item_type: "scale4", scale_code: "very_inappropriate" }]), "2026-08-30T11:00:00Z"),
    ];
    const pattern = aggregateMissionResponses(MISSION_ID, rows, SAMPLE_MISSION_V5_NATIVE);
    expect(pattern.learners).toBe(1);
    const scaleGroup = pattern.items[0].groups[0];
    expect(scaleGroup.choices).toEqual([{ key: "very_inappropriate", label: "매우 부적절", count: 1 }]);
  });

  it("다른 미션의 행은 섞이지 않는다", () => {
    const foreign: ClassResponseLogRow = { ...row("z", envelope([{ item_id: 1, item_type: "scale4", scale_code: "very_appropriate" }])), mission_id: "other" };
    const pattern = aggregateMissionResponses(MISSION_ID, [foreign], SAMPLE_MISSION_V5_NATIVE);
    expect(pattern.learners).toBe(0);
    expect(pattern.items).toHaveLength(0);
  });

  it("수정안·이유·BEST/WORST 선택은 미션 본문에서 라벨을 가져온다", () => {
    const fixItem = SAMPLE_MISSION_V5_NATIVE.mpj_items.find((item) => item.type === "fix_choice");
    const reasonItem = SAMPLE_MISSION_V5_NATIVE.mpj_items.find((item) => item.type === "reason");
    const multiItem = SAMPLE_MISSION_V5_NATIVE.mpj_items.find((item) => item.type === "multi_judge");
    if (!fixItem || fixItem.type !== "fix_choice") throw new Error("샘플에 fix_choice가 없습니다.");
    if (!reasonItem || reasonItem.type !== "reason") throw new Error("샘플에 reason이 없습니다.");
    if (!multiItem || multiItem.type !== "multi_judge") throw new Error("샘플에 multi_judge가 없습니다.");
    const rows = [
      row("a", envelope([
        { item_id: fixItem.id, item_type: "fix_choice", band_code: "too_direct", correction_indexes: [1] },
        { item_id: reasonItem.id, item_type: "reason", initial_judgment: "inappropriate", reason_id: reasonItem.reasons[0].id },
        { item_id: multiItem.id, item_type: "multi_judge", best_candidate_index: 0, worst_candidate_index: 2 },
      ])),
    ];
    const pattern = aggregateMissionResponses(MISSION_ID, rows, SAMPLE_MISSION_V5_NATIVE);

    const fixPattern = pattern.items.find((item) => item.itemId === fixItem.id);
    expect(fixPattern?.groups.find((group) => group.heading === "고른 수정안")?.choices[0].label)
      .toContain(fixItem.corrections[1].text.slice(0, 10));

    const reasonPattern = pattern.items.find((item) => item.itemId === reasonItem.id);
    expect(reasonPattern?.groups.find((group) => group.heading === "최초 적절성 판단")?.choices[0].label).toBe("적절하지 않다");
    expect(reasonPattern?.groups.find((group) => group.heading === "고른 이유")?.choices[0].label)
      .toContain(reasonItem.reasons[0].text_ko.slice(0, 10));

    const multiPattern = pattern.items.find((item) => item.itemId === multiItem.id);
    expect(multiPattern?.groups.find((group) => group.heading === "BEST로 고른 초안")?.choices[0].label).toContain("초안 1");
    expect(multiPattern?.groups.find((group) => group.heading === "WORST로 고른 초안")?.choices[0].label).toContain("초안 3");
  });

  it("미션 본문이 없어도(라벨 미상) 코드로 집계한다", () => {
    const rows = [row("a", envelope([{ item_id: 2, item_type: "judge3", band_code: "too_direct" }]))];
    const pattern = aggregateMissionResponses(MISSION_ID, rows, null);
    expect(pattern.items[0].groups[0].choices[0]).toMatchObject({ key: "too_direct", label: "too_direct", count: 1 });
  });
});
