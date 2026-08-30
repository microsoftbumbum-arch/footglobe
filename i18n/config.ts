export const localeOptions = [
  { code: "en", label: "English", short: "EN", dir: "ltr" },
  { code: "pt-BR", label: "Português (Brasil)", short: "PT", dir: "ltr" },
  { code: "pt-PT", label: "Português (Portugal)", short: "PT", dir: "ltr" },
  { code: "es", label: "Español", short: "ES", dir: "ltr" },
  { code: "fr", label: "Français", short: "FR", dir: "ltr" },
  { code: "de", label: "Deutsch", short: "DE", dir: "ltr" },
  { code: "it", label: "Italiano", short: "IT", dir: "ltr" },
  { code: "nl", label: "Nederlands", short: "NL", dir: "ltr" },
  { code: "pl", label: "Polski", short: "PL", dir: "ltr" },
  { code: "cs", label: "Čeština", short: "CS", dir: "ltr" },
  { code: "sv", label: "Svenska", short: "SV", dir: "ltr" },
  { code: "da", label: "Dansk", short: "DA", dir: "ltr" },
  { code: "no", label: "Norsk", short: "NO", dir: "ltr" },
  { code: "el", label: "Ελληνικά", short: "EL", dir: "ltr" },
  { code: "ro", label: "Română", short: "RO", dir: "ltr" },
  { code: "tr", label: "Türkçe", short: "TR", dir: "ltr" },
  { code: "ru", label: "Русский", short: "RU", dir: "ltr" },
  { code: "uk", label: "Українська", short: "UK", dir: "ltr" },
  { code: "ar", label: "العربية", short: "AR", dir: "rtl" },
  { code: "hi", label: "हिन्दी", short: "HI", dir: "ltr" },
  { code: "id", label: "Bahasa Indonesia", short: "ID", dir: "ltr" },
  { code: "vi", label: "Tiếng Việt", short: "VI", dir: "ltr" },
  { code: "th", label: "ไทย", short: "TH", dir: "ltr" },
  { code: "ja", label: "日本語", short: "JA", dir: "ltr" },
  { code: "ko", label: "한국어", short: "KO", dir: "ltr" },
  { code: "zh-CN", label: "简体中文", short: "简", dir: "ltr" },
  { code: "zh-TW", label: "繁體中文", short: "繁", dir: "ltr" },
] as const;

export type Locale = (typeof localeOptions)[number]["code"];
export type Direction = (typeof localeOptions)[number]["dir"];

export const defaultLocale: Locale = "en";
export const localeStorageKey = "footglobe-locale";
export const themeStorageKey = "footglobe-theme";

export const localeAliases: Record<string, Locale> = {
  "zh-hk": "zh-TW",
  "zh-mo": "zh-TW",
  "zh-sg": "zh-CN",
  nb: "no",
  "nb-no": "no",
  nn: "no",
  "nn-no": "no",
  in: "id",
};

export function resolveLocale(values: readonly string[]): Locale {
  for (const raw of values) {
    const normalized = raw.replace("_", "-");
    const alias = localeAliases[normalized.toLowerCase()];
    if (alias) return alias;
    const exact = localeOptions.find(({ code }) => code.toLowerCase() === normalized.toLowerCase());
    if (exact) return exact.code;

    const base = normalized.split("-")[0].toLowerCase();
    const partial = localeOptions.find(({ code }) => code.split("-")[0].toLowerCase() === base);
    if (partial) return partial.code;
  }
  return defaultLocale;
}

export function localeDirection(locale: Locale): Direction {
  return localeOptions.find((option) => option.code === locale)?.dir ?? "ltr";
}
