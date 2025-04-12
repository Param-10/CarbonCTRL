#!/usr/bin/env python3
"""
USA Sector-Specific Emissions Data Analyzer
This module processes the detailed USA emissions data by sector and integrates it with the CarbonCTRL platform.
"""
import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import sys

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

# Constants
DATA_DIR = os.path.join(project_root, 'datasets', 'USA')
CO2E_DATA_DIR = os.path.join(DATA_DIR, 'DATA-co2e_100')
PM25_DATA_DIR = os.path.join(DATA_DIR, 'DATA-pm2.5')

# Define sectors
SECTORS = ['agriculture', 'buildings', 'fluorinated_gases', 'forestry_and_land_use',
           'fossil_fuel_operations', 'manufacturing', 'mineral_extraction', 'power',
           'transportation', 'waste']


class USASectorEmissionsAnalyzer:
    """Analyzes USA sector-specific emissions data to enhance CarbonCTRL models and insights."""
    
    def __init__(self):
        """Initialize the analyzer"""
        self.data = {}
        self.combined_data = None
        self.sector_summaries = {}
        self.loaded_sectors = []
    
    def load_all_sectors(self, pollutant='co2e'):
        """Load all sector data for the specified pollutant type"""
        if pollutant == 'co2e':
            base_dir = CO2E_DATA_DIR
        elif pollutant == 'pm25':
            base_dir = PM25_DATA_DIR
        else:
            raise ValueError(f"Unsupported pollutant: {pollutant}")
            
        print(f"Loading all {pollutant} sector data...")
        
        for sector in SECTORS:
            sector_dir = os.path.join(base_dir, sector)
            if not os.path.isdir(sector_dir):
                print(f"  Sector directory not found: {sector}")
                continue
                
            self.load_sector(sector, pollutant)
            
        return self
    
    def load_sector(self, sector, pollutant='co2e'):
        """Load data for a specific sector"""
        if pollutant == 'co2e':
            base_dir = CO2E_DATA_DIR
        elif pollutant == 'pm25':
            base_dir = PM25_DATA_DIR
        else:
            raise ValueError(f"Unsupported pollutant: {pollutant}")
        
        sector_dir = os.path.join(base_dir, sector)
        if not os.path.isdir(sector_dir):
            print(f"Error: Sector directory not found: {sector_dir}")
            return None
            
        print(f"Loading {pollutant} data for sector: {sector}")
        sector_files = [f for f in os.listdir(sector_dir) if f.endswith('.csv')]
        
        if not sector_files:
            print(f"  No CSV files found in {sector}")
            return None
            
        sector_dfs = []
        for file in sector_files:
            try:
                file_path = os.path.join(sector_dir, file)
                df = pd.read_csv(file_path)
                
                # Add metadata columns
                df['sector'] = sector
                df['pollutant'] = pollutant
                df['source_file'] = file
                
                # Extract subsector from filename if possible
                subsector = file.split('_')[0] if '_' in file else 'general'
                df['subsector'] = subsector
                
                sector_dfs.append(df)
                print(f"  Loaded {file}: {df.shape} rows")
            except Exception as e:
                print(f"  Error loading {file}: {e}")
        
        if not sector_dfs:
            print(f"  No data loaded for sector: {sector}")
            return None
            
        # Combine all files for this sector
        combined_df = pd.concat(sector_dfs, ignore_index=True)
        print(f"  Combined {sector} data: {combined_df.shape} rows")
        
        # Store in the data dictionary
        self.data[(sector, pollutant)] = combined_df
        self.loaded_sectors.append((sector, pollutant))
        
        # Create a summary for this sector
        self._create_sector_summary(sector, pollutant)
        
        return combined_df
    
    def _create_sector_summary(self, sector, pollutant):
        """Create a summary of the sector data"""
        if (sector, pollutant) not in self.data:
            return None
            
        df = self.data[(sector, pollutant)]
        
        # Get emissions columns - typically either 'emissions', 'emissions_tons', or similar
        emissions_cols = [col for col in df.columns if 'emission' in col.lower()]
        
        if not emissions_cols:
            print(f"Warning: No emissions columns found for {sector}")
            self.sector_summaries[(sector, pollutant)] = {
                'total_files': len(df['source_file'].unique()),
                'total_rows': len(df),
                'columns': df.columns.tolist()
            }
            return
            
        # Use the first emissions column found
        emissions_col = emissions_cols[0]
        
        # Convert emissions column to numeric, coercing errors to NaN
        try:
            df[emissions_col] = pd.to_numeric(df[emissions_col], errors='coerce')
            print(f"  Converted {emissions_col} to numeric (non-numeric values set to NaN)")
        except Exception as e:
            print(f"  Warning: Could not convert {emissions_col} to numeric: {e}")
        
        # Create summary stats
        summary = {
            'total_files': len(df['source_file'].unique()),
            'total_rows': len(df),
            'total_emissions': df[emissions_col].sum(),
            'max_emissions': df[emissions_col].max(),
            'min_emissions': df[emissions_col].min(),
            'mean_emissions': df[emissions_col].mean(),
            'median_emissions': df[emissions_col].median(),
            'emissions_column': emissions_col,
            'subsectors': df['subsector'].unique().tolist()
        }
        
        # Store the summary
        self.sector_summaries[(sector, pollutant)] = summary
        
        print(f"  {sector} summary: {len(df)} rows, {summary['total_emissions']:.2f} total emissions")
        
        return summary
    
    def combine_all_data(self):
        """Combine all loaded data into a single dataframe"""
        if not self.data:
            print("No data loaded to combine")
            return None
            
        print(f"Combining data from {len(self.data)} sector-pollutant combinations...")
        
        all_dfs = list(self.data.values())
        combined = pd.concat(all_dfs, ignore_index=True)
        
        print(f"Combined all sector data: {combined.shape} rows")
        self.combined_data = combined
        
        return combined
    
    def get_sector_data(self, sector, pollutant='co2e'):
        """Get data for a specific sector"""
        if (sector, pollutant) not in self.data:
            print(f"Data for {sector} ({pollutant}) not loaded")
            return None
            
        return self.data[(sector, pollutant)]
    
    def get_sector_summary(self, sector, pollutant='co2e'):
        """Get summary for a specific sector"""
        if (sector, pollutant) not in self.sector_summaries:
            print(f"Summary for {sector} ({pollutant}) not available")
            return None
            
        return self.sector_summaries[(sector, pollutant)]
    
    def get_all_summaries(self):
        """Get summaries for all loaded sectors"""
        return self.sector_summaries
    
    def plot_sector_emissions(self, sector=None, pollutant='co2e', top_n=10, figsize=(12, 8)):
        """Plot emissions by sector or subsector"""
        if sector is None:
            # Plot total emissions by sector
            if not self.combined_data is not None:
                self.combine_all_data()
                
            if self.combined_data is None:
                print("No combined data available for plotting")
                return
                
            # Group by sector and sum emissions
            emissions_cols = [col for col in self.combined_data.columns if 'emission' in col.lower()]
            if not emissions_cols:
                print("No emissions columns found for plotting")
                return
                
            emissions_col = emissions_cols[0]
            
            sector_totals = self.combined_data.groupby('sector')[emissions_col].sum().sort_values(ascending=False)
            
            # Plot
            plt.figure(figsize=figsize)
            ax = sector_totals.plot(kind='bar', color='teal')
            plt.title(f'Total {pollutant.upper()} Emissions by Sector', fontsize=16)
            plt.xlabel('Sector', fontsize=14)
            plt.ylabel(f'Total Emissions ({emissions_col})', fontsize=14)
            plt.xticks(rotation=45, ha='right')
            plt.tight_layout()
            
            # Add values on top of bars
            for i, value in enumerate(sector_totals):
                ax.text(i, value * 1.02, f'{value:.1f}', ha='center', fontsize=12)
                
            plt.tight_layout()
            return plt
            
        else:
            # Plot subsector breakdown for a specific sector
            if (sector, pollutant) not in self.data:
                print(f"Data for {sector} ({pollutant}) not loaded")
                return None
                
            df = self.data[(sector, pollutant)]
            
            # Get emissions column
            emissions_cols = [col for col in df.columns if 'emission' in col.lower()]
            if not emissions_cols:
                print(f"No emissions columns found for {sector}")
                return None
                
            emissions_col = emissions_cols[0]
            
            # Group by subsector
            subsector_totals = df.groupby('subsector')[emissions_col].sum().sort_values(ascending=False)
            
            # Take top N subsectors
            if len(subsector_totals) > top_n:
                subsector_totals = subsector_totals.head(top_n)
                title_suffix = f' (Top {top_n})'
            else:
                title_suffix = ''
                
            # Plot
            plt.figure(figsize=figsize)
            ax = subsector_totals.plot(kind='bar', color='skyblue')
            plt.title(f'{sector.title()} {pollutant.upper()} Emissions by Subsector{title_suffix}', fontsize=16)
            plt.xlabel('Subsector', fontsize=14)
            plt.ylabel(f'Total Emissions ({emissions_col})', fontsize=14)
            plt.xticks(rotation=45, ha='right')
            
            # Add values on top of bars
            for i, value in enumerate(subsector_totals):
                ax.text(i, value * 1.02, f'{value:.1f}', ha='center', fontsize=12)
                
            plt.tight_layout()
            return plt
    
    def export_sector_summary(self, output_file='usa_sector_summary.csv'):
        """Export a summary of all sectors to a CSV file"""
        if not self.sector_summaries:
            print("No sector summaries available to export")
            return None
            
        # Create a dataframe from the summaries
        summary_rows = []
        for (sector, pollutant), summary in self.sector_summaries.items():
            row = {
                'sector': sector,
                'pollutant': pollutant,
                'files': summary.get('total_files', 0),
                'rows': summary.get('total_rows', 0),
                'total_emissions': summary.get('total_emissions', 0),
                'max_emissions': summary.get('max_emissions', 0),
                'mean_emissions': summary.get('mean_emissions', 0),
                'emissions_column': summary.get('emissions_column', '')
            }
            summary_rows.append(row)
            
        summary_df = pd.DataFrame(summary_rows)
        
        # Save to CSV
        output_path = os.path.join(project_root, output_file)
        summary_df.to_csv(output_path, index=False)
        print(f"Exported sector summary to {output_path}")
        
        return summary_df
    
    def get_emissions_by_naics(self, naics_code, pollutant='co2e'):
        """Get emissions data for a specific NAICS code across all sectors"""
        if not self.combined_data is not None:
            self.combine_all_data()
            
        if self.combined_data is None:
            print("No combined data available")
            return None
            
        # Look for NAICS code columns in the data
        naics_cols = [col for col in self.combined_data.columns if 'naics' in col.lower()]
        
        if not naics_cols:
            print("No NAICS code columns found in the data")
            return None
            
        # Use the first NAICS column found
        naics_col = naics_cols[0]
        
        # Filter by NAICS code (try exact match first, then prefix match)
        exact_match = self.combined_data[self.combined_data[naics_col] == naics_code]
        
        if len(exact_match) > 0:
            print(f"Found {len(exact_match)} exact matches for NAICS code {naics_code}")
            return exact_match
            
        # Try prefix match (e.g., NAICS code starts with the provided code)
        prefix_match = self.combined_data[self.combined_data[naics_col].astype(str).str.startswith(str(naics_code))]
        
        if len(prefix_match) > 0:
            print(f"Found {len(prefix_match)} prefix matches for NAICS code {naics_code}")
            return prefix_match
            
        print(f"No matches found for NAICS code {naics_code}")
        return None


# Example usage
if __name__ == "__main__":
    analyzer = USASectorEmissionsAnalyzer()
    
    # Load data for all sectors
    analyzer.load_all_sectors(pollutant='co2e')
    
    # Combine all data
    combined_data = analyzer.combine_all_data()
    
    # Export sector summary
    analyzer.export_sector_summary()
    
    # Plot sector emissions
    analyzer.plot_sector_emissions()
    plt.savefig('usa_sector_emissions.png')
    
    # Example: Plot transportation sector emissions
    analyzer.plot_sector_emissions(sector='transportation')
    plt.savefig('transportation_emissions.png')
    
    print("Analysis complete. Check the output files for results.")