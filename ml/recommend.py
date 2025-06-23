#!/usr/bin/env python3
"""
Carbon Recommendation API Script
Called by Express.js server to generate recommendations
"""

import sys
import json
import os

try:
    from models.recommendation_engine import CarbonRecommendationEngine
except ImportError:
    print(json.dumps({"error": "Recommendation engine not found. Please run setup first."}))
    sys.exit(1)

def get_recommendations(company_data):
    """Get carbon reduction recommendations"""
    
    try:
        # Initialize recommendation engine
        engine = CarbonRecommendationEngine()
        
        # Generate recommendations
        recommendations = engine.get_recommendations(company_data, top_k=5)
        
        return {
            "success": True,
            "recommendations": recommendations
        }
        
    except Exception as e:
        return {"error": f"Recommendation generation failed: {str(e)}"}

def main():
    try:
        # Get input data from command line argument
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No company data provided"}))
            return
        
        company_data = json.loads(sys.argv[1])
        result = get_recommendations(company_data)
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": f"Script error: {str(e)}"}))

if __name__ == "__main__":
    main() 