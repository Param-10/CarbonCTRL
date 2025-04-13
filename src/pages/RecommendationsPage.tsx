import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Leaf, ArrowRight, Star, AlertTriangle, Clock, DollarSign, Percent, Award } from 'lucide-react';
import { useCarbonStore } from '../store/carbonStore';

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
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!carbonScore) return;

      setLoading(true);
      setError(null);

      try {
        // Call the Gemini-powered edge function
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/carbon-recommendations`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              industry: 'Technology', // This should come from company profile
              emissions_data: {
                total_emissions: carbonScore.total_emissions_tons_co2e,
                breakdown: carbonScore.emissions_breakdown,
                grade: carbonScore.carbon_rating,
              },
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch recommendations');
        }

        setRecommendations(data.recommendations);
      } catch (err: any) {
        setError(err.message);
        console.error('Error fetching recommendations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [carbonScore]);

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
              Based on your carbon assessment results
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
            <p className="font-mono text-emerald-100/70">Generating recommendations...</p>
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="feature-card p-6 text-center"
          >
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="font-mono text-red-400">{error}</p>
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