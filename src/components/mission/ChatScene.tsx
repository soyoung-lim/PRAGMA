import type { ReactNode } from "react";

/** 자연어 상황문을 메타데이터 라벨 없이 문장별로 읽기 좋게 나눈다. */
export function SituationText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const sentences =
    text
      .match(/[^.!?。！？]+[.!?。！？]?/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [text];
  return (
    <div className={className}>
      {sentences.map((sentence, index) => (
        <p key={`${sentence}-${index}`} className={index === 0 ? "" : "mt-1"}>
          {sentence}
        </p>
      ))}
    </div>
  );
}

// 위챗 스타일 대화 스킨 — 미션 UX 프로토타입 v2 정본(2026-07-25) 이식.
// 채널 상표는 무표기(0-k·79①): "대화 맥락 · 상대"만 노출하고 메신저/이메일 상표는 쓰지 않는다.
// 상황+관계 = 상단 공지 카드, 본문 = 말풍선 스레드(선행발화 them / 내 산출 me).

// 모던 플랫 SVG 아바타(실루엣 + 그라데이션 배경).
export function ChatAvatar({ side }: { side: "them" | "me" }) {
  return (
    <span
      className={[
        "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-white shadow-[0_1px_3px_rgba(0,0,0,0.16)]",
        side === "them"
          ? "bg-gradient-to-br from-[#93A3B6] to-[#5E7186]"
          : "bg-gradient-to-br from-[#8CE768] to-[#46A836]",
      ].join(" ")}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[19px] w-[19px] opacity-95">
        <circle cx="12" cy="8" r="4" />
        <path d="M12 13.6c-4.4 0-8 2.6-8 6.1 0 .4.3.7.7.7h14.6c.4 0 .7-.3.7-.7 0-3.5-3.6-6.1-8-6.1z" />
      </svg>
    </span>
  );
}

/** 대화 말풍선 한 줄(아바타 + 버블). me/them, me의 draft 변형(점선 = 미발송 초안). */
export function ChatBubble({
  side,
  variant = "solid",
  children,
}: {
  side: "them" | "me";
  variant?: "solid" | "draft";
  children: ReactNode;
}) {
  const bubble =
    side === "them"
      ? "bg-white text-[#141414] rounded-bl-[5px] shadow-[0_1px_2px_rgba(20,30,45,0.1)]"
      : variant === "draft"
      ? "bg-[#EFFBE8] text-[#1a5200] rounded-br-[5px] border-[1.5px] border-dashed border-[#6bbf3f]"
      : "bg-gradient-to-b from-[#9EED7C] to-[#84E15E] text-[#0c3300] rounded-br-[5px]";
  return (
    <div className={["mb-3 flex items-end gap-2 last:mb-0", side === "me" ? "justify-end" : ""].join(" ")}>
      {side === "them" && <ChatAvatar side="them" />}
      <div className={["max-w-[70%] break-words rounded-[19px] px-3 py-2 text-[14.5px] leading-[1.46]", bubble].join(" ")}>
        {children}
      </div>
      {side === "me" && <ChatAvatar side="me" />}
    </div>
  );
}

/** 내 말풍선 위 우측 캡션 — "전하려는 뜻 · …" / 초안 안내. */
export function ChatCaption({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "draft" }) {
  return (
    <div
      className={[
        "mb-1.5 mr-[46px] text-right",
        tone === "draft" ? "text-[11px] font-semibold text-[#4a7a2a]" : "text-[13px] text-[#3E4C57]",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/** 상황+관계 공지 카드 + 말풍선 스레드. 채널 상표 무표기. */
export function ChatScene({
  situation,
  relation,
  eyebrow = "대화 맥락",
  extraTag,
  children,
}: {
  situation: string;
  relation: string;
  eyebrow?: string;
  extraTag?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-[#D7DDE5] bg-[#E7EBF0]">
      <div className="border-b border-[#E4E8EE] bg-[#F6F8FA] px-3.5 pb-3 pt-2.5">
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-muted-foreground">{eyebrow}</div>
        <SituationText
          text={situation}
          className="mt-1 text-[14.5px] font-bold leading-snug text-[#15202B]"
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-snug text-[#3E4C57]">
          <span className="rounded border border-[#D7DDE5] bg-white px-1.5 py-px text-[10px] font-extrabold text-[#5A6672]">상대</span>
          <span>{relation}</span>
          {extraTag}
        </div>
      </div>
      <div className="px-3.5 py-3.5">{children}</div>
    </div>
  );
}

/**
 * target 텍스트의 화용 표지를 제출 후에만 표시한다.
 * 포커스를 받을 수 있어 모바일 탭·키보드로도 위치를 확인할 수 있지만,
 * 정답 전체를 뜻하지는 않는다(설명은 호출 화면에 별도 노출).
 */
export function highlightZh(text: string, highlights: string[] | undefined): ReactNode {
  if (!highlights || highlights.length === 0) return text;
  const escaped = highlights
    .filter(Boolean)
    .map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  if (escaped.length === 0) return text;
  const re = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = text.split(re);
  return parts.map((p, i) =>
    highlights.includes(p) ? (
      <mark
        key={i}
        tabIndex={0}
        title="이 문항에서 살펴볼 표현 — 정답 전체를 뜻하지 않습니다"
        aria-label={`${p} — 이 문항에서 살펴볼 표현. 정답 전체를 뜻하지 않습니다.`}
        className="cursor-help rounded-[2px] border-b-2 border-[#D9A400] bg-[#FFE9A8] px-px outline-none transition-shadow focus:ring-2 focus:ring-[#15202B] focus:ring-offset-1"
      >
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
