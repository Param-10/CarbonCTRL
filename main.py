#!/usr/bin/env python3
"""
CarbonCTRL Main Application
This script demonstrates the integrated data pipeline and models.
"""
import os
import sys
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.append(str(project_root))

# Import the pipeline components
from data_pipeline.coordinator import run_full_pipeline
from data_pipeline.usa_sector_analyzer import USASectorEmissionsAnalyzer
from data_pipeline.enhanced_scorer import EnhancedCarbonScorer

def main():
    """Run the main CarbonCTRL application."""
    print("\n===== CarbonCTRL Application =====\n")
    print("Integrating all datasets with carbon models...")
    
    # Option 1: Run the full pipeline to process all datasets
    # Uncomment the next line to run the full pipeline (may take some time)
    # pipeline_results = run_full_pipeline()
    
    # Option 2: Run specific components as needed
    
    # 2.1: Analyze USA sector emissions data
    print("\n----- USA Sector Analysis -----\n")
    sector_analyzer = USASectorEmissionsAnalyzer()
    
    # Load data for key sectors that match CarbonCTRL's focus
    focus_sectors = ['power', 'manufacturing', 'transportation', 'buildings']
    for sector in focus_sectors:
        sector_analyzer.load_sector(sector, 'co2e')
    
    # Export sector summary
    sector_summary = sector_analyzer.export_sector_summary('usa_sector_summary.csv')
    print(f"\nExported sector summary with {len(sector_summary)} sectors")
    
    # 2.2: Initialize the enhanced carbon scorer
    print("\n----- Enhanced Carbon Scoring -----\n")
    scorer = EnhancedCarbonScorer()
    
    print("\n===== CarbonCTRL Application Complete =====\n")


if __name__ == "__main__":
    main()