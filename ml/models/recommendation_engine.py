"""
AI-Powered Carbon Reduction Recommendation Engine
Uses NLP and machine learning to suggest optimal carbon reduction strategies
"""

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.ensemble import RandomForestRegressor
import tensorflow as tf
from tensorflow.keras import layers, Model
import joblib
import json

class CarbonRecommendationEngine:
    """Advanced AI Recommendation Engine for Carbon Reduction"""
    
    def __init__(self):
        self.knowledge_base = self._load_knowledge_base()
        self.vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
        self.impact_predictor = RandomForestRegressor(n_estimators=100)
        self.recommendation_model = None
        self.is_trained = False
        
    def _load_knowledge_base(self):
        """Load carbon reduction strategies knowledge base"""
        return [
            {
                "id": 1,
                "category": "Energy Efficiency",
                "strategy": "LED Lighting Upgrade",
                "description": "Replace all incandescent and fluorescent lighting with LED alternatives",
                "impact_level": "medium",
                "cost_level": "low",
                "implementation_time": "1-3 months",
                "annual_savings": "15-30% energy reduction",
                "applicability": "all industries",
                "tags": ["lighting", "electricity", "immediate", "cost-effective"]
            },
            {
                "id": 2,
                "category": "Renewable Energy",
                "strategy": "Solar Panel Installation",
                "description": "Install solar photovoltaic systems on rooftops or available land",
                "impact_level": "high",
                "cost_level": "high",
                "implementation_time": "3-6 months",
                "annual_savings": "40-70% electricity reduction",
                "applicability": "manufacturing, offices, warehouses",
                "tags": ["solar", "renewable", "long-term", "high-impact"]
            },
            {
                "id": 3,
                "category": "Transportation",
                "strategy": "Electric Vehicle Fleet",
                "description": "Transition company vehicles to electric alternatives",
                "impact_level": "high",
                "cost_level": "medium",
                "implementation_time": "6-12 months",
                "annual_savings": "50-80% transport emissions",
                "applicability": "logistics, delivery, field services",
                "tags": ["electric", "vehicles", "transport", "fleet"]
            },
            {
                "id": 4,
                "category": "Waste Management",
                "strategy": "Circular Economy Implementation",
                "description": "Implement waste reduction and recycling programs",
                "impact_level": "medium",
                "cost_level": "low",
                "implementation_time": "2-4 months",
                "annual_savings": "20-40% waste reduction",
                "applicability": "all industries",
                "tags": ["recycling", "waste", "circular", "sustainable"]
            },
            {
                "id": 5,
                "category": "Building Efficiency",
                "strategy": "Smart HVAC Systems",
                "description": "Install intelligent heating, ventilation, and air conditioning systems",
                "impact_level": "high",
                "cost_level": "medium",
                "implementation_time": "2-4 months",
                "annual_savings": "25-45% HVAC energy reduction",
                "applicability": "offices, retail, manufacturing",
                "tags": ["hvac", "smart", "automation", "efficiency"]
            },
            {
                "id": 6,
                "category": "Water Conservation",
                "strategy": "Water Recycling Systems",
                "description": "Implement greywater and rainwater harvesting systems",
                "impact_level": "medium",
                "cost_level": "medium",
                "implementation_time": "3-5 months",
                "annual_savings": "30-50% water usage reduction",
                "applicability": "manufacturing, hotels, large offices",
                "tags": ["water", "recycling", "conservation", "sustainable"]
            },
            {
                "id": 7,
                "category": "Supply Chain",
                "strategy": "Local Supplier Network",
                "description": "Source materials and services from local suppliers to reduce transport emissions",
                "impact_level": "medium",
                "cost_level": "low",
                "implementation_time": "4-6 months",
                "annual_savings": "15-35% supply chain emissions",
                "applicability": "retail, manufacturing, food service",
                "tags": ["local", "supply-chain", "transport", "community"]
            },
            {
                "id": 8,
                "category": "Technology",
                "strategy": "Cloud Computing Migration",
                "description": "Migrate IT infrastructure to energy-efficient cloud services",
                "impact_level": "medium",
                "cost_level": "medium",
                "implementation_time": "2-6 months",
                "annual_savings": "20-40% IT energy reduction",
                "applicability": "all industries with IT infrastructure",
                "tags": ["cloud", "technology", "efficiency", "digital"]
            }
        ]
    
    def build_neural_recommender(self, input_dim):
        """Build neural network for recommendation scoring"""
        
        inputs = layers.Input(shape=(input_dim,), name='company_features')
        
        # Feature extraction layers
        dense1 = layers.Dense(256, activation='relu')(inputs)
        dropout1 = layers.Dropout(0.3)(dense1)
        
        dense2 = layers.Dense(128, activation='relu')(dropout1)
        dropout2 = layers.Dropout(0.3)(dense2)
        
        dense3 = layers.Dense(64, activation='relu')(dropout2)
        
        # Output layer for recommendation scores
        outputs = layers.Dense(len(self.knowledge_base), activation='sigmoid')(dense3)
        
        model = Model(inputs=inputs, outputs=outputs)
        model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
        
        return model
    
    def extract_features(self, company_data):
        """Extract features from company carbon data"""
        
        features = {
            'total_emissions': company_data.get('total_emissions', 0),
            'energy_consumption': company_data.get('energy_consumption', 0),
            'transportation_emissions': company_data.get('transportation', 0),
            'waste_generation': company_data.get('waste_generation', 0),
            'water_usage': company_data.get('water_usage', 0),
            'employee_count': company_data.get('employee_count', 0),
            'industry_type': self._encode_industry(company_data.get('industry', 'general')),
            'company_size': self._encode_size(company_data.get('employee_count', 0)),
            'budget_level': company_data.get('budget_level', 2),  # 1-3 scale
            'urgency_level': company_data.get('urgency_level', 2)  # 1-3 scale
        }
        
        return np.array(list(features.values())).reshape(1, -1)
    
    def _encode_industry(self, industry):
        """Encode industry type to numerical value"""
        industry_map = {
            'manufacturing': 1, 'retail': 2, 'technology': 3,
            'healthcare': 4, 'finance': 5, 'education': 6,
            'hospitality': 7, 'transportation': 8, 'general': 0
        }
        return industry_map.get(industry.lower(), 0)
    
    def _encode_size(self, employee_count):
        """Encode company size"""
        if employee_count < 50:
            return 1  # Small
        elif employee_count < 250:
            return 2  # Medium
        else:
            return 3  # Large
    
    def calculate_impact_scores(self, company_features, strategies):
        """Calculate potential impact scores for strategies"""
        
        impact_scores = []
        
        for strategy in strategies:
            # Base impact calculation
            base_impact = {
                'low': 0.3, 'medium': 0.6, 'high': 0.9
            }.get(strategy['impact_level'], 0.5)
            
            # Adjust based on company characteristics
            company_multiplier = 1.0
            
            # Industry-specific adjustments
            if 'manufacturing' in strategy['applicability'] and company_features[0][6] == 1:
                company_multiplier *= 1.2
            
            # Size-based adjustments
            if company_features[0][7] == 3:  # Large company
                company_multiplier *= 1.1
            
            # Calculate final impact score
            impact_score = base_impact * company_multiplier
            impact_scores.append(min(impact_score, 1.0))
        
        return impact_scores
    
    def get_recommendations(self, company_data, top_k=5):
        """Generate personalized carbon reduction recommendations"""
        
        # Extract company features
        features = self.extract_features(company_data)
        
        # Calculate impact scores
        impact_scores = self.calculate_impact_scores(features, self.knowledge_base)
        
        # Calculate feasibility scores based on cost and implementation time
        feasibility_scores = []
        budget_level = company_data.get('budget_level', 2)
        urgency_level = company_data.get('urgency_level', 2)
        
        for strategy in self.knowledge_base:
            cost_score = {
                'low': 0.9, 'medium': 0.6, 'high': 0.3
            }.get(strategy['cost_level'], 0.5)
            
            # Adjust cost score based on budget
            if budget_level >= 3:  # High budget
                cost_score = min(cost_score * 1.3, 1.0)
            elif budget_level <= 1:  # Low budget
                cost_score *= 0.7
            
            # Time feasibility
            time_score = 0.8  # Base score
            if urgency_level >= 3 and 'immediate' in strategy['tags']:
                time_score = 1.0
            
            feasibility_score = (cost_score + time_score) / 2
            feasibility_scores.append(feasibility_score)
        
        # Combine scores
        combined_scores = []
        for i, strategy in enumerate(self.knowledge_base):
            combined_score = (impact_scores[i] * 0.6 + feasibility_scores[i] * 0.4)
            combined_scores.append({
                'strategy': strategy,
                'impact_score': impact_scores[i],
                'feasibility_score': feasibility_scores[i],
                'combined_score': combined_score,
                'predicted_reduction': self._calculate_emission_reduction(
                    company_data, strategy, impact_scores[i]
                )
            })
        
        # Sort by combined score and return top k
        recommendations = sorted(
            combined_scores, 
            key=lambda x: x['combined_score'], 
            reverse=True
        )[:top_k]
        
        return self._format_recommendations(recommendations)
    
    def _calculate_emission_reduction(self, company_data, strategy, impact_score):
        """Calculate estimated emission reduction"""
        
        total_emissions = company_data.get('total_emissions', 0)
        category_mapping = {
            'Energy Efficiency': 0.4,  # 40% of emissions typically from energy
            'Renewable Energy': 0.5,
            'Transportation': 0.15,
            'Waste Management': 0.05,
            'Building Efficiency': 0.3,
            'Water Conservation': 0.03,
            'Supply Chain': 0.2,
            'Technology': 0.1
        }
        
        category_impact = category_mapping.get(strategy['category'], 0.2)
        
        # Extract percentage from annual_savings string
        savings_text = strategy['annual_savings']
        import re
        percentages = re.findall(r'(\d+)-(\d+)%', savings_text)
        if percentages:
            avg_percentage = (int(percentages[0][0]) + int(percentages[0][1])) / 2 / 100
        else:
            avg_percentage = 0.25  # Default 25%
        
        estimated_reduction = total_emissions * category_impact * avg_percentage * impact_score
        
        return {
            'annual_co2_reduction': round(estimated_reduction, 2),
            'percentage_reduction': round((estimated_reduction / total_emissions) * 100, 2) if total_emissions > 0 else 0
        }
    
    def _format_recommendations(self, recommendations):
        """Format recommendations for API response"""
        
        formatted = []
        
        for rec in recommendations:
            strategy = rec['strategy']
            formatted.append({
                'id': strategy['id'],
                'title': strategy['strategy'],
                'category': strategy['category'],
                'description': strategy['description'],
                'impact_level': strategy['impact_level'],
                'cost_level': strategy['cost_level'],
                'implementation_time': strategy['implementation_time'],
                'annual_savings': strategy['annual_savings'],
                'tags': strategy['tags'],
                'scores': {
                    'impact_score': round(rec['impact_score'], 3),
                    'feasibility_score': round(rec['feasibility_score'], 3),
                    'combined_score': round(rec['combined_score'], 3)
                },
                'predicted_impact': rec['predicted_reduction'],
                'priority': self._calculate_priority(rec['combined_score'])
            })
        
        return formatted
    
    def _calculate_priority(self, score):
        """Calculate priority level based on score"""
        if score >= 0.8:
            return 'High'
        elif score >= 0.6:
            return 'Medium'
        else:
            return 'Low'
    
    def get_industry_benchmarks(self, industry):
        """Get industry-specific benchmarks and best practices"""
        
        benchmarks = {
            'manufacturing': {
                'avg_emissions_per_employee': 15.2,
                'top_strategies': ['Solar Panel Installation', 'Smart HVAC Systems', 'Waste Management'],
                'typical_reduction_target': '30-50%'
            },
            'retail': {
                'avg_emissions_per_employee': 8.7,
                'top_strategies': ['LED Lighting Upgrade', 'Local Supplier Network', 'Electric Vehicle Fleet'],
                'typical_reduction_target': '25-40%'
            },
            'technology': {
                'avg_emissions_per_employee': 6.3,
                'top_strategies': ['Cloud Computing Migration', 'Renewable Energy', 'LED Lighting'],
                'typical_reduction_target': '40-60%'
            }
        }
        
        return benchmarks.get(industry.lower(), {
            'avg_emissions_per_employee': 10.0,
            'top_strategies': ['LED Lighting Upgrade', 'Energy Efficiency', 'Waste Management'],
            'typical_reduction_target': '20-35%'
        })
    
    def save_model(self, filepath):
        """Save the recommendation engine"""
        joblib.dump({
            'knowledge_base': self.knowledge_base,
            'vectorizer': self.vectorizer
        }, f"{filepath}_recommendation_engine.pkl")
    
    def load_model(self, filepath):
        """Load the recommendation engine"""
        data = joblib.load(f"{filepath}_recommendation_engine.pkl")
        self.knowledge_base = data['knowledge_base']
        self.vectorizer = data['vectorizer']

# Example usage
if __name__ == "__main__":
    print("Testing Carbon Recommendation Engine...")
    
    # Sample company data
    company_data = {
        'total_emissions': 5000,
        'energy_consumption': 2000,
        'transportation': 800,
        'waste_generation': 300,
        'water_usage': 1500,
        'employee_count': 150,
        'industry': 'manufacturing',
        'budget_level': 2,
        'urgency_level': 3
    }
    
    # Initialize recommendation engine
    engine = CarbonRecommendationEngine()
    
    # Get recommendations
    recommendations = engine.get_recommendations(company_data, top_k=5)
    
    print(f"\n📋 Top 5 Recommendations for {company_data['industry']} company:")
    print("=" * 60)
    
    for i, rec in enumerate(recommendations, 1):
        print(f"\n{i}. {rec['title']} ({rec['priority']} Priority)")
        print(f"   Category: {rec['category']}")
        print(f"   Impact: {rec['impact_level']} | Cost: {rec['cost_level']}")
        print(f"   Implementation: {rec['implementation_time']}")
        print(f"   Predicted Reduction: {rec['predicted_impact']['annual_co2_reduction']} tons CO2/year")
        print(f"   Combined Score: {rec['scores']['combined_score']}")
    
    # Get industry benchmarks
    benchmarks = engine.get_industry_benchmarks(company_data['industry'])
    print(f"\n📊 Industry Benchmarks ({company_data['industry']}):")
    print(f"   Average emissions per employee: {benchmarks['avg_emissions_per_employee']} tons CO2")
    print(f"   Typical reduction target: {benchmarks['typical_reduction_target']}")
    
    print("\n✅ Recommendation Engine test completed!") 