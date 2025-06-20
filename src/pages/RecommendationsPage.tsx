import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Leaf, ArrowRight, Star, AlertTriangle, Clock, DollarSign, Percent, Info, RefreshCw, TrendingUp, Target, Zap } from 'lucide-react';
import { useCarbonStore } from '../store/carbonStore';
import { useCompanyStore } from '../store/companyStore';
import { apiClient } from '../lib/api';

interface Recommendation {
  title: string;
  description: string;
  impact: number;
  timeline: string;
  cost: string;
  roi_months?: number;
  priority?: string;
  industry_specific?: string;
  // Legacy fields for backward compatibility
  action?: string;
  savings?: string;
  incentives?: string;
  tax_benefits?: string;
  reasoning?: string;
}

interface RecommendationSummary {
  total_potential_reduction: number;
  quick_wins_count: number;
  strategic_initiatives_count: number;
  estimated_total_investment: string;
  payback_period: string;
}

interface RecommendationResponse {
  recommendations: Recommendation[];
  summary?: RecommendationSummary;
}

const RecommendationsPage = () => {
  const { carbonScore } = useCarbonStore();
  const { profile } = useCompanyStore();
  const [recommendationData, setRecommendationData] = useState<RecommendationResponse>({ recommendations: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [showSectorSelection, setShowSectorSelection] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState<{ gemini_working: boolean; model?: string; error?: string; test_response?: Record<string, unknown>; raw_response?: string; configured: boolean } | null>(null);

  useEffect(() => {
    // Initialize with top 3 sectors by default
    if (carbonScore && carbonScore.emissions_breakdown) {
      const topSectors = Object.entries(carbonScore.emissions_breakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([sector]) => sector);
      
      setSelectedSectors(topSectors);
    }
  }, [carbonScore]);

  const testGeminiConnection = async () => {
    setTestingGemini(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://carbonctrl.onrender.com/api'}/gemini/test`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('carbonctrl_token')}`
        }
      });
      const result = await response.json();
      setGeminiStatus(result);
    } catch {
      setGeminiStatus({ error: 'Failed to test connection', gemini_working: false, configured: true });
    } finally {
      setTestingGemini(false);
    }
  };

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!carbonScore || selectedSectors.length === 0) return;

      setLoading(true);
      setError(null);

      try {
        console.log('Fetching recommendations with enhanced data...');
        // Use backend API for recommendations
        const result = await apiClient.getRecommendations({
          industry: profile?.industry || 'Technology',
          emissions_data: {
            total_emissions_tons_co2e: carbonScore.total_emissions_tons_co2e,
            carbon_rating: carbonScore.carbon_rating,
            breakdown: carbonScore.emissions_breakdown,
          },
          selected_sectors: selectedSectors
        });

        console.log('Received recommendations:', result);
        setRecommendationData(result);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(errorMessage);
        console.error('Error fetching recommendations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [carbonScore, profile, selectedSectors]);

  const handleSectorToggle = (sector: string) => {
    setSelectedSectors(prev => {
      if (prev.includes(sector)) {
        return prev.filter(s => s !== sector);
      } else {
        return [...prev, sector];
      }
    });
  };

  const regenerateRecommendations = () => {
    // This will trigger the useEffect to regenerate recommendations
    setLoading(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'text-red-400 bg-red-400/20';
      case 'medium': return 'text-yellow-400 bg-yellow-400/20';
      case 'low': return 'text-green-400 bg-green-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  const getCostIcon = (cost: string) => {
    switch (cost?.toLowerCase()) {
      case 'low': return <DollarSign className="w-4 h-4 text-green-400" />;
      case 'medium': return <DollarSign className="w-4 h-4 text-yellow-400" />;
      case 'high': return <DollarSign className="w-4 h-4 text-red-400" />;
      default: return <DollarSign className="w-4 h-4 text-gray-400" />;
    }
  };

  if (!carbonScore) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-space text-4xl font-bold text-white mb-2">Smart Recommendations</h1>
          <p className="font-mono text-emerald-100/80">AI-powered suggestions to reduce your carbon footprint</p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="feature-card p-8 text-center"
        >
          <AlertTriangle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="font-space text-xl font-bold text-white mb-2">No Data Available</h2>
          <p className="font-mono text-emerald-100/70 mb-6">
            Please complete your carbon assessment first to receive personalized recommendations.
          </p>
          <a
            href="/dashboard"
            className="glass-button px-6 py-3 rounded-lg inline-flex items-center gap-2 group"
          >
            <span className="font-mono">Start Assessment</span>
            <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-space text-4xl font-bold text-white mb-2">Smart Recommendations</h1>
          <p className="font-mono text-emerald-100/80">AI-powered suggestions powered by Gemini 2.5 Flash</p>
        </div>
        <button
          onClick={testGeminiConnection}
          disabled={testingGemini}
          className="glass-button px-4 py-2 rounded-lg inline-flex items-center gap-2 group"
        >
          <Zap className="w-4 h-4" />
          <span className="font-mono text-sm">
            {testingGemini ? 'Testing...' : 'Test AI'}
          </span>
        </button>
      </div>

      {/* Gemini Status */}
      {geminiStatus && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-lg border ${
            geminiStatus.gemini_working 
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {geminiStatus.gemini_working ? (
              <Star className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="font-mono text-sm">
              {geminiStatus.gemini_working 
                ? `Gemini AI connected successfully (${geminiStatus.model})`
                : `Gemini AI connection failed: ${geminiStatus.error}`
              }
            </span>
          </div>
        </motion.div>
      )}

      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="feature-card p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500/20 p-4 rounded-lg">
              <Leaf className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-space text-xl font-semibold text-white">Current Status</h2>
              <p className="font-mono text-sm text-emerald-100/70">
                Based on your carbon assessment results for {profile?.name || 'your company'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSectorSelection(!showSectorSelection)}
            className="glass-button px-4 py-2 rounded-lg inline-flex items-center gap-2 group"
          >
            <span className="font-mono text-sm">{showSectorSelection ? 'Hide Sectors' : 'Select Sectors'}</span>
          </button>
        </div>

        {/* Status metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="p-4 bg-gray-800/50 rounded-lg border border-emerald-500/20">
            <p className="font-mono text-sm text-emerald-100/70 mb-2">Carbon Rating</p>
            <div className="flex items-baseline gap-2">
              <span className="font-space text-3xl font-bold text-white">
                {carbonScore.carbon_rating}
              </span>
              <span className="font-mono text-sm text-emerald-400">Grade</span>
            </div>
          </div>

          <div className="p-4 bg-gray-800/50 rounded-lg border border-emerald-500/20">
            <p className="font-mono text-sm text-emerald-100/70 mb-2">Total Emissions</p>
            <div className="flex items-baseline gap-2">
              <span className="font-space text-3xl font-bold text-white">
                {carbonScore.total_emissions_tons_co2e.toFixed(1)}
              </span>
              <span className="font-mono text-sm text-emerald-400">tCO₂e</span>
            </div>
          </div>

          {recommendationData.summary && (
            <>
              <div className="p-4 bg-gray-800/50 rounded-lg border border-emerald-500/20">
                <p className="font-mono text-sm text-emerald-100/70 mb-2">Potential Reduction</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-space text-3xl font-bold text-white">
                    {recommendationData.summary.total_potential_reduction.toFixed(1)}
                  </span>
                  <span className="font-mono text-sm text-emerald-400">tCO₂e</span>
                </div>
              </div>

              <div className="p-4 bg-gray-800/50 rounded-lg border border-emerald-500/20">
                <p className="font-mono text-sm text-emerald-100/70 mb-2">Quick Wins</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-space text-3xl font-bold text-white">
                    {recommendationData.summary.quick_wins_count}
                  </span>
                  <span className="font-mono text-sm text-emerald-400">Actions</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Enhanced Summary */}
        {recommendationData.summary && (
          <div className="p-4 bg-gray-800/30 rounded-lg border border-emerald-500/10 mb-6">
            <h3 className="font-space text-lg font-semibold text-white mb-3">AI Analysis Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-mono text-emerald-100/70">Investment Level: </span>
                <span className="font-mono text-white">{recommendationData.summary.estimated_total_investment}</span>
              </div>
              <div>
                <span className="font-mono text-emerald-100/70">Payback Period: </span>
                <span className="font-mono text-white">{recommendationData.summary.payback_period}</span>
              </div>
              <div>
                <span className="font-mono text-emerald-100/70">Strategic Initiatives: </span>
                <span className="font-mono text-white">{recommendationData.summary.strategic_initiatives_count}</span>
              </div>
              <div>
                <span className="font-mono text-emerald-100/70">Potential Impact: </span>
                <span className="font-mono text-white">
                  {((recommendationData.summary.total_potential_reduction / carbonScore.total_emissions_tons_co2e) * 100).toFixed(1)}% reduction
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Sector selection */}
        {showSectorSelection && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-emerald-500/20"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-space text-lg font-semibold text-white">Select Sectors for Recommendations</h3>
              <button
                onClick={regenerateRecommendations}
                disabled={loading || selectedSectors.length === 0}
                className="glass-button px-4 py-2 rounded-lg inline-flex items-center gap-2 group disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="font-mono text-sm">Regenerate</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.keys(carbonScore.emissions_breakdown).map((sector) => {
                const isSelected = selectedSectors.includes(sector);
                const emissions = carbonScore.emissions_breakdown[sector];
                const percentage = ((emissions / carbonScore.total_emissions_tons_co2e) * 100).toFixed(1);
                
                return (
                  <button
                    key={sector}
                    onClick={() => handleSectorToggle(sector)}
                    className={`p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:border-emerald-500/50'
                    }`}
                  >
                    <div className="text-sm font-mono font-semibold">{sector}</div>
                    <div className="text-xs opacity-70">
                      {emissions.toFixed(1)} tCO₂e ({percentage}%)
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Loading State */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="feature-card p-8 text-center"
        >
          <div className="animate-spin w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="font-mono text-emerald-100/70">Generating personalized recommendations with AI...</p>
        </motion.div>
      )}

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="feature-card p-6 border-red-500/20 bg-red-500/10"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <div>
              <h3 className="font-space text-lg font-semibold text-red-400">Error Loading Recommendations</h3>
              <p className="font-mono text-sm text-red-100/70">{error}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recommendations Grid */}
      {!loading && recommendationData.recommendations.length > 0 && (
        <div className="grid gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-space text-2xl font-bold text-white">
              Personalized Recommendations ({recommendationData.recommendations.length})
            </h2>
            {recommendationData.summary && (
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-emerald-100/70">
                  Up to {((recommendationData.summary.total_potential_reduction / carbonScore.total_emissions_tons_co2e) * 100).toFixed(0)}% reduction possible
                </span>
              </div>
            )}
          </div>

          {recommendationData.recommendations.map((rec, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="feature-card p-6 hover:border-emerald-500/30 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-space text-xl font-semibold text-white">
                      {rec.title || rec.action}
                    </h3>
                    {rec.priority && (
                      <span className={`px-2 py-1 rounded-full text-xs font-mono ${getPriorityColor(rec.priority)}`}>
                        {rec.priority}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-emerald-100/80 leading-relaxed mb-4">
                    {rec.description}
                  </p>
                  
                  {rec.industry_specific && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="w-4 h-4 text-blue-400" />
                        <span className="font-mono text-sm font-semibold text-blue-400">Industry Insight</span>
                      </div>
                      <p className="font-mono text-sm text-blue-100/80">{rec.industry_specific}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="font-mono text-xs text-emerald-100/60">Impact</p>
                    <p className="font-mono text-sm font-semibold text-white">
                      {typeof rec.impact === 'string' ? rec.impact : `${rec.impact.toFixed(1)} tCO₂e`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="font-mono text-xs text-emerald-100/60">Timeline</p>
                    <p className="font-mono text-sm font-semibold text-white">{rec.timeline}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getCostIcon(rec.cost)}
                  <div>
                    <p className="font-mono text-xs text-emerald-100/60">Investment</p>
                    <p className="font-mono text-sm font-semibold text-white">{rec.cost}</p>
                  </div>
                </div>

                {rec.roi_months && (
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-yellow-400" />
                    <div>
                      <p className="font-mono text-xs text-emerald-100/60">ROI</p>
                      <p className="font-mono text-sm font-semibold text-white">{rec.roi_months} months</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Legacy fields support */}
              {(rec.savings || rec.incentives || rec.tax_benefits) && (
                <div className="mt-4 pt-4 border-t border-emerald-500/20">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    {rec.savings && (
                      <div>
                        <span className="font-mono text-emerald-100/70">Savings: </span>
                        <span className="font-mono text-white">{rec.savings}</span>
                      </div>
                    )}
                    {rec.incentives && (
                      <div>
                        <span className="font-mono text-emerald-100/70">Incentives: </span>
                        <span className="font-mono text-white">{rec.incentives}</span>
                      </div>
                    )}
                    {rec.tax_benefits && (
                      <div>
                        <span className="font-mono text-emerald-100/70">Tax Benefits: </span>
                        <span className="font-mono text-white">{rec.tax_benefits}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* No recommendations state */}
      {!loading && recommendationData.recommendations.length === 0 && !error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="feature-card p-8 text-center"
        >
          <Info className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <h2 className="font-space text-xl font-bold text-white mb-2">No Recommendations Available</h2>
          <p className="font-mono text-emerald-100/70 mb-6">
            Please select at least one sector to receive personalized recommendations.
          </p>
          <button
            onClick={() => setShowSectorSelection(true)}
            className="glass-button px-6 py-3 rounded-lg inline-flex items-center gap-2 group"
          >
            <span className="font-mono">Select Sectors</span>
            <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default RecommendationsPage;