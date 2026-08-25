import type { QualityCheck } from '@/lib/pragma/missionSchema'

/** Convert critic findings into the existing mission repair prompt input. */
export function missionQualityFailureNotes(quality: QualityCheck): string {
  const findings = quality.findings
    .filter((finding) => finding.severity === 'fail')
    .map((finding) => `- ${finding.code}${finding.where ? ` (${finding.where})` : ''}: ${finding.note_ko}`)
  return [
    'AI 품질점검 결함 — 아래 의미 판정을 모두 고쳐 재생성하세요.',
    quality.summary_ko,
    ...findings,
  ].filter(Boolean).join('\n')
}
