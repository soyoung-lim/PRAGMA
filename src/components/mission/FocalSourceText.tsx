// 미니 담화형 DCT의 원문 표시.
//
// 2026-07-30 사용자 실화면 검토 결과 **산출 전 강조를 완전히 제거**했다.
// 이유: 강조가 "여기만 옮기면 된다"로 읽혀 부분 번역을 유인했고, 그래서
// "(전체를 옮기세요)" 같은 문구로 땜질해야 했다. 원인을 없애면 안내도 필요 없다.
// 학습자는 수업·화용 설명·MPJ 4문항을 거쳐 왔으므로 초점은 이미 알고 있고,
// 상단 화행 배지와 단계 표시가 넛지 역할을 한다.
//
// `focal_segments`는 삭제하지 않는다 — 화면 표시와 평가 범위 지정은 별개다.
// 서버는 계속 그 구간으로 화용 판정 범위를 좁히고(피드백 프롬프트), 학습자에게는
// **제출 후 회고 시점에만** 공개한다(FocalRecap). 기존 "판단 제출 뒤 교정 공개"
// (DEC-20260729-03)·"MultiJudge 참고 대역 사후 공개"와 같은 패턴이다.
//
// 통역에는 구간 표시가 아예 없다. 이 비대칭 때문에 번역·통역 산출 결과를
// 직접 비교·합산하지 않는다.

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

/**
 * 산출 단계의 원문 — 강조·라벨 없이 하나의 자연스러운 메시지로만 보여 준다.
 * 여러 문장이므로 캡션 한 줄이 아니라 읽기 좋은 블록으로 조판한다.
 */
export function DiscourseSourceText({ source, srcName }: { source: string; srcName: string }) {
  return (
    <div className="mb-2 rounded-[12px] border border-[#DDE3E8] bg-white px-3.5 py-3">
      <div className="mb-1.5 text-[11px] font-semibold text-[#6B7A85]">
        내가 전할 말 ({srcName})
      </div>
      <p className="whitespace-pre-line text-[14.5px] leading-[1.68] text-[#1F2A33]">{source}</p>
    </div>
  );
}

/**
 * 제출 후 회고용 — 이번 주 초점이 담화의 어디에서 실현됐는지 공개한다.
 * 산출이 끝난 뒤이므로 부분 번역을 유인하지 않는다.
 */
export function FocalRecap({
  source,
  segments,
  focusLabel,
}: {
  source: string;
  segments: FocalSegment[];
  focusLabel?: string;
}) {
  const parts = splitByFocalSegments(source, segments);
  if (!parts.some((p) => p.focal)) return null;

  return (
    <details className="rounded-xl border border-[#DDE5DF] bg-white px-3.5 py-2.5">
      <summary className="cursor-pointer list-none text-[12px] font-bold text-[#52645A]">
        이번 주 초점이 있던 곳 보기
        {focusLabel ? <span className="ml-1 font-medium text-[#6B7A85]">· {focusLabel}</span> : null}
      </summary>
      <p className="mt-2 text-[13.5px] leading-[1.68] text-[#1F2A33]">
        {parts.map((p, i) =>
          p.focal ? (
            <span key={i} className="rounded-[4px] bg-[#FDF3D3] px-0.5 py-[1px]">
              {p.text}
            </span>
          ) : (
            <span key={i} className="text-[#6B7A85]">
              {p.text}
            </span>
          ),
        )}
      </p>
    </details>
  );
}
