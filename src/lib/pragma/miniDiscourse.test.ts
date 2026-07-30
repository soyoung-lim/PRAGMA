// R29 — 미니 담화형 원문 + focal segments (DEC-20260730-01)
// 검사 대상: 문장 수 하드 경계·수준별 권장 범위, focal segments 구조·부분문자열,
// 그리고 legacy 단문 코어가 면제되는지.
import { describe, expect, it } from "vitest";
import { checkCore, countSentences, coreLengthHintKo, type CheckContext } from "@/lib/pragma/missionRules";
import { normalizeCore } from "@/lib/pragma/coreSchema";

const SOURCE_3 =
  "지난번에 보내주신 샘플은 잘 받았습니다. 내부 검토에 하나가 더 필요해서요. 가능하시다면 오늘 중으로 하나 더 보내주실 수 있을까요?";

const CTX: CheckContext = {
  speech_act: "request",
  level: "intermediate",
  domain: "work",
  theme_code: "career_workplace",
  topic_code: "work_sample_request",
  mode: "translation",
  source_modality: "written",
};

function coreV3(over: Record<string, unknown> = {}) {
  return {
    schema_version: "scenario_core_v3",
    direction: "ko_zh",
    situation_ko:
      "평소 연락하던 거래처 담당자에게 검토용 샘플을 한 부 더 보내 달라고 글로 적어 보낸다. 기록으로 남는 요청이고 담당자가 내부 확인을 거쳐야 한다.",
    relation_ko: "거래처 담당자와 실무로 알고 지내는 관계",
    source_modality: "written",
    source_text: SOURCE_3,
    preceding_turn: null,
    pdr: { p: "equal", d: "acquaintance", r: "mid" },
    focal_segments: [
      { text: "가능하시다면 오늘 중으로 하나 더 보내주실 수 있을까요?", role: "head" },
    ],
    ...over,
  };
}

const r29 = (core: unknown, ctx: CheckContext = CTX) =>
  checkCore(core, ctx).violations.filter((x) => x.id === "R29");

describe("countSentences", () => {
  it("종결 부호로 문장을 센다", () => {
    expect(countSentences(SOURCE_3)).toBe(3);
    expect(countSentences("한 문장입니다.")).toBe(1);
    expect(countSentences("부호 없이 끝나는 문장")).toBe(1);
    expect(countSentences("你好。今天可以吗？")).toBe(2);
  });
});

describe("coreLengthHintKo — 생성 안내는 R29 범위에서 파생된다", () => {
  it("수준·모드별로 다른 문장 수를 안내한다", () => {
    expect(coreLengthHintKo("beginner_intermediate", "translation")).toContain("2~3문장");
    expect(coreLengthHintKo("intermediate", "translation")).toContain("3~4문장");
    expect(coreLengthHintKo("advanced", "stt_interpreting")).toContain("3~4문장");
  });
  it("통역 안내에는 기억 부담 경계가 붙는다", () => {
    expect(coreLengthHintKo("intermediate", "stt_interpreting")).toContain("기억 과부하");
  });
});

describe("R29 focal segments", () => {
  it("정상 미니 담화 코어는 R29 위반이 없다", () => {
    expect(r29(coreV3())).toHaveLength(0);
  });

  it("한 문장 원문은 fail", () => {
    const v = r29(coreV3({ source_text: "샘플 하나 더 보내주실 수 있을까요?", focal_segments: [{ text: "샘플 하나 더 보내주실 수 있을까요?", role: "head" }] }));
    expect(v.some((x) => x.level === "fail")).toBe(true);
  });

  it("원문에 없는 구간은 fail", () => {
    const v = r29(coreV3({ focal_segments: [{ text: "원문에 없는 문장", role: "head" }] }));
    expect(v.some((x) => x.level === "fail" && x.message.includes("부분문자열"))).toBe(true);
  });

  it("head가 2개면 fail", () => {
    const v = r29(
      coreV3({
        focal_segments: [
          { text: "지난번에 보내주신 샘플은 잘 받았습니다.", role: "head" },
          { text: "가능하시다면 오늘 중으로 하나 더 보내주실 수 있을까요?", role: "head" },
        ],
      }),
    );
    expect(v.some((x) => x.level === "fail" && x.message.includes("head"))).toBe(true);
  });

  it("head가 없으면 fail", () => {
    const v = r29(coreV3({ focal_segments: [{ text: "내부 검토에 하나가 더 필요해서요.", role: "support" }] }));
    expect(v.some((x) => x.level === "fail")).toBe(true);
  });

  it("수준 권장 범위를 벗어나면 fail이 아니라 warning", () => {
    // 입문 권장 2~3문장인데 4문장 → warning만
    const four = SOURCE_3 + " 번거롭게 해드려 죄송합니다.";
    const v = r29(coreV3({ source_text: four }), { ...CTX, level: "beginner_intermediate" });
    expect(v.some((x) => x.level === "fail")).toBe(false);
    expect(v.some((x) => x.level === "warning")).toBe(true);
  });

  it("legacy 단문 코어(v2)는 R29 면제 — focal_segments 부재", () => {
    const v2 = { ...coreV3(), schema_version: "scenario_core_v2", source_text: "샘플 하나 더 보내주실 수 있을까요?" };
    delete (v2 as Record<string, unknown>).focal_segments;
    expect(r29(v2)).toHaveLength(0);
  });
});

describe("normalizeCore — v3 상위집합 정규화", () => {
  it("v2는 focal_segments 없이 v3로 승격된다", () => {
    const v2 = { ...coreV3(), schema_version: "scenario_core_v2" };
    delete (v2 as Record<string, unknown>).focal_segments;
    const n = normalizeCore(v2);
    expect(n.ok).toBe(true);
    expect(n.data?.schema_version).toBe("scenario_core_v3");
    expect(n.data?.focal_segments).toBeUndefined();
  });

  it("v3는 focal_segments를 보존한다", () => {
    const n = normalizeCore(coreV3());
    expect(n.ok).toBe(true);
    expect(n.data?.focal_segments).toHaveLength(1);
    expect(n.data?.focal_segments?.[0].role).toBe("head");
  });
});
