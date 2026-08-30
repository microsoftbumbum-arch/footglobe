import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');

test('official fixture service has persistent stale fallback without external providers', () => {
  const index = read('services/football/index.ts');
  const cache = read('services/football/cache.ts');
  assert.match(index, /getFootGlobeFixtures/);
  assert.match(index, /staleKey/);
  assert.match(index, /STALE_DATA/);
  assert.match(index, /source: "footglobe-api"/);
  assert.doesNotMatch(index, /FOOTBALL_API_KEY|FOOTBALL_DATA_API_KEY|BBS_API_KEY|GOAL_API_KEY|kickoffapi/i);
  assert.match(cache, /node:fs\/promises/);
  assert.match(cache, /\.cache.*footglobe/);
});

test('secondary integrations remain user-triggered', () => {
  const app = read('components/FootGlobeApp.tsx');
  const donate = read('components/donations/DonationDialog.tsx');
  const match = read('components/matches/MatchCard.tsx');
  const details = read('components/matches/MatchDetails.tsx');
  assert.match(app, /fetch\(`\/api\/matches/);
  assert.match(match, /onClick=\{load\}/);
  assert.match(details, /onClick=\{\(\) => void load\(false\)\}/);
  assert.match(donate, /onClick=\{\(\) => void loadCryptoOptions\(false\)\}/);
  const openEffect = donate.slice(donate.indexOf('useEffect(() => {'), donate.indexOf('const loadCryptoOptions'));
  assert.doesNotMatch(openEffect, /fetch\(/);
});

test('passive health endpoint does not call upstream services', () => {
  const route = read('app/api/health/route.ts');
  assert.match(route, /getIntegrationHealth/);
  assert.doesNotMatch(route, /fetch\(/);
});

test('Binance 451 is classified as region restriction', () => {
  const binance = read('services/donations/binance.ts');
  assert.match(binance, /status === 451.*region_restricted/s);
});

test('all locales include normalized unknown status and visible copy does not name legacy providers', () => {
  const dir = path.join(root,'locales');
  const files = fs.readdirSync(dir).filter((f)=>f.endsWith('.json'));
  assert.equal(files.length,27);
  for (const file of files) {
    const d = JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
    assert.ok(d.unknown, `${file} unknown`);
    assert.equal('dataAttribution' in d, false, `${file} legacy attribution`);
    assert.doesNotMatch(JSON.stringify(d), /football-data\.org|api-football|big balls|goal api/i, file);
  }
});
