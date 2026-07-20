import type { SituationCard } from "@/lib/mission/mockMission";

// Shared by MissionShell (research/judgment shell) and QuickMissionShell (quick production shell).
export const SituationBlock = ({ card, tone }: { card: SituationCard; tone: "a" | "b" }) => (
  <div
    className={[
      "rounded-xl border p-4",
      tone === "a"
        ? "border-[#EAE4D2] bg-[#FAF7EE]"
        : "border-[#FAD338] bg-[#FFFBEA]",
    ].join(" ")}
  >
    <p className="text-[15px] font-medium leading-relaxed text-foreground">{card.headline}</p>
    <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
      <div className="flex gap-2">
        <dt className="shrink-0 text-muted-foreground">상대</dt>
        <dd>{card.audience}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="shrink-0 text-muted-foreground">관계</dt>
        <dd>{card.relation}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="shrink-0 text-muted-foreground">채널</dt>
        <dd>{card.channel}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="shrink-0 text-muted-foreground">목적</dt>
        <dd>{card.goal}</dd>
      </div>
    </dl>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div>
        <div className="text-[12px] font-medium text-muted-foreground">반드시 전달할 사실</div>
        <ul className="mt-1 list-disc pl-4 text-[13px]">
          {card.mustConvey.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-[12px] font-medium text-muted-foreground">사용 가능한 사실</div>
        <ul className="mt-1 list-disc pl-4 text-[13px]">
          {card.usableFacts.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);
