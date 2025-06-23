#!/usr/bin/env python3
"""
Carbon Prediction API Script
Called by Express.js server to make predictions
"""

import sys
import json
import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

try:
    from models.carbon_predictor import CarbonPredictionModel
except ImportError:
    print(json.dumps({"error": "ML models not found. Please run training first."}))
    sys.exit(1)

def make_predictions(historical_data):
    """Make carbon footprint predictions"""
    
    try:
        # Load the trained model
        model = CarbonPredictionModel()
        model_path = os.path.join(os.path.dirname(__file__), 'models', 'carbon_predictor')
        
        if not os.path.exists(f"{model_path}_model.h5"):
            return {"error": "Prediction model not found. Please train the model first."}
        
        model.load_model(model_path)
        
        # Prepare data
        df = pd.DataFrame(historical_data['data'], index=pd.to_datetime(historical_data['index']))
        
        # Make predictions
        predictions = model.predict(df)
        
        # Generate future dates
        last_date = df.index[-1]
        prediction_dates = [(last_date + timedelta(days=i+1)).isoformat() 
                          for i in range(len(predictions[0]))]
        
        return {
            "success": True,
            "predictions": predictions[0].tolist(),  # First prediction sequence
            "prediction_dates": prediction_dates,
            "confidence": 0.85  # Default confidence
        }
        
    except Exception as e:
        return {"error": f"Prediction failed: {str(e)}"}

def main():
    try:
        # Get input data from command line argument
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No input data provided"}))
            return
        
        input_data = json.loads(sys.argv[1])
        result = make_predictions(input_data)
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": f"Script error: {str(e)}"}))

if __name__ == "__main__":
    main() 