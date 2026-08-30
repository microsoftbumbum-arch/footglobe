import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MatchesResponse } from "@/types/football";

interface MemoryEntry { expiresAt: number; value: MatchesResponse; }
interface DiskEntry { expiresAt: number; value: MatchesResponse; }

const memoryCache = new Map<string, MemoryEntry>();
const cacheDir = join(process.cwd(), ".cache", "footglobe");

function cacheApi(): Cache | undefined {
  try {
    const storage = (globalThis as typeof globalThis & { caches?: CacheStorage & { default?: Cache } }).caches;
    return storage?.default;
  } catch { return undefined; }
}

function requestFor(key: string): Request { return new Request(`https://footglobe.internal/cache/${encodeURIComponent(key)}`); }
function diskPath(key: string) { return join(cacheDir, `${createHash("sha256").update(key).digest("hex")}.json`); }

async function readDisk(key: string): Promise<MatchesResponse | null> {
  try {
    const entry = JSON.parse(await readFile(diskPath(key), "utf8")) as DiskEntry;
    if (!entry?.expiresAt || entry.expiresAt <= Date.now() || !entry.value) return null;
    memoryCache.set(key, { expiresAt: entry.expiresAt, value: entry.value });
    return entry.value;
  } catch { return null; }
}

export async function readCache(key: string): Promise<MatchesResponse | null> {
  const entry = memoryCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  if (entry) memoryCache.delete(key);

  const cache = cacheApi();
  if (cache) {
    try {
      const response = await cache.match(requestFor(key));
      if (response) {
        const value = await response.json() as MatchesResponse;
        memoryCache.set(key, { expiresAt: Date.now() + 60_000, value });
        return value;
      }
    } catch { /* optional */ }
  }

  return readDisk(key);
}

export async function writeCache(key: string, value: MatchesResponse, ttlSeconds: number): Promise<void> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  memoryCache.set(key, { expiresAt, value });

  const cache = cacheApi();
  if (cache) {
    try {
      await cache.put(requestFor(key), new Response(JSON.stringify(value), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${ttlSeconds}` } }));
    } catch { /* disk still provides persistence */ }
  }

  try {
    await mkdir(cacheDir, { recursive: true });
    const target = diskPath(key);
    const temp = `${target}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify({ expiresAt, value } satisfies DiskEntry), "utf8");
    await rename(temp, target);
  } catch { /* memory cache remains operational */ }
}
