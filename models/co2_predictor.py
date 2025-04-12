import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score
import joblib
import numpy as np # Import numpy for handling potential NaN/Inf values

# Define file path and columns to load
DATA_PATH = 'datasets/owid-co2-data.csv'
COLUMNS_TO_LOAD = ['country', 'year', 'co2', 'population', 'gdp']
TARGET_COUNTRY = 'United States'
MODEL_SAVE_PATH = 'models/us_co2_predictor_lr.joblib'
TEST_YEAR_SPLIT = 2015 # Year to split train/test data

def load_and_preprocess_data(file_path, columns, country):
    """Loads, filters, and preprocesses the CO2 data."""
    try:
        print(f"Loading data for {country} from {file_path}...")
        # Load only necessary columns to save memory
        df = pd.read_csv(file_path, usecols=columns)

        # Filter for the target country
        df_country = df[df['country'] == country].copy()

        if df_country.empty:
            print(f"Error: No data found for country '{country}'.")
            return None, None

        print(f"Initial data shape for {country}: {df_country.shape}")

        # Drop rows where the target variable 'co2' is missing, as we can't train/evaluate on them
        df_country.dropna(subset=['co2'], inplace=True)
        print(f"Shape after dropping rows with missing 'co2': {df_country.shape}")

        # Handle missing values in features (population, gdp) - using forward fill then backward fill
        # This assumes trends are somewhat continuous
        df_country['population'] = df_country['population'].ffill().bfill()
        df_country['gdp'] = df_country['gdp'].ffill().bfill()

        # Check if any NaNs remain in features after filling
        if df_country[['year', 'population', 'gdp']].isnull().any().any():
             print("Warning: NaNs still present in features after fill. Dropping affected rows.")
             df_country.dropna(subset=['year', 'population', 'gdp'], inplace=True)

        # Ensure no infinite values exist (can sometimes occur in datasets)
        df_country.replace([np.inf, -np.inf], np.nan, inplace=True)
        df_country.dropna(subset=['year', 'population', 'gdp', 'co2'], inplace=True)


        print(f"Shape after handling missing feature values: {df_country.shape}")

        if df_country.empty:
            print(f"Error: No valid data remaining for {country} after preprocessing.")
            return None, None

        # Define features (X) and target (y)
        X = df_country[['year', 'population', 'gdp']]
        y = df_country['co2']

        return X, y

    except FileNotFoundError:
        print(f"Error: Data file not found at {file_path}")
        return None, None
    except Exception as e:
        print(f"An error occurred during data loading/preprocessing: {e}")
        return None, None

def train_evaluate_save_model(X, y, test_split_year, save_path):
    """Trains, evaluates, and saves the linear regression model."""
    if X is None or y is None:
        print("Skipping model training due to data loading issues.")
        return

    print(f"Splitting data using year {test_split_year}...")
    # Split data based on the year
    X_train = X[X['year'] <= test_split_year]
    y_train = y[X['year'] <= test_split_year]
    X_test = X[X['year'] > test_split_year]
    y_test = y[X['year'] > test_split_year]

    # Drop the 'year' column from features before training
    X_train = X_train.drop(columns=['year'])
    X_test = X_test.drop(columns=['year'])


    if X_train.empty or X_test.empty:
        print("Error: Not enough data to perform train/test split.")
        return

    print(f"Training data shape: {X_train.shape}, Test data shape: {X_test.shape}")

    print("Training Linear Regression model...")
    model = LinearRegression()
    model.fit(X_train, y_train)

    print("Evaluating model...")
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)

    # Calculate metrics
    rmse_train = mean_squared_error(y_train, y_pred_train, squared=False)
    r2_train = r2_score(y_train, y_pred_train)
    rmse_test = mean_squared_error(y_test, y_pred_test, squared=False)
    r2_test = r2_score(y_test, y_pred_test)

    print("\n--- Model Evaluation ---")
    print(f"Training RMSE: {rmse_train:.4f}")
    print(f"Training R-squared: {r2_train:.4f}")
    print(f"Test RMSE: {rmse_test:.4f}")
    print(f"Test R-squared: {r2_test:.4f}")
    print("------------------------\n")

    print(f"Saving model to {save_path}...")
    try:
        joblib.dump(model, save_path)
        print("Model saved successfully.")
    except Exception as e:
        print(f"Error saving model: {e}")

if __name__ == "__main__":
    X_data, y_data = load_and_preprocess_data(DATA_PATH, COLUMNS_TO_LOAD, TARGET_COUNTRY)
    if X_data is not None and y_data is not None:
         # Extract the original index before splitting to align y_data correctly
         y_data_aligned = y_data.loc[X_data.index]
         train_evaluate_save_model(X_data, y_data_aligned, TEST_YEAR_SPLIT, MODEL_SAVE_PATH)
    else:
        print("Model training aborted due to data issues.")
