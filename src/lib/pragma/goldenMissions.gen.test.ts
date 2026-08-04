// 골든 미션 게이트 하네스 (생성계약 v1.4 §10) — 수동 실행용.
//   npx vitest run src/lib/pragma/goldenMissions.gen.test.ts
// 배포된 generate-scenario 엣지함수를 호출해 코어→미션을 뽑고 R1~R23으로 검증한다.
// 실제 OpenAI 호출이라 비용·시간이 든다. 일반 CI에서 돌리지 말 것.

import { describe, it, expect, afterAll } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  TARGET_FEATURES,
  DEFAULT_FEATURE_BY_ACT,
  type TargetFeature,
} from "@/lib/pragma/targetFeatures";
import { errorPatternsForAct } from "@/lib/pragma/errorPatterns";
import { getScenarioTopic } from "@/lib/pragma/scenarioTopics";
import {
  PDR_POWER_ENUM_TO_JSON,
  PDR_DISTANCE_ENUM_TO_JSON,
} from "@/lib/pragma/coreSchema";
import { checkCore, checkMission, type CheckContext } from "@/lib/pragma/missionRules";
import type { SpeechActUI, PdrPower, PdrDistance, PdrBurden } from "@/lib/pragma/enums";

// ── env ──
function readEnv(): { url: string; key: string } {
  const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  const get = (k: string) => raw.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim() ?? "";
  return { url: get("VITE_SUPABASE_URL"), key: get("VITE_SUPABASE_PUBLISHABLE_KEY") };
}
const RUN_GOLDEN = process.env.RUN_GOLDEN === "1";
const { url: SUPABASE_URL, key: ANON } = RUN_GOLDEN
  ? readEnv()
  : { url: "", key: "" };
const FN_URL = `${SUPABASE_URL}/functions/v1/generate-scenario`;

async function invoke(body: unknown): Promise<any> {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`edge ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const LEVEL_POLICY_INTERMEDIATE =
  "중급(HSK5): 복문 1~2개, 이유·조건 표현 사용. 자원 조합 2개. 원문 2~4문장.";

interface GoldenCell {
  act: SpeechActUI;
  domain: "daily" | "school" | "work";
  theme_code: string;
  topic_code: string;
  channel: "email" | "messenger" | "facetoface" | "phone";
  industry: string | null;
  pdr: { p: PdrPower; d: PdrDistance; r: PdrBurden };
}

const GOLDEN_CELLS: GoldenCell[] = [
  {
    act: "request",
    domain: "work",
    theme_code: "career_workplace",
    topic_code: "schedule_change",
    channel: "email",
    industry: "education_research",
    pdr: { p: "higher", d: "acquaintance", r: "mid" }, // 상대가 위, 지인, 중부담
  },
  {
    act: "refusal",
    domain: "work",
    theme_code: "career_workplace",
    topic_code: "task_delegation_refusal",
    channel: "messenger",
    industry: "IT_platform",
    pdr: { p: "equal", d: "acquaintance", r: "mid" },
  },
  {
    act: "thanks",
    domain: "daily",
    theme_code: "relationship_social",
    topic_code: "favor_thanks",
    channel: "messenger",
    industry: null,
    pdr: { p: "equal", d: "close", r: "low" },
  },
];

function featureForGen(f: TargetFeature) {
  return {
    code: f.code,
    version: f.version,
    learner_label: f.learner_label,
    operational_definition: f.operational_definition,
    band_schema: f.band_schema,
    within_band_code: f.within_band_code,
    relevant_resources: f.relevant_resources,
    excluded_confounds: f.excluded_confounds,
    closing_principle_ko: f.closing_principle_ko,
    counter_rule_note: f.counter_rule_note,
  };
}

function ctxOf(cell: GoldenCell): CheckContext {
  return {
    speech_act: cell.act,
    level: "intermediate",
    domain: cell.domain,
    theme_code: cell.theme_code as CheckContext["theme_code"],
    topic_code: cell.topic_code,
    industry: cell.industry,
    mode: "translation",
    source_modality: "written",
  };
}

function fmtViolations(vs: { id: string; level: string; message: string }[]): string {
  if (!vs.length) return "  (없음)";
  return vs.map((x) => `  [${x.level}] ${x.id}: ${x.message}`).join("\n");
}

// 눈검사 리뷰 파일용 수집기
const REVIEW: { act: string; core: any; coreResult: string; mission: any; missionResult: string; warnings: string[] }[] = [];
const REVIEW_PATH = "C:\\Users\\cnkr\\OneDrive\\바탕 화면\\최근 작업\\골든미션_눈검사_0723.md";

// 실제 OpenAI·배포 엣지함수 호출 → 비용. CI 자동 실행 방지: RUN_GOLDEN=1 일 때만.
//   RUN_GOLDEN=1 npx vitest run src/lib/pragma/goldenMissions.gen.test.ts
describe.skipIf(!RUN_GOLDEN)("골든 미션 게이트 (요청·거절·감사 × 중급)", () => {
  afterAll(() => {
    if (!REVIEW.length) return;
    const lines: string[] = [
      "# 골든 미션 눈검사 (2026-07-23) — 요청·거절·감사 × 중급",
      "",
      "> 자동 게이트(R1~R23) 통과분. 아래 눈검사 항목 확인: 축·대역이 화행에 맞는가 / 거절 유발행위 구조 / 수준 사다리 / recommended_example 정합 / 산출 정합. **중국어는 원어민 검토 전.**",
      "",
    ];
    for (const r of REVIEW) {
      lines.push(`## ${r.act} — 코어 ${r.coreResult} / 미션 ${r.missionResult}`);
      if (r.warnings.length) lines.push("경고(눈검사): " + r.warnings.join(" · "));
      lines.push("", "### 코어", "```json", JSON.stringify(r.core, null, 2), "```");
      lines.push("", "### 미션", "```json", JSON.stringify(r.mission, null, 2), "```", "");
    }
    writeFileSync(REVIEW_PATH, lines.join("\n"), "utf8");
    console.log(`\n\n리뷰 파일 작성: ${REVIEW_PATH}`);
  });

  for (const cell of GOLDEN_CELLS) {
    it(
      `${cell.act} → 코어 생성 → 승격 → R1~R23`,
      async () => {
        const topic = getScenarioTopic(cell.topic_code)!;
        const feature = TARGET_FEATURES[DEFAULT_FEATURE_BY_ACT[cell.act]!];
        const ctx = ctxOf(cell);
        const isResponse = cell.act === "refusal" || cell.act === "opposition";

        // ── 1. 코어 생성 ──
        const coreRes = await invoke({
          action: "core",
          core: {
            speech_act_ko: cell.act,
            level_ko: "중급 (HSK 5급)",
            domain_ko: cell.domain,
            channel: cell.channel,
            channel_ko: cell.channel,
            pdr: {
              p: PDR_POWER_ENUM_TO_JSON[cell.pdr.p],
              d: PDR_DISTANCE_ENUM_TO_JSON[cell.pdr.d],
              r: cell.pdr.r,
            },
            source_modality: "written",
            situation_seed_ko: topic.situationSeedKo,
            is_response_act: isResponse,
            length_hint_ko: "2~4문장",
          },
        });
        const core = coreRes.core_content;
        const coreCheck = checkCore(core, ctx);
        console.log(`\n\n═══════ ${cell.act.toUpperCase()} ═══════`);
        console.log("── CORE ──\n" + JSON.stringify(core, null, 2));
        console.log(`코어 검사: ${coreCheck.result}\n${fmtViolations(coreCheck.violations)}`);

        // ── 2. 미션 승격 (재시도 ≤2) ──
        let mission: any;
        let missionCheck: ReturnType<typeof checkMission> | undefined;
        let failureNotes: string | undefined;
        let previousMission: unknown;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const mRes = await invoke({
            action: "mission",
            mission: {
              speech_act_ko: cell.act,
              level_ko: "중급 (HSK 5급)",
              level_policy_ko: LEVEL_POLICY_INTERMEDIATE,
              feature: featureForGen(feature),
              core: {
                situation_ko: core.situation_ko,
                relation_ko: core.relation_ko,
                source_text_ko: core.source_text_ko,
                preceding_turn_zh: core.preceding_turn_zh ?? null,
                pdr: core.pdr,
                channel: core.channel,
                source_modality: core.source_modality,
              },
              // golden 셀은 전부 한→중이다(GoldenCell에 방향 축이 없다).
              error_pattern_hints_ko: errorPatternsForAct(cell.act, "ko_zh").map(
                (p) => `${p.description} (예: ${p.approvedExample})`,
              ),
              is_response_act: isResponse,
              failure_notes: failureNotes,
              previous_mission: failureNotes ? previousMission : undefined,
            },
          });
          mission = mRes.mission_content;
          missionCheck = checkMission(mission, ctx, core);
          console.log(`\n── MISSION attempt ${attempt}: ${missionCheck.result} ──`);
          console.log(fmtViolations(missionCheck.violations));
          if (missionCheck.result !== "fail") break;
          previousMission = mission;
          failureNotes = missionCheck.violations
            .filter((x) => x.level === "fail")
            .map((x) => `- ${x.id}: ${x.message}`)
            .join("\n");
        }

        console.log(`\n═══ ${cell.act} 최종: 코어 ${coreCheck.result} / 미션 ${missionCheck!.result} ═══`);
        REVIEW.push({
          act: cell.act,
          core,
          coreResult: coreCheck.result,
          mission,
          missionResult: missionCheck!.result,
          warnings: missionCheck!.violations.filter((x) => x.level === "warning").map((x) => `${x.id}: ${x.message}`),
        });

        expect(coreCheck.result, `코어 R검사 실패:\n${fmtViolations(coreCheck.violations)}`).not.toBe("fail");
        expect(missionCheck!.result, `미션 R검사 실패:\n${fmtViolations(missionCheck!.violations)}`).not.toBe("fail");
      },
      120_000,
    );
  }
});
