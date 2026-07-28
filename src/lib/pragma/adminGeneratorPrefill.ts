import {
  DIRECTION_LABEL,
  DOMAIN,
  LEVEL,
  MODE_LABEL,
  SPEECH_ACT_UI,
  type Domain,
  type GenMode,
  type LanguageDirection,
  type LearnerLevel,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import {
  THEME_ALLOWED_DOMAINS,
  THEME_LABEL,
  type ThemeCode,
} from "@/lib/pragma/scenarioTopics";

export interface GeneratorPrefill {
  speechAct: SpeechActUI;
  level: LearnerLevel;
  mode?: GenMode;
  domain?: Domain;
  direction?: LanguageDirection;
  theme?: ThemeCode;
}

const isKeyOf = <T extends string>(
  record: Record<T, string>,
  value: string | null,
): value is T =>
  value !== null && Object.prototype.hasOwnProperty.call(record, value);

export function buildGeneratorPrefillPath(prefill: GeneratorPrefill): string {
  const query = new URLSearchParams({
    from: "mission-grid",
    speech_act: prefill.speechAct,
    level: prefill.level,
  });
  if (prefill.mode) query.set("mode", prefill.mode);
  if (prefill.domain) query.set("domain", prefill.domain);
  if (prefill.direction) query.set("direction", prefill.direction);
  if (prefill.theme) query.set("theme", prefill.theme);
  return `/admin/generator?${query.toString()}`;
}

export function parseGeneratorPrefill(
  query: URLSearchParams,
): GeneratorPrefill | null {
  if (query.get("from") !== "mission-grid") return null;

  const speechAct = query.get("speech_act");
  const level = query.get("level");
  if (!isKeyOf(SPEECH_ACT_UI, speechAct) || !isKeyOf(LEVEL, level)) {
    return null;
  }

  const mode = query.get("mode");
  const domain = query.get("domain");
  const direction = query.get("direction");
  const theme = query.get("theme");

  const validTheme = isKeyOf(THEME_LABEL, theme) ? theme : undefined;
  const parsedDomain = isKeyOf(DOMAIN, domain)
    ? domain
    : validTheme
      ? THEME_ALLOWED_DOMAINS[validTheme][0]
      : undefined;
  const parsedTheme =
    validTheme &&
    (!parsedDomain || THEME_ALLOWED_DOMAINS[validTheme].includes(parsedDomain))
      ? validTheme
      : undefined;

  return {
    speechAct,
    level,
    mode: isKeyOf(MODE_LABEL, mode) ? mode : undefined,
    domain: parsedDomain,
    direction: isKeyOf(DIRECTION_LABEL, direction) ? direction : undefined,
    theme: parsedTheme,
  };
}
