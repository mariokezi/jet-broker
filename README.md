# JetBroker: Charter Operations

A Next.js app that runs the private jet brokerage workflow end to end:

1. **Inquiries**: paste any client email, web form, or call notes. Claude (or the built-in rules engine) extracts route, dates, passengers, budget, and contact details, scores the lead Hot/Warm/Cold with transparent reasons, and prices the trip instantly by aircraft category.
2. **RFQs**: matched operators are picked from the operator network by category and base. In demo mode their responses are simulated and stream in live; in live mode an RFQ email is drafted for you.
3. **Quotes**: operator quote emails (text, HTML, PDF) are parsed from Outlook, grouped by trip, and ranked with a value score.
4. **Proposals**: pick options (or auto pick best 3), set markup, draft the cover email with AI, and share a branded client page where the client can reserve an aircraft.
5. **Schedule**: bookings with margin tracking and an ops checklist (contract, wire, operator confirmation, crew, catering, ground, itinerary).
6. **Empty Legs network**: brokers and operators post empty repositioning legs, filter by region (Florida first) and aircraft size, message each other per leg, and claim a leg for a client. Legs that fit open inquiries are flagged automatically with the saving versus a normal charter, and any booking's empty return can be posted in one click.
7. **Dashboard**: what needs attention, pipeline, upcoming flights, live activity, and hours of manual work replaced.

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

## Connecting Outlook

Open **/connect** (sidebar: Connect Outlook). Anyone signs in with Microsoft there and picks any Outlook.com, Hotmail, Live or Microsoft 365 account. Access is read only (`Mail.Read`, `User.Read`), the sign-in is stored encrypted in that browser's cookies, and the page shows the connected account, inbox totals, Switch account and Disconnect. Until the settings below exist, the page shows the setup steps and the exact redirect URI to register.

One-time setup:
1. Azure portal, App registrations, New registration. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
2. Redirect URI (Web): `https://<your-domain>/api/auth/callback`. Add one per address you sign in from (production and any preview link).
3. API permissions, Microsoft Graph, Delegated: `Mail.Read`, `User.Read`, `offline_access`, `openid`, `profile`, `email`.
4. Certificates & secrets: new client secret, copy its Value.
5. Vercel environment variables, then redeploy: `CLIENT_ID` (Application ID), `CLIENT_SECRET` (secret Value), `COOKIE_SECRET` (64 hex characters, e.g. `openssl rand -hex 32`). `TENANT_ID` and `NEXT_PUBLIC_APP_URL` are optional; the sign-in uses the `common` endpoint and the address of the current request.

Company accounts may need their Microsoft 365 admin to approve the app once.

## Adding New Airports

Edit `lib/airport-lookup.ts` to add entries to the `airports` array. Each entry needs:

- `icao` — 4-letter ICAO code (e.g., `KTEB`)
- `iata` — 3-letter IATA code (e.g., `TEB`)
- `name` — Human-readable airport name
- `aliases` — Array of lowercase city/name aliases for subject-line matching

## Customizing the Quote Parser

The quote extraction logic lives in `lib/quote-parser.ts`. Functions like `extractPrice`, `extractAircraft`, `extractTailNumber`, etc. use regex patterns to pull structured data from email bodies. Add new patterns or adjust existing ones to handle additional email formats from operators.
