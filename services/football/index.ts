import { FootGlobeApiError, getFootGlobeFixtures, getFootGlobeLive } from "@/lib/footglobe-api";
import { readCache, writeCache } from "./cache";
import { recordIntegrationHealth } from "@/lib/integration-health";
import type { FootballMatch, MatchesResponse } from "@/types/football";

export interface MatchesResult {
  data: MatchesResponse;
  maxAge: number;
  cacheControl?: string;
  upstreamRequests: number;
}

const CACHE_VERSION = "official-v3-revalidate";

function dateRelation(date: string) {
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (date === localToday) return "today" as const;
  return date < localToday ? "past" as const : "future" as const;
}

function policyTtl(date: string, upstream?: number) {
  const relation = dateRelation(date);
  const fallback = relation === "today" ? 60 : relation === "future" ? 300 : 3_600;
  const maximum = relation === "today" ? 60 : relation === "future" ? 600 : 86_400;
  if (!upstream || upstream <= 0) return fallback;
  return Math.max(1, Math.min(upstream, maximum));
}

function staleTtl(date: string) {
  return dateRelation(date) === "past" ? 7 * 24 * 60 * 60 : 48 * 60 * 60;
}

function safeErrorLog(error: unknown) {
  if (error instanceof FootGlobeApiError) {
    console.warn("FootGlobe fixture update unavailable", {
      category: error.category,
      status: error.status ?? null,
    });
    return;
  }
  console.warn("FootGlobe fixture update unavailable", { category: "unknown", status: null });
}

export async function getMatches(date: string, signal?: AbortSignal): Promise<MatchesResult> {
  // Always revalidate the selected date against the official FootGlobe API.
  // Persistent cache is fallback-only so previously empty/partial dates can recover
  // as soon as the collectors populate new fixtures.
  const staleKey = `football:${CACHE_VERSION}:stale:${date}`;

  try {
    const result = await getFootGlobeFixtures(date, signal);
    const ttl = policyTtl(date, result.maxAge);
    const snapshot: MatchesResponse = {
      date,
      source: "footglobe-api",
      coverage: "global",
      matches: result.matches,
      updatedAt: result.lastSyncedAt || new Date().toISOString(),
    };
    await writeCache(staleKey, snapshot, staleTtl(date));
    recordIntegrationHealth("matches", { status: "ok", code: result.matches.length ? "LIVE" : "EMPTY" });
    return {
      data: snapshot,
      maxAge: ttl,
      cacheControl: result.cacheControl,
      upstreamRequests: result.requestCount,
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    safeErrorLog(error);
    recordIntegrationHealth("matches", {
      status: "degraded",
      code: error instanceof FootGlobeApiError ? error.category.toUpperCase() : "UPSTREAM",
      httpStatus: error instanceof FootGlobeApiError ? error.status : undefined,
    });
    const stale = await readCache(staleKey);
    if (stale) {
      return {
        data: { ...stale, stale: true, error: "STALE_DATA" },
        maxAge: 15,
        upstreamRequests: 1,
      };
    }
    return {
      data: { date, source: "unavailable", coverage: "unavailable", matches: [], error: "MATCHES_UNAVAILABLE" },
      maxAge: 15,
      upstreamRequests: 1,
    };
  }
}

export async function getLiveMatches(signal?: AbortSignal): Promise<MatchesResult> {
  try {
    const result = await getFootGlobeLive(signal);
    const ttl = Math.max(0, Math.min(result.maxAge ?? 10, 15));
    return {
      data: {
        date: new Date().toISOString().slice(0, 10),
        source: "footglobe-api",
        coverage: "global",
        matches: result.matches,
        updatedAt: result.lastSyncedAt || new Date().toISOString(),
      },
      maxAge: ttl,
      cacheControl: result.cacheControl,
      upstreamRequests: result.requestCount,
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    safeErrorLog(error);
    return {
      data: { date: new Date().toISOString().slice(0, 10), source: "unavailable", coverage: "unavailable", matches: [], error: "MATCHES_UNAVAILABLE" },
      maxAge: 5,
      upstreamRequests: 1,
    };
  }
}
