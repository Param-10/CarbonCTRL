import { create } from 'zustand';
import { 
  generateOffsetProjects, 
  generateEnhancedOffsetProjects,
  OffsetProject as OffsetProjectType,
  EnhancedOffsetProject 
} from '../lib/gemini';
import { useCompanyStore } from './companyStore';

export interface OffsetProject {
  name: string;
  description: string;
  location: string;
  cost_per_ton: string;
  total_cost: string;
  certification: string;
  co2_reduction: string;
  timeframe: string;
  impact: string;
  website_url: string;
  sector_alignment: string;
}

export interface EnhancedProject extends OffsetProject {
  image_url: string;
  implementation_links: {
    title: string;
    url: string;
  }[];
  additional_details: {
    category: string;
    value: string;
  }[];
}

// Fallback sample projects to ensure something displays if API fails
const fallbackProjects: EnhancedOffsetProject[] = [
  {
    name: "Amazon Rainforest Conservation",
    description: "Protect critical rainforest habitat in the Amazon Basin that sequesters carbon dioxide and preserves biodiversity.",
    location: "Brazil, Peru, Colombia",
    cost_per_ton: "$15 per ton CO2e",
    total_cost: "$62,500 for 4,167 tons",
    certification: "Verified Carbon Standard (VCS)",
    co2_reduction: "4,167 tons per year",
    timeframe: "5-10 years",
    impact: "Preserves biodiversity and supports indigenous communities",
    website_url: "https://verra.org/project/vcs-program/",
    sector_alignment: "Transportation, Energy",
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Amazon_Manaus_forest.jpg/1200px-Amazon_Manaus_forest.jpg",
    implementation_links: [
      {
        title: "Verra Carbon Registry",
        url: "https://registry.verra.org/"
      },
      {
        title: "Conservation International",
        url: "https://www.conservation.org/projects"
      }
    ],
    additional_details: [
      {
        category: "Project Type",
        value: "REDD+ (Reducing Emissions from Deforestation and Forest Degradation)"
      },
      {
        category: "Community Benefits",
        value: "Provides sustainable livelihoods for 500+ indigenous families"
      },
      {
        category: "Monitoring",
        value: "Satellite monitoring and ground verification teams"
      }
    ]
  },
  {
    name: "Wind Power Development",
    description: "Support the construction of utility-scale wind farms that replace fossil fuel electricity generation.",
    location: "Texas, USA",
    cost_per_ton: "$12 per ton CO2e",
    total_cost: "$50,000 for 4,167 tons",
    certification: "Gold Standard",
    co2_reduction: "4,167 tons per year",
    timeframe: "15-20 years",
    impact: "Creates local jobs and improves energy independence",
    website_url: "https://www.goldstandard.org/",
    sector_alignment: "Energy, Manufacturing",
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Windmills_in_a_row.jpg/1200px-Windmills_in_a_row.jpg",
    implementation_links: [
      {
        title: "Gold Standard Registry",
        url: "https://registry.goldstandard.org/"
      },
      {
        title: "Clean Energy Investment Accelerator",
        url: "https://www.cleanenergyinvest.org/"
      }
    ],
    additional_details: [
      {
        category: "Technology",
        value: "Modern 2.5MW wind turbines with 120m rotor diameter"
      },
      {
        category: "Capacity",
        value: "100MW total capacity, providing clean electricity for 30,000+ homes"
      },
      {
        category: "Grid Integration",
        value: "Connected to ERCOT grid with battery storage components"
      }
    ]
  }
];

interface OffsetState {
  projects: EnhancedOffsetProject[];
  loading: boolean;
  error: string | null;
  fetchOffsetProjects: () => Promise<void>;
}

export const useOffsetStore = create<OffsetState>((set) => ({
  projects: [],
  loading: false,
  error: null,

  fetchOffsetProjects: async () => {
    const { carbonScore } = require('./carbonStore').useCarbonStore.getState();
    const { profile } = useCompanyStore.getState();

    if (!carbonScore) {
      set({ error: 'No carbon data available. Please complete a carbon assessment first.' });
      return;
    }

    try {
      set({ loading: true, error: null });

      const industry = profile?.industry || 'Technology';
      
      try {
        // First try the enhanced API with web search
        const result = await generateEnhancedOffsetProjects(
          industry,
          {
            total_emissions: carbonScore.total_emissions_tons_co2e,
            breakdown: carbonScore.emissions_breakdown,
            grade: carbonScore.carbon_rating,
          }
        );

        // If we got projects successfully, use them
        if (result.projects && result.projects.length > 0) {
          set({ projects: result.projects, loading: false });
          return;
        }

        // If enhanced API returned empty array, fall back to basic API
        const basicResult = await generateOffsetProjects(
          industry,
          {
            total_emissions: carbonScore.total_emissions_tons_co2e,
            breakdown: carbonScore.emissions_breakdown,
            grade: carbonScore.carbon_rating,
          }
        );

        // Convert basic projects to enhanced format
        const enhancedProjects: EnhancedOffsetProject[] = basicResult.projects.map(project => ({
          ...project,
          image_url: "",
          implementation_links: [],
          additional_details: []
        }));

        set({ projects: enhancedProjects, loading: false });
      } catch (apiError) {
        console.error("API error, using fallback projects:", apiError);
        // If both APIs fail, use fallback sample projects
        set({ 
          projects: fallbackProjects, 
          loading: false
        });
      }
    } catch (error: any) {
      console.error('Error in offset store:', error);
      // Last resort fallback
      set({ 
        projects: fallbackProjects,
        loading: false,
        error: null // Hide error from user since we're showing fallback projects
      });
    }
  }
}));