/**
 * Rough US figures for turning what people know (a bill amount, trips per
 * year, trash carts) into the units emission factors need. Every result made
 * with these is an estimate and is labeled as one in the UI.
 *
 * Prices are approximate US average commercial prices (EIA); update yearly.
 */

export interface ActivityType {
  sector: string;
  subsector: string;
}

/** Price per unit, for types where a bill amount can stand in for usage */
export const US_AVERAGE_PRICES: Record<string, { perUnit: number; unit: string }> = {
  'electricity/grid-electricity': { perUnit: 0.13, unit: 'kWh' },
  'heating_cooling/natural-gas': { perUnit: 1.1, unit: 'therm' },
  'vehicles/gasoline': { perUnit: 3.3, unit: 'gallon' },
  'vehicles/diesel': { perUnit: 3.8, unit: 'gallon' },
};

export const typeKey = ({ sector, subsector }: ActivityType) => `${sector}/${subsector}`;

/** Usage estimated from a bill amount in dollars, or null if no price is known. */
export function usageFromBill(type: ActivityType, dollars: number): number | null {
  const price = US_AVERAGE_PRICES[typeKey(type)];
  return price ? Math.round(dollars / price.perUnit) : null;
}

// Typical domestic round trips: short ~2 x 250 miles, longer ~2 x 1,500 miles
export const SHORT_ROUND_TRIP_MILES = 500;
export const LONG_ROUND_TRIP_MILES = 3000;

/** Monthly passenger-miles from round trips per year (spread evenly). */
export const monthlyFlightMiles = (roundTripsPerYear: number, milesPerRoundTrip: number) =>
  Math.round((roundTripsPerYear * milesPerRoundTrip) / 12);

// A full 96-gallon trash cart of mixed business waste weighs roughly 70 lbs
export const LBS_PER_TRASH_CART = 70;
const WEEKS_PER_MONTH = 52 / 12;

/** Monthly pounds of trash from 96-gallon carts filled per week. */
export const monthlyTrashLbs = (cartsPerWeek: number) => Math.round(cartsPerWeek * LBS_PER_TRASH_CART * WEEKS_PER_MONTH);

/** Activity types offered in the monthly log, before any the user has added themselves. */
export const COMMON_MONTHLY_TYPES: ActivityType[] = [
  { sector: 'electricity', subsector: 'grid-electricity' },
  { sector: 'heating_cooling', subsector: 'natural-gas' },
  { sector: 'vehicles', subsector: 'gasoline' },
  { sector: 'vehicles', subsector: 'diesel' },
  { sector: 'business_travel', subsector: 'flight-short' },
  { sector: 'business_travel', subsector: 'flight-medium-long' },
  { sector: 'business_travel', subsector: 'hotel-nights' },
  { sector: 'commuting', subsector: 'car-miles' },
  { sector: 'waste', subsector: 'landfill' },
  { sector: 'waste', subsector: 'recycling' },
];

/** YYYY-MM for the month before `date` (local time). */
export function previousMonth(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** YYYY-MM for `date` (local time). */
export function currentMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** YYYY-MM one month before `month`. */
export function monthBefore(month: string) {
  const [year, m] = month.split('-').map(Number);
  return previousMonth(new Date(year, m - 1, 15));
}

const MONTH_LABEL = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
export const formatMonth = (month: string) => {
  const [year, m] = month.split('-').map(Number);
  return MONTH_LABEL.format(new Date(year, m - 1, 1));
};
