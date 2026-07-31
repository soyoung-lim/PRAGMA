import type { TextDiffPart } from "@/lib/mission/textDiff";

// 최초↔최종 산출의 차이 표기. 미션 수행 화면(수정 지도)과 학습 기록이 같은 표기를 쓴다.
//
// 표기는 문자 변화만 나타내며 추가·삭제의 화용적 적절성을 판정하지 않는다
// (판정은 피드백 층의 일이고, 이 표기는 "무엇이 달라졌나"만 보여 준다).
export function DiffLine({
  parts,
  view,
}: {
  parts: TextDiffPart[];
  view: "first" | "final";
}) {
  return (
    <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed">
      {parts.map((part, index) => {
        if (part.kind === "insert" && view === "first") return null;
        if (part.kind === "delete" && view === "final") return null;
        if (part.kind === "delete") {
          return (
            <span
              key={`${part.kind}-${index}`}
              className="text-[#87919A] line-through decoration-[#87919A] decoration-1"
            >
              {part.text}
            </span>
          );
        }
        if (part.kind === "insert") {
          return (
            <span
              key={`${part.kind}-${index}`}
              className="font-medium underline decoration-2 decoration-[#49677B] underline-offset-4"
            >
              {part.text}
            </span>
          );
        }
        return <span key={`${part.kind}-${index}`}>{part.text}</span>;
      })}
    </p>
  );
}

/** 삭제·추가 표기 범례. 실제로 바뀐 것이 있을 때만 쓴다. */
export function DiffLegend() {
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
      <span>
        <span className="text-[#87919A] line-through">삭제</span> · 회색 취소선
      </span>
      <span>
        <span className="underline decoration-2 decoration-[#49677B] underline-offset-2">추가</span> · 밑줄
      </span>
    </div>
  );
}
