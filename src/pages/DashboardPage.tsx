import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  TreePine,
  Plus,
  X,
  AlertTriangle,
  PieChart,
  Leaf
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

const EmptyState = () => (
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
    <div className="space-x-4">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="bg-white text-gray-900 px-6 py-3 rounded-lg inline-flex items-center gap-3 group font-mono hover:bg-gray-100 transition-colors"
      >
        <Plus className="w-5 h-5" />
        <span>Add Your First Activity</span>
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="bg-white text-gray-900 px-6 py-3 rounded-lg inline-flex items-center gap-3 group font-mono hover:bg-gray-100 transition-colors"
      >
        <span>Watch Demo</span>
      </motion.button>
    </div>
  </motion.div>
);

const DashboardPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedSubsector, setSelectedSubsector] = useState('');
  const [activityAmount, setActivityAmount] = useState('');
  const [error, setError] = useState('');

  const {
    activities,
    carbonScore,
    loading,
    addActivity,
    removeActivity,
    calculateScore,
    resetScore
  } = useCarbonStore();

  const getUnitDescription = (sector: string, subsector: string) => {
    return activityUnits[sector]?.[subsector] || 'units';
  };

  const handleAddActivity = () => {
    if (!selectedSector || !selectedSubsector || !activityAmount) {
      setError('Please fill in all fields');
      return;
    }

    addActivity({
      sector: selectedSector,
      subsector: selectedSubsector,
      activity_amount: parseFloat(activityAmount),
      activity_unit: getUnitDescription(selectedSector, selectedSubsector)
    });

    setSelectedSector('');
    setSelectedSubsector('');
    setActivityAmount('');
    setError('');
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    if (activities.length === 0) {
      setError('Please add at least one activity');
      return;
    }

    try {
      await calculateScore();
    } catch (error) {
      setError('Failed to calculate carbon score');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-space text-4xl font-bold text-white mb-2">Carbon Intelligence</h1>
          <p className="font-mono text-emerald-100/80">Track and analyze your organization's carbon footprint</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsModalOpen(true)}
          className="glass-button px-6 py-3 rounded-lg flex items-center gap-3 group bg-emerald-500/20 hover:bg-emerald-500/30 transition-all duration-300"
        >
          <Plus className="w-5 h-5 text-emerald-300 group-hover:text-emerald-200" />
          <span className="font-mono text-emerald-300 group-hover:text-emerald-200">Add Activity</span>
        </motion.button>
      </div>

      {activities.length === 0 && !carbonScore ? (
        <EmptyState />
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
                        Amount: {activity.activity_amount} {activity.activity_unit}
                      </p>
                    </div>
                    <button
                      onClick={() => removeActivity(activity.id)}
                      className="p-2 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}

                <div className="flex justify-end gap-4 mt-6">
                  <button
                    onClick={resetScore}
                    className="px-4 py-2 font-mono text-sm text-emerald-100/70 hover:text-white transition-colors"
                  >
                    Reset
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSubmit}
                    disabled={loading}
                    className="glass-button px-6 py-2 rounded-lg font-mono text-sm bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Calculating...' : 'Calculate Score'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {carbonScore && (
            <>
              {/* Top Section - Grade Box */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="feature-card p-8 text-center"
              >
                <div className="flex items-center justify-center gap-8">
                  <div>
                    <p className="font-mono text-sm text-emerald-100/70 mb-2">Carbon Rating</p>
                    <div className="flex items-center justify-center gap-3">
                      <span className="font-space text-5xl font-bold text-white">
                        {carbonScore.carbon_rating}
                      </span>
                      <div className="text-left">
                        <span className="block font-mono text-emerald-400 text-sm">Grade</span>
                        <span className="block font-mono text-emerald-100/70 text-xs">
                          {carbonScore.rating_description}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-px h-16 bg-emerald-500/20"></div>

                  <div>
                    <p className="font-mono text-sm text-emerald-100/70 mb-2">Total Emissions</p>
                    <div className="flex items-center justify-center gap-3">
                      <span className="font-space text-5xl font-bold text-white">
                        {carbonScore.total_emissions_tons_co2e.toFixed(1)}
                      </span>
                      <div className="text-left">
                        <span className="block font-mono text-emerald-400 text-sm">tCO₂e</span>
                        <span className="block font-mono text-emerald-100/70 text-xs">
                          Total Impact
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Bottom Section - Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="feature-card p-6"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-emerald-500/20 p-4 rounded-lg">
                      <BarChart3 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h2 className="font-space text-xl font-semibold text-white">Emissions by Sector</h2>
                  </div>

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(carbonScore.emissions_breakdown).map(([sector, emissions]) => ({
                          sector,
                          emissions
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="sector" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: 'none',
                            borderRadius: '0.5rem',
                          }}
                        />
                        <Bar dataKey="emissions" fill="#34d399" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                {/* Pie Chart */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="feature-card p-6"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-emerald-500/20 p-4 rounded-lg">
                      <PieChart className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h2 className="font-space text-xl font-semibold text-white">Emissions Distribution</h2>
                  </div>

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={Object.entries(carbonScore.emissions_breakdown).map(([name, value]) => ({
                            name,
                            value
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {Object.entries(carbonScore.emissions_breakdown).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: 'none',
                            borderRadius: '0.5rem',
                          }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900/90 backdrop-blur-xl p-8 rounded-2xl w-full max-w-md border border-emerald-500/20"
            >
              <h3 className="font-space text-2xl font-bold text-white mb-6">Add New Activity</h3>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <p className="font-mono text-sm text-red-400">{error}</p>
                </div>
              )}
              
              <div className="space-y-6">
                <div>
                  <label className="block font-mono text-sm text-emerald-100/70 mb-2">Sector</label>
                  <select
                    value={selectedSector}
                    onChange={(e) => {
                      setSelectedSector(e.target.value);
                      setSelectedSubsector('');
                    }}
                    className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                  >
                    <option value="">Select Sector</option>
                    {Object.keys(sectors).map(sector => (
                      <option key={sector} value={sector}>
                        {sector.charAt(0).toUpperCase() + sector.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSector && (
                  <div>
                    <label className="block font-mono text-sm text-emerald-100/70 mb-2">Subsector</label>
                    <select
                      value={selectedSubsector}
                      onChange={(e) => setSelectedSubsector(e.target.value)}
                      className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                    >
                      <option value="">Select Subsector</option>
                      {sectors[selectedSector].map(subsector => (
                        <option key={subsector} value={subsector}>
                          {subsector.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedSector && selectedSubsector && (
                  <div>
                    <label className="block font-mono text-sm text-emerald-100/70 mb-2">
                      Amount ({getUnitDescription(selectedSector, selectedSubsector)})
                    </label>
                    <input
                      type="number"
                      value={activityAmount}
                      onChange={(e) => setActivityAmount(e.target.value)}
                      className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                      placeholder={`Enter amount in ${getUnitDescription(selectedSector, selectedSubsector)}`}
                    />
                  </div>
                )}

                <div className="flex justify-end gap-4 mt-8">
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      setError('');
                    }}
                    className="px-6 py-3 rounded-lg font-mono text-sm text-emerald-100/70 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddActivity}
                    className="glass-button px-6 py-3 rounded-lg font-mono text-sm flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white transition-all duration-300"
                  >
                    <Plus className="w-5 h-5" />
                    Add Activity
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DashboardPage;