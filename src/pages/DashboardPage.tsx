import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  TreePine,
  Plus,
  X,
  AlertTriangle,
  PieChart,
  Leaf,
  ArrowRight
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';
import { useCarbonStore } from '../store/carbonStore';
import { useCompanyStore } from '../store/companyStore';
import { useAuthStore } from '../store/authStore';

const sectors = {
  agriculture: ['cropland-fires', 'synthetic-fertilizer-application', 'manure-management', 'rice-cultivation', 'enteric-fermentation', 'crop-residues'],
  power: ['electricity-generation', 'heat-plants', 'solar-generation', 'wind-generation', 'hydroelectric'],
  transportation: ['road', 'aviation', 'shipping', 'rail', 'public-transit'],
  buildings: ['residential', 'commercial', 'lighting', 'heating', 'cooling'],
  manufacturing: ['cement', 'steel', 'chemicals', 'paper', 'aluminum', 'plastics', 'electronics'],
  waste: ['landfill', 'wastewater', 'incineration', 'composting', 'recycling']
};

const activityUnits = {
  agriculture: {
    'cropland-fires': 'hectares of cropland burned',
    'synthetic-fertilizer-application': 'kg of fertilizer applied',
    'manure-management': 'number of animals',
    'rice-cultivation': 'hectares of rice cultivation',
    'enteric-fermentation': 'number of ruminant animals',
    'crop-residues': 'kg of crop residues'
  },
  power: {
    'electricity-generation': 'kWh of electricity generated',
    'heat-plants': 'kWh of heat generated',
    'solar-generation': 'kWh of solar electricity generated',
    'wind-generation': 'kWh of wind electricity generated',
    'hydroelectric': 'kWh of hydroelectric power generated'
  },
  transportation: {
    'road': 'km traveled by vehicles',
    'aviation': 'km traveled by aircraft',
    'shipping': 'ton-km of goods shipped',
    'rail': 'km traveled by trains',
    'public-transit': 'passenger-km traveled'
  },
  buildings: {
    'residential': 'square feet of residential space',
    'commercial': 'square feet of commercial space',
    'lighting': 'kWh used for lighting',
    'heating': 'kWh used for heating',
    'cooling': 'kWh used for cooling'
  },
  manufacturing: {
    'cement': 'tons of cement produced',
    'steel': 'tons of steel produced',
    'chemicals': 'tons of chemicals produced',
    'paper': 'tons of paper produced',
    'aluminum': 'tons of aluminum produced',
    'plastics': 'tons of plastics produced',
    'electronics': 'tons of electronics produced'
  },
  waste: {
    'landfill': 'tons of waste sent to landfill',
    'wastewater': 'cubic meters of wastewater treated',
    'incineration': 'tons of waste incinerated',
    'composting': 'tons of waste composted',
    'recycling': 'tons of waste recycled'
  }
};

const COLORS = ['#34d399', '#059669', '#10b981', '#6ee7b7', '#a7f3d0'];

const EmptyState = ({ onAddActivity }: { onAddActivity: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="text-center py-20"
  >
    <motion.div
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.5, type: 'spring' }}
      className="w-24 h-24 mx-auto mb-6 bg-emerald-500/20 rounded-full flex items-center justify-center"
    >
      <Leaf className="w-12 h-12 text-emerald-400" />
    </motion.div>
    <h2 className="font-space text-2xl font-bold text-white mb-4">
      Let's Calculate Your Carbon Impact
    </h2>
    <p className="font-mono text-emerald-100/70 max-w-md mx-auto mb-8">
      Start by adding your first activity. We'll help you track and analyze your organization's environmental footprint.
    </p>
    <div className="flex items-center justify-center space-x-4">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onAddActivity}
        className="bg-emerald-500 text-white px-6 py-3 rounded-lg inline-flex items-center justify-center gap-3 group font-mono hover:bg-emerald-600 transition-colors"
      >
        <Plus className="w-5 h-5" />
        <span>Add Your First Activity</span>
      </motion.button>
      <a
        href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-emerald-500 text-white px-6 py-3 rounded-lg inline-flex items-center justify-center gap-3 group font-mono hover:bg-emerald-600 transition-colors"
        >
          <span>Watch Demo</span>
        </motion.button>
      </a>
    </div>
  </motion.div>
);

const DashboardPage = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedSubsector, setSelectedSubsector] = useState('');
  const [activityAmount, setActivityAmount] = useState('');
  const [error, setError] = useState('');
  const [isIntroAnimation, setIsIntroAnimation] = useState(true);
  const { profile } = useCompanyStore();
  const { user } = useAuthStore();

  const {
    activities,
    carbonScore,
    loading,
    initialized,
    addActivity,
    removeActivity,
    calculateScore,
    resetScore,
    loadSavedData
  } = useCarbonStore();

  useEffect(() => {
    // Set intro animation to false after 500ms
    const timer = setTimeout(() => {
      setIsIntroAnimation(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  // Add a new useEffect to load data from Supabase when component mounts
  useEffect(() => {
    // Load saved data when component mounts
    if (user) {
      console.log('Loading saved carbon data for user:', user.id);
      loadSavedData(user.id).catch(err => {
        console.error('Error loading saved data:', err);
      });
    } else {
      console.warn('No user found, cannot load saved data');
    }
  }, [user, loadSavedData]);

  interface ActivityUnits {
    [sector: string]: {
      [subsector: string]: string;
    };
  }

  const getUnitDescription = (sector: string, subsector: string) => {
    const activityUnits: ActivityUnits = {
      agriculture: {
        'cropland-fires': 'hectares',
        'synthetic-fertilizer-application': 'kg',
        'manure-management': 'liters',
        'rice-cultivation': 'hectares',
        'enteric-fermentation': 'livestock units',
        'crop-residues': 'tonnes'
      },
      energy: {
        'fuel-combustion': 'kWh',
        'fugitive-emissions': 'kg CO₂e',
        'electricity': 'MWh'
      },
      industrial: {
        'cement-production': 'tonnes',
        'chemical-production': 'kg',
        'metal-production': 'tonnes'
      },
      transportation: {
        'road-transport': 'km',
        'aviation': 'passenger-km',
        'shipping': 'tonne-km'
      },
      waste: {
        'landfill': 'tonnes',
        'wastewater': 'cubic meters'
      }
    };
  
    if (activityUnits[sector] && activityUnits[sector][subsector]) {
      return activityUnits[sector][subsector];
    }
    return 'units';
  };

  const handleAddActivity = async () => {
    if (!user) {
      setError('You must be logged in to add activities');
      return;
    }

    if (!selectedSector || !selectedSubsector || !activityAmount) {
      setError('Please fill in all fields');
      return;
    }

    try {
      await addActivity({
        sector: selectedSector,
        subsector: selectedSubsector,
        activityAmount: parseFloat(activityAmount),
        activityUnit: getUnitDescription(selectedSector, selectedSubsector)
      }, user.id);

      setSelectedSector('');
      setSelectedSubsector('');
      setActivityAmount('');
      setError('');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error adding activity:', err);
      setError('Failed to add activity');
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      setError('You must be logged in to calculate your score');
      return;
    }

    if (activities.length === 0) {
      setError('Please add at least one activity');
      return;
    }

    setError('');
    
    try {
      console.log('Calculating carbon score for user:', user.id);
      await calculateScore(user.id);
      // No need to call saveResults as data is saved directly in calculateScore
    } catch (err: any) {
      console.error('Error calculating score:', err);
      setError(err.message || 'Failed to calculate carbon score');
    }
  };

  // Add a new function to handle reset
  const handleResetScore = async () => {
    if (!user) {
      setError('You must be logged in to reset your score');
      return;
    }

    try {
      console.log('Resetting carbon data for user:', user.id);
      await resetScore(user.id);
    } catch (err) {
      console.error('Error resetting score:', err);
      setError('Failed to reset carbon score');
    }
  };

  const handleViewRecommendations = () => {
    navigate('/recommendations');
  };

  const getEmissionsByCategory = () => {
    if (!carbonScore) return [];
    
    return Object.entries(carbonScore.emissions_breakdown).map(([name, value]) => ({
      name,
      value
    }));
  };

  const renderPieChart = () => {
    const data = getEmissionsByCategory();
    
    return (
      <ResponsiveContainer width="100%" height={240}>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            fill="#8884d8"
            paddingAngle={5}
            dataKey="value"
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value) => [`${Number(value).toFixed(1)} tCO₂e`, 'Emissions']}
            contentStyle={{ 
              backgroundColor: 'rgba(0, 0, 0, 0.8)', 
              border: '1px solid #10b981',
              borderRadius: '0.5rem',
              color: '#fff',
              fontFamily: 'monospace'
            }}
            itemStyle={{
              color: '#fff'
            }}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-8">
      {loading && !initialized ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-mono text-emerald-100/70">Loading your carbon data...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="font-space text-4xl font-bold text-white mb-2">Carbon Intelligence</h1>
              <p className="font-mono text-emerald-100/80">
                Track and analyze {profile?.name ? profile.name + "'s" : "your organization's"} carbon footprint
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsModalOpen(true)}
              className="glass-button px-6 py-3 rounded-lg flex items-center justify-center gap-3 group bg-emerald-500/20 hover:bg-emerald-500/30 transition-all duration-300"
            >
              <Plus className="w-5 h-5 text-emerald-300 group-hover:text-emerald-200" />
              <span className="font-mono text-emerald-300 group-hover:text-emerald-200">Add Activity</span>
            </motion.button>
          </div>

          {activities.length === 0 && !carbonScore ? (
            <EmptyState onAddActivity={() => setIsModalOpen(true)} />
          ) : (
            <>
              {activities.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="feature-card p-6"
                >
                  <h2 className="font-space text-xl font-semibold text-white mb-6">Added Activities</h2>
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-emerald-500/20"
                      >
                        <div>
                          <p className="font-mono text-white">
                            {activity.sector} / {activity.subsector}
                          </p>
                          <p className="font-mono text-sm text-emerald-100/70">
                            Amount: {activity.activityAmount} {activity.activityUnit}
                          </p>
                        </div>
                        <button
                          onClick={() => removeActivity(activity.id || activity._id || '', user?.id || '')}
                          className="p-2 text-red-400 hover:text-red-300 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}

                    <div className="flex justify-end gap-4 mt-6">
                      <button
                        onClick={handleResetScore}
                        className="px-4 py-2 font-mono text-sm text-emerald-100/70 hover:text-white transition-colors"
                      >
                        Reset
                      </button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSubmit}
                        disabled={loading}
                        className="glass-button px-6 py-2 rounded-lg flex items-center justify-center font-mono text-sm bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Calculating...' : 'Calculate Score'}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}

              {carbonScore && (
                <AnimatePresence>
                  <motion.div
                    key="carbon-score"
                    initial={isIntroAnimation ? { opacity: 0, y: 20 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid gap-6 md:grid-cols-2"
                  >
                    <div className="feature-card p-6">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="bg-emerald-500/20 p-4 rounded-lg">
                          <BarChart3 className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                          <h2 className="font-space text-xl font-semibold text-white">Carbon Score</h2>
                          <p className="font-mono text-sm text-emerald-100/70">Your organization's emissions summary</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-gray-800/50 p-4 rounded-lg border border-emerald-500/20">
                          <p className="font-mono text-sm text-emerald-100/70 mb-2">Total Emissions</p>
                          <div className="flex items-baseline flex-wrap">
                            <span className="font-space text-3xl font-bold text-white mr-2">
                              {carbonScore.total_emissions_tons_co2e.toFixed(1)}
                            </span>
                            <span className="font-mono text-emerald-400 text-sm">tCO₂e</span>
                          </div>
                        </div>

                        <div className="bg-gray-800/50 p-4 rounded-lg border border-emerald-500/20">
                          <p className="font-mono text-sm text-emerald-100/70 mb-2">Carbon Rating</p>
                          <div className="flex items-baseline">
                            <span className="font-space text-3xl font-bold text-white">
                              {carbonScore.carbon_rating}
                            </span>
                          </div>
                        </div>

                        <div className="bg-gray-800/50 p-4 rounded-lg border border-emerald-500/20">
                          <p className="font-mono text-sm text-emerald-100/70 mb-2">Performance</p>
                          <div className="flex items-baseline">
                            <span className="font-space text-xl font-bold text-white">
                              {carbonScore.rating_description}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-center mt-6">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleViewRecommendations}
                          className="glass-button px-6 py-3 rounded-lg inline-flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors font-mono w-full md:w-auto"
                        >
                          <span>View Recommendations</span>
                          <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                        </motion.button>
                      </div>
                    </div>

                    <div className="feature-card p-6">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="bg-emerald-500/20 p-4 rounded-lg">
                          <PieChart className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                          <h2 className="font-space text-xl font-semibold text-white">Emissions by Sector</h2>
                          <p className="font-mono text-sm text-emerald-100/70">Breakdown of your carbon footprint</p>
                        </div>
                      </div>

                      {renderPieChart()}
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </>
          )}
        </>
      )}

      {/* Add Activity Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 rounded-xl p-6 w-full max-w-lg"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-space text-xl font-semibold text-white">Add Carbon Activity</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {error && (
                <div className="bg-red-900/20 text-red-400 p-3 rounded-lg mb-6 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p className="font-mono text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="block font-mono text-sm text-emerald-100/70 mb-2">
                    Sector
                  </label>
                  <select
                    value={selectedSector}
                    onChange={(e) => {
                      setSelectedSector(e.target.value);
                      setSelectedSubsector('');
                    }}
                    className="w-full bg-gray-700/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                  >
                    <option value="">-- Select Sector --</option>
                    {Object.keys(sectors).map((sector) => (
                      <option key={sector} value={sector}>
                        {sector.charAt(0).toUpperCase() + sector.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSector && (
                  <div>
                    <label className="block font-mono text-sm text-emerald-100/70 mb-2">
                      Activity Type
                    </label>
                    <select
                      value={selectedSubsector}
                      onChange={(e) => setSelectedSubsector(e.target.value)}
                      className="w-full bg-gray-700/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                    >
                      <option value="">-- Select Activity Type --</option>
                      {sectors[selectedSector as keyof typeof sectors]?.map((subsector) => (
                        <option key={subsector} value={subsector}>
                          {subsector.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedSubsector && (
                  <div>
                    <label className="block font-mono text-sm text-emerald-100/70 mb-2">
                      Amount ({activityUnits[selectedSector as keyof typeof activityUnits]?.[selectedSubsector as keyof typeof activityUnits[keyof typeof activityUnits]]})
                    </label>
                    <input
                      type="number"
                      value={activityAmount}
                      onChange={(e) => setActivityAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full bg-gray-700/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                    />
                  </div>
                )}

                <button
                  onClick={handleAddActivity}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-mono text-sm py-3 rounded-lg transition-colors mt-6 flex items-center justify-center gap-2"
                >
                  Add Activity
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DashboardPage;