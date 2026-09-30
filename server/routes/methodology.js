/**
 * How CarbonCTRL calculates everything: the data behind the Methodology page.
 * Public and read-only; it only exposes reference data, never user data, and
 * is built from the same config the calculations use so the two can't drift.
 */
import express from 'express';
import { CATEGORY_LABELS, EMISSION_FACTORS, FACTOR_SOURCES, factorFor } from '../config/emissionFactors.js';
import { EGRID_YEAR, STATE_GRID_LB_PER_MWH, US_GRID_LB_PER_MWH, isKnownState } from '../config/stateGridFactors.js';
import { US_STATES } from '../config/profileOptions.js';
import { allIndustryBenchmarks } from '../config/industryBenchmarks.js';
import { GRADE_BANDS, MIN_MONTHS_FOR_FIRM_GRADE } from '../services/carbonScore.js';

const router = express.Router();

// GET /api/methodology?state=TX (state optional; tailors state-dependent figures)
router.get('/', (req, res) => {
  const state = isKnownState(req.query.state) ? req.query.state : null;

  const factors = Object.entries(EMISSION_FACTORS).flatMap(([sector, items]) =>
    Object.entries(items).map(([subsector, item]) => ({
      sector,
      category: CATEGORY_LABELS[sector],
      subsector,
      label: item.label,
      unit: item.unit,
      factor: factorFor(sector, subsector, { state }),
      source: item.source,
      varies_by_state: Boolean(item.varies_by_state),
      indicative: item.source === 'indicative',
    }))
  );

  res.json({
    state,
    gwp: { CH4: 28, N2O: 265, basis: 'IPCC AR5 100-year, as used by the EPA GHG Emission Factors Hub' },
    sources: FACTOR_SOURCES,
    factors,
    grid: {
      year: EGRID_YEAR,
      us_average_lb_per_mwh: US_GRID_LB_PER_MWH,
      states: Object.entries(STATE_GRID_LB_PER_MWH)
        .map(([code, lbPerMwh]) => ({ code, name: US_STATES[code] ?? code, lb_per_mwh: lbPerMwh }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
    benchmarks: allIndustryBenchmarks(state),
    grading: { bands: GRADE_BANDS, min_months_for_firm_grade: MIN_MONTHS_FOR_FIRM_GRADE },
  });
});

export default router;
