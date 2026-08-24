import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { ComposerCore } from "@/lib/curriculum/composer";
import {
  assertCurrentWeeklyMissionPairShapes,
  WEEKLY_CONTEXT_AXES,
  WEEKLY_DIAGNOSTIC_DIMENSIONS,
  WEEKLY_MISSION_PAIR_CONTRACT_VERSION,
  weeklyMissionPairIssues,
  weeklyMissionPairShapeIssues,
  type WeeklyMissionPairAssignment,
} from "@/lib/curriculum/weeklyMissionPair";

function core(
  scenarioId: string,
  overrides: Partial<ComposerCore> = {},
): ComposerCore {
  return {
    scenario_id: scenarioId,
    speech_act: overrides.speech_act ?? "request",
    learner_level: overrides.learner_level ?? "intermediate",
    domain: overrides.domain ?? "school",
    mode: overrides.mode ?? "translation",
    theme_code: overrides.theme_code ?? "campus_study",
    topic_code: overrides.topic_code ?? "extension_request",
    mission_status: overrides.mission_status ?? "released",
    release_gate_mode: overrides.release_gate_mode ?? "expert_v1",
    // A/B의 정합성이나 범위 판정에 쓰지 않는 문항 수준 태그다.
    target_feature: overrides.target_feature ?? "request_mitigation_optionality",
    is_native_mpj5: overrides.is_native_mpj5 ?? true,
    situation_ko: overrides.situation_ko ?? "과제 기한 연장을 요청하는 상황",
    source_text_ko: overrides.source_text_ko ?? "제출 기한을 연장해 주실 수 있을까요?",
    direction: overrides.direction ?? "ko_zh",
    context: overrides.context ?? {
      counterpart: "교수자",
      power: "speaker_lower",
      distance: "distant",
      burden: "mid",
      channel: "written",
    },
  };
}

function pair(): WeeklyMissionPairAssignment[] {
  return [
    {
      scenario_id: "mission-a",
      pair_contract_version: WEEKLY_MISSION_PAIR_CONTRACT_VERSION,
      mission_role: "A",
      changed_context_axes: [],
      diagnostic_dimensions: [
        "illocutionary_clarity",
        "force_calibration",
        "relational_calibration",
      ],
    },
    {
      scenario_id: "mission-b",
      pair_contract_version: WEEKLY_MISSION_PAIR_CONTRACT_VERSION,
      mission_role: "B",
      changed_context_axes: ["power"],
      diagnostic_dimensions: [
        "force_calibration",
        "burden_optionality",
        "supportive_move_fit",
      ],
    },
  ];
}

describe("주차별 한 화행 A/B 계약", () => {
  it("같은 target_feature여도 복수 진단차원이 상보적인 완결 A/B면 통과한다", () => {
    const missionA = core("mission-a");
    const missionB = core("mission-b", {
      context: { ...missionA.context, power: "equal" },
    });

    expect(
      weeklyMissionPairIssues(pair(), {
        "mission-a": missionA,
        "mission-b": missionB,
      }),
    ).toEqual([]);
  });

  it("정확히 A 다음 B 두 건이어야 하며 역사적 행과 섞일 수 없다", () => {
    const malformed = [pair()[1], { scenario_id: "legacy" }];
    expect(weeklyMissionPairShapeIssues(malformed).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["pair_contract_mixed", "pair_role_order"]),
    );
    expect(weeklyMissionPairShapeIssues(pair().slice(0, 1)).map((issue) => issue.code)).toContain(
      "pair_item_count",
    );
  });

  it("각 미션의 단일 진단태그와 A/B의 비상보적 반복을 차단한다", () => {
    const malformed = pair();
    malformed[0].diagnostic_dimensions = ["force_calibration"];
    malformed[1].diagnostic_dimensions = ["force_calibration", "burden_optionality"];
    expect(weeklyMissionPairShapeIssues(malformed).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "pair_diagnostic_dimensions",
        "pair_coverage_union",
        "pair_coverage_complement",
      ]),
    );
  });

  it("같은 화행·수준·방향·수행모드와 선언한 실제 맥락 변화만 허용한다", () => {
    const missionA = core("mission-a");
    const missionB = core("mission-b", {
      mode: "stt_interpreting",
      context: { ...missionA.context, channel: "spoken" },
    });
    const codes = weeklyMissionPairIssues(pair(), {
      "mission-a": missionA,
      "mission-b": missionB,
    }).map((issue) => issue.code);

    expect(codes).toEqual(expect.arrayContaining(["pair_core_axes", "pair_context_delta"]));
  });

  it("데이터 저장 함수가 현재 계약의 불완전한 주차를 최종 차단한다", () => {
    const invalidRows = pair().slice(0, 1).map((item) => ({ ...item, week_no: 3 }));
    expect(() => assertCurrentWeeklyMissionPairShapes(invalidRows)).toThrow(
      "A/B 학습미션 계약 위반: 3주차",
    );
    expect(() =>
      assertCurrentWeeklyMissionPairShapes([
        { week_no: 3, scenario_id: "legacy" },
      ]),
    ).not.toThrow();
  });

  it("SQL 체크와 TypeScript의 버전·허용 코드가 함께 움직인다", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260824210000_weekly_speech_act_ab_contract.sql",
      ),
      "utf8",
    );
    expect(sql).toContain(WEEKLY_MISSION_PAIR_CONTRACT_VERSION);
    for (const axis of WEEKLY_CONTEXT_AXES) expect(sql).toContain(`'${axis}'`);
    for (const dimension of WEEKLY_DIAGNOSTIC_DIMENSIONS) {
      expect(sql).toContain(`'${dimension}'`);
    }
    expect(sql).toContain("pair_contract_version IS NULL");
  });
});
