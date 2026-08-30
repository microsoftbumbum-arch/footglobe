"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Heart, Languages, Moon, Search, Sun, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FootballGlobe } from "@/components/globe/FootballGlobe";
import { CountryPanel } from "@/components/matches/CountryPanel";
import { CountryFlag } from "@/components/CountryFlag";
import { MatchDetails } from "@/components/matches/MatchDetails";
import { DonationDialog } from "@/components/donations/DonationDialog";
import { RetroCountryPanel } from "@/components/retro/RetroCountryPanel";
import { RetroMatchDetails } from "@/components/retro/RetroMatchDetails";
import { RetroGoalCenter } from "@/components/retro/RetroGoalCenter";
import { RetroSoundControl } from "@/components/retro/RetroSoundControl";
import { unlockRetroGoalAudio } from "@/components/retro/retro-goal-audio";
import { getCountryMetadata } from "@/lib/country-metadata";
import { localeOptions, useI18n } from "@/i18n/I18nProvider";
import type { Locale } from "@/i18n/config";
import type { CountryMatches, FootballMatch, MatchesResponse } from "@/types/football";
import type { RetroFixture, RetroSeason, RetroSeasonsResponse, RetroTodayResponse } from "@/types/retro";

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dayDate = () => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date;
};
const DATE_MEMORY_CACHE_MS = 5 * 60_000;
const RETRO_REVALIDATE_MS = 12_000;
type FootGlobeMode = "today" | "retro";

function groupCountries(matches: FootballMatch[]): CountryMatches[] {
  const grouped = new Map<string, FootballMatch[]>();
  for (const match of matches) grouped.set(match.countryCode, [...(grouped.get(match.countryCode) ?? []), match]);
  return [...grouped.entries()].map(([code, countryMatches]) => {
    const meta = getCountryMetadata(code) ?? getCountryMetadata(countryMatches[0].country);
    return meta ? {
      country: countryMatches[0].country,
      ...meta,
      matches: countryMatches,
    } : {
      country: countryMatches[0].country,
      countryCode: code,
      flag: "",
      globeName: countryMatches[0].country,
      lat: 0,
      lng: 0,
      matches: countryMatches,
    };
  });
}

function replayDateLabel(date: string | undefined) {
  if (!date) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
}

export function FootGlobeApp() {
  const { locale, theme, timeZone, setLocale, toggleTheme, t, plural } = useI18n();
  const [mode, setMode] = useState<FootGlobeMode>("today");
  const [dateKey, setDateKey] = useState(() => iso(dayDate()));
  const [data, setData] = useState<MatchesResponse | null>(null);
  const [retroSeasons, setRetroSeasons] = useState<RetroSeason[]>([]);
  const [retroSeason, setRetroSeason] = useState<string | null>(null);
  const [retroData, setRetroData] = useState<RetroTodayResponse | null>(null);
  const [retroLoading, setRetroLoading] = useState(false);
  const [retroError, setRetroError] = useState(false);
  const [selected, setSelected] = useState<CountryMatches | null>(null);
  const [matchDetails, setMatchDetails] = useState<FootballMatch | null>(null);
  const [retroMatchDetails, setRetroMatchDetails] = useState<RetroFixture | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [donationOpen, setDonationOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const headerToolsRef = useRef<HTMLDivElement>(null);
  const dateCacheRef = useRef(new Map<string, { data: MatchesResponse; storedAt: number }>());

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextDateKey = iso(dayDate());
      setDateKey((current) => current === nextDateKey ? current : nextDateKey);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (mode !== "today") return;
    const controller = new AbortController();
    fetch(`/api/matches?date=${dateKey}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("matches_unavailable");
        return response.json() as Promise<MatchesResponse>;
      })
      .then((result) => {
        dateCacheRef.current.set(dateKey, { data: result, storedAt: Date.now() });
        setData(result);
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        const entry = dateCacheRef.current.get(dateKey);
        const previous = entry && Date.now() - entry.storedAt <= DATE_MEMORY_CACHE_MS ? entry.data : null;
        if (entry && !previous) dateCacheRef.current.delete(dateKey);
        if (previous) setData({ ...previous, stale: true, error: "STALE_DATA" });
        else setData({ date: dateKey, source: "unavailable", coverage: "unavailable", matches: [], error: "MATCHES_UNAVAILABLE" });
      });
    return () => controller.abort();
  }, [dateKey, mode]);

  useEffect(() => {
    if (mode !== "retro") return;
    const controller = new AbortController();
    setRetroLoading(true);
    fetch("/api/retro/seasons", { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("retro_seasons_unavailable");
        return response.json() as Promise<RetroSeasonsResponse>;
      })
      .then((result) => {
        setRetroSeasons(result.seasons);
        if (result.seasons.length === 0) {
          setRetroError(true);
          setRetroLoading(false);
        }
        setRetroSeason((current) => {
          if (current && result.seasons.some((season) => season.slug === current)) return current;
          return result.seasons[0]?.slug ?? null;
        });
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setRetroSeasons([]);
        setRetroSeason(null);
        setRetroError(true);
        setRetroLoading(false);
      });
    return () => controller.abort();
  }, [mode]);

  useEffect(() => {
    if (mode !== "retro" || !retroSeason) return;
    const controller = new AbortController();
    let stopped = false;
    let inFlight = false;

    const load = async (initial = false) => {
      if (inFlight || stopped) return;
      inFlight = true;
      if (initial) setRetroLoading(true);
      try {
        const response = await fetch(`/api/retro/today?season=${encodeURIComponent(retroSeason)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("retro_today_unavailable");
        const result = await response.json() as RetroTodayResponse;
        if (stopped) return;
        setRetroData(result);
        setRetroError(false);
      } catch (error) {
        if (!controller.signal.aborted && !stopped) setRetroError(true);
      } finally {
        inFlight = false;
        if (initial && !stopped) setRetroLoading(false);
      }
    };

    setRetroData(null);
    setRetroError(false);
    void load(true);
    const timer = window.setInterval(() => void load(false), RETRO_REVALIDATE_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      controller.abort();
    };
  }, [mode, retroSeason]);

  useEffect(() => {
    setSelected(null);
    setMatchDetails(null);
    setRetroMatchDetails(null);
    setQuery("");
    setSearchOpen(false);
    setSearchPanelOpen(false);
    setUtilityMenuOpen(false);
  }, [mode]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (headerToolsRef.current && !headerToolsRef.current.contains(target)) {
        setUtilityMenuOpen(false);
        setSearchPanelOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const retroFixtures = retroData?.fixtures ?? [];
  const retroFixtureCount = retroFixtures.length;
  const retroActiveNowCount = useMemo(
    () => retroFixtures.filter((fixture) => fixture.simulation.status === "live" || fixture.simulation.status === "halftime").length,
    [retroFixtures],
  );
  // Retro "today" is a full historical matchday. Never reduce the rendered list to live fixtures only.
  const activeMatches = useMemo<FootballMatch[]>(() => mode === "retro" ? retroFixtures : (data?.matches ?? []), [data?.matches, mode, retroFixtures]);

  const countries = useMemo(() => {
    let displayNames: Intl.DisplayNames | null = null;
    try { displayNames = new Intl.DisplayNames([locale], { type: "region" }); } catch { /* keep API country names */ }
    const footballNations = new Set(["England", "Scotland", "Wales", "Northern Ireland"]);
    return groupCountries(activeMatches).map((country) => {
      if (mode === "retro" && footballNations.has(country.country)) return country;
      try { return { ...country, country: displayNames?.of(country.countryCode) ?? country.country }; }
      catch { return country; }
    });
  }, [activeMatches, locale, mode]);

  useEffect(() => {
    if (!selected) return;
    const refreshed = countries.find((country) => country.countryCode === selected.countryCode);
    if (!refreshed) setSelected(null);
    else if (refreshed !== selected) setSelected(refreshed);
  }, [countries, selected]);

  const searchResults = useMemo(() => {
    const value = query.trim().toLocaleLowerCase(locale);
    if (!value) return [];
    return countries.filter((country) =>
      country.country.toLocaleLowerCase(locale).includes(value) ||
      country.matches.some((match) => `${match.homeTeam.name} ${match.awayTeam.name} ${match.competition}`.toLocaleLowerCase(locale).includes(value)),
    ).slice(0, 6);
  }, [countries, locale, query]);

  const pickCountry = useCallback((country: CountryMatches) => {
    setSelected(country);
    setSearchOpen(false);
    setSearchPanelOpen(false);
    setUtilityMenuOpen(false);
    setQuery("");
  }, []);

  const selectedSeason = retroSeasons.find((season) => season.slug === retroSeason) ?? retroData?.season;
  const countriesTitle = plural("countriesGames.today", countries.length);
  const localTimeLabel = t("localTimesZone", { timeZone });
  const loading = mode === "retro" ? retroLoading && !retroData : data?.date !== dateKey;
  const retroTodayDate = replayDateLabel(dateKey);
  const retroReplayDate = replayDateLabel(retroData?.simulation.historicalDate);


  return (
    <main className={`app-shell ${mode === "retro" ? "is-retro" : ""} ${selected ? "has-country-selection" : ""}`}>
      <div className="star-field" aria-hidden="true" />

      <header className="topbar">
        <a className="brand" href="#top" aria-label={t("brandHome")}>
          <img className="brand-mark" src="/brand-mark.png" alt="" width={34} height={30} />
          <span className="brand-wordmark">FOOT<span>GLOBE</span></span>
        </a>

        <div className="date-nav mode-nav" aria-label={t("modeSelector")}>
          <button className={mode === "today" ? "active" : ""} type="button" aria-pressed={mode === "today"} onClick={() => { setMode("today"); setUtilityMenuOpen(false); setSearchPanelOpen(false); setSearchOpen(false); }}>{t("today")}</button>
          <button className={mode === "retro" ? "active retro-mode-button" : "retro-mode-button"} type="button" aria-pressed={mode === "retro"} onClick={() => { unlockRetroGoalAudio(); setMode("retro"); setUtilityMenuOpen(false); setSearchPanelOpen(false); setSearchOpen(false); }}>{t("retroMode")}</button>
        </div>

        <div className="header-tools" ref={headerToolsRef}>
          <div className={`utility-menu ${utilityMenuOpen ? "is-open" : ""} ${mode === "retro" ? "has-sound" : ""}`}>
            <button
              type="button"
              className="utility-action utility-search-action"
              aria-label={t("searchLabel")}
              title={t("searchLabel")}
              aria-hidden={!utilityMenuOpen}
              tabIndex={utilityMenuOpen ? 0 : -1}
              onClick={() => { setSearchPanelOpen((current) => !current); setSearchOpen(false); }}
            >
              <Search size={17} aria-hidden="true" />
            </button>

            <Popover>
              <PopoverTrigger asChild>
                <button className="utility-action utility-language-action language-button" aria-label={t("selectLanguage")} title={t("selectLanguage")} aria-hidden={!utilityMenuOpen} tabIndex={utilityMenuOpen ? 0 : -1}>
                  <Languages size={16} /><span>{localeOptions.find((item) => item.code === locale)?.short}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="language-popover" align="end">
                <div className="language-list" role="listbox" aria-label={t("selectLanguage")}>
                  {localeOptions.map((option) => <button key={option.code} role="option" aria-selected={option.code === locale} className={option.code === locale ? "selected" : ""} lang={option.code} dir={option.dir} onClick={() => setLocale(option.code as Locale)}><span>{option.label}</span><small>{option.short}</small></button>)}
                </div>
              </PopoverContent>
            </Popover>

            <button
              type="button"
              className="utility-action utility-theme-action"
              onClick={() => { toggleTheme(); setSearchOpen(false); }}
              aria-label={theme === "dark" ? t("switchToLight") : t("switchToDark")}
              title={theme === "dark" ? t("switchToLight") : t("switchToDark")}
              aria-hidden={!utilityMenuOpen}
              tabIndex={utilityMenuOpen ? 0 : -1}
            >
              {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
            </button>

            {mode === "retro" && <RetroSoundControl className="utility-action utility-sound-action" hidden={!utilityMenuOpen} />}

            <button
              type="button"
              className="utility-menu-toggle"
              aria-label={utilityMenuOpen ? "Close menu" : "Menu"}
              aria-expanded={utilityMenuOpen}
              title="Menu"
              onClick={() => {
                setUtilityMenuOpen((current) => {
                  const next = !current;
                  if (!next) { setSearchPanelOpen(false); setSearchOpen(false); }
                  return next;
                });
              }}
            >
              <span /><span /><span />
            </button>

            {utilityMenuOpen && searchPanelOpen && <div className="utility-search-panel">
              <div className="search-wrap" ref={searchRef}>
                <Search size={16} aria-hidden="true" />
                <input autoFocus value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} placeholder={t("searchPlaceholder")} aria-label={t("searchLabel")} role="combobox" aria-haspopup="listbox" aria-controls="footglobe-search-results" aria-expanded={searchOpen} />
                {query && <button className="clear-search" onClick={() => setQuery("")} aria-label={t("clearSearch")}><X size={15} /></button>}
                {searchOpen && query && <div id="footglobe-search-results" className="search-results" role="listbox">
                  {searchResults.length ? searchResults.map((country) => <button key={country.countryCode} onClick={() => pickCountry(country)} role="option" aria-selected="false">
                    <CountryFlag code={country.countryCode} name={country.country} className="search-flag" /><span><b>{country.country}</b><small>{plural("matches", country.matches.length)}</small></span><ChevronRight size={15} />
                  </button>) : <p>{t("noMatchesFound")}</p>}
                </div>}
              </div>
            </div>}
          </div>
        </div>
      </header>

      <section id="top" className="globe-area" aria-busy={loading}>
        <div className="scene-label">
          <span className="scene-kicker">{mode === "retro" ? t("retroKicker") : t("kicker")}</span>
          <h1>
            {mode === "retro"
              ? <span className="retro-fixture-summary"><strong>{plural("matches", retroFixtureCount)}</strong><em>•</em><span>{retroActiveNowCount} {t("retroLiveNow")}</span></span>
              : countriesTitle}
          </h1>
          {selected && <div className="scene-selection-context"><CountryFlag code={selected.countryCode} name={selected.country} className="scene-selection-flag" /><span>{selected.country}</span><i>{selected.matches.length}</i></div>}
          {mode === "today" && data?.error && <span className="api-note">{data.stale ? t("apiStale") : t("apiUnavailable")}</span>}

          {mode === "retro" && <div className="retro-scene-meta">
            <span className="retro-badge">{t("retroModeBadge", { season: selectedSeason?.label ?? "—" })}</span>
            <div className="retro-date-pair">
              <b><span>{t("today")}:</span> {retroTodayDate}</b>
              {retroReplayDate && <b><span>{t("retroReplayHistoricalLabel")}:</span> {retroReplayDate}</b>}
            </div>
            {retroSeasons.length > 0 && <label className="retro-season-control"><span>{t("retroSeason")}</span><select value={retroSeason ?? ""} onChange={(event) => setRetroSeason(event.target.value)}>{retroSeasons.map((season) => <option value={season.slug} key={season.id}>{season.label}</option>)}</select></label>}
            {retroError && <span className="api-note">{t("retroUnavailable")}</span>}
          </div>}
        </div>

        <FootballGlobe countries={loading ? [] : countries} selectedCode={selected?.countryCode} onSelect={pickCountry} />
        {loading && <div className="data-sync" role="status"><span aria-hidden="true" />{mode === "retro" ? t("retroLoading") : t("loadingMatches")}</div>}
      </section>

      <nav className="country-rail" aria-label={`${t("countryList")}. ${localTimeLabel}`}>
        <span className="rail-label">{mode === "retro" ? t("retroWithMatches") : t("withMatches")}</span>
        <div className="rail-scroll scrollbar-thin">
          {countries.map((country) => <button key={country.countryCode} onClick={() => pickCountry(country)} className={selected?.countryCode === country.countryCode ? "selected" : ""}>
            <CountryFlag code={country.countryCode} name={country.country} className="rail-flag" /><span>{country.country}</span><b>{country.matches.length}</b>
          </button>)}
        </div>
        <span className="utc-mark" title={localTimeLabel}>{mode === "retro" ? t("retroReplayClock") : t("localTimes")}</span>
      </nav>

      <button className="donate-fab" onClick={() => setDonationOpen(true)} aria-label={`${t("donate")} — ${t("donateReason")}`}>
        <Heart size={14} fill="currentColor" />
        <span><b>{t("donate")}</b><small>{t("donateReason")}</small></span>
      </button>

      <DonationDialog open={donationOpen} onOpenChange={setDonationOpen} />
      {mode === "today" && <CountryPanel country={selected} onClose={() => setSelected(null)} onMatchOpen={setMatchDetails} />}
      {mode === "today" && <MatchDetails match={matchDetails} onClose={() => setMatchDetails(null)} />}
      {mode === "retro" && <RetroCountryPanel country={selected} onClose={() => setSelected(null)} onMatchOpen={setRetroMatchDetails} />}
      {mode === "retro" && <RetroMatchDetails match={retroMatchDetails} onClose={() => setRetroMatchDetails(null)} />}
      {mode === "retro" && <RetroGoalCenter fixtures={retroData?.fixtures ?? []} ready={Boolean(retroData)} syncAt={retroData?.fetchedAt} />}
    </main>
  );
}
