import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import auth from '../middleware/auth.js';
import { getLegacyEmissionFactors, getEmissionFactor, isValidCombination } from '../config/emissionFactors.js';
import User from '../models/User.js';
import CompanyProfile from '../models/CompanyProfile.js';
import CarbonActivity from '../models/CarbonActivity.js';

const router = express.Router();

// Get available emission factors and sectors
router.get('/emission-factors', auth, async (req, res) => {
  try {
    const { EMISSION_FACTORS, getAvailableSectors, getSubsectors } = await import('../config/emissionFactors.js');
    
    res.json({
      sectors: getAvailableSectors(),
      emission_factors: EMISSION_FACTORS,
      // Helper function results
      getSectors: () => getAvailableSectors(),
      getSubsectors: (sector) => getSubsectors(sector)
    });
  } catch (error) {
    console.error('Error fetching emission factors:', error);
    res.status(500).json({ error: 'Error fetching emission factors' });
  }
});

// Carbon calculator
router.post('/carbon-calculator', auth, async (req, res) => {
  try {
    const { company_name, activities } = req.body;

    if (!activities || !Array.isArray(activities)) {
      return res.status(400).json({ error: 'Activities array is required' });
    }

    // Get emission factors from centralized configuration
    const emissionFactors = getLegacyEmissionFactors();

    function calculateScore(companyData) {
      let totalEmissions = 0;
      const breakdown = {};

      console.log('Calculating score for activities:', companyData.activities);

      // Calculate emissions for each activity
      for (const activity of companyData.activities) {
        console.log(`Processing activity: ${activity.sector}/${activity.subsector}, amount: ${activity.activity_amount}`);
        
        const factor = emissionFactors[activity.sector]?.[activity.subsector];
        console.log(`Emission factor: ${factor}`);
        
        if (factor) {
          const emissions = activity.activity_amount * factor;
          console.log(`Calculated emissions: ${emissions}`);
          totalEmissions += emissions;
          
          if (!breakdown[activity.sector]) {
            breakdown[activity.sector] = 0;
          }
          breakdown[activity.sector] += emissions;
        } else {
          console.log(`No emission factor found for ${activity.sector}/${activity.subsector}`);
          console.log(`Available sectors:`, Object.keys(emissionFactors));
          if (emissionFactors[activity.sector]) {
            console.log(`Available subsectors for ${activity.sector}:`, Object.keys(emissionFactors[activity.sector]));
          }
        }
      }

      console.log(`Total emissions: ${totalEmissions}, breakdown:`, breakdown);

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

// Enhanced carbon recommendations with ML + Gemini integration
router.post('/carbon-recommendations', auth, async (req, res) => {
  try {
    const { industry, emissions_data, selected_sectors } = req.body;

    if (!industry || !emissions_data) {
      return res.status(400).json({ 
        error: 'Industry and emissions_data are required' 
      });
    }

    // Get user and company data for personalization
    const userId = req.user.id;
    const user = await User.findById(userId);
    const companyProfile = await CompanyProfile.findOne({ userId });
    const activities = await CarbonActivity.find({ userId });

    // **NEW: Try to use our trained ML recommendation engine first**
    let mlRecommendations = [];
    try {
      // Import and use our ML models
      const { spawn } = require('child_process');
      const path = require('path');
      
      const runMLScript = (scriptPath, data) => {
        return new Promise((resolve, reject) => {
          const python = spawn('python3', [scriptPath, JSON.stringify(data)]);
          
          let dataString = '';
          let errorString = '';
          
          python.stdout.on('data', (data) => {
            dataString += data.toString();
          });
          
          python.stderr.on('data', (data) => {
            errorString += data.toString();
          });
          
          python.on('close', (code) => {
            if (code !== 0) {
              reject(new Error(`ML script failed: ${errorString}`));
            } else {
              try {
                const result = JSON.parse(dataString);
                resolve(result);
              } catch (e) {
                resolve({ recommendations: [] });
              }
            }
          });
        });
      };

      // Prepare data for our ML model
      const mlData = {
        total_emissions: emissions_data.total_emissions_tons_co2e,
        energy_consumption: emissions_data.breakdown['Energy'] || 0,
        transportation: emissions_data.breakdown['Transportation'] || 0,
        waste_generation: emissions_data.breakdown['Waste Management'] || 0,
        water_usage: emissions_data.breakdown['Water'] || 0,
        employee_count: companyProfile?.employees?.match(/\d+/)?.[0] || 50,
        industry: industry.toLowerCase(),
        budget_level: 2,
        urgency_level: 2
      };

      // Call our ML recommendation script
      const mlScriptPath = path.join(__dirname, '../../ml/recommend.py');
      const mlResult = await runMLScript(mlScriptPath, mlData);
      mlRecommendations = mlResult.recommendations || [];
      
      console.log(`✅ ML recommendations loaded: ${mlRecommendations.length} suggestions`);
      
    } catch (mlError) {
      console.log(`⚠️ ML recommendations unavailable: ${mlError.message}`);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    // Create enhanced fallback recommendations based on user data
    const createEnhancedFallback = () => {
      // If we have ML recommendations, use them as base
      if (mlRecommendations.length > 0) {
        console.log('🔄 Using ML recommendations as fallback base');
        return {
          recommendations: mlRecommendations.slice(0, 6),
          summary: {
            total_potential_reduction: mlRecommendations.reduce((sum, rec) => 
              sum + (rec.predicted_impact?.annual_co2_reduction || 0), 0),
            quick_wins_count: mlRecommendations.filter(rec => 
              rec.priority === 'High').length,
            strategic_initiatives_count: mlRecommendations.filter(rec => 
              rec.priority === 'Medium' || rec.priority === 'Low').length,
            estimated_total_investment: "Medium",
            payback_period: "12-24 months",
            source: "ML Engine"
          }
        };
      }

      // Original fallback logic for when ML is not available
      const topSectors = Object.entries(emissions_data.breakdown)
        .sort(([, a], [, b]) => b - a);
      
      const recommendations = [];
      const companySize = companyProfile?.employees || '1-10';
      const location = companyProfile?.location || 'United States';
      const isSmallCompany = companySize.includes('1-10') || companySize.includes('11-50');

      // Add industry-specific recommendations (keeping original logic)
      if (industry.toLowerCase().includes('tech') || industry.toLowerCase().includes('software')) {
        recommendations.push({
          id: 1,
          title: "Carbon-Efficient Cloud and Infrastructure Optimization",
          category: "Technology",
          description: `Optimize cloud infrastructure for carbon efficiency by migrating to providers with renewable energy commitments (AWS, Google Cloud green regions). Implement automated scaling to reduce idle resource consumption and adopt sustainable coding practices to minimize computational demands.`,
          impact_level: "high",
          cost_level: "medium",
          implementation_time: "3-6 months",
          annual_savings: "20-50% computing emissions reduction",
          tags: ["cloud", "efficiency", "technology"],
          scores: {
            impact_score: 0.85,
            feasibility_score: 0.75,
            combined_score: 0.80
          },
          predicted_impact: {
            annual_co2_reduction: emissions_data.total_emissions_tons_co2e * 0.25,
            percentage_reduction: 25
          },
          priority: "High"
        });
      }

      // Add more fallback recommendations...
      recommendations.push({
        id: 2,
        title: "Employee Engagement and Sustainability Training",
        category: "Human Resources",
        description: `Launch a comprehensive employee sustainability program including carbon literacy training, green commuting incentives, and sustainability innovation challenges. Create sustainability champions network and implement behavior change initiatives with measurable targets.`,
        impact_level: "medium",
        cost_level: "low",
        implementation_time: "1-3 months",
        annual_savings: "10-20% behavioral emissions reduction",
        tags: ["training", "engagement", "behavior"],
        scores: {
          impact_score: 0.65,
          feasibility_score: 0.90,
          combined_score: 0.75
        },
        predicted_impact: {
          annual_co2_reduction: emissions_data.total_emissions_tons_co2e * 0.1,
          percentage_reduction: 10
        },
        priority: "Medium"
      });

      const totalPotentialReduction = recommendations.reduce((sum, rec) => 
        sum + rec.predicted_impact.annual_co2_reduction, 0);
      
      return {
        recommendations: recommendations.slice(0, 6),
        summary: {
          total_potential_reduction: totalPotentialReduction,
          quick_wins_count: 1,
          strategic_initiatives_count: recommendations.length - 1,
          estimated_total_investment: "Low to Medium",
          payback_period: "12-24 months",
          source: "Enhanced Fallback"
        }
      };
    };

    // If no Gemini API key, use ML + fallback
    if (!apiKey || apiKey.includes('your-') || apiKey === 'AIzaSyCbxK1f8LQ0pzGaZqJxR4bH9nK1mW3vYxI') {
      console.log('Using ML + enhanced fallback recommendations');
      const fallbackData = createEnhancedFallback();
      return res.json(fallbackData);
    }

    // **ENHANCED: Use ML recommendations + Gemini intelligence**
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Create comprehensive context for personalization
    const breakdownString = Object.entries(emissions_data.breakdown)
      .map(([sector, amount]) => `- ${sector}: ${amount.toFixed(2)} tonnes CO₂e (${((amount / emissions_data.total_emissions_tons_co2e) * 100).toFixed(1)}%)`)
      .join('\n');

    const activitiesString = activities.length > 0 
      ? activities.map(act => `- ${act.sector}/${act.subsector}: ${act.activityAmount} ${act.activityUnit}`).join('\n')
      : 'No specific activities recorded';

    const selectedSectorsString = selected_sectors && selected_sectors.length > 0
      ? `Focus areas selected by user: ${selected_sectors.join(', ')}`
      : 'No specific focus areas selected';

    // Include ML recommendations in the prompt for Gemini to enhance
    const mlRecommendationsString = mlRecommendations.length > 0 
      ? `\nML MODEL RECOMMENDATIONS (enhance these with context):\n${mlRecommendations.map((rec, i) => 
          `${i+1}. ${rec.title}: ${rec.description} (Impact: ${rec.predicted_impact?.annual_co2_reduction || 0} tons CO2/year)`
        ).join('\n')}`
      : '\nNo ML recommendations available - create original recommendations.';

    // Enhanced prompt with ML integration
    const prompt = `You are a world-class carbon management consultant providing personalized recommendations. ${mlRecommendations.length > 0 ? 'ENHANCE and CONTEXTUALIZE the ML-generated recommendations below, or suggest better alternatives.' : 'Analyze the data and provide recommendations.'}

COMPANY PROFILE:
- Company: ${companyProfile?.name || 'Not specified'}
- Industry: ${industry}
- Size: ${companyProfile?.employees || 'Not specified'} employees
- Location: ${companyProfile?.location || 'Not specified'}
- Founded: ${companyProfile?.founded || 'Not specified'}
- Description: ${companyProfile?.description || 'Not provided'}

CARBON FOOTPRINT ANALYSIS:
- Total Emissions: ${emissions_data.total_emissions_tons_co2e.toFixed(2)} tonnes CO₂e
- Current Rating: ${emissions_data.carbon_rating}
- Performance: ${emissions_data.total_emissions_tons_co2e > 50 ? 'Above industry average - urgent action needed' : 'Below average - good foundation for improvement'}

EMISSIONS BREAKDOWN:
${breakdownString}

CURRENT ACTIVITIES:
${activitiesString}

USER PREFERENCES:
${selectedSectorsString}${mlRecommendationsString}

INSTRUCTIONS:
${mlRecommendations.length > 0 ? 
  '1. REVIEW the ML recommendations above and ENHANCE them with industry context, specific implementation details, and realistic timelines\n2. ADD 1-2 additional recommendations that complement the ML suggestions\n3. PRIORITIZE based on this company\'s specific profile and emission sources' :
  '1. CREATE 4-6 original recommendations based on the company profile\n2. PRIORITIZE the highest-impact emission sources first\n3. Consider industry-specific challenges and opportunities'
}
4. Factor in company size and location for feasibility
5. Include both quick wins (0-6 months) and strategic initiatives (6+ months)
6. Consider regulatory requirements and industry best practices for ${industry}
7. Provide cost-effective solutions with clear ROI potential

For each recommendation, provide:
- title: Clear, actionable title
- description: Detailed explanation (3-4 sentences) with implementation steps
- impact: Estimated CO₂e reduction in tonnes per year
- timeline: Implementation timeframe 
- cost: Investment level (Low: <$10k, Medium: $10k-50k, High: >$50k)
- roi_months: Expected payback period in months
- priority: High/Medium/Low based on impact vs effort
- industry_specific: Why this is particularly relevant for ${industry}

RESPONSE FORMAT (valid JSON only):
{
  "recommendations": [
    {
      "title": "Specific recommendation title",
      "description": "Detailed implementation description with concrete steps",
      "impact": 12.5,
      "timeline": "3-6 months",
      "cost": "Medium",
      "roi_months": 18,
      "priority": "High",
      "industry_specific": "Why this matters for your industry"
    }
  ],
  "summary": {
    "total_potential_reduction": 45.2,
    "quick_wins_count": 2,
    "strategic_initiatives_count": 3,
    "estimated_total_investment": "Medium to High",
    "payback_period": "12-24 months",
    "source": "${mlRecommendations.length > 0 ? 'ML + Gemini Enhanced' : 'Gemini AI'}"
  }
}`;

    console.log(`🧠 Sending ${mlRecommendations.length > 0 ? 'ML-enhanced' : 'original'} prompt to Gemini 2.5 Flash...`);

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 4096,
      },
    });

    const responseText = result.response.text();
    console.log('Gemini response received:', responseText.substring(0, 200) + '...');

    let recommendations;
    
    try {
      // Clean and parse Gemini response
      const cleanResponse = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      
      recommendations = JSON.parse(cleanResponse);
      
      if (!recommendations.recommendations || !Array.isArray(recommendations.recommendations)) {
        throw new Error('Invalid recommendations format');
      }
      
      console.log(`✅ Gemini recommendations parsed: ${recommendations.recommendations.length} suggestions`);
      
      // Add source indicator
      if (!recommendations.summary) {
        recommendations.summary = {};
      }
      recommendations.summary.source = mlRecommendations.length > 0 ? 'ML + Gemini Enhanced' : 'Gemini AI';
      
      res.json(recommendations);
      
    } catch (parseError) {
      console.error('Gemini JSON parse error:', parseError.message);
      console.log('Raw response:', responseText);
      
      // If Gemini fails, fall back to ML + enhanced fallback
      console.log('🔄 Falling back to ML + enhanced recommendations due to Gemini parse error');
      const fallbackData = createEnhancedFallback();
      res.json(fallbackData);
    }
    
  } catch (error) {
    console.error('Carbon recommendations error:', error);
    
    // Final fallback
    const topSectors = Object.entries(req.body.emissions_data?.breakdown || {})
      .sort(([, a], [, b]) => b - a);
    
    const fallbackRecommendations = [
      {
        title: "Energy Efficiency Audit",
        description: "Conduct a comprehensive energy audit to identify immediate savings opportunities.",
        impact: 5.0,
        timeline: "1-2 months",
        cost: "Low",
        roi_months: 12,
        priority: "High",
        industry_specific: "Universal application across all industries"
      }
    ];
    
    res.json({
      recommendations: fallbackRecommendations,
      summary: {
        total_potential_reduction: 5.0,
        quick_wins_count: 1,
        strategic_initiatives_count: 0,
        estimated_total_investment: "Low",
        payback_period: "12 months",
        source: "Emergency Fallback"
      },
      error: "Using basic fallback due to system error"
    });
  }
});

// Enhanced tax benefits with personalization
router.post('/tax-benefits', auth, async (req, res) => {
  try {
    const { company_profile, emissions_data } = req.body;
    
    // Get user and company data for personalization
    const userId = req.user.id;
    const user = await User.findById(userId);
    const companyProfile = await CompanyProfile.findOne({ userId });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Return enhanced fallback benefits
      const fallbackBenefits = [
        {
          name: "Section 179D Energy Efficiency Deduction",
          description: "Federal tax deduction for energy-efficient commercial building improvements",
          eligibility: `${companyProfile?.industry || 'All'} businesses with commercial buildings`,
          value: "Up to $5.00 per sq ft for qualifying improvements",
          timeline: "Available through 2025, then permanent",
          requirements: "Must meet specific energy reduction thresholds (25-50%)",
          estimated_benefit: companyProfile?.employees ? `$${Math.min(50000, parseInt(companyProfile.employees) * 1000)}` : "$10,000-50,000"
        },
        {
          name: "Clean Vehicle Tax Credit (Section 30D)",
          description: "Tax credit for electric and plug-in hybrid vehicles",
          eligibility: "Business vehicles under 14,000 lbs GVWR",
          value: "Up to $7,500 per vehicle (new) or $4,000 (used)",
          timeline: "Through 2032",
          requirements: "Vehicle must meet final assembly and battery component requirements",
          estimated_benefit: "Up to $37,500 for 5-vehicle fleet"
        },
        {
          name: "Investment Tax Credit (ITC) for Solar",
          description: "Federal tax credit for solar energy systems",
          eligibility: "All businesses installing qualified solar equipment",
          value: "30% of system cost through 2032",
          timeline: "30% through 2032, then decreases",
          requirements: "Must be installed on business property",
          estimated_benefit: companyProfile?.location?.includes('CA') ? "$15,000-75,000" : "$10,000-50,000"
        }
      ];
      
      return res.json({ tax_benefits: fallbackBenefits });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `As a tax expert specializing in environmental incentives, provide personalized tax benefits and incentives for this company.

COMPANY DETAILS:
- Name: ${companyProfile?.name || 'Not specified'}
- Industry: ${companyProfile?.industry || 'Not specified'}
- Employees: ${companyProfile?.employees || 'Not specified'}
- Location: ${companyProfile?.location || 'Not specified'}
- Annual Emissions: ${emissions_data?.total_emissions_tons_co2e || 0} tonnes CO₂e

ANALYSIS REQUIREMENTS:
1. Focus on federal, state, and local incentives relevant to their location and industry
2. Prioritize incentives that align with their current emission sources
3. Include specific eligibility criteria and application processes
4. Provide estimated benefit amounts based on company size and profile
5. Include both immediate and long-term tax strategies

Provide 4-6 relevant tax benefits in this JSON format:
{
  "tax_benefits": [
    {
      "name": "Specific tax benefit name",
      "description": "Detailed description with implementation guidance",
      "eligibility": "Specific eligibility for this company",
      "value": "Specific value range or percentage",
      "timeline": "When available and deadlines",
      "requirements": "Specific requirements to qualify",
      "estimated_benefit": "Estimated dollar amount for this company size/type"
    }
  ]
}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 3000,
      },
    });

    const responseText = result.response.text();
    
    try {
      const cleanedText = responseText.replace(/```json|```/g, '').trim();
      const benefits = JSON.parse(cleanedText);
      res.json(benefits);
    } catch (jsonError) {
      console.error('JSON parsing error for tax benefits:', jsonError);
      
      // Enhanced fallback with personalization
      const fallbackBenefits = [
        {
          name: "Industry-Specific Energy Efficiency Incentive",
          description: `Tailored energy efficiency programs for ${companyProfile?.industry || 'your'} industry`,
          eligibility: `${companyProfile?.industry || 'All'} businesses in ${companyProfile?.location || 'qualifying areas'}`,
          value: "15-30% of qualified improvements",
          timeline: "Available now through 2025",
          requirements: "Energy audit and 20% reduction target",
          estimated_benefit: `$${Math.min(75000, (emissions_data?.total_emissions_tons_co2e || 50) * 1000)}`
        }
      ];
      
      res.json({ tax_benefits: fallbackBenefits });
    }
  } catch (error) {
    console.error('Error generating tax benefits:', error);
    res.status(500).json({ error: 'Error generating tax benefits' });
  }
});

// Test endpoint to verify Gemini integration
router.get('/test', auth, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Gemini API key not configured',
        configured: false 
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: "Respond with a simple JSON object: {\"status\": \"success\", \"model\": \"gemini-2.5-flash\"}" }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 100,
      },
    });

    const responseText = result.response.text();
    
    try {
      const parsed = JSON.parse(responseText.replace(/```json|```/g, '').trim());
      res.json({ 
        gemini_working: true, 
        model: "gemini-2.5-flash",
        test_response: parsed,
        configured: true 
      });
    } catch {
      res.json({ 
        gemini_working: true, 
        model: "gemini-2.5-flash",
        raw_response: responseText,
        configured: true 
      });
    }
  } catch (error) {
    console.error('Gemini test error:', error);
    res.status(500).json({ 
      error: 'Gemini test failed',
      details: error.message,
      configured: true,
      gemini_working: false
    });
  }
});

export default router; 