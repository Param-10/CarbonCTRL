import os
import sys
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

models_path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'models'))
if models_path not in sys.path:
    sys.path.insert(0, models_path)

from models.carbon_predictor import CarbonPredictionModel


def generate_synthetic_data(n_samples=500):
    end_date = datetime.now()
    start_date = end_date - timedelta(days=n_samples)
    dates = pd.date_range(start_date, end_date, freq='D')

    np.random.seed(42)

    seasonal_pattern = np.sin(np.arange(len(dates)) * 2 * np.pi / 365)
    weekly_pattern = np.sin(np.arange(len(dates)) * 2 * np.pi / 7)

    data = {
        'energy_consumption': (
            1000 +
            200 * seasonal_pattern +
            100 * weekly_pattern +
            np.random.normal(0, 50, len(dates)) +
            np.arange(len(dates)) * 0.1
        ),
        'transportation': (
            500 +
            50 * weekly_pattern +
            np.random.normal(0, 30, len(dates)) +
            100 * (np.arange(len(dates)) % 30 < 20)
        ),
        'waste_generation': (
            300 +
            30 * weekly_pattern +
            np.random.normal(0, 20, len(dates))
        ),
        'water_usage': (
            800 +
            100 * seasonal_pattern +
            np.random.normal(0, 40, len(dates))
        ),
        'employee_count': (
            100 +
            np.random.normal(0, 5, len(dates)) +
            np.maximum(0, np.cumsum(np.random.normal(0, 0.1, len(dates))))
        ),
        'production_volume': (
            2000 +
            300 * seasonal_pattern +
            200 * weekly_pattern +
            np.random.normal(0, 100, len(dates))
        ),
        'temperature': (
            20 + 15 * seasonal_pattern +
            np.random.normal(0, 3, len(dates))
        )
    }

    data['total_emissions'] = (
        data['energy_consumption'] * 0.5 +
        data['transportation'] * 0.8 +
        data['waste_generation'] * 0.3 +
        data['water_usage'] * 0.1 +
        data['production_volume'] * 0.2 +
        np.random.normal(0, 50, len(dates))
    )

    for key in data:
        data[key] = np.maximum(data[key], 0)

    return pd.DataFrame(data, index=dates)


def _safe_mape(y_true, y_pred):
    denom = np.maximum(np.abs(y_true), 1e-8)
    return np.mean(np.abs((y_true - y_pred) / denom)) * 100


def evaluate(n_samples=500, epochs=30):
    data = generate_synthetic_data(n_samples=n_samples)

    model = CarbonPredictionModel()

    train_size = int(len(data) * 0.8)
    train_data = data.iloc[:train_size]
    test_data = data.iloc[train_size - model.sequence_length:]

    model.train(train_data, target_col='total_emissions', epochs=epochs)

    feature_cols = [col for col in test_data.columns if col != 'total_emissions']
    X_raw = test_data[feature_cols].values
    y_raw = test_data['total_emissions'].values

    X_scaled = model.scaler_X.transform(X_raw)
    y_scaled = model.scaler_y.transform(y_raw.reshape(-1, 1)).flatten()

    X_sequences = []
    y_sequences = []
    for i in range(model.sequence_length, len(X_scaled) - model.prediction_horizon + 1):
        X_sequences.append(X_scaled[i - model.sequence_length:i])
        y_sequences.append(y_scaled[i:i + model.prediction_horizon])

    X_test = np.array(X_sequences)
    y_test = np.array(y_sequences)

    pred_scaled = model.model.predict(X_test, verbose=0)

    pred = model.scaler_y.inverse_transform(pred_scaled)
    true = model.scaler_y.inverse_transform(y_test)

    overall_mae = mean_absolute_error(true.flatten(), pred.flatten())
    overall_rmse = np.sqrt(mean_squared_error(true.flatten(), pred.flatten()))
    overall_mape = _safe_mape(true.flatten(), pred.flatten())
    overall_r2 = r2_score(true.flatten(), pred.flatten())

    per_horizon = []
    for step in range(model.prediction_horizon):
        step_true = true[:, step]
        step_pred = pred[:, step]
        per_horizon.append({
            "horizon": step + 1,
            "mae": mean_absolute_error(step_true, step_pred),
            "rmse": np.sqrt(mean_squared_error(step_true, step_pred)),
            "mape": _safe_mape(step_true, step_pred),
            "r2": r2_score(step_true, step_pred)
        })

    return {
        "overall": {
            "mae": overall_mae,
            "rmse": overall_rmse,
            "mape": overall_mape,
            "r2": overall_r2
        },
        "per_horizon": per_horizon
    }


if __name__ == "__main__":
    results = evaluate()
    overall = results["overall"]
    print("Overall metrics")
    print(f"MAE (kg CO2): {overall['mae']:.2f}")
    print(f"RMSE (kg CO2): {overall['rmse']:.2f}")
    print(f"MAPE (%): {overall['mape']:.2f}")
    print(f"R2: {overall['r2']:.4f}")

    print("\nPer-horizon metrics")
    for row in results["per_horizon"]:
        print(
            f"Day {row['horizon']}: "
            f"MAE={row['mae']:.2f}, RMSE={row['rmse']:.2f}, "
            f"MAPE={row['mape']:.2f}%, R2={row['r2']:.4f}"
        )
