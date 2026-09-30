import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CalendarDays, X } from 'lucide-react';
import type { CarbonActivity, MonthEntry } from '../store/carbonStore';
import { sectorLabel } from '../lib/sectorColors';
import { useDialog } from '../hooks/useDialog';
import {
  ActivityType,
  COMMON_MONTHLY_TYPES,
  US_AVERAGE_PRICES,
  currentMonth,
  formatMonth,
  monthBefore,
  previousMonth,
  typeKey,
  usageFromBill,
} from '../lib/usEstimates';

export type EmissionCatalog = Record<string, Record<string, { label?: string; unit: string; description: string; factor: number }>>;

interface LogMonthModalProps {
  catalog: EmissionCatalog;
  activities: CarbonActivity[];
  onSave: (month: string, entries: MonthEntry[]) => Promise<void>;
  onClose: () => void;
}

interface RowState {
  value: string;
  byBill: boolean;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

const INPUT_CLASS = 'w-full bg-gray-700/50 border border-emerald-500/30 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono';

/** Sum of an activity type's amounts dated in `month`, or null if none. */
function monthTotal(activities: CarbonActivity[], type: ActivityType, month: string) {
  const matching = activities.filter(
    (a) => a.sector === type.sector && a.subsector === type.subsector && a.activityDate?.startsWith(month)
  );
  return matching.length > 0 ? matching.reduce((sum, a) => sum + a.activityAmount, 0) : null;
}

/** One form to record a month's totals for all of a company's usual activities. */
const LogMonthModal = ({ catalog, activities, onSave, onClose }: LogMonthModalProps) => {
  const [month, setMonth] = useState(previousMonth);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const requestClose = () => {
    if (!saving) onClose();
  };
  useDialog(dialogRef, true, requestClose);

  // Common types first, then any other type the company has logged before
  const types = useMemo(() => {
    const known = new Set(COMMON_MONTHLY_TYPES.map(typeKey));
    const extra = activities
      .filter((a) => catalog[a.sector]?.[a.subsector] && !known.has(typeKey(a)))
      .map((a) => ({ sector: a.sector, subsector: a.subsector }));
    const unique = new Map(extra.map((t) => [typeKey(t), t]));
    return [...COMMON_MONTHLY_TYPES.filter((t) => catalog[t.sector]?.[t.subsector]), ...unique.values()];
  }, [activities, catalog]);

  const priorMonth = monthBefore(month);
  const recordedTotals = useMemo(
    () => Object.fromEntries(types.map((t) => [typeKey(t), monthTotal(activities, t, month)])),
    [types, activities, month]
  );
  const previousTotals = useMemo(
    () => Object.fromEntries(types.map((t) => [typeKey(t), monthTotal(activities, t, priorMonth)])),
    [types, activities, priorMonth]
  );
  const hasPrevious = Object.values(previousTotals).some((total) => total !== null);

  // Prefill only what's already recorded for this month. Last month's figures
  // are shown as hints and copied only on request, so nothing is recorded
  // for a month without the user choosing it.
  useEffect(() => {
    setRows(Object.fromEntries(types.map((type) => {
      const recorded = recordedTotals[typeKey(type)];
      return [typeKey(type), { value: recorded === null ? '' : String(round2(recorded)), byBill: false }];
    })));
    setError('');
  }, [types, recordedTotals]);

  const updateRow = (key: string, change: Partial<RowState>) =>
    setRows((current) => ({ ...current, [key]: { ...current[key], ...change } }));

  const copyPreviousMonth = () =>
    setRows((current) => Object.fromEntries(Object.entries(current).map(([key, row]) => {
      const previous = previousTotals[key];
      return [key, row.value.trim() === '' && previous !== null ? { value: String(round2(previous)), byBill: false } : row];
    })));

  const handleSave = async () => {
    const entries: MonthEntry[] = [];
    for (const type of types) {
      const row = rows[typeKey(type)];
      if (!row || row.value.trim() === '') continue;
      const number = Number(row.value);
      if (!Number.isFinite(number) || number < 0) {
        setError(`${catalog[type.sector][type.subsector].label ?? type.subsector}: enter a number of zero or more`);
        return;
      }
      const amount = row.byBill ? usageFromBill(type, number) : number;
      entries.push({ sector: type.sector, subsector: type.subsector, activityAmount: amount ?? number });
    }
    if (entries.length === 0) {
      setError('Enter at least one amount');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave(month, entries);
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not save this month');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      onClick={requestClose}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-month-title"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 id="log-month-title" className="font-space text-xl font-semibold text-white">Log a month</h2>
            <p className="font-mono text-xs text-emerald-100/60 mt-1">
              Enter each total for the month. Leave a row blank to skip it; saving replaces that month's figure for each row you fill in.
            </p>
          </div>
          <button onClick={requestClose} aria-label="Close" className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <label className="flex items-center gap-3 mb-4 font-mono text-sm text-emerald-100/80">
          <CalendarDays className="w-4 h-4 text-emerald-400" />
          Month
          <input
            data-autofocus
            type="month"
            value={month}
            max={currentMonth()}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className={`${INPUT_CLASS} w-auto [color-scheme:dark]`}
          />
        </label>

        {hasPrevious && (
          <button
            onClick={copyPreviousMonth}
            className="self-start mb-4 font-mono text-sm text-blue-300 hover:text-blue-200 underline underline-offset-4"
          >
            Copy {formatMonth(priorMonth)}'s figures into empty rows
          </button>
        )}

        {error && (
          <div role="alert" className="bg-red-900/20 text-red-400 p-3 rounded-lg mb-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="font-mono text-sm">{error}</p>
          </div>
        )}

        {types.length === 0 && (
          <p className="font-mono text-sm text-emerald-100/60 mb-4">Loading activity types...</p>
        )}

        <ul className="space-y-3 overflow-y-auto pr-1 flex-1">
          {types.map((type) => {
            const key = typeKey(type);
            const item = catalog[type.sector][type.subsector];
            const row = rows[key] ?? { value: '', byBill: false };
            const recorded = recordedTotals[key];
            const previous = previousTotals[key];
            const price = US_AVERAGE_PRICES[key];
            const estimate = row.byBill && row.value.trim() !== '' ? usageFromBill(type, Number(row.value)) : null;
            const inputId = `log-${key}`;

            return (
              <li key={key} className="grid grid-cols-1 sm:grid-cols-[1fr_12rem] gap-2 items-start p-3 bg-gray-900/40 rounded-lg border border-emerald-500/10">
                <div>
                  <label htmlFor={inputId} className="font-mono text-sm text-white">{item.label ?? type.subsector}</label>
                  <p className="font-mono text-xs text-emerald-100/50">{sectorLabel(type.sector)}</p>
                  {recorded !== null && <p className="font-mono text-xs text-emerald-300/80">Already recorded for this month</p>}
                  {price && (
                    <label className="inline-flex items-center gap-2 mt-1 font-mono text-xs text-emerald-100/60 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.byBill}
                        onChange={(e) => updateRow(key, { byBill: e.target.checked, value: '' })}
                      />
                      I only have the bill amount ($)
                    </label>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {row.byBill && <span className="font-mono text-sm text-emerald-100/70">$</span>}
                    <input
                      id={inputId}
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={row.value}
                      placeholder={previous !== null && !row.byBill ? `${formatMonth(priorMonth).split(' ')[0]}: ${round2(previous)}` : ''}
                      onChange={(e) => updateRow(key, { value: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <p className="font-mono text-xs text-emerald-100/50 mt-1">
                    {row.byBill
                      ? estimate !== null
                        ? `≈ ${estimate.toLocaleString()} ${item.unit} at the US average $${price.perUnit}/${price.unit}`
                        : `Estimated at the US average $${price.perUnit}/${price.unit}`
                      : item.unit}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 font-mono text-sm text-emerald-100/80 hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg font-mono text-sm bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-60"
          >
            {saving ? 'Saving...' : `Save ${formatMonth(month)}`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default LogMonthModal;
