import { Badge } from "@/components/ui/badge";
import { PRINCIPLE_CARD } from "@/lib/mission/mockPracticeMission";

/** ⑧ 오늘의 원리 + 완료 — 프로토타입 .verdict + .principle */
export const PrincipleCard = () => (
  <div className="space-y-4">
    <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
      <Badge variant="outline" className="border-[#FAD338] text-[11px] text-[#B8860B]">
        {PRINCIPLE_CARD.verdict}
      </Badge>
      <span className="ml-2 text-[12px] text-muted-foreground">{PRINCIPLE_CARD.verdictNote}</span>
    </div>

    <div className="rounded-xl border border-l-4 border-[#EAE4D2] border-l-[#FAD338] bg-[#FFFBEA] p-4">
      <div className="inline-block rounded-full bg-[#FAD338] px-2.5 py-0.5 text-[11px] font-semibold text-[#15202B]">
        오늘의 원리
      </div>
      <p className="mt-2 text-[14px]">{PRINCIPLE_CARD.headline}</p>
      <p className="mt-2 text-[12px] text-muted-foreground">
        <strong>적용 조건</strong> {PRINCIPLE_CARD.applyCondition}
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        <strong>예외</strong> {PRINCIPLE_CARD.exception}
      </p>
    </div>
  </div>
);
