import { getCountryMetadata } from "@/lib/country-metadata";
import type { MatchStatus } from "@/types/football";
import type {
  RetroClip,
  RetroEvent,
  RetroFixture,
  RetroFixtureResponse,
  RetroKickoffPrecision,
  RetroSeason,
  RetroSeasonsResponse,
  RetroSimulationStatus,
  RetroSound,
  RetroTeam,
  RetroTodayResponse,
} from "@/types/retro";

const DEFAULT_FOOTGLOBE_API_URL = "https://footglobe-api-nu.vercel.app";
const REQUEST_TIMEOUT_MS = 8_000;

type JsonObject = Record<string, unknown>;
type Envelope = { success?: boolean; data?: unknown; meta?: JsonObject; message?: string; error?: unknown };
type NormalizedCountry = { id?: string; name?: string; slug?: string };
type RetroCountryCatalogEntry = { id: string; name: string; slug?: string };
type RetroCountryCatalog = Map<string, RetroCountryCatalogEntry>;

const COUNTRY_CATALOG_TTL_MS = 6 * 60 * 60_000;
const TEAM_ASSET_TTL_MS = 24 * 60 * 60_000;
const TEAM_ASSET_MISS_TTL_MS = 60 * 60_000;
let countryCatalogCache: { expiresAt: number; value: RetroCountryCatalog } | null = null;
const teamAssetCache = new Map<string, { expiresAt: number; logo: string | null }>();
const pendingTeamAssets = new Map<string, Promise<string | null>>();

export class FootGlobeRetroApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "FootGlobeRetroApiError";
    this.status = status;
  }
}

const asObject = (value: unknown): JsonObject | null => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
const asString = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value.trim() : undefined;
const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
};
const asBoolean = (value: unknown): boolean | undefined => typeof value === "boolean" ? value : undefined;

function firstString(...values: unknown[]) {
  for (const value of values) {
    const parsed = asString(value);
    if (parsed) return parsed;
  }
  return undefined;
}

function apiBase() {
  return (process.env.FOOTGLOBE_API_URL?.trim() || DEFAULT_FOOTGLOBE_API_URL).replace(/\/+$/, "");
}

async function request(path: string, signal?: AbortSignal): Promise<Envelope> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    const response = await fetch(`${apiBase()}${path}`, {
      headers: { Accept: "application/json", "Cache-Control": "no-cache", Pragma: "no-cache" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new FootGlobeRetroApiError("RETRO_HTTP", response.status);
    let body: Envelope;
    try { body = await response.json() as Envelope; }
    catch { throw new FootGlobeRetroApiError("RETRO_INVALID_JSON", response.status); }
    if (body.success === false) throw new FootGlobeRetroApiError("RETRO_REJECTED", response.status);
    return body;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof FootGlobeRetroApiError) throw error;
    throw new FootGlobeRetroApiError(controller.signal.aborted ? "RETRO_TIMEOUT" : "RETRO_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function normalizeSeason(value: unknown, index = 0): RetroSeason | null {
  if (typeof value === "string") {
    const slug = value.trim();
    return slug ? { id: slug, slug, label: slug } : null;
  }
  const item = asObject(value);
  if (!item) return null;
  const slug = firstString(item.slug, item.season, item.code, item.key, item.id);
  if (!slug) return null;
  const label = firstString(item.label, item.name, item.title, item.displayName, item.seasonName, item.season) ?? slug;
  return {
    id: firstString(item.id, slug) ?? `retro-season-${index}`,
    slug,
    label,
    name: firstString(item.name, item.title),
    startDate: firstString(item.startDate, item.start_date),
    endDate: firstString(item.endDate, item.end_date),
  };
}

function extractSeasonRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const object = asObject(data);
  if (!object) return [];
  for (const key of ["seasons", "items", "results"]) {
    const rows = object[key];
    if (Array.isArray(rows)) return rows;
  }
  return [];
}

function normalizeSimulationStatus(value: unknown): RetroSimulationStatus {
  const status = (asString(value) ?? "date_only").toLowerCase().replace(/[\s-]+/g, "_");
  if (status === "scheduled" || status === "live" || status === "halftime" || status === "finished" || status === "date_only") return status;
  return "date_only";
}

function mapStandardStatus(status: RetroSimulationStatus): MatchStatus {
  if (status === "live") return "LIVE";
  if (status === "halftime") return "HALFTIME";
  if (status === "finished") return "FINISHED";
  return "SCHEDULED";
}

function normalizePrecision(value: unknown): RetroKickoffPrecision {
  const precision = (asString(value) ?? "date").toLowerCase();
  return precision === "time" || precision === "simulated" || precision === "date" ? precision : "date";
}

function normalizeCountry(value: unknown): NormalizedCountry | undefined {
  if (typeof value === "string") return { name: value };
  const item = asObject(value);
  if (!item) return undefined;
  const name = firstString(item.name, item.countryName, item.label);
  const id = firstString(item.id, item.countryId);
  const slug = firstString(item.slug, item.countrySlug);
  return name || id || slug ? { id, name, slug } : undefined;
}

function normalizeTeam(value: unknown, fallbackName: string): RetroTeam {
  const item = asObject(value) ?? {};
  const country = normalizeCountry(item.country);
  const name = firstString(item.name, item.teamName, item.team_name, item.label) ?? fallbackName;
  return {
    id: firstString(item.id, item.teamId, item.team_id),
    slug: firstString(item.slug, item.teamSlug, item.team_slug),
    name,
    shortName: firstString(item.shortName, item.short_name, item.abbreviation, item.code) ?? name,
    logo: firstString(item.logoUrl, item.logo_url, item.logo, item.badgeUrl, item.badge_url, item.badge, item.crestUrl, item.crest_url, item.crest, item.teamLogo, item.team_logo, item.imageUrl, item.image_url),
    kitUrl: firstString(item.kitUrl, item.kit_url, item.kit, item.shirtUrl, item.shirt_url),
    countryId: firstString(country?.id, item.countryId, item.country_id),
    countryName: firstString(country?.name, item.countryName, item.country_name),
  };
}

function normalizeSound(value: unknown): RetroSound | null {
  const item = asObject(value);
  if (!item) return null;
  const audioUrl = firstString(item.audioUrl, item.url);
  if (!audioUrl) return null;
  return { key: firstString(item.key, item.id), audioUrl, volume: asNumber(item.volume) };
}

function normalizeClip(value: unknown): RetroClip | null {
  const item = asObject(value);
  if (!item) return null;
  const provider = firstString(item.provider) ?? "youtube";
  return {
    provider,
    videoId: firstString(item.videoId, item.video_id),
    startSeconds: asNumber(item.startSeconds ?? item.start_seconds),
    endSeconds: asNumber(item.endSeconds ?? item.end_seconds),
    embeddable: asBoolean(item.embeddable),
    enabled: asBoolean(item.enabled),
  };
}

function normalizeEvent(value: unknown, fixtureId: string, index: number): RetroEvent | null {
  const item = asObject(value);
  if (!item) return null;
  const simulatedAt = firstString(item.simulatedAt, item.simulated_at);
  const minute = asNumber(item.minute);
  const type = (firstString(item.type, item.eventType) ?? "event").toLowerCase();
  const playerName = firstString(item.playerName, item.player_name, asObject(item.player)?.name);
  const id = firstString(item.id, item.eventId, item.event_id) ?? `${fixtureId}:${type}:${simulatedAt ?? "na"}:${minute ?? index}:${playerName ?? index}`;
  return {
    id,
    type,
    minute,
    second: asNumber(item.second),
    playerName,
    assistName: firstString(item.assistName, item.assist_name, asObject(item.assist)?.name),
    teamId: firstString(item.teamId, item.team_id, asObject(item.team)?.id),
    homeScoreAfter: asNumber(item.homeScoreAfter ?? item.home_score_after) ?? null,
    awayScoreAfter: asNumber(item.awayScoreAfter ?? item.away_score_after) ?? null,
    featured: asBoolean(item.featured) ?? false,
    headline: firstString(item.headline),
    description: firstString(item.description),
    simulatedAt,
    sourceName: firstString(item.sourceName, item.source_name),
    sound: normalizeSound(item.sound),
    clip: normalizeClip(item.clip),
  };
}

const leagueCountryFallbacks: Record<string, string> = {
  "premier league": "England",
  "premier-league": "England",
  "bundesliga": "Germany",
  "la liga": "Spain",
  "la-liga": "Spain",
  "liga bbva": "Spain",
  "serie a": "Italy",
  "serie-a": "Italy",
  "ligue 1": "France",
  "ligue-1": "France",
};

function fallbackCountryFromLeague(league: JsonObject): NormalizedCountry | undefined {
  const name = firstString(league.name, league.label)?.toLowerCase();
  const slug = firstString(league.slug)?.toLowerCase();
  const fallbackName = (slug && leagueCountryFallbacks[slug]) || (name && leagueCountryFallbacks[name]);
  if (!fallbackName) return undefined;
  return { name: fallbackName, slug: fallbackName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") };
}

function fixtureCountry(fixture: JsonObject, league: JsonObject, home: JsonObject, away: JsonObject, catalog: RetroCountryCatalog): NormalizedCountry | undefined {
  const direct = normalizeCountry(league.country) ?? normalizeCountry(fixture.country) ?? normalizeCountry(home.country) ?? normalizeCountry(away.country);
  const countryId = firstString(
    direct?.id,
    fixture.countryId,
    fixture.country_id,
    league.countryId,
    league.country_id,
    home.countryId,
    home.country_id,
    away.countryId,
    away.country_id,
  );
  const catalogCountry = countryId ? catalog.get(countryId) : undefined;
  if (catalogCountry) return catalogCountry;
  if (direct?.name || direct?.slug) return { ...direct, id: direct.id ?? countryId };
  const fallback = fallbackCountryFromLeague(league);
  return fallback ? { ...fallback, id: countryId } : countryId ? { id: countryId } : undefined;
}

function countryCode(name?: string) {
  const normalized = name?.trim() || "International";
  const meta = getCountryMetadata(normalized);
  if (meta?.countryCode) return meta.countryCode;
  return normalized === "International" || normalized === "World"
    ? "X-INT"
    : `X-${normalized.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8)}`;
}

function normalizeFixture(value: unknown, historicalDate: string, snapshotAt: string, countryCatalog: RetroCountryCatalog): RetroFixture | null {
  const item = asObject(value);
  if (!item) return null;
  const id = firstString(item.id, item.fixtureId, item.fixture_id);
  if (!id) return null;

  const homeRaw = asObject(item.homeTeam) ?? asObject(item.home_team) ?? {};
  const awayRaw = asObject(item.awayTeam) ?? asObject(item.away_team) ?? {};
  const league = asObject(item.league) ?? asObject(item.competition) ?? {};
  const homeTeam = normalizeTeam(homeRaw, firstString(item.homeTeamName, item.home_team_name) ?? "Home");
  const awayTeam = normalizeTeam(awayRaw, firstString(item.awayTeamName, item.away_team_name) ?? "Away");
  const country = fixtureCountry(item, league, homeRaw, awayRaw, countryCatalog);
  const simulation = asObject(item.simulation) ?? {};
  const status = normalizeSimulationStatus(simulation.status ?? item.simulationStatus ?? item.status);
  const simulatedKickoff = firstString(simulation.simulatedKickoff, simulation.simulated_kickoff, item.simulatedKickoff, item.simulated_kickoff);
  const historicalKickoff = firstString(item.historicalKickoff, item.historical_kickoff, item.kickoff, item.kickoffUtc);
  const fixtureHistoricalDate = firstString(item.historicalDate, item.historical_date, simulation.historicalDate) ?? historicalDate;
  const safeKickoff = simulatedKickoff ?? historicalKickoff ?? `${fixtureHistoricalDate}T12:00:00.000Z`;
  const finalHomeScore = asNumber(item.finalHomeScore ?? item.final_home_score ?? item.homeScore ?? item.home_score) ?? null;
  const finalAwayScore = asNumber(item.finalAwayScore ?? item.final_away_score ?? item.awayScore ?? item.away_score) ?? null;
  const rawEvents = Array.isArray(item.events) ? item.events : Array.isArray(item.timeline) ? item.timeline : [];
  const retroEvents = rawEvents.map((event, index) => normalizeEvent(event, id, index)).filter((event): event is RetroEvent => Boolean(event));
  const mappedStatus = mapStandardStatus(status);

  return {
    id,
    retro: true,
    country: country?.name ?? "International",
    countryCode: countryCode(country?.name),
    countryId: country?.id,
    countrySlug: country?.slug,
    competition: firstString(league.name, item.leagueName, item.competitionName) ?? "Football",
    competitionId: firstString(league.id, item.leagueId, item.competitionId),
    competitionSlug: firstString(league.slug, item.leagueSlug),
    competitionLogo: firstString(league.logoUrl, league.logo, item.leagueLogo),
    homeTeam,
    awayTeam,
    homeScore: status === "finished" ? finalHomeScore : null,
    awayScore: status === "finished" ? finalAwayScore : null,
    status: mappedStatus,
    minute: asNumber(simulation.elapsedMatchMinute ?? simulation.elapsed_match_minute) ?? null,
    kickoff: safeKickoff,
    stadium: firstString(item.venue, item.stadium, asObject(item.venue)?.name),
    city: firstString(item.city, asObject(item.venue)?.city),
    round: firstString(item.round, item.matchRound) ?? (asNumber(item.round) !== undefined ? String(asNumber(item.round)) : undefined),
    isLive: status === "live" || status === "halftime",
    historicalDate: fixtureHistoricalDate,
    historicalKickoff,
    kickoffPrecision: normalizePrecision(item.kickoffPrecision ?? item.kickoff_precision),
    // Do not ship the historical final result to the browser before the replay finishes.
    // Live scores are reconstructed only from reached real events.
    finalHomeScore: status === "finished" ? finalHomeScore : null,
    finalAwayScore: status === "finished" ? finalAwayScore : null,
    simulation: {
      status,
      simulatedKickoff,
      elapsedMatchSeconds: asNumber(simulation.elapsedMatchSeconds ?? simulation.elapsed_match_seconds),
      elapsedMatchMinute: asNumber(simulation.elapsedMatchMinute ?? simulation.elapsed_match_minute),
      snapshotAt,
    },
    retroEvents,
  };
}

function extractCatalogRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const object = asObject(data);
  if (!object) return [];
  for (const key of ["countries", "items", "results"]) if (Array.isArray(object[key])) return object[key] as unknown[];
  return [];
}

async function getCountryCatalog(signal?: AbortSignal): Promise<RetroCountryCatalog> {
  if (countryCatalogCache && countryCatalogCache.expiresAt > Date.now()) return countryCatalogCache.value;
  const body = await request("/api/v1/countries?limit=100", signal);
  const catalog: RetroCountryCatalog = new Map();
  for (const value of extractCatalogRows(body.data)) {
    const item = asObject(value);
    if (!item) continue;
    const id = firstString(item.id, item.countryId, item.country_id);
    const name = firstString(item.name, item.countryName, item.country_name, item.label);
    if (!id || !name) continue;
    catalog.set(id, { id, name, slug: firstString(item.slug, item.countrySlug, item.country_slug) });
  }
  countryCatalogCache = { expiresAt: Date.now() + COUNTRY_CATALOG_TTL_MS, value: catalog };
  return catalog;
}

const retroTeamSearchAliases: Record<string, string> = {
  hull: "Hull City",
  wigan: "Wigan Athletic",
  bolton: "Bolton Wanderers",
  "west-brom": "West Bromwich Albion",
  wolfsburg: "VfL Wolfsburg",
  "ein-frankfurt": "Eintracht Frankfurt",
  "m-gladbach": "Borussia Monchengladbach",
  espanol: "Espanyol",
  valladolid: "Real Valladolid",
  "paris-sg": "Paris Saint-Germain",
  marseille: "Olympique Marseille",
  nice: "OGC Nice",
  "le-mans": "Le Mans FC",
  mallorca: "Real Mallorca",
  bochum: "VfL Bochum",
  stoke: "Stoke City",
  "west-ham": "West Ham United",
  blackburn: "Blackburn Rovers",
  newcastle: "Newcastle United",
  monaco: "AS Monaco",
  nancy: "AS Nancy",
  inter: "Inter Milan",
  leverkusen: "Bayer Leverkusen",
  bielefeld: "Arminia Bielefeld",
  hamburg: "Hamburger SV",
  cottbus: "Energie Cottbus",
  dortmund: "Borussia Dortmund",
};

function normalizedSearchValue(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeLogoUrl(value: unknown) {
  const candidate = asString(value);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function searchTeamRows(data: unknown): JsonObject[] {
  const object = asObject(data);
  const rows = object && Array.isArray(object.teams) ? object.teams : [];
  return rows.map(asObject).filter((item): item is JsonObject => Boolean(item));
}

function pickTeamLogo(rows: JsonObject[], name: string, slug?: string, countryId?: string, query?: string) {
  const targets = [...new Set([name, slug, query].map(normalizedSearchValue).filter(Boolean))];
  let best: { score: number; logo: string } | null = null;
  for (const row of rows) {
    const logo = safeLogoUrl(firstString(row.logoUrl, row.logo_url, row.logo, row.badgeUrl, row.badge_url, row.crestUrl, row.crest_url));
    if (!logo) continue;
    const rowName = normalizedSearchValue(firstString(row.name, row.teamName, row.team_name));
    const rowSlug = normalizedSearchValue(firstString(row.slug, row.teamSlug, row.team_slug));
    const rowCountry = asObject(row.country);
    const rowCountryId = firstString(rowCountry?.id, row.countryId, row.country_id);
    let score = 0;
    if (rowSlug && targets.includes(rowSlug)) score += 120;
    if (rowName && targets.includes(rowName)) score += 110;
    if (rowSlug && targets.some((target) => rowSlug.includes(target) || target.includes(rowSlug))) score += 45;
    if (rowName && targets.some((target) => rowName.includes(target) || target.includes(rowName))) score += 35;
    if (countryId && rowCountryId === countryId) score += 25;
    if (!best || score > best.score) best = { score, logo };
  }
  return best && best.score >= 35 ? best.logo : null;
}

async function lookupTeamLogo(name: string, slug?: string, countryId?: string, signal?: AbortSignal) {
  const aliasKey = normalizedSearchValue(slug || name);
  const queries = [...new Set([retroTeamSearchAliases[aliasKey], name].filter((value): value is string => Boolean(value)))];
  for (const query of queries) {
    const body = await request(`/api/v1/search?q=${encodeURIComponent(query)}&limit=10`, signal);
    const logo = pickTeamLogo(searchTeamRows(body.data), name, slug, countryId, query);
    if (logo) return logo;
  }
  return null;
}

export async function getFootGlobeRetroTeamAsset(name: string, slug?: string, countryId?: string, signal?: AbortSignal): Promise<{ logo: string | null }> {
  const key = `${normalizedSearchValue(slug || name)}:${countryId ?? ""}`;
  const cached = teamAssetCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { logo: cached.logo };
  const existing = pendingTeamAssets.get(key);
  if (existing) return { logo: await existing };
  const pending = lookupTeamLogo(name, slug, countryId, signal)
    .catch(() => null)
    .then((logo) => {
      teamAssetCache.set(key, { expiresAt: Date.now() + (logo ? TEAM_ASSET_TTL_MS : TEAM_ASSET_MISS_TTL_MS), logo });
      return logo;
    })
    .finally(() => pendingTeamAssets.delete(key));
  pendingTeamAssets.set(key, pending);
  return { logo: await pending };
}

function extractRetroPayload(body: Envelope) {
  const data = asObject(body.data);
  if (!data) throw new FootGlobeRetroApiError("RETRO_INVALID_PAYLOAD");
  return data;
}

function extractFixtures(data: JsonObject): unknown[] {
  for (const value of [data.fixtures, data.matches, asObject(data.day)?.fixtures]) if (Array.isArray(value)) return value;
  return [];
}

function seasonFromPayload(data: JsonObject, requested?: string): RetroSeason {
  const value = data.season;
  const normalized = normalizeSeason(value) ?? normalizeSeason({ slug: requested ?? firstString(data.seasonSlug), label: firstString(data.seasonLabel) ?? requested });
  if (normalized) return normalized;
  const slug = requested ?? "retro";
  return { id: slug, slug, label: slug };
}

export async function getFootGlobeRetroSeasons(signal?: AbortSignal): Promise<RetroSeasonsResponse> {
  const body = await request("/api/v1/retro/seasons", signal);
  const rows = extractSeasonRows(body.data);
  const seasons = rows.map(normalizeSeason).filter((season): season is RetroSeason => Boolean(season));
  return { seasons, fetchedAt: new Date().toISOString() };
}

export async function getFootGlobeRetroToday(season: string, signal?: AbortSignal): Promise<RetroTodayResponse> {
  const [body, countryCatalog] = await Promise.all([
    request(`/api/v1/retro/today?season=${encodeURIComponent(season)}`, signal),
    getCountryCatalog(signal).catch(() => new Map<string, RetroCountryCatalogEntry>()),
  ]);
  const data = extractRetroPayload(body);
  const simulation = asObject(data.simulation) ?? {};
  const snapshotAt = new Date().toISOString();
  const historicalDate = firstString(simulation.historicalDate, simulation.historical_date, data.historicalDate, data.historical_date);
  if (!historicalDate) throw new FootGlobeRetroApiError("RETRO_MISSING_HISTORICAL_DATE");
  const fixtures = extractFixtures(data)
    .map((fixture) => normalizeFixture(fixture, historicalDate, snapshotAt, countryCatalog))
    .filter((fixture): fixture is RetroFixture => Boolean(fixture));
  return {
    season: seasonFromPayload(data, season),
    simulation: {
      historicalDate,
      replayTime: firstString(simulation.replayTime, simulation.currentReplayTime, simulation.simulatedNow, simulation.now),
      currentTime: firstString(simulation.currentTime, simulation.current_time, data.currentTime),
      snapshotAt,
    },
    fixtures,
    fetchedAt: snapshotAt,
    apiVersion: firstString(body.meta?.apiVersion, body.meta?.version),
  };
}

export async function getFootGlobeRetroFixture(id: string, signal?: AbortSignal): Promise<RetroFixtureResponse> {
  const [body, countryCatalog] = await Promise.all([
    request(`/api/v1/retro/fixtures/${encodeURIComponent(id)}`, signal),
    getCountryCatalog(signal).catch(() => new Map<string, RetroCountryCatalogEntry>()),
  ]);
  const dataObject = asObject(body.data);
  const rawFixture = dataObject && (dataObject.fixture ?? dataObject.match) ? (dataObject.fixture ?? dataObject.match) : body.data;
  const rawObject = asObject(rawFixture);
  if (!rawObject) throw new FootGlobeRetroApiError("RETRO_INVALID_FIXTURE");
  const simulation = asObject(rawObject.simulation) ?? {};
  const historicalDate = firstString(rawObject.historicalDate, rawObject.historical_date, simulation.historicalDate, rawObject.matchDate, rawObject.date) ?? "1970-01-01";
  const snapshotAt = new Date().toISOString();
  const fixture = normalizeFixture(rawObject, historicalDate, snapshotAt, countryCatalog);
  if (!fixture) throw new FootGlobeRetroApiError("RETRO_INVALID_FIXTURE");
  return { fixture, fetchedAt: snapshotAt };
}
