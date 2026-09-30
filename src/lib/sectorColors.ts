/**
 * Fixed color and label per emission category, so a category keeps its color
 * across charts and when other categories are added or removed. Keys match
 * the categories in server/config/emissionFactors.js.
 *
 * Colors are the eight dark-surface categorical steps, validated (CVD and
 * normal-vision separation, in this order) against the dashboard's card
 * surfaces. A few sit near 3:1 contrast, so charts using them must also show
 * a legend and a data table. Farming, the ninth category, uses the neutral
 * "other" color rather than a generated ninth hue.
 */
export const SECTOR_COLORS: Record<string, string> = {
  electricity: '#3987e5',
  heating_cooling: '#d95926',
  vehicles: '#199e70',
  business_travel: '#c98500',
  commuting: '#d55181',
  freight: '#008300',
  waste: '#9085e9',
  materials: '#e66767',
};

export const SECTOR_LABELS: Record<string, string> = {
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

// Categories are drawn in this order everywhere so stacks line up month to month
export const SECTOR_ORDER = [...Object.keys(SECTOR_COLORS), 'agriculture'];

const OTHER_SECTOR_COLOR = '#8b8a85';

// Approximates the card surface, so the 2px gaps between chart segments read
// as background rather than as an outline
export const CHART_GAP_COLOR = '#17302b';

export const sectorColor = (sector: string) => SECTOR_COLORS[sector] ?? OTHER_SECTOR_COLOR;

export const sectorLabel = (sector: string) =>
  SECTOR_LABELS[sector] ?? sector.charAt(0).toUpperCase() + sector.slice(1).replace(/[_-]/g, ' ');
