import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, CheckCircle2, ListTodo, Plus } from 'lucide-react';
import { ActionItem, ActionStatus, useActionStore } from '../store/actionStore';
import { SECTOR_LABELS, sectorLabel } from '../lib/sectorColors';
import TargetProgressCard from '../components/TargetProgressCard';

const SECTIONS: { status: ActionStatus; title: string; empty: string }[] = [
  { status: 'in_progress', title: 'In progress', empty: 'Nothing in progress yet.' },
  { status: 'planned', title: 'Planned', empty: 'No planned actions.' },
  { status: 'done', title: 'Done', empty: 'Completed actions will appear here.' },
];

const INPUT_CLASS = 'w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-sm';

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

interface ActionCardProps {
  action: ActionItem;
  busy: boolean;
  onStatus: (status: ActionStatus) => void;
  onRemove?: () => void;
}

/** One action with the status moves that make sense from where it is. */
const ActionCard = ({ action, busy, onStatus, onRemove }: ActionCardProps) => {
  const moves: { label: string; status: ActionStatus }[] = {
    planned: [{ label: 'Start', status: 'in_progress' as const }, { label: 'Mark done', status: 'done' as const }, { label: 'Dismiss', status: 'dismissed' as const }],
    in_progress: [{ label: 'Mark done', status: 'done' as const }, { label: 'Move back to planned', status: 'planned' as const }],
    done: [{ label: 'Reopen', status: 'in_progress' as const }],
    dismissed: [{ label: 'Restore to planned', status: 'planned' as const }],
  }[action.status];

  return (
    <li className="p-4 bg-gray-800/50 rounded-lg border border-emerald-500/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-white flex items-center gap-2">
            {action.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" aria-label="Done" />}
            {action.title}
          </p>
          <p className="font-mono text-xs text-emerald-100/60 mt-1">
            Saves about {action.annualImpact.toFixed(action.annualImpact >= 10 ? 0 : 2)} tCO₂e a year
            {action.sector && ` · ${sectorLabel(action.sector)}`}
            {action.cost && ` · ${action.cost} cost`}
            {action.timeline && ` · ${action.timeline}`}
          </p>
          {action.description && <p className="font-mono text-sm text-emerald-100/70 mt-2 max-w-3xl">{action.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {moves.map((move) => (
            <button
              key={move.status}
              disabled={busy}
              onClick={() => onStatus(move.status)}
              className="px-3 py-1.5 rounded-lg border border-emerald-500/30 font-mono text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {move.label}
            </button>
          ))}
          {onRemove && (
            <button
              disabled={busy}
              onClick={onRemove}
              className="px-3 py-1.5 rounded-lg font-mono text-xs text-red-300/80 hover:text-red-300 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </li>
  );
};

const ActionPlanPage = () => {
  const { actions, progress, loaded, load, add, setStatus, remove } = useActionStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showDismissed, setShowDismissed] = useState(false);
  const [custom, setCustom] = useState({ title: '', annualImpact: '', sector: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (id: string, change: () => Promise<void>) => {
    setBusyId(id);
    setError('');
    try {
      await change();
    } catch (err) {
      setError(errorMessage(err, 'Could not update the action'));
    } finally {
      setBusyId(null);
    }
  };

  const addCustom = async () => {
    const annualImpact = custom.annualImpact.trim() === '' ? 0 : Number(custom.annualImpact);
    if (!custom.title.trim()) {
      setError('Give the action a name');
      return;
    }
    if (!Number.isFinite(annualImpact) || annualImpact < 0) {
      setError('Yearly saving must be a number of zero or more');
      return;
    }
    setAdding(true);
    setError('');
    try {
      await add({ title: custom.title.trim(), annualImpact, sector: custom.sector || null });
      setCustom({ title: '', annualImpact: '', sector: '' });
    } catch (err) {
      setError(errorMessage(err, 'Could not add the action'));
    } finally {
      setAdding(false);
    }
  };

  const dismissed = actions.filter((a) => a.status === 'dismissed');
  const active = actions.filter((a) => a.status !== 'dismissed');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-space text-3xl sm:text-4xl font-bold text-white mb-2">Action Plan</h1>
        <p className="font-mono text-emerald-100/80">The reduction actions you've chosen, and how far they get you toward your target</p>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 p-4 rounded-lg border border-red-500/30 bg-red-500/10">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="font-mono text-sm text-red-200">{error}</p>
        </div>
      )}

      <TargetProgressCard progress={progress} />

      {loaded && active.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="feature-card p-8 text-center">
          <ListTodo className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <h2 className="font-space text-xl font-semibold text-white mb-2">Your plan is empty</h2>
          <p className="font-mono text-sm text-emerald-100/70 mb-4">Add actions from your recommendations, or add your own below.</p>
          <Link to="/recommendations" className="glass-button px-5 py-2 rounded-lg inline-flex items-center gap-2 font-mono text-sm">
            See recommendations <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      )}

      {active.length > 0 && SECTIONS.map(({ status, title, empty }) => {
        const items = actions.filter((a) => a.status === status);
        return (
          <section key={status} className="feature-card p-6" aria-labelledby={`section-${status}`}>
            <h2 id={`section-${status}`} className="font-space text-lg font-semibold text-white mb-4">
              {title} <span className="font-mono text-sm text-emerald-100/50">({items.length})</span>
            </h2>
            {items.length === 0 ? (
              <p className="font-mono text-sm text-emerald-100/50">{empty}</p>
            ) : (
              <ul className="space-y-3">
                {items.map((action) => (
                  <ActionCard
                    key={action._id}
                    action={action}
                    busy={busyId === action._id}
                    onStatus={(next) => run(action._id, () => setStatus(action._id, next))}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section className="feature-card p-6" aria-labelledby="custom-action">
        <h2 id="custom-action" className="font-space text-lg font-semibold text-white mb-4">Add your own action</h2>
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_auto] items-end">
          <label className="font-mono text-xs text-emerald-100/70">
            Action
            <input value={custom.title} onChange={(e) => setCustom({ ...custom, title: e.target.value })} placeholder="e.g. Switch delivery vans to EVs" className={`${INPUT_CLASS} mt-1`} />
          </label>
          <label className="font-mono text-xs text-emerald-100/70">
            Yearly saving (tCO₂e, optional)
            <input type="number" min={0} step="any" value={custom.annualImpact} onChange={(e) => setCustom({ ...custom, annualImpact: e.target.value })} className={`${INPUT_CLASS} mt-1`} />
          </label>
          <label className="font-mono text-xs text-emerald-100/70">
            Category (optional)
            <select value={custom.sector} onChange={(e) => setCustom({ ...custom, sector: e.target.value })} className={`${INPUT_CLASS} mt-1`}>
              <option value="">None</option>
              {Object.entries(SECTOR_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <button onClick={addCustom} disabled={adding} className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-mono text-sm inline-flex items-center gap-2 disabled:opacity-60">
            <Plus className="w-4 h-4" /> {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </section>

      {dismissed.length > 0 && (
        <section className="feature-card p-6">
          <button onClick={() => setShowDismissed((v) => !v)} className="font-mono text-sm text-emerald-300 hover:text-emerald-200">
            {showDismissed ? 'Hide' : 'Show'} dismissed actions ({dismissed.length})
          </button>
          {showDismissed && (
            <ul className="space-y-3 mt-4">
              {dismissed.map((action) => (
                <ActionCard
                  key={action._id}
                  action={action}
                  busy={busyId === action._id}
                  onStatus={(next) => run(action._id, () => setStatus(action._id, next))}
                  onRemove={() => run(action._id, () => remove(action._id))}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};

export default ActionPlanPage;
