import type { EmissionsIntensity } from '../store/carbonStore';
import { labelFor, STATE_OPTIONS } from './profileOptions';

/** What the grade measures, e.g. "Building energy (electricity, heating and cooling)". */
export const gradedMeasure = (intensity: EmissionsIntensity) =>
  intensity.basis === 'building_energy' ? 'Building energy (electricity, heating and cooling)' : 'Total emissions';

/** The benchmark the grade compares against, e.g. "typical for office buildings in Texas". */
export function benchmarkDescription(intensity: EmissionsIntensity) {
  if (intensity.basis === 'total_indicative') {
    return `an indicative ${intensity.industry_benchmark} tCO₂e for ${intensity.benchmark_label}`;
  }
  const stateName = labelFor(STATE_OPTIONS, intensity.state);
  const where = stateName ? ` in ${stateName}` : ' at the US average grid rate';
  return `a typical ${intensity.industry_benchmark} tCO₂e for ${intensity.benchmark_label}${where}`;
}
