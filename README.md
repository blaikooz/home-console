# Home Console

A retro terminal-style single-page dashboard for the living room — displays live weather, overhead airspace, and MTA subway arrivals at a glance.

## Features

- **Weather** — current conditions, feels-like, wind, humidity, and precipitation chance via [Open-Meteo](https://open-meteo.com/)
- **Airspace** — aircraft within ~5nm overhead (callsign, altitude, heading, airline) via [ADSB.lol](https://adsb.lol/)
- **Transit** — next 3 arrivals per direction for nearby subway lines using the MTA GTFS-realtime feeds, with color-coded urgency pills (red ≤5 min, yellow ≤10, green ≤15)

Each feed runs on an independent refresh cycle with auto-retry on failure. The MTA feed fetch has a 3-tier fallback (direct → allorigins proxy → codetabs proxy) to dodge Cloudflare/Akamai blocks.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Express server doubling as the Vite dev middleware host
- `lucide-react` for icons, `motion` for animations

## Run locally

**Prerequisites:** Node.js

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:3000`.

## Build

```bash
npm run build
npm start
```

## Configuration

The location (lat/lon) and subway stop IDs are currently hard-coded in [`server.ts`](server.ts). Update those to point the console at a different neighborhood.
