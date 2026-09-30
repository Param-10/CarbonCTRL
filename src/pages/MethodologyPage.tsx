import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, ExternalLink } from 'lucide-react';
import { apiClient } from '../lib/api';
import { STATE_OPTIONS } from '../lib/profileOptions';
import { useCompanyStore } from '../store/companyStore';

interface Source {
  title: string;
  url: string | null;
}

interface Factor {
  sector: string;
  category: string;
  subsector: string;
  label: string;
  unit: string;
  factor: number;
  source: string;
  varies_by_state: boolean;
  indicative: boolean;
}

interface Benchmark {
  industry: string;
  basis: 'building_energy' | 'total_indicative';
  value: number;
  label: string;
  source: string;
}

interface Methodology {
  state: string | null;
  gwp: { CH4: number; N2O: number; basis: string };
  sources: Record<string, Source>;
  factors: Factor[];
  grid: { year: number; us_average_lb_per_mwh: number; states: { code: string; name: string; lb_per_mwh: number }[] };
  benchmarks: Benchmark[];
  grading: { bands: { grade: string; max_ratio: number | null }[]; min_months_for_firm_grade: number };
}

const SELECT_CLASS = 'bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-3 text-white font-mono text-sm';
const TABLE_CLASS = 'w-full font-mono text-sm text-emerald-100/90';
const HEAD_ROW_CLASS = 'text-left text-emerald-100/70 border-b border-white/10';

// Factors are stored in tonnes per unit; kilograms read better for small units like kWh or miles
const kgPerUnit = (tonnes: number) => {
  const kg = tonnes * 1000;
  if (kg === 0) return '0';
  return kg >= 100 ? Math.round(kg).toLocaleString() : Number(kg.toPrecision(3)).toString();
};

function describeBand(bands: Methodology['grading']['bands'], index: number) {
  const { max_ratio: max } = bands[index];
  const min = index > 0 ? bands[index - 1].max_ratio : null;
  if (max === null) return `More than ${min}x typical`;
  if (min === null) return `Up to ${max}x typical`;
  return `${min}x to ${max}x typical`;
}

/** How emissions, factors and grades are calculated, with sources. */
const MethodologyPage = () => {
  const { profile, loaded: profileLoaded } = useCompanyStore();
  // Follows the company's state until the user picks one ('' is the US average)
  const [chosenState, setChosenState] = useState<string | null>(null);
  const state = chosenState ?? profile?.state ?? '';
  const [data, setData] = useState<Methodology | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Wait for the profile so the page doesn't load the US average first and then the company's state
    if (!profileLoaded) return;
    let cancelled = false;
    setError('');
    apiClient
      .getMethodology(state || null)
      .then((result: Methodology) => !cancelled && setData(result))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load the methodology'));
    return () => {
      cancelled = true;
    };
  }, [state, profileLoaded]);

  const factorsByCategory = useMemo(() => {
    const groups = new Map<string, Factor[]>();
    for (const factor of data?.factors ?? []) {
      groups.set(factor.category, [...(groups.get(factor.category) ?? []), factor]);
    }
    return [...groups.entries()];
  }, [data]);

  // Describe the loaded figures, not the selection, so text and tables agree while a new state loads
  const stateName = STATE_OPTIONS.find((option) => option.value === data?.state)?.label;
  const stateGrid = data?.grid.states.find((s) => s.code === data?.state);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-space text-3xl sm:text-4xl font-bold text-white mb-2">Methodology</h1>
        <p className="font-mono text-emerald-100/80 max-w-3xl">
          How CarbonCTRL turns your activity data into emissions and a grade, and where every number comes from.
        </p>
      </div>

      <div className="feature-card p-4 flex flex-wrap items-center gap-3">
        <label htmlFor="methodology-state" className="font-mono text-sm text-emerald-100/80">Show figures for</label>
        <select id="methodology-state" value={state} onChange={(e) => setChosenState(e.target.value)} className={SELECT_CLASS}>
          <option value="">US average</option>
          {STATE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {profile?.state && state !== profile.state && (
          <button onClick={() => setChosenState(null)} className="font-mono text-xs text-emerald-300 underline hover:text-emerald-200">
            Use my company's state
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 p-4 rounded-lg border border-red-500/30 bg-red-500/10">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="font-mono text-sm text-red-200">{error}</p>
        </div>
      )}

      {!data && !error && <p className="font-mono text-emerald-100/70">Loading methodology...</p>}

      {data && (
        <>
          <section className="feature-card p-6 space-y-3 font-mono text-sm text-emerald-100/90">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              <h2 className="font-space text-xl font-semibold text-white">How emissions are calculated</h2>
            </div>
            <p>
              Each activity you record is multiplied by an emission factor for its type: for example, kWh of grid electricity times
              the grid's emissions per kWh. Results are in metric tonnes of carbon dioxide equivalent (tCO₂e), which adds methane
              and nitrous oxide using {data.gwp.basis} (CH₄ = {data.gwp.CH4}, N₂O = {data.gwp.N2O}).
            </p>
            <p>
              Grid electricity uses the rate for your state from EPA eGRID{data.grid.year}
              {stateGrid
                ? `: ${stateName} is ${stateGrid.lb_per_mwh.toLocaleString()} lb CO₂e per MWh, against a US average of ${data.grid.us_average_lb_per_mwh.toLocaleString()}.`
                : `, or the US average of ${data.grid.us_average_lb_per_mwh.toLocaleString()} lb CO₂e per MWh when no state is set.`}{' '}
              State rates describe power generated in the state. EPA recommends eGRID subregion factors, looked up by ZIP code, for
              formal inventories.
            </p>
            <p>
              Figures are estimates for managing and reducing emissions. They are not an audited greenhouse gas inventory.
            </p>
          </section>

          <section className="feature-card p-6 space-y-4">
            <h2 className="font-space text-xl font-semibold text-white">How your grade works</h2>
            <div className="font-mono text-sm text-emerald-100/90 space-y-3">
              <p>
                Your emissions are annualized from the months you have recorded and divided by your headcount, then compared with a
                typical figure for your industry. The grade reflects the ratio between the two, so a small company is not penalized
                for being small, and a large one is not rewarded for being large.
              </p>
              <p>
                Office, retail, hospitality, health care, education and warehouse-type industries are graded on building energy
                (electricity plus heating and cooling) per employee, against EIA CBECS 2018 energy use per worker for that building
                type, converted with the same grid rate as your own electricity. Industrial sectors have no comparable public
                dataset, so they are graded on total emissions against an indicative figure.
              </p>
              <p>
                With less than {data.grading.min_months_for_firm_grade} months of data, the grade is marked provisional.
              </p>
            </div>
            <table className={TABLE_CLASS}>
              <caption className="sr-only">Grade bands</caption>
              <thead><tr className={HEAD_ROW_CLASS}><th scope="col" className="py-2">Grade</th><th scope="col" className="py-2">Your emissions per employee</th></tr></thead>
              <tbody>
                {data.grading.bands.map((band, index) => (
                  <tr key={band.grade} className="border-b border-white/5">
                    <td className="py-2 text-white">{band.grade}</td>
                    <td className="py-2">{describeBand(data.grading.bands, index)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="feature-card p-6">
            <h2 className="font-space text-xl font-semibold text-white mb-1">Industry benchmarks</h2>
            <p className="font-mono text-xs text-emerald-100/70 mb-4">
              tCO₂e per employee per year{stateName ? `, using the ${stateName} grid` : ', using the US average grid'}. Industries not
              listed are compared with a typical office.
            </p>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Industry benchmarks table">
              <table className={TABLE_CLASS}>
                <caption className="sr-only">Industry benchmarks</caption>
                <thead>
                  <tr className={HEAD_ROW_CLASS}>
                    <th scope="col" className="py-2 pr-4">Industry</th>
                    <th scope="col" className="py-2 pr-4">Compared on</th>
                    <th scope="col" className="py-2 text-right">Typical</th>
                  </tr>
                </thead>
                <tbody>
                  {data.benchmarks.map((b) => (
                    <tr key={b.industry} className="border-b border-white/5">
                      <td className="py-2 pr-4">{b.industry}</td>
                      <td className="py-2 pr-4">
                        {b.basis === 'building_energy' ? `Building energy (${b.label}, CBECS)` : 'Total emissions (indicative)'}
                      </td>
                      <td className="py-2 text-right">{b.value.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="feature-card p-6">
            <h2 className="font-space text-xl font-semibold text-white mb-1">Emission factors</h2>
            <p className="font-mono text-xs text-emerald-100/70 mb-4">
              Kilograms of CO₂e per unit. Factors marked indicative have no authoritative US default and are rough approximations.
            </p>
            <div className="space-y-6">
              {factorsByCategory.map(([category, factors]) => (
                <div key={category} className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${category} emission factors`}>
                  <table className={TABLE_CLASS}>
                    <caption className="text-left font-space text-base font-semibold text-white mb-2">{category}</caption>
                    <thead>
                      <tr className={HEAD_ROW_CLASS}>
                        <th scope="col" className="py-2 pr-4">Activity</th>
                        <th scope="col" className="py-2 pr-4">Unit</th>
                        <th scope="col" className="py-2 pr-4 text-right">kg CO₂e per unit</th>
                        <th scope="col" className="py-2">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {factors.map((f) => (
                        <tr key={f.subsector} className="border-b border-white/5 align-top">
                          <td className="py-2 pr-4">{f.label}</td>
                          <td className="py-2 pr-4">{f.unit}</td>
                          <td className="py-2 pr-4 text-right">
                            {kgPerUnit(f.factor)}
                            {f.varies_by_state && <span className="block text-xs text-emerald-100/60">varies by state</span>}
                          </td>
                          <td className="py-2 text-xs">
                            {f.indicative ? <span className="text-amber-300/90">Indicative</span> : data.sources[f.source]?.title ?? f.source}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>

          <section className="feature-card p-6">
            <h2 className="font-space text-xl font-semibold text-white mb-4">Sources</h2>
            <ul className="font-mono text-sm text-emerald-100/90 space-y-2">
              {Object.entries(data.sources)
                .filter(([, source]) => source.url)
                .map(([key, source]) => (
                  <li key={key}>
                    <a href={source.url ?? undefined} target="_blank" rel="noreferrer" className="text-emerald-300 underline hover:text-emerald-200 inline-flex items-center gap-1">
                      {source.title}
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </li>
                ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
};

export default MethodologyPage;
