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
    
    # 2.2: Use the enhanced carbon scorer
    print("\n----- Enhanced Carbon Scoring -----\n")
    scorer = EnhancedCarbonScorer()
    
    # Example client project portfolio
    client_projects = [
        {
            'name': 'Headquarters Building Renovation',
            'naics_code': '236220',  # Commercial Building Construction
            'co2_emission_tons': 350,
            'project_value_usd': 4500000,
            'department': 'Facilities',
            'scope': 1
        },
        {
            'name': 'Solar Installation',
            'naics_code': '221114',  # Solar Electric Power Generation
            'co2_emission_tons': 120,
            'project_value_usd': 2800000,
            'department': 'Renewable Energy',
            'scope': 2
        },
        {
            'name': 'Fleet Upgrade',
            'naics_code': '484110',  # General Freight Trucking, Local
            'co2_emission_tons': 850,
            'project_value_usd': 3200000,
            'department': 'Logistics',
            'scope': 1
        },
        {
            'name': 'Data Center Expansion',
            'naics_code': '518210',  # Data Processing, Hosting, and Related Services
            'co2_emission_tons': 1200,
            'project_value_usd': 8500000,
            'department': 'IT',
            'scope': 2
        },
        {
            'name': 'Manufacturing Line Modernization',
            'naics_code': '333111',  # Farm Machinery and Equipment Manufacturing
            'co2_emission_tons': 980,
            'project_value_usd': 7200000,
            'department': 'Operations',
            'scope': 1
        }
    ]
    
    # Score and provide recommendations for all projects
    project_results = []
    
    for project in client_projects:
        # Calculate enhanced score
        score_result = scorer.calculate_enhanced_score(project)
        
        # Get recommendations
        recommendations = scorer.get_recommendations(project, score_result)
        
        # Store results
        project_result = {
            'name': project['name'],
            'department': project['department'],
            'co2_emission_tons': project['co2_emission_tons'],
            'score': score_result['final_score'] if score_result else None,
            'recommendations': recommendations
        }
        project_results.append(project_result)
    
    # Create a portfolio summary
    print("\n----- Client Portfolio Summary -----\n")
    summary_df = pd.DataFrame([{
        'Project': r['name'],
        'Department': r['department'],
        'Emissions (tons)': r['co2_emission_tons'],
        'CarbonCTRL Score': round(r['score'], 1) if r['score'] else None,
        'Top Recommendation': r['recommendations'][0]['title'] if r['recommendations'] else 'N/A'
    } for r in project_results])
    
    print(summary_df)
    
    # Export the summary to CSV
    summary_df.to_csv('client_portfolio_summary.csv', index=False)
    print("\nExported client portfolio summary to client_portfolio_summary.csv")
    
    # Generate a chart of project scores
    plt.figure(figsize=(10, 6))
    bars = plt.bar(summary_df['Project'], summary_df['CarbonCTRL Score'], color='teal')
    plt.axhline(y=70, color='green', linestyle='--', alpha=0.7, label='Excellent')
    plt.axhline(y=50, color='orange', linestyle='--', alpha=0.7, label='Average')
    plt.axhline(y=30, color='red', linestyle='--', alpha=0.7, label='Needs Improvement')
    
    # Add score labels on top of bars
    for bar in bars:
        height = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2., height + 1,
                 f'{height:.1f}', ha='center', va='bottom')
    
    plt.title('CarbonCTRL Scores by Project', fontsize=16)
    plt.xlabel('Project', fontsize=14)
    plt.ylabel('CarbonCTRL Score (0-100)', fontsize=14)
    plt.xticks(rotation=45, ha='right')
    plt.ylim(0, 105)  # Set y-axis limit with some padding
    plt.legend()
    plt.tight_layout()
    
    # Save the chart
    plt.savefig('project_scores_chart.png')
    print("Generated project scores chart: project_scores_chart.png")
    
    print("\n===== CarbonCTRL Application Complete =====\n")


if __name__ == "__main__":
    main()