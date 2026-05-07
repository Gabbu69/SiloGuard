import { useMemo, useRef } from 'react';
import { Printer, X } from 'lucide-react';
import type { Alert, HistoryRange, SensorReading } from '../lib/supabase';
import { formatTimestamp, getRiskColor, getRiskLevel, getStatus, THRESHOLDS, type SensorKey } from '../lib/thresholds';

interface PrintReportProps {
  readings: SensorReading[];
  latestReading: SensorReading | null;
  alerts: Alert[];
  selectedRange: HistoryRange;
  deviceId: string;
  onClose: () => void;
}

const SENSORS: Array<{ key: SensorKey; label: string; unit: string }> = [
  { key: 'temperature', label: 'Temperature', unit: 'C' },
  { key: 'humidity', label: 'Humidity', unit: '%' },
  { key: 'gas_ppm', label: 'Air Quality', unit: 'ppm' },
  { key: 'moisture', label: 'Moisture', unit: '%' },
];

function sensorValue(reading: SensorReading, key: SensorKey) {
  return reading[key];
}

function stats(readings: SensorReading[], key: SensorKey) {
  const values = readings.map((reading) => sensorValue(reading, key));
  if (values.length === 0) return { avg: 0, min: 0, max: 0 };
  return {
    avg: values.reduce((sum, value) => sum + value, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function statusClass(sensor: SensorKey, value: number) {
  const status = getStatus(sensor, value);
  if (status === 'DANGER') return 'print-danger';
  if (status === 'WARNING') return 'print-warning';
  return 'print-safe';
}

export default function PrintReport({
  readings,
  latestReading,
  alerts,
  selectedRange,
  deviceId,
  onClose,
}: PrintReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const latest = latestReading || readings[readings.length - 1] || null;
  const tableRows = useMemo(() => [...readings].reverse().slice(0, 40), [readings]);
  const mri = latest?.mri_score ?? 0;
  const riskLevel = getRiskLevel(mri);
  const riskColor = getRiskColor(riskLevel);
  const generatedAt = new Date().toLocaleString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 print:static print:block print:bg-white print:p-0">
      <div className="bg-dark-800 rounded-2xl border border-dark-600/60 w-full max-w-6xl h-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden print:block print:h-auto print:max-h-none print:max-w-none print:rounded-none print:border-0 print:shadow-none print:bg-white">
        <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b border-dark-600/40 bg-dark-900/50 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-rice-500/10 rounded-xl ring-1 ring-rice-500/30">
              <Printer className="w-5 h-5 text-rice-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide truncate">Print Data Report</h2>
              <p className="text-xs sm:text-sm text-slate-400 truncate">Selected range: {selectedRange.toUpperCase()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="group flex items-center gap-2 px-4 py-2 bg-dark-700/80 hover:bg-rice-600 text-white text-xs sm:text-sm font-semibold rounded-full border border-dark-600 hover:border-rice-500 transition-all"
            >
              <Printer className="w-4 h-4 text-rice-400 group-hover:text-white" />
              Print Data
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-dark-700/50 border border-dark-600/50 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 text-slate-400 transition-all"
              aria-label="Close report"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-100 p-5 sm:p-8 flex justify-center print:block print:overflow-visible print:bg-white print:p-0">
          <div ref={reportRef} className="print-doc w-full max-w-[920px] bg-white shadow-xl print:max-w-none print:shadow-none">
            <header className="print-header">
              <div className="print-brand">
                <img src="/logo.png" alt="SiloGuard Logo" className="print-logo" />
                <div>
                  <h1>SiloGuard Data Report</h1>
                  <p>Smart Rice Storage Monitoring System</p>
                </div>
              </div>
              <div className="print-meta">
                <p><strong>Generated:</strong> {generatedAt}</p>
                <p><strong>Device:</strong> {deviceId}</p>
                <p><strong>Range:</strong> {selectedRange.toUpperCase()}</p>
                <p><strong>Rows:</strong> {readings.length}</p>
              </div>
            </header>

            <section className="print-section">
              <h2>Current State</h2>
              <div className="print-grid print-grid-5">
                {SENSORS.map(({ key, label, unit }) => {
                  const value = latest ? sensorValue(latest, key) : 0;
                  return (
                    <div key={key} className="print-card">
                      <span>{label}</span>
                      <strong>{value.toFixed(key === 'gas_ppm' ? 0 : 1)} {unit}</strong>
                      <em className={statusClass(key, value)}>{getStatus(key, value)}</em>
                    </div>
                  );
                })}
                <div className="print-card">
                  <span>Mold Risk Index</span>
                  <strong style={{ color: riskColor }}>{mri}</strong>
                  <em style={{ color: riskColor }}>{riskLevel}</em>
                </div>
              </div>
            </section>

            <section className="print-section">
              <h2>Range Statistics</h2>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Average</th>
                    <th>Minimum</th>
                    <th>Maximum</th>
                    <th>Warning</th>
                    <th>Danger</th>
                  </tr>
                </thead>
                <tbody>
                  {SENSORS.map(({ key, label, unit }) => {
                    const sensorStats = stats(readings, key);
                    return (
                      <tr key={key}>
                        <td>{label}</td>
                        <td>{sensorStats.avg.toFixed(key === 'gas_ppm' ? 0 : 1)} {unit}</td>
                        <td>{sensorStats.min.toFixed(key === 'gas_ppm' ? 0 : 1)} {unit}</td>
                        <td>{sensorStats.max.toFixed(key === 'gas_ppm' ? 0 : 1)} {unit}</td>
                        <td>{THRESHOLDS[key].warning} {unit}</td>
                        <td>{THRESHOLDS[key].danger} {unit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section className="print-section">
              <h2>Recent Alerts</h2>
              {alerts.length === 0 ? (
                <p className="print-empty">No alerts recorded for the current dashboard session.</p>
              ) : (
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Type</th>
                      <th>Sensor</th>
                      <th>Value</th>
                      <th>MRI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.slice(0, 10).map((alert) => (
                      <tr key={alert.id}>
                        <td>{formatTimestamp(alert.created_at)}</td>
                        <td>{alert.type}</td>
                        <td>{alert.sensor}</td>
                        <td>{alert.value.toFixed(1)}</td>
                        <td>{alert.mri_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="print-section">
              <h2>Recorded Data</h2>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Mode</th>
                    <th>Samples</th>
                    <th>Temp</th>
                    <th>Humidity</th>
                    <th>Gas</th>
                    <th>Moisture</th>
                    <th>MRI</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((reading) => (
                    <tr key={`${reading.rollup_kind || 'raw'}-${reading.id}-${reading.created_at}`}>
                      <td>{formatTimestamp(reading.created_at)}</td>
                      <td>{reading.rollup_kind || 'raw'}</td>
                      <td>{reading.sample_count ?? 1}</td>
                      <td>{reading.temperature.toFixed(1)} C</td>
                      <td>{reading.humidity.toFixed(1)}%</td>
                      <td>{reading.gas_ppm.toFixed(0)} ppm</td>
                      <td>{reading.moisture.toFixed(1)}%</td>
                      <td>{reading.mri_score}</td>
                      <td>{reading.risk_level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <footer className="print-footer">
              <span>SiloGuard Audit Engine</span>
              <span>Printed data is based on the selected dashboard range.</span>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
