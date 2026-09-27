# CarbonCTRL

CarbonCTRL is a carbon management web app for tracking emissions, viewing insights, and generating recommendations. It includes a React dashboard, an Express API, and optional ML-based forecasting.

## What it does
- Track carbon activities and emissions
- Show dashboards and benchmarks
- Generate ML-backed recommendations (optional Gemini enhancement)

## Tech stack
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express, SQLite (Drizzle ORM)
- ML: Python, TensorFlow, scikit-learn

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

## ML Models & Limitations

> [!NOTE]
> **Synthetic Data & Scope Notice:**
> The forecasting models and benchmark heuristics in this prototype are trained on **synthetically generated emissions time-series data** for hackathon demonstration purposes.
> Predictions represent regression point estimates for short-term (7-day) trend exploration and should not be treated as calibrated real-world industrial carbon audits.

- **Prediction Engine**: LSTM + Attention sequence model for 7-day carbon emission trajectory forecasting
- **Recommendation Engine**: Multi-factor scoring prioritizing low-cost, high-impact emission reduction strategies tailored by industry profile
- **Anomaly Detection**: Statistical and isolation-based detection of sudden emission spikes

## License
MIT License – see [LICENSE](LICENSE).
