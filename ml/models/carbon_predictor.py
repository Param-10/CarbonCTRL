"""
Advanced Carbon Footprint Prediction Model
Uses deep learning for carbon emission forecasting
"""

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras import layers, Model
from sklearn.preprocessing import StandardScaler
import joblib
import warnings
warnings.filterwarnings('ignore')

class CarbonPredictionModel:
    """Advanced Carbon Footprint Prediction using LSTM + Attention"""
    
    def __init__(self):
        self.model = None
        self.scaler_X = StandardScaler()
        self.scaler_y = StandardScaler()
        self.sequence_length = 30
        self.prediction_horizon = 7
        self.is_trained = False
        
    def build_model(self, n_features):
        """Build LSTM model with attention mechanism"""
        
        inputs = layers.Input(shape=(self.sequence_length, n_features))
        
        # LSTM layers
        lstm1 = layers.LSTM(128, return_sequences=True, dropout=0.2)(inputs)
        lstm2 = layers.LSTM(64, return_sequences=True, dropout=0.2)(lstm1)
        
        # Attention mechanism
        attention = layers.Dense(1, activation='tanh')(lstm2)
        attention = layers.Flatten()(attention)
        attention = layers.Activation('softmax')(attention)
        attention = layers.RepeatVector(64)(attention)
        attention = layers.Permute([2, 1])(attention)
        
        # Apply attention weights
        attended = layers.Multiply()([lstm2, attention])
        attended = layers.Lambda(lambda x: tf.reduce_sum(x, axis=1), output_shape=(64,))(attended)
        
        # Dense layers
        dense1 = layers.Dense(32, activation='relu')(attended)
        dense1 = layers.Dropout(0.2)(dense1)
        
        # Output predictions
        outputs = layers.Dense(self.prediction_horizon, activation='linear')(dense1)
        
        model = Model(inputs=inputs, outputs=outputs)
        model.compile(optimizer='adam', loss='mse', metrics=['mae'])
        
        return model
    
    def prepare_sequences(self, data, target_col):
        """Create sequences for training"""
        
        # Extract features and target
        feature_cols = [col for col in data.columns if col != target_col]
        X_data = data[feature_cols].values
        y_data = data[target_col].values
        
        # Scale data
        X_scaled = self.scaler_X.fit_transform(X_data)
        y_scaled = self.scaler_y.fit_transform(y_data.reshape(-1, 1)).flatten()
        
        # Create sequences
        X_sequences, y_sequences = [], []
        
        for i in range(self.sequence_length, len(X_scaled) - self.prediction_horizon + 1):
            X_sequences.append(X_scaled[i-self.sequence_length:i])
            y_sequences.append(y_scaled[i:i+self.prediction_horizon])
        
        return np.array(X_sequences), np.array(y_sequences)
    
    def train(self, data, target_col='total_emissions', epochs=100):
        """Train the model"""
        
        print("Preparing data...")
        X, y = self.prepare_sequences(data, target_col)
        
        print(f"Training data shape: X={X.shape}, y={y.shape}")
        
        # Build model
        self.model = self.build_model(X.shape[2])
        
        # Train
        history = self.model.fit(
            X, y,
            epochs=epochs,
            batch_size=32,
            validation_split=0.2,
            verbose=1
        )
        
        self.is_trained = True
        return history
    
    def predict(self, data, target_col='total_emissions'):
        """Make predictions"""
        
        if not self.is_trained:
            raise ValueError("Model must be trained first")
        
        X, _ = self.prepare_sequences(data, target_col)
        
        # Predict
        predictions_scaled = self.model.predict(X)
        
        # Inverse transform
        predictions = self.scaler_y.inverse_transform(predictions_scaled)
        
        return predictions
    
    def save_model(self, filepath):
        """Save model and scalers"""
        self.model.save(f"{filepath}_model.h5")
        joblib.dump(self.scaler_X, f"{filepath}_scaler_X.pkl")
        joblib.dump(self.scaler_y, f"{filepath}_scaler_y.pkl")
    
    def load_model(self, filepath):
        """Load model and scalers"""
        self.model = tf.keras.models.load_model(f"{filepath}_model.h5")
        self.scaler_X = joblib.load(f"{filepath}_scaler_X.pkl")
        self.scaler_y = joblib.load(f"{filepath}_scaler_y.pkl")
        self.is_trained = True

# Example usage
if __name__ == "__main__":
    print("Testing Carbon Prediction Model...")
    
    # Generate sample data
    dates = pd.date_range('2020-01-01', '2023-12-31', freq='D')
    np.random.seed(42)
    
    data = pd.DataFrame({
        'energy_consumption': np.random.normal(1000, 200, len(dates)),
        'transportation': np.random.normal(500, 100, len(dates)),
        'waste_generation': np.random.normal(300, 50, len(dates)),
        'total_emissions': np.random.normal(2000, 300, len(dates))
    })
    
    # Train model
    model = CarbonPredictionModel()
    history = model.train(data, epochs=10)  # Quick test
    
    # Make predictions
    predictions = model.predict(data)
    print(f"Predictions shape: {predictions.shape}")
    
    print("Model test completed!") 