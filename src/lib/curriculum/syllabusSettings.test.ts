import { beforeEach, describe, expect, it } from "vitest";
import {
  EMPTY_SYLLABUS_SETTINGS,
  loadCurriculumSyllabusSettings,
  saveCurriculumSyllabusSettings,
  syllabusEvaluationIsValid,
  syllabusEvaluationTotal,
  type CurriculumSyllabusSettings,
} from "@/lib/curriculum/syllabusSettings";

describe("curriculum syllabus settings", () => {
  beforeEach(() => window.localStorage.clear());

  it("requires entered evaluation weights to total 100", () => {
    const partial: CurriculumSyllabusSettings = {
      ...EMPTY_SYLLABUS_SETTINGS,
      evaluationWeights: { mpj: 30, dct: 40, completion: 20, participation: null },
    };
    expect(syllabusEvaluationTotal(partial)).toBe(90);
    expect(syllabusEvaluationIsValid(partial)).toBe(false);
    expect(syllabusEvaluationIsValid(EMPTY_SYLLABUS_SETTINGS)).toBe(true);
  });

  it("keeps professor-entered document settings by curriculum", () => {
    const settings: CurriculumSyllabusSettings = {
      instructorName: "홍길동",
      scheduleLocation: "화 3–4교시",
      attendanceAssignmentPolicy: "주차 안에 제출",
      materials: "승인 미션",
      evaluationWeights: { mpj: 30, dct: 40, completion: 20, participation: 10 },
    };
    saveCurriculumSyllabusSettings("outline-a", settings);

    expect(loadCurriculumSyllabusSettings("outline-a")).toEqual(settings);
    expect(loadCurriculumSyllabusSettings("outline-b")).toEqual(EMPTY_SYLLABUS_SETTINGS);
  });
});
