"""
CarbonCTRL ML Model Configuration
Advanced configuration for multiple AI models
"""

import os
from pathlib import Path
from typing import Dict, List, Any
from dataclasses import dataclass

# Base Paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
LOGS_DIR = BASE_DIR / "logs"

# Create directories
for dir_path in [DATA_DIR, MODELS_DIR, LOGS_DIR]:
    dir_path.mkdir(exist_ok=True)

@dataclass
class ModelConfig:
    """Base configuration for all models"""
    name: str
    model_type: str
    version: str = "1.0.0"
    random_state: int = 42
    
@dataclass
class CarbonPredictionConfig(ModelConfig):
    """Configuration for Carbon Footprint Prediction Model"""
    name: str = "carbon_predictor"
    model_type: str = "time_series"
    
    # Model Parameters
    sequence_length: int = 30  # Days of historical data
    prediction_horizon: int = 7  # Days to predict
    hidden_units: List[int] = None
    dropout_rate: float = 0.2
    learning_rate: float = 0.001
    batch_size: int = 32
    epochs: int = 100
    
    # Features
    features: List[str] = None
    target: str = "total_emissions"
    
    def __post_init__(self):
        if self.hidden_units is None:
            self.hidden_units = [128, 64, 32]
        if self.features is None:
            self.features = [
                'energy_consumption', 'transportation', 'waste_generation',
                'water_usage', 'employee_count', 'production_volume',
                'temperature', 'day_of_week', 'month', 'is_holiday'
            ]

@dataclass
class RecommendationEngineConfig(ModelConfig):
    """Configuration for Carbon Reduction Recommendation Engine"""
    name: str = "recommendation_engine"
    model_type: str = "nlp_recommendation"
    
    # Model Parameters
    embedding_dim: int = 256
    transformer_layers: int = 6
    attention_heads: int = 8
    max_sequence_length: int = 512
    
    # Recommendation Parameters
    top_k_recommendations: int = 10
    min_confidence_score: float = 0.7
    
    # Knowledge Base
    knowledge_sources: List[str] = None
    
    def __post_init__(self):
        if self.knowledge_sources is None:
            self.knowledge_sources = [
                'carbon_reduction_database',
                'sustainability_best_practices',
                'industry_benchmarks',
                'regulatory_guidelines'
            ]

@dataclass
class AnomalyDetectionConfig(ModelConfig):
    """Configuration for Anomaly Detection System"""
    name: str = "anomaly_detector"
    model_type: str = "unsupervised"
    
    # Model Parameters
    contamination: float = 0.1  # Expected percentage of outliers
    window_size: int = 7  # Days for sliding window
    
    # Algorithms to ensemble
    algorithms: List[str] = None
    
    # Thresholds
    alert_threshold: float = 0.8
    warning_threshold: float = 0.6
    
    def __post_init__(self):
        if self.algorithms is None:
            self.algorithms = [
                'isolation_forest',
                'local_outlier_factor',
                'one_class_svm',
                'autoencoder'
            ]

@dataclass
class ClassificationConfig(ModelConfig):
    """Configuration for Carbon Impact Classification"""
    name: str = "impact_classifier"
    model_type: str = "multi_class"
    
    # Model Parameters
    n_estimators: int = 100
    max_depth: int = 10
    
    # Classes
    impact_levels: List[str] = None
    
    def __post_init__(self):
        if self.impact_levels is None:
            self.impact_levels = [
                'very_low', 'low', 'medium', 'high', 'very_high'
            ]

class MLConfig:
    """Master configuration for all ML components"""
    
    # Model Configurations
    CARBON_PREDICTION = CarbonPredictionConfig()
    RECOMMENDATION_ENGINE = RecommendationEngineConfig()
    ANOMALY_DETECTION = AnomalyDetectionConfig()
    CLASSIFICATION = ClassificationConfig()
    
    # Training Configuration
    TRAINING = {
        'validation_split': 0.2,
        'test_split': 0.1,
        'cross_validation_folds': 5,
        'early_stopping_patience': 10,
        'model_checkpoint_monitor': 'val_loss',
        'reduce_lr_patience': 5,
        'min_lr': 1e-7
    }
    
    # Data Configuration
    DATA = {
        'min_training_samples': 1000,
        'feature_scaling': 'standard',
        'handle_missing': 'interpolate',
        'outlier_treatment': 'clip',
        'seasonal_decomposition': True
    }
    
    # Deployment Configuration
    DEPLOYMENT = {
        'model_serving_port': 8000,
        'batch_prediction_size': 1000,
        'model_update_frequency': 'weekly',
        'monitoring_metrics': [
            'accuracy', 'precision', 'recall', 'f1_score',
            'mae', 'rmse', 'mape', 'drift_score'
        ]
    }
    
    # MLOps Configuration
    MLOPS = {
        'experiment_tracking': 'mlflow',
        'model_registry': True,
        'automated_retraining': True,
        'a_b_testing': True,
        'feature_store': True,
        'model_monitoring': True
    }
    
    # Advanced Features
    ADVANCED = {
        'transfer_learning': True,
        'ensemble_methods': True,
        'hyperparameter_optimization': True,
        'explainable_ai': True,
        'federated_learning': False,  # For multi-company collaboration
        'quantum_computing': False   # Future enhancement
    }

# Environment-specific overrides
ENV = os.getenv('ML_ENV', 'development')

if ENV == 'production':
    MLConfig.TRAINING['validation_split'] = 0.15
    MLConfig.TRAINING['cross_validation_folds'] = 10
    MLConfig.DEPLOYMENT['batch_prediction_size'] = 5000
elif ENV == 'testing':
    MLConfig.TRAINING['epochs'] = 5
    MLConfig.DATA['min_training_samples'] = 100

# Export main config
config = MLConfig() 