/**
 * Allowed values for the company profile's sustainability context.
 *
 * Keys are what the API stores; labels are what Gemini sees in the prompt.
 * The frontend keeps a matching copy in src/lib/profileOptions.ts.
 */

/** US states (plus DC and Puerto Rico); the state sets the grid electricity factor. */
export const US_STATES = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  PR: 'Puerto Rico',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

export const CHOICE_FIELDS = {
  state: US_STATES,
  reductionBudget: {
    low: 'Low (under $10k)',
    medium: 'Medium ($10k-$50k)',
    high: 'High (over $50k)',
  },
  premisesOwnership: {
    own: 'Owns its premises',
    lease: 'Leases its premises',
    mixed: 'Mix of owned and leased premises',
    none: 'No dedicated premises (fully remote)',
  },
  renewableElectricityShare: {
    none: 'None',
    partial: 'Partial',
    full: '100% renewable',
    unknown: 'Not sure',
  },
  fleetType: {
    combustion: 'Gasoline / diesel',
    hybrid: 'Hybrid',
    electric: 'Electric',
    mixed: 'Mixed',
  },
  workModel: {
    onsite: 'Fully on-site',
    hybrid: 'Hybrid',
    remote: 'Fully remote',
  },
};

export const MULTI_CHOICE_FIELDS = {
  existingMeasures: {
    led_lighting: 'LED lighting',
    recycling_program: 'Recycling / waste separation',
    renewable_tariff: 'Green electricity tariff or PPA',
    onsite_solar: 'On-site solar',
    ev_fleet: 'Electric vehicles in fleet',
    smart_hvac: 'Smart heating / cooling controls',
    energy_audit: 'Energy audit completed',
    commuting_incentives: 'Commuting incentives (transit, cycling)',
    supplier_engagement: 'Supplier emissions engagement',
    carbon_offsets: 'Carbon offsets',
  },
  reportingObligations: {
    csrd: 'EU CSRD',
    uk_secr: 'UK SECR',
    sec_climate: 'US SEC climate disclosure',
    california_sb253: 'California SB 253',
    iso_14001: 'ISO 14001',
    cdp: 'CDP disclosure',
    sbti: 'Science Based Targets (SBTi)',
    b_corp: 'B Corp',
  },
};

// Target years in the past are allowed so an older profile can still be
// re-saved without the user being forced to change its target first.
export const INTEGER_FIELDS = {
  reductionTargetPercent: { min: 1, max: 100 },
  reductionTargetYear: { min: 2020, max: 2100 },
  fleetSize: { min: 0, max: 100000 },
  siteCount: { min: 1, max: 10000 },
  // Exact headcount; refines the per-employee grade over the range estimate
  employeeCount: { min: 1, max: 1000000 },
};

export const PROFILE_CONTEXT_FIELDS = [
  ...Object.keys(CHOICE_FIELDS),
  ...Object.keys(MULTI_CHOICE_FIELDS),
  ...Object.keys(INTEGER_FIELDS),
];

const isBlank = (value) => value === null || value === '';

/**
 * Validate the sustainability-context fields of a profile request body.
 *
 * Fields that are absent are left out of `values` (so updates don't touch
 * them); blank fields become null (cleared). Anything else must be a valid
 * option, otherwise a message is added to `errors`.
 */
export function parseProfileContext(body = {}) {
  const values = {};
  const errors = [];

  for (const [field, options] of Object.entries(CHOICE_FIELDS)) {
    const value = body[field];
    if (value === undefined) continue;
    if (isBlank(value)) {
      values[field] = null;
    } else if (typeof value === 'string' && Object.hasOwn(options, value)) {
      values[field] = value;
    } else {
      errors.push(`${field} must be one of: ${Object.keys(options).join(', ')}`);
    }
  }

  for (const [field, { min, max }] of Object.entries(INTEGER_FIELDS)) {
    const value = body[field];
    if (value === undefined) continue;
    if (isBlank(value)) {
      values[field] = null;
      continue;
    }
    const number = typeof value === 'string' ? Number(value) : value;
    if (Number.isInteger(number) && number >= min && number <= max) {
      values[field] = number;
    } else {
      errors.push(`${field} must be a whole number between ${min} and ${max}`);
    }
  }

  for (const [field, options] of Object.entries(MULTI_CHOICE_FIELDS)) {
    const value = body[field];
    if (value === undefined) continue;
    if (value === null) {
      values[field] = null;
    } else if (Array.isArray(value) && value.every((item) => Object.hasOwn(options, item))) {
      values[field] = [...new Set(value)];
    } else {
      errors.push(`${field} must be a list containing only: ${Object.keys(options).join(', ')}`);
    }
  }

  // A fleet type without vehicles is meaningless; drop it so the prompt
  // never describes a fleet the company says it doesn't have.
  if (values.fleetSize === 0) {
    values.fleetType = null;
  }

  return { values, errors };
}
