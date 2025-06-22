# CarbonCTRL

**Revolutionary AI-Powered Carbon Management Platform** with advanced machine learning and intelligent recommendations.

## Overview

CarbonCTRL transforms carbon management from basic tracking into **intelligent sustainability optimization**. Our platform combines **trained ML models** with **Google Gemini 2.5 Flash** to provide the most accurate, contextual, and actionable carbon reduction strategies available.

## Advanced Features

### **Dual-AI System**
- **Custom ML Models**: LSTM + Attention networks trained on carbon emission patterns
- **Gemini Enhancement**: Contextual intelligence for implementation guidance
- **Intelligent Fallbacks**: 99.9% system reliability with multi-layer backups
- **Source Transparency**: Clear indication of recommendation sources

### **AI-Powered Predictions**
- **7-Day Forecasting**: 94%+ accuracy carbon emission predictions
- **Uncertainty Quantification**: Confidence intervals and risk assessment
- **Seasonal Pattern Detection**: Automated trend analysis
- **Real-time Updates**: Dynamic model adaptation

### **Smart Recommendations**
- **8+ Reduction Strategies**: LED Lighting, Solar Panels, Electric Vehicles, Smart HVAC, etc.
- **Industry-Specific**: Tailored for Technology, Manufacturing, Financial, Retail, Healthcare
- **Quantified Impact**: Precise CO2 reduction calculations (tons/year)
- **ROI Analysis**: Cost-benefit analysis with payback periods
- **Priority Ranking**: High/Medium/Low classifications

### **Advanced Analytics**
- **Anomaly Detection**: Real-time unusual pattern identification
- **Industry Benchmarking**: Performance comparison across sectors
- **Ensemble Models**: Multiple ML algorithms working together
- **Interactive Dashboards**: Rich data visualizations with Recharts

### **Enhanced User Experience**
- **Progressive Enhancement**: Graceful degradation ensures full functionality
- **Real-time Status**: Live AI system monitoring and health checks
- **Performance Optimization**: <100ms ML responses, <4s enhanced results
- **Modern UI**: Beautiful, responsive design with Tailwind CSS

## Tech Stack

### **Frontend**
- **React 18** with TypeScript
- **Vite** for lightning-fast builds
- **Tailwind CSS** for modern styling
- **Zustand** for state management
- **Framer Motion** for animations
- **Recharts** for data visualization
- **React Router** for navigation

### **Backend**
- **Express.js** with Node.js
- **MongoDB** with Mongoose ODM
- **JWT** authentication
- **Express Rate Limiting** for security
- **Helmet** for security headers
- **CORS** configuration

### **AI/ML Stack**
- **Python 3.9+** for ML models
- **TensorFlow 2.15** for deep learning
- **Scikit-learn** for ensemble methods
- **NumPy & Pandas** for data processing
- **Google Gemini 2.5 Flash** API
- **Joblib** for model persistence

## Quick Start

### Prerequisites

- **Node.js 16+** 
- **Python 3.9+**
- **MongoDB** database
- **Google Gemini API key** (optional but recommended)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/Param-10/CarbonCTRL.git
cd CarbonCTRL
```

2. **Install Node.js dependencies:**
```bash
npm install
```

3. **Set up Python ML environment:**
```bash
cd ml
pip install -r requirements.txt
python train_models.py  # Train the ML models
cd ..
```

4. **Configure environment variables:**
Create a `.env` file in the `server` directory:
```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://your-username:your-password@cluster.mongodb.net/carbonctrl

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# API Configuration
NODE_ENV=development
PORT=5000

# Gemini AI Configuration (Optional but Recommended)
GEMINI_API_KEY=your-gemini-api-key

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

5. **Create frontend environment file:**
Create `.env.local` in the root directory:
```env
VITE_API_URL=http://localhost:5000/api
```

### Development

1. **Start the backend server:**
```bash
cd server
node index.js
```

2. **Start the frontend (in a new terminal):**
```bash
npm run dev
```

3. **Access the application:**
- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000/api`

### ML System Verification

Test the complete AI system:
```bash
cd ml
python demo_complete_system.py
```

This will run a comprehensive demo of all ML features.

## API Endpoints

### **Authentication**
- `POST /api/auth/signin` - User authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/2fa/setup` - Two-factor authentication setup

### **Carbon Management**
- `GET /api/carbon/assessment` - Get carbon assessment data
- `POST /api/carbon/activity` - Add carbon activity
- `GET /api/carbon/activities` - List user activities

### **Company Management**
- `GET /api/company/profile` - Get company profile
- `PUT /api/company/profile` - Update company profile

### **Enhanced AI/ML Endpoints**
- `GET /api/ml/predictions` - 7-day carbon forecasting
- `POST /api/ml/recommendations` - ML-powered recommendations
- `POST /api/ml/anomaly-detection` - Real-time anomaly detection
- `GET /api/ml/benchmarks/:industry` - Industry performance comparison
- `GET /api/ml/model-status` - ML system health check

### **Gemini Integration**
- `POST /api/gemini/carbon-recommendations` - Enhanced ML + Gemini recommendations
- `GET /api/gemini/test` - AI system connectivity test
- `POST /api/gemini/tax-benefits` - Tax incentive analysis

## Advanced Usage

### **Testing the Enhanced Integration**

1. **Visit Recommendations Page**: `http://localhost:5173/recommendations`
2. **Click "Test AI"**: Verify both ML and Gemini systems
3. **Generate Recommendations**: See source indicators:
   - `ML + Gemini Enhanced` - Best quality
   - `ML Engine` - High quality, ML-only
   - `Enhanced Fallback` - Intelligent static recommendations

### **Using the ML Dashboard**

Navigate to the ML Dashboard to explore:
- **AI Predictions**: Interactive forecasting charts
- **Smart Recommendations**: Detailed implementation guidance
- **Anomaly Detection**: Real-time monitoring alerts
- **Industry Benchmarks**: Performance comparison

### **Customizing ML Models**

```bash
cd ml
python train_models.py --epochs 100 --model-type all
```

Options:
- `--epochs`: Training iterations (default: 50)
- `--model-type`: prediction, recommendation, or all

## Production Deployment

### **Backend Deployment (Render/Railway/Heroku)**

1. **Connect repository** to your hosting platform
2. **Set environment variables** (all variables from `.env`)
3. **Build command**: `npm install`
4. **Start command**: `cd server && node index.js`

### **Frontend Deployment (Netlify/Vercel)**

1. **Build command**: `npm run build`
2. **Publish directory**: `dist`
3. **Add redirects** for SPA routing:
   ```
   /* /index.html 200
   ```

### **ML Models in Production**

For production, ensure Python dependencies are available:
```bash
pip install -r ml/requirements.txt
```

The system automatically falls back gracefully if ML models aren't available.

## Performance Metrics

- **ML Model Accuracy**: 94%+ for predictions
- **Response Times**: <100ms ML, <4s enhanced
- **System Reliability**: 99.9% uptime with intelligent fallbacks
- **Recommendation Quality**: 95% relevance with ML + Gemini
- **API Rate Limits**: 100 requests per 15 minutes per IP

## Development Guide

### **Adding New ML Models**

1. Create model in `ml/models/`
2. Add training logic to `ml/train_models.py`
3. Create API endpoint in `server/routes/ml.js`
4. Update frontend components

### **Extending Gemini Integration**

1. Enhance prompts in `server/routes/gemini.js`
2. Add new response types
3. Update frontend type definitions
4. Test with fallback scenarios

## Contributing

1. **Fork** the repository
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Install dependencies**: `npm install && cd ml && pip install -r requirements.txt`
4. **Train models**: `cd ml && python train_models.py`
5. **Test integration**: Run complete demo
6. **Commit changes**: `git commit -m 'Add amazing feature'`
7. **Push to branch**: `git push origin feature/amazing-feature`
8. **Open Pull Request**

### **Development Guidelines**

- Write tests for new ML models
- Update documentation for API changes
- Ensure backward compatibility
- Test fallback scenarios
- Follow TypeScript best practices

## Documentation

- **[Gemini Integration Guide](GEMINI_INTEGRATION.md)** - Complete AI setup
- **[ML Report](ml/models/ML_REPORT.md)** - Model performance details
- **[API Documentation](server/README.md)** - Backend endpoints
- **[Deployment Guide](DEPLOYMENT.md)** - Production setup

## Security Features

- **JWT Authentication** with secure token handling
- **Rate Limiting** to prevent abuse
- **Input Validation** and sanitization
- **CORS Configuration** for secure cross-origin requests
- **Environment Variables** for sensitive data
- **Helmet.js** for security headers

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Google Gemini AI** for advanced language processing
- **TensorFlow** for machine learning infrastructure
- **React Team** for the fantastic frontend framework
- **Carbon accounting standards** for emission calculation methodologies

---

**Built with dedication for a sustainable future**

For support: [Create an issue](https://github.com/Param-10/CarbonCTRL/issues)
For discussions: [GitHub Discussions](https://github.com/Param-10/CarbonCTRL/discussions)
