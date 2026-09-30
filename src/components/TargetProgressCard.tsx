import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import type { TargetProgress } from '../store/actionStore';
import { formatMonth } from '../lib/usEstimates';

const tonnes = (value: number) => `${value.toFixed(value >= 10 ? 0 : 1)} t`;
const pct = (part: number, whole: number) => (whole > 0 ? Math.min(100, (part / whole) * 100) : 0);

/**
 * Progress toward the reduction target. Completed and planned actions are
 * estimates and shown as a meter against what the target needs; measured
 * change from recorded data is shown separately, once there is enough of it.
 */
const TargetProgressCard = ({ progress }: { progress: TargetProgress | null }) => {
  const heading = (
    <div className="flex items-center gap-4 mb-5">
      <div className="bg-emerald-500/20 p-4 rounded-lg">
        <Target className="w-6 h-6 text-emerald-400" />
      </div>
      <div>
        <h2 className="font-space text-xl font-semibold text-white">Target Progress</h2>
        <p className="font-mono text-sm text-emerald-100/70">
          {progress?.target
            ? `Cut emissions ${progress.target.percent}%${progress.target.year ? ` by ${progress.target.year}` : ''}`
            : 'How your plan measures up to your goal'}
        </p>
      </div>
    </div>
  );

  if (!progress) return null;

  if (!progress.target) {
    return (
      <div className="feature-card p-6">
        {heading}
        <p className="font-mono text-sm text-emerald-100/70">
          Set a reduction target to see how far your action plan gets you.{' '}
          <Link to="/company-profile" className="text-emerald-300 hover:text-emerald-200 underline">Add a target</Link>
        </p>
      </div>
    );
  }

  if (!progress.baseline || progress.required_reduction === null) {
    return (
      <div className="feature-card p-6">
        {heading}
        <p className="font-mono text-sm text-emerald-100/70">Log a month of activity to set your baseline.</p>
      </div>
    );
  }

  const { done_reduction: done, planned_reduction: planned, coverage_percent: coverage } = progress.estimated;
  const required = progress.required_reduction;
  const donePct = pct(done, required);
  const plannedPct = Math.min(100 - donePct, pct(planned, required));
  const { baseline, measured } = progress;

  return (
    <div className="feature-card p-6">
      {heading}

      <p className="font-mono text-sm text-emerald-100/80 mb-4">
        Needed: cut <span className="text-white">{tonnes(required)} a year</span> from a baseline of {tonnes(baseline.annual_emissions)} a year
        <span className="text-emerald-100/50">
          {' '}({formatMonth(baseline.from)}{baseline.to !== baseline.from ? ` to ${formatMonth(baseline.to)}` : ''}, {baseline.months} month{baseline.months === 1 ? '' : 's'} logged)
        </span>
      </p>

      <div
        role="meter"
        aria-label="Share of the needed reduction covered by your action plan"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(donePct + plannedPct)}
        className="h-4 rounded-full bg-gray-800/80 overflow-hidden flex gap-[2px]"
      >
        {donePct > 0 && <div className="h-full bg-emerald-400" style={{ width: `${donePct}%` }} />}
        {plannedPct > 0 && <div className="h-full bg-emerald-400/40" style={{ width: `${plannedPct}%` }} />}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-emerald-100/80">
        <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-emerald-400" aria-hidden /> Done: {tonnes(done)}/yr</li>
        <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-emerald-400/40" aria-hidden /> Planned: {tonnes(planned)}/yr</li>
        <li className="text-white">
          {coverage !== null && coverage >= 100
            ? 'Your plan covers the whole target'
            : `Your plan covers ${coverage ?? 0}% of what the target needs`}
        </li>
      </ul>

      <p className="mt-4 font-mono text-xs text-emerald-100/60">
        {measured
          ? `Measured so far: ${measured.percent > 0 ? `down ${measured.percent}%` : `up ${Math.abs(measured.percent)}%`} (${tonnes(measured.current_annual_emissions)} a year over the latest 12 months).`
          : 'Plan savings are estimates. Measured progress appears once you have logged more than 12 months.'}
      </p>
    </div>
  );
};

export default TargetProgressCard;
