# FootGlobe

FootGlobe is a football project built around an interactive 3D globe. Instead of starting from a league list, you can move around the world and open the matches available in each country.

Live site: https://footglobe.online

## What it has

- interactive 3D globe;
- matches grouped by country;
- live scores and match status;
- Retro mode for historical matchdays;
- search for countries, clubs and competitions;
- broadcast information when available;
- video highlights through YouTube when configured;
- dark/light theme;
- 27 locale files, including RTL support for Arabic;
- mobile and desktop layouts.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Three.js / `react-globe.gl`
- Zod
- React Hook Form

Football data is loaded through the FootGlobe API. Some optional features also use TheSportsDB, YouTube and payment integrations.

## Running locally

Node.js 22.13.0 or newer is recommended.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Production build:

```bash
npm run build
npm run start
```

Useful commands:

```bash
npm run lint
npm test
```

## Environment variables

The main site can run without filling every optional integration. Check `.env.example` for the available variables.

Main ones:

- `FOOTGLOBE_API_URL`
- `SPORTSDB_API_KEY`
- `YOUTUBE_API_KEY`
- `GOATPAY_API_KEY`
- `BINANCE_API_KEY`
- `BINANCE_API_SECRET`
- `PORT`

Do not commit real keys or `.env` files.

## Main folders

```text
app/          app routes and server routes
components/   interface, globe, matches and Retro mode
i18n/         language setup
locales/      translations
lib/          shared clients and utilities
services/     football and integration services
public/       static assets
tests/        tests
types/        shared TypeScript types
```

## Contributions

Bug reports and improvements are welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening a pull request.

Security reports and credential-related issues should follow [`SECURITY.md`](./SECURITY.md).
