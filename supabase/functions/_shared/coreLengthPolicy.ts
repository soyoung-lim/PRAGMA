export type CoreLengthLevel = 'beginner_intermediate' | 'intermediate' | 'advanced'
export type CoreLengthMode = 'translation' | 'stt_interpreting'

export interface CoreLengthRange {
  min: number
  max: number
}

/**
 * 원문 분량 정책 v1.
 *
 * 공백·문장부호를 제외한 Unicode 문자/숫자를 세어 중국어의 쉼표 연결 장문과
 * 한국어 종결어미 차이를 같은 단위로 다룬다. 범위는 2026-08 통역 확대 파일럿의
 * 시작값이며, TTS 실측 후 새 버전으로만 조정한다(같은 버전의 값 덮어쓰기 금지).
 */
export const CORE_LENGTH_POLICY_VERSION = 'effective_chars_v1'

export const CORE_LENGTH_RANGES: Record<
  CoreLengthMode,
  Record<CoreLengthLevel, CoreLengthRange>
> = {
  translation: {
    beginner_intermediate: { min: 45, max: 65 },
    intermediate: { min: 60, max: 85 },
    advanced: { min: 80, max: 110 },
  },
  stt_interpreting: {
    beginner_intermediate: { min: 30, max: 45 },
    intermediate: { min: 40, max: 60 },
    advanced: { min: 55, max: 85 },
  },
}

export function coreLengthRange(
  level: CoreLengthLevel,
  mode: CoreLengthMode,
): CoreLengthRange {
  return CORE_LENGTH_RANGES[mode][level]
}

/** 공백·문장부호를 제외한 Unicode 문자·숫자 수(NFC 정규화). */
export function countCoreEffectiveChars(text: string): number {
  return Array.from(text.normalize('NFC')).filter((char) => /[\p{L}\p{N}]/u.test(char)).length
}

export function coreLengthHintKo(level: CoreLengthLevel, mode: CoreLengthMode): string {
  const { min, max } = coreLengthRange(level, mode)
  const discourse = mode === 'stt_interpreting'
    ? '짧은 구두 담화 (기억 과부하 없이)'
    : '실무 메시지 담화'
  return `유효 글자 ${min}~${max}자(공백·문장부호 제외), 종결부호 기준 2~4문장의 ${discourse}`
}
