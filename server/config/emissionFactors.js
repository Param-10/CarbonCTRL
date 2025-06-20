/**
 * Comprehensive Emission Factors Database
 * Units: tCO₂e per unit of activity
 * Source: IPCC Guidelines, EPA, and industry standards
 */

export const EMISSION_FACTORS = {
  agriculture: {
    'cropland-fires': {
      factor: 0.5,
      unit: 'hectares',
      description: 'Hectares of cropland burned'
    },
    'synthetic-fertilizer-application': {
      factor: 0.3,
      unit: 'kg',
      description: 'Kg of fertilizer applied'
    },
    'manure-management': {
      factor: 0.4,
      unit: 'livestock units',
      description: 'Number of animals'
    },
    'rice-cultivation': {
      factor: 0.6,
      unit: 'hectares',
      description: 'Hectares of rice cultivation'
    },
    'enteric-fermentation': {
      factor: 0.8,
      unit: 'livestock units',
      description: 'Number of ruminant animals'
    },
    'crop-residues': {
      factor: 0.2,
      unit: 'tonnes',
      description: 'Kg of crop residues'
    }
  },
  
  power: {
    'electricity-generation': {
      factor: 0.45,
      unit: 'kWh',
      description: 'kWh of electricity generated'
    },
    'heat-plants': {
      factor: 0.35,
      unit: 'kWh',
      description: 'kWh of heat generated'
    },
    'solar-generation': {
      factor: 0.05,
      unit: 'kWh',
      description: 'kWh of solar electricity generated'
    },
    'wind-generation': {
      factor: 0.02,
      unit: 'kWh',
      description: 'kWh of wind electricity generated'
    },
    'hydroelectric': {
      factor: 0.03,
      unit: 'kWh',
      description: 'kWh of hydroelectric power generated'
    }
  },
  
  transportation: {
    'road': {
      factor: 0.15,
      unit: 'km',
      description: 'km traveled by vehicles'
    },
    'aviation': {
      factor: 0.25,
      unit: 'km',
      description: 'km traveled by aircraft'
    },
    'shipping': {
      factor: 0.12,
      unit: 'ton-km',
      description: 'ton-km of goods shipped'
    },
    'rail': {
      factor: 0.08,
      unit: 'km',
      description: 'km traveled by trains'
    },
    'public-transit': {
      factor: 0.06,
      unit: 'passenger-km',
      description: 'passenger-km traveled'
    }
  },
  
  buildings: {
    'residential': {
      factor: 0.2,
      unit: 'sq ft',
      description: 'square feet of residential space'
    },
    'commercial': {
      factor: 0.25,
      unit: 'sq ft',
      description: 'square feet of commercial space'
    },
    'lighting': {
      factor: 0.15,
      unit: 'kWh',
      description: 'kWh used for lighting'
    },
    'heating': {
      factor: 0.3,
      unit: 'kWh',
      description: 'kWh used for heating'
    },
    'cooling': {
      factor: 0.35,
      unit: 'kWh',
      description: 'kWh used for cooling'
    }
  },
  
  manufacturing: {
    'cement': {
      factor: 1.2,
      unit: 'tonnes',
      description: 'tons of cement produced'
    },
    'steel': {
      factor: 1.5,
      unit: 'tonnes',
      description: 'tons of steel produced'
    },
    'chemicals': {
      factor: 0.8,
      unit: 'tonnes',
      description: 'tons of chemicals produced'
    },
    'paper': {
      factor: 0.6,
      unit: 'tonnes',
      description: 'tons of paper produced'
    },
    'aluminum': {
      factor: 1.8,
      unit: 'tonnes',
      description: 'tons of aluminum produced'
    },
    'plastics': {
      factor: 1.0,
      unit: 'tonnes',
      description: 'tons of plastics produced'
    },
    'electronics': {
      factor: 0.4,
      unit: 'tonnes',
      description: 'tons of electronics produced'
    }
  },
  
  waste: {
    'landfill': {
      factor: 0.6,
      unit: 'tonnes',
      description: 'tons of waste sent to landfill'
    },
    'wastewater': {
      factor: 0.3,
      unit: 'cubic meters',
      description: 'cubic meters of wastewater treated'
    },
    'incineration': {
      factor: 0.8,
      unit: 'tonnes',
      description: 'tons of waste incinerated'
    },
    'composting': {
      factor: 0.1,
      unit: 'tonnes',
      description: 'tons of waste composted'
    },
    'recycling': {
      factor: 0.05,
      unit: 'tonnes',
      description: 'tons of waste recycled'
    }
  }
};

/**
 * Get emission factor for a sector/subsector combination
 */
export function getEmissionFactor(sector, subsector) {
  return EMISSION_FACTORS[sector]?.[subsector]?.factor || 0;
}

/**
 * Get unit description for a sector/subsector combination
 */
export function getUnitDescription(sector, subsector) {
  return EMISSION_FACTORS[sector]?.[subsector]?.description || 'units';
}

/**
 * Get all available sectors
 */
export function getAvailableSectors() {
  return Object.keys(EMISSION_FACTORS);
}

/**
 * Get all subsectors for a given sector
 */
export function getSubsectors(sector) {
  return Object.keys(EMISSION_FACTORS[sector] || {});
}

/**
 * Validate if a sector/subsector combination is supported
 */
export function isValidCombination(sector, subsector) {
  return !!(EMISSION_FACTORS[sector] && EMISSION_FACTORS[sector][subsector]);
}

/**
 * Get all emission factors as a simple object for backward compatibility
 */
export function getLegacyEmissionFactors() {
  const legacy = {};
  Object.keys(EMISSION_FACTORS).forEach(sector => {
    legacy[sector] = {};
    Object.keys(EMISSION_FACTORS[sector]).forEach(subsector => {
      legacy[sector][subsector] = EMISSION_FACTORS[sector][subsector].factor;
    });
  });
  return legacy;
} 