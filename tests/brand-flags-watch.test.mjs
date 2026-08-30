import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('country UI uses real SVG flag images instead of emoji flags', () => {
  const app = read('components/FootGlobeApp.tsx');
  const panel = read('components/matches/CountryPanel.tsx');
  const flag = read('components/CountryFlag.tsx');
  assert.match(app, /<CountryFlag/);
  assert.match(panel, /<CountryFlag/);
  assert.match(flag, /flag-icons@7\.5\.0\/flags\/4x3/);
  assert.doesNotMatch(app + panel + read('lib/country-metadata.ts'), /🌐|🇦|🇧|🇨|🇩|🇪|🇫|🇬|🇭|🇮|🇯|🇰|🇱|🇲|🇳|🇴|🇵|🇶|🇷|🇸|🇹|🇺|🇻|🇼|🇽|🇾|🇿/u);
});

test('header uses the FootGlobe brand mark and not the old orbit bubble', () => {
  const app = read('components/FootGlobeApp.tsx');
  assert.match(app, /brand-mark\.png/);
  assert.doesNotMatch(app, /brand-orbit/);
  assert.ok(fs.existsSync(path.join(root, 'public/brand-mark.png')));
});

test('desktop country rail exposes a horizontal scrollbar', () => {
  const css = read('app/globals.css');
  assert.match(css, /\.rail-scroll::\-webkit-scrollbar\s*\{\s*height:\s*6px/);
  assert.match(css, /scrollbar-width:\s*thin/);
});

test('where-to-watch endpoint is on-demand, cached, and uses real broadcast listings', () => {
  const service = read('services/football/watch.ts');
  const card = read('components/matches/MatchCard.tsx');
  assert.match(service, /searchevents\.php/);
  assert.match(service, /lookuptv\.php/);
  assert.match(service, /CACHE_TTL_MS/);
  assert.match(card, /whereToWatch/);
  assert.match(card, /\/api\/watch/);
});

test('all locales contain broadcast UI strings', () => {
  const keys = ['whereToWatch','broadcastLoading','broadcastUnavailable','broadcastNotListed','broadcastNoMatch','broadcastRegionNote'];
  for (const file of fs.readdirSync(path.join(root, 'locales')).filter((name) => name.endsWith('.json'))) {
    const data = JSON.parse(read(`locales/${file}`));
    for (const key of keys) assert.equal(typeof data[key], 'string', `${file} missing ${key}`);
  }
});
