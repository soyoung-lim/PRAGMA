import type { ReactNode } from "react";

/** 자연어 상황문을 메타데이터 라벨 없이 문장별로 읽기 좋게 나눈다. */
export function SituationText({
  text,
  className = "",
  emphasizeFirst = false,
}: {
  text: string;
  className?: string;
  emphasizeFirst?: boolean;
}) {
  const sentences =
    text
      .match(/[^.!?。！？]+[.!?。！？]?/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [text];
  return (
    <div className={className}>
      {sentences.map((sentence, index) => (
        <p
          key={`${sentence}-${index}`}
          className={[
            index === 0 ? "" : "mt-1",
            emphasizeFirst && index === 0 ? "font-extrabold text-[#15202B]" : "",
            emphasizeFirst && index > 0 ? "font-medium text-[#3E4C57]" : "",
          ].join(" ")}
        >
          {sentence}
        </p>
      ))}
    </div>
  );
}

/**
 * legacy relation_ko가 "화자 → 상대"를 함께 담더라도 학습자 화면의 `상대`에는
 * 오른쪽 상대 정보만 보인다. 원문 데이터는 바꾸지 않아 기존 로그·검수 화면은 보존한다.
 */
export function learnerCounterpartLabel(relation: string): string {
  const arrowIndex = relation.search(/→|->/);
  if (arrowIndex < 0) return relation.trim();
  const counterpart = relation.slice(arrowIndex).replace(/^(?:→|->)\s*/, "").trim();
  return counterpart || relation.trim();
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
  eyebrow = "지금, 이 장면",
  separatePanels = false,
  threadEyebrow = "메신저 · 보내기 전",
  extraTag,
  children,
}: {
  situation: string;
  relation: string;
  eyebrow?: string;
  separatePanels?: boolean;
  threadEyebrow?: string;
  extraTag?: ReactNode;
  children: ReactNode;
}) {
  const counterpart = learnerCounterpartLabel(relation);
  const situationPanel = (
    <div
      className={[
        "border-l-4 border-l-[#FAD338] bg-[linear-gradient(135deg,#FFFDF4_0%,#FFFFFF_74%)] px-3.5 pb-3.5 pt-3",
        separatePanels
          ? "rounded-2xl border border-[#E4E0CE] shadow-[0_5px_18px_rgba(21,32,43,0.04)]"
          : "border-b border-[#E4E8EE]",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-[#5A6672]">
        <span className="h-2 w-2 rounded-full bg-[#FAD338] shadow-[0_0_0_3px_rgba(250,211,56,0.22)]" aria-hidden="true" />
        {eyebrow}
      </div>
      <SituationText
        text={situation}
        emphasizeFirst
        className="mt-2 text-[14.5px] leading-[1.52]"
      />
      <div className="mt-2.5 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-[#D7DDE5] bg-white/90 px-2.5 py-1 text-[12.5px] leading-snug text-[#3E4C57] shadow-[0_1px_2px_rgba(20,30,45,0.06)]">
        <span className="text-[10px] font-extrabold text-[#5A6672]">상대</span>
        <span className="font-semibold">{counterpart}</span>
        {extraTag}
      </div>
    </div>
  );

  if (separatePanels) {
    return (
      <div className="my-3 space-y-3">
        {situationPanel}
        <div className="overflow-hidden rounded-2xl border border-[#CBD5DD] bg-[#E8EDF2] shadow-[0_7px_20px_rgba(21,32,43,0.06)]">
          <div className="flex items-center justify-between border-b border-[#D5DDE4] bg-white/90 px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#536675]">
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8DA0AF]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#B1BEC8]" />
              </span>
              {threadEyebrow}
            </div>
            <span className="text-[10.5px] text-[#7A8791]">대화 미리보기</span>
          </div>
          <div className="px-3.5 py-3.5">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-[#D7DDE5] bg-[#E7EBF0]">
      {situationPanel}
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
