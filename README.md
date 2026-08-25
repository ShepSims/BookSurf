# BookSurf MVP

**BOOKSURF — Surf books. Book surf.**

This repository focuses on the **Book Surf** product: a surf-trip opportunity engine that finds surf first and prices only qualified trip windows second.

## Architecture

The core pipeline is:

1. Load active surf watches and DB-editable destinations.
2. Fetch normalized marine + weather forecasts.
3. Deterministically score hourly surf and group contiguous surf windows.
4. Keep only the top surf candidates.
5. Generate bounded trip-date permutations.
6. Search flight/lodging adapters and estimate board + local transport.
7. Calculate complete per-person and group economics.
8. Reject over-budget trips and rank survivors.
9. Upsert deterministic opportunity identities and persist price/surf snapshots.
10. Alert only on meaningful changes.

External providers live behind `src/lib/providers/**` interfaces. Cron orchestration is in `src/lib/discovery/engine.ts`; the Vercel endpoint is `/api/cron/discover`.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Commercial travel credentials are optional. By default:

```text
BOOKSURF_PROVIDER_MODE=mock
BOOKSURF_DEMO_FORECAST_MODE=mock
```

Run the deterministic end-to-end demo with:

```bash
npm run discovery:demo
```

The demo uses deterministic forecast + flight + lodging fixtures and destination-based board/transport estimates. It never presents mocked prices as live.

## Supabase

Migrations live in `supabase/migrations/` and destination seed data in `supabase/seed.sql`.

User-owned tables use RLS. `discovery_runs` intentionally has RLS enabled with no user policy: it is service-role-only operational metadata.

For browser auth, use either the requested legacy env name or the current publishable-key name:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

The cron additionally requires `SUPABASE_SERVICE_ROLE_KEY`; never expose it through a `NEXT_PUBLIC_` variable.

## Data providers

- **Marine:** Open-Meteo Marine, live, no API key.
- **Weather:** Open-Meteo Weather, live, no API key.
- **Tide:** provider abstraction with Open-Meteo sea-level proxy for MVP only.
- **Flights:** deterministic mock by default; Travelpayouts/Aviasales Data API adapter in live mode.
- **Lodging:** deterministic mock in V1.
- **Boards / transport:** curated destination estimates.

Travelpayouts Data API fares are labeled **cached**, not live. Its response does not expose carry-on pricing/inclusion, so the adapter refuses to return a “complete” flight option when a watch requires carry-on baggage.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
npm run discovery:demo
```

## Deployment

Deploy to Vercel, add the env variables from `.env.example`, and keep the daily cron in `vercel.json`. The cron request must include `Authorization: Bearer $CRON_SECRET`.
