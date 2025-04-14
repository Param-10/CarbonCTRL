import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.2.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

interface CompanyData {
  industry: string;
  emissions_data: {
    total_emissions: number;
    breakdown: Record<string, number>;
    grade: string;
  };
}

interface Recommendation {
  action: string;
  impact: string;
  timeline: string;
  savings: string;
  incentives: string;
  tax_benefits: string;
}

interface RecommendationsResponse {
  recommendations: Recommendation[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Fix: Use Deno.env.get with proper error handling for Supabase Edge Functions
    let apiKey;
    try {
      apiKey = Deno.env.get('GEMINI_API_KEY');
    } catch (envError) {
      console.error('Error accessing environment variables:', envError);
      return new Response(
        JSON.stringify({
          error: 'Configuration Error',
          details: 'Cannot access environment variables. Make sure they are properly set in Supabase.'
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Configuration Error',
          details: 'Gemini API key not configured. Please check environment variables in Supabase dashboard.'
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const requestData = await req.json();
    
    if (!requestData.industry || !requestData.emissions_data) {
      return new Response(
        JSON.stringify({
          error: 'Invalid Request',
          details: 'Missing required fields: industry and emissions_data'
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    const { industry, emissions_data }: CompanyData = requestData;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const breakdownString = Object.entries(emissions_data.breakdown)
      .map(([sector, amount]) => `- ${sector}: ${amount.toFixed(2)} tonnes CO₂e`)
      .join('\n');

    const prompt = `You are a carbon reduction expert advisor. Create 3 specific, actionable recommendations for a ${industry} company to reduce their carbon footprint.

Current emissions profile:
- Total emissions: ${emissions_data.total_emissions.toFixed(2)} tonnes CO₂e
- Carbon rating: ${emissions_data.grade}
- Emission breakdown by sector:
${breakdownString}

For each recommendation, include:
1. A clear action item (specific and achievable)
2. Estimated impact (percentage reduction in emissions)
3. Implementation timeline (in months or years)
4. Potential cost savings (dollar amounts or ranges)
5. Available tax benefits, credits, or incentives
6. Return on investment information where applicable

Focus on:
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
      "tax_benefits": "Tax details (e.g., '30% tax credit up to $100,000')"
    },
    {
      // Additional recommendations
    }
  ]
}

Ensure your response is ONLY valid JSON with no other text, markdown, or explanation. Check that all field values are strings and there are exactly 3 recommendations.`;

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

    let recommendations: RecommendationsResponse;
    try {
      recommendations = JSON.parse(responseText.trim());
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          recommendations = JSON.parse(jsonMatch[0]);
        } catch (extractError) {
          throw new Error('Failed to parse Gemini response as JSON');
        }
      } else {
        throw new Error('Failed to parse Gemini response as JSON');
      }
    }

    if (!recommendations.recommendations || !Array.isArray(recommendations.recommendations)) {
      throw new Error('Invalid response format: missing recommendations array');
    }

    return new Response(
      JSON.stringify(recommendations),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Error generating recommendations:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to generate recommendations',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});