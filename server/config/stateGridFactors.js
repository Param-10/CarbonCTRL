/**
 * Grid electricity emission rates by US state, in lb CO2e per MWh of total
 * output. Source: EPA eGRID2023 Summary Tables, Table 3 "State Output
 * Emission Rates" (created 03/27/2025), https://www.epa.gov/egrid/summary-data
 *
 * These describe electricity generated in each state. States that import or
 * export a lot of power have a consumption mix that differs; EPA recommends
 * eGRID subregion factors (looked up by ZIP code) for formal inventories.
 */
export const EGRID_YEAR = 2023;

export const STATE_GRID_LB_PER_MWH = {
  AK: 814.5, AL: 714.0, AR: 998.4, AZ: 689.1, CA: 394.8, CO: 1091.1, CT: 540.7,
  DC: 395.0, DE: 704.2, FL: 789.1, GA: 717.4, HI: 1394.7, IA: 634.2, ID: 313.9,
  IL: 474.4, IN: 1465.5, KS: 733.3, KY: 1747.0, LA: 763.1, MA: 830.1, MD: 522.2,
  ME: 316.8, MI: 797.4, MN: 752.3, MO: 1454.6, MS: 828.3, MT: 1063.9, NC: 626.4,
  ND: 1297.9, NE: 1025.8, NH: 276.2, NJ: 470.2, NM: 773.6, NV: 643.9, NY: 466.6,
  OH: 1068.3, OK: 648.8, OR: 365.0, PA: 647.9, PR: 1548.5, RI: 840.0, SC: 560.4,
  SD: 335.6, TN: 661.2, TX: 771.2, UT: 1421.2, VA: 539.6, VT: 52.2, WA: 266.6,
  WI: 1163.6, WV: 1968.9, WY: 1833.3,
};

export const US_GRID_LB_PER_MWH = 770.9;

// lb/MWh -> metric tonnes per kWh
const LB_PER_MWH_TO_T_PER_KWH = 0.45359237 / 1000 / 1000;

export const lbPerMwhToTonnesPerKwh = (lbPerMwh) => lbPerMwh * LB_PER_MWH_TO_T_PER_KWH;

export const US_GRID_T_PER_KWH = lbPerMwhToTonnesPerKwh(US_GRID_LB_PER_MWH);

export const isKnownState = (state) => typeof state === 'string' && Object.hasOwn(STATE_GRID_LB_PER_MWH, state);

/** Grid factor (t CO2e per kWh) for a state, or the US average when unknown. */
export function gridFactorForState(state) {
  return isKnownState(state) ? lbPerMwhToTonnesPerKwh(STATE_GRID_LB_PER_MWH[state]) : US_GRID_T_PER_KWH;
}
