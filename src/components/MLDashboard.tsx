import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { motion } from 'framer-motion';

interface MLDashboardProps {
  companyData?: {
    totalEmissions?: number;
    energyConsumption?: number;
    transportation?: number;
    wasteGeneration?: number;
    waterUsage?: number;
    employeeCount?: number;
    industry?: string;
  };
}

interface Recommendation {
  id: number;
  title: string;
  category: string;
  description: string;
  impact_level: string;
  cost_level: string;
  implementation_time: string;
  annual_savings: string;
  predicted_impact: {
    annual_co2_reduction: number;
    percentage_reduction: number;
  };
  priority: string;
  scores: {
    impact_score: number;
    feasibility_score: number;
    combined_score: number;
  };
}

interface PredictionData {
  predictions?: number[];
  dates?: string[];
  confidence?: number;
}

interface AnomalyData {
  is_anomaly: boolean;
  severity: string;
  confidence: number;
  individual_scores?: Record<string, number>;
}

interface BenchmarkData {
  benchmarks?: Record<string, {
    avg_emissions_per_employee?: number;
    best_practice?: number;
    worst_case?: number;
  }>;
  best_practice?: number;
  industry_average?: number;
}

const MLDashboard: React.FC<MLDashboardProps> = ({ companyData }) => {
  const [activeTab, setActiveTab] = useState('predictions');
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<PredictionData | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyData | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkData | null>(null);

  // Fetch AI Predictions
  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('carbonctrl_token');
      const response = await fetch('/api/ml/predictions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setPredictions(data);
      }
    } catch (error) {
      console.error('Error fetching predictions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch AI Recommendations
  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const sampleData = {
        total_emissions: companyData?.totalEmissions || 5000,
        energy_consumption: companyData?.energyConsumption || 2000,
        transportation: companyData?.transportation || 800,
        waste_generation: companyData?.wasteGeneration || 300,
        water_usage: companyData?.waterUsage || 1500,
        employee_count: companyData?.employeeCount || 150,
        industry: companyData?.industry || 'manufacturing',
        budget_level: 2,
        urgency_level: 3
      };

      const token = localStorage.getItem('carbonctrl_token');
      const response = await fetch('/api/ml/recommendations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(sampleData)
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  }, [companyData]);

  // Fetch Anomaly Detection
  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    try {
      const sampleData = {
        recent_data: [
          { date: '2024-01-01', total_emissions: 2200, energy_consumption: 1100 },
          { date: '2024-01-02', total_emissions: 2100, energy_consumption: 1050 },
          { date: '2024-01-03', total_emissions: 2300, energy_consumption: 1150 }
        ]
      };

      const token = localStorage.getItem('carbonctrl_token');
      const response = await fetch('/api/ml/anomaly-detection', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(sampleData)
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnomalies(data);
      }
    } catch (error) {
      console.error('Error fetching anomalies:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Industry Benchmarks
  const fetchBenchmarks = useCallback(async () => {
    setLoading(true);
    try {
      const industry = companyData?.industry || 'manufacturing';
      const token = localStorage.getItem('carbonctrl_token');
      const response = await fetch(`/api/ml/benchmarks/${industry}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBenchmarks(data);
      }
    } catch (error) {
      console.error('Error fetching benchmarks:', error);
    } finally {
      setLoading(false);
    }
  }, [companyData]);

  useEffect(() => {
    if (activeTab === 'predictions') fetchPredictions();
    else if (activeTab === 'recommendations') fetchRecommendations();
    else if (activeTab === 'anomalies') fetchAnomalies();
    else if (activeTab === 'benchmarks') fetchBenchmarks();
  }, [activeTab, companyData, fetchPredictions, fetchRecommendations, fetchAnomalies, fetchBenchmarks]);

  const tabs = [
    { id: 'predictions', label: 'Predictions', icon: '' },
    { id: 'recommendations', label: 'Recommendations', icon: '' },
    { id: 'anomalies', label: 'Anomaly Detection', icon: '' },
    { id: 'benchmarks', label: 'Industry Benchmarks', icon: '' }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'normal': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Prepare chart data for predictions
  const prepareChartData = (predictions: PredictionData) => {
    if (!predictions?.predictions || !predictions?.dates) return [];
    
    return predictions.dates.map((date: string, index: number) => ({
      date: new Date(date).toLocaleDateString(),
      prediction: predictions.predictions?.[index] || 0,
      confidence: predictions.confidence || 0.85
    }));
  };

  // Prepare benchmark chart data
  const prepareBenchmarkData = (benchmarks: BenchmarkData) => {
    if (!benchmarks?.benchmarks) return [];
    
    return Object.entries(benchmarks.benchmarks).map(([industry, data]) => ({
      industry: industry.charAt(0).toUpperCase() + industry.slice(1),
      average: data.avg_emissions_per_employee || 0,
      best: data.best_practice || 0,
      worst: data.worst_case || 0
    }));
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">ML Dashboard</h1>
        <p className="text-gray-600">Machine learning insights for carbon management</p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.icon ? <span className="mr-2">{tab.icon}</span> : null}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading AI insights...</p>
        </div>
      )}

      {/* Predictions Tab */}
      {activeTab === 'predictions' && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7-Day Carbon Emission Predictions</h2>
            
            {predictions ? (
              <div className="space-y-6">
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={prepareChartData(predictions)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                                             <Tooltip 
                         labelFormatter={(value) => `Date: ${value}`}
                         formatter={(value: number) => [`${value.toFixed(2)} kg CO2`, 'Predicted Emissions']}
                       />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="prediction" 
                        stroke="#2563eb" 
                        strokeWidth={3}
                        dot={{ fill: '#2563eb', strokeWidth: 2, r: 6 }}
                        name="Predicted Emissions"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-900">Average Prediction</h3>
                    <p className="text-2xl font-bold text-blue-600">
                      {predictions.predictions ? 
                        (predictions.predictions.reduce((a: number, b: number) => a + b, 0) / predictions.predictions.length).toFixed(1) 
                        : '0'} kg CO2
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-green-900">Model Confidence</h3>
                    <p className="text-2xl font-bold text-green-600">
                      {((predictions.confidence || 0.85) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-purple-900">Prediction Range</h3>
                    <p className="text-2xl font-bold text-purple-600">7 days</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No prediction data available. Click to load predictions.</p>
                <button 
                  onClick={fetchPredictions}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Load Predictions
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Recommendations</h2>
            
            {recommendations.length > 0 ? (
              <div className="grid gap-6">
                {recommendations.map((rec: Recommendation, index: number) => (
                  <div key={rec.id || index} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-xl font-semibold text-gray-900">{rec.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(rec.priority)}`}>
                        {rec.priority} Priority
                      </span>
                    </div>
                    
                    <p className="text-gray-600 mb-4">{rec.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-500">Impact</p>
                        <p className="font-semibold text-green-600">{rec.impact_level}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-500">Cost</p>
                        <p className="font-semibold text-blue-600">{rec.cost_level}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-500">Timeline</p>
                        <p className="font-semibold text-purple-600">{rec.implementation_time}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-500">CO2 Reduction</p>
                        <p className="font-semibold text-red-600">
                          {rec.predicted_impact?.annual_co2_reduction?.toFixed(1) || 'N/A'} tons/year
                        </p>
                      </div>
                    </div>
                    
                    {rec.scores && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">AI Confidence Scores</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Impact Score</p>
                            <p className="font-semibold">{(rec.scores.impact_score * 100).toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Feasibility</p>
                            <p className="font-semibold">{(rec.scores.feasibility_score * 100).toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Combined</p>
                            <p className="font-semibold">{(rec.scores.combined_score * 100).toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No recommendations available. Click to generate AI recommendations.</p>
                <button 
                  onClick={fetchRecommendations}
                  className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Generate Recommendations
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Anomaly Detection Tab */}
      {activeTab === 'anomalies' && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Anomaly Detection Results</h2>
            
            {anomalies ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={`p-4 rounded-lg border ${anomalies.is_anomaly ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <h3 className="font-semibold">Status</h3>
                    <p className={`text-2xl font-bold ${anomalies.is_anomaly ? 'text-red-600' : 'text-green-600'}`}>
                      {anomalies.is_anomaly ? 'Anomaly Detected' : 'Normal'}
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-blue-900">Confidence</h3>
                    <p className="text-2xl font-bold text-blue-600">
                      {((anomalies.confidence || 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  
                  <div className={`p-4 rounded-lg border ${getSeverityColor(anomalies.severity)}`}>
                    <h3 className="font-semibold">Severity</h3>
                    <p className="text-2xl font-bold">
                      {anomalies.severity || 'Normal'}
                    </p>
                  </div>
                </div>
                
                {anomalies.individual_scores && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Individual Algorithm Scores</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                             {Object.entries(anomalies.individual_scores).map(([algorithm, score]: [string, number]) => (
                        <div key={algorithm} className="text-center">
                          <p className="text-sm text-gray-500">{algorithm}</p>
                          <p className="font-semibold">{(score * 100).toFixed(1)}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No anomaly data available. Click to run anomaly detection.</p>
                <button 
                  onClick={fetchAnomalies}
                  className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Run Anomaly Detection
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Benchmarks Tab */}
      {activeTab === 'benchmarks' && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Industry Benchmarks</h2>
            
            {benchmarks ? (
              <div className="space-y-6">
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={prepareBenchmarkData(benchmarks)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="industry" />
                      <YAxis />
                                             <Tooltip 
                         formatter={(value: number) => [`${value.toFixed(2)} tons CO2`, 'Emissions per Employee']}
                       />
                      <Legend />
                      <Bar dataKey="average" fill="#3b82f6" name="Industry Average" />
                      <Bar dataKey="best" fill="#10b981" name="Best Practice" />
                      <Bar dataKey="worst" fill="#ef4444" name="Worst Case" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-900">Your Industry</h3>
                    <p className="text-lg font-bold text-blue-600">
                      {companyData?.industry || 'Manufacturing'}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-green-900">Best Practice</h3>
                    <p className="text-lg font-bold text-green-600">
                      {benchmarks.best_practice || 'N/A'} tons CO2/employee
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-purple-900">Industry Average</h3>
                    <p className="text-lg font-bold text-purple-600">
                      {benchmarks.industry_average || 'N/A'} tons CO2/employee
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No benchmark data available. Click to load industry benchmarks.</p>
                <button 
                  onClick={fetchBenchmarks}
                  className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Load Benchmarks
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default MLDashboard; 