import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.2.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompanyData {
  industry: string;
  sector: string;
  emissions: number;
  region?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const data: CompanyData = await req.json();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `As a tax and sustainability expert, provide detailed tax benefit information for a ${data.industry} company in the ${data.sector} sector with annual emissions of ${data.emissions} tonnes CO2e.

    Focus on:
    1. Federal tax credits and deductions
    2. State-level incentives
    3. Industry-specific benefits
    4. Energy efficiency programs
    5. Clean technology investments
    6. Carbon offset initiatives

    Format the response as JSON with this structure:
    {
      "tax_benefits": [
        {
          "name": "string",
          "description": "string",
          "eligibility": "string",
          "value": "string",
          "timeline": "string",
          "requirements": "string"
        }
      ]
    }

    Only respond with valid JSON, no other text.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const benefits = JSON.parse(response.text());

    return new Response(
      JSON.stringify(benefits),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Error generating tax benefits:', error);

    // Fallback tax benefits if AI fails
    return new Response(
      JSON.stringify({
        tax_benefits: [
          {
            name: "Energy Efficiency Tax Credit",
            description: "Federal tax credit for energy-efficient improvements",
            eligibility: "All businesses implementing qualified improvements",
            value: "Up to 30% of qualified expenses",
            timeline: "Available through 2025",
            requirements: "Must meet energy reduction thresholds"
          },
          {
            name: "Clean Vehicle Credit",
            description: "Tax credit for electric and hybrid vehicle purchases",
            eligibility: "Business vehicles under 14,000 lbs",
            value: "Up to $7,500 per vehicle",
            timeline: "Current tax year",
            requirements: "Must be new, qualified clean vehicle"
          },
          {
            name: "Carbon Offset Investment Deduction",
            description: "Deduction for verified carbon offset investments",
            eligibility: "Businesses with documented offset purchases",
            value: "100% deduction of investment cost",
            timeline: "Current tax year",
            requirements: "Must use verified offset providers"
          }
        ]
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});