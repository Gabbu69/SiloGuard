import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Clock } from 'lucide-react';
import type { SensorReading } from '../lib/supabase';

interface RealtimeChartProps {
  readings: SensorReading[];
  isLoading: boolean;
  lastReceivedAt: string | null;
}

const SENSOR_LINES = [
  { key: 'temperature', name: 'Temperature (C)', color: '#f97316' },
  { key: 'humidity', name: 'Humidity (%)', color: '#3b82f6' },
  { key: 'gas_ppm', name: 'Gas (ppm)', color: '#a855f7' },
  { key: 'moisture', name: 'Moisture (%)', color: '#06b6d4' },
] as const;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatAge(iso: string | null) {
  if (!iso) return 'Waiting for data';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export default function RealtimeChart({ readings, isLoading, lastReceivedAt }: RealtimeChartProps) {
  const chartData = useMemo(
    () =>
      readings.map((reading) => ({
        time: formatTime(reading.created_at),
        temperature: +reading.temperature.toFixed(1),
        humidity: +reading.humidity.toFixed(1),
        gas_ppm: +reading.gas_ppm.toFixed(0),
        moisture: +reading.moisture.toFixed(1),
      })),
    [readings]
  );

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

  return (
    <div className="glass-card p-5 sm:p-6 fade-in-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-rice-400" />
          <div>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Live Sensor Stream
            </h3>
            <p className="text-xs text-slate-500">Last {readings.length} readings kept in memory</p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-2 text-[10px] text-slate-400 bg-dark-700/60 px-2 py-1 rounded-full">
          <Clock className="w-3 h-3" />
          {formatAge(lastReceivedAt)}
        </span>
      </div>

      <div className="w-full h-[280px]">
        {readings.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            No live sensor data available yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.3)" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={{ stroke: 'rgba(51, 65, 85, 0.3)' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(17, 24, 39, 0.95)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#e2e8f0',
                }}
                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '8px' }} />
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
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
