import { describe, expect, it } from "vitest";

import {
  COURSE_BACKUP_FORMAT_VERSION,
  CourseBackupFormatError,
  assertNoSecrets,
  buildCourseBackup,
  courseBackupFilename,
  parseCourseBackup,
  redactScenarioRow,
  scanForSecrets,
  serializeCourseBackup,
  summarizeCourseBackup,
} from "@/lib/backup/courseBackup";

const outline = {
  id: "outline-1",
  title: "비즈니스 중국어 통번역",
  level: "intermediate",
  language_direction: "ko_zh",
  domain: "work",
  industry: "trade",
  week_count: 15,
};

const weeks = [
  { id: "week-1", outline_id: "outline-1", week_no: 1, type: "orientation", title: "오리엔테이션" },
  { id: "week-2", outline_id: "outline-1", week_no: 2, type: "regular", title: "요청", speech_act: "request" },
];

const assignments = [
  { id: "assign-1", outline_id: "outline-1", week_no: 2, scenario_id: "scenario-1", position: 0, slot_role: "primary" },
];

const scenarios = [
  {
    scenario_id: "scenario-1",
    title: "납기 연장 요청",
    speech_act: "request",
    review_status: "approved",
    mission_status: "released",
    mission_reviewed_at: "2026-08-01T00:00:00.000Z",
    mission_reviewed_by: "11111111-1111-1111-1111-111111111111",
  },
];

const buildSample = () =>
  buildCourseBackup({
    outline,
    weeks,
    assignments,
    scenarios,
    exportedAt: new Date("2026-08-18T09:30:00.000Z"),
    appVersion: "test",
    projectRef: "abcdefgh",
  });

describe("교과목 백업 파일 만들기", () => {
  it("manifest에 형식 버전과 항목 수를 기록한다", () => {
    const file = buildSample();
    expect(file.manifest.backup_format_version).toBe(COURSE_BACKUP_FORMAT_VERSION);
    expect(file.manifest.item_counts).toEqual({
      curriculum_outlines: 1,
      curriculum_weeks: 2,
      curriculum_week_scenarios: 1,
      scenarios: 1,
    });
  });

  it("검수자 개인 식별자는 파일에 담지 않는다", () => {
    const file = buildSample();
    expect(file.data.scenarios[0]).not.toHaveProperty("mission_reviewed_by");
    // 검수·승인 상태 자체는 남는다.
    expect(file.data.scenarios[0].mission_status).toBe("released");
    expect(file.data.scenarios[0].review_status).toBe("approved");
  });

  it("열 자체를 제거한다(값만 비우지 않는다)", () => {
    expect(Object.keys(redactScenarioRow(scenarios[0]))).not.toContain("mission_reviewed_by");
  });

  it("파일명에 백업 날짜가 들어간다", () => {
    expect(courseBackupFilename(buildSample())).toBe("pragma-course-backup-2026-08-18.json");
  });
});

describe("시크릿 검사", () => {
  it("정상 백업은 걸리지 않는다", () => {
    expect(scanForSecrets(buildSample())).toEqual([]);
    expect(() => assertNoSecrets(buildSample())).not.toThrow();
  });

  it("JWT 형태 값이 섞이면 내보내기를 막는다", () => {
    const file = buildSample();
    file.data.scenarios[0].source_text = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZSJ9.x";
    expect(() => assertNoSecrets(file)).toThrow(/인증정보로 의심/);
  });

  it("키 이름이 시크릿을 가리키면 값이 있을 때 걸린다", () => {
    const file = buildSample();
    (file.data.scenarios[0] as Record<string, unknown>).openai_api_key = "not-empty";
    expect(scanForSecrets(file).length).toBeGreaterThan(0);
  });
});

describe("백업 파일 검증", () => {
  const text = () => serializeCourseBackup(buildSample());

  it("정상 파일은 그대로 다시 읽힌다", () => {
    const parsed = parseCourseBackup(text());
    expect(summarizeCourseBackup(parsed)).toMatchObject({
      title: "비즈니스 중국어 통번역",
      weekCount: 2,
      assignmentCount: 1,
      scenarioCount: 1,
    });
  });

  it("JSON이 아니면 사유와 함께 거부한다", () => {
    expect(() => parseCourseBackup("이건 백업 파일이 아니다")).toThrow(CourseBackupFormatError);
  });

  it("다른 종류의 JSON은 거부한다", () => {
    expect(() => parseCourseBackup(JSON.stringify({ hello: "world" }))).toThrow(/manifest가 없습니다/);
    expect(() => parseCourseBackup(JSON.stringify({ manifest: { kind: "other" }, data: {} }))).toThrow(
      /PRAGMA 수업 백업 파일이 아닙니다/,
    );
  });

  it("형식 버전이 다르면 거부한다", () => {
    const file = buildSample();
    file.manifest.backup_format_version = 99;
    expect(() => parseCourseBackup(serializeCourseBackup(file))).toThrow(/지원하지 않는 백업 형식 버전/);
  });

  it("배정된 미션 본문이 빠져 있으면 거부한다", () => {
    const file = buildSample();
    file.data.scenarios = [];
    expect(() => parseCourseBackup(serializeCourseBackup(file))).toThrow(/본문이 백업 파일에 없습니다/);
  });

  it("다른 교과목의 주차가 섞여 있으면 거부한다", () => {
    const file = buildSample();
    file.data.curriculum_weeks[0].outline_id = "outline-other";
    expect(() => parseCourseBackup(serializeCourseBackup(file))).toThrow(/다른 교과목에 속한 항목/);
  });
});
