# Jet Broker — Quote Aggregator

A Next.js dashboard for private jet brokers to aggregate, compare, and manage charter quote emails. The app automatically parses incoming quote emails (plain text, HTML, and PDF), groups them by trip (route + date), and presents an Avinode-style comparison table with sortable columns, FAA registry lookups, and full email previews.

## Quickstart

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables are required for the demo.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Use default settings — no environment variables needed for the demo.
4. Deploy.

## Connecting to Office 365 (Phase 2)

To connect a real Office 365 inbox and pull quote emails via Microsoft Graph:

1. Register an app at portal.azure.com → App registrations.
2. Add API permission: **Microsoft Graph → Delegated → Mail.Read** (READ-ONLY — do not request Mail.ReadWrite).
3. Grant admin consent.
4. Set redirect URI to your Vercel URL.
5. Store `CLIENT_ID`, `TENANT_ID`, `CLIENT_SECRET` as Vercel env vars.

Then implement the live Graph API calls in `lib/o365-client.ts` — the rest of the app is already wired to use `fetchQuoteEmails()` as its only data source.

## Adding New Airports

Edit `lib/airport-lookup.ts` to add entries to the `airports` array. Each entry needs:

- `icao` — 4-letter ICAO code (e.g., `KTEB`)
- `iata` — 3-letter IATA code (e.g., `TEB`)
- `name` — Human-readable airport name
- `aliases` — Array of lowercase city/name aliases for subject-line matching

## Customizing the Quote Parser

The quote extraction logic lives in `lib/quote-parser.ts`. Functions like `extractPrice`, `extractAircraft`, `extractTailNumber`, etc. use regex patterns to pull structured data from email bodies. Add new patterns or adjust existing ones to handle additional email formats from operators.
