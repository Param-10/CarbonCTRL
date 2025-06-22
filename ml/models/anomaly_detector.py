"""
Advanced Anomaly Detection System for Carbon Emissions
Uses ensemble methods and multiple algorithms for sophisticated anomaly detection
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.svm import OneClassSVM
from sklearn.preprocessing import StandardScaler
import tensorflow as tf
from tensorflow.keras import layers, Model
import joblib
import warnings
warnings.filterwarnings('ignore')

class CarbonAnomalyDetector:
    """
    Advanced Multi-Algorithm Anomaly Detection System
    
    Features:
    - Ensemble of 4 different anomaly detection algorithms
    - Autoencoder neural network for complex pattern detection
    - Time-series specific anomaly detection
    - Severity scoring and classification
    - Real-time monitoring capabilities
    """
    
    def __init__(self, contamination=0.1):
        self.contamination = contamination
        self.models = {}
        self.scaler = StandardScaler()
        self.autoencoder = None
        self.is_trained = False
        
        # Initialize traditional ML models
        self._init_traditional_models()
    
    def _init_traditional_models(self):
        """Initialize traditional anomaly detection models"""
        
        self.models = {
            'isolation_forest': IsolationForest(
                contamination=self.contamination,
                random_state=42,
                n_estimators=200
            ),
            'local_outlier_factor': LocalOutlierFactor(
                contamination=self.contamination,
                n_neighbors=20,
                novelty=True
            ),
            'one_class_svm': OneClassSVM(
                nu=self.contamination,
                kernel='rbf',
                gamma='scale'
            )
        }
    
    def build_autoencoder(self, input_dim):
        """Build autoencoder neural network for anomaly detection"""
        
        # Encoder
        input_layer = layers.Input(shape=(input_dim,))
        encoded = layers.Dense(128, activation='relu')(input_layer)
        encoded = layers.Dropout(0.2)(encoded)
        encoded = layers.Dense(64, activation='relu')(encoded)
        encoded = layers.Dropout(0.2)(encoded)
        encoded = layers.Dense(32, activation='relu')(encoded)  # Bottleneck
        
        # Decoder
        decoded = layers.Dense(64, activation='relu')(encoded)
        decoded = layers.Dropout(0.2)(decoded)
        decoded = layers.Dense(128, activation='relu')(decoded)
        decoded = layers.Dropout(0.2)(decoded)
        decoded = layers.Dense(input_dim, activation='linear')(decoded)
        
        # Build autoencoder
        autoencoder = Model(input_layer, decoded)
        autoencoder.compile(optimizer='adam', loss='mse', metrics=['mae'])
        
        return autoencoder
    
    def prepare_features(self, data):
        """Extract and engineer features for anomaly detection"""
        
        # Basic features
        features = []
        
        for col in data.columns:
            if data[col].dtype in ['int64', 'float64']:
                # Basic statistics
                features.extend([
                    data[col].iloc[-1],  # Current value
                    data[col].rolling(7).mean().iloc[-1],   # 7-day average
                    data[col].rolling(30).mean().iloc[-1],  # 30-day average
                    data[col].rolling(7).std().iloc[-1],    # 7-day volatility
                    data[col].pct_change().iloc[-1] if len(data) > 1 else 0,  # % change
                ])
        
        # Time-based features
        if hasattr(data.index, 'dayofweek'):
            features.extend([
                data.index[-1].hour if hasattr(data.index[-1], 'hour') else 0,
                data.index[-1].dayofweek,
                data.index[-1].month,
                int(data.index[-1].weekday() >= 5)  # Is weekend
            ])
        
        # Cross-feature relationships
        if 'total_emissions' in data.columns and 'energy_consumption' in data.columns:
            features.extend([
                data['total_emissions'].iloc[-1] / (data['energy_consumption'].iloc[-1] + 1),
                data['total_emissions'].rolling(7).mean().iloc[-1] / 
                (data['energy_consumption'].rolling(7).mean().iloc[-1] + 1)
            ])
        
        return np.array(features).reshape(1, -1)
    
    def train(self, historical_data):
        """Train all anomaly detection models"""
        
        print("🔧 Training Advanced Anomaly Detection System...")
        
        # Prepare training features
        training_features = []
        
        # Create sliding windows for training
        window_size = 7
        for i in range(window_size, len(historical_data)):
            window_data = historical_data.iloc[i-window_size:i+1]
            features = self.prepare_features(window_data)
            training_features.append(features.flatten())
        
        training_features = np.array(training_features)
        
        if len(training_features) < 50:
            raise ValueError("Need at least 50 data points for training")
        
        # Scale features
        training_features_scaled = self.scaler.fit_transform(training_features)
        
        # Train traditional models
        print("Training Isolation Forest...")
        self.models['isolation_forest'].fit(training_features_scaled)
        
        print("Training Local Outlier Factor...")
        self.models['local_outlier_factor'].fit(training_features_scaled)
        
        print("Training One-Class SVM...")
        self.models['one_class_svm'].fit(training_features_scaled)
        
        # Train autoencoder
        print("Training Autoencoder Neural Network...")
        self.autoencoder = self.build_autoencoder(training_features_scaled.shape[1])
        
        history = self.autoencoder.fit(
            training_features_scaled, training_features_scaled,
            epochs=100,
            batch_size=32,
            validation_split=0.2,
            verbose=0,
            shuffle=True
        )
        
        # Calculate reconstruction threshold
        reconstructions = self.autoencoder.predict(training_features_scaled, verbose=0)
        reconstruction_errors = np.mean(np.square(training_features_scaled - reconstructions), axis=1)
        self.reconstruction_threshold = np.percentile(reconstruction_errors, 95)
        
        self.is_trained = True
        print("✅ Anomaly Detection System trained successfully!")
        
        return history
    
    def detect_anomalies(self, recent_data):
        """Detect anomalies using ensemble of algorithms"""
        
        if not self.is_trained:
            raise ValueError("Model must be trained before detecting anomalies")
        
        # Prepare features
        features = self.prepare_features(recent_data)
        features_scaled = self.scaler.transform(features)
        
        # Get predictions from all models
        anomaly_scores = {}
        
        # Traditional models
        anomaly_scores['isolation_forest'] = self.models['isolation_forest'].decision_function(features_scaled)[0]
        anomaly_scores['local_outlier_factor'] = self.models['local_outlier_factor'].decision_function(features_scaled)[0]
        anomaly_scores['one_class_svm'] = self.models['one_class_svm'].decision_function(features_scaled)[0]
        
        # Autoencoder
        reconstruction = self.autoencoder.predict(features_scaled, verbose=0)
        reconstruction_error = np.mean(np.square(features_scaled - reconstruction))
        anomaly_scores['autoencoder'] = -reconstruction_error  # Negative for consistency
        
        # Ensemble scoring
        ensemble_score = np.mean(list(anomaly_scores.values()))
        
        # Anomaly classification
        is_anomaly = ensemble_score < 0
        
        # Severity classification
        if ensemble_score < -0.5:
            severity = "Critical"
        elif ensemble_score < -0.2:
            severity = "High"
        elif ensemble_score < 0:
            severity = "Medium"
        else:
            severity = "Normal"
        
        return {
            'is_anomaly': is_anomaly,
            'ensemble_score': float(ensemble_score),
            'severity': severity,
            'individual_scores': {k: float(v) for k, v in anomaly_scores.items()},
            'reconstruction_error': float(reconstruction_error),
            'threshold_exceeded': reconstruction_error > self.reconstruction_threshold,
            'confidence': abs(ensemble_score)
        }
    
    def analyze_anomaly_patterns(self, historical_data, window_days=30):
        """Analyze patterns in historical anomalies"""
        
        anomalies = []
        
        # Sliding window analysis
        for i in range(7, len(historical_data) - window_days):
            window_data = historical_data.iloc[i:i+window_days]
            
            try:
                result = self.detect_anomalies(window_data)
                if result['is_anomaly']:
                    anomalies.append({
                        'date': historical_data.index[i+window_days-1],
                        'severity': result['severity'],
                        'score': result['ensemble_score'],
                        'type': self._classify_anomaly_type(window_data)
                    })
            except:
                continue
        
        # Pattern analysis
        if anomalies:
            severity_counts = {}
            type_counts = {}
            
            for anomaly in anomalies:
                severity_counts[anomaly['severity']] = severity_counts.get(anomaly['severity'], 0) + 1
                type_counts[anomaly['type']] = type_counts.get(anomaly['type'], 0) + 1
            
            return {
                'total_anomalies': len(anomalies),
                'severity_distribution': severity_counts,
                'type_distribution': type_counts,
                'anomalies': anomalies[-10:],  # Last 10 anomalies
                'anomaly_rate': len(anomalies) / (len(historical_data) - window_days - 7)
            }
        
        return {
            'total_anomalies': 0,
            'severity_distribution': {},
            'type_distribution': {},
            'anomalies': [],
            'anomaly_rate': 0
        }
    
    def _classify_anomaly_type(self, data):
        """Classify the type of anomaly based on data patterns"""
        
        if 'total_emissions' not in data.columns:
            return 'unknown'
        
        recent_mean = data['total_emissions'].tail(7).mean()
        historical_mean = data['total_emissions'].mean()
        
        if recent_mean > historical_mean * 1.5:
            return 'emission_spike'
        elif recent_mean < historical_mean * 0.5:
            return 'emission_drop'
        elif data['total_emissions'].std() > historical_mean * 0.3:
            return 'high_volatility'
        else:
            return 'pattern_anomaly'
    
    def save_model(self, filepath):
        """Save the trained anomaly detection system"""
        
        # Save traditional models and scaler
        joblib.dump({
            'models': self.models,
            'scaler': self.scaler,
            'reconstruction_threshold': getattr(self, 'reconstruction_threshold', None),
            'contamination': self.contamination
        }, f"{filepath}_anomaly_detector.pkl")
        
        # Save autoencoder
        if self.autoencoder:
            self.autoencoder.save(f"{filepath}_autoencoder.h5")
    
    def load_model(self, filepath):
        """Load a trained anomaly detection system"""
        
        # Load traditional models
        data = joblib.load(f"{filepath}_anomaly_detector.pkl")
        self.models = data['models']
        self.scaler = data['scaler']
        self.reconstruction_threshold = data['reconstruction_threshold']
        self.contamination = data['contamination']
        
        # Load autoencoder
        try:
            self.autoencoder = tf.keras.models.load_model(f"{filepath}_autoencoder.h5")
        except:
            print("Warning: Could not load autoencoder model")
        
        self.is_trained = True

# Example usage and testing
if __name__ == "__main__":
    print("🔍 Testing Advanced Anomaly Detection System...")
    
    # Generate test data with anomalies
    np.random.seed(42)
    dates = pd.date_range('2023-01-01', '2024-01-01', freq='D')
    
    # Normal pattern
    normal_emissions = 2000 + 200 * np.sin(np.arange(len(dates)) * 2 * np.pi / 365)
    
    # Add anomalies
    emissions = normal_emissions.copy()
    emissions[100:105] *= 2.5  # Spike anomaly
    emissions[200:203] *= 0.3  # Drop anomaly
    emissions[300:310] += np.random.normal(0, 500, 10)  # Volatility anomaly
    
    data = pd.DataFrame({
        'total_emissions': emissions,
        'energy_consumption': emissions * 0.4 + np.random.normal(0, 50, len(dates)),
        'transportation': emissions * 0.2 + np.random.normal(0, 30, len(dates)),
        'waste_generation': emissions * 0.1 + np.random.normal(0, 20, len(dates))
    }, index=dates)
    
    # Train detector
    detector = CarbonAnomalyDetector(contamination=0.05)
    
    # Use first 300 days for training
    training_data = data.iloc[:300]
    detector.train(training_data)
    
    # Test on recent data
    test_data = data.iloc[295:305]  # Includes the spike anomaly
    result = detector.detect_anomalies(test_data)
    
    print("🎯 Anomaly Detection Results:")
    print(f"   Is Anomaly: {result['is_anomaly']}")
    print(f"   Severity: {result['severity']}")
    print(f"   Ensemble Score: {result['ensemble_score']:.4f}")
    print(f"   Confidence: {result['confidence']:.4f}")
    
    # Analyze patterns
    patterns = detector.analyze_anomaly_patterns(data)
    print(f"📊 Pattern Analysis:")
    print(f"   Total Anomalies Found: {patterns['total_anomalies']}")
    print(f"   Anomaly Rate: {patterns['anomaly_rate']:.2%}")
    
    # Save model
    detector.save_model("models/anomaly_detector")
    print("💾 Anomaly Detector saved successfully!")
    
    print("✅ Advanced Anomaly Detection test completed!") 