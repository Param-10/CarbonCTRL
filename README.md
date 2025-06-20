# CarbonCTRL

Smart carbon management platform for businesses to track, reduce, and offset their carbon emissions.

## Overview

CarbonCTRL helps businesses evaluate their carbon footprint with AI-powered recommendations and real-world offset project suggestions. The platform provides actionable insights to make sustainable business practices accessible and measurable.

## Features

- **Carbon Assessment**: Complete evaluation of your company's carbon footprint across multiple categories
- **AI-Powered Recommendations**: Personalized suggestions to reduce emissions using Google Gemini AI
- **Real-World Offset Projects**: Research-backed carbon offset opportunities with implementation guidance
- **Interactive Dashboard**: Real-time metrics and visualizations of your carbon journey
- **Company Profile Management**: Track sustainability progress over time

## Tech Stack

**Frontend:**
- React with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Zustand for state management
- Framer Motion for animations

**Backend:**
- Express.js with Node.js
- MongoDB with Mongoose
- JWT authentication
- Google Gemini AI integration

## Quick Start

### Prerequisites

- Node.js (v16+)
- MongoDB database
- Google Gemini API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Param-10/CarbonCTRL.git
cd CarbonCTRL
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
# MongoDB Configuration
MONGODB_URI=your_mongodb_connection_string

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# API Configuration
NODE_ENV=development
PORT=3001

# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

4. Create frontend environment file `.env.local`:
```env
VITE_API_URL=http://localhost:3001/api
```

### Development

Start the backend server:
```bash
npm run server:dev
```

Start the frontend development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Production Build

Build the frontend:
```bash
npm run build
```

Deploy the backend to your preferred platform (Render, Railway, Heroku, etc.)

Deploy the frontend `dist` folder to Netlify, Vercel, or similar static hosting.

## API Endpoints

- `POST /api/auth/signin` - User authentication
- `POST /api/auth/signup` - User registration
- `GET /api/carbon/assessment` - Get carbon assessment data
- `POST /api/carbon/activity` - Add carbon activity
- `POST /api/gemini/carbon-recommendations` - Get AI recommendations
- `GET /api/company/profile` - Get company profile

## Deployment

### Backend (Render/Railway/Heroku)
1. Connect your repository
2. Set environment variables
3. Deploy with start command: `npm run server`

### Frontend (Netlify/Vercel)
1. Build the project: `npm run build`
2. Deploy the `dist` folder
3. Add `_redirects` file for SPA routing: `/* /index.html 200`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -m 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.
