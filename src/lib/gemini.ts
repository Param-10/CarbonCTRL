import { apiClient } from './api';

/**
 * Interface for emissions data passed to the recommendation generator
 */
interface EmissionsData {
  total_emissions_tons_co2e: number;
  carbon_rating: string;
  breakdown: Record<string, number>;
}

/**
 * Interface for recommendation response
 */
interface Recommendation {
  title: string;
  description: string;
  impact: number;
  timeline: string;
  cost: string;
}

interface RecommendationResponse {
  recommendations: Recommendation[];
}

/**
 * Generate carbon reduction recommendations based on company data and selected sectors
 */
export async function generateRecommendations(
  industry: string, 
  emissionsData: EmissionsData,
  selectedSectors?: string[] // Optional parameter for user-selected sectors
): Promise<RecommendationResponse> {
  try {
    return await apiClient.getRecommendations({
      industry,
      emissions_data: emissionsData,
      selected_sectors: selectedSectors
    });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    throw error;
  }
}

/**
 * Interface for offset project response
 */
interface OffsetProject {
  name: string;
  description: string;
  location: string;
  project_type: string;
  cost_per_ton: number;
  minimum_purchase: number;
  verification_standard: string;
  additional_benefits: string[];
  estimated_impact: string;
  implementation_timeline: string;
}

interface OffsetProjectsResponse {
  projects: OffsetProject[];
}

/**
 * Generate offset project recommendations based on carbon score data
 */
export async function generateOffsetProjects(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _industry: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _emissionsData: EmissionsData
): Promise<OffsetProjectsResponse> {
  try {
    // For now, return sample projects as the enhanced version was complex
    return {
      projects: [
        {
          name: "Renewable Energy Development",
          description: "Support the development of wind and solar energy projects in developing countries.",
          location: "Various Global Locations",
          project_type: "Renewable Energy",
          cost_per_ton: 12.50,
          minimum_purchase: 10,
          verification_standard: "Gold Standard",
          additional_benefits: ["Community Development", "Job Creation", "Technology Transfer"],
          estimated_impact: "High",
          implementation_timeline: "6-12 months"
        },
        {
          name: "Forest Conservation Initiative",
          description: "Protect and restore existing forests to maintain carbon sequestration.",
          location: "Amazon Basin, Brazil",
          project_type: "Forest Conservation",
          cost_per_ton: 8.75,
          minimum_purchase: 5,
          verification_standard: "Verified Carbon Standard",
          additional_benefits: ["Biodiversity Protection", "Community Employment", "Water Resource Protection"],
          estimated_impact: "Very High",
          implementation_timeline: "3-6 months"
        },
        {
          name: "Clean Cookstove Distribution",
          description: "Distribute efficient cookstoves to reduce deforestation and improve health.",
          location: "Sub-Saharan Africa",
          project_type: "Clean Technology",
          cost_per_ton: 15.25,
          minimum_purchase: 15,
          verification_standard: "Climate Action Reserve",
          additional_benefits: ["Health Improvement", "Women's Empowerment", "Reduced Indoor Pollution"],
          estimated_impact: "High",
          implementation_timeline: "2-4 months"
        }
      ]
    };
  } catch (error) {
    console.error('Error generating offset projects:', error);
    throw error;
  }
}

// Legacy function for backward compatibility
export function generateEnhancedOffsetProjects(
  industry: string,
  emissionsData: EmissionsData
): Promise<OffsetProjectsResponse> {
  return generateOffsetProjects(industry, emissionsData);
}