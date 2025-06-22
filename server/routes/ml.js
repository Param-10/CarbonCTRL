/**
 * ML Model Routes for CarbonCTRL
 * Integrates AI/ML capabilities with the main application
 */

import express from 'express';
import auth from '../middleware/auth.js';
import CarbonActivity from '../models/CarbonActivity.js';
import CompanyProfile from '../models/CompanyProfile.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to run Python ML scripts
const runPythonScript = (scriptPath, args = []) => {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [scriptPath, ...args]);
    
    let dataString = '';
    let errorString = '';
    
    python.stdout.on('data', (data) => {
      dataString += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      errorString += data.toString();
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${errorString}`));
      } else {
        try {
          const result = JSON.parse(dataString);
          resolve(result);
        } catch (e) {
          resolve({ output: dataString });
        }
      }
    });
  });
};

// @route   GET /api/ml/predictions
// @desc    Get carbon footprint predictions for the company
// @access  Private
router.get('/predictions', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's historical carbon data
    const activities = await CarbonActivity.find({ userId })
      .sort({ date: -1 })
      .limit(365); // Last year of data
    
    if (activities.length < 30) {
      return res.status(400).json({
        msg: 'Insufficient historical data. Need at least 30 days of carbon activities.'
      });
    }
    
    // Prepare data for ML model
    const historicalData = {};
    activities.reverse().forEach(activity => {
      const date = activity.date.toISOString().split('T')[0];
      
      if (!historicalData[date]) {
        historicalData[date] = {
          energy_consumption: 0,
          transportation: 0,
          waste_generation: 0,
          water_usage: 0,
          total_emissions: 0
        };
      }
      
      // Map activity types to ML features
      switch (activity.type) {
        case 'energy':
          historicalData[date].energy_consumption += activity.amount || 0;
          break;
        case 'transportation':
          historicalData[date].transportation += activity.amount || 0;
          break;
        case 'waste':
          historicalData[date].waste_generation += activity.amount || 0;
          break;
        case 'water':
          historicalData[date].water_usage += activity.amount || 0;
          break;
      }
      
      historicalData[date].total_emissions += activity.carbonFootprint || 0;
    });
    
    // Convert to format expected by ML model
    const mlData = {
      index: Object.keys(historicalData),
      data: Object.values(historicalData)
    };
    
    // Call Python ML prediction script
    const mlScriptPath = path.join(__dirname, '../../ml/predict.py');
    const predictions = await runPythonScript(mlScriptPath, [JSON.stringify(mlData)]);
    
    res.json({
      success: true,
      predictions: predictions.predictions,
      dates: predictions.prediction_dates,
      confidence: predictions.confidence || 0.85,
      message: 'Carbon footprint predictions generated successfully'
    });
    
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({
      msg: 'Error generating predictions',
      error: error.message
    });
  }
});

// @route   POST /api/ml/recommendations
// @desc    Get AI-powered carbon reduction recommendations
// @access  Private
router.post('/recommendations', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { budget_level, urgency_level } = req.body;
    
    // Get company profile
    const company = await CompanyProfile.findOne({ userId });
    
    // Get recent carbon activities for analysis
    const recentActivities = await CarbonActivity.find({ userId })
      .sort({ date: -1 })
      .limit(90); // Last 3 months
    
    // Calculate company metrics
    const totalEmissions = recentActivities.reduce((sum, activity) => 
      sum + (activity.carbonFootprint || 0), 0
    );
    
    const energyConsumption = recentActivities
      .filter(a => a.type === 'energy')
      .reduce((sum, activity) => sum + (activity.amount || 0), 0);
    
    const transportation = recentActivities
      .filter(a => a.type === 'transportation')
      .reduce((sum, activity) => sum + (activity.amount || 0), 0);
    
    const wasteGeneration = recentActivities
      .filter(a => a.type === 'waste')
      .reduce((sum, activity) => sum + (activity.amount || 0), 0);
    
    // Prepare company data for recommendations
    const companyData = {
      total_emissions: totalEmissions,
      energy_consumption: energyConsumption,
      transportation: transportation,
      waste_generation: wasteGeneration,
      water_usage: 0, // Would need to track this separately
      employee_count: company?.employeeCount || 50,
      industry: company?.industry || 'general',
      budget_level: budget_level || 2,
      urgency_level: urgency_level || 2
    };
    
    // Call Python ML recommendation script
    const mlScriptPath = path.join(__dirname, '../../ml/recommend.py');
    const recommendations = await runPythonScript(mlScriptPath, [JSON.stringify(companyData)]);
    
    res.json({
      success: true,
      recommendations: recommendations.recommendations,
      company_analysis: {
        total_emissions: totalEmissions,
        emissions_per_employee: company?.employeeCount ? 
          (totalEmissions / company.employeeCount).toFixed(2) : 'N/A',
        primary_emission_source: energyConsumption > transportation ? 'Energy' : 'Transportation'
      },
      message: 'Personalized recommendations generated successfully'
    });
    
  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({
      msg: 'Error generating recommendations',
      error: error.message
    });
  }
});

// @route   GET /api/ml/benchmarks/:industry
// @desc    Get industry benchmarks and best practices
// @access  Private
router.get('/benchmarks/:industry', auth, async (req, res) => {
  try {
    const { industry } = req.params;
    
    // Call Python ML benchmarks script
    const mlScriptPath = path.join(__dirname, '../../ml/benchmarks.py');
    const benchmarks = await runPythonScript(mlScriptPath, [industry]);
    
    // Get user's current performance for comparison
    const userId = req.user.id;
    const company = await CompanyProfile.findOne({ userId });
    const recentActivities = await CarbonActivity.find({ userId })
      .sort({ date: -1 })
      .limit(365);
    
    const userMetrics = {
      total_emissions: recentActivities.reduce((sum, a) => sum + (a.carbonFootprint || 0), 0),
      employee_count: company?.employeeCount || 1
    };
    
    const userEmissionsPerEmployee = userMetrics.total_emissions / userMetrics.employee_count;
    const industryAverage = benchmarks.benchmarks?.avg_emissions_per_employee || 10;
    
    res.json({
      success: true,
      industry_benchmarks: benchmarks.benchmarks,
      user_performance: {
        emissions_per_employee: userEmissionsPerEmployee.toFixed(2),
        vs_industry_average: {
          difference: (userEmissionsPerEmployee - industryAverage).toFixed(2),
          percentage: (((userEmissionsPerEmployee - industryAverage) / industryAverage) * 100).toFixed(1),
          status: userEmissionsPerEmployee < industryAverage ? 'Above Average' : 'Below Average'
        }
      },
      message: 'Industry benchmarks retrieved successfully'
    });
    
  } catch (error) {
    console.error('Benchmarks error:', error);
    res.status(500).json({
      msg: 'Error retrieving benchmarks',
      error: error.message
    });
  }
});

// @route   POST /api/ml/anomaly-detection
// @desc    Detect anomalies in carbon emission patterns
// @access  Private
router.post('/anomaly-detection', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get historical data for anomaly detection
    const activities = await CarbonActivity.find({ userId })
      .sort({ date: -1 })
      .limit(180); // Last 6 months
    
    if (activities.length < 30) {
      return res.status(400).json({
        msg: 'Insufficient data for anomaly detection'
      });
    }
    
    // Group by date and calculate daily totals
    const dailyEmissions = {};
    activities.forEach(activity => {
      const date = activity.date.toISOString().split('T')[0];
      dailyEmissions[date] = (dailyEmissions[date] || 0) + (activity.carbonFootprint || 0);
    });
    
    const emissionValues = Object.values(dailyEmissions);
    const dates = Object.keys(dailyEmissions);
    
    // Simple statistical anomaly detection
    const mean = emissionValues.reduce((a, b) => a + b, 0) / emissionValues.length;
    const variance = emissionValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / emissionValues.length;
    const stdDev = Math.sqrt(variance);
    
    const anomalies = [];
    const threshold = 2; // 2 standard deviations
    
    emissionValues.forEach((value, index) => {
      const zScore = Math.abs((value - mean) / stdDev);
      if (zScore > threshold) {
        anomalies.push({
          date: dates[index],
          value: value,
          z_score: zScore.toFixed(2),
          type: value > mean ? 'unusually_high' : 'unusually_low',
          deviation: (value - mean).toFixed(2)
        });
      }
    });
    
    res.json({
      success: true,
      anomalies: anomalies.slice(0, 10), // Return top 10 anomalies
      statistics: {
        mean: mean.toFixed(2),
        std_dev: stdDev.toFixed(2),
        total_days_analyzed: emissionValues.length,
        anomaly_count: anomalies.length
      },
      message: anomalies.length > 0 ? 
        `Found ${anomalies.length} anomalous emission patterns` : 
        'No significant anomalies detected'
    });
    
  } catch (error) {
    console.error('Anomaly detection error:', error);
    res.status(500).json({
      msg: 'Error in anomaly detection',
      error: error.message
    });
  }
});

// @route   POST /api/ml/train-model
// @desc    Trigger model retraining with user data (admin only)
// @access  Private
router.post('/train-model', auth, async (req, res) => {
  try {
    // Only allow admin users to retrain models
    // You might want to add admin check here
    
    const { model_type, epochs } = req.body;
    
    if (!['prediction', 'recommendation', 'all'].includes(model_type)) {
      return res.status(400).json({
        msg: 'Invalid model type. Use: prediction, recommendation, or all'
      });
    }
    
    // Call Python training script
    const mlScriptPath = path.join(__dirname, '../../ml/train_models.py');
    const trainingResult = await runPythonScript(mlScriptPath, [
      '--model-type', model_type,
      '--epochs', epochs || '50'
    ]);
    
    res.json({
      success: true,
      training_result: trainingResult,
      message: `Model retraining completed for: ${model_type}`
    });
    
  } catch (error) {
    console.error('Model training error:', error);
    res.status(500).json({
      msg: 'Error during model training',
      error: error.message
    });
  }
});

// @route   GET /api/ml/model-status
// @desc    Get status of ML models
// @access  Private
router.get('/model-status', auth, async (req, res) => {
  try {
    const modelsDir = path.join(__dirname, '../../ml/models');
    
    const modelStatus = {
      prediction_model: {
        exists: fs.existsSync(path.join(modelsDir, 'carbon_predictor_model.h5')),
        last_trained: 'Unknown', // Would need to track this
        status: 'Ready'
      },
      recommendation_engine: {
        exists: fs.existsSync(path.join(modelsDir, 'recommendation_engine.pkl')),
        last_trained: 'Unknown',
        status: 'Ready'
      },
      api_integration: {
        exists: fs.existsSync(path.join(modelsDir, 'ml_api.py')),
        status: 'Available'
      }
    };
    
    res.json({
      success: true,
      models: modelStatus,
      ml_ready: Object.values(modelStatus).every(model => model.exists !== false),
      message: 'ML model status retrieved successfully'
    });
    
  } catch (error) {
    console.error('Model status error:', error);
    res.status(500).json({
      msg: 'Error checking model status',
      error: error.message
    });
  }
});

export default router; 