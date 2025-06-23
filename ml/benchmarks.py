#!/usr/bin/env python3
"""
Industry Benchmarks API Script
Called by Express.js server to get industry benchmarks
"""

import sys
import json
import os

try:
    from models.recommendation_engine import CarbonRecommendationEngine
except ImportError:
    print(json.dumps({"error": "Recommendation engine not found. Please run setup first."}))
    sys.exit(1)

def get_benchmarks(industry):
    """Get industry benchmarks"""
    
    try:
        # Initialize recommendation engine
        engine = CarbonRecommendationEngine()
        
        # Get benchmarks
        benchmarks = engine.get_industry_benchmarks(industry)
        
        return {
            "success": True,
            "benchmarks": benchmarks
        }
        
    except Exception as e:
        return {"error": f"Benchmark retrieval failed: {str(e)}"}

def main():
    try:
        # Get industry from command line argument
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No industry provided"}))
            return
        
        industry = sys.argv[1]
        result = get_benchmarks(industry)
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": f"Script error: {str(e)}"}))

if __name__ == "__main__":
    main() 