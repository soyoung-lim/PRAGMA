import { describe, expect, it } from "vitest";
import type { InstructorMissionGuide } from "@/lib/pragma/instructorGuide";
import { instructorGuideTimingPlan } from "@/lib/pragma/instructorGuideTiming";
import { buildInstructorGuideStandaloneHtml, instructorGuideHtmlFilename, buildWeeklyMaterialsHtml } from "@/lib/pragma/instructorGuideHtml";
import type { WeeklyCourseMaterial } from "@/lib/curriculum/weeklyMaterials";

const guide: InstructorMissionGuide = {
  speechActKo: "요청",
  itemFocusKo: "완화와 선택권",
  situationKo: "<script>alert('x')</script> 이웃에게 부탁하기",
  relationKo: "아직 어색한 이웃",
  pdrKo: ["P · 힘의 관계: 동등", "D · 사회적 거리: 지인", "R · 부담: 중간"],
  burdenMeaningKo: "상대에게 요구되는 노력",
  mpjItems: [{ id: 1, titleKo: "판단", situationKo: "상황", source: "원문", designIntentKo: "의도", candidates: [{ text: "请帮忙", noteKo: "설명" }] }],
  misconceptionKo: "직접적일수록 명확하다",
  coreReasonKo: "선택권을 남긴다",
  contrast: { verified: true, preservedKo: ["P", "D"], changedKo: "R 변화", firstSituationKo: "상황 A", secondSituationKo: "상황 B" },
  microscope: { expression: "请", source: "부탁", functionAndEffectKo: "관계 효과", adjustmentExample: "方便的话", boundaryPromptKo: "요청인가?" },
  dct: { situationKo: "DCT", sourceText: "부탁한다", alternatives: [{ text: "方便的话，可以帮我吗？", noteKo: "선택권" }] },
  recontextualization: { situationKo: "새 상황", relationKo: "동료", promptKo: "표현을 조정한다" },
};

describe("standalone instructor guide HTML", () => {
  it("주차 공용 HTML은 허용한 본문만 출력하고 교수자 메모는 파일에서 제외한다", () => {
    const material: WeeklyCourseMaterial & { teacherNotes: string; missionAnswers: string } = {
      courseId: "course-1", courseTitle: "<script>alert('x')</script>", weekNo: 5,
      title: "초대", contextLabel: "중급 · 한→중 · 번역",
      preparationLabel: "편성 미션 2개 반영", preparationNote: "수업 전 확인",
      sections: [{ id: "goals", title: "이번 주 학습목표", paragraphs: ["공용 핵심 설명"], items: ["공용 질문"] }],
      missions: [], teacherNotes: "PRIVATE_INSTRUCTOR_SENTINEL", missionAnswers: "PRIVATE_ANSWER_SENTINEL",
    };
    const html = buildWeeklyMaterialsHtml(material);
    expect(html).toContain("공용 핵심 설명");
    expect(html).toContain("공용 질문");
    expect(html).not.toContain("PRIVATE_INSTRUCTOR_SENTINEL");
    expect(html).not.toContain("PRIVATE_ANSWER_SENTINEL");
    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain("window.print()");
    expect(html).toContain("ArrowRight");
  });

  it("creates a self-contained, escaped offline lesson file", () => {
    const html = buildInstructorGuideStandaloneHtml({
      primary: { scenarioId: "mission-a", guide },
      timingPlan: instructorGuideTimingPlan(50),
      generatedAt: new Date("2026-08-26T12:00:00+09:00"),
    });

    expect(html).toContain("PRAGMA 오프라인 수업본");
    expect(html).toContain("50분 · 미션 1세트 확장 운영");
    expect(html).toContain("해설 공개");
    expect(html).toContain("window.print()");
    expect(html).toContain("&lt;script&gt;alert(&#039;x&#039;)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("includes both missions and the comparison slide for 90 minutes", () => {
    const input = {
      primary: { scenarioId: "mission/a", guide },
      secondary: { scenarioId: "mission-b", guide: { ...guide, situationKo: "두 번째 상황" } },
      timingPlan: instructorGuideTimingPlan(90),
      generatedAt: new Date("2026-08-26T12:00:00+09:00"),
    };

    const html = buildInstructorGuideStandaloneHtml(input);
    expect(html).toContain("미션 1·2 판단 근거 비교");
    expect(html).toContain("두 번째 상황");
    expect(instructorGuideHtmlFilename(input)).toBe("PRAGMA_오프라인_수업본_90분_mission-a_mission-b.html");
  });
});
