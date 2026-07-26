// provenance-lite 회귀 테스트 (계약 0-q·98 / 0-t).
//
// 배경: 「실제 자료에서 생성」 패널이 수집한 출처를 applyAuthentic이 버리고 있었다.
// 이제 core_content 안에 optional로 보존한다(신규 컬럼·migration 없음).
//
// 검증: ① provenance 없는 기존 코어가 계속 파싱된다(하위호환 — 가장 중요)
//       ② v1 → v2 정규화에서 provenance가 살아남는다
//       ③ v2 코어의 provenance가 보존된다
//       ④ 잘못된 source_type은 거부된다
//       ⑤ anonymized는 optional(수집 UI 미구현 상태를 반영)

import { describe, it, expect } from "vitest";
import { normalizeCore, CoreProvenanceSchema } from "@/lib/pragma/coreSchema";

const BASE_V1 = {
  schema_version: "scenario_core_v1" as const,
  situation_ko: "거래처 담당자에게 회의 일정을 미뤄 달라고 요청한다.",
  relation_ko: "거래처 담당자(상위자·지인)",
  source_modality: "written" as const,
  source_text_ko: "회의를 다음 주로 미룰 수 있을까요?",
  preceding_turn_zh: null,
  pdr: { p: "speaker_lower" as const, d: "acquaintance" as const, r: "mid" as const },
};

const PROV = {
  source_type: "authentic_youtube" as const,
  source_ref: "https://www.youtube.com/watch?v=xxxx",
  source_original: "这个会议能不能推到下周？",
  ai_adapted: true,
};

describe("provenance-lite (0-q·98)", () => {
  it("① provenance가 없는 기존 코어는 그대로 파싱된다(하위호환)", () => {
    const r = normalizeCore(BASE_V1);
    expect(r.ok).toBe(true);
    expect(r.data?.provenance).toBeUndefined();
  });

  it("② v1 → v2 정규화에서 provenance가 보존된다", () => {
    const r = normalizeCore({ ...BASE_V1, provenance: PROV });
    expect(r.ok).toBe(true);
    expect(r.data?.schema_version).toBe("scenario_core_v2");
    expect(r.data?.provenance?.source_type).toBe("authentic_youtube");
    expect(r.data?.provenance?.source_original).toBe("这个会议能不能推到下周？");
    expect(r.data?.provenance?.ai_adapted).toBe(true);
    // 본문 필드 매핑이 깨지지 않았는지 함께 확인.
    expect(r.data?.source_text).toBe(BASE_V1.source_text_ko);
  });

  it("③ v2 코어의 provenance가 보존된다", () => {
    const v2 = {
      schema_version: "scenario_core_v2" as const,
      direction: "zh_ko" as const,
      situation_ko: BASE_V1.situation_ko,
      relation_ko: BASE_V1.relation_ko,
      source_modality: "written" as const,
      source_text: "这个会议能不能推到下周？",
      preceding_turn: null,
      pdr: BASE_V1.pdr,
      provenance: { ...PROV, source_type: "authentic_image" as const, ai_adapted: false },
    };
    const r = normalizeCore(v2);
    expect(r.ok).toBe(true);
    expect(r.data?.provenance?.source_type).toBe("authentic_image");
    expect(r.data?.provenance?.ai_adapted).toBe(false);
  });

  it("④ 잘못된 source_type은 거부된다", () => {
    const r = normalizeCore({ ...BASE_V1, provenance: { ...PROV, source_type: "scraped" } });
    expect(r.ok).toBe(false);
  });

  it("⑤ anonymized는 optional이고, 있으면 보존된다", () => {
    expect(CoreProvenanceSchema.safeParse(PROV).success).toBe(true);
    const withFlag = CoreProvenanceSchema.safeParse({ ...PROV, anonymized: true });
    expect(withFlag.success).toBe(true);
    const r = normalizeCore({ ...BASE_V1, provenance: { ...PROV, anonymized: true } });
    expect(r.data?.provenance?.anonymized).toBe(true);
  });

  it("⑥ source_ref·source_original은 null 허용(출처 미입력 자료)", () => {
    const r = normalizeCore({
      ...BASE_V1,
      provenance: { source_type: "authentic_text", source_ref: null, source_original: null, ai_adapted: false },
    });
    expect(r.ok).toBe(true);
    expect(r.data?.provenance?.source_ref).toBeNull();
  });
});
