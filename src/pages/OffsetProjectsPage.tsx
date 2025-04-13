import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Leaf, 
  ArrowRight, 
  Globe, 
  AlertTriangle, 
  Landmark, 
  Clock, 
  DollarSign,
  Trophy,
  MapPin,
  LineChart,
  Link as LinkIcon,
  ExternalLink,
  Info,
  X
} from 'lucide-react';
import { useOffsetStore, EnhancedProject } from '../store/offsetStore';
import { useCarbonStore } from '../store/carbonStore';
import { Link } from 'react-router-dom';

const OffsetProjectsPage = () => {
  const { projects, loading, error, fetchOffsetProjects } = useOffsetStore();
  const { carbonScore } = useCarbonStore();
  const [selectedProject, setSelectedProject] = useState<EnhancedProject | null>(null);
  const [expandedModal, setExpandedModal] = useState(false);

  useEffect(() => {
    // Fetch offset projects when the component mounts
    fetchOffsetProjects();
  }, [fetchOffsetProjects]);

  if (!carbonScore) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-space text-4xl font-bold text-white mb-2">Carbon Offset Projects</h1>
          <p className="font-mono text-emerald-100/80">Explore recommended offset projects aligned with your carbon profile</p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="feature-card p-8 text-center"
        >
          <AlertTriangle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="font-space text-xl font-bold text-white mb-2">No Carbon Data Available</h2>
          <p className="font-mono text-emerald-100/70 mb-6">
            Please complete your carbon assessment first to receive personalized offset project recommendations.
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
        <h1 className="font-space text-4xl font-bold text-white mb-2">Carbon Offset Projects</h1>
        <p className="font-mono text-emerald-100/80">Explore personalized offset projects with real-world implementation options</p>
      </div>

      {/* Carbon Score Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="feature-card p-6"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-emerald-500/20 p-3 rounded-lg">
            <Globe className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-space text-xl font-semibold text-white">Offset Recommendation Summary</h2>
            <p className="font-mono text-sm text-emerald-100/70">
              Based on your {carbonScore.total_emissions_tons_co2e.toFixed(1)} tons of annual CO2e emissions
            </p>
          </div>
          <div className="ml-auto">
            <Link
              to="/recommendations"
              className="bg-emerald-800/90 hover:bg-emerald-700/90 px-4 py-2 rounded-lg inline-flex items-center gap-2 border border-emerald-600/30 transition-all duration-300 font-mono text-emerald-300 text-sm"
            >
              <span>Go to Recommendations</span>
              <LineChart className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-800/50 rounded-lg border border-emerald-500/20">
            <p className="font-mono text-sm text-emerald-100/70 mb-2">Carbon Grade</p>
            <div className="flex items-baseline gap-2">
              <span className="font-space text-3xl font-bold text-white">
                {carbonScore.carbon_rating}
              </span>
              <span className="font-mono text-sm text-emerald-400">Grade</span>
            </div>
          </div>

          <div className="p-4 bg-gray-800/50 rounded-lg border border-emerald-500/20">
            <p className="font-mono text-sm text-emerald-100/70 mb-2">Offset Potential</p>
            <div className="flex items-baseline gap-2">
              <span className="font-space text-3xl font-bold text-white">
                {Math.round(carbonScore.total_emissions_tons_co2e * 0.25)}
              </span>
              <span className="font-mono text-sm text-emerald-400">tons CO2e</span>
            </div>
          </div>

          <div className="p-4 bg-gray-800/50 rounded-lg border border-emerald-500/20">
            <p className="font-mono text-sm text-emerald-100/70 mb-2">Est. Annual Investment</p>
            <div className="flex items-baseline gap-2">
              <span className="font-space text-3xl font-bold text-white">
                ${Math.round(carbonScore.total_emissions_tons_co2e * 0.25 * 15).toLocaleString()}
              </span>
              <span className="font-mono text-sm text-emerald-400">USD</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Projects Section */}
      <div className="space-y-6">
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-mono text-emerald-100/70">Searching for real-world offset projects...</p>
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
              onClick={() => fetchOffsetProjects()}
              className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-2 px-4 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </motion.div>
        ) : (
          <>
            {/* Project Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {projects.map((project, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="feature-card hover:border-emerald-500/40 transition-colors flex flex-col h-full overflow-hidden"
                >
                  {/* Project Image */}
                  <div className="w-full h-48 overflow-hidden relative">
                    {project.image_url ? (
                      <img 
                        src={project.image_url} 
                        alt={project.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // If image fails to load, show a gradient background instead
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.classList.add('bg-gradient-to-r', 'from-emerald-900', 'to-gray-800');
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-r from-emerald-900 to-gray-800"></div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 to-transparent p-4">
                      <h3 className="font-space text-xl font-semibold text-white">{project.name}</h3>
                      <div className="flex items-center text-emerald-100/70">
                        <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                        <span className="font-mono text-xs">{project.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 flex-grow flex flex-col">
                    <p className="font-mono text-sm text-emerald-100/80 mb-4">
                      {project.description}
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex items-start gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-mono text-xs text-emerald-100/70">Cost</p>
                          <p className="font-mono text-sm text-white">{project.cost_per_ton}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Trophy className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-mono text-xs text-emerald-100/70">Certification</p>
                          <p className="font-mono text-sm text-white">{project.certification}</p>
                        </div>
                      </div>
                    </div>

                    {/* Implementation Links */}
                    {project.implementation_links && project.implementation_links.length > 0 && (
                      <div className="mb-4">
                        <p className="font-mono text-xs text-emerald-100/70 mb-2">Implementation Resources:</p>
                        <div className="space-y-2">
                          {project.implementation_links.slice(0, 2).map((link, i) => (
                            <a
                              key={i}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 font-mono text-sm text-emerald-300 hover:text-emerald-200 transition-colors"
                            >
                              <LinkIcon className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{link.title}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sector Alignment */}
                    <div className="flex items-start gap-2 mt-auto mb-4">
                      <Leaf className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-mono text-xs text-emerald-100/70">Sector Alignment</p>
                        <p className="font-mono text-sm text-white">{project.sector_alignment}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-t border-emerald-500/10 flex justify-between items-center">
                    <button 
                      onClick={() => {
                        setSelectedProject(project as EnhancedProject);
                        setExpandedModal(true);
                      }}
                      className="bg-emerald-800/70 hover:bg-emerald-700/70 text-emerald-200 font-mono text-xs py-1.5 px-3 rounded-md transition-colors flex items-center gap-1"
                    >
                      <Info className="w-3 h-3" />
                      View Details
                    </button>
                    
                    <a 
                      href={project.website_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-emerald-600/70 hover:bg-emerald-600 text-emerald-100 font-mono text-xs py-1.5 px-3 rounded-md transition-colors flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Implement
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Expanded Project Modal */}
      <AnimatePresence>
        {selectedProject && expandedModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-gray-900 rounded-xl border border-emerald-500/20 w-full max-w-4xl overflow-hidden relative"
            >
              <button 
                onClick={() => setExpandedModal(false)}
                className="absolute top-4 right-4 text-emerald-400 hover:text-emerald-300 z-10"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Project Hero */}
              <div className="h-64 relative">
                {selectedProject.image_url ? (
                  <img 
                    src={selectedProject.image_url} 
                    alt={selectedProject.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.classList.add('bg-gradient-to-r', 'from-emerald-900', 'to-gray-800');
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-emerald-900 to-gray-800"></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h2 className="font-space text-3xl font-bold text-white mb-2">{selectedProject.name}</h2>
                  <div className="flex items-center text-emerald-100/70">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span className="font-mono text-sm">{selectedProject.location}</span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {/* Project Description */}
                <div className="mb-6">
                  <h3 className="font-space text-xl font-semibold text-white mb-3">Project Overview</h3>
                  <p className="font-mono text-emerald-100/90">{selectedProject.description}</p>
                </div>

                {/* Key Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-gray-800/80 rounded-lg border border-emerald-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <DollarSign className="w-5 h-5 text-emerald-400" />
                      <p className="font-mono text-sm text-emerald-100/70">Financial Details</p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-mono text-sm"><span className="text-emerald-100/70">Cost per Ton:</span> <span className="text-white">{selectedProject.cost_per_ton}</span></p>
                      <p className="font-mono text-sm"><span className="text-emerald-100/70">Total Cost:</span> <span className="text-white">{selectedProject.total_cost}</span></p>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-800/80 rounded-lg border border-emerald-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <Trophy className="w-5 h-5 text-emerald-400" />
                      <p className="font-mono text-sm text-emerald-100/70">Certification & Impact</p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-mono text-sm"><span className="text-emerald-100/70">Certification:</span> <span className="text-white">{selectedProject.certification}</span></p>
                      <p className="font-mono text-sm"><span className="text-emerald-100/70">CO2 Reduction:</span> <span className="text-white">{selectedProject.co2_reduction}</span></p>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-800/80 rounded-lg border border-emerald-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <Clock className="w-5 h-5 text-emerald-400" />
                      <p className="font-mono text-sm text-emerald-100/70">Timeline & Details</p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-mono text-sm"><span className="text-emerald-100/70">Implementation:</span> <span className="text-white">{selectedProject.timeframe}</span></p>
                      <p className="font-mono text-sm"><span className="text-emerald-100/70">Benefits:</span> <span className="text-white">{selectedProject.impact}</span></p>
                    </div>
                  </div>
                </div>
                
                {/* Additional Details */}
                {selectedProject.additional_details && selectedProject.additional_details.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-space text-lg font-semibold text-white mb-3">Additional Project Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedProject.additional_details.map((detail, index) => (
                        <div key={index} className="p-3 bg-gray-800/50 rounded-lg border border-emerald-500/10">
                          <p className="font-mono text-xs text-emerald-300 mb-1">{detail.category}</p>
                          <p className="font-mono text-sm text-white">{detail.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Sector Alignment */}
                <div className="p-4 bg-gray-800/80 rounded-lg border border-emerald-500/20 mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Leaf className="w-5 h-5 text-emerald-400" />
                    <p className="font-mono text-sm text-emerald-100/70">Sector Alignment</p>
                  </div>
                  <p className="font-mono text-sm text-white">{selectedProject.sector_alignment}</p>
                </div>

                {/* Implementation Links */}
                {selectedProject.implementation_links && selectedProject.implementation_links.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-space text-lg font-semibold text-white mb-3">Implementation Resources</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedProject.implementation_links.map((link, index) => (
                        <a
                          key={index}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 bg-emerald-800/30 hover:bg-emerald-800/50 rounded-lg border border-emerald-500/20 transition-colors flex items-center gap-3"
                        >
                          <ExternalLink className="w-5 h-5 text-emerald-400" />
                          <div>
                            <p className="font-mono text-sm text-white">{link.title}</p>
                            <p className="font-mono text-xs text-emerald-300/70 truncate">{link.url}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap justify-center gap-4 mt-6">
                  <a 
                    href={selectedProject.website_url}
                    target="_blank"
                    rel="noopener noreferrer" 
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
                  >
                    Implement This Project
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setExpandedModal(false)}
                    className="bg-gray-700/50 hover:bg-gray-700 text-white font-mono py-2 px-6 rounded-lg transition-colors"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OffsetProjectsPage;