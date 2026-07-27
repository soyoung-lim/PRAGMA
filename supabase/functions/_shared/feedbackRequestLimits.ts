// feedback-lite 요청 비용 경계.
//
// answer만 제한하면 상황·원문·카탈로그 설명에 대용량 문자열을 넣어 프롬프트 비용을
// 증폭시킬 수 있다. Edge가 JSON을 파싱한 뒤 OpenAI를 호출하기 전에 전체 payload도
// 제한한다. 정상 mission_v2 요청보다 충분히 큰 값이라 기존 학습 흐름에는 영향이 없다.

export const FEEDBACK_MAX_ANSWER_CHARS = 4_000
export const FEEDBACK_MAX_PAYLOAD_CHARS = 32_000
// feedback_v1은 짧은 3층 진단 JSON이다. 모델 기본 최대치(수만 토큰)를 그대로
// 열어 두지 않고, 정상 응답에는 충분한 범위에서 출력 비용의 절대 상한을 둔다.
export const FEEDBACK_MAX_COMPLETION_TOKENS = 1_200

export function feedbackPayloadIssue(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'feedback body required'
  }

  const answer = (body as { answer?: unknown }).answer
  if (typeof answer !== 'string' || !answer.trim()) {
    return 'feedback body required (answer)'
  }
  if (answer.length > FEEDBACK_MAX_ANSWER_CHARS) {
    return `feedback answer too long (max ${FEEDBACK_MAX_ANSWER_CHARS} chars)`
  }

  const payloadChars = JSON.stringify(body).length
  if (payloadChars > FEEDBACK_MAX_PAYLOAD_CHARS) {
    return `feedback payload too large (max ${FEEDBACK_MAX_PAYLOAD_CHARS} chars)`
  }
  return null
}
