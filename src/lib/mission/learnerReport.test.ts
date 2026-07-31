import { describe, expect, it } from "vitest";
import { buildLearnerReport } from "@/lib/mission/learnerReport";
import { LEARNER_REPORT_PREVIEW_ENTRIES } from "@/lib/mission/learnerReportPreview";
import type { MyMissionLogEntry } from "@/lib/mission/missionLog";

const entry = (
  id: string,
  overrides: Partial<MyMissionLogEntry> = {},
): MyMissionLogEntry => ({
  id,
  createdAtIso: "2026-07-31T06:00:00.000Z",
  speechAct: "request",
  level: "intermediate",
  taskType: "translation",
  targetLang: "zh",
  sourceText: "요청 원문",
  firstResponse: "麻烦您今天发给我。",
  revisedResponse: "如果方便的话，今天能不能发给我？",
  revised: true,
  featureId: "request_mitigation_optionality",
  featureVersion: "1.0",
  feedbackRubricVersion: "feedback-rubric-v1",
  pragmaticBandCode: "too_direct",
  revisionScope: "feature",
  revisionSource: "system_assigned",
  ...overrides,
});

describe("buildLearnerReport", () => {
  it("예시 데이터에서 같은 초점·방식의 요청 패턴만 집계한다", () => {
    const report = buildLearnerReport(LEARNER_REPORT_PREVIEW_ENTRIES);

    expect(report.attemptCount).toBe(15);
    expect(report.revisedCount).toBe(13);
    expect(report.speechActs[0]).toEqual({
      key: "request",
      label: "요청",
      count: 8,
    });
    expect(report.primaryCohort).toMatchObject({
      featureKey: "request_mitigation_optionality",
      featureLabel: "부탁을 부드럽게 말하기",
      taskType: "translation",
      attemptCount: 8,
      bandObservationCount: 8,
      dominantNonWithin: {
        code: "too_direct",
        label: "조금 단정적으로 들림",
        count: 5,
      },
      recentExpression: {
        expression: "如果方便的话",
        learnerCopy: "“가능하다면…”",
        count: 2,
        total: 4,
        olderCount: 0,
      },
    });
    expect(report.headline).toContain("최근에는 “가능하다면…”을 써보기도 했어요");
    expect(report.correctionNotes).toHaveLength(13);
    expect(report.correctionNotes[0]).toMatchObject({
      speechActLabel: "요청",
      reasonLabel: "부탁을 부드럽게 말하기",
      entry: { id: "report-preview-1" },
    });
  });

  it("번역과 통역, 판정 버전이 다른 기록을 같은 분모에 섞지 않는다", () => {
    const translation = [
      entry("t1"),
      entry("t2"),
      entry("t3", { pragmaticBandCode: "within_band" }),
    ];
    const interpreting = [
      entry("i1", { taskType: "interpreting" }),
      entry("i2", { taskType: "interpreting" }),
    ];
    const otherRubric = entry("other-rubric", {
      feedbackRubricVersion: "feedback-rubric-v2",
    });

    const report = buildLearnerReport([
      ...translation,
      ...interpreting,
      otherRubric,
    ]);

    expect(report.primaryCohort?.taskType).toBe("translation");
    expect(report.primaryCohort?.attemptCount).toBe(3);
    expect(report.primaryCohort?.bandObservationCount).toBe(3);
  });

  it("band 기록이 없으면 성향 그래프와 강한 프로파일 문장을 만들지 않는다", () => {
    const report = buildLearnerReport([
      entry("one", { pragmaticBandCode: null }),
      entry("two", { pragmaticBandCode: null }),
    ]);

    expect(report.primaryCohort?.bandObservationCount).toBe(0);
    expect(report.primaryCohort?.dominantNonWithin).toBeNull();
    expect(report.headline).toContain("더 관찰하고 있어요");
  });

  it("카탈로그에 없는 band 코드는 분포에서 제외한다", () => {
    const report = buildLearnerReport([
      entry("valid"),
      entry("invalid", { pragmaticBandCode: "not-a-band" }),
      entry("clear", { pragmaticBandCode: "within_band" }),
    ]);

    expect(report.primaryCohort?.bandObservationCount).toBe(2);
    expect(report.primaryCohort?.bands.map((band) => band.count)).toEqual([
      1, 1, 0,
    ]);
  });

  it("수정 노트에는 최초 표현과 다른 최종 표현이 있는 수행만 담는다", () => {
    const report = buildLearnerReport([
      entry("meaning", { revisionScope: "meaning" }),
      entry("grammar", { revisionScope: "grammar" }),
      entry("unchanged", {
        revised: false,
        revisedResponse: "麻烦您今天发给我。",
      }),
    ]);

    expect(report.correctionNotes.map((note) => note.entry.id)).toEqual([
      "meaning",
      "grammar",
    ]);
    expect(report.correctionNotes.map((note) => note.reasonLabel)).toEqual([
      "뜻을 정확히 옮기기",
      "문장을 자연스럽게 다듬기",
    ]);
  });
});
