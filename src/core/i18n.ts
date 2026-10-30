// UI strings: semantic keys ("card.lock.locked") in src/translations/<lang>.json.
// `{name}` placeholders are filled from `vars`. Unknown languages fall back to
// English; a missing key shows the key itself.

import EN from "../translations/en.json";
import PL from "../translations/pl.json";

const DICTS = { pl: PL as Record<string, string>, en: EN as Record<string, string> };

export type Lang = "pl" | "en";

let lang: Lang = "en";

/** From `hass.language` (or `hass.locale.language`): Polish stays Polish, everything else English. */
export function setLanguage(language: string | undefined): void {
  lang = language?.toLowerCase().startsWith("pl") ? "pl" : "en";
}

export const language = (): Lang => lang;

/** HA user profile formats (`hass.locale`). */
export interface HaLocale {
  language?: string;
  number_format?: string;
  time_format?: string;
}

let haLocale: HaLocale = {};

export function setLocale(l: HaLocale | undefined): void {
  haLocale = l ?? {};
}

/** BCP 47 locale for dates. */
export const locale = (): string => haLocale.language ?? (lang === "pl" ? "pl-PL" : "en-GB");

/** Locale for numbers, honouring the profile's number format. */
export function numberLocale(): string | undefined {
  switch (haLocale.number_format) {
    case "comma_decimal":
      return "en-US";
    case "decimal_comma":
      return "de-DE";
    case "space_comma":
      return "fr-FR";
    case "system":
      return undefined;
    default:
      return locale();
  }
}

/** 12-hour clock per the profile (`time_format`: language / system / 12 / 24). */
export function hour12(): boolean {
  switch (haLocale.time_format) {
    case "12":
      return true;
    case "24":
      return false;
    case "system":
      return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hourCycle?.startsWith("h1") ?? false;
    default:
      return new Intl.DateTimeFormat(locale(), { hour: "numeric" }).resolvedOptions().hourCycle?.startsWith("h1") ?? false;
  }
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let out = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

/** Plural form of a count for `*_one` / `*_few` / `*_many` keys (Polish has "few": 2–4, 22–24…). */
export function plural(n: number): "one" | "few" | "many" {
  if (n === 1) return "one";
  if (lang === "pl") {
    const d = n % 10, h = n % 100;
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return "few";
  }
  return "many";
}
