// Demo mode: seeds a complete refusal-scenario session and marks all inputs read-only.
// The original learning-mode values are backed up so exiting demo mode restores them.

const DEMO_FLAG_KEY = "demo-mode";
const BACKUP_PREFIX = "demo-backup:";

// Keys that demo mode populates / learning mode owns.
const STORAGE_KEYS = [
  "step1-speech-act",
  "step1-answers",
  "step2-best",
  "step2-worst",
  "step2-reason",
  "step3-feedback-impact",
  "step4-final-translation",
] as const;

const DEMO_VALUES: Record<(typeof STORAGE_KEYS)[number], string> = {
  "step1-speech-act": "refusal",
  // q1=1 ("비슷한 위치"), q2=1 ("몇 차례 소통"), q3=0 ("큰 영향")
  "step1-answers": JSON.stringify({ q1: 1, q2: 1, q3: 0 }),
  "step2-best": "C",
  "step2-worst": "A",
  "step2-reason":
    "A는 너무 짧고 단정적이라 여러 번 연락해 온 실무 관계에서 받기에 부담스럽다고 느꼈습니다. C는 감사 표현과 후속 협업 의지가 함께 담겨 있어 거절이지만 관계를 잇는 신호가 잘 드러난다고 봤습니다.",
  "step3-feedback-impact": JSON.stringify({
    impact: "partial",
    side: "receiver",
    reason:
      "후속 협업 의지가 너무 강하면 오히려 부담이 될 수 있다는 지적이 와닿았습니다. 실제로 약속할 수 있는 범위에서 표현 강도를 조정해야겠다고 느꼈습니다.",
  }),
  "step4-final-translation": JSON.stringify({
    finalTranslation:
      "感谢贵方提出此次推广费用调整方案。我方已认真进行内部讨论,但由于项目预算和执行安排已经基本确定,实在难以再下调。还请您理解,后续活动中我方也会继续与贵方保持沟通。",
    justification:
      "처음에는 C가 가장 적절하다고 봤습니다. 다만 수신자 피드백을 보고 C의 후속 협업 의지 표현이 다소 강해 기대치를 높일 수 있다는 점을 인지했습니다. \"继续积极配合后续活动推进\"이라는 강한 표현을 \"继续与贵方保持沟通\"으로 톤다운하여 거절의 단호함은 유지하되 약속 강도는 조정했습니다.",
  }),
};

export function isDemoMode(): boolean {
  try {
    return localStorage.getItem(DEMO_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function enterDemoMode() {
  try {
    // Back up existing learning-mode values once (don't overwrite an existing backup).
    if (localStorage.getItem(DEMO_FLAG_KEY) !== "1") {
      for (const k of STORAGE_KEYS) {
        const cur = localStorage.getItem(k);
        if (cur !== null) {
          localStorage.setItem(BACKUP_PREFIX + k, cur);
        } else {
          // Mark as "was empty" so restore can correctly remove the demo value.
          localStorage.setItem(BACKUP_PREFIX + k, "__EMPTY__");
        }
      }
    }
    for (const k of STORAGE_KEYS) {
      localStorage.setItem(k, DEMO_VALUES[k]);
    }
    localStorage.setItem(DEMO_FLAG_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function exitDemoMode() {
  try {
    for (const k of STORAGE_KEYS) {
      const backupKey = BACKUP_PREFIX + k;
      const backup = localStorage.getItem(backupKey);
      if (backup === null) {
        localStorage.removeItem(k);
      } else if (backup === "__EMPTY__") {
        localStorage.removeItem(k);
      } else {
        localStorage.setItem(k, backup);
      }
      localStorage.removeItem(backupKey);
    }
    localStorage.removeItem(DEMO_FLAG_KEY);
  } catch {
    /* ignore */
  }
}

// Backwards compatibility (Landing.tsx previously imported this).
export function seedDemoData() {
  enterDemoMode();
}
