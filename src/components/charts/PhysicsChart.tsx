import React from 'react';
import { Download } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

export interface DataPoint {
  time: number;
  [key: string]: number;
}

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
  unit?: string;
  /** Draw this series dashed (e.g. a theoretical reference). */
  dashed?: boolean;
  /** Plot against a second y-axis on the right (for quantities of very different size). */
  axis?: 'left' | 'right';
}

interface PhysicsChartProps {
  data: DataPoint[];
  series: ChartSeries[];
  title?: string;
  /** Which field of each data point is plotted on the x-axis. Defaults to "time". */
  xKey?: string;
  xLabel?: string;
  yLabel?: string;
  exportFilename?: string;
  /** Max points handed to Recharts (older data is thinned, newest is always kept). */
  maxPoints?: number;
  height?: number;
  emptyMessage?: string;
  /** Draw a horizontal guide at this y value (e.g. 0, or the initial energy). */
  referenceY?: number;
}

const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumSignificantDigits: 3,
});

/** Tick text that stays short for both tiny and huge values. */
function formatTick(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1000) return compact.format(n);
  if (abs >= 100) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(1);
  if (abs >= 0.01) return n.toFixed(2);
  return n.toExponential(0);
}

export const PhysicsChart: React.FC<PhysicsChartProps> = ({
  data,
  series,
  title = 'Live Measurements',
  xKey = 'time',
  xLabel = 'Time (s)',
  yLabel,
  exportFilename = 'physics-measurements.csv',
  maxPoints = 300,
  height = 224,
  emptyMessage = 'Press Start to record measurements…',
  referenceY,
}) => {
  // Thin out long runs, anchored at the newest sample so the curve's tail
  // does not shimmer as new data arrives.
  const displayData = React.useMemo(() => {
    if (data.length <= maxPoints) return data;
    const step = Math.ceil(data.length / maxPoints);
    const out: DataPoint[] = [];
    for (let i = data.length - 1; i >= 0; i -= step) out.push(data[i]);
    return out.reverse();
  }, [data, maxPoints]);

  const handleExportCSV = () => {
    if (data.length === 0) return;
    const headers = [xLabel, ...series.map((s) => (s.unit ? `${s.name} (${s.unit})` : s.name))];
    const rows = data.map((d) => [
      Number(d[xKey]).toFixed(5),
      ...series.map((s) => (d[s.key] !== undefined ? Number(d[s.key]).toFixed(5) : '')),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => (String(cell).includes(',') ? `"${cell}"` : cell)).join(','))
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const xShort = xLabel.replace(/\s*\(.*\)\s*$/, '');
  const hasRightAxis = series.some((x) => x.axis === 'right');
  const leftSeries = series.filter((x) => x.axis !== 'right');
  const rightSeries = series.filter((x) => x.axis === 'right');
  // Time axes always start at t = 0; other axes fit the data.
  const xDomain: [number | string, number | string] = [xKey === 'time' ? 0 : 'dataMin', 'dataMax'];

  return (
    <div className="flex flex-col rounded-xl border border-slate-800/90 bg-slate-900/70 p-4 shadow-lg shadow-black/20">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h4>
        <button
          onClick={handleExportCSV}
          disabled={data.length === 0}
          className="flex shrink-0 items-center gap-1.5 rounded border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-400 transition-all hover:bg-sky-500/20 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
          title="Export captured data to CSV"
        >
          <Download className="h-3.5 w-3.5" />
          <span>CSV</span>
        </button>
      </div>

      {/* Legend lives in the page flow (not inside the SVG) so it can never collide with the axes. */}
      <div className="mb-2 flex min-h-[18px] flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        {series.map((x) => (
          <span key={x.key} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 rounded"
              style={{
                background: x.dashed
                  ? `repeating-linear-gradient(90deg, ${x.color} 0 4px, transparent 4px 7px)`
                  : x.color,
                height: 3,
              }}
            />
            {x.name}
            {x.unit && <span className="font-mono text-slate-500">[{x.unit}]</span>}
            {x.axis === 'right' && <span className="text-slate-600">→</span>}
          </span>
        ))}
        {yLabel && <span className="ml-auto font-mono text-slate-500">{yLabel}</span>}
      </div>

      <div className="w-full" style={{ height }}>
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center font-mono text-xs text-slate-500">
            {emptyMessage}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              data={displayData}
              margin={{ top: 6, right: hasRightAxis ? 0 : 14, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                type="number"
                dataKey={xKey}
                domain={xDomain}
                stroke="#64748b"
                fontSize={11}
                tickCount={6}
                tickFormatter={formatTick}
                allowDecimals
              />
              <YAxis
                yAxisId="left"
                stroke="#64748b"
                fontSize={11}
                width={46}
                tickFormatter={formatTick}
              />
              {hasRightAxis && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke={rightSeries[0]?.color ?? '#64748b'}
                  fontSize={11}
                  width={46}
                  tickFormatter={formatTick}
                />
              )}
              {referenceY !== undefined && (
                <ReferenceLine yAxisId="left" y={referenceY} stroke="#475569" strokeDasharray="4 4" />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: '#e2e8f0',
                }}
                formatter={(val, name) => [Number(val).toPrecision(4), name]}
                labelFormatter={(label) => `${xShort}: ${Number(label).toPrecision(4)}`}
              />
              {[...leftSeries, ...rightSeries].map((x) => (
                <Line
                  key={x.key}
                  yAxisId={x.axis === 'right' ? 'right' : 'left'}
                  type="monotone"
                  dataKey={x.key}
                  name={x.name}
                  stroke={x.color}
                  strokeDasharray={x.dashed ? '5 4' : undefined}
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-1 text-center font-mono text-[10px] text-slate-500">{xLabel}</div>
    </div>
  );
};
