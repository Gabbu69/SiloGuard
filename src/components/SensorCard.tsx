import { type ReactNode } from 'react';
import { getStatus, getStatusColor, getStatusPulseClass, type SensorKey, THRESHOLDS } from '../lib/thresholds';

interface SensorCardProps {
  label: string;
  sensorKey: SensorKey;
  value: number | null;
  icon: ReactNode;
  delay?: number;
}

export default function SensorCard({ label, sensorKey, value, icon, delay = 0 }: SensorCardProps) {
  const threshold = THRESHOLDS[sensorKey];

  if (value === null || value === undefined) {
    return (
      <div className="glass-card p-5">
        <div className="skeleton h-4 w-24 mb-4" />
        <div className="skeleton h-10 w-32 mb-3" />
        <div className="skeleton h-5 w-16" />
      </div>
    );
  }

  const status = getStatus(sensorKey, value);
  const color = getStatusColor(status);
  const pulseClass = getStatusPulseClass(status);
  const delayClass = delay > 0 ? `fade-in-up-delay-${delay}` : '';

  return (
    <div className={`glass-card p-5 fade-in-up ${delayClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <span style={{ color }}>{icon}</span>
          </div>
          <span className="text-sm font-medium text-slate-400">{label}</span>
        </div>

        {/* Pulse indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${pulseClass}`}
            style={{ backgroundColor: color }}
          />
        </div>
      </div>

      {/* Value */}
      <div className="mb-3">
        <span className="text-3xl font-bold text-white tabular-nums">
          {value.toFixed(1)}
        </span>
        <span className="text-sm text-slate-500 ml-1">{threshold.unit}</span>
      </div>

      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{
            backgroundColor: `${color}18`,
            color: color,
            border: `1px solid ${color}30`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          {status}
        </span>

        {/* Mini threshold indicator */}
        <div className="text-[10px] text-slate-500">
          W:{threshold.warning} / D:{threshold.danger}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 rounded-full bg-dark-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.min(100, (value / (threshold.danger * 1.2)) * 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}
