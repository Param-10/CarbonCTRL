#!/usr/bin/env python3
"""
Enhanced Carbon Scoring Model
This module extends the base carbon scoring model with sector-specific insights
from the detailed USA emissions data.
"""
import os
import pandas as pd
import numpy as np
import joblib
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

# Import the base models and analyzers
from models.carbon_scorer import calculate_carbon_score
from data_pipeline.usa_sector_analyzer import USASectorEmissionsAnalyzer

# Constants
MODELS_DIR = os.path.join(project_root, 'models')
BENCHMARK_PATH = os.path.join(MODELS_DIR, 'naics_emission_benchmarks.joblib')
SECTOR_BENCHMARKS_PATH = os.path.join(MODELS_DIR, 'sector_emission_benchmarks.joblib')

# NAICS to sector mapping (simplified, can be expanded)
NAICS_SECTOR_MAPPING = {
    # Agriculture
    '11': 'agriculture',
    '111': 'agriculture',
    '112': 'agriculture',
    
    # Power generation
    '221': 'power',
    
    # Manufacturing
    '31': 'manufacturing',
    '32': 'manufacturing',
    '33': 'manufacturing',
    
    # Buildings (Commercial & Residential)
    '236': 'buildings',
    '531': 'buildings',
    
    # Transportation
    '48': 'transportation',
    '49': 'transportation',
    
    # Oil & Gas
    '211': 'fossil_fuel_operations',
    '213': 'fossil_fuel_operations',
    
    # Mining
    '212': 'mineral_extraction',
    
    # Waste Management
    '562': 'waste'
}


class EnhancedCarbonScorer:
    """An enhanced carbon scoring system that incorporates sector-specific emissions data."""
    
    def __init__(self):
        """Initialize the enhanced scorer."""
        self.naics_benchmarks = None
        self.sector_benchmarks = None
        self.sector_analyzer = USASectorEmissionsAnalyzer()
        self.load_benchmarks()
    
    def load_benchmarks(self):
        """Load the NAICS benchmarks and create sector benchmarks if needed."""
        print("Loading carbon scoring benchmarks...")
        
        # Load the base NAICS benchmarks
        try:
            self.naics_benchmarks = joblib.load(BENCHMARK_PATH)
            print(f"Loaded {len(self.naics_benchmarks)} NAICS benchmarks")
        except FileNotFoundError:
            print(f"NAICS benchmarks not found at {BENCHMARK_PATH}")
            self.naics_benchmarks = {}
        
        # Try to load sector benchmarks if they exist
        try:
            self.sector_benchmarks = joblib.load(SECTOR_BENCHMARKS_PATH)
            print(f"Loaded {len(self.sector_benchmarks)} sector benchmarks")
        except FileNotFoundError:
            # If not found, create them
            print("Sector benchmarks not found. Creating from USA emissions data...")
            self.create_sector_benchmarks()
    
    def create_sector_benchmarks(self):
        """Create sector-specific benchmarks from the USA emissions data."""
        # Load the sector data
        self.sector_analyzer.load_all_sectors(pollutant='co2e')
        
        # Combine all data
        combined_data = self.sector_analyzer.combine_all_data()
        
        if combined_data is None:
            print("Failed to load sector data")
            self.sector_benchmarks = {}
            return
        
        # Get sector summaries
        sector_summaries = self.sector_analyzer.get_all_summaries()
        
        # Create benchmarks dictionary
        benchmarks = {}
        
        for (sector, pollutant), summary in sector_summaries.items():
            if pollutant != 'co2e':
                continue
                
            # Get emissions column
            emissions_col = summary.get('emissions_column')
            if not emissions_col:
                continue
                
            # Get sector data
            sector_data = self.sector_analyzer.get_sector_data(sector, 'co2e')
            
            # Ensure emissions column is numeric
            try:
                sector_data[emissions_col] = pd.to_numeric(sector_data[emissions_col], errors='coerce')
            except Exception as e:
                print(f"Warning: Could not convert {emissions_col} to numeric for {sector}: {e}")
                continue
                
            # Calculate average emissions per entity if possible
            if 'entity_id' in sector_data.columns:
                # Group by entity and calculate average
                entity_emissions = sector_data.groupby('entity_id')[emissions_col].mean()
                benchmarks[f'sector_{sector}_avg'] = entity_emissions.mean()
                benchmarks[f'sector_{sector}_p25'] = entity_emissions.quantile(0.25)
                benchmarks[f'sector_{sector}_p50'] = entity_emissions.quantile(0.50)
                benchmarks[f'sector_{sector}_p75'] = entity_emissions.quantile(0.75)
            else:
                # Use overall summary statistics
                benchmarks[f'sector_{sector}_avg'] = summary.get('mean_emissions', 0)
                benchmarks[f'sector_{sector}_median'] = summary.get('median_emissions', 0)
                benchmarks[f'sector_{sector}_max'] = summary.get('max_emissions', 0)
        
        self.sector_benchmarks = benchmarks
        
        # Save the sector benchmarks
        joblib.dump(benchmarks, SECTOR_BENCHMARKS_PATH)
        print(f"Created and saved {len(benchmarks)} sector benchmark metrics")
    
    def get_sector_for_naics(self, naics_code):
        """Map a NAICS code to a sector."""
        if not naics_code:
            return None
            
        naics_str = str(naics_code)
        
        # Try exact match first
        if naics_str in NAICS_SECTOR_MAPPING:
            return NAICS_SECTOR_MAPPING[naics_str]
            
        # Try prefix matching (start with longest prefix)
        for prefix_len in range(min(len(naics_str), 3), 0, -1):
            prefix = naics_str[:prefix_len]
            if prefix in NAICS_SECTOR_MAPPING:
                return NAICS_SECTOR_MAPPING[prefix]
                
        return None
    
    def calculate_enhanced_score(self, project_data):
        """
        Calculate an enhanced carbon score that incorporates sector-specific benchmarks.
        
        Args:
            project_data (dict): Dictionary containing project details, including 'naics_code',
                                'co2_emission_tons', 'project_value_usd', etc.
                                
        Returns:
            dict: Dictionary with score components and final score
        """
        print(f"\nCalculating enhanced score for project: {project_data.get('name', 'Unnamed')}")
        
        # Get basic information
        naics_code = project_data.get('naics_code')
        co2_tons = project_data.get('co2_emission_tons')
        value_usd = project_data.get('project_value_usd')
        
        if not all([naics_code, co2_tons, value_usd]):
            print("Error: Missing required project data")
            return None
            
        # Calculate the base score using the original method
        base_score = calculate_carbon_score(project_data, self.naics_benchmarks)
        
        if base_score is None:
            print("Warning: Base score calculation failed")
            base_score = 50  # Default middle score
        
        # Get the sector for this NAICS code
        sector = self.get_sector_for_naics(naics_code)
        
        # Initialize sector component
        sector_score = None
        sector_factor = 1.0  # Default neutral factor
        
        if sector and self.sector_benchmarks:
            print(f"Project belongs to sector: {sector}")
            
            # Get sector benchmark (average emissions)
            sector_avg_key = f'sector_{sector}_avg'
            if sector_avg_key in self.sector_benchmarks:
                sector_avg = self.sector_benchmarks[sector_avg_key]
                
                # Calculate sector-specific score component
                # Lower emissions than sector average is good
                if sector_avg > 0:
                    ratio = co2_tons / sector_avg
                    
                    # Adjust ratio to score (0-100)
                    # 1.0 = average (50), 0.5 = better (75), 2.0 = worse (25)
                    sector_score = max(0, min(100, 100 - (ratio - 0.5) * 50))
                    
                    # Calculate sector adjustment factor (0.8 to 1.2)
                    # Better than average emissions increases score, worse decreases
                    sector_factor = 1.0 + ((50 - sector_score) / -250)  # Range: 0.8 to 1.2
                    
                    print(f"Sector benchmark: {sector_avg:.2f} tons")
                    print(f"Project emissions: {co2_tons:.2f} tons")
                    print(f"Sector score component: {sector_score:.2f}")
                    print(f"Sector adjustment factor: {sector_factor:.2f}")
        
        # Combine base score with sector adjustment
        if sector_score is not None:
            # Weighted average of base score and sector score
            combined_score = (base_score * 0.7) + (sector_score * 0.3)
            
            # Apply sector adjustment factor
            final_score = combined_score * sector_factor
            
            # Ensure final score is within 0-100 range
            final_score = max(0, min(100, final_score))
        else:
            # Use base score if sector score not available
            final_score = base_score
            
        print(f"Base score: {base_score:.2f}")
        print(f"Final enhanced score: {final_score:.2f}")
        
        # Return detailed score components
        return {
            'base_score': base_score,
            'sector': sector,
            'sector_score': sector_score,
            'sector_factor': sector_factor,
            'final_score': final_score
        }
    
    def get_recommendations(self, project_data, score_result):
        """
        Generate emissions reduction recommendations based on the project's 
        data and score components.
        
        Args:
            project_data (dict): Project details dictionary
            score_result (dict): Score components from calculate_enhanced_score
            
        Returns:
            list: List of recommendation dictionaries
        """
        if not score_result:
            return []
            
        recommendations = []
        
        # Get project details
        naics_code = project_data.get('naics_code')
        sector = score_result.get('sector')
        final_score = score_result.get('final_score', 0)
        
        # Base recommendations on score
        if final_score < 30:
            severity = "critical"
            priority = "high"
        elif final_score < 60:
            severity = "moderate"
            priority = "medium"
        else:
            severity = "good"
            priority = "low"
            
        # Add sector-specific recommendations
        if sector == 'power':
            recommendations.append({
                'title': 'Renewable Energy Integration',
                'description': 'Integrate renewable energy sources to reduce emissions from power generation.',
                'potential_impact': 'high' if severity == 'critical' else 'medium',
                'priority': priority
            })
            
        elif sector == 'manufacturing':
            recommendations.append({
                'title': 'Energy Efficiency Improvements',
                'description': 'Implement energy efficiency measures in manufacturing processes.',
                'potential_impact': 'medium',
                'priority': priority
            })
            
        elif sector == 'transportation':
            recommendations.append({
                'title': 'Fleet Electrification',
                'description': 'Transition vehicle fleet to electric or hybrid alternatives.',
                'potential_impact': 'high' if severity == 'critical' else 'medium',
                'priority': priority
            })
            
        elif sector == 'buildings':
            recommendations.append({
                'title': 'Building Efficiency Upgrades',
                'description': 'Implement energy-efficient lighting, HVAC, and insulation.',
                'potential_impact': 'medium',
                'priority': priority
            })
            
        # General recommendations for all sectors
        recommendations.append({
            'title': 'Carbon Offset Investments',
            'description': 'Invest in verified carbon offset projects to neutralize emissions.',
            'potential_impact': 'medium',
            'priority': 'medium'
        })
        
        if final_score < 50:
            recommendations.append({
                'title': 'Comprehensive Emissions Audit',
                'description': 'Conduct a detailed emissions audit to identify major sources.',
                'potential_impact': 'high',
                'priority': 'high'
            })
        
        return recommendations


# Example usage
if __name__ == "__main__":
    # Create the enhanced scorer
    scorer = EnhancedCarbonScorer()
    
    # Example projects
    example_projects = [
        {
            'name': 'Solar Farm',
            'naics_code': '221114',  # Solar Electric Power Generation
            'co2_emission_tons': 250,
            'project_value_usd': 5000000
        },
        {
            'name': 'Manufacturing Plant',
            'naics_code': '336111',  # Automobile Manufacturing
            'co2_emission_tons': 5000,
            'project_value_usd': 10000000
        },
        {
            'name': 'Office Building',
            'naics_code': '236220',  # Commercial Building Construction
            'co2_emission_tons': 800,
            'project_value_usd': 3000000
        }
    ]
    
    # Score each project and get recommendations
    for project in example_projects:
        score_result = scorer.calculate_enhanced_score(project)
        
        if score_result:
            recommendations = scorer.get_recommendations(project, score_result)
            
            print("\n===== Recommendations =====")
            for rec in recommendations:
                print(f"- {rec['title']} (Priority: {rec['priority'].title()})")
                print(f"  {rec['description']}")
                print(f"  Potential Impact: {rec['potential_impact'].title()}")
                
        print("\n" + "-" * 50 + "\n")