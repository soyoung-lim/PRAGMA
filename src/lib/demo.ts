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
  "step2-best-reason",
  "step2-worst-reason",
  "step3-feedback-decisions",
  "step4-final-translation",
] as const;

const DEMO_VALUES: Record<(typeof STORAGE_KEYS)[number], string> = {
  "step1-speech-act": "refusal",
  // q1=1 ("비슷한 위치"), q2=1 ("몇 차례 소통"), q3=0 ("큰 영향")
  "step1-answers": JSON.stringify({ q1: 1, q2: 1, q3: 0 }),
  "step2-best": "C",
  "step2-worst": "A",
  "step2-best-reason":
    "C는 감사 표현과 후속 협업 의지가 함께 담겨 있어, 거절이지만 관계를 잇는 신호가 잘 드러난다고 보았습니다. 여러 차례 소통해 온 실무 관계에서 이 정도 톤이 가장 자연스럽다고 느꼈습니다.",
  "step2-worst-reason":
    "A는 너무 짧고 단정적이라 여러 번 연락해 온 실무 관계에서 받기에 부담스럽고 무례하게 받아들여질 수 있다고 느꼈습니다. 거절 사유나 관계 신호가 거의 드러나지 않는 점도 위험해 보였습니다.",
  "step3-feedback-decisions": JSON.stringify([
    {
      perspective: "recipient",
      decision: "accept",
      reason:
        "수신자가 후속 협업 의지를 부담으로 받을 수 있다는 지적이 와닿아 수용했습니다. 표현 강도를 톤다운하는 방향으로 반영하려 합니다.",
    },
    {
      perspective: "teacher",
      decision: "hold",
      reason:
        "후속 협업 표현이 약속 범위와 맞는지 점검하라는 지적은 타당하지만, 어디까지 줄일지 기준이 모호해 일단 보류하고 최종 작성 단계에서 다시 보겠습니다.",
    },
    {
      perspective: "field_expert",
      decision: "accept",
      reason:
        "장기 거래처에 보내는 답변으로 톤은 적절하지만, 실제 약속 범위를 넘는 강한 의지 표현은 다음 협상에서 부담이 될 수 있다는 지적을 받아들였습니다.",
    },
  ]),
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
