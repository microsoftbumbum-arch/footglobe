import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root,file),'utf8');

test('Retro football data comes only from FootGlobe API through server-side proxy routes', () => {
  const client = read('lib/footglobe-retro-api.ts');
  const seasons = read('app/api/retro/seasons/route.ts');
  const today = read('app/api/retro/today/route.ts');
  const fixture = read('app/api/retro/fixtures/[id]/route.ts');
  assert.match(client, /FOOTGLOBE_API_URL/);
  assert.match(client, /\/api\/v1\/retro\/seasons/);
  assert.match(client, /\/api\/v1\/retro\/today\?season=/);
  assert.match(client, /\/api\/v1\/retro\/fixtures\//);
  assert.match(seasons, /getFootGlobeRetroSeasons/);
  assert.match(today, /getFootGlobeRetroToday/);
  assert.match(fixture, /getFootGlobeRetroFixture/);
  const retroSource = [client, read('components/retro/RetroCountryPanel.tsx'), read('components/retro/RetroMatchDetails.tsx'), read('components/retro/RetroGoalCenter.tsx')].join('\n');
  assert.doesNotMatch(retroSource, /football-data\.co\.uk|statsbomb\.com|googleapis\.com\/youtube\/v3|api-football|thesportsdb/i);
});

test('Retro seasons are discovered dynamically and Today normal date controls stay absent', () => {
  const app = read('components/FootGlobeApp.tsx');
  assert.match(app, /fetch\("\/api\/retro\/seasons"/);
  assert.match(app, /result\.seasons\[0\]\?\.slug/);
  assert.doesNotMatch(app, /useState\([^\n]*2008-09/);
  assert.match(app, /Today|today/);
  assert.match(app, /retroMode/);
  assert.doesNotMatch(app, /t\("yesterday"\)|t\("tomorrow"\)|t\("calendar"\)/);
});

test('Retro today revalidates every 12 seconds and aborts when mode/season changes', () => {
  const app = read('components/FootGlobeApp.tsx');
  assert.match(app, /RETRO_REVALIDATE_MS = 12_000/);
  assert.match(app, /\/api\/retro\/today\?season=/);
  assert.match(app, /new AbortController\(\)/);
  assert.match(app, /window\.setInterval\(\(\) => void load\(false\), RETRO_REVALIDATE_MS\)/);
  assert.match(app, /controller\.abort\(\)/);
});

test('Replay scores never use final score before finished and future events stay hidden', () => {
  const replay = read('lib/retro-replay.ts');
  assert.match(replay, /simulation\.status === "finished"/);
  assert.match(replay, /finalHomeScore/);
  assert.match(replay, /simulation\.status === "scheduled" \|\| fixture\.simulation\.status === "date_only"/);
  assert.match(replay, /home = 0/);
  assert.match(replay, /isRetroEventReached/);
  assert.match(replay, /event\.simulatedAt/);
  const client = read('lib/footglobe-retro-api.ts');
  assert.match(client, /finalHomeScore: status === "finished" \? finalHomeScore : null/);
  assert.match(client, /finalAwayScore: status === "finished" \? finalAwayScore : null/);
});

test('global goal monitor watches all fixtures once per session and queues simultaneous goals', () => {
  const center = read('components/retro/RetroGoalCenter.tsx');
  assert.match(center, /sessionAnnouncedEventIds = new Set/);
  assert.match(center, /for \(const fixture of fixturesRef\.current\)/);
  assert.match(center, /retroEventKey/);
  assert.match(center, /setQueue\(\(existing\) => \[\.\.\.existing, \.\.\.due/);
  assert.match(center, /setCurrent\(queue\[0\]\)/);
  assert.match(center, /at <= baseline \|\| at > now/);
});

test('Retro goals use the bundled announcement sound, retry blocked playback, and keep YouTube clips keyless', () => {
  const center = read('components/retro/RetroGoalCenter.tsx');
  const audio = read('components/retro/retro-goal-audio.ts');
  const player = read('components/retro/YouTubeClipPlayer.tsx');
  const sound = read('components/retro/retro-sound-settings.ts');
  assert.match(center, /current\?\.event\.sound\?\.volume/);
  assert.match(center, /playRetroGoalAudio/);
  assert.match(center, /retryPendingRetroGoalAudio/);
  assert.doesNotMatch(center, /navigator\.userActivation/);
  assert.match(audio, /AudioContext/);
  assert.match(audio, /context\.resume\(\)/);
  assert.match(audio, /createBufferSource\(\)/);
  assert.match(audio, /playWithPersistentMedia/);
  assert.match(audio, /document\.createElement\("audio"\)/);
  assert.match(audio, /RETRO_GOAL_AUDIO_DATA_URL/);
  assert.match(audio, /element\.play\(\)/);
  assert.match(audio, /\/retro-goal-announcement\.mp3/);
  assert.match(read('components/retro/retro-goal-audio-data.ts'), /data:audio\/mpeg;base64/);
  assert.match(audio, /pendingPlayback/);
  assert.match(audio, /element\.muted = false/);
  assert.match(center, /unlockRetroGoalAudio/);
  assert.match(read('components/retro/RetroSoundControl.tsx'), /unlockRetroGoalAudio\(\)/);
  assert.match(read('components/FootGlobeApp.tsx'), /unlockRetroGoalAudio\(\); setMode\("retro"\)/);
  assert.equal(fs.existsSync(path.join(root, 'public/retro-goal-announcement.mp3')), true);
  assert.match(center, /event\.featured && clip/);
  assert.match(player, /https:\/\/www\.youtube\.com\/iframe_api/);
  assert.match(player, /new YT\.Player/);
  assert.match(player, /seekTo\(startSeconds/);
  assert.match(player, /current >= endSeconds/);
  assert.match(read('lib/retro-replay.ts'), /clip\.enabled === true/);
  assert.doesNotMatch(player + center + sound + audio, /YOUTUBE_API_KEY|AIzaSy/);
});

test('Retro sound defaults to an audible 80% when localStorage has no saved volume', () => {
  const sound = read('components/retro/retro-sound-settings.ts');
  assert.match(sound, /rawVolume === null/);
  assert.match(sound, /rawVolume\.trim\(\) === ""/);
  assert.match(sound, /Number\.NaN/);
  assert.match(sound, /: 0\.8/);
  assert.doesNotMatch(sound, /Number\(window\.localStorage\.getItem\(VOLUME_KEY\)\)/);
});

test('Retro sound menu has a random goal test with 20 meme references split 5 per region', () => {
  const control = read('components/retro/RetroSoundControl.tsx');
  const scenarios = read('components/retro/retro-goal-test.ts');
  assert.match(control, /retroTestGoal/);
  assert.match(control, /RETRO_GOAL_TEST_EVENT/);
  assert.match(scenarios, /RETRO_GOAL_TEST_SCENARIOS/);
  assert.match(scenarios, /Avoid repeating the final scenario/);
  const counts = [...scenarios.matchAll(/region: "(Europe|Americas|Africa|Asia-Pacific)"/g)].reduce((map, match) => {
    map[match[1]] = (map[match[1]] ?? 0) + 1;
    return map;
  }, {});
  assert.deepEqual(counts, { Europe: 5, Americas: 5, Africa: 5, 'Asia-Pacific': 5 });
});

test('historical assets use API-provided logo/kit URLs and StatsBomb is attribution only', () => {
  const client = read('lib/footglobe-retro-api.ts');
  const details = read('components/retro/RetroMatchDetails.tsx');
  assert.match(client, /logoUrl/);
  assert.match(client, /kitUrl/);
  assert.match(details, /retroStatsBombAttribution/);
  assert.match(details, /sourceName\?\.toLowerCase\(\) === "statsbomb-open"/);
});

test('every locale contains all Retro UI keys', () => {
  const keys = ['modeSelector','retroMode','retroModeFull','retroModeBadge','retroKicker','countriesGames.retro.one','countriesGames.retro.other','retroHappeningAgain','retroSeason','retroUnavailable','retroLoading','retroWithMatches','retroReplayClock','retroSounds','retroStatusDateOnly','retroReplayTime','retroReplayTimeHelp','retroHistoricalTime','retroHistoricalDate','retroTeamKit','retroDetailsUnavailable','retroEventsWaiting','retroStatsBombAttribution','retroViewClip','retroReviewClip','retroHistoricalGoal','retroGoal','retroFeaturedGoal','retroLiveNow','retroReplayHistoricalLabel'];
  for (const name of fs.readdirSync(path.join(root,'locales')).filter((file)=>file.endsWith('.json'))) {
    const data=JSON.parse(read(`locales/${name}`));
    for (const key of keys) assert.equal(typeof data[key], 'string', `${name} missing ${key}`);
  }
});

test('globe and Discloud deployment contract remain untouched', () => {
  const globe = read('components/globe/FootballGlobe.tsx');
  const config = read('discloud.config');
  assert.match(globe, /globeImageUrl="\/earth-day\.jpg"/);
  assert.match(globe, /objectsData=\{countries\}/);
  assert.match(config, /^TYPE=site$/m);
  assert.match(config, /^ID=footglobe$/m);
  assert.match(config, /^MAIN=server\.mjs$/m);
});

test('Retro renders the complete historical matchday and counts fixtures, not only live matches', () => {
  const app = read('components/FootGlobeApp.tsx');
  const card = read('components/retro/RetroMatchCard.tsx');
  assert.match(app, /const retroFixtures = retroData\?\.fixtures \?\? \[\]/);
  assert.match(app, /const retroFixtureCount = retroFixtures\.length/);
  assert.match(app, /mode === "retro" \? retroFixtures :/);
  assert.doesNotMatch(app, /mode === "retro" \? retroFixtures\.filter/);
  assert.match(app, /fixture\.simulation\.status === "live" \|\| fixture\.simulation\.status === "halftime"/);
  for (const status of ['scheduled','live','halftime','finished']) assert.match(card, new RegExp(`${status}:`));
});

test('Retro clearly distinguishes the real day from the historical replay day', () => {
  const app = read('components/FootGlobeApp.tsx');
  assert.match(app, /retroTodayDate = replayDateLabel\(dateKey\)/);
  assert.match(app, /retroReplayDate = replayDateLabel\(retroData\?\.simulation\.historicalDate\)/);
  assert.match(app, /t\("today"\)/);
  assert.match(app, /t\("retroReplayHistoricalLabel"\)/);
});
