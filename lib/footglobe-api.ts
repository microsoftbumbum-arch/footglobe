import { getCountryMetadata } from "@/lib/country-metadata";
import type { FootballMatch, MatchStatus, Team } from "@/types/football";

const DEFAULT_FOOTGLOBE_API_URL = "https://footglobe-api-nu.vercel.app";
const REQUEST_TIMEOUT_MS = 8_000;
const FIXTURES_PAGE_LIMIT = 100;
const MAX_FIXTURE_PAGES = 1_000;

type ApiCountry = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
};

type ApiTeam = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  logoUrl?: string | null;
  country?: ApiCountry | null;
};

type ApiLeague = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  logoUrl?: string | null;
  country?: ApiCountry | null;
};

type ApiFixture = {
  id?: string | null;
  kickoff?: string | null;
  status?: string | null;
  homeScore?: number | string | null;
  awayScore?: number | string | null;
  homeTeam?: ApiTeam | null;
  awayTeam?: ApiTeam | null;
  league?: ApiLeague | null;
  venue?: string | null;
  round?: string | number | null;
  lastSyncedAt?: string | null;
};

type ApiMeta = {
  count?: number;
  page?: number;
  limit?: number;
  apiVersion?: string;
  lastSyncedAt?: string;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  meta?: ApiMeta;
  error?: unknown;
  message?: string;
};

export type FootGlobeApiFailure = "timeout" | "http" | "invalid_json" | "rejected" | "invalid_payload";

export class FootGlobeApiError extends Error {
  readonly category: FootGlobeApiFailure;
  readonly status?: number;

  constructor(category: FootGlobeApiFailure, status?: number) {
    super(`FOOTGLOBE_API_${category.toUpperCase()}`);
    this.name = "FootGlobeApiError";
    this.category = category;
    this.status = status;
  }
}

export interface FootGlobeApiResult {
  matches: FootballMatch[];
  requestCount: number;
  cacheControl?: string;
  maxAge?: number;
  apiVersion?: string;
  lastSyncedAt?: string;
}

function baseUrl() {
  return (process.env.FOOTGLOBE_API_URL?.trim() || DEFAULT_FOOTGLOBE_API_URL).replace(/\/+$/, "");
}

function parseScore(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapStatus(value: string | null | undefined): MatchStatus {
  switch ((value ?? "unknown").trim().toLowerCase()) {
    case "scheduled": return "SCHEDULED";
    case "live": return "LIVE";
    case "halftime": return "HALFTIME";
    case "finished": return "FINISHED";
    case "postponed": return "POSTPONED";
    case "cancelled": return "CANCELLED";
    case "suspended": return "SUSPENDED";
    default: return "UNKNOWN";
  }
}

function mapTeam(team: ApiTeam | null | undefined): Team {
  const name = team?.name?.trim() || "Unknown";
  return {
    id: team?.id?.trim() || undefined,
    slug: team?.slug?.trim() || undefined,
    name,
    shortName: name,
    logo: team?.logoUrl?.trim() || undefined,
    countryId: team?.country?.id?.trim() || undefined,
    countryName: team?.country?.name?.trim() || undefined,
  };
}

function fixtureCountry(fixture: ApiFixture): ApiCountry | undefined {
  return fixture.league?.country ?? fixture.homeTeam?.country ?? fixture.awayTeam?.country ?? undefined;
}

function countryCode(country: ApiCountry | undefined): string {
  const name = country?.name?.trim() || "International";
  const meta = getCountryMetadata(name);
  if (meta?.countryCode) return meta.countryCode;
  return name === "International" || name === "World"
    ? "X-INT"
    : `X-${name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8)}`;
}

function mapFixture(fixture: ApiFixture): FootballMatch | null {
  const id = fixture.id?.trim();
  const kickoff = fixture.kickoff?.trim();
  const homeName = fixture.homeTeam?.name?.trim();
  const awayName = fixture.awayTeam?.name?.trim();
  if (!id || !kickoff || !homeName || !awayName || Number.isNaN(Date.parse(kickoff))) return null;

  const country = fixtureCountry(fixture);
  const status = mapStatus(fixture.status);
  return {
    id,
    country: country?.name?.trim() || "International",
    countryCode: countryCode(country),
    countryId: country?.id?.trim() || undefined,
    countrySlug: country?.slug?.trim() || undefined,
    competition: fixture.league?.name?.trim() || "Football",
    competitionId: fixture.league?.id?.trim() || undefined,
    competitionSlug: fixture.league?.slug?.trim() || undefined,
    competitionLogo: fixture.league?.logoUrl?.trim() || undefined,
    homeTeam: mapTeam(fixture.homeTeam),
    awayTeam: mapTeam(fixture.awayTeam),
    homeScore: parseScore(fixture.homeScore),
    awayScore: parseScore(fixture.awayScore),
    status,
    minute: null,
    kickoff,
    stadium: fixture.venue?.trim() || undefined,
    round: fixture.round === null || fixture.round === undefined ? undefined : String(fixture.round),
    lastSyncedAt: fixture.lastSyncedAt?.trim() || undefined,
    isLive: status === "LIVE" || status === "HALFTIME",
  };
}

function maxAgeFromCacheControl(value: string | null): number | undefined {
  if (!value) return undefined;
  const match = value.match(/(?:s-maxage|max-age)\s*=\s*(\d+)/i);
  if (!match) return undefined;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? seconds : undefined;
}

function combinedSignal(external?: AbortSignal): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("timeout")), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort(external?.reason);
  if (external) {
    if (external.aborted) controller.abort(external.reason);
    else external.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeout);
      external?.removeEventListener("abort", onAbort);
    },
  };
}

async function request<T>(path: string, signal?: AbortSignal): Promise<{ body: ApiEnvelope<T>; cacheControl?: string; maxAge?: number }> {
  const abort = combinedSignal(signal);
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      cache: "no-store",
      signal: abort.signal,
    });

    if (!response.ok) throw new FootGlobeApiError("http", response.status);

    let body: ApiEnvelope<T>;
    try {
      body = await response.json() as ApiEnvelope<T>;
    } catch {
      throw new FootGlobeApiError("invalid_json", response.status);
    }
    if (body.success === false) throw new FootGlobeApiError("rejected", response.status);

    const cacheControl = response.headers.get("cache-control") || undefined;
    return { body, cacheControl, maxAge: maxAgeFromCacheControl(cacheControl ?? null) };
  } catch (error) {
    if (error instanceof FootGlobeApiError) throw error;
    if (signal?.aborted) throw error;
    throw new FootGlobeApiError(abort.signal.aborted ? "timeout" : "http");
  } finally {
    abort.dispose();
  }
}

function normalizeFixtures(body: ApiEnvelope<ApiFixture[]>): FootballMatch[] {
  if (!Array.isArray(body.data)) throw new FootGlobeApiError("invalid_payload");
  return body.data.map(mapFixture).filter((match): match is FootballMatch => Boolean(match));
}

export async function getFootGlobeFixtures(date: string, signal?: AbortSignal): Promise<FootGlobeApiResult> {
  const matchesById = new Map<string, FootballMatch>();
  let page = 1;
  let requestCount = 0;
  let expectedCount: number | undefined;
  let effectiveLimit = FIXTURES_PAGE_LIMIT;
  let cacheControl: string | undefined;
  let maxAge: number | undefined;
  let apiVersion: string | undefined;
  let lastSyncedAt: string | undefined;

  while (page <= MAX_FIXTURE_PAGES) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");

    const params = new URLSearchParams({
      date,
      limit: String(FIXTURES_PAGE_LIMIT),
      page: String(page),
    });
    const result = await request<ApiFixture[]>(`/api/v1/fixtures?${params.toString()}`, signal);
    requestCount += 1;
    const pageMatches = normalizeFixtures(result.body);
    for (const match of pageMatches) matchesById.set(match.id, match);

    cacheControl ??= result.cacheControl;
    if (result.maxAge !== undefined) maxAge = maxAge === undefined ? result.maxAge : Math.min(maxAge, result.maxAge);
    apiVersion ??= result.body.meta?.apiVersion;
    lastSyncedAt = result.body.meta?.lastSyncedAt ?? lastSyncedAt;

    const metaCount = result.body.meta?.count;
    if (typeof metaCount === "number" && Number.isFinite(metaCount) && metaCount >= 0) expectedCount = metaCount;
    const metaLimit = result.body.meta?.limit;
    if (typeof metaLimit === "number" && Number.isFinite(metaLimit) && metaLimit > 0) effectiveLimit = metaLimit;

    const rowsOnPage = Array.isArray(result.body.data) ? result.body.data.length : 0;
    if (expectedCount !== undefined) {
      const totalPages = Math.max(1, Math.ceil(expectedCount / effectiveLimit));
      if (page >= totalPages) break;
    } else if (rowsOnPage < effectiveLimit) {
      break;
    }

    page += 1;
  }

  return {
    matches: [...matchesById.values()].sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff)),
    requestCount,
    cacheControl,
    maxAge,
    apiVersion,
    lastSyncedAt,
  };
}

export async function getFootGlobeLive(signal?: AbortSignal): Promise<FootGlobeApiResult> {
  const { body, cacheControl, maxAge } = await request<ApiFixture[]>("/api/v1/live", signal);
  return {
    matches: normalizeFixtures(body),
    requestCount: 1,
    cacheControl,
    maxAge,
    apiVersion: body.meta?.apiVersion,
    lastSyncedAt: body.meta?.lastSyncedAt,
  };
}

export async function getFootGlobeHealth(signal?: AbortSignal): Promise<ApiEnvelope<{ database?: string; healthy?: boolean; service?: string; version?: string }>> {
  const { body } = await request<{ database?: string; healthy?: boolean; service?: string; version?: string }>("/api/v1/health", signal);
  return body;
}
