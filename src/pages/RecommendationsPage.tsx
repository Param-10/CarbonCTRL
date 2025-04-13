import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Leaf, ArrowRight, Star, AlertTriangle, Clock, DollarSign, Percent, Award } from 'lucide-react';
import { useCarbonStore } from '../store/carbonStore';
import { useCompanyStore } from '../store/companyStore';
import { generateRecommendations } from '../lib/gemini';

interface Recommendation {
  action: string;
  impact: string;
  timeline: string;
  savings: string;
  incentives: string;
  tax_benefits: string;
}

const RecommendationsPage = () => {
  const { carbonScore } = useCarbonStore();
  const { profile } = useCompanyStore();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!carbonScore) return;

      setLoading(true);
      setError(null);

      try {
        // Use direct Gemini integration instead of Supabase functions
        const result = await generateRecommendations(
          profile?.industry || 'Technology',
          {
            total_emissions: carbonScore.total_emissions_tons_co2e,
            breakdown: carbonScore.emissions_breakdown,
            grade: carbonScore.carbon_rating,
          }
        );

        setRecommendations(result.recommendations);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(errorMessage);
        console.error('Error fetching recommendations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [carbonScore, profile]);

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
            className="bg-emerald-800/90 px-6 py-3 rounded-lg inline-flex items-center gap-2 group hover:bg-emerald-700/90 border border-emerald-600/30 transition-all duration-300 font-mono text-emerald-300"
          >
            <span>Start Assessment</span>
            <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-space text-4xl font-bold text-white mb-2">Smart Recommendations</h1>
        <p className="font-mono text-emerald-100/80">AI-powered suggestions to reduce your carbon footprint</p>
      </div>

      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="feature-card p-8"
      >
        <div className="flex items-center gap-4 mb-6">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

          <div className="p-4 bg-gray-800/50 rounded-lg border border-emerald-500/20">
            <p className="font-mono text-sm text-emerald-100/70 mb-2">Status</p>
            <div className="flex items-baseline gap-2">
              <span className="font-space text-3xl font-bold text-white">
                {carbonScore.rating_description.split(' ')[0]}
              </span>
              <span className="font-mono text-sm text-emerald-400">Performance</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Recommendations */}
      <div className="space-y-6">
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-mono text-emerald-100/70">Generating AI recommendations...</p>
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="feature-card p-6 text-center"
          >
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="font-mono text-red-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-2 px-4 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </motion.div>
        ) : (
          recommendations.map((recommendation, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="feature-card group cursor-pointer"
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-emerald-500/20 p-4 rounded-lg group-hover:bg-emerald-500/30 transition-colors">
                    <Star className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="font-space text-xl font-semibold text-white">
                    {recommendation.action}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  <div className="flex items-center gap-3">
                    <Percent className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="font-mono text-sm text-emerald-100/70">Impact</p>
                      <p className="font-mono text-white">{recommendation.impact}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="font-mono text-sm text-emerald-100/70">Timeline</p>
                      <p className="font-mono text-white">{recommendation.timeline}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="font-mono text-sm text-emerald-100/70">Potential Savings</p>
                      <p className="font-mono text-white">{recommendation.savings}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Award className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="font-mono text-sm text-emerald-100/70">Tax Benefits</p>
                      <p className="font-mono text-white">{recommendation.tax_benefits}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecommendationsPage;