# CarbonCTRL

CarbonCTRL is a carbon management web app for tracking emissions, viewing insights, and generating recommendations. It includes a React dashboard, an Express API, and Gemini-generated reduction recommendations.

## What it does
- Track carbon activities and emissions
- Show dashboards and benchmarks
- Generate personalized reduction recommendations with Google Gemini

## Tech stack
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express, SQLite (Drizzle ORM)
- AI: Google Gemini (`gemini-2.5-flash`)

## Quick start
1) Use Node.js 24 and install dependencies
```
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

The Recommendations page sends the company profile, emissions breakdown, recorded activities and selected focus sectors to Gemini, which returns 4-6 prioritized recommendations. Impact figures are Gemini's estimates, not audited values. If `GEMINI_API_KEY` is unset or Gemini's response can't be parsed, the API returns a small static set of recommendations instead.

## License
MIT License – see [LICENSE](LICENSE).
