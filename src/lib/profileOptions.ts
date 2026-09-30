/**
 * Options for the company profile's sustainability context. Values must match
 * server/config/profileOptions.js, which validates them.
 */

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

/** Industries on the profile; keys match server/config/industryBenchmarks.js */
export const INDUSTRY_OPTIONS: string[] = [
  'Agriculture',
  'Construction',
  'Education',
  'Energy',
  'Financial Services',
  'Food & Beverage Production',
  'Government & Public Sector',
  'Healthcare',
  'Hospitality',
  'Manufacturing',
  'Media & Entertainment',
  'Nonprofit',
  'Professional Services',
  'Real Estate',
  'Restaurants & Food Service',
  'Retail',
  'Technology',
  'Telecommunications',
  'Transportation',
  'Wholesale & Distribution',
  'Other',
];

/** US states (plus DC and Puerto Rico); keys match US_STATES on the server */
export const STATE_OPTIONS: Option[] = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'PR', label: 'Puerto Rico' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

/** Employee ranges on the profile; keys match EMPLOYEE_RANGE_ESTIMATES on the server */
export const EMPLOYEE_RANGE_OPTIONS: string[] = ['1-10', '11-50', '51-200', '201-500', '500+'];

export const REDUCTION_BUDGET_OPTIONS: Option[] = [
  { value: 'low', label: 'Low (under $10k)' },
  { value: 'medium', label: 'Medium ($10k-$50k)' },
  { value: 'high', label: 'High (over $50k)' },
];

export const PREMISES_OWNERSHIP_OPTIONS: Option[] = [
  { value: 'own', label: 'We own our premises' },
  { value: 'lease', label: 'We lease our premises' },
  { value: 'mixed', label: 'Mix of owned and leased' },
  { value: 'none', label: 'No dedicated premises (fully remote)' },
];

export const RENEWABLE_SHARE_OPTIONS: Option[] = [
  { value: 'none', label: 'None' },
  { value: 'partial', label: 'Partial' },
  { value: 'full', label: '100% renewable' },
  { value: 'unknown', label: 'Not sure' },
];

export const FLEET_TYPE_OPTIONS: Option[] = [
  { value: 'combustion', label: 'Gasoline / diesel' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'electric', label: 'Electric' },
  { value: 'mixed', label: 'Mixed' },
];

export const WORK_MODEL_OPTIONS: Option[] = [
  { value: 'onsite', label: 'Fully on-site' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Fully remote' },
];

export const EXISTING_MEASURE_OPTIONS: Option[] = [
  { value: 'led_lighting', label: 'LED lighting' },
  { value: 'recycling_program', label: 'Recycling / waste separation' },
  { value: 'renewable_tariff', label: 'Green electricity tariff or PPA' },
  { value: 'onsite_solar', label: 'On-site solar' },
  { value: 'ev_fleet', label: 'Electric vehicles in fleet' },
  { value: 'smart_hvac', label: 'Smart heating / cooling controls' },
  { value: 'energy_audit', label: 'Energy audit completed' },
  { value: 'commuting_incentives', label: 'Commuting incentives (transit, cycling)' },
  { value: 'supplier_engagement', label: 'Supplier emissions engagement' },
  { value: 'carbon_offsets', label: 'Carbon offsets' },
];

export const REPORTING_OBLIGATION_OPTIONS: Option[] = [
  { value: 'csrd', label: 'EU CSRD' },
  { value: 'uk_secr', label: 'UK SECR' },
  { value: 'sec_climate', label: 'US SEC climate disclosure' },
  { value: 'california_sb253', label: 'California SB 253' },
  { value: 'iso_14001', label: 'ISO 14001' },
  { value: 'cdp', label: 'CDP disclosure' },
  { value: 'sbti', label: 'Science Based Targets (SBTi)' },
  { value: 'b_corp', label: 'B Corp' },
];

export const labelFor = (options: Option[], value: string | null | undefined) =>
  options.find((option) => option.value === value)?.label ?? null;
