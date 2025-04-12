#!/usr/bin/env python3
"""
CarbonCTRL Data Pipeline Coordinator
This module integrates all available datasets with the CarbonCTRL models.
"""
import os
import pandas as pd
import numpy as np
import joblib
import sys
from pathlib import Path

# Add project root to path to ensure imports work
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

# Import models
from models.carbon_scorer import calculate_carbon_score, create_and_save_benchmarks
from models.co2_predictor import load_and_preprocess_data, train_evaluate_save_model

# Constants and file paths
DATA_DIR = os.path.join(project_root, 'datasets')
MODELS_DIR = os.path.join(project_root, 'models')

# NAICS emission benchmarks data
NAICS_DATA_PATH = os.path.join(DATA_DIR, 'SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv')
NAICS_BY_GHG_DATA_PATH = os.path.join(DATA_DIR, 'SupplyChainGHGEmissionFactors_v1.3.0_NAICS_byGHG_USD2022.csv')
NAICS_BENCHMARK_SAVE_PATH = os.path.join(MODELS_DIR, 'naics_emission_benchmarks.joblib')

# GHGRP yearly data files
GHGRP_DATA_DIR = os.path.join(DATA_DIR, '2023_data_summary_spreadsheets')
GHGRP_FILES = [os.path.join(GHGRP_DATA_DIR, f) for f in os.listdir(GHGRP_DATA_DIR) 
               if f.startswith('ghgp_data_') and f.endswith('.xlsx')]

# OWID CO2 data
OWID_DATA_PATH = os.path.join(DATA_DIR, 'owid-co2-data.csv')
US_CO2_MODEL_PATH = os.path.join(MODELS_DIR, 'us_co2_predictor_lr.joblib')

# USA sector-specific emissions data
USA_DATA_DIR = os.path.join(DATA_DIR, 'USA')
USA_CO2E_SECTORS = ['agriculture', 'buildings', 'fluorinated_gases', 'forestry_and_land_use',
                     'fossil_fuel_operations', 'manufacturing', 'mineral_extraction', 'power',
                     'transportation', 'waste']


def load_benchmark_data():
    """Load and process NAICS benchmark data"""
    print("\n=== Loading NAICS Benchmark Data ===")
    create_and_save_benchmarks(NAICS_DATA_PATH, NAICS_BENCHMARK_SAVE_PATH)
    
    print("\n=== Loading NAICS By GHG Type Data ===")
    # Load the detailed NAICS by GHG type data (CO2, CH4, N2O, etc.)
    try:
        naics_ghg_types = pd.read_csv(NAICS_BY_GHG_DATA_PATH)
        print(f"Loaded NAICS by GHG types data: {naics_ghg_types.shape}")
        return naics_ghg_types
    except Exception as e:
        print(f"Error loading NAICS by GHG data: {e}")
        return None


def load_ghgrp_time_series():
    """Load GHGRP data for multiple years to create a time series dataset"""
    print("\n=== Loading GHGRP Time Series Data ===")
    ghgrp_yearly_data = {}
    
    for file_path in sorted(GHGRP_FILES):
        try:
            # Extract year from filename
            file_name = os.path.basename(file_path)
            if 'by_year' in file_name:
                continue  # Skip summary file
                
            year_match = file_name.replace('ghgp_data_', '').replace('.xlsx', '')
            if year_match.isdigit():
                year = int(year_match)
                print(f"Loading GHGRP data for year {year}...")
                
                # Load the Excel file
                xls = pd.ExcelFile(file_path)
                sheet_name = 'Direct Point Emitters'
                
                # Handle the complex header structure in GHGRP files
                df = pd.read_excel(xls, sheet_name=sheet_name, header=[2,3])
                df.columns = [' '.join(col).strip() for col in df.columns]
                
                # Find the emission column - column names may vary slightly by year
                emissions_col = [col for col in df.columns if 'Total reported direct emissions' in col][0]
                facility_id_col = [col for col in df.columns if 'Facility Id' in col][0]
                naics_col = [col for col in df.columns if 'Primary NAICS Code' in col][0]
                
                # Select and rename relevant columns
                df_year = df[[facility_id_col, naics_col, emissions_col]].copy()
                df_year.rename(columns={
                    facility_id_col: 'facility_id',
                    naics_col: 'naics_code',
                    emissions_col: 'emissions_co2e_tons'
                }, inplace=True)
                
                # Clean data
                df_year['emissions_co2e_tons'] = pd.to_numeric(df_year['emissions_co2e_tons'], errors='coerce')
                df_year.dropna(subset=['emissions_co2e_tons'], inplace=True)
                df_year['year'] = year
                
                # Store in dictionary
                ghgrp_yearly_data[year] = df_year
                print(f"  Loaded {len(df_year)} facilities for year {year}")
                
        except Exception as e:
            print(f"Error loading GHGRP data for {file_path}: {e}")
    
    # Combine all years into a single dataframe
    if ghgrp_yearly_data:
        ghgrp_combined = pd.concat(ghgrp_yearly_data.values(), ignore_index=True)
        print(f"Combined GHGRP data: {ghgrp_combined.shape} rows across {len(ghgrp_yearly_data)} years")
        return ghgrp_combined
    else:
        print("No GHGRP data loaded successfully")
        return None


def load_usa_sector_data():
    """Load and process USA sector-specific emissions data"""
    print("\n=== Loading USA Sector-Specific Emissions Data ===")
    usa_sector_data = {}
    
    co2e_dir = os.path.join(USA_DATA_DIR, 'DATA-co2e_100')
    
    for sector in USA_CO2E_SECTORS:
        sector_dir = os.path.join(co2e_dir, sector)
        if not os.path.isdir(sector_dir):
            print(f"  Warning: Sector directory not found: {sector}")
            continue
            
        print(f"  Processing sector: {sector}")
        sector_files = [f for f in os.listdir(sector_dir) if f.endswith('.csv')]
        
        sector_data = []
        for file in sector_files:
            try:
                file_path = os.path.join(sector_dir, file)
                df = pd.read_csv(file_path)
                
                # Add sector and source info
                df['sector'] = sector
                df['data_source'] = file.replace('.csv', '')
                
                sector_data.append(df)
                print(f"    Loaded {file}: {df.shape} rows")
            except Exception as e:
                print(f"    Error loading {file}: {e}")
        
        if sector_data:
            # Combine all files for this sector
            sector_combined = pd.concat(sector_data, ignore_index=True)
            usa_sector_data[sector] = sector_combined
            print(f"  Combined {sector} data: {sector_combined.shape} rows")
    
    # Create summary of sectors
    sector_summary = {sector: len(data) for sector, data in usa_sector_data.items()}
    print(f"USA Sector Data Summary: {sector_summary}")
    
    return usa_sector_data


def load_and_prepare_co2_predictor():
    """Load OWID data and prepare/update the CO2 prediction model"""
    print("\n=== Preparing CO2 Prediction Model ===")
    
    # Define columns and parameters for the model
    columns_to_load = ['country', 'year', 'co2', 'population', 'gdp']
    target_country = 'United States'
    test_year_split = 2015
    
    # Load and preprocess data
    X_data, y_data = load_and_preprocess_data(OWID_DATA_PATH, columns_to_load, target_country)
    
    if X_data is not None and y_data is not None:
        # Train and save the model
        y_data_aligned = y_data.loc[X_data.index]
        train_evaluate_save_model(X_data, y_data_aligned, test_year_split, US_CO2_MODEL_PATH)
        
        # Load the saved model for testing
        try:
            model = joblib.load(US_CO2_MODEL_PATH)
            print("Model loaded successfully for predictions")
            return model
        except Exception as e:
            print(f"Error loading model: {e}")
            return None
    else:
        print("Failed to prepare CO2 prediction model")
        return None


def generate_example_predictions(model, current_year=2025):
    """Generate example predictions using the trained model"""
    if model is None:
        print("No model available for predictions")
        return None
        
    print("\n=== Generating Example CO2 Predictions ===")
    
    # Load recent data to get latest population and GDP
    try:
        df = pd.read_csv(OWID_DATA_PATH)
        us_data = df[df['country'] == 'United States'].sort_values('year', ascending=False)
        
        if us_data.empty:
            print("Error: No US data found for predictions")
            return None
            
        # Get the most recent available population and GDP
        latest_data = us_data.iloc[0]
        latest_year = latest_data['year']
        latest_pop = latest_data['population']
        latest_gdp = latest_data['gdp']
        
        print(f"Latest data from year {latest_year}:")
        print(f"  Population: {latest_pop:,.0f}")
        print(f"  GDP: ${latest_gdp:,.0f}")
        
        # Create prediction scenarios
        years_to_predict = 10
        prediction_years = range(latest_year + 1, latest_year + years_to_predict + 1)
        
        # Scenario 1: Business as usual (simple growth rates)
        pop_growth_rate = 1.005  # 0.5% annual growth
        gdp_growth_rate = 1.025  # 2.5% annual growth
        
        scenario_data = []
        
        for i, year in enumerate(prediction_years):
            # Business as usual scenario
            scenario_pop = latest_pop * (pop_growth_rate ** (i + 1))
            scenario_gdp = latest_gdp * (gdp_growth_rate ** (i + 1))
            
            # Make predictions
            X_pred = pd.DataFrame({
                'population': [scenario_pop],
                'gdp': [scenario_gdp]
            })
            
            predicted_co2 = model.predict(X_pred)[0]
            
            scenario_data.append({
                'year': year,
                'population': scenario_pop,
                'gdp': scenario_gdp,
                'predicted_co2_million_tons': predicted_co2
            })
        
        results_df = pd.DataFrame(scenario_data)
        print("\nCO2 Emission Predictions (Business as Usual):")
        print(results_df[['year', 'predicted_co2_million_tons']])
        
        return results_df
    
    except Exception as e:
        print(f"Error generating predictions: {e}")
        return None


def calculate_example_carbon_scores():
    """Calculate example carbon scores using the carbon scoring model"""
    print("\n=== Calculating Example Carbon Scores ===")
    
    try:
        # Load the benchmark data
        benchmarks = joblib.load(NAICS_BENCHMARK_SAVE_PATH)
        if not benchmarks:
            print("Error: No benchmark data available")
            return None
            
        # Create some example projects
        example_projects = [
            {'name': 'Green Office Building', 'naics_code': '236220', 'co2_emission_tons': 250, 'project_value_usd': 2000000},
            {'name': 'Solar Farm Installation', 'naics_code': '237130', 'co2_emission_tons': 400, 'project_value_usd': 5000000},
            {'name': 'Data Center', 'naics_code': '518210', 'co2_emission_tons': 1200, 'project_value_usd': 3000000},
            {'name': 'Manufacturing Plant', 'naics_code': '331110', 'co2_emission_tons': 5000, 'project_value_usd': 10000000}
        ]
        
        results = []
        for project in example_projects:
            score = calculate_carbon_score(project, benchmarks)
            project['carbon_score'] = score
            results.append(project)
            
        results_df = pd.DataFrame(results)
        print("\nExample Carbon Scores:")
        print(results_df[['name', 'naics_code', 'co2_emission_tons', 'project_value_usd', 'carbon_score']])
        
        return results_df
    
    except Exception as e:
        print(f"Error calculating carbon scores: {e}")
        return None


def run_full_pipeline():
    """Run the complete data pipeline to process all datasets and generate insights"""
    print("\n======= RUNNING CARBONCRTL FULL DATA PIPELINE =======\n")
    
    # 1. Load and process NAICS benchmark data
    naics_ghg_data = load_benchmark_data()
    
    # 2. Load GHGRP time series data
    ghgrp_data = load_ghgrp_time_series()
    
    # 3. Load USA sector-specific emissions data
    usa_sectors = load_usa_sector_data()
    
    # 4. Prepare/update CO2 prediction model
    co2_model = load_and_prepare_co2_predictor()
    
    # 5. Generate example predictions
    predictions = generate_example_predictions(co2_model)
    
    # 6. Calculate example carbon scores
    scores = calculate_example_carbon_scores()
    
    print("\n======= DATA PIPELINE COMPLETE =======")
    
    return {
        'naics_ghg_data': naics_ghg_data,
        'ghgrp_data': ghgrp_data,
        'usa_sectors': usa_sectors,
        'co2_model': co2_model,
        'predictions': predictions,
        'scores': scores
    }


if __name__ == "__main__":
    pipeline_results = run_full_pipeline()