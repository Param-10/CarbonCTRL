import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Activity {
  sector: string;
  subsector: string;
  activity_amount: number;
  activity_unit: string;
}

interface CompanyData {
  company_name: string;
  activities: Activity[];
}

// All emission factors are now in tonnes CO2e per unit
const emissionFactors = {
  agriculture: {
    'cropland-fires': 2.5, // tonnes CO2e per hectare
    'synthetic-fertilizer-application': 0.004, // tonnes CO2e per kg
    'manure-management': 1.2, // tonnes CO2e per animal
    'rice-cultivation': 4.5, // tonnes CO2e per hectare
    'enteric-fermentation': 2.8, // tonnes CO2e per animal
    'crop-residues': 0.5 // tonnes CO2e per tonne of residue
  },
  power: {
    'electricity-generation': 0.0005, // tonnes CO2e per kWh
    'heat-plants': 0.0003, // tonnes CO2e per kWh
    'solar-generation': 0.00001, // tonnes CO2e per kWh
    'wind-generation': 0.000005, // tonnes CO2e per kWh
    'hydroelectric': 0.000008 // tonnes CO2e per kWh
  },
  transportation: {
    'road': 0.0002, // tonnes CO2e per km
    'aviation': 0.00025, // tonnes CO2e per km
    'shipping': 0.00015, // tonnes CO2e per tonne-km
    'rail': 0.00002, // tonnes CO2e per km
    'public-transit': 0.00005 // tonnes CO2e per passenger-km
  },
  buildings: {
    'residential': 0.03, // tonnes CO2e per m²
    'commercial': 0.04, // tonnes CO2e per m²
    'lighting': 0.0004, // tonnes CO2e per kWh
    'heating': 0.0006, // tonnes CO2e per kWh
    'cooling': 0.0005 // tonnes CO2e per kWh
  },
  manufacturing: {
    'cement': 0.9, // tonnes CO2e per tonne
    'steel': 1.9, // tonnes CO2e per tonne
    'chemicals': 1.3, // tonnes CO2e per tonne
    'paper': 0.8, // tonnes CO2e per tonne
    'aluminum': 12.0, // tonnes CO2e per tonne
    'plastics': 3.5, // tonnes CO2e per tonne
    'electronics': 15.0 // tonnes CO2e per tonne
  },
  waste: {
    'landfill': 0.5, // tonnes CO2e per tonne
    'wastewater': 0.0002, // tonnes CO2e per m³
    'incineration': 0.6, // tonnes CO2e per tonne
    'composting': 0.09, // tonnes CO2e per tonne
    'recycling': 0.05 // tonnes CO2e per tonne
  }
};

function getRecommendations(emissionsBreakdown: Record<string, number>) {
  const recommendations = [];
  const sectors = Object.entries(emissionsBreakdown).sort((a, b) => b[1] - a[1]);

  // Get top 3 emission sources and provide targeted recommendations
  for (const [sector, emissions] of sectors.slice(0, 3)) {
    switch (sector) {
      case 'power':
        recommendations.push(
          'Switch to renewable energy sources to reduce power-related emissions',
          'Implement energy efficiency measures across operations',
          'Consider on-site solar or wind power generation'
        );
        break;
      case 'transportation':
        recommendations.push(
          'Optimize logistics routes to minimize travel distance',
          'Consider transitioning to electric or hybrid vehicles',
          'Implement a smart fleet management system'
        );
        break;
      case 'manufacturing':
        recommendations.push(
          'Upgrade to energy-efficient manufacturing equipment',
          'Implement waste heat recovery systems',
          'Consider circular manufacturing processes'
        );
        break;
      case 'buildings':
        recommendations.push(
          'Upgrade to smart building management systems',
          'Improve building insulation and HVAC efficiency',
          'Install LED lighting and motion sensors'
        );
        break;
      case 'agriculture':
        recommendations.push(
          'Implement precision agriculture techniques',
          'Consider sustainable farming practices',
          'Optimize fertilizer use through soil testing'
        );
        break;
      case 'waste':
        recommendations.push(
          'Implement comprehensive recycling programs',
          'Consider waste-to-energy solutions',
          'Optimize waste collection routes'
        );
        break;
    }
  }

  // Add general recommendations
  recommendations.push(
    'Set science-based emission reduction targets',
    'Consider carbon offset programs for unavoidable emissions',
    'Implement regular carbon footprint monitoring'
  );

  return recommendations;
}

function calculateScore(companyData: CompanyData) {
  let totalEmissions = 0;
  const emissionsBreakdown: Record<string, number> = {};
  const activityDetails = [];

  // Calculate emissions for each activity
  for (const activity of companyData.activities) {
    const { sector, subsector, activity_amount } = activity;

    if (!emissionFactors[sector] || !emissionFactors[sector][subsector]) {
      console.warn(`No emission factor found for ${sector}/${subsector}`);
      continue;
    }

    const emissionFactor = emissionFactors[sector][subsector];
    const emissions = activity_amount * emissionFactor; // Direct calculation in tonnes CO2e

    activityDetails.push({
      sector,
      subsector,
      amount: activity_amount,
      emission_factor: emissionFactor,
      emissions
    });

    if (!emissionsBreakdown[sector]) {
      emissionsBreakdown[sector] = 0;
    }

    emissionsBreakdown[sector] += emissions;
    totalEmissions += emissions;
  }

  // Calculate carbon rating based on total emissions
  let carbonRating;
  let ratingDescription;

  if (totalEmissions < 100) {
    carbonRating = "A+";
    ratingDescription = "Excellent - Industry leading performance";
  } else if (totalEmissions < 500) {
    carbonRating = "A";
    ratingDescription = "Very Good - Strong environmental performance";
  } else if (totalEmissions < 1000) {
    carbonRating = "B";
    ratingDescription = "Good - Above average performance";
  } else if (totalEmissions < 5000) {
    carbonRating = "C";
    ratingDescription = "Fair - Average industry performance";
  } else if (totalEmissions < 10000) {
    carbonRating = "D";
    ratingDescription = "Poor - Below average performance";
  } else {
    carbonRating = "E";
    ratingDescription = "Very Poor - Significant improvement needed";
  }

  const recommendations = getRecommendations(emissionsBreakdown);

  return {
    company_name: companyData.company_name,
    total_emissions_tons_co2e: totalEmissions,
    emissions_breakdown: emissionsBreakdown,
    activity_details: activityDetails,
    carbon_rating: carbonRating,
    rating_description: ratingDescription,
    recommendations
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const companyData: CompanyData = await req.json();
    const result = calculateScore(companyData);

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});