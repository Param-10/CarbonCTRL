import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, TreePine, Globe2, Wind, Waves, ExternalLink, Info, Heart, DollarSign, ArrowRight } from 'lucide-react';

interface Project {
  id: number;
  name: string;
  description: string;
  location: string;
  impact: string;
  type: string;
  icon: keyof typeof projectIcons;
  cost: string;
  certifications: string[];
  url: string;
  imageUrl: string;
}

const projectIcons = {
  forest: TreePine,
  wind: Wind,
  ocean: Waves,
  conservation: Globe2,
};

const mockProjects: Project[] = [
  {
    id: 1,
    name: "Amazon Rainforest Conservation",
    description: "Support the preservation of Amazon rainforest through sustainable management and indigenous community partnerships.",
    location: "Brazil",
    impact: "50,000 tons CO₂/year",
    type: "Forest Conservation",
    icon: "forest",
    cost: "$15-20 per tCO₂e",
    certifications: ["Gold Standard", "Verified Carbon Standard"],
    url: "https://www.conservation.org/places/amazonia",
    imageUrl: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 2,
    name: "Offshore Wind Farm Project",
    description: "Investment in large-scale offshore wind energy production to replace fossil fuel power generation.",
    location: "North Sea",
    impact: "75,000 tons CO₂/year",
    type: "Renewable Energy",
    icon: "wind",
    cost: "$10-15 per tCO₂e",
    certifications: ["Green-e Energy", "Climate Action Reserve"],
    url: "https://orsted.com/en/our-business/offshore-wind",
    imageUrl: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 3,
    name: "Ocean Cleanup Initiative",
    description: "Supporting innovative technologies to remove plastic waste and restore marine ecosystems.",
    location: "Pacific Ocean",
    impact: "25,000 tons CO₂/year",
    type: "Ocean Conservation",
    icon: "ocean",
    cost: "$20-25 per tCO₂e",
    certifications: ["Ocean Foundation Certified", "Blue Carbon Standard"],
    url: "https://theoceancleanup.com/",
    imageUrl: "https://images.unsplash.com/photo-1484291470158-b8f8d608850d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 4,
    name: "Wildlife Corridor Protection",
    description: "Establishing and maintaining wildlife corridors to preserve biodiversity and natural carbon sinks.",
    location: "Kenya",
    impact: "30,000 tons CO₂/year",
    type: "Conservation",
    icon: "conservation",
    cost: "$18-22 per tCO₂e",
    certifications: ["Wildlife Conservation Certified", "Carbon Biodiversity Standard"],
    url: "https://www.worldwildlife.org/initiatives/wildlife-conservation",
    imageUrl: "https://images.unsplash.com/photo-1564760055775-d63b17a55c44?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
  }
];

const OffsetProjectsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const filteredProjects = mockProjects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !selectedType || project.type.toLowerCase().includes(selectedType.toLowerCase());
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-space text-4xl font-bold text-white mb-2">Carbon Offset Projects</h1>
          <p className="font-mono text-emerald-100/80">Explore and support verified carbon offset initiatives worldwide</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative flex-grow sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
            />
          </div>
          
          <div className="relative flex-grow sm:max-w-xs">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono appearance-none"
            >
              <option value="">All Types</option>
              <option value="forest">Forest Conservation</option>
              <option value="renewable">Renewable Energy</option>
              <option value="ocean">Ocean Conservation</option>
              <option value="conservation">Conservation</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => {
          const IconComponent = projectIcons[project.icon];
          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="feature-card overflow-hidden group hover:ring-2 hover:ring-emerald-500/30 transition-all duration-300"
              onClick={() => setSelectedProject(project)}
            >
              <div className="h-40 overflow-hidden relative">
                <img 
                  src={project.imageUrl} 
                  alt={project.name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-4">
                  <span className="inline-flex items-center gap-1 bg-emerald-500/80 text-white text-xs font-mono px-2 py-1 rounded">
                    <IconComponent className="w-3 h-3" />
                    {project.type}
                  </span>
                </div>
              </div>
              
              <div className="p-6">
                <h3 className="font-space text-xl font-semibold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                  {project.name}
                </h3>
                <p className="font-mono text-sm text-emerald-100/70 mb-4 line-clamp-2">
                  {project.description}
                </p>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Globe2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-mono text-sm text-emerald-200">{project.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TreePine className="w-4 h-4 text-emerald-400" />
                    <span className="font-mono text-sm text-emerald-200">{project.impact}</span>
                  </div>
                </div>
                
                <button 
                  className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Info className="w-4 h-4" />
                  View Details
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredProjects.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <TreePine className="w-16 h-16 text-emerald-400/50 mx-auto mb-4" />
          <h3 className="font-space text-xl font-semibold text-white mb-2">No Projects Found</h3>
          <p className="font-mono text-emerald-100/70">Try adjusting your search or filters</p>
        </motion.div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-gray-900/80"
          onClick={() => setSelectedProject(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-800 rounded-xl overflow-hidden max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-64 overflow-hidden relative">
              <img 
                src={selectedProject.imageUrl} 
                alt={selectedProject.name} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-800 to-transparent"></div>
              <button 
                className="absolute top-4 right-4 bg-gray-800/80 p-2 rounded-full text-white hover:bg-gray-700/80 transition-colors"
                onClick={() => setSelectedProject(null)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-emerald-500/20 p-3 rounded-lg">
                  {(() => {
                    const IconComponent = projectIcons[selectedProject.icon];
                    return <IconComponent className="w-6 h-6 text-emerald-400" />;
                  })()}
                </div>
                <div>
                  <h2 className="font-space text-2xl font-bold text-white">{selectedProject.name}</h2>
                  <p className="font-mono text-sm text-emerald-100/70">{selectedProject.type}</p>
                </div>
              </div>
              
              <p className="font-mono text-emerald-100 mb-8">
                {selectedProject.description}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-mono text-sm text-emerald-100/70 mb-1">Location</h3>
                    <div className="flex items-center gap-2">
                      <Globe2 className="w-5 h-5 text-emerald-400" />
                      <span className="font-mono text-white">{selectedProject.location}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-mono text-sm text-emerald-100/70 mb-1">Impact</h3>
                    <div className="flex items-center gap-2">
                      <TreePine className="w-5 h-5 text-emerald-400" />
                      <span className="font-mono text-white">{selectedProject.impact}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-mono text-sm text-emerald-100/70 mb-1">Cost</h3>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-400" />
                      <span className="font-mono text-white">{selectedProject.cost}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-mono text-sm text-emerald-100/70 mb-3">Certifications</h3>
                  <div className="space-y-2">
                    {selectedProject.certifications.map((cert, index) => (
                      <div key={index} className="bg-emerald-500/10 px-3 py-2 rounded font-mono text-sm text-emerald-200 inline-block mr-2 mb-2">
                        {cert}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <a 
                  href={selectedProject.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-mono text-sm py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Visit Official Website
                </a>
                
                <button className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-mono text-sm py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <Heart className="w-4 h-4" />
                  Save to Favorites
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default OffsetProjectsPage;