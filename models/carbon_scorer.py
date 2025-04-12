import pandas as pd
import joblib
import os

# Define file paths
BENCHMARK_DATA_PATH = 'datasets/SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv'
BENCHMARK_SAVE_PATH = 'models/naics_emission_benchmarks.joblib'

# Column names expected in the CSV (potentially with quotes)
# We will clean them after loading
EXPECTED_NAICS_CODE_COL = '2017 NAICS Code'
EXPECTED_NAICS_TITLE_COL = '2017 NAICS Title'
EXPECTED_EMISSION_FACTOR_COL = 'Supply Chain Emission Factors with Margins'
EXPECTED_UNIT_COL = 'Unit'

GHGRP_DATA_PATH = 'datasets/2023_data_summary_spreadsheets/ghgp_data_2023.xlsx'

def load_ghgrp_benchmarks(file_path):
    """Loads and processes GHGRP data to create facility-level emission benchmarks."""
    try:
        print(f"Loading GHGRP data from {file_path}...")
        xls = pd.ExcelFile(file_path)
        sheet_name = 'Direct Point Emitters'
        df = pd.read_excel(xls, sheet_name=sheet_name, header=[2,3]) # Use rows 2 and 3 as header

        # Flatten MultiIndex
        df.columns = [' '.join(col).strip() for col in df.columns]

        # Define column names
        facility_id_col = "All emissions data is presented in units of metric tons of carbon dioxide equivalent using GWP's from IPCC's AR4 (see FAQs tab) Facility Id"
        facility_name_col = "All emissions data is presented in units of metric tons of carbon dioxide equivalent using GWP's from IPCC's AR4 (see FAQs tab) Facility Name"
        naics_code_col = "All emissions data is presented in units of metric tons of carbon dioxide equivalent using GWP's from IPCC's AR4 (see FAQs tab) Primary NAICS Code"
        emissions_col = "All emissions data is presented in units of metric tons of carbon dioxide equivalent using GWP's from IPCC's AR4 (see FAQs tab) Total reported direct emissions"

        # Select relevant columns
        df_ghgrp = df[[facility_id_col, facility_name_col, naics_code_col, emissions_col]].copy()
        df_ghgrp.rename(columns={
            facility_id_col: 'facility_id',
            facility_name_col: 'facility_name',
            naics_code_col: 'naics_code',
            emissions_col: 'total_emissions_co2e_tons'
        }, inplace=True)

        # Data Cleaning
        df_ghgrp['naics_code'] = df_ghgrp['naics_code'].astype(str) # Ensure NAICS is a string
        df_ghgrp['total_emissions_co2e_tons'] = pd.to_numeric(df_ghgrp['total_emissions_co2e_tons'], errors='coerce') # Convert to numeric
        df_ghgrp.dropna(subset=['total_emissions_co2e_tons'], inplace=True) # Drop rows with missing emissions

        # Create dictionary: {facility_id: total_emissions_co2e_tons}
        ghgrp_benchmarks = pd.Series(df_ghgrp.total_emissions_co2e_tons.values, index=df_ghgrp.facility_id).to_dict()

        print(f"Loaded {len(ghgrp_benchmarks)} GHGRP facility benchmarks.")
        return ghgrp_benchmarks

    except FileNotFoundError:
        print(f"Error: GHGRP data file not found at {file_path}")
        return {}
    except Exception as e:
        print(f"An error occurred during GHGRP benchmark creation: {e}")
        import traceback
        traceback.print_exc() # Print detailed traceback for debugging
        return {}


def create_and_save_benchmarks(data_path, save_path):
    """Loads NAICS emission factor data, processes it, and saves benchmarks."""
    try:
        print(f"Loading NAICS benchmark data from {data_path}...")
        # Load data using header=0, let pandas handle initial quote parsing if possible
        # Specify NAICS code as string type during load
        df = pd.read_csv(data_path, header=0, dtype={EXPECTED_NAICS_CODE_COL: str})

        print(f"Benchmark data loaded. Shape: {df.shape}")
        print(f"Original columns: {df.columns.tolist()}")

        # Clean column names (remove leading/trailing spaces and extra quotes)
        df.columns = [col.strip().strip('"') for col in df.columns]
        print(f"Cleaned columns: {df.columns.tolist()}")

        # Define the cleaned column names we need
        naics_col = EXPECTED_NAICS_CODE_COL
        title_col = EXPECTED_NAICS_TITLE_COL
        factor_col = EXPECTED_EMISSION_FACTOR_COL
        unit_col = EXPECTED_UNIT_COL

        # Verify required columns exist after cleaning
        required_cols = [naics_col, title_col, factor_col, unit_col]
        if not all(col in df.columns for col in required_cols):
            missing = [col for col in required_cols if col not in df.columns]
            print(f"Error: Missing required columns after cleaning: {missing}")
            return False

        # Select relevant columns using cleaned names
        df_benchmarks = df[required_cols].copy()

        # Rename columns for clarity
        df_benchmarks.rename(columns={
            naics_col: 'naics_code',
            title_col: 'naics_title',
            factor_col: 'emission_factor_kg_co2e_per_usd',
            unit_col: 'unit'
        }, inplace=True)

        # --- Data Cleaning ---
        print(f"Data before numeric conversion (dtypes):\n{df_benchmarks.dtypes}")
        print(f"Head before numeric conversion:\n{df_benchmarks.head()}")

        # Ensure the emission factor is numeric, coercing errors to NaN
        factor_col_name = 'emission_factor_kg_co2e_per_usd'
        df_benchmarks[factor_col_name] = pd.to_numeric(
            df_benchmarks[factor_col_name], errors='coerce'
        )
        print(f"Number of nulls in '{factor_col_name}' after to_numeric: {df_benchmarks[factor_col_name].isnull().sum()}")

        # Filter out rows where the factor is missing or non-numeric
        initial_rows = len(df_benchmarks)
        df_benchmarks.dropna(subset=[factor_col_name], inplace=True)
        print(f"Shape after dropping NaN factors: {df_benchmarks.shape} (dropped {initial_rows - len(df_benchmarks)} rows)")

        # Check unique units present in the dataframe before filtering
        if not df_benchmarks.empty:
             unique_units = df_benchmarks['unit'].unique()
             print(f"Unique units found in dataframe (repr): {[repr(u) for u in unique_units]}") # Use repr()
        else:
             print("Dataframe is empty before unit filtering.")

        # Unit filtering was removed as it was causing issues and deemed redundant
        # since the source file only contains the expected unit.

        # Remove potential duplicates based on NAICS code, keeping the first entry
        df_benchmarks.drop_duplicates(subset=['naics_code'], keep='first', inplace=True)

        print(f"Processed benchmark data shape: {df_benchmarks.shape}")

        if df_benchmarks.empty:
            print("Error: No valid benchmark data found after processing.")
            return False

        # Create dictionary: {naics_code: emission_factor}
        benchmark_dict = pd.Series(
            df_benchmarks.emission_factor_kg_co2e_per_usd.values,
            index=df_benchmarks.naics_code
        ).to_dict()

        print(f"Created NAICS benchmark dictionary with {len(benchmark_dict)} entries.")

        # Load GHGRP benchmarks
        ghgrp_benchmarks = load_ghgrp_benchmarks(GHGRP_DATA_PATH)

        # Combine benchmarks (GHGRP takes precedence)
        combined_benchmarks = ghgrp_benchmarks.copy()
        combined_benchmarks.update(benchmark_dict) # NAICS benchmarks added/overwritten

        print(f"Combined benchmark dictionary has {len(combined_benchmarks)} entries (GHGRP + NAICS).")

        # --- Save Benchmarks ---
        print(f"Saving combined benchmarks to {save_path}...")
        # Ensure the directory exists
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        joblib.dump(combined_benchmarks, save_path)
        print("Benchmarks saved successfully.")
        return True

    except FileNotFoundError:
        print(f"Error: Benchmark data file not found at {data_path}")
        return False
    except Exception as e:
        print(f"An error occurred during benchmark creation: {e}")
        import traceback
        traceback.print_exc() # Print detailed traceback for debugging
        return False

def calculate_carbon_score(project_data, combined_benchmarks):
    """
    Calculates a CarbonCTRL score for a given project based on combined benchmarks,
    prioritizing GHGRP data if available.
    (Placeholder Implementation)

    Args:
        project_data (dict): Dictionary containing project details, including 'facility_id', 'naics_code', 'co2_emission_tons', 'project_value_usd'.
        combined_benchmarks (dict): Dictionary mapping facility IDs and NAICS codes to emission factors.

    Returns:
        float: A score (e.g., 0-100) or None if calculation fails.
    """
    print(f"\nCalculating score for project data: {project_data}")
    naics_code = project_data.get('naics_code')
    co2_tons = project_data.get('co2_emission_tons')
    value_usd = project_data.get('project_value_usd') # Assuming this field exists

    if not all([naics_code, co2_tons, value_usd]):
        print("Error: Missing required project data (naics_code, co2_emission_tons, project_value_usd).")
        return None

    if naics_code not in combined_benchmarks:
        print(f"Warning: No benchmark found for NAICS code {naics_code}.")
        # Decide how to handle missing benchmarks (e.g., return None, use an average?)
        return None # Returning None for now

    benchmark_factor = combined_benchmarks[naics_code] # kg CO2e / USD
    project_co2_kg = co2_tons * 1000 # Convert tons to kg

    if value_usd <= 0:
         print("Error: Project value must be positive to calculate intensity.")
         return None

    # Calculate project's emission intensity (kg CO2e / USD)
    project_intensity = project_co2_kg / value_usd
    print(f"Project Intensity: {project_intensity:.4f} kg CO2e / USD")
    print(f"Benchmark Intensity: {benchmark_factor:.4f} kg CO2e / USD")

    # --- Scoring Logic Placeholder ---
    # Simple ratio for now: 1.0 means project matches benchmark
    # Lower is better. Score could be inversely related to this ratio.
    # Example: score = 100 * (benchmark_factor / project_intensity) capped at 100? Needs refinement.
    if project_intensity <= 0: # Perfect score if no emissions
        score = 100.0
    else:
        ratio = project_intensity / benchmark_factor
        # Example scoring: 100 = better than benchmark, 50 = at benchmark, 0 = much worse
        # This specific scale might need significant tuning based on desired distribution
        score = max(0, min(100, 100 - 50 * (ratio -1))) # Simple linear scale around benchmark

    print(f"Calculated Score: {score:.2f}")
    return score

if __name__ == "__main__":
    success = create_and_save_benchmarks(BENCHMARK_DATA_PATH, BENCHMARK_SAVE_PATH)

    if success:
        print("\n--- Testing Score Calculation ---")
        # Load the saved benchmarks to test the scoring function
        loaded_benchmarks = joblib.load(BENCHMARK_SAVE_PATH)
        print(f"Loaded {len(loaded_benchmarks)} benchmarks for testing.")

        # Example project data (replace with actual user data structure later)
        test_project_1 = {'naics_code': '111110', 'co2_emission_tons': 50, 'project_value_usd': 100000} # Soybean farming
        test_project_2 = {'naics_code': '111110', 'co2_emission_tons': 20, 'project_value_usd': 100000} # Lower emissions
        test_project_3 = {'naics_code': '541511', 'co2_emission_tons': 5, 'project_value_usd': 200000} # Custom Computer Programming Services (find code if exists)
        test_project_4 = {'naics_code': '999999', 'co2_emission_tons': 10, 'project_value_usd': 50000} # Non-existent NAICS

        calculate_carbon_score(test_project_1, loaded_benchmarks)
        calculate_carbon_score(test_project_2, loaded_benchmarks)
        calculate_carbon_score(test_project_3, loaded_benchmarks)
        calculate_carbon_score(test_project_4, loaded_benchmarks)
    else:
        print("Benchmark creation failed. Skipping score calculation test.")

    # --- Test GHGRP Loading ---
    ghgrp_benchmarks = load_ghgrp_benchmarks(GHGRP_DATA_PATH)
    print(f"\n--- GHGRP Benchmarks: ---\n{ghgrp_benchmarks}")
