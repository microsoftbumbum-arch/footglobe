"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import english from "@/locales/en.json";
import { defaultLocale, localeDirection, localeOptions, localeStorageKey, resolveLocale, themeStorageKey } from "./config";
import type { Direction, Locale } from "./config";

type Dictionary = Record<string, string>;
type Theme = "dark" | "light";
const englishDictionary = english as Dictionary;

const dictionaryLoaders: Record<Locale, () => Promise<{ default: Dictionary }>> = {
  en: () => import("@/locales/en.json"),
  "pt-BR": () => import("@/locales/pt-BR.json"),
  "pt-PT": () => import("@/locales/pt-PT.json"),
  es: () => import("@/locales/es.json"),
  fr: () => import("@/locales/fr.json"),
  de: () => import("@/locales/de.json"),
  it: () => import("@/locales/it.json"),
  nl: () => import("@/locales/nl.json"),
  pl: () => import("@/locales/pl.json"),
  cs: () => import("@/locales/cs.json"),
  sv: () => import("@/locales/sv.json"),
  da: () => import("@/locales/da.json"),
  no: () => import("@/locales/no.json"),
  el: () => import("@/locales/el.json"),
  ro: () => import("@/locales/ro.json"),
  tr: () => import("@/locales/tr.json"),
  ru: () => import("@/locales/ru.json"),
  uk: () => import("@/locales/uk.json"),
  ar: () => import("@/locales/ar.json"),
  hi: () => import("@/locales/hi.json"),
  id: () => import("@/locales/id.json"),
  vi: () => import("@/locales/vi.json"),
  th: () => import("@/locales/th.json"),
  ja: () => import("@/locales/ja.json"),
  ko: () => import("@/locales/ko.json"),
  "zh-CN": () => import("@/locales/zh-CN.json"),
  "zh-TW": () => import("@/locales/zh-TW.json"),
};

interface I18nContextValue {
  locale: Locale;
  direction: Direction;
  dictionary: Dictionary;
  theme: Theme;
  timeZone: string;
  setLocale: (locale: Locale) => void;
  toggleTheme: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  plural: (key: string, count: number, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, values: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, updateLocale] = useState<Locale>(defaultLocale);
  const [dictionary, setDictionary] = useState<Dictionary>(englishDictionary);
  const [theme, setTheme] = useState<Theme>("dark");
  const [timeZone, setTimeZone] = useState("UTC");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    let savedTheme: string | null = null;
    try {
      saved = localStorage.getItem(localeStorageKey);
      savedTheme = localStorage.getItem(themeStorageKey);
    } catch { /* Storage can be unavailable in restricted browsing modes. */ }

    const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language || defaultLocale];
    const detected = resolveLocale(saved ? [saved] : browserLanguages);
    let media: MediaQueryList | null = null;
    try { media = window.matchMedia("(prefers-color-scheme: light)"); } catch { /* dark remains the fallback */ }
    const initialTheme: Theme = savedTheme === "light" || savedTheme === "dark" ? savedTheme : media?.matches ? "light" : "dark";

    const frame = requestAnimationFrame(() => {
      updateLocale(detected);
      setTheme(initialTheme);
      setTimeZone(browserTimeZone());
      setInitialized(true);
    });

    const systemThemeChanged = (event: MediaQueryListEvent) => {
      let hasManualTheme = false;
      try { hasManualTheme = Boolean(localStorage.getItem(themeStorageKey)); } catch { /* follow the system */ }
      if (!hasManualTheme) setTheme(event.matches ? "light" : "dark");
    };

    media?.addEventListener("change", systemThemeChanged);
    return () => {
      cancelAnimationFrame(frame);
      media?.removeEventListener("change", systemThemeChanged);
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;
    let current = true;
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection(locale);
    dictionaryLoaders[locale]().then((module) => {
      if (!current) return;
      const next = module.default;
      setDictionary(next);
      document.documentElement.dataset.localeReady = "true";
      document.title = next.metaTitle ?? englishDictionary.metaTitle ?? "FootGlobe";
      const description = document.querySelector('meta[name="description"]');
      if (description) description.setAttribute("content", next.metaDescription ?? englishDictionary.metaDescription ?? "");
    }).catch(() => {
      if (!current) return;
      setDictionary(englishDictionary);
      document.documentElement.dataset.localeReady = "true";
      document.title = englishDictionary.metaTitle ?? "FootGlobe";
    });

    return () => { current = false; };
  }, [initialized, locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const setLocale = useCallback((next: Locale) => {
    try { localStorage.setItem(localeStorageKey, next); } catch { /* preference remains active for this visit */ }
    updateLocale(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try { localStorage.setItem(themeStorageKey, next); } catch { /* preference remains active for this visit */ }
      return next;
    });
  }, []);

  const t = useCallback((key: string, values?: Record<string, string | number>) => interpolate(dictionary[key] ?? englishDictionary[key] ?? key, values), [dictionary]);
  const plural = useCallback((key: string, count: number, values?: Record<string, string | number>) => {
    const category = new Intl.PluralRules(locale).select(count);
    const categoryKey = `${key}.${category}`;
    const categoryValue = dictionary[categoryKey] ?? englishDictionary[categoryKey];
    return categoryValue
      ? interpolate(categoryValue, { count, ...values })
      : t(`${key}.other`, { count, ...values });
  }, [dictionary, locale, t]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    direction: localeDirection(locale),
    dictionary,
    theme,
    timeZone,
    setLocale,
    toggleTheme,
    t,
    plural,
  }), [dictionary, locale, plural, setLocale, t, theme, timeZone, toggleTheme]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

export { localeOptions };
