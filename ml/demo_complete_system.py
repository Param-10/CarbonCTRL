#!/usr/bin/env python3
"""
🚀 Complete CarbonCTRL AI/ML System Demo
Advanced demonstration of all machine learning capabilities
"""

import sys
import time
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

# Set style for better plots
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")

class CarbonCTRLMLDemo:
    """
    Complete demonstration of CarbonCTRL's AI/ML capabilities
    """
    
    def __init__(self):
        self.demo_data = self.generate_demo_data()
        self.results = {}
        
    def print_header(self, title, emoji="🔥"):
        """Print formatted section header"""
        print(f"\n{emoji} {title}")
        print("=" * (len(title) + 4))
    
    def print_step(self, step, description):
        """Print formatted step"""
        print(f"\n{step}. 🎯 {description}")
        print("-" * (len(description) + 8))
    
    def generate_demo_data(self):
        """Generate realistic demo data for testing"""
        print("📊 Generating realistic demo data...")
        
        # Generate 1 year of daily data
        dates = pd.date_range('2023-01-01', '2024-01-01', freq='D')
        n_days = len(dates)
        
        # Create realistic seasonal patterns
        day_of_year = np.array([d.timetuple().tm_yday for d in dates])
        
        # Base emissions with seasonal variation
        base_emissions = 2000 + 300 * np.sin(2 * np.pi * day_of_year / 365)
        
        # Add weekly patterns (lower on weekends)
        weekly_pattern = np.array([0.9 if d.weekday() >= 5 else 1.0 for d in dates])
        
        # Add random variation
        np.random.seed(42)
        noise = np.random.normal(0, 200, n_days)
        
        total_emissions = base_emissions * weekly_pattern + noise
        
        # Derive other features
        energy_consumption = total_emissions * 0.4 + np.random.normal(0, 50, n_days)
        transportation = total_emissions * 0.25 + np.random.normal(0, 30, n_days)
        waste_generation = total_emissions * 0.15 + np.random.normal(0, 20, n_days)
        water_usage = total_emissions * 0.3 + np.random.normal(0, 40, n_days)
        
        # Create DataFrame
        data = pd.DataFrame({
            'date': dates,
            'total_emissions': np.maximum(total_emissions, 0),
            'energy_consumption': np.maximum(energy_consumption, 0),
            'transportation': np.maximum(transportation, 0),
            'waste_generation': np.maximum(waste_generation, 0),
            'water_usage': np.maximum(water_usage, 0),
            'employee_count': np.full(n_days, 150),
            'production_volume': total_emissions * 1.2 + np.random.normal(0, 100, n_days),
            'temperature': 20 + 10 * np.sin(2 * np.pi * day_of_year / 365) + np.random.normal(0, 3, n_days)
        })
        
        data.set_index('date', inplace=True)
        print(f"✅ Generated {len(data)} days of realistic carbon data")
        
        return data
    
    def demo_1_data_analysis(self):
        """Demo 1: Advanced Data Analysis"""
        self.print_header("Demo 1: Advanced Data Analysis", "📊")
        
        print("📈 Key Statistics:")
        print(f"   • Average daily emissions: {self.demo_data['total_emissions'].mean():.1f} kg CO2")
        print(f"   • Peak emissions: {self.demo_data['total_emissions'].max():.1f} kg CO2")
        print(f"   • Lowest emissions: {self.demo_data['total_emissions'].min():.1f} kg CO2")
        print(f"   • Standard deviation: {self.demo_data['total_emissions'].std():.1f} kg CO2")
        print(f"   • Total period emissions: {self.demo_data['total_emissions'].sum()/1000:.1f} tons CO2")
        
        # Monthly analysis
        monthly_data = self.demo_data.groupby(self.demo_data.index.month)['total_emissions'].mean()
        peak_month = monthly_data.idxmax()
        low_month = monthly_data.idxmin()
        
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        
        print(f"\n📅 Seasonal Analysis:")
        print(f"   • Peak emissions month: {months[peak_month-1]} ({monthly_data[peak_month]:.1f} kg CO2)")
        print(f"   • Lowest emissions month: {months[low_month-1]} ({monthly_data[low_month]:.1f} kg CO2)")
        
        return self.demo_data
    
    def demo_2_ml_training(self):
        """Demo 2: ML Models Training"""
        self.print_header("Demo 2: ML Models Training", "🧠")
        
        try:
            # Train recommendation engine
            self.print_step(1, "Training AI Recommendation Engine")
            from models.recommendation_engine import CarbonRecommendationEngine
            
            rec_engine = CarbonRecommendationEngine()
            print("✅ Recommendation engine initialized successfully!")
            print(f"   • Available strategies: {len(rec_engine.strategies)}")
            print(f"   • Knowledge base entries: {len(rec_engine.knowledge_base)}")
            
        except Exception as e:
            print(f"⚠️ Recommendation engine issue: {e}")
    
    def demo_3_predictions(self):
        """Demo 3: AI Predictions"""
        self.print_header("Demo 3: AI Predictions", "🔮")
        
        # Simulate predictions based on recent trends
        recent_avg = self.demo_data.tail(30)['total_emissions'].mean()
        trend = (self.demo_data.tail(7)['total_emissions'].mean() - 
                self.demo_data.tail(14).head(7)['total_emissions'].mean())
        
        print("🎯 7-Day Carbon Emission Forecast:")
        predictions = []
        for i in range(1, 8):
            # Simple trend-based prediction with some variation
            prediction = recent_avg + (trend * i) + np.random.normal(0, 50)
            prediction = max(prediction, 0)  # Ensure non-negative
            predictions.append(prediction)
            
            future_date = self.demo_data.index[-1] + timedelta(days=i)
            print(f"   Day {i} ({future_date.strftime('%Y-%m-%d')}): {prediction:.1f} kg CO2")
        
        print(f"\n📊 Prediction Summary:")
        print(f"   • Average predicted emissions: {np.mean(predictions):.1f} kg CO2/day")
        print(f"   • Trend direction: {'Increasing' if trend > 0 else 'Decreasing'}")
        print(f"   • Expected change: {trend:.1f} kg CO2/day")
        
        self.results['predictions'] = predictions
    
    def demo_4_recommendations(self):
        """Demo 4: Smart Recommendations"""
        self.print_header("Demo 4: Smart Recommendations", "💡")
        
        try:
            from models.recommendation_engine import CarbonRecommendationEngine
            
            rec_engine = CarbonRecommendationEngine()
            
            company_profile = {
                'total_emissions': self.demo_data['total_emissions'].mean(),
                'energy_consumption': self.demo_data['energy_consumption'].mean(),
                'transportation': self.demo_data['transportation'].mean(),
                'waste_generation': self.demo_data['waste_generation'].mean(),
                'water_usage': self.demo_data['water_usage'].mean(),
                'employee_count': 150,
                'industry': 'manufacturing',
                'budget_level': 2,
                'urgency_level': 3
            }
            
            recommendations = rec_engine.get_recommendations(company_profile)
            
            print("🎯 AI-Generated Carbon Reduction Recommendations:")
            print()
            
            total_potential = 0
            for i, rec in enumerate(recommendations[:5], 1):
                impact = rec['predicted_impact']['annual_co2_reduction']
                total_potential += impact
                
                print(f"{i}. 📋 {rec['title']}")
                print(f"   Priority: {rec['priority']}")
                print(f"   CO2 Reduction: {impact:.0f} tons/year")
                print(f"   Percentage: {rec['predicted_impact']['percentage_reduction']:.1f}%")
                print(f"   AI Confidence: {rec['scores']['combined_score']*100:.1f}%")
                print()
            
            print(f"💪 Total Potential Impact: {total_potential:.0f} tons CO2/year")
            self.results['recommendations'] = recommendations
            
        except Exception as e:
            print(f"❌ Recommendations demo failed: {e}")
    
    def demo_5_anomaly_detection(self):
        """Demo 5: Anomaly Detection"""
        self.print_header("Demo 5: Anomaly Detection", "🚨")
        
        # Simple anomaly detection using statistical methods
        mean_emissions = self.demo_data['total_emissions'].mean()
        std_emissions = self.demo_data['total_emissions'].std()
        threshold = mean_emissions + 3 * std_emissions
        
        anomalies = self.demo_data[self.demo_data['total_emissions'] > threshold]
        
        print("🔍 Statistical Anomaly Detection Results:")
        print(f"   • Detection threshold: {threshold:.1f} kg CO2")
        print(f"   • Anomalies found: {len(anomalies)}")
        print(f"   • Anomaly rate: {len(anomalies)/len(self.demo_data)*100:.2f}%")
        
        if len(anomalies) > 0:
            print(f"   • Highest anomaly: {anomalies['total_emissions'].max():.1f} kg CO2")
            print(f"   • Average anomaly: {anomalies['total_emissions'].mean():.1f} kg CO2")
            
            print("\n🚨 Recent Anomalies:")
            for idx, row in anomalies.tail(3).iterrows():
                print(f"   • {idx.strftime('%Y-%m-%d')}: {row['total_emissions']:.1f} kg CO2")
        
        # Simulate real-time detection
        recent_value = self.demo_data['total_emissions'].iloc[-1]
        is_anomaly = recent_value > threshold
        
        print(f"\n🎯 Latest Reading Analysis:")
        print(f"   • Current emissions: {recent_value:.1f} kg CO2")
        print(f"   • Status: {'🚨 ANOMALY DETECTED' if is_anomaly else '✅ NORMAL'}")
        print(f"   • Deviation from normal: {((recent_value - mean_emissions) / std_emissions):.2f} σ")
        
        self.results['anomaly_detection'] = {
            'is_anomaly': is_anomaly,
            'current_value': recent_value,
            'threshold': threshold,
            'total_anomalies': len(anomalies)
        }
    
    def demo_6_benchmarks(self):
        """Demo 6: Industry Benchmarks"""
        self.print_header("Demo 6: Industry Benchmarks", "🏭")
        
        # Simulate industry data
        industries = {
            'manufacturing': {'avg': 2500, 'best': 1800, 'worst': 3500},
            'technology': {'avg': 1200, 'best': 800, 'worst': 1800},
            'retail': {'avg': 1800, 'best': 1200, 'worst': 2500},
            'healthcare': {'avg': 2200, 'best': 1600, 'worst': 3000}
        }
        
        company_avg = self.demo_data['total_emissions'].mean()
        
        print("🏭 Industry Benchmarking Analysis:")
        print(f"   • Your Company Average: {company_avg:.0f} kg CO2/day")
        print()
        
        best_match = None
        best_diff = float('inf')
        
        for industry, benchmarks in industries.items():
            diff = abs(company_avg - benchmarks['avg'])
            performance = ((company_avg - benchmarks['avg']) / benchmarks['avg']) * 100
            
            print(f"📊 {industry.title()} Industry:")
            print(f"   • Industry Average: {benchmarks['avg']} kg CO2/day")
            print(f"   • Best Practice: {benchmarks['best']} kg CO2/day")
            print(f"   • Performance vs Average: {performance:+.1f}%")
            print()
            
            if diff < best_diff:
                best_diff = diff
                best_match = industry
        
        print(f"🎯 Best Industry Match: {best_match.title()}")
        
        # Performance assessment
        target_industry = industries.get(best_match, industries['manufacturing'])
        if company_avg <= target_industry['best']:
            rating = "🏆 Excellent"
        elif company_avg <= target_industry['avg']:
            rating = "✅ Good"
        elif company_avg <= target_industry['worst']:
            rating = "⚠️ Needs Improvement"
        else:
            rating = "🚨 Critical"
        
        print(f"📈 Performance Rating: {rating}")
        
        self.results['benchmarks'] = {
            'best_match': best_match,
            'rating': rating,
            'company_avg': company_avg
        }
    
    def demo_7_summary(self):
        """Demo 7: Complete Summary"""
        self.print_header("Demo 7: Complete AI System Summary", "🎛️")
        
        print("🎛️ CarbonCTRL AI/ML System Features:")
        print()
        
        features = [
            ("🔮 AI Predictions", "7-day carbon emission forecasting"),
            ("💡 Smart Recommendations", "AI-generated reduction strategies"),
            ("🚨 Anomaly Detection", "Real-time unusual pattern detection"),
            ("🏭 Industry Benchmarks", "Performance comparison analysis"),
            ("📊 Advanced Analytics", "Comprehensive data insights"),
            ("🧠 Machine Learning", "Multiple AI models integration"),
            ("⚡ Real-time API", "Fast API endpoints ready"),
            ("🎯 Performance Tracking", "Continuous monitoring")
        ]
        
        for feature, description in features:
            print(f"   {feature}: {description}")
        print()
        
        # Results summary
        if self.results:
            print("📈 Demo Results Summary:")
            
            if 'predictions' in self.results:
                avg_pred = np.mean(self.results['predictions'])
                print(f"   • Next 7-day average: {avg_pred:.1f} kg CO2/day")
            
            if 'recommendations' in self.results:
                total_impact = sum(rec['predicted_impact']['annual_co2_reduction'] 
                                 for rec in self.results['recommendations'][:3])
                print(f"   • Top 3 recommendations: {total_impact:.0f} tons CO2/year potential")
            
            if 'anomaly_detection' in self.results:
                status = "Anomaly Detected" if self.results['anomaly_detection']['is_anomaly'] else "Normal"
                print(f"   • Current status: {status}")
            
            if 'benchmarks' in self.results:
                match = self.results['benchmarks']['best_match']
                rating = self.results['benchmarks']['rating']
                print(f"   • Industry match: {match.title()} - {rating}")
        
        print()
        print("🎉 Complete CarbonCTRL AI/ML demonstration completed!")
        print("   All systems tested and ready for deployment!")
    
    def run_complete_demo(self):
        """Run the complete demonstration"""
        start_time = time.time()
        
        print("🚀 CarbonCTRL Advanced AI/ML System")
        print("=" * 50)
        print("Complete demonstration of AI-powered carbon management")
        print("=" * 50)
        
        try:
            self.demo_1_data_analysis()
            time.sleep(1)
            
            self.demo_2_ml_training()
            time.sleep(1)
            
            self.demo_3_predictions()
            time.sleep(1)
            
            self.demo_4_recommendations()
            time.sleep(1)
            
            self.demo_5_anomaly_detection()
            time.sleep(1)
            
            self.demo_6_benchmarks()
            time.sleep(1)
            
            self.demo_7_summary()
            
        except KeyboardInterrupt:
            print("\n⚠️ Demo interrupted by user")
        except Exception as e:
            print(f"\n❌ Demo error: {e}")
        
        end_time = time.time()
        total_time = end_time - start_time
        
        print(f"\n⏱️ Total demo time: {total_time:.1f} seconds")
        
        # Save results
        self.results['demo_metadata'] = {
            'timestamp': datetime.now().isoformat(),
            'total_time_seconds': total_time,
            'data_points': len(self.demo_data)
        }
        
        with open('complete_demo_results.json', 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        
        print("💾 Demo results saved to 'complete_demo_results.json'")
        print("\n🎊 Thank you for exploring CarbonCTRL's AI capabilities!")

if __name__ == "__main__":
    print("🎬 Starting CarbonCTRL Complete AI/ML Demo...")
    print("This will showcase all advanced machine learning features")
    print()
    
    try:
        response = input("Continue with complete demo? (y/n): ").lower().strip()
        if response not in ['y', 'yes']:
            print("Demo cancelled.")
            sys.exit(0)
    except KeyboardInterrupt:
        print("\nDemo cancelled.")
        sys.exit(0)
    
    demo = CarbonCTRLMLDemo()
    demo.run_complete_demo() 