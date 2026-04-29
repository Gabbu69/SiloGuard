import { useMemo } from 'react';
import { computeMRI, getRiskLevel, getRiskColor } from '../lib/thresholds';
import { ShieldAlert } from 'lucide-react';

interface MoldRiskGaugeProps {
  temperature: number | null;
  humidity: number | null;
  gas_ppm: number | null;
  moisture: number | null;
}

export default function MoldRiskGauge({ temperature, humidity, gas_ppm, moisture }: MoldRiskGaugeProps) {
  const mri = useMemo(() => {
    if (temperature === null || humidity === null || gas_ppm === null || moisture === null) return 0;
    return computeMRI(temperature, humidity, gas_ppm, moisture);
  }, [temperature, humidity, gas_ppm, moisture]);

  const riskLevel = getRiskLevel(mri);
  const riskColor = getRiskColor(riskLevel);

  const isLoading = temperature === null;

  // SVG arc calculations
  const radius = 80;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = Math.PI * normalizedRadius; // half circle
  const arcLength = (mri / 100) * circumference;
  const dashOffset = circumference - arcLength;

  if (isLoading) {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[280px]">
        <div className="skeleton w-40 h-40 rounded-full mb-4" />
        <div className="skeleton h-5 w-24 mb-2" />
        <div className="skeleton h-4 w-16" />
      </div>
    );
  }

  return (
    <div className="glass-card p-6 flex flex-col items-center justify-center fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="w-5 h-5" style={{ color: riskColor }} />
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Mold Risk Index
        </h3>
      </div>

      {/* SVG Gauge */}
      <div className="relative w-48 h-28 mb-2">
        <svg
          width="192"
          height="112"
          viewBox="0 0 192 112"
          className="overflow-visible"
        >
          {/* Background arc */}
          <path
            d={`M ${96 - normalizedRadius} 96 A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${96 + normalizedRadius} 96`}
            fill="none"
            stroke="rgba(30, 41, 59, 0.8)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Value arc */}
          <path
            d={`M ${96 - normalizedRadius} 96 A ${normalizedRadius} ${normalizedRadius} 0 0 1 ${96 + normalizedRadius} 96`}
            fill="none"
            stroke={riskColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="gauge-arc"
            style={{
              filter: `drop-shadow(0 0 8px ${riskColor}40)`,
              transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />

          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = Math.PI - (tick / 100) * Math.PI;
            const x1 = 96 + (normalizedRadius - 8) * Math.cos(angle);
            const y1 = 96 - (normalizedRadius - 8) * Math.sin(angle);
            const x2 = 96 + (normalizedRadius + 4) * Math.cos(angle);
            const y2 = 96 - (normalizedRadius + 4) * Math.sin(angle);
            return (
              <line
                key={tick}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(148, 163, 184, 0.3)"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-4xl font-extrabold text-white tabular-nums">{mri}</span>
          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">/ 100</span>
        </div>
      </div>

      {/* Risk label */}
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
        style={{
          backgroundColor: `${riskColor}18`,
          color: riskColor,
          border: `1px solid ${riskColor}30`,
        }}
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: riskColor }} />
        {riskLevel} Risk
      </span>

      {/* Score breakdown */}
      <div className="mt-4 grid grid-cols-4 gap-2 w-full">
        {[
          { label: 'Hum', weight: '40%', value: humidity },
          { label: 'Temp', weight: '30%', value: temperature },
          { label: 'Gas', weight: '20%', value: gas_ppm },
          { label: 'Moist', weight: '10%', value: moisture },
        ].map((item) => (
          <div key={item.label} className="text-center">
            <div className="text-[10px] text-slate-500 font-medium">{item.label}</div>
            <div className="text-xs text-slate-300 font-semibold">
              {item.value?.toFixed(0)}
            </div>
            <div className="text-[9px] text-slate-600">{item.weight}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
