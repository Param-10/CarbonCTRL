import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import os
import json

class CarbonScoreCalculator:
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.emission_factors = self._load_emission_factors()
        self.activity_units = self._load_activity_units()
        
    def _load_emission_factors(self):
        """
        Load emission factors from the dataset files.
        In a real implementation, this would parse the actual data files.
        For this demo, we'll use a simplified version based on the available data.
        """
        # Sample emission factors based on the dataset
        emission_factors = {
            'agriculture': {
                'cropland-fires': 0.0400579121416317,  # T of CO2e per hectare
                'synthetic-fertilizer-application': 0.005,  # T of CO2e per kg
                'manure-management': 0.023,  # T of CO2e per animal
                'rice-cultivation': 0.0072,  # T of CO2e per hectare
                'enteric-fermentation': 0.0184,  # T of CO2e per animal
                'crop-residues': 0.003  # T of CO2e per kg
            },
            'power': {
                'electricity-generation': 0.000385,  # T of CO2e per kWh
                'heat-plants': 0.00021,  # T of CO2e per kWh
                'solar-generation': 0.000041,  # T of CO2e per kWh
                'wind-generation': 0.000012,  # T of CO2e per kWh
                'hydroelectric': 0.000024  # T of CO2e per kWh
            },
            'transportation': {
                'road': 0.00019,  # T of CO2e per km
                'aviation': 0.00025,  # T of CO2e per km
                'shipping': 0.000015,  # T of CO2e per km per ton
                'rail': 0.000027,  # T of CO2e per km
                'public-transit': 0.000069  # T of CO2e per passenger-km
            },
            'buildings': {
                'residential': 0.0001,  # T of CO2e per sq ft per year
                'commercial': 0.00015,  # T of CO2e per sq ft per year
                'lighting': 0.00005,  # T of CO2e per kWh
                'heating': 0.0002,  # T of CO2e per kWh
                'cooling': 0.00018  # T of CO2e per kWh
            },
            'manufacturing': {
                'cement': 0.83,  # T of CO2e per ton
                'steel': 1.85,  # T of CO2e per ton
                'chemicals': 1.2,  # T of CO2e per ton
                'paper': 0.75,  # T of CO2e per ton
                'aluminum': 11.5,  # T of CO2e per ton
                'plastics': 3.1,  # T of CO2e per ton
                'electronics': 16.0  # T of CO2e per ton
            },
            'waste': {
                'landfill': 0.5,  # T of CO2e per ton
                'wastewater': 0.15,  # T of CO2e per cubic meter
                'incineration': 0.58,  # T of CO2e per ton
                'composting': 0.091,  # T of CO2e per ton
                'recycling': 0.058  # T of CO2e per ton
            }
        }
        
        return emission_factors
    
    def _load_activity_units(self):
        """
        Define the units and meaning of "amount" for each sector/subsector
        """
        activity_units = {
            'agriculture': {
                'cropland-fires': 'hectares of cropland burned',
                'synthetic-fertilizer-application': 'kg of fertilizer applied',
                'manure-management': 'number of animals',
                'rice-cultivation': 'hectares of rice cultivation',
                'enteric-fermentation': 'number of ruminant animals',
                'crop-residues': 'kg of crop residues'
            },
            'power': {
                'electricity-generation': 'kWh of electricity generated',
                'heat-plants': 'kWh of heat generated',
                'solar-generation': 'kWh of solar electricity generated',
                'wind-generation': 'kWh of wind electricity generated',
                'hydroelectric': 'kWh of hydroelectric power generated'
            },
            'transportation': {
                'road': 'km traveled by vehicles',
                'aviation': 'km traveled by aircraft',
                'shipping': 'ton-km of goods shipped',
                'rail': 'km traveled by trains',
                'public-transit': 'passenger-km traveled'
            },
            'buildings': {
                'residential': 'square feet of residential space',
                'commercial': 'square feet of commercial space',
                'lighting': 'kWh used for lighting',
                'heating': 'kWh used for heating',
                'cooling': 'kWh used for cooling'
            },
            'manufacturing': {
                'cement': 'tons of cement produced',
                'steel': 'tons of steel produced',
                'chemicals': 'tons of chemicals produced',
                'paper': 'tons of paper produced',
                'aluminum': 'tons of aluminum produced',
                'plastics': 'tons of plastics produced',
                'electronics': 'tons of electronics produced'
            },
            'waste': {
                'landfill': 'tons of waste sent to landfill',
                'wastewater': 'cubic meters of wastewater treated',
                'incineration': 'tons of waste incinerated',
                'composting': 'tons of waste composted',
                'recycling': 'tons of waste recycled'
            }
        }
        
        return activity_units
    
    def calculate_score(self, company_data):
        """
        Calculate carbon score based on company inputs.
        
        Args:
            company_data: Dictionary containing company activity data
                {
                    'company_name': str,
                    'activities': [
                        {
                            'sector': str,
                            'subsector': str,
                            'activity_amount': float,
                            'activity_unit': str
                        },
                        ...
                    ]
                }
                
        Returns:
            Dictionary with total emissions and breakdown by sector
        """
        total_emissions = 0
        emissions_breakdown = {}
        activity_details = []
        
        for activity in company_data['activities']:
            sector = activity['sector']
            subsector = activity['subsector']
            amount = activity['activity_amount']
            
            if sector not in self.emission_factors or subsector not in self.emission_factors[sector]:
                print(f"Warning: No emission factor found for {sector}/{subsector}")
                continue
            
            # Calculate emissions based on emission factor
            emission_factor = self.emission_factors[sector][subsector]
            emissions = amount * emission_factor
            
            # Get the activity unit description
            unit_description = self.activity_units.get(sector, {}).get(subsector, "units")
            
            # Store activity details
            activity_details.append({
                'sector': sector,
                'subsector': subsector,
                'amount': amount,
                'unit_description': unit_description,
                'emission_factor': emission_factor,
                'emissions': emissions
            })
            
            if sector not in emissions_breakdown:
                emissions_breakdown[sector] = 0
                
            emissions_breakdown[sector] += emissions
            total_emissions += emissions
        
        # Calculate carbon score (simplified method)
        if total_emissions < 10:
            carbon_rating = "A"
            rating_description = "Excellent - Very low carbon footprint"
        elif total_emissions < 50:
            carbon_rating = "B"
            rating_description = "Good - Low carbon footprint"
        elif total_emissions < 100:
            carbon_rating = "C"
            rating_description = "Average - Moderate carbon footprint"
        elif total_emissions < 500:
            carbon_rating = "D"
            rating_description = "Poor - High carbon footprint"
        else:
            carbon_rating = "E"
            rating_description = "Very Poor - Very high carbon footprint"
            
        return {
            "company_name": company_data['company_name'],
            "total_emissions_tons_co2e": total_emissions,
            "emissions_breakdown": emissions_breakdown,
            "activity_details": activity_details,
            "carbon_rating": carbon_rating,
            "rating_description": rating_description
        }
    
    def get_reduction_recommendations(self, emissions_breakdown):
        """
        Generate recommendations for emissions reduction based on the breakdown.
        
        Args:
            emissions_breakdown: Dictionary with emissions by sector
            
        Returns:
            List of recommendation strings
        """
        recommendations = []
        sectors_sorted = sorted(emissions_breakdown.items(), key=lambda x: x[1], reverse=True)
        
        for sector, emissions in sectors_sorted[:3]:  # Focus on top 3 emission sources
            if sector == 'power':
                recommendations.append("Consider renewable energy sources like solar or wind power.")
                recommendations.append("Implement energy efficiency measures to reduce electricity consumption.")
                recommendations.append("Upgrade to more energy-efficient equipment and lighting systems.")
            elif sector == 'transportation':
                recommendations.append("Optimize logistics and shipping routes to reduce transportation emissions.")
                recommendations.append("Consider transitioning to electric or hybrid vehicles for company fleet.")
                recommendations.append("Implement a remote work policy to reduce commuting emissions.")
            elif sector == 'manufacturing':
                recommendations.append("Audit manufacturing processes for energy efficiency improvements.")
                recommendations.append("Consider more sustainable materials or production methods.")
                recommendations.append("Implement heat recovery systems to capture and reuse waste heat.")
            elif sector == 'buildings':
                recommendations.append("Improve building insulation and HVAC efficiency.")
                recommendations.append("Install smart building management systems to optimize energy use.")
                recommendations.append("Upgrade to energy-efficient lighting and appliances.")
            elif sector == 'agriculture':
                recommendations.append("Implement sustainable farming practices to reduce emissions.")
                recommendations.append("Consider precision agriculture techniques to optimize fertilizer use.")
                recommendations.append("Adopt no-till or reduced-till farming practices to sequester carbon in soils.")
            elif sector == 'waste':
                recommendations.append("Implement waste reduction and recycling programs.")
                recommendations.append("Consider waste-to-energy technologies for organic waste.")
                recommendations.append("Adopt circular economy principles in product design and packaging.")
        
        # Additional cross-cutting recommendations
        recommendations.append("Establish a corporate carbon reduction target aligned with science-based targets.")
        recommendations.append("Consider purchasing high-quality carbon offsets for emissions that cannot be reduced.")
        
        return recommendations


# Example usage as a command-line tool
if __name__ == "__main__":
    import argparse
    import sys
    
    parser = argparse.ArgumentParser(description='Calculate company carbon emissions')
    parser.add_argument('--input', type=str, help='JSON file with company data')
    parser.add_argument('--output', type=str, help='Output file for results')
    
    args = parser.parse_args()
    
    calculator = CarbonScoreCalculator()
    
    if args.input:
        try:
            with open(args.input, 'r') as f:
                company_data = json.load(f)
        except Exception as e:
            print(f"Error reading input file: {e}")
            sys.exit(1)
    else:
        # Interactive mode
        company_name = input("Company name: ")
        
        activities = []
        while True:
            print("\nAvailable sectors:")
            for i, sector in enumerate(calculator.emission_factors.keys()):
                print(f"{i+1}. {sector}")
            
            try:
                sector_idx = int(input("\nSelect sector (number) or 0 to finish: ")) - 1
                if sector_idx == -1:
                    break
                    
                sector = list(calculator.emission_factors.keys())[sector_idx]
                
                print(f"\nAvailable subsectors for {sector}:")
                subsectors = calculator.emission_factors[sector]
                for i, subsector in enumerate(subsectors.keys()):
                    unit_desc = calculator.activity_units.get(sector, {}).get(subsector, "units")
                    print(f"{i+1}. {subsector} (amount = {unit_desc})")
                
                subsector_idx = int(input("\nSelect subsector (number): ")) - 1
                subsector = list(subsectors.keys())[subsector_idx]
                
                unit_desc = calculator.activity_units.get(sector, {}).get(subsector, "units")
                amount = float(input(f"\nActivity amount ({unit_desc}): "))
                
                activities.append({
                    'sector': sector,
                    'subsector': subsector,
                    'activity_amount': amount,
                    'activity_unit': unit_desc
                })
                
                print(f"Added {sector}/{subsector} activity: {amount} {unit_desc}")
                
            except (ValueError, IndexError) as e:
                print(f"Invalid input: {e}")
                
        company_data = {
            'company_name': company_name,
            'activities': activities
        }
    
    # Calculate score
    result = calculator.calculate_score(company_data)
    
    # Add recommendations
    result['recommendations'] = calculator.get_reduction_recommendations(result['emissions_breakdown'])
    
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(result, f, indent=2)
    else:
        print("\n" + "="*50)
        print(f"Carbon Score for {result['company_name']}")
        print("="*50)
        print(f"Total Emissions: {result['total_emissions_tons_co2e']:.2f} tons CO2e")
        print(f"Carbon Rating: {result['carbon_rating']} - {result['rating_description']}")
        
        print("\nEmissions Breakdown:")
        for sector, emissions in sorted(result['emissions_breakdown'].items(), key=lambda x: x[1], reverse=True):
            print(f"  - {sector}: {emissions:.2f} tons CO2e")
        
        print("\nDetailed Activity Analysis:")
        for i, activity in enumerate(result['activity_details']):
            print(f"  {i+1}. {activity['sector']}/{activity['subsector']}:")
            print(f"     - Amount: {activity['amount']} {activity['unit_description']}")
            print(f"     - Emissions: {activity['emissions']:.2f} tons CO2e")
        
        print("\nRecommendations:")
        for i, rec in enumerate(result['recommendations']):
            print(f"  {i+1}. {rec}") 