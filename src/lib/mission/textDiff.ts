export type TextDiffKind = "equal" | "insert" | "delete";

export interface TextDiffPart {
  kind: TextDiffKind;
  text: string;
}

type SegmenterLike = {
  segment(input: string): Iterable<{ segment: string }>;
};

type SegmenterConstructor = new (
  locale?: string | string[],
  options?: { granularity: "word" },
) => SegmenterLike;

/**
 * 중국어·한국어의 단어 경계를 우선 사용하고, 미지원 환경에서는 유니코드 문자 단위로
 * 폴백한다. 공백과 문장부호도 보존하므로 최초·최종 문장을 그대로 다시 조립할 수 있다.
 */
function tokenize(text: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterConstructor }).Segmenter;
  if (Segmenter) {
    const locale = /[\u3400-\u9fff]/u.test(text) ? "zh" : "ko";
    return Array.from(new Segmenter(locale, { granularity: "word" }).segment(text), (part) => part.segment);
  }
  return Array.from(text);
}

function append(parts: TextDiffPart[], kind: TextDiffKind, text: string) {
  if (!text) return;
  const previous = parts[parts.length - 1];
  if (previous?.kind === kind) previous.text += text;
  else parts.push({ kind, text });
}

/**
 * 최장 공통 부분열(LCS) 기반의 중립적 텍스트 차이.
 * 결과는 문자 변화만 뜻하며, 추가·삭제의 화용적 적절성을 판정하지 않는다.
 */
export function diffText(first: string, final: string): TextDiffPart[] {
  const before = tokenize(first);
  const after = tokenize(final);
  // 학습 문장은 짧지만, 붙여넣은 대용량 텍스트가 LCS 행렬을 폭증시키지 않게 한다.
  if (before.length * after.length > 40_000) {
    return [
      ...(first ? [{ kind: "delete" as const, text: first }] : []),
      ...(final ? [{ kind: "insert" as const, text: final }] : []),
    ];
  }
  const table = Array.from({ length: before.length + 1 }, () =>
    Array<number>(after.length + 1).fill(0),
  );

  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        before[i] === after[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const parts: TextDiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      append(parts, "equal", before[i]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      append(parts, "delete", before[i]);
      i += 1;
    } else {
      append(parts, "insert", after[j]);
      j += 1;
    }
  }
  while (i < before.length) {
    append(parts, "delete", before[i]);
    i += 1;
  }
  while (j < after.length) {
    append(parts, "insert", after[j]);
    j += 1;
  }

  return parts;
}
