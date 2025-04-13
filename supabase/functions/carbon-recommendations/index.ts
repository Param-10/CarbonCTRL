import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.2.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompanyData {
  industry: string;
  emissions_data: {
    total_emissions: number;
    breakdown: Record<string, number>;
    grade: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Configuration Error',
          details: 'Gemini API key not configured. Please check environment variables.'
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

    const { industry, emissions_data }: CompanyData = await req.json();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `As a carbon emissions expert, provide 3 specific, actionable recommendations for a ${industry} company to reduce their carbon footprint. Their current emissions are ${emissions_data.total_emissions} tonnes CO2e (Grade: ${emissions_data.grade}).

    Emission breakdown by sector:
    ${Object.entries(emissions_data.breakdown)
      .map(([sector, amount]) => `- ${sector}: ${amount} tonnes CO2e`)
      .join('\n')}

    For each recommendation, include:
    1. A clear action item
    2. Estimated impact (% reduction)
    3. Implementation timeline
    4. Potential cost savings
    5. Available tax benefits, credits, or grants
    6. ROI calculation where possible

    Focus on:
    - Industry-specific solutions
    - Quick wins and long-term strategies
    - Cost-effective measures
    - Available government incentives
    - Technology upgrades
    - Process optimizations

    Format your response as JSON with the following structure:
    {
      "recommendations": [
        {
          "action": "string",
          "impact": "string",
          "timeline": "string",
          "savings": "string",
          "incentives": "string",
          "tax_benefits": "string"
        }
      ]
    }

    Only respond with valid JSON, no other text.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const recommendations = JSON.parse(response.text());

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
        details: error.message
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