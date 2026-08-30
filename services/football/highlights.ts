const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const FOUND_TTL_MS = 12 * 60 * 60 * 1000;
const NOT_FOUND_TTL_MS = 15 * 60 * 1000;
const MAX_RESULTS = 10;

type YouTubeThumbnail = { url?: string; width?: number; height?: number };
type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: {
      default?: YouTubeThumbnail;
      medium?: YouTubeThumbnail;
      high?: YouTubeThumbnail;
    };
  };
};

type YouTubeSearchResponse = {
  items?: YouTubeSearchItem[];
  error?: {
    code?: number;
    errors?: Array<{ reason?: string }>;
  };
};

export interface HighlightResult {
  found: boolean;
  title?: string;
  competition?: string;
  thumbnail?: string;
  url?: string;
  embedUrl?: string;
  videoId?: string;
  channelTitle?: string;
  publishedAt?: string;
  videoCount?: number;
  source?: "youtube";
}

type CacheEntry = { expires: number; result: HighlightResult };
const resultCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<HighlightResult>>();

const normalize = (value = "") => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/&amp;/g, " and ")
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/\b(fc|cf|sc|afc|club|football|futebol)\b/g, "")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const significantTokens = (value: string) => normalize(value)
  .split(/\s+/)
  .filter((token) => token.length >= 3);

function entityMatches(text: string, entity: string) {
  const haystack = normalize(text);
  const needle = normalize(entity);
  if (!haystack || !needle) return false;
  if (haystack.includes(needle)) return true;
  const tokens = significantTokens(entity);
  if (!tokens.length) return false;
  const matched = tokens.filter((token) => haystack.includes(token)).length;
  return matched >= Math.max(1, Math.ceil(tokens.length * 0.6));
}

const highlightTerms = [
  "highlight", "highlights", "extended highlights", "goals", "goal", "goles", "gols",
  "resumen", "resumo", "melhores momentos", "recap", "resume", "buts", "zusammenfassung",
  "sintesi", "ハイライト", "하이라이트", "集锦", "精華",
];

function hasHighlightTerm(value: string) {
  const text = normalize(value);
  return highlightTerms.some((term) => text.includes(normalize(term)));
}

function decodeTitle(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cacheKey(input: { home: string; away: string; kickoff: string; competition?: string }) {
  return [normalize(input.home), normalize(input.away), input.kickoff.slice(0, 10), normalize(input.competition ?? "")].join("|");
}

function pickCandidate(items: YouTubeSearchItem[], input: { home: string; away: string; kickoff: string; competition?: string }) {
  const kickoffMs = new Date(input.kickoff).getTime();
  const scored = items.flatMap((item) => {
    const videoId = item.id?.videoId?.trim();
    const snippet = item.snippet;
    if (!videoId || !snippet) return [];

    const title = decodeTitle(snippet.title ?? "");
    const description = decodeTitle(snippet.description ?? "");
    const searchable = `${title} ${description}`;
    const homeMatch = entityMatches(searchable, input.home);
    const awayMatch = entityMatches(searchable, input.away);
    if (!homeMatch || !awayMatch) return [];

    let score = 8;
    if (hasHighlightTerm(title)) score += 4;
    else if (hasHighlightTerm(description)) score += 2;
    if (input.competition && entityMatches(searchable, input.competition)) score += 1;

    const publishedMs = snippet.publishedAt ? new Date(snippet.publishedAt).getTime() : Number.NaN;
    if (Number.isFinite(publishedMs) && Number.isFinite(kickoffMs)) {
      const delta = publishedMs - kickoffMs;
      if (delta >= 0 && delta <= 72 * 60 * 60 * 1000) score += 3;
      else if (delta >= -6 * 60 * 60 * 1000 && delta <= 7 * 24 * 60 * 60 * 1000) score += 1;
    }

    return [{ score, videoId, snippet, title }];
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

async function searchYouTube(input: { home: string; away: string; kickoff: string; competition?: string }, apiKey: string): Promise<HighlightResult> {
  const url = new URL(YOUTUBE_SEARCH_URL);
  const query = [input.home, input.away, input.competition, "highlights"].filter(Boolean).join(" ");
  const kickoff = new Date(input.kickoff);
  const publishedAfter = new Date(kickoff.getTime() - 2 * 60 * 60 * 1000);

  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(MAX_RESULTS));
  url.searchParams.set("order", "relevance");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("videoSyndicated", "true");
  url.searchParams.set("safeSearch", "moderate");
  if (!Number.isNaN(publishedAfter.getTime())) url.searchParams.set("publishedAfter", publishedAfter.toISOString());
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  let body: YouTubeSearchResponse = {};
  try { body = await response.json() as YouTubeSearchResponse; } catch { /* status is enough for safe diagnostics */ }
  if (!response.ok || body.error) {
    const reason = body.error?.errors?.[0]?.reason?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "unknown";
    console.warn("YouTube highlight lookup unavailable", { status: response.status, reason });
    throw new Error(`YOUTUBE_SEARCH_${response.status || body.error?.code || 500}`);
  }

  const candidate = pickCandidate(Array.isArray(body.items) ? body.items : [], input);
  if (!candidate) return { found: false, source: "youtube" };

  const thumbnail = candidate.snippet.thumbnails?.high?.url
    || candidate.snippet.thumbnails?.medium?.url
    || candidate.snippet.thumbnails?.default?.url;
  return {
    found: true,
    source: "youtube",
    title: candidate.title,
    competition: input.competition,
    thumbnail,
    videoId: candidate.videoId,
    url: `https://www.youtube.com/watch?v=${candidate.videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${candidate.videoId}`,
    channelTitle: candidate.snippet.channelTitle,
    publishedAt: candidate.snippet.publishedAt,
    videoCount: 1,
  };
}

export async function findHighlights(input: { home: string; away: string; kickoff: string; competition?: string; force?: boolean }): Promise<HighlightResult> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) throw new Error("YOUTUBE_NOT_CONFIGURED");

  const key = cacheKey(input);
  const cached = resultCache.get(key);
  if (!input.force && cached && cached.expires > Date.now()) return cached.result;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const task = searchYouTube(input, apiKey)
    .then((result) => {
      resultCache.set(key, {
        result,
        expires: Date.now() + (result.found ? FOUND_TTL_MS : NOT_FOUND_TTL_MS),
      });
      return result;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}
