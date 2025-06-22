"""
Comprehensive ML API Integration Test
Tests all machine learning endpoints and functionality
"""

import requests
import json
import time
import sys
from datetime import datetime

# API Base URL
BASE_URL = "http://localhost:5000/api/ml"

class MLAPITester:
    """Comprehensive API tester for ML endpoints"""
    
    def __init__(self, base_url=BASE_URL):
        self.base_url = base_url
        self.test_results = {}
        
    def log(self, message, test_name=None):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        if test_name:
            print(f"[{timestamp}] 🧪 {test_name}: {message}")
        else:
            print(f"[{timestamp}] {message}")
    
    def test_model_status(self):
        """Test model status endpoint"""
        test_name = "Model Status"
        self.log("Checking model status...", test_name)
        
        try:
            response = requests.get(f"{self.base_url}/model-status", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Models loaded: {data.get('models_loaded', False)}", test_name)
                self.test_results[test_name] = {'status': 'PASS', 'response': data}
                return True
            else:
                self.log(f"❌ Failed with status {response.status_code}", test_name)
                self.test_results[test_name] = {'status': 'FAIL', 'error': f"HTTP {response.status_code}"}
                return False
                
        except Exception as e:
            self.log(f"❌ Exception: {str(e)}", test_name)
            self.test_results[test_name] = {'status': 'ERROR', 'error': str(e)}
            return False
    
    def test_recommendations(self):
        """Test AI recommendations endpoint"""
        test_name = "AI Recommendations"
        self.log("Testing recommendations endpoint...", test_name)
        
        test_data = {
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
        
        try:
            response = requests.post(
                f"{self.base_url}/recommendations",
                json=test_data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'recommendations' in data and len(data['recommendations']) > 0:
                    rec_count = len(data['recommendations'])
                    self.log(f"✅ Generated {rec_count} recommendations", test_name)
                    
                    first_rec = data['recommendations'][0]
                    self.log(f"📋 Top: {first_rec.get('title', 'N/A')}", test_name)
                    impact = first_rec.get('predicted_impact', {}).get('annual_co2_reduction', 'N/A')
                    self.log(f"💡 Impact: {impact} tons CO2/year", test_name)
                    
                    self.test_results[test_name] = {'status': 'PASS', 'count': rec_count}
                    return True
                else:
                    self.log(f"❌ No recommendations generated", test_name)
                    self.test_results[test_name] = {'status': 'FAIL', 'error': "No recommendations"}
                    return False
            else:
                self.log(f"❌ Failed with status {response.status_code}", test_name)
                self.test_results[test_name] = {'status': 'FAIL', 'error': f"HTTP {response.status_code}"}
                return False
                
        except Exception as e:
            self.log(f"❌ Exception: {str(e)}", test_name)
            self.test_results[test_name] = {'status': 'ERROR', 'error': str(e)}
            return False
    
    def test_anomaly_detection(self):
        """Test anomaly detection endpoint"""
        test_name = "Anomaly Detection"
        self.log("Testing anomaly detection...", test_name)
        
        test_data = {
            'recent_data': [
                {'date': '2024-01-01', 'total_emissions': 2200, 'energy_consumption': 1100},
                {'date': '2024-01-02', 'total_emissions': 2100, 'energy_consumption': 1050},
                {'date': '2024-01-03', 'total_emissions': 5000, 'energy_consumption': 2500}  # Anomaly
            ]
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/anomaly-detection",
                json=test_data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if 'is_anomaly' in data:
                    anomaly_status = data.get('is_anomaly', False)
                    severity = data.get('severity', 'Unknown')
                    confidence = data.get('confidence', 0)
                    
                    self.log(f"✅ Detection completed", test_name)
                    self.log(f"🚨 Anomaly: {anomaly_status}, Severity: {severity}", test_name)
                    
                    self.test_results[test_name] = {'status': 'PASS', 'anomaly_detected': anomaly_status}
                    return True
                else:
                    self.log(f"❌ Invalid response", test_name)
                    self.test_results[test_name] = {'status': 'FAIL', 'error': "Invalid response"}
                    return False
            else:
                self.log(f"❌ Failed with status {response.status_code}", test_name)
                self.test_results[test_name] = {'status': 'FAIL', 'error': f"HTTP {response.status_code}"}
                return False
                
        except Exception as e:
            self.log(f"❌ Exception: {str(e)}", test_name)
            self.test_results[test_name] = {'status': 'ERROR', 'error': str(e)}
            return False
    
    def test_benchmarks(self):
        """Test industry benchmarks endpoint"""
        test_name = "Industry Benchmarks"
        self.log("Testing benchmarks...", test_name)
        
        try:
            response = requests.get(f"{self.base_url}/benchmarks/manufacturing", timeout=20)
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Benchmarks retrieved", test_name)
                self.test_results[test_name] = {'status': 'PASS'}
                return True
            else:
                self.log(f"❌ Failed with status {response.status_code}", test_name)
                self.test_results[test_name] = {'status': 'FAIL', 'error': f"HTTP {response.status_code}"}
                return False
                
        except Exception as e:
            self.log(f"❌ Exception: {str(e)}", test_name)
            self.test_results[test_name] = {'status': 'ERROR', 'error': str(e)}
            return False
    
    def run_all_tests(self):
        """Run comprehensive test suite"""
        self.log("🚀 Starting ML API Test Suite")
        self.log("=" * 50)
        
        start_time = time.time()
        tests_passed = 0
        total_tests = 4
        
        test_functions = [
            self.test_model_status,
            self.test_recommendations,
            self.test_anomaly_detection,
            self.test_benchmarks
        ]
        
        for test_func in test_functions:
            try:
                if test_func():
                    tests_passed += 1
                time.sleep(1)
            except Exception as e:
                self.log(f"❌ Test {test_func.__name__} crashed: {str(e)}")
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Summary
        self.log("=" * 50)
        self.log("📊 TEST SUMMARY")
        self.log(f"✅ Passed: {tests_passed}/{total_tests}")
        self.log(f"⏱️ Time: {total_time:.2f}s")
        self.log(f"🎯 Success: {(tests_passed/total_tests)*100:.1f}%")
        
        # Detailed results
        for test_name, result in self.test_results.items():
            status_emoji = "✅" if result['status'] == 'PASS' else "❌"
            self.log(f"{status_emoji} {test_name}: {result['status']}")
        
        # Save results
        with open('ml_test_results.json', 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'summary': {
                    'tests_passed': tests_passed,
                    'total_tests': total_tests,
                    'success_rate': (tests_passed/total_tests)*100,
                    'total_time_seconds': total_time
                },
                'results': self.test_results
            }, f, indent=2)
        
        self.log("💾 Results saved to ml_test_results.json")
        
        if tests_passed == total_tests:
            self.log("🎉 ALL TESTS PASSED! ML API is functional!")
            return True
        else:
            self.log(f"⚠️ {total_tests - tests_passed} tests failed.")
            return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
        tester = MLAPITester(base_url)
    else:
        tester = MLAPITester()
    
    success = tester.run_all_tests()
    sys.exit(0 if success else 1) 