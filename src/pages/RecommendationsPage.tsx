import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, ArrowRight, AlertTriangle, Clock, DollarSign, Percent, RefreshCw, TrendingUp, Target, Zap, Info, ListPlus, Check } from 'lucide-react';
import { useCarbonStore } from '../store/carbonStore';
import { useCompanyStore, CompanyProfile } from '../store/companyStore';
import { apiClient } from '../lib/api';
import { sectorLabel } from '../lib/sectorColors';
import { useActionStore } from '../store/actionStore';

// While a background refresh runs, check for the new results this often, for up to 3 minutes
const REFRESH_POLL_MS = 15000;
const REFRESH_POLL_LIMIT = 12;

// Profile fields Gemini uses to tailor recommendations, in the order they
// appear on the Company Profile page.
const CONTEXT_FIELD_LABELS: [keyof CompanyProfile, string][] = [
  ['state', 'state'],
  ['reductionBudget', 'budget'],
  ['reductionTargetPercent', 'reduction target'],
  ['premisesOwnership', 'premises'],
  ['siteCount', 'number of sites'],
  ['workModel', 'work model'],
  ['renewableElectricityShare', 'renewable electricity'],
  ['fleetSize', 'company vehicles'],
  ['existingMeasures', 'measures already in place'],
  ['reportingObligations', 'reporting obligations'],
];

const missingContextFields = (profile: CompanyProfile | null) =>
  CONTEXT_FIELD_LABELS
    .filter(([field]) => profile?.[field] === null || profile?.[field] === undefined)
    .map(([, label]) => label);

interface Recommendation {
  title: string;
  description: string;
  impact: number;
  sector?: string | null;
  timeline: string;
  timeline_months?: number | null;
  cost: string;
  roi_months?: number;
  priority?: string;
  industry_specific?: string;
}

interface RecommendationSummary {
  total_potential_reduction: number;
  quick_wins_count: number;
  strategic_initiatives_count: number;
  estimated_total_investment: string;
  payback_period: string;
  source?: string;
}

interface RecommendationResponse {
  recommendations: Recommendation[];
  summary?: RecommendationSummary;
  /** Set when Gemini failed and standard recommendations were returned. */
  notice?: string;
  /** Present on saved Gemini results */
  generated_at?: string;
  is_outdated?: boolean;
  /** A background refresh is queued or running on the server */
  refreshing?: boolean;
  selected_sectors?: string[];
}

const GENERATED_AT_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const RecommendationsPage = () => {
  const { carbonScore } = useCarbonStore();
  const { profile } = useCompanyStore();
  const [recommendationData, setRecommendationData] = useState<RecommendationResponse>({ recommendations: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [showSectorSelection, setShowSectorSelection] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const { actions, load: loadActions, add: addAction } = useActionStore();
  const [addingTitle, setAddingTitle] = useState<string | null>(null);
  const [planError, setPlanError] = useState('');

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const inPlan = new Set(actions.map((a) => a.title.toLowerCase()));

  const addToPlan = async (rec: Recommendation) => {
    setAddingTitle(rec.title);
    setPlanError('');
    try {
      await addAction({
        title: rec.title,
        description: rec.description,
        sector: rec.sector ?? null,
        impact: typeof rec.impact === 'number' ? rec.impact : undefined,
        cost: rec.cost,
        timeline: rec.timeline,
        priority: rec.priority,
      });
    } catch (err) {
      setPlanError(err instanceof Error && err.message ? err.message : 'Could not add to your plan');
    } finally {
      setAddingTitle(null);
    }
  };

  // Show the last saved recommendations straight away, without a new Gemini call
  useEffect(() => {
    let cancelled = false;
    apiClient
      .getLatestRecommendations()
      .then(({ saved }: { saved: RecommendationResponse | null }) => {
        if (cancelled || !saved) return;
        setRecommendationData(saved);
        if (saved.selected_sectors?.length) setSelectedSectors(saved.selected_sectors);
      })
      .catch((err: unknown) => console.error('Error loading saved recommendations:', err))
      .finally(() => {
        if (!cancelled) setLoadingSaved(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // When the server is already refreshing outdated results, pick them up when ready
  const waitingForRefresh = Boolean(recommendationData.is_outdated && recommendationData.refreshing);
  useEffect(() => {
    if (!waitingForRefresh) return;
    let polls = 0;
    const timer = setInterval(async () => {
      polls += 1;
      try {
        const { saved } = await apiClient.getLatestRecommendations();
        if (saved && (!saved.is_outdated || !saved.refreshing)) setRecommendationData(saved);
      } catch (err) {
        console.error('Error checking for refreshed recommendations:', err);
      }
      if (polls >= REFRESH_POLL_LIMIT) clearInterval(timer);
    }, REFRESH_POLL_MS);
    return () => clearInterval(timer);
  }, [waitingForRefresh]);

  useEffect(() => {
    // Default to the top 3 sectors unless a saved selection was restored
    if (carbonScore && carbonScore.emissions_breakdown) {
      const topSectors = Object.entries(carbonScore.emissions_breakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([sector]) => sector);

      setSelectedSectors((current) => (current.length > 0 ? current : topSectors));
    }
  }, [carbonScore]);

  const fetchRecommendations = async () => {
    if (!carbonScore || selectedSectors.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Fetching recommendations with enhanced data...');
      // Use backend API for recommendations
      const result = await apiClient.getRecommendations({
        industry: profile?.industry,
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
    fetchRecommendations();
  };

  // Share of total emissions, or null when there is nothing to divide by
  const percentOfTotal = (tonnes: number) =>
    carbonScore && carbonScore.total_emissions_tons_co2e > 0
      ? (tonnes / carbonScore.total_emissions_tons_co2e) * 100
      : null;

  const missingContext = missingContextFields(profile);

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
          <h1 className="font-space text-3xl sm:text-4xl font-bold text-white mb-2">Smart Recommendations</h1>
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
            Record at least one activity on the Dashboard to get personalized recommendations.
          </p>
          <Link
            to="/dashboard"
            className="glass-button px-6 py-3 rounded-lg inline-flex items-center gap-2 group"
          >
            <span className="font-mono">Add Your First Activity</span>
            <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-space text-3xl sm:text-4xl font-bold text-white mb-2">Recommendations</h1>
          <p className="font-mono text-emerald-100/80">AI-generated suggestions tailored to your company profile</p>
        </div>
      </div>

      {/* When the shown recommendations were made, and whether they still fit the data */}
      {recommendationData.generated_at && !loading && (
        <div
          role={recommendationData.is_outdated ? 'status' : undefined}
          className={`p-4 rounded-lg border flex flex-wrap items-center justify-between gap-3 ${
            recommendationData.is_outdated
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              : 'bg-gray-800/40 border-emerald-500/10 text-emerald-100/70'
          }`}
        >
          <span className="font-mono text-sm">
            {!recommendationData.is_outdated
              ? `Generated ${GENERATED_AT_FORMAT.format(new Date(recommendationData.generated_at))}`
              : recommendationData.refreshing
                ? 'Your data changed, so these are being updated in the background. New recommendations will appear here shortly.'
                : 'Your activities or company profile changed since these recommendations were generated.'}
          </span>
          {recommendationData.is_outdated && (
            <button
              onClick={fetchRecommendations}
              disabled={selectedSectors.length === 0}
              className="glass-button px-4 py-2 rounded-lg inline-flex items-center gap-2 font-mono text-sm disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              {recommendationData.refreshing ? 'Update now' : 'Update recommendations'}
            </button>
          )}
        </div>
      )}

      {/* Nudge to complete the profile context Gemini relies on */}
      {missingContext.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg border bg-blue-500/10 border-blue-500/20 flex items-start gap-3"
        >
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="font-mono text-sm text-blue-100/80">
            <p>
              Recommendations are more specific when your profile includes: {missingContext.join(', ')}.
            </p>
            <Link to="/company-profile" className="inline-flex items-center gap-1 mt-2 text-blue-300 hover:text-blue-200">
              Complete company profile
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      )}

      {planError && (
        <div role="alert" className="p-4 rounded-lg border bg-red-500/10 border-red-500/30 text-red-200 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="font-mono text-sm">{planError}</span>
        </div>
      )}

      {/* Shown when Gemini failed and standard recommendations were returned */}
      {recommendationData.notice && (
        <div role="status" className="p-4 rounded-lg border bg-amber-500/10 border-amber-500/20 text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="font-mono text-sm">{recommendationData.notice}</span>
        </div>
      )}

      {/* Summary Card with Source Tracking */}
      {recommendationData.summary && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-6 rounded-xl"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-space text-xl font-bold text-white">Impact Summary</h2>
            {recommendationData.summary.source && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="font-mono text-xs text-emerald-100/60">
                  {recommendationData.summary.source}
                </span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="font-space text-2xl font-bold text-emerald-400">
                {recommendationData.summary.total_potential_reduction?.toFixed(1) || '0'}
              </div>
              <div className="font-mono text-xs text-emerald-100/60">tonnes CO₂e</div>
            </div>
            <div className="text-center">
              <div className="font-space text-2xl font-bold text-blue-400">
                {recommendationData.summary.quick_wins_count || 0}
              </div>
              <div className="font-mono text-xs text-emerald-100/60">quick wins</div>
            </div>
            <div className="text-center">
              <div className="font-space text-2xl font-bold text-purple-400">
                {recommendationData.summary.strategic_initiatives_count || 0}
              </div>
              <div className="font-mono text-xs text-emerald-100/60">strategic</div>
            </div>
            <div className="text-center">
              <div className="font-space text-xl font-bold text-amber-400">
                {recommendationData.summary.payback_period || 'N/A'}
              </div>
              <div className="font-mono text-xs text-emerald-100/60">payback</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="feature-card p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4 min-w-0 flex-1 basis-64">
            <div className="bg-emerald-500/20 p-4 rounded-lg flex-shrink-0">
              <Leaf className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 className="font-space text-xl font-semibold text-white">Current Status</h2>
              <p className="font-mono text-sm text-emerald-100/70">
                Based on your carbon assessment results for {profile?.name || 'your company'}
                {carbonScore.period && ` · activities from ${carbonScore.period.start} to ${carbonScore.period.end}`}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                  {percentOfTotal(recommendationData.summary.total_potential_reduction)?.toFixed(1) ?? '0.0'}% reduction
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.keys(carbonScore.emissions_breakdown).map((sector) => {
                const isSelected = selectedSectors.includes(sector);
                const emissions = carbonScore.emissions_breakdown[sector];
                const percentage = (percentOfTotal(emissions) ?? 0).toFixed(1);
                
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
                    <div className="text-sm font-mono font-semibold">{sectorLabel(sector)}</div>
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
          <p className="font-mono text-xs text-emerald-100/50 mt-2">Gemini weighs your data, budget and premises carefully, so this can take up to a minute.</p>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-space text-2xl font-bold text-white">
              Personalized Recommendations ({recommendationData.recommendations.length})
            </h2>
            {recommendationData.summary && percentOfTotal(recommendationData.summary.total_potential_reduction) !== null && (
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-emerald-100/70">
                  Up to {percentOfTotal(recommendationData.summary.total_potential_reduction)?.toFixed(0)}% reduction possible
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
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
                    <h3 className="font-space text-xl font-semibold text-white">
                      {rec.title}
                    </h3>
                    {rec.priority && (
                      <span className={`px-2 py-1 rounded-full text-xs font-mono ${getPriorityColor(rec.priority)}`}>
                        {rec.priority}
                      </span>
                    )}
                    {rec.sector && (
                      <span className="px-2 py-1 rounded-full text-xs font-mono text-emerald-300 bg-emerald-500/15">
                        {sectorLabel(rec.sector)}
                      </span>
                    )}
                    {recommendationData.summary?.source === 'Gemini AI' && (
                      inPlan.has(rec.title.toLowerCase()) ? (
                        <Link to="/action-plan" className="ml-auto inline-flex items-center gap-1 font-mono text-xs text-emerald-300">
                          <Check className="w-4 h-4" /> In your plan
                        </Link>
                      ) : (
                        <button
                          onClick={() => addToPlan(rec)}
                          disabled={addingTitle !== null}
                          className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-500/30 font-mono text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          <ListPlus className="w-4 h-4" /> {addingTitle === rec.title ? 'Adding...' : 'Add to plan'}
                        </button>
                      )
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

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="font-mono text-xs text-emerald-100/60">Impact</p>
                    <p className="font-mono text-sm font-semibold text-white">
                      {rec.impact.toFixed(1)} tCO₂e
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
                      <p className="font-mono text-xs text-emerald-100/60">Payback</p>
                      <p className="font-mono text-sm font-semibold text-white">{rec.roi_months} months</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Generate recommendations state */}
      {!loading && !loadingSaved && recommendationData.recommendations.length === 0 && !error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="feature-card p-8 text-center"
        >
          <Leaf className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="font-space text-xl font-bold text-white mb-2">Ready to Generate Recommendations</h2>
          <p className="font-mono text-emerald-100/70 mb-6">
            Get AI-powered recommendations based on your carbon assessment and selected sectors.
          </p>
          <button
            onClick={fetchRecommendations}
            disabled={selectedSectors.length === 0}
            className="glass-button px-6 py-3 rounded-lg inline-flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap className="w-5 h-5" />
            <span className="font-mono">Generate Recommendations</span>
            <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
          </button>
          {selectedSectors.length === 0 && (
            <p className="font-mono text-sm text-emerald-100/50 mt-4">
              Please select at least one sector above to generate recommendations.
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default RecommendationsPage;