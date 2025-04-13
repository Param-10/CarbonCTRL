from flask import Flask, request, render_template, jsonify
import json
from carbon_score_calculator import CarbonScoreCalculator

app = Flask(__name__)
calculator = CarbonScoreCalculator()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/calculate', methods=['POST'])
def calculate():
    try:
        data = request.json
        result = calculator.calculate_score(data)
        result['recommendations'] = calculator.get_reduction_recommendations(result['emissions_breakdown'])
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/sectors')
def get_sectors():
    return jsonify(list(calculator.emission_factors.keys()))

@app.route('/subsectors/<sector>')
def get_subsectors(sector):
    if sector in calculator.emission_factors:
        return jsonify(list(calculator.emission_factors[sector].keys()))
    return jsonify([])

@app.route('/activity_unit/<sector>/<subsector>')
def get_activity_unit(sector, subsector):
    """Get the unit description for a specific sector/subsector."""
    unit_description = calculator.activity_units.get(sector, {}).get(subsector, "units")
    return jsonify({
        "sector": sector,
        "subsector": subsector,
        "unit_description": unit_description
    })

if __name__ == '__main__':
    app.run(debug=True) 