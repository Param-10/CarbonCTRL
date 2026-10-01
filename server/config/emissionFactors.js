/**
 * Emission factors for US businesses, in tCO2e (metric tonnes of CO2
 * equivalent) per unit of activity, grouped into business-friendly
 * categories. Units are the ones US businesses see on bills and receipts
 * (kWh, therms, gallons, miles, pounds, short tons).
 *
 * Every factor names its source (see FACTOR_SOURCES). CO2e combines CO2, CH4
 * and N2O with the AR5 100-year GWPs the EPA Emission Factors Hub uses
 * (CH4 = 28, N2O = 265). Factors marked `indicative` have no authoritative
 * US default and are rough estimates; the Methodology page shows which.
 *
 * Grid electricity (and the floor-area building estimate) use the company's
 * state grid rate when known; see factorFor().
 *
 * Category and item keys are stored with each activity, so renaming one
 * needs a data migration (see server/db/migrations/0007_*).
 */
import { EGRID_YEAR, US_GRID_T_PER_KWH, gridFactorForState } from './stateGridFactors.js';

export const FACTOR_SOURCES = {
  epa_hub_2025: {
    title: 'EPA GHG Emission Factors Hub (January 2025)',
    url: 'https://www.epa.gov/climateleadership/ghg-emission-factors-hub',
  },
  egrid_2023: {
    title: `EPA eGRID${EGRID_YEAR} Summary Tables, state output emission rates (2025)`,
    url: 'https://www.epa.gov/egrid/summary-data',
  },
  cbecs_2018: {
    title: 'EIA Commercial Buildings Energy Consumption Survey (CBECS) 2018, tables C14 and C24',
    url: 'https://www.eia.gov/consumption/commercial/data/2018/',
  },
  ghg_protocol_scope2: {
    title: 'GHG Protocol Scope 2 Guidance (self-generated renewable electricity)',
    url: 'https://ghgprotocol.org/scope-2-guidance',
  },
  worldsteel_2025: {
    title: 'worldsteel Sustainability Indicators 2025 (GHG intensity, all scopes)',
    url: 'https://worldsteel.org/wider-sustainability/sustainability-indicators/',
  },
  iai_2023: {
    title: 'International Aluminium Institute, primary aluminium GHG intensity (2023)',
    url: 'https://international-aluminium.org/statistics/greenhouse-gas-emissions-primary-aluminium/',
  },
  gcca_2022: {
    title: 'GCCA Getting the Numbers Right, net CO2 per tonne of cementitious product (2022)',
    url: 'https://gccassociation.org/',
  },
  indicative: {
    title: 'Indicative estimate: no authoritative US default factor; treat as a rough approximation',
    url: null,
  },
};

// Natural gas, EPA Hub Table 1: 53.06 kg CO2, 1 g CH4, 0.1 g N2O per MMBtu
const NATURAL_GAS_T_PER_THERM = 0.0053115;
export const NATURAL_GAS_T_PER_CUBIC_FOOT = 0.0000544947;
// Passenger car, EPA Hub Tables 8/10: 0.297 kg CO2, 0.0059 g CH4, 0.0053 g N2O per mile
const PASSENGER_CAR_T_PER_MILE = 0.00029857;
// US commercial buildings per square foot per year (CBECS 2018): 12.6 kWh of
// electricity and, in buildings that use it, 32.7 cubic feet of natural gas
const CBECS_KWH_PER_SQFT = 12.6;
const CBECS_GAS_T_PER_SQFT = 32.7 * NATURAL_GAS_T_PER_CUBIC_FOOT;
const SHORT_TONS_PER_METRIC_TON = 0.90718474;

export const CATEGORY_LABELS = {
  electricity: 'Electricity',
  heating_cooling: 'Heating & cooling',
  vehicles: 'Company vehicles',
  business_travel: 'Business travel',
  commuting: 'Employee commuting',
  freight: 'Shipping & freight',
  waste: 'Waste',
  materials: 'Materials & products',
  agriculture: 'Farming',
};

export const EMISSION_FACTORS = {
  electricity: {
    'grid-electricity': {
      label: 'Electricity from the grid',
      factor: US_GRID_T_PER_KWH, // replaced by the state rate when the state is known
      unit: 'kWh',
      description: 'kWh of electricity used (from your utility bill)',
      source: 'egrid_2023',
      varies_by_state: true,
    },
    'onsite-renewable': {
      label: 'On-site solar or wind',
      factor: 0,
      unit: 'kWh',
      description: 'kWh generated and used on site',
      source: 'ghg_protocol_scope2',
    }
  },

  heating_cooling: {
    'natural-gas': {
      label: 'Natural gas',
      factor: NATURAL_GAS_T_PER_THERM,
      unit: 'therms',
      description: 'therms of natural gas (from your gas bill)',
      source: 'epa_hub_2025',
    },
    'heating-oil': {
      label: 'Heating oil',
      factor: 0.0102427, // distillate fuel oil No. 2: 10.21 kg CO2, 0.41 g CH4, 0.08 g N2O per gallon
      unit: 'gallons',
      description: 'gallons of heating oil',
      source: 'epa_hub_2025',
    },
    'propane': {
      label: 'Propane',
      factor: 0.0057408, // 5.72 kg CO2, 0.27 g CH4, 0.05 g N2O per gallon
      unit: 'gallons',
      description: 'gallons of propane',
      source: 'epa_hub_2025',
    },
    'district-steam': {
      label: 'Purchased steam or district heat',
      factor: 0.066398, // 66.33 kg CO2, 1.25 g CH4, 0.125 g N2O per MMBtu
      unit: 'MMBtu',
      description: 'MMBtu of purchased steam or heat',
      source: 'epa_hub_2025',
    },
    'refrigerant-r410a': {
      label: 'Refrigerant top-up (R-410A)',
      factor: 0.87271, // GWP 1,924 (EPA Hub Table 12) x 0.4536 kg per lb
      unit: 'lbs',
      description: 'lbs of R-410A refrigerant added (replaces leaks)',
      source: 'epa_hub_2025',
    },
    'facility-estimate': {
      label: 'Building energy estimate (no bills)',
      // Average US commercial building energy per sq ft, at the state grid rate
      factor: CBECS_KWH_PER_SQFT * US_GRID_T_PER_KWH + CBECS_GAS_T_PER_SQFT,
      unit: 'sq ft',
      description: 'sq ft of floor space (per year; use only without bills)',
      source: 'cbecs_2018',
      varies_by_state: true,
    }
  },

  vehicles: {
    'gasoline': {
      label: 'Gasoline',
      factor: 0.00878, // CO2 only (Table 2); CH4 and N2O add under 1%
      unit: 'gallons',
      description: 'gallons of gasoline for company vehicles',
      source: 'epa_hub_2025',
    },
    'diesel': {
      label: 'Diesel',
      factor: 0.01021, // CO2 only (Table 2); CH4 and N2O add under 1%
      unit: 'gallons',
      description: 'gallons of diesel for company vehicles',
      source: 'epa_hub_2025',
    },
    'car-miles': {
      label: 'Car miles (fuel unknown)',
      factor: PASSENGER_CAR_T_PER_MILE,
      unit: 'miles',
      description: 'miles driven in company cars',
      source: 'epa_hub_2025',
    },
    'truck-van-miles': {
      label: 'Truck or van miles (fuel unknown)',
      factor: 0.00039664, // light-duty truck: 0.394 kg CO2, 0.0109 g CH4, 0.0088 g N2O per mile
      unit: 'miles',
      description: 'miles driven in company trucks or vans',
      source: 'epa_hub_2025',
    }
  },

  business_travel: {
    'flight-short': {
      label: 'Short flights (under 300 miles)',
      factor: 0.00020893,
      unit: 'passenger-miles',
      description: 'passenger-miles flown on flights under 300 miles',
      source: 'epa_hub_2025',
    },
    'flight-medium-long': {
      label: 'Medium flights (300-2,300 miles)',
      factor: 0.0001301,
      unit: 'passenger-miles',
      description: 'passenger-miles flown on flights of 300-2,300 miles',
      source: 'epa_hub_2025',
    },
    'flight-long': {
      label: 'Long flights (over 2,300 miles)',
      factor: 0.00016439,
      unit: 'passenger-miles',
      description: 'passenger-miles flown on flights over 2,300 miles',
      source: 'epa_hub_2025',
    },
    'hotel-nights': {
      label: 'Hotel stays',
      factor: 0.017, // ~17 kg CO2e per room-night
      unit: 'nights',
      description: 'hotel room-nights',
      source: 'indicative',
    },
    'rail-bus': {
      label: 'Train (intercity rail)',
      factor: 0.0000968, // Amtrak national average
      unit: 'passenger-miles',
      description: 'passenger-miles by intercity train',
      source: 'epa_hub_2025',
    },
    'bus': {
      label: 'Bus or coach',
      factor: 0.0000666,
      unit: 'passenger-miles',
      description: 'passenger-miles by bus',
      source: 'epa_hub_2025',
    },
    'car-miles': {
      label: 'Rental or personal car (reimbursed)',
      factor: PASSENGER_CAR_T_PER_MILE,
      unit: 'miles',
      description: 'miles driven for business in rental or personal cars',
      source: 'epa_hub_2025',
    }
  },

  commuting: {
    'car-miles': {
      label: 'Commuting by car',
      factor: PASSENGER_CAR_T_PER_MILE,
      unit: 'miles',
      description: 'total miles employees drove to work',
      source: 'epa_hub_2025',
    },
    'transit': {
      label: 'Commuting by transit',
      factor: 0.0000801, // average of the EPA bus and transit rail factors
      unit: 'passenger-miles',
      description: 'total passenger-miles employees rode transit',
      source: 'epa_hub_2025',
    }
  },

  freight: {
    'truck': {
      label: 'Trucking',
      factor: 0.00018748, // 0.186 kg CO2, 0.0016 g CH4, 0.0054 g N2O per short ton-mile
      unit: 'ton-miles',
      description: 'short ton-miles shipped by truck',
      source: 'epa_hub_2025',
    },
    'rail': {
      label: 'Rail freight',
      factor: 0.0000212,
      unit: 'ton-miles',
      description: 'short ton-miles shipped by rail',
      source: 'epa_hub_2025',
    },
    'ship': {
      label: 'Sea or barge freight',
      factor: 0.0000784,
      unit: 'ton-miles',
      description: 'short ton-miles shipped by water',
      source: 'epa_hub_2025',
    },
    'air': {
      label: 'Air freight',
      factor: 0.0010949,
      unit: 'ton-miles',
      description: 'short ton-miles shipped by air',
      source: 'epa_hub_2025',
    }
  },

  // EPA Hub Table 9 (WARM), t CO2e per short ton, divided by 2,000 lbs
  waste: {
    'landfill': {
      label: 'Trash to landfill',
      factor: 0.00029, // mixed MSW landfilled: 0.58 t per short ton
      unit: 'lbs',
      description: 'lbs of trash sent to landfill',
      source: 'epa_hub_2025',
    },
    'recycling': {
      label: 'Recycling',
      factor: 0.000045, // mixed recyclables recycled: 0.09 t per short ton
      unit: 'lbs',
      description: 'lbs of material recycled',
      source: 'epa_hub_2025',
    },
    'composting': {
      label: 'Composting',
      factor: 0.000065, // mixed organics composted: 0.13 t per short ton
      unit: 'lbs',
      description: 'lbs of waste composted',
      source: 'epa_hub_2025',
    },
    'incineration': {
      label: 'Incineration',
      factor: 0.000215, // mixed MSW combusted: 0.43 t per short ton
      unit: 'lbs',
      description: 'lbs of waste incinerated',
      source: 'epa_hub_2025',
    },
    'wastewater': {
      label: 'Wastewater',
      factor: 0.0000011, // ~1.1 g CO2e per gallon treated
      unit: 'gallons',
      description: 'gallons of wastewater treated',
      source: 'indicative',
    }
  },

  // Cradle-to-gate emissions per short ton of material bought or produced
  materials: {
    'steel': {
      label: 'Steel', factor: 2.18 * SHORT_TONS_PER_METRIC_TON, unit: 'short tons',
      description: 'short tons of steel', source: 'worldsteel_2025',
    },
    'aluminum': {
      label: 'Aluminum', factor: 14.8 * SHORT_TONS_PER_METRIC_TON, unit: 'short tons',
      description: 'short tons of aluminum (primary)', source: 'iai_2023',
    },
    'cement': {
      label: 'Cement', factor: 0.58 * SHORT_TONS_PER_METRIC_TON, unit: 'short tons',
      description: 'short tons of cement', source: 'gcca_2022',
    },
    'plastics': { label: 'Plastics', factor: 0.91, unit: 'short tons', description: 'short tons of plastics', source: 'indicative' },
    'paper': { label: 'Paper', factor: 0.54, unit: 'short tons', description: 'short tons of paper', source: 'indicative' },
    'chemicals': { label: 'Chemicals', factor: 0.73, unit: 'short tons', description: 'short tons of chemicals', source: 'indicative' },
    'electronics': { label: 'Electronics', factor: 0.36, unit: 'short tons', description: 'short tons of electronics', source: 'indicative' }
  },

  agriculture: {
    'synthetic-fertilizer': {
      label: 'Synthetic fertilizer', factor: 0.00227, unit: 'lbs',
      description: 'lbs of synthetic fertilizer applied', source: 'indicative',
    },
    'cattle-enteric': {
      label: 'Cattle (digestion)', factor: 0.8, unit: 'head',
      description: 'head of cattle (per year)', source: 'indicative',
    },
    'manure-management': {
      label: 'Livestock manure', factor: 0.4, unit: 'head',
      description: 'head of livestock (per year)', source: 'indicative',
    },
    'rice-cultivation': {
      label: 'Rice fields', factor: 1.62, unit: 'acres',
      description: 'acres of rice (per season)', source: 'indicative',
    },
    'crop-residues': {
      label: 'Crop residues left on fields', factor: 0.027, unit: 'short tons',
      description: 'short tons of crop residues', source: 'indicative',
    },
    'crop-burning': {
      label: 'Crop residue burning', factor: 0.2, unit: 'acres',
      description: 'acres of residue burned', source: 'indicative',
    }
  }
};

/**
 * Catalog entry for an activity type, or null. Own-property checks keep
 * inherited keys (e.g. "constructor") from passing as activity types.
 */
function catalogItem(sector, subsector) {
  const items = Object.hasOwn(EMISSION_FACTORS, sector) ? EMISSION_FACTORS[sector] : null;
  return items && Object.hasOwn(items, subsector) ? items[subsector] : null;
}

/**
 * Factor for an activity type, using the company's state grid rate where the
 * factor depends on it. Returns null for an unknown type (0 is a valid factor).
 */
export function factorFor(sector, subsector, { state } = {}) {
  const item = catalogItem(sector, subsector);
  if (!item) return null;
  if (sector === 'electricity' && subsector === 'grid-electricity') return gridFactorForState(state);
  if (sector === 'heating_cooling' && subsector === 'facility-estimate') {
    return CBECS_KWH_PER_SQFT * gridFactorForState(state) + CBECS_GAS_T_PER_SQFT;
  }
  return item.factor;
}

/**
 * Get emission factor for a sector/subsector combination (US averages)
 */
export function getEmissionFactor(sector, subsector) {
  return catalogItem(sector, subsector)?.factor || 0;
}

/**
 * Get unit description for a sector/subsector combination
 */
export function getUnitDescription(sector, subsector) {
  return catalogItem(sector, subsector)?.description || 'units';
}

/**
 * Validate if a sector/subsector combination is supported
 */
export function isValidCombination(sector, subsector) {
  return catalogItem(sector, subsector) !== null;
}
