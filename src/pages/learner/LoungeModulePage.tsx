import { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";

import { LoungeShell } from "@/components/learner/LoungeShell";
import { loungeItemsFor } from "@/lib/lounge/loungeCatalog";
import {
  LOUNGE_MODULES,
  isLoungeModuleId,
  loungeModuleMeta,
  type LoungeItem,
  type LoungeModuleId,
} from "@/lib/lounge/loungeTypes";

const ModuleDock = ({ current, position, total }: {
  current: LoungeModuleId;
  position: number;
  total: number;
}) => (
  <div className="flex shrink-0 flex-wrap items-center gap-2 py-3">
    <Link
      to="/learner/lounge"
      className="inline-flex items-center gap-1 rounded-xl border border-[#D3CADB] bg-white/75 px-3 py-2 text-xs font-bold text-[#4F4160] hover:bg-white"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      라운지
    </Link>
    <nav className="ml-auto flex gap-1 rounded-xl bg-[#E8E2ED] p-1" aria-label="라운지 모듈">
      {LOUNGE_MODULES.map((module) => (
        <Link
          key={module.id}
          to={`/learner/lounge/${module.id}`}
          aria-current={module.id === current ? "page" : undefined}
          className={[
            "rounded-lg px-2.5 py-1.5 text-xs font-bold transition",
            module.id === current
              ? "bg-white text-[#40384F] shadow-sm"
              : "text-[#7D7487] hover:text-[#40384F]",
          ].join(" ")}
        >
          {module.title}
        </Link>
      ))}
    </nav>
    <span className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-black text-[#716879]">
      {position} / {total}
    </span>
  </div>
);

const conciseContext = (context: string) => {
  const [relation, channel] = context.split("·").map((part) => part.trim());
  if (!channel) return context;
  const subject = relation.includes("→") ? relation.split("→").at(-1)?.trim() : relation;
  return `${channel} · ${subject}`;
};

const activityPrompt = (module: LoungeModuleId) => ({
  decode: "이 장면에 가장 가까운 번역은?",
  culture: "이 장면을 가장 잘 살린 번역은?",
  literal: "가장 자연스럽게 옮긴 문장은?",
})[module];

const SourceRefs = ({ item, onDark = false }: { item: LoungeItem; onDark?: boolean }) => {
  const linked = item.source_refs.filter((source) => source.url);
  if (!linked.length) return null;
  return (
    <details className={["text-xs", onDark ? "text-white/75" : "text-[#716879]"].join(" ")}>
      <summary className="w-fit cursor-pointer font-bold">확인한 출처</summary>
      <ul className="mt-1 space-y-1">
        {linked.map((source) => (
          <li key={source.url}>
            <a
              className="inline-flex items-start gap-1 underline decoration-current underline-offset-2"
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              <span>{source.label}</span>
              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            </a>
            {source.checked_at && <span className="ml-1 text-[11px]">· {source.checked_at}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
};

const LoungeActivity = ({ item, accent, soft, scene }: {
  item: LoungeItem;
  accent: string;
  soft: string;
  scene: string;
}) => {
  const [pick, setPick] = useState<string | null>(null);
  const selected = item.choices.find((choice) => choice.id === pick);
  const isLongCultureSource = item.module === "culture" && item.source_text.length > 20;
  const cultureSourceSize = item.source_text.length > 24
    ? "text-[13px]"
    : item.source_text.length > 20
      ? "text-[14px]"
      : "text-[15px]";

  return (
    <div className={[
      "grid min-h-0 gap-3 lg:h-[330px]",
      isLongCultureSource ? "lg:grid-cols-[0.96fr_1.04fr]" : "lg:grid-cols-[0.78fr_1.22fr]",
    ].join(" ")}>
      <section
        className="flex min-h-56 flex-col justify-center rounded-3xl p-5 text-white lg:min-h-0"
        style={{ backgroundColor: scene }}
      >
        <span
          className="w-fit max-w-full rounded-full bg-white/20 px-3 py-1 text-[11px] font-black text-white"
        >
          {conciseContext(item.context)}
        </span>
        <h2 className="mt-3 break-keep text-xl font-black leading-7">{item.title}</h2>
        <div
          lang={item.language_direction === "zh_ko" ? "zh" : "ko"}
          className={[
            "mt-3 rounded-2xl bg-black/10 px-4 py-3 font-semibold",
            item.language_direction === "zh_ko" ? "font-zh" : "",
            item.module === "culture"
              ? `whitespace-nowrap leading-6 ${cultureSourceSize}`
              : "text-base leading-7",
          ].join(" ")}
        >
          {item.source_text}
        </div>
        <div className="mt-auto pt-4">
          <SourceRefs item={item} onDark />
        </div>
      </section>

      <section className="flex min-h-0 flex-col rounded-3xl border border-[#DCD5E4] bg-[#FCFAFD] p-4">
        <h3 className="break-keep text-base font-black leading-6 text-[#292533]">{activityPrompt(item.module)}</h3>
        <div className="mt-3 grid gap-2">
          {item.choices.map((choice) => {
            const chosen = choice.id === pick;
            const showCorrect = pick !== null && choice.id === item.answer_id;
            const showWrong = pick !== null && chosen && choice.id !== item.answer_id;
            return (
              <button
                key={choice.id}
                type="button"
                aria-pressed={chosen}
                onClick={() => setPick(choice.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-[13px] font-semibold leading-5 transition"
                style={showCorrect
                  ? { borderColor: "#2F9E6F", backgroundColor: "#E8F7EF", color: "#245D45" }
                  : showWrong
                    ? { borderColor: "#D65C5C", backgroundColor: "#FDECEC", color: "#7A3434" }
                    : { borderColor: "#DDD6E2", backgroundColor: "#FFFFFF", color: "#514A58" }}
              >
                <span className={item.language_direction === "ko_zh" ? "font-zh" : undefined}>{choice.label}</span>
                {showCorrect && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F9E6F] text-white">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">정답</span>
                  </span>
                )}
                {showWrong && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D65C5C] text-white">
                    <X className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">선택한 오답</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {pick && (
          <div className="mt-3 animate-in border-t border-[#E1DAE6] pt-3 duration-200 fade-in slide-in-from-bottom-1" aria-live="polite">
            <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: soft }}>
              <p className="text-[12px] font-black leading-4" style={{ color: accent }}>한 줄 포인트</p>
              <p className="mt-1 break-keep text-[14px] font-medium leading-5 text-[#433D49]">{item.quick_point}</p>
            </div>
            <span className="sr-only">내 선택 · {selected?.label}</span>
          </div>
        )}
      </section>
    </div>
  );
};

const LoungeModulePage = () => {
  const { module: moduleParam } = useParams();
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [moduleParam]);
  if (!isLoungeModuleId(moduleParam)) return <Navigate to="/learner/lounge" replace />;

  const module = loungeModuleMeta(moduleParam);
  const items = loungeItemsFor(moduleParam);
  const safeIndex = Math.min(index, items.length - 1);
  const item = items[safeIndex];
  const move = (next: number) => {
    setIndex(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <LoungeShell>
      <main className="mx-auto w-full max-w-4xl pb-20 lg:flex lg:h-[calc(100svh-8rem)] lg:flex-col lg:justify-center lg:overflow-hidden lg:pb-0">
        <h1 className="sr-only">{module.title}</h1>
        <ModuleDock current={module.id} position={safeIndex + 1} total={items.length} />
        <LoungeActivity
          key={item.id}
          item={item}
          accent={module.accent}
          soft={module.soft}
          scene={module.scene}
        />

        <nav className="mt-3 flex shrink-0 items-center justify-between" aria-label="라운지 사례 이동">
          <button
            type="button"
            disabled={safeIndex === 0}
            onClick={() => move(safeIndex - 1)}
            className="inline-flex items-center gap-1 rounded-xl border border-[#D3CADB] bg-white/75 px-3 py-2 text-xs font-bold text-[#514A58] disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> 이전
          </button>
          <div className="h-1.5 min-w-32 overflow-hidden rounded-full bg-[#DED7E4]" aria-hidden>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${((safeIndex + 1) / items.length) * 100}%`, backgroundColor: module.accent }}
            />
          </div>
          <button
            type="button"
            disabled={safeIndex === items.length - 1}
            onClick={() => move(safeIndex + 1)}
            className="inline-flex items-center gap-1 rounded-xl border border-[#D3CADB] bg-white/75 px-3 py-2 text-xs font-bold text-[#514A58] disabled:opacity-30"
          >
            다음 <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </nav>
      </main>
    </LoungeShell>
  );
};

export default LoungeModulePage;
