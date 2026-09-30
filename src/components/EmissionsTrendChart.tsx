import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyEmissions } from '../store/carbonStore';
import { CHART_GAP_COLOR, SECTOR_ORDER, sectorColor, sectorLabel } from '../lib/sectorColors';
import { formatTonnes } from '../lib/format';

const TEXT_MUTED = 'rgba(209, 250, 229, 0.6)';

const MONTH_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });

const formatMonth = (month: string) => MONTH_FORMAT.format(new Date(`${month}-01T00:00:00Z`));

interface ChartRow {
  month: string;
  label: string;
  total: number;
  [sector: string]: number | string;
}

const TrendTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as ChartRow;
  return (
    <div className="rounded-lg border border-emerald-500/40 bg-black/85 px-3 py-2 font-mono text-xs text-white shadow-lg">
      <p className="mb-1 font-semibold">{label}</p>
      {[...payload].reverse().map((entry) => (
        <p key={entry.dataKey as string} className="flex items-center gap-2 text-emerald-100/80">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: entry.color }} aria-hidden />
          {sectorLabel(String(entry.dataKey))}: {formatTonnes(Number(entry.value))} tCO₂e
        </p>
      ))}
      <p className="mt-1 border-t border-white/10 pt-1">Total: {formatTonnes(row.total)} tCO₂e</p>
    </div>
  );
};

interface EmissionsTrendChartProps {
  months: MonthlyEmissions[];
}

/** Monthly emissions stacked by sector, with a table view of the same data. */
const EmissionsTrendChart = ({ months }: EmissionsTrendChartProps) => {
  if (months.length < 2) {
    return (
      <p className="font-mono text-sm text-emerald-100/60">
        Add activities dated in at least two different months to see how your emissions change over time.
      </p>
    );
  }

  const presentSectors = new Set(months.flatMap((m) => Object.keys(m.breakdown)));
  const sectors = [
    ...SECTOR_ORDER.filter((sector) => presentSectors.has(sector)),
    ...[...presentSectors].filter((sector) => !SECTOR_ORDER.includes(sector)).sort(),
  ];

  const rows: ChartRow[] = months.map((m) => ({
    month: m.month,
    label: formatMonth(m.month),
    total: m.total,
    ...Object.fromEntries(sectors.map((sector) => [sector, m.breakdown[sector] ?? 0])),
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255, 255, 255, 0.08)" />
          <XAxis
            dataKey="label"
            tick={{ fill: TEXT_MUTED, fontSize: 11, fontFamily: 'monospace' }}
            axisLine={{ stroke: 'rgba(255, 255, 255, 0.15)' }}
            tickLine={false}
          />
          <YAxis
            // Recharts picks round tick values; print them without padding zeros
            tickFormatter={(value: number) => String(Number(value.toFixed(3)))}
            tick={{ fill: TEXT_MUTED, fontSize: 11, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            width={56}
            label={{ value: 'tCO₂e', angle: -90, position: 'insideLeft', fill: TEXT_MUTED, fontSize: 11 }}
          />
          <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
          <Legend
            wrapperStyle={{ paddingTop: 12 }}
            formatter={(value: string) => (
              <span className="font-mono text-xs text-emerald-100/80">{sectorLabel(value)}</span>
            )}
          />
          {sectors.map((sector, index) => (
            <Bar
              key={sector}
              dataKey={sector}
              stackId="sectors"
              fill={sectorColor(sector)}
              stroke={CHART_GAP_COLOR}
              strokeWidth={2}
              maxBarSize={24}
              radius={index === sectors.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <details className="mt-4">
        <summary className="cursor-pointer font-mono text-sm text-emerald-300 hover:text-emerald-200">
          Show data table
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full font-mono text-xs text-emerald-100/80">
            <caption className="sr-only">Monthly emissions by sector in tCO₂e</caption>
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th scope="col" className="py-2 pr-4">Month</th>
                {sectors.map((sector) => (
                  <th key={sector} scope="col" className="py-2 pr-4 text-right">{sectorLabel(sector)}</th>
                ))}
                <th scope="col" className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.month} className="border-b border-white/5">
                  <th scope="row" className="py-2 pr-4 text-left font-normal">{row.label}</th>
                  {sectors.map((sector) => (
                    <td key={sector} className="py-2 pr-4 text-right">{formatTonnes(Number(row[sector]))}</td>
                  ))}
                  <td className="py-2 text-right text-white">{formatTonnes(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};

export default EmissionsTrendChart;
