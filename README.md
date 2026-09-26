# JetBroker: Charter Operations

A Next.js app that runs the private jet brokerage workflow end to end:

1. **Inquiries**: paste any client email, web form, or call notes. Claude (or the built-in rules engine) extracts route, dates, passengers, budget, and contact details, scores the lead Hot/Warm/Cold with transparent reasons, and prices the trip instantly by aircraft category.
2. **RFQs**: matched operators are picked from the operator network by category and base. In demo mode their responses are simulated and stream in live; in live mode an RFQ email is drafted for you.
3. **Quotes**: operator quote emails (text, HTML, PDF) are parsed from Outlook, grouped by trip, and ranked with a value score.
4. **Proposals**: pick options (or auto pick best 3), set markup, draft the cover email with AI, and share a branded client page where the client can reserve an aircraft.
5. **Schedule**: bookings with margin tracking and an ops checklist (contract, wire, operator confirmation, crew, catering, ground, itinerary).
6. **Dashboard**: what needs attention, pipeline, upcoming flights, live activity, and hours of manual work replaced.

The header toggle switches between **Demo data** (a built-in inbox dated relative to today) and **Live inbox** (Outlook). Settings has **Reset demo data** to start a walkthrough fresh. See `DEMO.md` for a demo run sheet.

Broker workflow state (inquiries, proposals, bookings) is stored in the browser for now; quotes come from the server.

## Quickstart

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables are required for the demo. Set `ANTHROPIC_API_KEY` to turn on Claude for quote parsing, inquiry extraction, and email drafting; without it, rules and templates run instead. `SITE_PASSWORD` sets the login password.

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
