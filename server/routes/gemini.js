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

// Enhanced carbon recommendations with personalization
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

    const apiKey = process.env.GEMINI_API_KEY;
    
    // Create enhanced fallback recommendations based on user data
    const createEnhancedFallback = () => {
      const topSectors = Object.entries(emissions_data.breakdown)
        .sort(([, a], [, b]) => b - a);
      
      const recommendations = [];
      const companySize = companyProfile?.employees || '1-10';
      const location = companyProfile?.location || 'United States';
      const isSmallCompany = companySize.includes('1-10') || companySize.includes('11-50');
      
      // Energy sector recommendations
      if (topSectors.find(([sector]) => sector.toLowerCase().includes('energy'))) {
        const energyEmissions = topSectors.find(([sector]) => sector.toLowerCase().includes('energy'))?.[1] || 0;
        
        recommendations.push({
          title: `Smart Energy Management for ${industry} Companies`,
          description: `Implement an automated energy management system to optimize consumption patterns. Start with LED lighting upgrades and smart thermostats, then progress to energy monitoring software. This approach is particularly effective for ${industry} companies due to consistent energy usage patterns and potential for automation.`,
          impact: energyEmissions * 0.35,
          timeline: isSmallCompany ? "2-4 months" : "3-6 months",
          cost: isSmallCompany ? "Low" : "Medium",
          roi_months: isSmallCompany ? 12 : 18,
          priority: "High",
          industry_specific: `${industry} companies can leverage IoT sensors and automation to achieve 30-40% energy reductions, significantly higher than traditional industries due to tech-forward infrastructure.`
        });
        
        if (energyEmissions > 20) {
          recommendations.push({
            title: "Renewable Energy Transition Strategy",
            description: `Develop a phased renewable energy adoption plan. Begin with renewable energy purchasing agreements (REPAs) for immediate impact, then evaluate on-site solar installation feasibility. Consider your ${location} location for optimal renewable energy incentives.`,
            impact: energyEmissions * 0.6,
            timeline: "6-18 months",
            cost: "High",
            roi_months: location.includes('CA') || location.includes('NY') ? 20 : 28,
            priority: "High",
            industry_specific: `${industry} sector faces increasing pressure from stakeholders for renewable energy adoption. Early movers gain competitive advantage in ESG ratings and talent acquisition.`
          });
        }
      }
      
      // Transportation recommendations
      if (topSectors.find(([sector]) => sector.toLowerCase().includes('transport'))) {
        const transportEmissions = topSectors.find(([sector]) => sector.toLowerCase().includes('transport'))?.[1] || 0;
        
        recommendations.push({
          title: "Electric Fleet and Remote Work Optimization",
          description: `Transition company vehicles to electric or hybrid models while expanding remote work policies. Implement a comprehensive mobility management system that tracks and optimizes all business travel. Set targets for 50% EV adoption and 60% remote work capacity.`,
          impact: transportEmissions * 0.45,
          timeline: "6-12 months",
          cost: "Medium",
          roi_months: 24,
          priority: transportEmissions > 15 ? "High" : "Medium",
          industry_specific: `${industry} companies can leverage digital collaboration tools more effectively than other sectors, potentially reducing business travel by 70% while maintaining productivity.`
        });
      }
      
      // Waste management recommendations
      if (topSectors.find(([sector]) => sector.toLowerCase().includes('waste'))) {
        recommendations.push({
          title: "Circular Economy and Digital Waste Reduction",
          description: `Implement a comprehensive waste reduction program focusing on digital transformation and circular economy principles. Reduce paper usage by 90% through digitization, establish electronic waste recycling partnerships, and create a office supply sharing system.`,
          impact: 2.5,
          timeline: "1-3 months",
          cost: "Low",
          roi_months: 8,
          priority: "Medium",
          industry_specific: `${industry} companies generate significant electronic waste and paper consumption. Digital-first policies can eliminate 80% of traditional office waste streams.`
        });
      }
      
      // Industry-specific recommendations
      if (industry.toLowerCase().includes('tech') || industry.toLowerCase().includes('software')) {
        recommendations.push({
          title: "Carbon-Efficient Cloud and Infrastructure Optimization",
          description: `Optimize cloud infrastructure for carbon efficiency by migrating to providers with renewable energy commitments (AWS, Google Cloud green regions). Implement automated scaling to reduce idle resource consumption and adopt sustainable coding practices to minimize computational demands.`,
          impact: emissions_data.total_emissions_tons_co2e * 0.25,
          timeline: "3-6 months",
          cost: "Medium",
          roi_months: 15,
          priority: "High",
          industry_specific: "Technology companies can achieve significant carbon reductions through cloud optimization, with studies showing 20-50% reductions in computing-related emissions through efficient architectures."
        });
        
        recommendations.push({
          title: "Sustainable Software Development Practices",
          description: `Adopt green software development methodologies including code optimization for energy efficiency, sustainable UX design patterns, and carbon-aware development practices. Train development teams on writing efficient algorithms and implement carbon impact measurement in CI/CD pipelines.`,
          impact: 3.2,
          timeline: "2-4 months",
          cost: "Low",
          roi_months: 10,
          priority: "Medium",
          industry_specific: "Software companies have unique opportunities to reduce their digital carbon footprint through efficient coding practices, potentially reducing server loads by 30-40%."
        });
      }
      
      // Financial/service industry specific
      if (industry.toLowerCase().includes('finance') || industry.toLowerCase().includes('consulting') || industry.toLowerCase().includes('service')) {
        recommendations.push({
          title: "Digital-First Operations and Paperless Transformation",
          description: `Eliminate physical document processes through comprehensive digital transformation. Implement e-signatures, digital client onboarding, and cloud-based collaboration tools. This reduces both direct emissions from paper/printing and indirect emissions from physical storage and transportation.`,
          impact: emissions_data.total_emissions_tons_co2e * 0.2,
          timeline: "2-6 months",
          cost: "Medium",
          roi_months: 12,
          priority: "Medium",
          industry_specific: `${industry} companies can achieve 60-80% reduction in paper-related emissions while improving operational efficiency and client experience through digital transformation.`
        });
      }
      
      // Manufacturing specific
      if (industry.toLowerCase().includes('manufacturing') || industry.toLowerCase().includes('production')) {
        recommendations.push({
          title: "Process Optimization and Energy Recovery Systems",
          description: `Implement lean manufacturing principles with focus on energy efficiency. Install waste heat recovery systems, optimize production scheduling to reduce energy peaks, and establish predictive maintenance programs to ensure equipment operates at peak efficiency.`,
          impact: emissions_data.total_emissions_tons_co2e * 0.35,
          timeline: "6-12 months",
          cost: "High",
          roi_months: 30,
          priority: "High",
          industry_specific: "Manufacturing companies can achieve 25-45% energy reductions through process optimization, with waste heat recovery systems providing immediate ROI through reduced energy costs."
        });
      }
      
      // Ensure we have at least 4 recommendations
      while (recommendations.length < 4) {
        recommendations.push({
          title: "Employee Engagement and Sustainability Training",
          description: `Launch a comprehensive employee sustainability program including carbon literacy training, green commuting incentives, and sustainability innovation challenges. Create sustainability champions network and implement behavior change initiatives with measurable targets.`,
          impact: emissions_data.total_emissions_tons_co2e * 0.1,
          timeline: "1-3 months",
          cost: "Low",
          roi_months: 15,
          priority: "Medium",
          industry_specific: `${industry} companies with engaged employees see 23% higher sustainability performance. Digital companies can leverage internal platforms for gamification and tracking.`
        });
      }
      
      // Calculate summary
      const totalPotentialReduction = recommendations.reduce((sum, rec) => sum + rec.impact, 0);
      const quickWins = recommendations.filter(rec => rec.timeline.includes('1-3') || rec.timeline.includes('2-4')).length;
      const strategicInitiatives = recommendations.filter(rec => rec.timeline.includes('6-') || rec.timeline.includes('12')).length;
      
      return {
        recommendations: recommendations.slice(0, 6), // Limit to 6 recommendations
        summary: {
          total_potential_reduction: totalPotentialReduction,
          quick_wins_count: quickWins,
          strategic_initiatives_count: strategicInitiatives,
          estimated_total_investment: recommendations.some(r => r.cost === 'High') ? "Medium to High" : "Low to Medium",
          payback_period: "12-24 months"
        }
      };
    };

    if (!apiKey || apiKey.includes('your-') || apiKey === 'AIzaSyCbxK1f8LQ0pzGaZqJxR4bH9nK1mW3vYxI') {
      console.log('Using enhanced fallback recommendations with personalization');
      const fallbackData = createEnhancedFallback();
      return res.json(fallbackData);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use Gemini 2.5 Flash model for enhanced performance and capabilities
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

    // Enhanced prompt with comprehensive personalization
    const prompt = `You are a world-class carbon management consultant providing personalized recommendations. Analyze the data below and provide 4-6 highly specific, actionable recommendations.

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
${selectedSectorsString}

REQUIREMENTS FOR RECOMMENDATIONS:
1. Prioritize the highest-impact emission sources first
2. Consider the company's industry-specific challenges and opportunities
3. Factor in company size and location for feasibility
4. Provide recommendations that are implementable given the company's profile
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
    "payback_period": "12-24 months"
  }
}`;

    console.log('Sending enhanced prompt to Gemini 2.5 Flash...');

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3, // Lower temperature for more consistent, factual responses
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 4096, // Increased for more detailed responses
      },
    });

    const responseText = result.response.text();
    console.log('Gemini response received:', responseText.substring(0, 200) + '...');

    let recommendations;

    try {
      // Clean the response and parse JSON
      const cleanedText = responseText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .replace(/^\s*/, '')
        .replace(/\s*$/, '')
        .trim();

      recommendations = JSON.parse(cleanedText);
      
      // Validate the response structure
      if (!recommendations.recommendations || !Array.isArray(recommendations.recommendations)) {
        throw new Error('Invalid response structure');
      }

      console.log('Successfully parsed recommendations:', recommendations.recommendations.length);
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      console.log('Raw response:', responseText);
      
      // Use enhanced fallback recommendations based on company data
      recommendations = createEnhancedFallback();
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