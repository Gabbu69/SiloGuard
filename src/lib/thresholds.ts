/* ─── Threshold Configuration ──────────────────────── */

export const THRESHOLDS = {
  temperature: { warning: 32, danger: 38, min: 0, max: 60, unit: '°C' },
  humidity:    { warning: 70, danger: 85, min: 0, max: 100, unit: '%' },
  gas_ppm:     { warning: 200, danger: 400, min: 0, max: 800, unit: 'ppm' },
  moisture:    { warning: 60, danger: 80, min: 0, max: 100, unit: '%' },
} as const;

export type SensorKey = keyof typeof THRESHOLDS;

export type Status = 'SAFE' | 'WARNING' | 'DANGER';

export function getStatus(sensor: SensorKey, value: number): Status {
  const t = THRESHOLDS[sensor];
  if (value > t.danger) return 'DANGER';
  if (value > t.warning) return 'WARNING';
  return 'SAFE';
}

export function getStatusColor(status: Status): string {
  switch (status) {
    case 'DANGER': return '#ef4444';
    case 'WARNING': return '#f59e0b';
    case 'SAFE': return '#22c55e';
  }
}

export function getStatusPulseClass(status: Status): string {
  switch (status) {
    case 'DANGER': return 'pulse-danger';
    case 'WARNING': return 'pulse-warn';
    case 'SAFE': return 'pulse-safe';
  }
}

/* ─── Normalize score to 0–100 ─────────────────────── */
function normalizeScore(value: number, warning: number, danger: number): number {
  if (value <= warning * 0.5) return 0;
  if (value >= danger * 1.2) return 100;
  const range = danger * 1.2 - warning * 0.5;
  return Math.min(100, Math.max(0, ((value - warning * 0.5) / range) * 100));
}

/* ─── Mold Risk Index ──────────────────────────────── */
export function computeMRI(
  temperature: number,
  humidity: number,
  gas_ppm: number,
  moisture: number
): number {
  const humidityScore = normalizeScore(humidity, THRESHOLDS.humidity.warning, THRESHOLDS.humidity.danger);
  const tempScore = normalizeScore(temperature, THRESHOLDS.temperature.warning, THRESHOLDS.temperature.danger);
  const gasScore = normalizeScore(gas_ppm, THRESHOLDS.gas_ppm.warning, THRESHOLDS.gas_ppm.danger);
  const moistureScore = normalizeScore(moisture, THRESHOLDS.moisture.warning, THRESHOLDS.moisture.danger);

  return Math.round(
    humidityScore * 0.4 +
    tempScore * 0.3 +
    gasScore * 0.2 +
    moistureScore * 0.1
  );
}

export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical';

export function getRiskLevel(mri: number): RiskLevel {
  if (mri >= 75) return 'Critical';
  if (mri >= 50) return 'High';
  if (mri >= 25) return 'Moderate';
  return 'Low';
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'Critical': return '#ef4444';
    case 'High': return '#f59e0b';
    case 'Moderate': return '#eab308';
    case 'Low': return '#22c55e';
  }
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}
