import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Activity } from 'lucide-react';
import type { SensorReading } from '../lib/supabase';

interface RealtimeChartProps {
  readings: SensorReading[];
  isLoading: boolean;
}

const SENSOR_LINES = [
  { key: 'temperature', name: 'Temperature (°C)', color: '#f97316' },
  { key: 'humidity', name: 'Humidity (%)', color: '#3b82f6' },
  { key: 'gas_ppm', name: 'Gas (ppm)', color: '#a855f7' },
  { key: 'moisture', name: 'Moisture (%)', color: '#06b6d4' },
] as const;

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function RealtimeChart({ readings, isLoading }: RealtimeChartProps) {
  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="skeleton w-5 h-5 rounded" />
          <div className="skeleton h-4 w-36" />
        </div>
        <div className="skeleton w-full h-[280px] rounded-xl" />
      </div>
    );
  }

  const chartData = readings.map((r) => ({
    time: formatTime(r.created_at),
    temperature: +r.temperature.toFixed(1),
    humidity: +r.humidity.toFixed(1),
    gas_ppm: +r.gas_ppm.toFixed(0),
    moisture: +r.moisture.toFixed(1),
  }));

  return (
    <div className="glass-card p-6 fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-rice-400" />
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Sensor Readings (Last 20)
          </h3>
        </div>
        <span className="text-[10px] text-slate-500 bg-dark-700/60 px-2 py-1 rounded-full">
          Real-time
        </span>
      </div>

      {/* Chart */}
      <div className="w-full h-[280px]">
        {readings.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            No sensor data available yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(51, 65, 85, 0.3)"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={{ stroke: 'rgba(51, 65, 85, 0.3)' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(17, 24, 39, 0.95)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#e2e8f0',
                  backdropFilter: 'blur(8px)',
                }}
                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '8px' }}
              />
              {SENSOR_LINES.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: line.color }}
                  animationDuration={800}
                  animationEasing="ease-in-out"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
