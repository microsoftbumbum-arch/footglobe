import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFile(path.join(root, file), "utf8");

test("all configured locale files include the English fallback keys", async () => {
  const config = await read("i18n/config.ts");
  const codes = [...config.matchAll(/\{ code: "([^"]+)"/g)].map((match) => match[1]);
  const english = JSON.parse(await read("locales/en.json"));
  const files = new Set(await readdir(path.join(root, "locales")));

  assert.equal(codes.length, 27);
  for (const code of codes) {
    assert.ok(files.has(`${code}.json`), `missing locale file for ${code}`);
    const dictionary = JSON.parse(await read(`locales/${code}.json`));
    for (const key of Object.keys(english)) {
      assert.ok(key in dictionary, `${code} is missing ${key}`);
    }
  }
});

test("theme bootstrap is dark-first, system-aware, and persistent", async () => {
  const layout = await read("app/layout.tsx");
  const provider = await read("i18n/I18nProvider.tsx");

  assert.match(layout, /data-theme="dark"/);
  assert.match(layout, /prefers-color-scheme: light/);
  assert.match(layout, /footglobe-theme/);
  assert.match(provider, /localStorage\.setItem\(themeStorageKey/);
  assert.match(provider, /addEventListener\("change", systemThemeChanged\)/);
});

test("locale, timezone, RTL, and local formatting are presentation concerns", async () => {
  const app = await read("components/FootGlobeApp.tsx");
  const details = await read("components/matches/MatchDetails.tsx");
  const provider = await read("i18n/I18nProvider.tsx");
  const css = await read("app/globals.css");
  const allSource = `${app}\n${details}\n${provider}\n${css}`;

  assert.match(provider, /navigator\.languages/);
  assert.match(provider, /resolvedOptions\(\)\.timeZone/);
  assert.match(app, /Intl\.DisplayNames/);
  assert.match(details, /Intl\.DateTimeFormat/);
  assert.match(css, /html\[dir="rtl"\]/);
  assert.match(css, /\.globe-stage canvas \{ direction: ltr; \}/);
  assert.doesNotMatch(allSource, /America\/Sao_Paulo/);
});

test("official FootGlobe API integration and natural Earth texture remain intact", async () => {
  const api = await read("lib/footglobe-api.ts");
  const service = await read("services/football/index.ts");
  const globe = await read("components/globe/FootballGlobe.tsx");

  assert.match(api, /FOOTGLOBE_API_URL/);
  assert.match(api, /\/api\/v1\/fixtures/);
  assert.match(service, /getFootGlobeFixtures/);
  assert.doesNotMatch(service, /FOOTBALL_API_KEY|FOOTBALL_DATA_API_KEY|BBS_API_KEY|GOAL_API_KEY/);
  assert.match(globe, /globeImageUrl="\/earth-day\.jpg"/);
  assert.match(globe, /new THREE\.CanvasTexture\(canvas\)/);
  assert.match(globe, /new THREE\.Sprite\(getBallMaterial\(\)\)/);
  assert.doesNotMatch(globe, /ringsData|pointsData|ringRepeatPeriod/);
});
