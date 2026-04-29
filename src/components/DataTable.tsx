import { Database } from 'lucide-react';
import type { SensorReading } from '../lib/supabase';
import { computeMRI, getRiskLevel, getRiskColor, getStatus, getStatusColor, formatTimestamp } from '../lib/thresholds';

interface DataTableProps {
  readings: SensorReading[];
  isLoading: boolean;
}

export default function DataTable({ readings, isLoading }: DataTableProps) {
  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="skeleton w-5 h-5 rounded" />
          <div className="skeleton h-4 w-28" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Show readings in reverse chronological order
  const sortedReadings = [...readings].reverse();

  return (
    <div className="glass-card p-6 fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-rice-400" />
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Historical Logs
          </h3>
        </div>
        <span className="text-[10px] text-slate-500 bg-dark-700/60 px-2 py-1 rounded-full">
          {readings.length} records
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-dark-600/30">
        {sortedReadings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Database className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-sm">No historical data</span>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Temp (°C)</th>
                <th>Humidity (%)</th>
                <th>Gas (ppm)</th>
                <th>Moisture (%)</th>
                <th>MRI</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedReadings.map((r) => {
                const mri = computeMRI(r.temperature, r.humidity, r.gas_ppm, r.moisture);
                const riskLevel = getRiskLevel(mri);
                const riskColor = getRiskColor(riskLevel);

                // Overall status: worst of all sensors
                const statuses = [
                  getStatus('temperature', r.temperature),
                  getStatus('humidity', r.humidity),
                  getStatus('gas_ppm', r.gas_ppm),
                  getStatus('moisture', r.moisture),
                ];
                const worstStatus = statuses.includes('DANGER')
                  ? 'DANGER'
                  : statuses.includes('WARNING')
                    ? 'WARNING'
                    : 'SAFE';
                const statusColor = getStatusColor(worstStatus);

                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-xs">{formatTimestamp(r.created_at)}</td>
                    <td className="tabular-nums">{r.temperature.toFixed(1)}</td>
                    <td className="tabular-nums">{r.humidity.toFixed(1)}</td>
                    <td className="tabular-nums">{r.gas_ppm.toFixed(0)}</td>
                    <td className="tabular-nums">{r.moisture.toFixed(1)}</td>
                    <td>
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          color: riskColor,
                          backgroundColor: `${riskColor}15`,
                        }}
                      >
                        {mri}
                      </span>
                    </td>
                    <td>
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                        style={{
                          color: statusColor,
                          backgroundColor: `${statusColor}15`,
                          border: `1px solid ${statusColor}25`,
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: statusColor }}
                        />
                        {worstStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
