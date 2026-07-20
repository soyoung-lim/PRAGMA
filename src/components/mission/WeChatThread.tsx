interface WeChatThreadProps {
  title: string;
  messages: { from: "them" | "me"; who: string | null; text: string }[];
}

/** 프로토타입 .wx / .bubble 대응 — 매체(위챗) 감각을 주는 정적 스레드. */
export const WeChatThread = ({ title, messages }: WeChatThreadProps) => (
  <div className="rounded-xl border border-[#EAE4D2] bg-[#EDEDED] p-3.5">
    <div className="mb-3 text-center text-[12px] font-semibold text-muted-foreground">{title}</div>
    {messages.map((m, i) => (
      <div
        key={i}
        className={[
          "mb-2 max-w-[80%] rounded-lg px-3 py-2 text-[14.5px] leading-relaxed",
          m.from === "them"
            ? "rounded-tl-sm bg-white"
            : "ml-auto rounded-tr-sm bg-[#95EC69]",
        ].join(" ")}
      >
        {m.who && <span className="mb-0.5 block text-[11px] text-muted-foreground">{m.who}</span>}
        {m.text}
      </div>
    ))}
  </div>
);
