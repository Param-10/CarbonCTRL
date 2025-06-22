"""
CarbonCTRL ML API Integration
Use this to integrate ML models with your Express.js backend
"""

import sys
import os
import numpy as np
import pandas as pd
import joblib
from datetime import datetime

# Add ML path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'ml', 'models'))

from carbon_predictor import CarbonPredictionModel
from recommendation_engine import CarbonRecommendationEngine

class CarbonMLAPI:
    """ML API for CarbonCTRL application"""
    
    def __init__(self, models_dir="../ml/models"):
        self.models_dir = models_dir
        self.prediction_model = None
        self.recommendation_engine = None
        self._load_models()
    
    def _load_models(self):
        """Load trained models"""
        try:
            # Load prediction model
            self.prediction_model = CarbonPredictionModel()
            prediction_path = os.path.join(self.models_dir, "carbon_predictor")
            self.prediction_model.load_model(prediction_path)
            
            # Load recommendation engine
            self.recommendation_engine = CarbonRecommendationEngine()
            engine_path = os.path.join(self.models_dir, "recommendation_engine")
            self.recommendation_engine.load_model(engine_path)
            
            print("✅ ML models loaded successfully")
            
        except Exception as e:
            print(f"❌ Error loading models: {e}")
    
    def predict_emissions(self, historical_data):
        """Predict future carbon emissions"""
        if not self.prediction_model:
            return {"error": "Prediction model not loaded"}
        
        try:
            # Convert to DataFrame
            df = pd.DataFrame(historical_data)
            df.index = pd.to_datetime(df.index)
            
            # Make predictions
            predictions = self.prediction_model.predict(df)
            
            return {
                "success": True,
                "predictions": predictions.tolist(),
                "prediction_dates": [
                    (datetime.now() + pd.Timedelta(days=i)).isoformat() 
                    for i in range(1, len(predictions[0]) + 1)
                ]
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    def get_recommendations(self, company_data):
        """Get carbon reduction recommendations"""
        if not self.recommendation_engine:
            return {"error": "Recommendation engine not loaded"}
        
        try:
            recommendations = self.recommendation_engine.get_recommendations(
                company_data, top_k=5
            )
            
            return {
                "success": True,
                "recommendations": recommendations
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    def get_benchmarks(self, industry):
        """Get industry benchmarks"""
        if not self.recommendation_engine:
            return {"error": "Recommendation engine not loaded"}
        
        try:
            benchmarks = self.recommendation_engine.get_industry_benchmarks(industry)
            
            return {
                "success": True,
                "benchmarks": benchmarks
            }
            
        except Exception as e:
            return {"error": str(e)}

# Create global instance
ml_api = CarbonMLAPI()

# Export functions for Node.js integration
def predict_emissions_api(data):
    return ml_api.predict_emissions(data)

def get_recommendations_api(data):
    return ml_api.get_recommendations(data)

def get_benchmarks_api(industry):
    return ml_api.get_benchmarks(industry)
