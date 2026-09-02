<div align="center">
  <img src="./public/brand-mark.png" alt="FootGlobe logo" width="112" />

  # FootGlobe

  **Follow football across the globe.**

  Explore today's matches on an interactive 3D Earth, jump into a historical Retro experience, discover broadcasts and highlights, and follow football country by country.

  [![Live Demo](https://img.shields.io/badge/Live-Demo-00AEEF?style=for-the-badge&logo=googlechrome&logoColor=white)](https://footglobe.online)
  [![X](https://img.shields.io/badge/@FootGlobeLive-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/FootGlobeLive)

  ![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
  ![React](https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
  ![Three.js](https://img.shields.io/badge/Three.js-3D-000000?style=flat-square&logo=three.js&logoColor=white)
  ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
  ![Locales](https://img.shields.io/badge/i18n-27_locales-7C3AED?style=flat-square)

  **[English](./README.md) · [Português (Brasil)](./README.pt-BR.md)**
</div>

<br />

<img src="./public/footglobe-social-preview.webp" alt="FootGlobe — Follow Football Across the Globe" width="100%" />

## About

FootGlobe is a football discovery experience built around an interactive globe. Instead of starting from a league list, the interface starts with the world: countries with matches become the navigation layer, and every fixture can be explored from there.

The project combines a modern real-time match experience with a **Retro mode** designed to replay historical matchdays as if they were happening now.

## Highlights

- **Interactive 3D globe** powered by Three.js / `react-globe.gl`.
- **Today's football** grouped by country with scores, status, competitions and team branding.
- **Retro mode** with historical seasons, replay timing, match details, goal center and sound controls.
- **Country-first discovery** with search across countries, clubs and competitions.
- **Where to watch** integration for available broadcast information.
- **Video highlights** powered through a server-side YouTube integration when configured.
- **27 locales** with automatic browser-language detection and RTL support for Arabic.
- **Automatic dark/light theme** with persisted user preference.
- **Responsive design** for mobile and desktop.
- **Donations** through Pix in Brazil and crypto options when the related server credentials are configured.
- **Server-side secrets only** — external payment and video credentials are never required in client code.

## Retro mode

Retro mode turns historical football into a live-feeling experience. FootGlobe requests available seasons from the FootGlobe API and renders a historical matchday with replay-aware timing.

It includes:

- historical fixtures and scores;
- simulated match states;
- retro country and match panels;
- a goal center synchronized with the replay;
- optional goal audio controls;
- historical team assets when available.

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS, shadcn-style components |
| App runtime | Next.js 16 + Vinext/Vite |
| 3D globe | Three.js, `react-globe.gl`, `world-atlas`, TopoJSON |
| Validation | Zod |
| Forms | React Hook Form |
| Main football data | FootGlobe API |
| Broadcast lookup | TheSportsDB |
| Highlights | YouTube Data API (optional) |
| Brazil donations | GoatPay / Pix (optional) |
| Crypto donations | Binance APIs (optional) |
| Deployment | Discloud-ready Node.js site |

## Project structure

```text
footglobe/
├── app/                    # App shell, metadata and server API routes
├── components/
│   ├── globe/              # Interactive 3D Earth
│   ├── matches/            # Today-mode match UI
│   ├── retro/              # Retro replay experience
│   ├── donations/          # Donation interface
│   └── ui/                 # Reusable UI primitives
├── i18n/                   # Internationalization provider/config
├── locales/                # 27 translation files
├── lib/                    # FootGlobe API clients and shared utilities
├── services/               # Football, broadcast, highlight and donation services
├── public/                 # Brand assets, icons and social preview
├── tests/                  # Regression and integration-oriented tests
├── types/                  # Shared TypeScript types
├── .github/                # CI, issue templates and contribution workflow
└── discloud.config         # Production deployment configuration
```

## Getting started

### Requirements

- Node.js **22.13.0 or newer**
- npm
- Linux is recommended for the repository helper scripts

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure environment variables

Copy the example file:

```bash
cp .env.example .env.local
```

The application has a default public FootGlobe API URL, so the core experience can run without placing the API URL in the file. Optional integrations need their own credentials.

| Variable | Required | Purpose |
| --- | :---: | --- |
| `FOOTGLOBE_API_URL` | No | Overrides the default FootGlobe API base URL |
| `SPORTSDB_API_KEY` | No | Optional TheSportsDB key for broadcast lookup |
| `YOUTUBE_API_KEY` | No | Enables YouTube highlight search |
| `GOATPAY_API_KEY` | No | Enables Pix donation creation/status |
| `BINANCE_API_KEY` | No | Enables crypto donation functionality |
| `BINANCE_API_SECRET` | No | Binance signing secret for crypto donation functionality |
| `PORT` | No | Production server port; defaults to the runtime value |

> [!CAUTION]
> Never commit `.env`, `.env.local`, API keys, payment credentials or secrets. The repository is configured to ignore environment files while keeping `.env.example` tracked.

### 3. Start development

```bash
npm run dev
```

### 4. Production build

```bash
npm run build
npm run start
```

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the local development environment |
| `npm run build` | Builds the production application |
| `npm run start` | Starts the production server |
| `npm run lint` | Runs ESLint |
| `npm test` | Builds the app and runs the repository test suite |
| `npm run db:generate` | Generates Drizzle migrations when the optional schema changes |

## API boundary

The browser does **not** need direct access to private provider credentials. The main UI requests local routes such as:

```text
/api/matches
/api/live
/api/watch
/api/highlights
/api/retro/*
/api/donations/*
```

Those routes handle server-side integrations and normalize data before it reaches the interface.

The primary football source is the FootGlobe API:

```text
https://footglobe-api-nu.vercel.app
```

## Internationalization

FootGlobe currently ships with **27 locale files**. The locale is detected from saved preference first, then browser language, with English as fallback. Country names and match date/time formatting use the visitor's locale and timezone whenever supported.

Arabic automatically switches the interface to RTL while the globe itself remains unmirrored.

## Deployment

A `discloud.config` is included for the current production setup.

```ini
TYPE=site
MAIN=server.mjs
RAM=512
BUILD=npm ci --include=dev && npm run build
START=npm run start
```

The app can also be adapted to another Node.js-compatible host as long as the required environment variables are configured securely.

## Contributing

Contributions, bug reports and feature ideas are welcome. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening a pull request.

## Security

Please do not publish API keys, tokens or payment credentials in issues, pull requests, screenshots or commits. See [`SECURITY.md`](./SECURITY.md) for reporting guidance.

---

<div align="center">
  <strong>FootGlobe</strong><br />
  Football, mapped to the world.
  <br /><br />
  <a href="https://footglobe.online">Live site</a> ·
  <a href="https://x.com/FootGlobeLive">@FootGlobeLive</a>
</div>
