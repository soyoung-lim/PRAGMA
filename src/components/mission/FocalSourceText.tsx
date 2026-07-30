// 미니 담화형 DCT의 원문 표시 — 화용 집중 구간만 옅은 배경으로 표시한다.
// DEC-20260730-01: 성격은 정답 힌트가 아니라 **주의집중 스캐폴딩**이다. 무엇을
// 어떻게 옮길지는 알려주지 않고, 이번 주 초점이 담화의 어디에서 실현되는지만
// 가리킨다. 밑줄은 링크로 오인되므로 쓰지 않는다.
//
// 학습 미션에서만 표시한다. 진단·평가 맥락에서는 표시하지 않는다(계약 명시).
// 통역에는 구간 표시가 없다 — 초점 고지만 하며, 이 비대칭 때문에 번역·통역
// 산출 결과를 직접 비교·합산하지 않는다.

import type { FocalSegment } from "@/lib/pragma/coreSchema";

interface Part {
  text: string;
  focal: boolean;
}

/**
 * 원문을 집중 구간 경계로 잘라 순서대로 돌려준다.
 * 각 구간은 원문의 정확한 부분문자열이어야 한다(R29). 겹치는 구간은 앞선 것만
 * 살리고, 원문에서 찾을 수 없는 구간은 조용히 건너뛴다 — 표시가 원문을 왜곡하는
 * 것보다 강조가 빠지는 편이 안전하다.
 */
export function splitByFocalSegments(source: string, segments: FocalSegment[]): Part[] {
  const ranges: { start: number; end: number }[] = [];
  for (const seg of segments) {
    const text = seg.text.trim();
    if (!text) continue;
    const start = source.indexOf(text);
    if (start < 0) continue;
    const end = start + text.length;
    if (ranges.some((r) => start < r.end && end > r.start)) continue; // 겹침 제외
    ranges.push({ start, end });
  }
  ranges.sort((a, b) => a.start - b.start);

  const parts: Part[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) parts.push({ text: source.slice(cursor, r.start), focal: false });
    parts.push({ text: source.slice(r.start, r.end), focal: true });
    cursor = r.end;
  }
  if (cursor < source.length) parts.push({ text: source.slice(cursor), focal: false });
  return parts.filter((p) => p.text.length > 0);
}

export function FocalSourceText({
  source,
  segments,
  focusLabel,
}: {
  source: string;
  segments: FocalSegment[];
  /** 이번 주 초점의 학습자용 표현. 라벨 문구에 그대로 쓴다. */
  focusLabel?: string;
}) {
  const parts = splitByFocalSegments(source, segments);
  const hasFocal = parts.some((p) => p.focal);

  return (
    <div className="mb-2 rounded-[12px] border border-[#DDE3E8] bg-white px-3 py-2.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[11px] font-semibold text-[#3E4C57]">전할 내용 (전체를 옮기세요)</span>
        {hasFocal && (
          <span className="rounded-[6px] bg-[#FDF3D3] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#7A5A12]">
            이번 주 집중{focusLabel ? ` · ${focusLabel}` : ""}
          </span>
        )}
      </div>
      <p className="text-[14.5px] leading-[1.62] text-[#1F2A33]">
        {parts.map((p, i) =>
          p.focal ? (
            <span key={i} className="rounded-[4px] bg-[#FDF3D3] px-0.5 py-[1px]">
              {p.text}
            </span>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </p>
    </div>
  );
}
