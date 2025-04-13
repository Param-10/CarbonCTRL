# Carbon Score Calculator

A tool for companies to calculate their carbon emissions score based on their operational activities.

## Overview

This application uses data derived from the Climate TRACE emissions inventory dataset to help companies estimate their carbon footprint across various sectors including:

- Agriculture
- Power generation
- Transportation
- Manufacturing
- Buildings
- Waste management
- And more...

The system provides:
- Carbon emissions calculations based on activity data
- Sector-by-sector emissions breakdown
- Carbon rating (A-E scale)
- Targeted recommendations for emissions reduction

## Installation

1. Clone this repository
2. Install the required dependencies:

```bash
pip install -r requirements.txt
```

## Usage

### Web Interface

Start the web application:

```bash
python app.py
```

Then open your browser to `http://localhost:5000`

### Command Line Tool

Run the calculator from the command line:

```bash
# Interactive mode
python carbon_score_calculator.py

# Using a JSON input file
python carbon_score_calculator.py --input example_company_input.json --output results.json
```

### API Usage

The calculator can be integrated into other applications using the API:

```python
from carbon_score_calculator import CarbonScoreCalculator

calculator = CarbonScoreCalculator()

company_data = {
    "company_name": "Example Corp",
    "activities": [
        {
            "sector": "power",
            "subsector": "electricity-generation",
            "activity_amount": 1000000,
            "activity_unit": "kWh"
        },
        {
            "sector": "transportation",
            "subsector": "road",
            "activity_amount": 50000,
            "activity_unit": "km"
        }
    ]
}

result = calculator.calculate_score(company_data)
recommendations = calculator.get_reduction_recommendations(result["emissions_breakdown"])
```

## Data Sources

The emission factors used in this calculator are derived from the Climate TRACE dataset, which provides comprehensive emissions data across multiple sectors at various geographical scales.

## Carbon Rating Scale

- **A**: < 10 tons CO2e - Excellent
- **B**: 10-50 tons CO2e - Good
- **C**: 50-100 tons CO2e - Average
- **D**: 100-500 tons CO2e - Poor
- **E**: > 500 tons CO2e - Very Poor

## License

This project is licensed under the MIT License - see the LICENSE file for details. 