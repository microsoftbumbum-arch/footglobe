import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const client = fs.readFileSync('lib/footglobe-api.ts','utf8');
const service = fs.readFileSync('services/football/index.ts','utf8');
const route = fs.readFileSync('app/api/matches/route.ts','utf8');
const liveRoute = fs.readFileSync('app/api/live/route.ts','utf8');
const app = fs.readFileSync('components/FootGlobeApp.tsx','utf8');
const env = fs.readFileSync('.env.example','utf8');
const types = fs.readFileSync('types/football.ts','utf8');

test('official FootGlobe API is the only fixture provider in the site data layer', () => {
  assert.match(client, /https:\/\/footglobe-api-nu\.vercel\.app/);
  assert.match(client, /process\.env\.FOOTGLOBE_API_URL/);
  assert.match(client, /\/api\/v1\/fixtures\?\$\{params\.toString\(\)\}/);
  assert.match(client, /\/api\/v1\/live/);
  assert.match(client, /\/api\/v1\/health/);
  assert.match(service, /getFootGlobeFixtures/);
  assert.doesNotMatch(service, /api-football|football-data|big-balls|goal-api|KICKOFF/i);
  assert.match(types, /source: "footglobe-api" \| "unavailable"/);
  assert.match(env, /FOOTGLOBE_API_URL=https:\/\/footglobe-api-nu\.vercel\.app/);
});

test('fixtures are normalized from canonical FootGlobe fields and keep logo fallbacks possible', () => {
  for (const field of ['homeTeam','awayTeam','league','logoUrl','kickoff','lastSyncedAt']) assert.match(client, new RegExp(field));
  assert.match(client, /competitionId/);
  assert.match(client, /countryId/);
  assert.match(client, /status === "LIVE" \|\| status === "HALFTIME"/);
  assert.match(client, /default: return "UNKNOWN"/);
});

test('daily frontend request stays singular while the server client paginates all fixtures and remains abortable', () => {
  assert.match(client, /FIXTURES_PAGE_LIMIT = 100/);
  assert.match(client, /page: String\(page\)/);
  assert.match(client, /meta\?\.count/);
  assert.match(client, /Math\.ceil\(expectedCount \/ effectiveLimit\)/);
  assert.match(client, /matchesById\.set\(match\.id, match\)/);
  assert.match(route, /getMatches\(date, request\.signal\)/);
  assert.match(app, /new AbortController\(\)/);
  assert.match(app, /signal: controller\.signal/);
  assert.match(app, /controller\.abort\(\)/);
  assert.match(app, /dateCacheRef/);
  assert.match(app, /stale: true, error: "STALE_DATA"/);
});

test('today mode remains fixed while Retro is a separate mode and fixtures still revalidate', () => {
  const upstreamIndex = service.indexOf('getFootGlobeFixtures(date, signal)');
  const fallbackReadIndex = service.indexOf('readCache(staleKey)');
  assert.ok(upstreamIndex >= 0, 'upstream fixture request should exist');
  assert.ok(fallbackReadIndex > upstreamIndex, 'persistent cache must only be read after an upstream failure');
  assert.doesNotMatch(service, /freshKey|code: "CACHE"/);
  assert.match(route, /dynamic = "force-dynamic"/);
  assert.match(route, /revalidate = 0/);
  assert.match(route, /no-store, no-cache, must-revalidate, max-age=0/);
  assert.match(client, /"Cache-Control": "no-cache"/);
  assert.match(client, /cache: "no-store"/);
  assert.match(app, /DATE_MEMORY_CACHE_MS = 5 \* 60_000/);
  assert.match(app, /useState\(\(\) => iso\(dayDate\(\)\)\)/);
  assert.match(app, /setInterval/);
  assert.match(app, /\[dateKey, mode\]/);
  assert.match(app, /date-nav mode-nav/);
  assert.match(app, /setMode\("today"\)/);
  assert.match(app, /setMode\("retro"\)/);
  assert.match(app, /plural\("countriesGames.today", countries.length\)/);
  assert.doesNotMatch(app, /selectDate|CalendarDays|ChevronLeft/);
  assert.doesNotMatch(app, /t\("yesterday"\)|t\("tomorrow"\)|t\("calendar"\)/);
});

test('live proxy has a maximum 15 second cache policy', () => {
  assert.match(liveRoute, /Math\.min\(result\.maxAge, 15\)/);
  assert.match(service, /getFootGlobeLive/);
});

test('old fixture provider credentials and modules are absent', () => {
  for (const key of ['FOOTBALL_API_KEY','API_FOOTBALL_KEY','FOOTBALL_DATA_API_KEY','BBS_API_KEY','GOAL_API_KEY','KICKOFF_API_KEY']) {
    assert.doesNotMatch(env, new RegExp(key));
  }
  for (const file of ['services/football/api-football.ts','services/football/football-data.ts','services/football/big-balls.ts','services/football/goal-api.ts']) {
    assert.equal(fs.existsSync(file), false, `${file} should be removed`);
  }
});
