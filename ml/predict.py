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
except (ImportError, ModuleNotFoundError) as e:
    err_msg = json.dumps({"error": f"ML dependencies or models not available: {str(e)}"})
    print(err_msg, file=sys.stderr)
    print(err_msg)
    sys.exit(1)

def make_predictions(historical_data):
    """Make carbon footprint predictions"""
    
    # Load the trained model
    model = CarbonPredictionModel()
    model_path = os.path.join(os.path.dirname(__file__), 'models', 'carbon_predictor')
    
    if not os.path.exists(f"{model_path}_model.h5"):
        raise FileNotFoundError(f"Prediction model not found at {model_path}_model.h5. Please train the model first.")
    
    model.load_model(model_path)
    
    # Validate data format
    if not isinstance(historical_data, dict) or 'data' not in historical_data or 'index' not in historical_data:
        raise ValueError("Invalid historical data format: missing 'data' or 'index' keys")
    
    if not historical_data['data'] or not historical_data['index']:
        raise ValueError("Historical data is empty")
    
    df = pd.DataFrame(historical_data['data'], index=pd.to_datetime(historical_data['index']))
    
    # Make predictions
    predictions = model.predict(df)
    
    # Format predictions sequence safely whether numpy array, list, or tensor
    preds_seq = predictions[0]
    if hasattr(preds_seq, 'tolist'):
        preds_list = preds_seq.tolist()
    elif isinstance(preds_seq, (list, tuple)):
        preds_list = list(preds_seq)
    else:
        preds_list = [preds_seq]

    # Generate future dates
    last_date = df.index[-1]
    prediction_dates = [(last_date + timedelta(days=i+1)).isoformat() 
                      for i in range(len(preds_list))]
    
    return {
        "success": True,
        "predictions": preds_list,
        "prediction_dates": prediction_dates
    }

def main():
    try:
        # Get input data from command line argument
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No input data provided"}), file=sys.stderr)
            sys.exit(1)
        
        input_data = json.loads(sys.argv[1])
        result = make_predictions(input_data)
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 