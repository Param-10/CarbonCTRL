# CarbonCTRL

CarbonCTRL is a carbon management web app for tracking emissions, viewing insights, and generating recommendations. It includes a React dashboard, an Express API, and Gemini-generated reduction recommendations.

## What it does
- Guided setup for new companies: company basics, a quick footprint (bill amounts accepted), then an instant grade and top actions
- An in-app "How it works" guide that walks new users through the monthly routine and points to their next step
- Track activity in US units across business categories (electricity, heating & cooling, vehicles, travel, commuting, freight, waste, materials), month by month or one entry at a time
- Grade emissions per employee against the company's industry, with monthly trends
- Generate personalized reduction recommendations with Google Gemini, refreshed in the background when data changes
- Turn recommendations into an action plan and track it against the company's reduction target
- Export an emissions report for any period (CSV, or print to PDF)
- Optional monthly reminder emails to log last month (uses the same Resend settings as password reset; `REMINDER_FROM_EMAIL` overrides the sender)

## Tech stack
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express, SQLite (Drizzle ORM)
- AI: Google Gemini (`gemini-pro-latest`, falling back through Flash models when out of quota or overloaded)

## Quick start
1) Use Node.js 24 and install dependencies (`.nvmrc` pins the version; the server exits with an error on older Node)
```
nvm use
npm install
```

2) Backend env (server/.env)
```
JWT_SECRET=...           # required, long random string
PORT=3001
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=...     # optional Google Identity Services web client ID
RESEND_API_KEY=...       # required only to enable password reset emails
RESET_FROM_EMAIL=...     # sender on a verified Resend domain
GEMINI_API_KEY=...       # optional; without it recommendations use a static fallback
GEMINI_MODEL=...         # optional; defaults to gemini-pro-latest (needs billing on the key's Google Cloud project)
GEMINI_FALLBACK_MODELS=... # optional, comma-separated; tried in order when a model is out of quota or overloaded
                         # (default gemini-3.8-flash,gemini-3.7-flash,gemini-3.5-flash; empty to disable)
TRUST_PROXY=1            # production only: number of proxies in front of the API (e.g. Render)
```

3) Frontend env (root/.env.local)
```
VITE_API_URL=http://localhost:3001/api
VITE_GOOGLE_CLIENT_ID=...  # same value as GOOGLE_CLIENT_ID
```

4) Run
```
npm run server
npm run dev
```

5) Test
```
npm test
```

The API creates `server/data/carbonctrl.db` and applies Drizzle migrations at startup. Set `DATABASE_PATH` to use a different SQLite file. The database file is local and gitignored. Existing MongoDB records are **not** imported automatically; back them up and migrate them explicitly before switching a deployment that has live data.

Password reset links are sent only by email. Set both `RESEND_API_KEY` and `RESET_FROM_EMAIL` on the server and verify the sender domain with Resend. Without them, the reset request returns `503` and no token is issued. The API never returns or logs a reset link. The frontend shows a generic success message for existing and unknown emails.

## Recommendations

The Recommendations page sends the company profile, emissions breakdown, recorded period, per-employee intensity, activities and selected focus sectors to Gemini, which returns 4-6 prioritized recommendations as schema-checked JSON. The server then:

- drops recommendations that conflict with the profile (e.g. rooftop solar for a tenant, fleet changes with no vehicles, costs above the stated budget, measures already in place) and, if too few remain, asks Gemini once more with the reasons;
- caps each impact at the emissions of the sector it targets and computes the summary itself.

Recommendations use the strongest available model (`gemini-pro-latest`) with high thinking. A free-tier key can't use Pro models, so until billing is enabled the Flash fallbacks answer; a model that runs out of quota or is overloaded is skipped for a while and the next one is tried.

Impact figures are Gemini's estimates, not audited values. If `GEMINI_API_KEY` is unset or Gemini fails, the API returns a small static set of recommendations with a notice that says why (no key, key rejected, quota reached, Gemini busy or too slow).

After setting `GEMINI_API_KEY`, run `npm run check:gemini` to test the live integration against three sample companies.

## Emission factors

Factors live in `server/config/emissionFactors.js`, in metric tonnes CO2e per US unit (kWh, therms, gallons, miles, lbs, short tons), with AR5 GWPs. Each factor cites its source (`FACTOR_SOURCES`): mostly the EPA GHG Emission Factors Hub (January 2025), plus worldsteel, IAI and GCCA for steel, aluminum and cement. Factors with no authoritative US default (hotel nights, wastewater, plastics, paper, chemicals, electronics, agriculture) are marked indicative.

Grid electricity uses the company's state rate from EPA eGRID2023 (`server/config/stateGridFactors.js`), or the US average when no state is set. State rates describe generation in the state; EPA recommends eGRID subregion factors (by ZIP code) for formal inventories. Renaming a category or activity key requires a data migration (see `server/db/migrations/0007_*`).

The in-app Methodology page (`/methodology`, backed by the public `GET /api/methodology`) shows every factor, source, state rate, benchmark and grade band from the same config the calculations use.

## Carbon grade

The grade compares annualized emissions per employee with a typical figure for the company's industry (`server/config/industryBenchmarks.js`), so it scales with company size. Office, retail, food service, lodging, health care, education and warehouse-type industries are graded on building energy (electricity plus heating and cooling) against EIA CBECS 2018 energy use per worker, converted with the company's state grid rate; they get no grade until electricity or heating is logged. Industrial sectors are graded on total emissions against indicative figures. Emissions are annualized from the months the activities span; with less than three months of data the grade is marked provisional. The headcount is the exact figure from the Company Profile when given, otherwise an estimate from the employee range.

## License
MIT License – see [LICENSE](LICENSE).
