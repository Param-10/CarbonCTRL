# CarbonCTRL MongoDB Migration & Deployment Guide

## ✅ Migration Completed

The project has been successfully migrated from Supabase to MongoDB with JWT authentication. Here's what was changed:

### 🔄 Changes Made

1. **Database Migration**
   - ✅ Removed all Supabase dependencies
   - ✅ Created MongoDB models (User, CompanyProfile, CarbonAssessment, CarbonActivity, Emission)
   - ✅ Set up Express.js + MongoDB backend

2. **Authentication System**
   - ✅ Replaced Supabase Auth with JWT-based authentication
   - ✅ Added proper password hashing with bcrypt
   - ✅ Maintained same auth store interface (no UI changes needed)

3. **Backend Infrastructure**
   - ✅ Created Express.js server with MongoDB connection
   - ✅ Implemented all API routes (auth, company, carbon, gemini)
   - ✅ Added security middleware (helmet, CORS, rate limiting)

## 🚀 Deployment Instructions

### 1. Set Up MongoDB Database

You need a MongoDB database. Here are your options:

#### Option A: MongoDB Atlas (Recommended)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account and cluster
3. Get your connection string (format: `mongodb+srv://username:password@cluster.mongodb.net/carbonctrl`)

#### Option B: Local MongoDB
1. Install MongoDB locally
2. Use connection string: `mongodb://localhost:27017/carbonctrl`

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# MongoDB Configuration
MONGODB_URI=your-mongodb-connection-string

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long

# API Configuration
NODE_ENV=production
PORT=5000

# Gemini AI Configuration (keep your existing key)
GEMINI_API_KEY=your-existing-gemini-api-key

# Frontend URL (update with your Netlify domain)
FRONTEND_URL=https://your-app.netlify.app
```

### 3. Deploy Backend

You'll need to deploy the backend server. Here are recommended options:

#### Option A: Railway (Easy)
1. Push your code to GitHub
2. Go to [Railway](https://railway.app/)
3. Connect your GitHub repo
4. Railway will auto-detect it's a Node.js app
5. Add your environment variables in Railway dashboard
6. Deploy

#### Option B: Render (Free tier available)
1. Push your code to GitHub
2. Go to [Render](https://render.com/)
3. Create a new Web Service
4. Connect your GitHub repo
5. Set build command: `npm install`
6. Set start command: `npm run server`
7. Add environment variables
8. Deploy

#### Option C: Heroku
1. Install Heroku CLI
2. `heroku create your-app-name`
3. `heroku config:set MONGODB_URI=your-connection-string`
4. Add other environment variables
5. `git push heroku main`

### 4. Update Frontend Environment

Update your Netlify environment variables:

```env
# Replace old Supabase variables with:
VITE_API_URL=https://your-backend-url.herokuapp.com/api
VITE_GEMINI_API_KEY=your-gemini-api-key
```

### 5. Update Frontend Code

In your `server/index.js`, update the CORS origin:

```javascript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-netlify-domain.netlify.app'] 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
```

## 🧪 Testing the Migration

### 1. Test Backend Locally
```bash
# Install dependencies
npm install

# Start backend server
npm run server:dev

# Server should start on http://localhost:5000
```

### 2. Test Frontend Locally
```bash
# In a new terminal, start frontend
npm run dev

# Frontend should start on http://localhost:5173
```

### 3. Test Authentication
1. Go to the auth page
2. Create a new account
3. Sign in
4. Verify all features work (company profile, carbon tracking, etc.)

## 📁 New File Structure

```
CarbonCTRL/
├── server/                 # New backend
│   ├── index.js           # Main server file
│   ├── models/            # MongoDB models
│   ├── routes/            # API routes
│   └── middleware/        # Auth middleware
├── src/                   # Frontend (unchanged structure)
├── environment.example    # Environment template
└── DEPLOYMENT.md         # This file
```

## 🔧 Backend Scripts

```json
{
  "server": "node server/index.js",
  "server:dev": "nodemon server/index.js",
  "start": "npm run server"
}
```

## 🚨 Important Notes

1. **Data Migration**: This is a fresh start - existing Supabase data won't be migrated
2. **Environment Variables**: Make sure to update both backend and frontend env vars
3. **CORS**: Update the allowed origins in your backend for production
4. **Security**: Use a strong JWT secret (32+ characters)
5. **MongoDB**: Set up proper database indexes for performance

## 🐛 Troubleshooting

### Backend Issues
- Check MongoDB connection string
- Verify environment variables are set
- Check server logs for errors

### Frontend Issues
- Verify `VITE_API_URL` points to your deployed backend
- Check browser network tab for API call errors
- Ensure CORS is configured correctly

### Authentication Issues
- Check JWT secret is same on backend
- Verify tokens are being stored in localStorage
- Check network requests for 401 errors

## 🎉 You're Ready!

Your app now uses:
- ✅ MongoDB for database
- ✅ JWT for authentication  
- ✅ Express.js backend
- ✅ Same UI (no changes needed)

Deploy your backend, update environment variables, and you're live with MongoDB! 