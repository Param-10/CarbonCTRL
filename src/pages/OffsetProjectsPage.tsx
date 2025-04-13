import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, TreePine, Globe2, Wind, Waves } from 'lucide-react';

interface Project {
  id: number;
  name: string;
  description: string;
  location: string;
  impact: string;
  type: string;
  icon: keyof typeof projectIcons;
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
    icon: "forest"
  },
  {
    id: 2,
    name: "Offshore Wind Farm Project",
    description: "Investment in large-scale offshore wind energy production to replace fossil fuel power generation.",
    location: "North Sea",
    impact: "75,000 tons CO₂/year",
    type: "Renewable Energy",
    icon: "wind"
  },
  {
    id: 3,
    name: "Ocean Cleanup Initiative",
    description: "Supporting innovative technologies to remove plastic waste and restore marine ecosystems.",
    location: "Pacific Ocean",
    impact: "25,000 tons CO₂/year",
    type: "Ocean Conservation",
    icon: "ocean"
  },
  {
    id: 4,
    name: "Wildlife Corridor Protection",
    description: "Establishing and maintaining wildlife corridors to preserve biodiversity and natural carbon sinks.",
    location: "Kenya",
    impact: "30,000 tons CO₂/year",
    type: "Conservation",
    icon: "conservation"
  }
];

const OffsetProjectsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');

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
              className="feature-card group cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="bg-emerald-500/20 p-4 rounded-lg group-hover:bg-emerald-500/30 transition-colors">
                  <IconComponent className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-space text-xl font-semibold text-white mb-2">{project.name}</h3>
                  <p className="font-mono text-sm text-emerald-100/70 mb-4">{project.description}</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Globe2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-mono text-sm text-emerald-200">{project.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TreePine className="w-4 h-4 text-emerald-400" />
                      <span className="font-mono text-sm text-emerald-200">{project.impact}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-emerald-500/20">
                <button className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-2 rounded-lg transition-colors">
                  Learn More
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
    </div>
  );
};

export default OffsetProjectsPage;