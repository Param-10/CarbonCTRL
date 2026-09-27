"""
CarbonCTRL ML Models Package
"""

from .carbon_predictor import CarbonPredictionModel
from .recommendation_engine import CarbonRecommendationEngine
from .anomaly_detector import CarbonAnomalyDetector
# Class is named AdvancedEnsemblePredictor in ensemble_predictor.py; keep the
# exported name stable for any external references.
from .ensemble_predictor import AdvancedEnsemblePredictor as CarbonEnsemblePredictor

__all__ = [
    'CarbonPredictionModel',
    'CarbonRecommendationEngine', 
    'CarbonAnomalyDetector',
    'CarbonEnsemblePredictor'
] 