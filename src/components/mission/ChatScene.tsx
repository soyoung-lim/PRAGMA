import type { ReactNode } from "react";

// MPJ와 직접 산출 단계가 같은 장면 밀도를 사용한다.
// 높이를 고정하지 않고 패딩·행간·문장 간격만 통일해, 짧은 통역 장면에
// 불필요한 빈 공간이 생기지 않게 한다.
export const MISSION_SCENE_PANEL_DENSITY =
  "px-4 py-4 sm:px-[18px] sm:py-[18px]";
export const MISSION_SCENE_TEXT_DENSITY =
  "mt-3 max-w-[42rem] text-[15px] leading-[1.58]";
export const MISSION_SCENE_RELATION_GAP = "mt-3.5";

/** 자연어 상황문을 메타데이터 라벨 없이 문장별로 읽기 좋게 나눈다. */
export function SituationText({
  text,
  className = "",
  emphasizeFirst = false,
  spacious = false,
}: {
  text: string;
  className?: string;
  emphasizeFirst?: boolean;
  spacious?: boolean;
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
            index === 0 ? "" : spacious ? "mt-1.5" : "mt-1",
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

// 브랜드를 직접 표기하지 않는 DM형 대화 스킨.
// 채널 상표는 무표기(0-k·79①): "대화 맥락 · 상대"만 노출하고 메신저/이메일 상표는 쓰지 않는다.
// 상황+관계 = 상단 공지 카드, 본문 = 말풍선 스레드(선행발화 them / 내 산출 me).

// 상대만 표시하는 중립 아바타. 학습자 쪽은 말풍선 정렬만으로 구분한다.
export function ChatAvatar() {
  return (
    <span
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#C9CED6] text-white shadow-[0_1px_2px_rgba(21,32,43,0.1)]"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px] opacity-90">
        <circle cx="12" cy="8" r="4" />
        <path d="M12 13.6c-4.4 0-8 2.6-8 6.1 0 .4.3.7.7.7h14.6c.4 0 .7-.3.7-.7 0-3.5-3.6-6.1-8-6.1z" />
      </svg>
    </span>
  );
}

/** DM형 대화 말풍선 한 줄. 상대 아바타만 표시한다. */
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
      ? "border border-[#E1E5EA] bg-white text-[#15202B] shadow-[0_1px_3px_rgba(21,32,43,0.1)]"
      : variant === "draft"
      ? "bg-[#0A84FF] text-white"
      : "bg-[#0A84FF] text-white";
  return (
    <div className={["mb-3 flex items-end gap-2 last:mb-0", side === "me" ? "justify-end" : ""].join(" ")}>
      {side === "them" && <ChatAvatar />}
      <div className={["max-w-[78%] break-words rounded-[24px] px-3.5 py-2.5 text-[15px] font-medium leading-[1.5]", bubble].join(" ")}>
        {children}
      </div>
    </div>
  );
}

/** 내 말풍선의 우측 캡션. 의도는 말풍선 아래, 초안 상태는 위에 둔다. */
export function ChatCaption({
  children,
  tone = "muted",
  placement = "above",
}: {
  children: ReactNode;
  tone?: "muted" | "draft";
  placement?: "above" | "below";
}) {
  return (
    <div
      className={[
        "mr-1 text-right",
        placement === "below" ? "-mt-1 mb-2" : "mb-1.5",
        tone === "draft" ? "text-[11px] font-semibold text-[#52697E]" : "text-[13px] text-[#3E4C57]",
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
  threadEyebrow = "메시지 작성 중",
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
        "border-l-4 border-l-[#FAD338] bg-[linear-gradient(135deg,#FFFDF4_0%,#FFFFFF_74%)]",
        MISSION_SCENE_PANEL_DENSITY,
        separatePanels
          ? "rounded-2xl border border-[#E4E0CE] shadow-[0_5px_18px_rgba(21,32,43,0.04)]"
          : "border-b border-[#E4E8EE]",
      ].join(" ")}
    >
      <div
        className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#5A6672]"
      >
        <span className="h-2 w-2 rounded-full bg-[#FAD338] shadow-[0_0_0_3px_rgba(250,211,56,0.22)]" aria-hidden="true" />
        {eyebrow}
      </div>
      <SituationText
        text={situation}
        emphasizeFirst
        spacious
        className={MISSION_SCENE_TEXT_DENSITY}
      />
      <div
        className={[
          "inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-[#D7DDE5] bg-white/90 px-2.5 py-1 text-[12.5px] leading-snug text-[#3E4C57] shadow-[0_1px_2px_rgba(20,30,45,0.06)]",
          MISSION_SCENE_RELATION_GAP,
        ].join(" ")}
      >
        <span className="text-[10px] font-extrabold text-[#5A6672]">상대</span>
        <span className="font-semibold">{counterpart}</span>
        {extraTag}
      </div>
    </div>
  );

  if (separatePanels) {
    return (
      <div className="my-1.5 space-y-3">
        {situationPanel}
        <div className="overflow-hidden rounded-2xl border border-[#CBD5DD] bg-[#E8EDF2] shadow-[0_7px_20px_rgba(21,32,43,0.06)]">
          <div className="flex items-center border-b border-[#D5DDE4] bg-white/90 px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#536675]">
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8DA0AF]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#B1BEC8]" />
              </span>
              {threadEyebrow}
            </div>
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
        className="cursor-help bg-transparent p-0 text-inherit underline decoration-[#FAD338] decoration-[3px] underline-offset-[4px] outline-none transition-[text-decoration-thickness] focus-visible:decoration-[4px]"
      >
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
