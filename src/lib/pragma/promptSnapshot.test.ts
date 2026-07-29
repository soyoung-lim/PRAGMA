import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { PROMPT_SNAPSHOT } from "@/lib/pragma/promptSnapshot.generated";

function prompt(key: string) {
  const entry = PROMPT_SNAPSHOT.prompts.find((item) => item.key === key);
  if (!entry) throw new Error(`프롬프트 스냅샷에 ${key}가 없습니다.`);
  return entry;
}

describe("prompt snapshot integrity", () => {
  it("matches the current Edge source", () => {
    const source = readFileSync(
      resolve(process.cwd(), PROMPT_SNAPSHOT.edge_source),
      "utf8",
    );
    const canonicalSource = source.replace(/\r\n?/g, "\n");
    const sourceHash = createHash("sha256").update(canonicalSource).digest("hex");

    expect(PROMPT_SNAPSHOT.edge_source_sha256).toBe(sourceHash);
  });

  it("keeps written and spoken feedback on the same diagnostic rubric", () => {
    const written = prompt("feedback.system");
    const spoken = prompt("feedback.system.spoken");

    for (const entry of [written, spoken]) {
      expect(entry.text).toContain("달라진 요청 강도·선택권은 ③에서만 판정한다");
      expect(entry.text).toContain("① 의미:");
      expect(entry.text).toContain("② 이해 가능성(문법):");
      expect(entry.text).toContain("③ 화용 인상:");
    }
    expect(written.text).toContain("학습자가 제출한 중국어 번역문");
    expect(written.text).not.toContain("[통역 전사 경계]");
    expect(spoken.text).toContain("학습자가 확인·수정한 중국어 통역 전사");
    expect(spoken.text).toContain("[통역 전사 경계]");
    expect(spoken.text).toContain("발음·성조·속도·휴지·유창성·음질을 추측하거나 평가하지 마라");
    expect(spoken.text).toContain("통역이라고 의미 판정 기준을 더 엄격하게 바꾸지 마라");
    for (const prompt of [written, spoken]) {
      expect(prompt.text).toContain("층 분리 교정 예시");
      expect(prompt.text).toContain('의미="preserved", 문법="clean"');
      expect(prompt.text).toContain('문법="impeding_errors"');
    }
  });

  it("binds the five hardened quality checks into generator and critic prompts", () => {
    const system = prompt("core.system.ko_zh");
    const written = prompt("core.user.written");
    const critic = prompt("core_quality.system");

    expect(system.text).toContain("[context_spec]의 역할 쌍·권리·의무·결정 권한");
    expect(system.text).toContain("화자 A(학습자)와 상대 B");
    expect(system.text).toContain("서로 다른 종류의 구체적 단서");
    expect(system.text).toContain("장면 시드와 topic_code");
    expect(system.text).toContain("host_family, hotel, neighbor");
    expect(system.text).toContain("B의 preceding_turn에 명시된 하나의 명제 P");
    expect(system.text).toContain("즉시 늘리기");
    expect(system.text).toContain("거절은 A가 자신의 수락 여부를 결정");
    expect(written.text).toContain("산업 배경");
    expect(written.text).toContain("[context_spec — 서버 고정 조건]");
    expect(written.text).toContain("행위자 고정: A=화자");
    expect(critic.text).toContain("industry");
    expect(critic.text).toContain("context_spec");
    expect(critic.text).toContain("referents");
    expect(critic.text).toContain("decision_authority");
    expect(critic.text).toContain("[축 — 12개 모두 빠짐없이 판정]");
    expect(critic.text).toContain("산업 라벨 없이도 해당 분야를 추론");
    expect(critic.text).toContain("하나의 명제 P");
    expect(critic.text).toContain("즉시 확장하기");
    expect(written.text).toContain('"글로 남기지 않고 직접 말한다"');
    expect(prompt("core.user.spoken").text).toContain("이메일·메신저·글을 작성해 보내는");
    expect(critic.text).toContain("국소적 두 턴만 본다");
  });
  it("locks propositional supportive moves to server-authorized facts", () => {
    const mission = prompt("mission.system");
    const feedback = prompt("feedback.system");
    const quality = prompt("quality.system");

    expect(mission.text).toContain("[사용 가능한 추가 사실]");
    expect(mission.text).toContain("사실 유무를 정답 단서로 만들지 마세요");
    expect(feedback.text).toContain("[허용된 추가 사실]");
    expect(quality.text).toContain("production_task.usable_facts");
  });

  it("locks new Full Missions to Judge+Fix → Reason → MultiJudge → DCT", () => {
    const mission = prompt("mission.system");
    const spoken = prompt("mission.system.spoken");
    const quality = prompt("quality.system");

    for (const entry of [mission, spoken]) {
      expect(entry.text).toContain("MPJ 3문항");
      expect(entry.text).toContain("판단하고 고쳐보기 → 왜 문제일까 → 여러 초안 비교");
      expect(entry.text).toContain("fix_choice → reason → multi_judge");
      expect(entry.text).toContain("Judge3는 첫 문항에서 딱 한 번만");
      expect(entry.text).toContain("reason에는 accepted_band_codes·confidence를 만들지 마세요");
      expect(entry.text).toContain("과소 1·적정 2·과잉 1");
      expect(entry.text).not.toContain('"type": "scale4"');
      expect(entry.text).not.toContain('"type": "reason_conf"');
    }
    expect(quality.text).toContain("MPJ 3문항");
    expect(quality.text).toContain("primary_reason_ambiguity");
    expect(quality.text).toContain("context_plan_mismatch");
  });
});
