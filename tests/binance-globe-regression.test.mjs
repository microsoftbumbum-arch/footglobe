import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFile(path.join(root, file), "utf8");

test("Binance donation service uses signed Wallet/Capital calls with time synchronization", async () => {
  const service = await read("services/donations/binance.ts");
  assert.match(service, /\/api\/v3\/time/);
  assert.match(service, /\/sapi\/v1\/capital\/config\/getall/);
  assert.match(service, /\/sapi\/v1\/capital\/deposit\/address/);
  assert.match(service, /\/sapi\/v1\/capital\/deposit\/hisrec/);
  assert.match(service, /createHmac\("sha256"/);
  assert.match(service, /X-MBX-APIKEY/);
  assert.match(service, /recvWindow/);
  assert.match(service, /apiCode === -1021/);
  assert.doesNotMatch(service, /console\.(?:log|warn|error)\([^\n]*(?:signature|secret|BINANCE_API_KEY|BINANCE_API_SECRET)/i);
});

test("crypto UI has controlled retry and server-rendered QR", async () => {
  const dialog = await read("components/donations/DonationDialog.tsx");
  const qrRoute = await read("app/api/donations/crypto/qr/route.ts");
  assert.match(dialog, /loadCryptoOptions\(true\)/);
  assert.match(dialog, /t\("tryAgain"\)/);
  assert.match(dialog, /\/api\/donations\/crypto\/qr\?value=/);
  assert.match(qrRoute, /image\/svg\+xml/);
});

test("globe uses one lightweight shared soccer-ball sprite layer without rings or point cylinders", async () => {
  const globe = await read("components/globe/FootballGlobe.tsx");
  const app = await read("components/FootGlobeApp.tsx");
  assert.match(globe, /new THREE\.CanvasTexture\(canvas\)/);
  assert.match(globe, /sharedBallMaterial/);
  assert.match(globe, /new THREE\.Sprite\(getBallMaterial\(\)\)/);
  assert.match(globe, /objectsData=\{countries\}/);
  assert.match(globe, /renderer\.setPixelRatio\(dragRatio\)/);
  assert.match(globe, /activePolygons/);
  assert.doesNotMatch(globe, /ringsData|pointsData|ringRepeatPeriod|ringPropagationSpeed|pointRadius/);
  assert.doesNotMatch(`${globe}\n${app}`, /\u{26BD}/u);
});

test("Discloud deployment contract remains unchanged", async () => {
  const config = await read("discloud.config");
  const server = await read("server.mjs");
  assert.match(config, /^TYPE=site$/m);
  assert.match(config, /^ID=footglobe$/m);
  assert.match(config, /^MAIN=server\.mjs$/m);
  assert.match(server, /process\.env\.PORT \?\? "8080"/);
  assert.match(server, /const host = "0\.0\.0\.0"/);
});

test("Binance donations tolerate catalogue/time outages while preserving signed address generation", async () => {
  const service = await read("services/donations/binance.ts");
  assert.match(service, /RECV_WINDOW_MS = 60_000/);
  assert.match(service, /FALLBACK_DEPOSIT_COINS/);
  assert.match(service, /network: "AUTO"/);
  assert.match(service, /selectedNetwork\.network\.toUpperCase\(\) !== "AUTO"/);
  assert.match(service, /return \{ offsetMs: 0, base: BINANCE_BASES\[0\] \}/);
});

test("Today Retro selector stays physically centered and utilities orbit only from the hamburger", async () => {
  const css = await read("app/globals.css");
  const app = await read("components/FootGlobeApp.tsx");
  assert.match(css, /\.topbar > \.mode-nav[\s\S]*left: 50%[\s\S]*translate\(-50%, -50%\)/);
  assert.match(css, /quarter-orbit around the hamburger/);
  assert.match(app, /utility-search-action/);
  assert.match(app, /utility-language-action/);
  assert.match(app, /utility-theme-action/);
  assert.equal((app.match(/className="search-wrap"/g) ?? []).length, 1);
});
