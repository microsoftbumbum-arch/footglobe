const SPORTS_DB_BASE = "https://www.thesportsdb.com/api/v1/json";
const PUBLIC_FREE_KEY = "123";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface BroadcastChannel {
  id: string;
  name: string;
  country?: string;
  logo?: string;
}

export interface BroadcastResult {
  channels: BroadcastChannel[];
  matched: boolean;
}

type SearchEvent = {
  idEvent?: string;
  idAPIfootball?: string | null;
  dateEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
};

type TvEvent = {
  id?: string;
  idChannel?: string;
  strChannel?: string;
  strCountry?: string | null;
  strLogo?: string | null;
};

const cache = new Map<string, { expires: number; value: BroadcastResult }>();

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\b(fc|cf|sc|afc|club|football|futebol)\b/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function similar(a = "", b = "") {
  const left = normalize(a);
  const right = normalize(b);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`WATCH_HTTP_${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getBroadcasts(input: { fixtureId: string; home: string; away: string; date: string }): Promise<BroadcastResult> {
  const cacheKey = `${input.fixtureId}:${input.date}`;
  const saved = cache.get(cacheKey);
  if (saved && saved.expires > Date.now()) return saved.value;

  const apiKey = process.env.SPORTSDB_API_KEY || PUBLIC_FREE_KEY;
  const query = `${input.home}_vs_${input.away}`;
  const makeSearchUrl = (value: string) => `${SPORTS_DB_BASE}/${encodeURIComponent(apiKey)}/searchevents.php?e=${encodeURIComponent(value)}&d=${encodeURIComponent(input.date)}`;

  try {
    const search = await fetchJson<{ event?: SearchEvent[] | null }>(makeSearchUrl(query));
    let events = search.event ?? [];
    if (!events.length) {
      const cleanedQuery = `${normalize(input.home).replace(/\s+/g, "_")}_vs_${normalize(input.away).replace(/\s+/g, "_")}`;
      if (cleanedQuery !== query.toLowerCase()) {
        const fallback = await fetchJson<{ event?: SearchEvent[] | null }>(makeSearchUrl(cleanedQuery));
        events = fallback.event ?? [];
      }
    }
    const match = events.find((event) => String(event.idAPIfootball ?? "") === input.fixtureId)
      ?? events.find((event) => event.dateEvent === input.date && similar(event.strHomeTeam, input.home) && similar(event.strAwayTeam, input.away))
      ?? events.find((event) => event.dateEvent === input.date && similar(event.strHomeTeam, input.away) && similar(event.strAwayTeam, input.home));

    if (!match?.idEvent) {
      const value: BroadcastResult = { channels: [], matched: false };
      cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value });
      return value;
    }

    const tvUrl = `${SPORTS_DB_BASE}/${encodeURIComponent(apiKey)}/lookuptv.php?id=${encodeURIComponent(match.idEvent)}`;
    const tv = await fetchJson<{ tvevent?: TvEvent[] | null }>(tvUrl);
    const dedupe = new Map<string, BroadcastChannel>();
    for (const item of tv.tvevent ?? []) {
      if (!item.strChannel) continue;
      const key = `${item.strChannel}|${item.strCountry ?? ""}`.toLowerCase();
      if (!dedupe.has(key)) dedupe.set(key, {
        id: item.idChannel || item.id || key,
        name: item.strChannel,
        country: item.strCountry || undefined,
        logo: item.strLogo || undefined,
      });
    }
    const value: BroadcastResult = { channels: [...dedupe.values()], matched: true };
    cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value });
    return value;
  } catch (error) {
    console.error("Broadcast lookup failed", error instanceof Error ? error.message.replace(/[^A-Z0-9_:-]/gi, "").slice(0, 80) : "UNKNOWN");
    throw error;
  }
}
