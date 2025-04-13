import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Initialize the Gemini API client
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Interface for emissions data passed to the recommendation generator
 */
interface EmissionsData {
  total_emissions: number;
  breakdown: Record<string, number>;
  grade: string;
}

/**
 * Interface for recommendation response
 */
export interface Recommendation {
  action: string;
  impact: string;
  timeline: string;
  savings: string;
  incentives: string;
  tax_benefits: string;
  reasoning: string; // Added reasoning field to explain recommendation
}

export interface RecommendationResponse {
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
    if (!apiKey) {
      throw new Error('Gemini API key not found');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    // Get top 3 sectors by emission amount or use user-selected sectors if provided
    const sortedSectors = Object.entries(emissionsData.breakdown)
      .sort(([, a], [, b]) => b - a);
    
    const targetSectors = selectedSectors || sortedSectors.slice(0, 3).map(([sector]) => sector);
    
    // Create a more detailed breakdown focusing on selected sectors
    const breakdownString = Object.entries(emissionsData.breakdown)
      .filter(([sector]) => targetSectors.includes(sector))
      .map(([sector, amount]) => 
        `- ${sector}: ${amount.toFixed(2)} tonnes CO₂e (${((amount / emissionsData.total_emissions) * 100).toFixed(1)}% of total)`
      )
      .join('\n');

    const prompt = `You are a carbon reduction expert advisor. Create ${targetSectors.length} specific, actionable recommendations for a ${industry} company to reduce their carbon footprint, with one focused recommendation for EACH of these specific sectors: ${targetSectors.join(', ')}.

Current emissions profile:
- Total emissions: ${emissionsData.total_emissions.toFixed(2)} tonnes CO₂e
- Carbon rating: ${emissionsData.grade}
- Emission breakdown by SELECTED sectors:
${breakdownString}

For each recommendation, include:
1. A clear action item (specific and achievable) targeted EXCLUSIVELY at one of the listed sectors
2. Estimated impact (percentage reduction in emissions)
3. Implementation timeline (in months or years)
4. Potential cost savings (dollar amounts or ranges)
5. Available tax benefits, credits, or incentives
6. A 1-2 sentence explanation of WHY this recommendation is specifically relevant to the sector's emissions profile

Focus on:
- ONLY solutions that directly address the specified sectors' emissions
- Industry-specific solutions that are realistic for ${industry} companies
- A mix of quick wins and longer-term strategic initiatives
- Cost-effective measures with positive ROI
- Government incentives, grants, or tax benefits available in 2024
- Technology upgrades or process optimizations relevant to the emission breakdown

Format your response as a clean JSON object with this exact structure:
{
  "recommendations": [
    {
      "action": "Brief title of the recommendation",
      "impact": "Percentage reduction (e.g., '10-15% reduction')",
      "timeline": "Implementation period (e.g., '6-12 months')",
      "savings": "Cost savings (e.g., '$50,000-75,000 annually')",
      "incentives": "Available incentives (e.g., 'Green Energy Tax Credit')",
      "tax_benefits": "Tax details (e.g., '30% tax credit up to $100,000')",
      "reasoning": "1-2 sentence explanation why this is recommended based on the sector's specific emissions profile"
    }
  ]
}

Match each recommendation to exactly ONE of the specified sectors. Make sure you create one recommendation per sector.
Ensure your response is ONLY valid JSON with no other text, markdown, or explanation.`;

    const generationConfig = {
      temperature: 0.2,
      topP: 0.8,
      maxOutputTokens: 1000,
    };

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const responseText = result.response.text();
    console.log('Gemini response:', responseText);

    // Clean up the response text
    let cleanedText = responseText.trim();
    // If response starts with ``` or ends with ```, remove them (markdown code blocks)
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.substring(7);
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.substring(3);
    }
    
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.substring(0, cleanedText.length - 3);
    }

    cleanedText = cleanedText.trim();

    // Parse the JSON
    const recommendations = JSON.parse(cleanedText) as RecommendationResponse;
    return recommendations;
  } catch (error) {
    console.error('Error generating recommendations:', error);
    throw error;
  }
}

/**
 * Interface for offset project response
 */
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

export interface OffsetProjectsResponse {
  projects: OffsetProject[];
}

/**
 * Enhanced interface for offset project response with additional web data
 */
export interface EnhancedOffsetProject extends OffsetProject {
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

export interface EnhancedOffsetProjectsResponse {
  projects: EnhancedOffsetProject[];
}

/**
 * Generate offset project recommendations based on carbon score data
 */
export async function generateOffsetProjects(
  industry: string,
  emissionsData: EmissionsData
): Promise<OffsetProjectsResponse> {
  try {
    if (!apiKey) {
      throw new Error('Gemini API key not found');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    // Get top 3 sectors by emission amount
    const topSectors = Object.entries(emissionsData.breakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([sector]) => sector);
    
    // Create a breakdown of top emission sectors
    const breakdownString = Object.entries(emissionsData.breakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([sector, amount]) => 
        `- ${sector}: ${amount.toFixed(2)} tonnes CO₂e (${((amount / emissionsData.total_emissions) * 100).toFixed(1)}% of total)`
      )
      .join('\n');

    const prompt = `You are a carbon offset expert advisor. Create 4 specific, real-world carbon offset project recommendations for a ${industry} company based on their emissions profile.

Current emissions profile:
- Total emissions: ${emissionsData.total_emissions.toFixed(2)} tonnes CO₂e
- Carbon rating: ${emissionsData.grade}
- Key emission sectors: ${topSectors.join(', ')}
- Emission breakdown by top sectors:
${breakdownString}

For each offset project recommendation, include:
1. A specific project name that exists in the real world or could plausibly exist
2. A brief but descriptive explanation of the project and how it offsets carbon
3. A realistic location where the project operates
4. Realistic cost per ton of carbon offset (in USD)
5. A realistic total cost estimation for offsetting 25% of their emissions
6. Realistic certifications or standards the project adheres to (e.g., Gold Standard, VCS)
7. A realistic CO2 reduction estimate (in tons)
8. Realistic implementation timeframe
9. Specific environmental or social impact beyond carbon reduction
10. A plausible website URL where the user could learn more about such projects
11. An explanation of which emission sector(s) this offset project aligns with

Create projects that:
- Represent a diverse range of offset approaches (forestry, renewable energy, methane capture, etc.)
- Include a mix of project locations (domestic and international)
- Align with the company's highest emission sectors
- Have realistic costs per ton ($5-30 per ton CO2e)
- Include only certifications and standards that actually exist
- Provide realistic website URLs (either to actual carbon project registries or organizations)

Format your response as a clean JSON object with this exact structure:
{
  "projects": [
    {
      "name": "Project name",
      "description": "Brief project description",
      "location": "Project location",
      "cost_per_ton": "$X per ton CO2e",
      "total_cost": "$X for Y tons",
      "certification": "Relevant certification",
      "co2_reduction": "X tons per year",
      "timeframe": "Implementation period",
      "impact": "Additional environmental/social benefits",
      "website_url": "https://example.com",
      "sector_alignment": "Which emission sector(s) this aligns with"
    }
  ]
}

Ensure your response is ONLY valid JSON with no other text, markdown, or explanation.`;

    const generationConfig = {
      temperature: 0.3,
      topP: 0.8,
      maxOutputTokens: 1500,
    };

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const responseText = result.response.text();
    console.log('Gemini offset projects response:', responseText);

    // Clean up the response text
    let cleanedText = responseText.trim();
    // If response starts with ``` or ends with ```, remove them (markdown code blocks)
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.substring(7);
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.substring(3);
    }
    
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.substring(0, cleanedText.length - 3);
    }

    cleanedText = cleanedText.trim();

    // Parse the JSON
    const offsetProjects = JSON.parse(cleanedText) as OffsetProjectsResponse;
    return offsetProjects;
  } catch (error) {
    console.error('Error generating offset projects:', error);
    throw error;
  }
}

/**
 * Generate offset project recommendations with web search data
 */
export async function generateEnhancedOffsetProjects(
  industry: string,
  emissionsData: EmissionsData
): Promise<EnhancedOffsetProjectsResponse> {
  try {
    if (!apiKey) {
      throw new Error('Gemini API key not found');
    }

    // First get base project recommendations
    const baseProjects = await generateOffsetProjects(industry, emissionsData);
    
    // Initialize enhanced model with web search capability
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      generationConfig: {
        temperature: 0.4,
        topP: 0.8,
        topK: 32,
        maxOutputTokens: 2048,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });

    const enhancedProjects: EnhancedOffsetProject[] = [];

    // Process each project with web search to get enhanced details
    for (const project of baseProjects.projects) {
      const searchQuery = `${project.name} carbon offset project ${project.certification} ${project.location}`;
      
      const prompt = `You are a carbon offset researcher helping to enhance information about specific carbon offset projects. I need you to search the web for the following project and provide detailed, factual information that would help a company implement or invest in this carbon offset initiative.

Project Details to Research:
- Name: ${project.name}
- Description: ${project.description}
- Location: ${project.location}
- Certification: ${project.certification}
- Sector Alignment: ${project.sector_alignment}

Please search the web and find:
1. A representative image URL for this project or similar projects (must be a direct image URL)
2. 2-3 implementation links where users can learn more or participate (with titles and URLs)
3. 3-5 additional important details about this project type that weren't in the original description (like implementation timeline, monitoring practices, local community benefits, etc.)

Format your response as a clean JSON object with this exact structure:
{
  "image_url": "https://example.com/image.jpg",
  "implementation_links": [
    {"title": "Link Title 1", "url": "https://example.com/1"},
    {"title": "Link Title 2", "url": "https://example.com/2"}
  ],
  "additional_details": [
    {"category": "Detail Category 1", "value": "Detail information 1"},
    {"category": "Detail Category 2", "value": "Detail information 2"}
  ]
}

Ensure your response is ONLY valid JSON with no other text, markdown, or explanation. If you can't find specific information about this exact project, provide information about similar projects in the same category (e.g., similar forest conservation projects in the same region).`;

      try {
        console.log(`Searching web for enhanced details about: ${project.name}`);
        
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        const responseText = result.response.text();
        console.log('Gemini web search response:', responseText);

        // Clean up the response text
        let cleanedText = responseText.trim();
        if (cleanedText.startsWith('```json')) {
          cleanedText = cleanedText.substring(7);
        } else if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.substring(3);
        }
        
        if (cleanedText.endsWith('```')) {
          cleanedText = cleanedText.substring(0, cleanedText.length - 3);
        }

        cleanedText = cleanedText.trim();

        // Parse the enhanced data
        const enhancedData = JSON.parse(cleanedText);
        
        // Combine base project with enhanced data
        enhancedProjects.push({
          ...project,
          image_url: enhancedData.image_url,
          implementation_links: enhancedData.implementation_links,
          additional_details: enhancedData.additional_details
        });
        
      } catch (error) {
        console.error(`Error enhancing project ${project.name}:`, error);
        // If enhancement fails, still include the base project
        enhancedProjects.push({
          ...project,
          image_url: "",
          implementation_links: [],
          additional_details: []
        });
      }
    }

    return { projects: enhancedProjects };
  } catch (error) {
    console.error('Error generating enhanced offset projects:', error);
    throw error;
  }
}