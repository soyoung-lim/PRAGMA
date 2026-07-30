// 미니 담화형 DCT의 원문 표시.
//
// 2026-07-30 사용자 실화면 검토 결과 **산출 전 강조를 완전히 제거**했다.
// 이유: 강조가 "여기만 옮기면 된다"로 읽혀 부분 번역을 유인했고, 그래서
// "(전체를 옮기세요)" 같은 문구로 땜질해야 했다. 원인을 없애면 안내도 필요 없다.
// 학습자는 수업·화용 설명·MPJ 4문항을 거쳐 왔으므로 초점은 이미 알고 있고,
// 상단 화행 배지와 단계 표시가 넛지 역할을 한다.
//
// `focal_segments`는 삭제하지 않는다 — 화면 표시와 평가 범위 지정은 별개다.
// 서버는 계속 그 구간으로 화용 판정 범위를 좁힌다. 학습자 피드백 화면의 별도 초점
// 회고 카드는 2026-07-30 실화면 검토에서 정보 과잉으로 판단해 제거했다.
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
 * 산출 단계의 원문 — 상대 말풍선과 혼동되지 않는 번역 지시 영역으로 보여 준다.
 * 여러 문장이므로 캡션 한 줄이 아니라 읽기 좋은 블록으로 조판한다.
 */
export function DiscourseSourceText({ source }: { source: string }) {
  return (
    <div className="mb-3 mt-1 border-l-[3px] border-[#FAD338] px-3 py-1">
      <div className="text-[11.5px] font-bold text-[#52606B]">내가 전할 말</div>
      <p className="mt-1.5 whitespace-pre-line text-[14.5px] font-medium leading-[1.68] text-[#1F2A33]">
        {source}
      </p>
    </div>
  );
}
