import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CalendarPlus, Lightbulb } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { CHART_GAP_COLOR, sectorColor, sectorLabel } from '../lib/sectorColors';
import { formatTonnes } from '../lib/format';

interface EmissionsBreakdownChartProps {
  /** tCO₂e per category over the recorded period */
  breakdown: Record<string, number>;
  total: number;
  onLogMonth: () => void;
}

interface Slice {
  sector: string;
  label: string;
  tonnes: number;
  percent: number;
}

const formatPercent = (percent: number) => (percent >= 10 || percent === 0 ? percent.toFixed(0) : percent.toFixed(1));

/**
 * Where the footprint comes from: a donut with the total in the middle, and
 * the same figures as a ranked table (every value is readable without the
 * chart). Hovering a slice or a row highlights both.
 */
const EmissionsBreakdownChart = ({ breakdown, total, onLogMonth }: EmissionsBreakdownChartProps) => {
  const [activeSector, setActiveSector] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const slices: Slice[] = Object.entries(breakdown)
    .filter(([, tonnes]) => tonnes > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([sector, tonnes]) => ({ sector, label: sectorLabel(sector), tonnes, percent: total > 0 ? (tonnes / total) * 100 : 0 }));

  if (slices.length === 0) {
    return (
      <p className="font-mono text-sm text-emerald-100/70">
        Your recorded activities have no emissions yet, for example on-site solar. Log your bills to see where your footprint comes from.
      </p>
    );
  }

  const [largest] = slices;
  const active = slices.find((slice) => slice.sector === activeSector) ?? null;
  const dimmed = (sector: string) => activeSector !== null && activeSector !== sector;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-1 flex-col gap-6">
        <div className="grid items-center gap-6 xl:grid-cols-[11rem_1fr]">
          {/* The table below carries the same data for screen readers */}
          <div className="relative mx-auto h-52 w-52 xl:h-44 xl:w-44" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="tonnes"
                  nameKey="label"
                  innerRadius="70%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  // One category is a full ring; a stroke would draw a seam where it starts
                  stroke={slices.length > 1 ? CHART_GAP_COLOR : 'none'}
                  strokeWidth={2}
                  isAnimationActive={!reduceMotion}
                  animationDuration={800}
                  onMouseEnter={(_, index) => setActiveSector(slices[index].sector)}
                  onMouseLeave={() => setActiveSector(null)}
                >
                  {slices.map((slice) => (
                    <Cell
                      key={slice.sector}
                      fill={sectorColor(slice.sector)}
                      fillOpacity={dimmed(slice.sector) ? 0.3 : 1}
                      style={{ transition: 'fill-opacity 150ms', outline: 'none' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-space text-3xl font-bold text-white">{formatTonnes(active ? active.tonnes : total)}</span>
              <span className="font-mono text-xs text-emerald-100/70">tCO₂e</span>
              <span className="mt-1 max-w-[8rem] font-mono text-xs text-emerald-100/60">
                {active ? `${active.label} · ${formatPercent(active.percent)}%` : 'total'}
              </span>
            </div>
          </div>

          <table className="w-full font-mono text-sm">
            <caption className="sr-only">Emissions by category, largest first</caption>
            <thead>
              <tr className="text-left text-xs text-emerald-100/60">
                <th scope="col" className="pb-2 font-normal">Category</th>
                <th scope="col" className="pb-2 text-right font-normal">Share</th>
              </tr>
            </thead>
            <tbody>
              {slices.map((slice, index) => (
                <tr
                  key={slice.sector}
                  onMouseEnter={() => setActiveSector(slice.sector)}
                  onMouseLeave={() => setActiveSector(null)}
                  className={`transition-opacity ${dimmed(slice.sector) ? 'opacity-40' : ''}`}
                >
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <span className="flex items-center gap-2 text-white">
                      <span className="h-3 w-3 flex-shrink-0 rounded-sm" style={{ backgroundColor: sectorColor(slice.sector) }} />
                      {slice.label}
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/10">
                      <motion.span
                        className="block h-full rounded-full"
                        style={{ backgroundColor: sectorColor(slice.sector) }}
                        initial={{ width: 0 }}
                        animate={{ width: `${slice.percent}%` }}
                        transition={{ duration: 0.6, delay: 0.2 + index * 0.08, ease: 'easeOut' }}
                      />
                    </span>
                  </th>
                  <td className="whitespace-nowrap py-2 text-right align-top">
                    <span className="text-white">{formatPercent(slice.percent)}%</span>
                    <span className="block text-xs text-emerald-100/60">{formatTonnes(slice.tonnes)} tCO₂e</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/15 bg-gray-800/40 p-4">
          <p className="flex items-start gap-2 font-mono text-sm text-emerald-100/80">
            <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300/80" aria-hidden="true" />
            {slices.length === 1 ? (
              <span>
                So far, all of your recorded emissions come from <span className="text-white">{largest.label}</span>. Log your
                other bills, like electricity and heating, to see your full footprint.
              </span>
            ) : (
              <span>
                <span className="text-white">{largest.label}</span> is your largest source at{' '}
                <span className="text-white">{formatPercent(largest.percent)}%</span>, so cuts there count the most.
              </span>
            )}
          </p>
          {slices.length === 1 ? (
            <button
              onClick={onLogMonth}
              className="glass-button inline-flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Log a Month
            </button>
          ) : (
            <Link to="/recommendations" className="glass-button inline-flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm group">
              Ways to cut it
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </MotionConfig>
  );
};

export default EmissionsBreakdownChart;
