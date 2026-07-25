// 양방향 일반화 영구 회귀 테스트 (계약 0-l). 라운드1~2의 안전망.
//
// 검증: ① v1 core → v2 정규화 ② v1 mission → v2 정규화 ③ ko_zh R10 통과
//       ④ zh_ko(중국어 원문·한국어 산출) R10 통과 ⑤ 방향 불일치 R10 fail.
// normalizeCore/normalizeMission이 기존 v1 데이터를 안 깨는지가 핵심(ko_zh 회귀).

import { describe, it, expect } from "vitest";
import { normalizeCore } from "@/lib/pragma/coreSchema";
import { normalizeMission, type MissionV2 } from "@/lib/pragma/missionSchema";
import { checkCore, checkMission, type CheckContext } from "@/lib/pragma/missionRules";
import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";

const PROV = {
  model: "gpt-4o",
  prompt_version: "mission_v2",
  mission_content_hash: "abc",
  generated_at: "2026-07-25T00:00:00Z",
  generation_attempt: 1,
};

// schedule_change = career_workplace·work·request 허용 topic(R1c·R15 통과용).
const ctx: CheckContext = {
  speech_act: "request",
  level: "intermediate",
  domain: "work",
  theme_code: "career_workplace",
  topic_code: "schedule_change",
  mode: "translation",
  source_modality: "written",
};

const V1_CORE = {
  schema_version: "scenario_core_v1",
  situation_ko: "거래처에 회의 일정 변경을 요청한다.",
  relation_ko: "거래처 담당자",
  source_modality: "written",
  source_text_ko: "회의를 하루 앞당길 수 있을까요?",
  preceding_turn_zh: null,
  pdr: { p: "speaker_lower", d: "acquaintance", r: "mid" },
  channel: "messenger",
};

describe("0-l ① v1 core → v2 정규화", () => {
  it("필드 매핑 + direction=ko_zh", () => {
    const n = normalizeCore(V1_CORE);
    expect(n.ok).toBe(true);
    expect(n.data!.direction).toBe("ko_zh");
    expect(n.data!.source_text).toBe("회의를 하루 앞당길 수 있을까요?");
    expect(n.data!.preceding_turn).toBeNull();
  });
});

describe("0-l ② v1 mission → v2 정규화", () => {
  it("MPJ·production_task 중립 필드 매핑", () => {
    const n = normalizeMission(SAMPLE_MISSION_V1);
    expect(n.ok).toBe(true);
    const m = n.data!;
    expect(m.direction).toBe("ko_zh");
    expect(m.mpj_items[0].source).toBe("회의를 하루 앞당길 수 있을까요?");
    expect((m.mpj_items[0] as { target?: string }).target).toBe("把会议提前一天。");
    expect((m.mpj_items[2] as { corrections: { text: string }[] }).corrections[0].text).toContain("报价单");
    expect((m.mpj_items[4] as { candidates: { text: string }[] }).candidates[0].text).toBe("再发一个样品。");
    expect(m.production_task.source_text).toContain("미팅 장소");
    expect(m.production_task.reference_alternatives[0].text).toContain("麻烦您");
  });
});

describe("0-l ③ ko_zh R10", () => {
  it("한국어 원문 + 중국어 산출 = 언어 실패 없음", () => {
    const r = checkMission({ ...SAMPLE_MISSION_V1, provenance: PROV }, ctx);
    const bad = r.violations.filter((v) => v.level === "fail" && ["R10", "R23", "R1"].includes(v.id));
    if (bad.length) console.log("ko_zh 예상외 실패:", JSON.stringify(bad, null, 2));
    expect(bad).toEqual([]);
  });
  it("코어도 통과", () => {
    const r = checkCore(V1_CORE, ctx);
    expect(r.violations.filter((v) => v.id === "R10" && v.level === "fail")).toEqual([]);
  });
});

// zh_ko 미러 — 구조 동일, 언어만 반전(중국어 원문·한국어 산출).
function zhKoMirror(): MissionV2 {
  const base = normalizeMission(SAMPLE_MISSION_V1).data!;
  const zhSource = "请把会议提前一天，好吗？"; // 중국어 원문
  const koTarget = "회의를 하루 앞당겨 주시겠어요?"; // 한국어 산출
  return {
    ...base,
    schema_version: "mission_v2",
    direction: "zh_ko",
    mpj_items: base.mpj_items.map((it) => {
      // zh_ko는 target=한국어 → 선행발화도 한국어여야 R10 통과(0-l·85, checkPrecedingLang)
      const common = {
        ...it,
        source: zhSource,
        recommended_example: "회의를 조금 앞당겨 주실 수 있을까요?",
        ...(it.preceding_turn ? { preceding_turn: "다음 주 회의는 원래대로 진행하죠?" } : {}),
      };
      if (it.type === "multi_judge") {
        return { ...common, candidates: it.candidates.map((c) => ({ ...c, text: "회의를 앞당겨 주세요." })) };
      }
      if (it.type === "fix_choice") {
        return { ...common, target: koTarget, highlights: [], corrections: it.corrections.map((c) => ({ ...c, text: "회의를 앞당겨 주실 수 있을까요?" })) };
      }
      return { ...common, target: koTarget, highlights: [] } as typeof it;
    }),
    production_task: {
      ...base.production_task,
      source_text: "请把下周的会议地点改到我们附近，好吗？",
      preceding_turn: "다음 주 회의 장소는 그대로 괜찮으세요?",
    },
    provenance: PROV,
  } as MissionV2;
}

describe("0-l ④ zh_ko R10", () => {
  it("중국어 원문 + 한국어 산출 = zh_ko 방향에서 언어 실패 없음", () => {
    const r = checkMission(zhKoMirror(), { ...ctx, direction: "zh_ko" });
    const r10 = r.violations.filter((v) => v.id === "R10" && v.level === "fail");
    if (r10.length) console.log("zh_ko 미러 R10 실패:", JSON.stringify(r10, null, 2));
    expect(r10).toEqual([]);
  });
});

describe("0-l ⑤ 방향 불일치 fail", () => {
  it("ko_zh 데이터에 zh_ko 요청 → R10 fail", () => {
    const r = checkMission({ ...SAMPLE_MISSION_V1, provenance: PROV }, { ...ctx, direction: "zh_ko" });
    expect(r.violations.filter((v) => v.id === "R10" && v.level === "fail").length).toBeGreaterThan(0);
  });
  it("zh_ko 데이터에 ko_zh 요청 → R10 fail", () => {
    const r = checkMission(zhKoMirror(), { ...ctx, direction: "ko_zh" });
    expect(r.violations.filter((v) => v.id === "R10" && v.level === "fail").length).toBeGreaterThan(0);
  });
});
