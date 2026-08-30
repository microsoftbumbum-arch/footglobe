import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync('services/football/highlights.ts', 'utf8');
const route = fs.readFileSync('app/api/highlights/route.ts', 'utf8');
const details = fs.readFileSync('components/matches/MatchDetails.tsx', 'utf8');
const envExample = fs.readFileSync('.env.example', 'utf8');
const pt = JSON.parse(fs.readFileSync('locales/pt-BR.json', 'utf8'));

test('YouTube highlights stay server-side and only search videos that can be embedded', () => {
  assert.match(service, /www\.googleapis\.com\/youtube\/v3\/search/);
  assert.match(service, /process\.env\.YOUTUBE_API_KEY/);
  assert.match(service, /videoEmbeddable/);
  assert.match(service, /videoSyndicated/);
  assert.match(service, /type.*video/s);
  assert.doesNotMatch(details, /YOUTUBE_API_KEY|AIzaSy/);
  assert.match(envExample, /YOUTUBE_API_KEY=/);
});

test('highlight lookup remains user-triggered and only appears for finished matches', () => {
  assert.match(details, /match\.status === "FINISHED" && <HighlightsInfo/);
  assert.match(details, /onClick=\{\(\) => void load\(false\)\}/);
  assert.match(details, /\/api\/highlights/);
  assert.match(route, /findHighlights/);
});

test('YouTube highlight is embedded inside match details and no-result copy is explicit', () => {
  assert.match(details, /youtube-highlight-player/);
  assert.match(service, /youtube-nocookie\.com\/embed/);
  assert.match(details, /allowFullScreen/);
  assert.match(pt.highlightsNotFound, /não há highlights publicados/i);
});
