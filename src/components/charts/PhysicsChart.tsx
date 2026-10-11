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
  Legend,
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
}

interface PhysicsChartProps {
  data: DataPoint[];
  series: ChartSeries[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  exportFilename?: string;
  maxPoints?: number;
}

export const PhysicsChart: React.FC<PhysicsChartProps> = ({
  data,
  series,
  title = 'Live Measurements',
  xLabel = 'Time (s)',
  yLabel = 'Value',
  exportFilename = 'physics-measurements.csv',
  maxPoints = 200,
}) => {
  // Downsample data if too long for smooth graphing
  const displayData = React.useMemo(() => {
    if (data.length <= maxPoints) return data;
    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, idx) => idx % step === 0 || idx === data.length - 1);
  }, [data, maxPoints]);

  const handleExportCSV = () => {
    if (data.length === 0) return;
    const headers = ['Time (s)', ...series.map((s) => `${s.name} (${s.unit || ''})`)];
    const rows = data.map((d) => [
      d.time.toFixed(4),
      ...series.map((s) => (d[s.key] !== undefined ? d[s.key].toFixed(4) : '')),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', exportFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col h-full shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </h4>
        <button
          onClick={handleExportCSV}
          disabled={data.length === 0}
          className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 disabled:opacity-40 disabled:hover:text-slate-500 font-medium px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 transition-all border border-sky-500/20"
          title="Export captured data to CSV"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="w-full h-56 sm:h-64 flex-1">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
            Run the simulation to record and visualize measurements...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayData} margin={{ top: 5, right: 15, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(val) => Number(val).toFixed(1)}
                label={{ value: xLabel, position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(val) => Number(val).toFixed(1)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: '#e2e8f0',
                }}
                formatter={(val: any, name: any) => [Number(val).toFixed(2), name]}
                labelFormatter={(label) => `Time: ${Number(label).toFixed(2)}s`}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
