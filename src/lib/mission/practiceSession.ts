// 일반·전이 연습 미션의 중단 지점 저장/복귀 (localStorage, mock).
//
// ⚠️ 앵커·평가 미션 답안에는 절대 사용하지 않는다 — 평가 조건(무힌트·동일 조건)이
// 로컬 복원으로 오염될 수 있다. 이 모듈은 practice/transfer 전용이다.

import { getLearnerId } from "@/lib/mission/learnerState";

export interface PracticeSessionData {
  stepIdx: number;
  relationGuess: string | null;
  draft: string;
  situationCall: string | null;
  productionReflected: string | null;
  contrastViewed: boolean;
  focusedDifference: string | null;
  revised: string;
  csDraft: string;
}

const key = (missionId: string, mode: string) =>
  `practice-session:${getLearnerId()}:${missionId}:${mode}:v1`;

export function loadPracticeSession(missionId: string, mode: string): PracticeSessionData | null {
  try {
    const raw = localStorage.getItem(key(missionId, mode));
    return raw ? (JSON.parse(raw) as PracticeSessionData) : null;
  } catch {
    return null;
  }
}

export function savePracticeSession(missionId: string, mode: string, data: PracticeSessionData) {
  try {
    localStorage.setItem(key(missionId, mode), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

// textarea 입력용 debounce 저장 — 키별 타이머 1개.
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function savePracticeSessionDebounced(
  missionId: string,
  mode: string,
  data: PracticeSessionData,
  delayMs = 500,
) {
  const k = key(missionId, mode);
  const prev = timers.get(k);
  if (prev) clearTimeout(prev);
  timers.set(
    k,
    setTimeout(() => {
      timers.delete(k);
      savePracticeSession(missionId, mode, data);
    }, delayMs),
  );
}

export function clearPracticeSession(missionId: string, mode: string) {
  const k = key(missionId, mode);
  const prev = timers.get(k);
  if (prev) {
    clearTimeout(prev);
    timers.delete(k);
  }
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

export function hasPracticeSession(missionId: string, mode: string): boolean {
  return loadPracticeSession(missionId, mode) !== null;
}
