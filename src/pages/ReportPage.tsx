import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Download, FileText, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { benchmarkDescription, gradedMeasure } from '../lib/gradeBasis';
import { formatMonth } from '../lib/usEstimates';
import { sectorLabel } from '../lib/sectorColors';
import type { EmissionsIntensity, MonthlyEmissions } from '../store/carbonStore';

interface Report {
  company: { name: string; industry: string; location: string; state: string | null; employees: string | number } | null;
  period: { from: string; to: string };
  score: {
    total_emissions_tons_co2e: number;
    carbon_rating: string;
    benchmark_comparison: string;
    emissions_by_month: MonthlyEmissions[];
    intensity: EmissionsIntensity | null;
  };
  categories: { sector: string; label: string; tonnes: number }[];
  rows: unknown[];
  actions: { title: string; status: string; annualImpact: number; sector: string | null }[];
  methodology: string;
}

const STATUS_LABELS: Record<string, string> = { planned: 'Planned', in_progress: 'In progress', done: 'Done' };
const INPUT_CLASS = 'bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-3 text-white font-mono text-sm [color-scheme:dark]';

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

function presetRange(preset: 'last12' | 'thisYear' | 'lastYear') {
  const now = new Date();
  if (preset === 'thisYear') return { from: `${now.getFullYear()}-01`, to: monthKey(now) };
  if (preset === 'lastYear') return { from: `${now.getFullYear() - 1}-01`, to: `${now.getFullYear() - 1}-12` };
  return { from: monthKey(new Date(now.getFullYear(), now.getMonth() - 11, 1)), to: monthKey(now) };
}

const t = (value: number) => value.toFixed(value >= 100 ? 0 : 2);

/** Emissions report for a chosen period, downloadable as CSV or printable to PDF. */
const ReportPage = () => {
  const [range, setRange] = useState(() => presetRange('last12'));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (range.from > range.to) {
      setError('The start month must not be after the end month');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setReport(await apiClient.getReport(range.from, range.to));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the report');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const downloadCsv = async () => {
    setDownloading(true);
    setError('');
    try {
      const blob = await apiClient.downloadReportCsv(range.from, range.to);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `carbonctrl-emissions-${range.from}-to-${range.to}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the CSV');
    } finally {
      setDownloading(false);
    }
  };

  const total = report?.score.total_emissions_tons_co2e ?? 0;
  const actions = report?.actions ?? [];

  return (
    <div className="space-y-8 report">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-space text-3xl sm:text-4xl font-bold text-white mb-2">Emissions Report</h1>
          <p className="font-mono text-emerald-100/80">
            {report ? `${formatMonth(report.period.from)} to ${formatMonth(report.period.to)}` : 'Choose a period'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 print:hidden">
          <button onClick={downloadCsv} disabled={downloading || !report} className="glass-button px-4 py-2 rounded-lg inline-flex items-center gap-2 font-mono text-sm disabled:opacity-50">
            <Download className="w-4 h-4" /> {downloading ? 'Preparing...' : 'Download CSV'}
          </button>
          <button onClick={() => window.print()} disabled={!report} className="px-4 py-2 rounded-lg inline-flex items-center gap-2 font-mono text-sm bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-50">
            <Printer className="w-4 h-4" /> Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="feature-card p-4 flex flex-wrap items-center gap-3 print:hidden">
        {([['last12', 'Last 12 months'], ['thisYear', 'This year'], ['lastYear', 'Last year']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setRange(presetRange(key))} className="px-3 py-1.5 rounded-lg border border-emerald-500/30 font-mono text-xs text-emerald-200 hover:bg-emerald-500/20">
            {label}
          </button>
        ))}
        <label className="font-mono text-xs text-emerald-100/70 flex items-center gap-2">
          From <input type="month" value={range.from} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} className={INPUT_CLASS} />
        </label>
        <label className="font-mono text-xs text-emerald-100/70 flex items-center gap-2">
          To <input type="month" value={range.to} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} className={INPUT_CLASS} />
        </label>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 p-4 rounded-lg border border-red-500/30 bg-red-500/10 print:hidden">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="font-mono text-sm text-red-200">{error}</p>
        </div>
      )}

      {loading && !report && <p className="font-mono text-emerald-100/70">Loading report...</p>}

      {report && (
        <>
          <section className="feature-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h2 className="font-space text-xl font-semibold text-white">Summary</h2>
            </div>
            {report.company && (
              <p className="font-mono text-sm text-emerald-100/80 mb-4">
                {report.company.name} · {report.company.industry} · {[report.company.location, report.company.state].filter(Boolean).join(', ')} · {report.company.employees} employees
              </p>
            )}
            {report.rows.length === 0 ? (
              <p className="font-mono text-sm text-emerald-100/70">
                Not enough data for a report: no activity is logged between {formatMonth(report.period.from)} and{' '}
                {formatMonth(report.period.to)}. Choose a period that has activity, or{' '}
                <Link to="/dashboard" className="text-emerald-300 underline hover:text-emerald-200">log a month on the Dashboard</Link>.
              </p>
            ) : (
              <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
                <div><dt className="text-xs text-emerald-100/60">Total emissions</dt><dd className="text-2xl text-white">{t(total)} tCO₂e</dd></div>
                <div><dt className="text-xs text-emerald-100/60">Grade</dt><dd className="text-2xl text-white">{report.score.carbon_rating}</dd></div>
                <div><dt className="text-xs text-emerald-100/60">Per employee per year</dt><dd className="text-2xl text-white">{report.score.intensity ? `${report.score.intensity.total_per_employee.toFixed(2)} t` : '—'}</dd></div>
                <div><dt className="text-xs text-emerald-100/60">Compared with industry</dt><dd className="text-sm text-white mt-2">{report.score.benchmark_comparison}</dd></div>
              </dl>
            )}
            {report.rows.length > 0 && report.score.intensity && (
              <p className="font-mono text-xs text-emerald-100/70 mt-4">
                Grade basis: {gradedMeasure(report.score.intensity).toLowerCase()} of {report.score.intensity.per_employee.toFixed(2)} tCO₂e per
                employee per year, against {benchmarkDescription(report.score.intensity)}.
              </p>
            )}
          </section>

          {report.categories.length > 0 && (
            <section className="feature-card p-6">
              <h2 className="font-space text-xl font-semibold text-white mb-4">By category</h2>
              <table className="w-full font-mono text-sm text-emerald-100/90">
                <thead><tr className="text-left text-emerald-100/60 border-b border-white/10"><th className="py-2">Category</th><th className="py-2 text-right">tCO₂e</th><th className="py-2 text-right">Share</th></tr></thead>
                <tbody>
                  {report.categories.map((c) => (
                    <tr key={c.sector} className="border-b border-white/5">
                      <td className="py-2">{c.label}</td>
                      <td className="py-2 text-right">{t(c.tonnes)}</td>
                      <td className="py-2 text-right">{total > 0 ? ((c.tonnes / total) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {report.score.emissions_by_month.length > 0 && (
            <section className="feature-card p-6">
              <h2 className="font-space text-xl font-semibold text-white mb-4">By month</h2>
              <table className="w-full font-mono text-sm text-emerald-100/90">
                <thead><tr className="text-left text-emerald-100/60 border-b border-white/10"><th className="py-2">Month</th><th className="py-2 text-right">tCO₂e</th><th className="py-2 pl-6">Largest category</th></tr></thead>
                <tbody>
                  {report.score.emissions_by_month.map((m) => {
                    const [top] = Object.entries(m.breakdown).sort(([, a], [, b]) => b - a);
                    return (
                      <tr key={m.month} className="border-b border-white/5">
                        <td className="py-2">{formatMonth(m.month)}</td>
                        <td className="py-2 text-right">{t(m.total)}</td>
                        <td className="py-2 pl-6">{top ? sectorLabel(top[0]) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          <section className="feature-card p-6">
            <h2 className="font-space text-xl font-semibold text-white mb-4">Action plan</h2>
            {actions.length === 0 ? (
              <p className="font-mono text-sm text-emerald-100/70">No actions in the plan yet.</p>
            ) : (
              <table className="w-full font-mono text-sm text-emerald-100/90">
                <thead><tr className="text-left text-emerald-100/60 border-b border-white/10"><th className="py-2">Action</th><th className="py-2">Status</th><th className="py-2 text-right">Est. saving (tCO₂e/yr)</th></tr></thead>
                <tbody>
                  {actions.map((a) => (
                    <tr key={a.title} className="border-b border-white/5">
                      <td className="py-2">{a.title}</td>
                      <td className="py-2">{STATUS_LABELS[a.status] ?? a.status}</td>
                      <td className="py-2 text-right">{t(a.annualImpact)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="font-mono text-xs text-emerald-100/60 max-w-3xl">
            <h2 className="font-space text-sm font-semibold text-white mb-1">Methodology</h2>
            <p>{report.methodology}</p>
            <p className="mt-1 print:hidden">
              <Link to="/methodology" className="text-emerald-300 underline hover:text-emerald-200">Full methodology, factors and sources</Link>
            </p>
            <p className="mt-1">Generated {new Date().toLocaleDateString()} with CarbonCTRL.</p>
          </section>
        </>
      )}
    </div>
  );
};

export default ReportPage;
