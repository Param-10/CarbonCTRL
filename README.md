# CarbonCTRL

CarbonCTRL is a carbon management web app for tracking emissions, viewing insights, and generating recommendations. It includes a React dashboard, an Express API, and optional ML-based forecasting.

## What it does
- Track carbon activities and emissions
- Show dashboards and benchmarks
- Generate ML-backed recommendations (optional Gemini enhancement)

## Tech stack
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express, MongoDB
- ML: Python, TensorFlow, scikit-learn

## Quick start
1) Install dependencies
```
npm install
```

2) Backend env (server/.env)
```
MONGODB_URI=...
JWT_SECRET=...
PORT=5000
FRONTEND_URL=http://localhost:5173
```

3) Frontend env (root/.env.local)
```
VITE_API_URL=http://localhost:5000/api
```

4) Run
```
cd server && node index.js
npm run dev
```

## ML Models

- **Prediction**: LSTM + Attention for 7-day carbon forecasting (trained on 1500+ days)
- **Recommendations**: 8+ strategies with industry-specific personalization
- **Response time**: <100ms average

Trained on synthetic data.
## License
MIT License – see [LICENSE](LICENSE).
