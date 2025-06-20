import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import auth from '../middleware/auth.js';

const router = express.Router();

// Carbon calculator
router.post('/carbon-calculator', auth, async (req, res) => {
  try {
    const { company_name, activities } = req.body;

    if (!activities || !Array.isArray(activities)) {
      return res.status(400).json({ error: 'Activities array is required' });
    }

    // Emission factors (simplified version from original Supabase function)
    const emissionFactors = {
      agriculture: {
        'cropland-fires': 0.5,
        'synthetic-fertilizer-application': 0.3,
        'manure-management': 0.4,
        'rice-cultivation': 0.6,
        'enteric-fermentation': 0.8,
        'crop-residues': 0.2
      },
      energy: {
        'fuel-combustion': 0.25,
        'fugitive-emissions': 0.35,
        'electricity': 0.45
      },
      industrial: {
        'cement-production': 1.2,
        'chemical-production': 0.8,
        'metal-production': 1.5
      },
      transportation: {
        'road-transport': 0.15,
        'aviation': 0.25,
        'shipping': 0.12
      },
      waste: {
        'landfill': 0.6,
        'wastewater': 0.3
      }
    };

    function calculateScore(companyData) {
      let totalEmissions = 0;
      const breakdown = {};

      // Calculate emissions for each activity
      for (const activity of companyData.activities) {
        const factor = emissionFactors[activity.sector]?.[activity.subsector];
        
        if (factor) {
          const emissions = activity.activity_amount * factor;
          totalEmissions += emissions;
          
          if (!breakdown[activity.sector]) {
            breakdown[activity.sector] = 0;
          }
          breakdown[activity.sector] += emissions;
        }
      }

      // Determine carbon rating
      let carbonRating;
      if (totalEmissions < 10) carbonRating = 'A+';
      else if (totalEmissions < 25) carbonRating = 'A';
      else if (totalEmissions < 50) carbonRating = 'B';
      else if (totalEmissions < 100) carbonRating = 'C';
      else if (totalEmissions < 200) carbonRating = 'D';
      else carbonRating = 'F';

      return {
        company_name: companyData.company_name,
        total_emissions_tons_co2e: totalEmissions,
        carbon_rating: carbonRating,
        emissions_breakdown: breakdown,
        improvement_potential: Math.max(0, totalEmissions * 0.3),
        benchmark_comparison: totalEmissions > 50 ? 'Above average' : 'Below average'
      };
    }

    const result = calculateScore({ company_name, activities });
    res.json(result);
  } catch (error) {
    console.error('Carbon calculator error:', error);
    res.status(500).json({ error: 'Error calculating carbon score' });
  }
});

// Carbon recommendations
router.post('/carbon-recommendations', auth, async (req, res) => {
  try {
    const { industry, emissions_data } = req.body;

    if (!industry || !emissions_data) {
      return res.status(400).json({ 
        error: 'Industry and emissions_data are required' 
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Gemini API key not configured' 
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const breakdownString = Object.entries(emissions_data.breakdown)
      .map(([sector, amount]) => `- ${sector}: ${amount.toFixed(2)} tonnes CO₂e`)
      .join('\n');

    const prompt = `As a carbon management expert, provide 4-6 specific, actionable recommendations for a ${industry} company to reduce their carbon emissions.

Current emissions breakdown:
${breakdownString}
Total emissions: ${emissions_data.total_emissions_tons_co2e.toFixed(2)} tonnes CO₂e
Current grade: ${emissions_data.carbon_rating}

For each recommendation, provide:
1. A clear title
2. Detailed description (2-3 sentences)
3. Estimated impact in tonnes CO₂e reduced
4. Implementation timeline
5. Estimated cost (Low/Medium/High)

Format your response as a JSON object with this structure:
{
  "recommendations": [
    {
      "title": "Recommendation title",
      "description": "Detailed description",
      "impact": 5.2,
      "timeline": "3-6 months",
      "cost": "Medium"
    }
  ]
}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048,
      },
    });

    const responseText = result.response.text();
    let recommendations;

    try {
      const cleanedText = responseText.replace(/```json|```/g, '').trim();
      recommendations = JSON.parse(cleanedText);
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      // Fallback recommendations
      recommendations = {
        recommendations: [
          {
            title: "Energy Efficiency Improvements",
            description: "Upgrade to LED lighting and energy-efficient equipment to reduce electricity consumption.",
            impact: 3.5,
            timeline: "2-4 months",
            cost: "Medium"
          },
          {
            title: "Renewable Energy Transition",
            description: "Install solar panels or switch to renewable energy suppliers to reduce scope 2 emissions.",
            impact: 8.2,
            timeline: "6-12 months",
            cost: "High"
          }
        ]
      };
    }

    res.json(recommendations);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ 
      error: 'Failed to generate recommendations',
      details: error.message 
    });
  }
});

// Tax benefits
router.post('/tax-benefits', auth, async (req, res) => {
  try {
    const { company_profile, emissions_data } = req.body;

    // Fallback tax benefits if AI fails or isn't needed
    const fallbackBenefits = [
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
    ];

    res.json({ tax_benefits: fallbackBenefits });
  } catch (error) {
    console.error('Error generating tax benefits:', error);
    res.status(500).json({ error: 'Error generating tax benefits' });
  }
});

export default router; 