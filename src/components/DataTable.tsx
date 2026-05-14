import { useMemo } from 'react';
import { CalendarDays, Database, Layers, Loader2 } from 'lucide-react';
import type { HistoryRange, SensorReading } from '../lib/supabase';
import { formatTimestamp, getRiskColor, getRiskLevel, getStatus, getStatusColor } from '../lib/thresholds';

interface DataTableProps {
  readings: SensorReading[];
  isLoading: boolean;
  selectedRange: HistoryRange;
  hasMore: boolean;
  isLoadingMore: boolean;
  onRangeChange: (range: HistoryRange) => void;
  onLoadMore: () => void;
}

const RANGE_OPTIONS: Array<{ value: HistoryRange; label: string }> = [
  { value: '6h', label: '6h' },
  { value: '12h', label: '12h' },
  { value: '24h', label: '24h' },
];

function getWorstStatus(reading: SensorReading) {
  const statuses = [
    getStatus('temperature', reading.temperature),
    getStatus('humidity', reading.humidity),
    getStatus('gas_ppm', reading.gas_ppm),
    getStatus('moisture', reading.moisture),
  ];
  if (statuses.includes('DANGER')) return 'DANGER';
  if (statuses.includes('WARNING')) return 'WARNING';
  return 'SAFE';
}

export default function DataTable({
  readings,
  isLoading,
  selectedRange,
  hasMore,
  isLoadingMore,
  onRangeChange,
  onLoadMore,
}: DataTableProps) {
  const sortedReadings = useMemo(() => [...readings].reverse(), [readings]);
  const isRollup = sortedReadings.some((reading) => reading.rollup_kind);

  return (
    <div className="glass-card p-5 sm:p-6 fade-in-up">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-rice-400" />
          <div>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Historical Data
            </h3>
            <p className="text-xs text-slate-500">
              {isRollup ? 'Showing rollup summaries for fast long-range review' : 'Showing raw recorded readings'}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:w-auto lg:justify-end">
          <div className="grid grid-cols-3 gap-1.5 rounded-full border border-dark-600/40 bg-dark-900/35 p-1 sm:flex sm:flex-wrap sm:items-center">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onRangeChange(option.value)}
                className={`range-button ${selectedRange === option.value ? 'range-button-active' : ''}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="inline-flex w-fit items-center justify-center whitespace-nowrap rounded-full bg-dark-700/60 px-2.5 py-1 text-[10px] text-slate-500 sm:ml-1">
            {readings.length} rows
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-dark-600/30">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="skeleton h-9 w-full" />
            ))}
          </div>
        ) : sortedReadings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <CalendarDays className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-sm">No data for this range</span>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Mode</th>
                <th>Samples</th>
                <th>Temp (C)</th>
                <th>Humidity (%)</th>
                <th>Gas (ppm)</th>
                <th>Moisture (%)</th>
                <th>MRI</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedReadings.map((reading) => {
                const mri = reading.mri_score;
                const riskLevel = getRiskLevel(mri);
                const riskColor = getRiskColor(riskLevel);
                const worstStatus = getWorstStatus(reading);
                const statusColor = getStatusColor(worstStatus);

                return (
                  <tr key={`${reading.rollup_kind || 'raw'}-${reading.id}-${reading.created_at}`}>
                    <td className="whitespace-nowrap text-xs">{formatTimestamp(reading.created_at)}</td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 uppercase tracking-wider">
                        <Layers className="w-3 h-3" />
                        {reading.rollup_kind || 'raw'}
                      </span>
                    </td>
                    <td className="tabular-nums">{reading.sample_count ?? 1}</td>
                    <td className="tabular-nums">{reading.temperature.toFixed(1)}</td>
                    <td className="tabular-nums">{reading.humidity.toFixed(1)}</td>
                    <td className="tabular-nums">{reading.gas_ppm.toFixed(0)}</td>
                    <td className="tabular-nums">{reading.moisture.toFixed(1)}</td>
                    <td>
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: riskColor, backgroundColor: `${riskColor}15` }}
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
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
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

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-dark-600 bg-dark-700/70 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-rice-500/60 disabled:cursor-wait disabled:opacity-60"
          >
            {isLoadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Load more data
          </button>
        </div>
      )}
    </div>
  );
}
