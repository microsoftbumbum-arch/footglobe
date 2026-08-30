import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Retro country IDs are resolved through the FootGlobe API country catalog', () => {
  const client = read('lib/footglobe-retro-api.ts');
  assert.match(client, /\/api\/v1\/countries\?limit=100/);
  assert.match(client, /fixture\.countryId/);
  assert.match(client, /catalog\.get\(countryId\)/);
  assert.match(client, /"premier league": "England"/);
  assert.match(client, /"bundesliga": "Germany"/);
  assert.match(client, /"la liga": "Spain"/);
  assert.match(client, /"serie a": "Italy"/);
  assert.match(client, /"ligue 1": "France"/);
});

test('Missing Retro logos are resolved only through a local proxy backed by FootGlobe API search', () => {
  const client = read('lib/footglobe-retro-api.ts');
  const route = read('app/api/retro/team-assets/route.ts');
  const mark = read('components/retro/RetroTeamMark.tsx');
  assert.match(client, /\/api\/v1\/search\?q=/);
  assert.match(client, /getFootGlobeRetroTeamAsset/);
  assert.match(route, /getFootGlobeRetroTeamAsset/);
  assert.match(mark, /\/api\/retro\/team-assets/);
  assert.doesNotMatch(route + mark, /goal-api\.com|worldcup26\.ir|thesportsdb|api-football/i);
});

test('Retro cards and details use the logo resolver while Today components remain unchanged', () => {
  assert.match(read('components/retro/RetroMatchCard.tsx'), /RetroTeamMark/);
  assert.match(read('components/retro/RetroMatchDetails.tsx'), /RetroTeamMark/);
  assert.doesNotMatch(read('components/matches/MatchCard.tsx'), /RetroTeamMark/);
  assert.match(read('components/FootGlobeApp.tsx'), /mode === "retro" && footballNations\.has/);
});
