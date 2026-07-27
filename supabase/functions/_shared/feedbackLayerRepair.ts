type FeedbackLike = {
  verdicts?: {
    semantic_fidelity?: unknown
  }
  blocks?: {
    meaning_ko?: unknown
  }
}

/**
 * 의미 층에 직접성·완화·선택권만 근거로 든 판정을 서버 응답 전에 교정한다.
 *
 * 모델이 통역 전사에서 질문형·완화 표지를 의미 불변항으로 잘못 승격하는 경우가 있어,
 * 구체적인 사실·참여자·시간·장소·조건·행위의 차이를 들지 못한 때에만 preserved로
 * 되돌린다. 실제 누락·추가·뒤바뀜의 근거가 한 가지라도 있으면 손대지 않는다.
 */
export function repairFeedbackPragmaticLeak(feedback: FeedbackLike): boolean {
  const verdicts = feedback.verdicts
  const blocks = feedback.blocks
  if (!verdicts || verdicts.semantic_fidelity === 'preserved' || !blocks) return false

  const explanation = typeof blocks.meaning_ko === 'string' ? blocks.meaning_ko : ''
  const pragmaticCue =
    /완화|선택권|거절할 여지|명령(?:문|형)?|직접적|간접적|공손|정중|부드럽|말투|질문형|의문형/.test(
      explanation,
    )
  const meaningUnit =
    '(?:사실|참여자|사람|상대|대상|장소|시간|날짜|조건|이유|행동|행위|요청 내용|요구 내용)'
  const concreteMeaningEvidence =
    new RegExp(
      [
        `${meaningUnit}.{0,24}(?:누락|빠졌|생략|추가|뒤바뀌|왜곡|전달되지)`,
        `(?:누락|빠졌|생략|추가|뒤바뀌|왜곡)(?:된|한)?\\s*${meaningUnit}`,
        `원문에 없(?:는|던)?.{0,12}${meaningUnit}`,
        `다른\\s*${meaningUnit}`,
        '요청(?:이|을).{0,24}(?:철회|수락|사실 진술|진술로|다른 행동|다른 행위)',
        '잘못 옮',
        '반대 의미',
      ].join('|'),
    ).test(explanation)

  if (!pragmaticCue || concreteMeaningEvidence) return false

  verdicts.semantic_fidelity = 'preserved'
  blocks.meaning_ko =
    '구체적인 사실·조건의 차이가 확인되지 않아 뜻은 유지된 것으로 봅니다. 직접성·완화·선택권의 차이는 화용 층에서 살펴봅니다.'
  return true
}
