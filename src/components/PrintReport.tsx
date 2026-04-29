import { useRef } from 'react';
import { Printer, X, ShieldAlert, Thermometer, Droplets, Wind, Waves } from 'lucide-react';
import type { SensorReading, Alert } from '../lib/supabase';
import {
  THRESHOLDS,
  getStatus,
  computeMRI,
  getRiskLevel,
  formatTimestamp,
  type SensorKey,
} from '../lib/thresholds';

interface PrintReportProps {
  readings: SensorReading[];
  latestReading: SensorReading | null;
  alerts: Alert[];
  onClose: () => void;
}

function getRecommendation(sensor: SensorKey, value: number): string {
  const status = getStatus(sensor, value);
  const recs: Record<SensorKey, Record<string, string>> = {
    temperature: {
      SAFE: 'Temperature is within the acceptable range for rice storage (below 32°C). Continue monitoring.',
      WARNING: 'Temperature is elevated (32–38°C). Consider activating ventilation fans. Inspect insulation.',
      DANGER: 'CRITICAL: Temperature exceeds 38°C! Immediate action required — activate cooling, inspect for heat sources, and consider relocating stock.',
    },
    humidity: {
      SAFE: 'Humidity levels are safe (below 70%). Storage environment is well-controlled.',
      WARNING: 'Humidity is elevated (70–85%). Turn on dehumidifiers. Check sealing of storage containers.',
      DANGER: 'CRITICAL: Humidity exceeds 85%! High risk of mold and fungal growth. Immediate dehumidification and inspection required.',
    },
    gas_ppm: {
      SAFE: 'Air quality is good (below 200 ppm). No unusual gases detected.',
      WARNING: 'Elevated gas levels detected (200–400 ppm). Increase ventilation. Investigate potential sources of contamination.',
      DANGER: 'CRITICAL: Gas levels exceed 400 ppm! Possible spoilage or contamination. Evacuate nearby personnel, increase ventilation, and inspect rice stock immediately.',
    },
    moisture: {
      SAFE: 'Moisture content is within safe parameters (below 60%). Rice quality is maintained.',
      WARNING: 'Moisture is rising (60–80%). Activate drying procedures. Check for water ingress or condensation.',
      DANGER: 'CRITICAL: Moisture exceeds 80%! Severe risk of grain deterioration. Emergency drying required. Separate affected stock.',
    },
  };
  return recs[sensor][status];
}

export default function PrintReport({ readings, latestReading, alerts, onClose }: PrintReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  const temp = latestReading?.temperature ?? 0;
  const hum = latestReading?.humidity ?? 0;
  const gas = latestReading?.gas_ppm ?? 0;
  const moist = latestReading?.moisture ?? 0;
  const mri = computeMRI(temp, hum, gas, moist);
  const riskLevel = getRiskLevel(mri);
  const now = new Date().toLocaleString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  // Compute averages from readings
  const avgTemp = readings.length ? readings.reduce((s, r) => s + r.temperature, 0) / readings.length : 0;
  const avgHum = readings.length ? readings.reduce((s, r) => s + r.humidity, 0) / readings.length : 0;
  const avgGas = readings.length ? readings.reduce((s, r) => s + r.gas_ppm, 0) / readings.length : 0;
  const avgMoist = readings.length ? readings.reduce((s, r) => s + r.moisture, 0) / readings.length : 0;

  const maxTemp = readings.length ? Math.max(...readings.map((r) => r.temperature)) : 0;
  const maxHum = readings.length ? Math.max(...readings.map((r) => r.humidity)) : 0;
  const maxGas = readings.length ? Math.max(...readings.map((r) => r.gas_ppm)) : 0;
  const maxMoist = readings.length ? Math.max(...readings.map((r) => r.moisture)) : 0;

  const minTemp = readings.length ? Math.min(...readings.map((r) => r.temperature)) : 0;
  const minHum = readings.length ? Math.min(...readings.map((r) => r.humidity)) : 0;
  const minGas = readings.length ? Math.min(...readings.map((r) => r.gas_ppm)) : 0;
  const minMoist = readings.length ? Math.min(...readings.map((r) => r.moisture)) : 0;

  const handlePrint = () => {
    const printContent = reportRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>SiloGuard Report — ${new Date().toLocaleDateString()}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            color: #1e293b;
            background: #fff;
            padding: 40px;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #16a34a;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            font-size: 28px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.5px;
          }
          .header .subtitle {
            font-size: 13px;
            color: #64748b;
            margin-top: 4px;
          }
          .header .date {
            font-size: 12px;
            color: #94a3b8;
            margin-top: 8px;
          }
          .section {
            margin-bottom: 28px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 6px;
            margin-bottom: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .section-title .icon {
            width: 20px;
            height: 20px;
            display: inline-flex;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          th {
            text-align: left;
            background: #f1f5f9;
            padding: 10px 14px;
            font-weight: 600;
            color: #475569;
            border-bottom: 2px solid #e2e8f0;
          }
          td {
            padding: 9px 14px;
            border-bottom: 1px solid #f1f5f9;
            color: #334155;
          }
          tr:hover td { background: #f8fafc; }
          .status-safe { color: #16a34a; font-weight: 600; }
          .status-warning { color: #d97706; font-weight: 600; }
          .status-danger { color: #dc2626; font-weight: 600; }
          .mri-box {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: #f0fdf4;
            border: 2px solid #bbf7d0;
            border-radius: 12px;
            padding: 16px 24px;
            margin: 10px 0;
          }
          .mri-box.moderate { background: #fefce8; border-color: #fde68a; }
          .mri-box.high { background: #fff7ed; border-color: #fed7aa; }
          .mri-box.critical { background: #fef2f2; border-color: #fecaca; }
          .mri-score {
            font-size: 36px;
            font-weight: 800;
          }
          .mri-label {
            font-size: 14px;
            font-weight: 600;
          }
          .recommendation {
            background: #f8fafc;
            border-left: 4px solid #3b82f6;
            padding: 12px 16px;
            margin: 8px 0;
            font-size: 13px;
            border-radius: 0 8px 8px 0;
          }
          .recommendation.warning { border-left-color: #f59e0b; background: #fffbeb; }
          .recommendation.danger { border-left-color: #ef4444; background: #fef2f2; }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin: 16px 0;
          }
          .summary-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 16px;
            text-align: center;
          }
          .summary-card .value {
            font-size: 28px;
            font-weight: 800;
            color: #0f172a;
          }
          .summary-card .label {
            font-size: 12px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }
          .summary-card .unit {
            font-size: 14px;
            color: #94a3b8;
            font-weight: 500;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
          }
          .sig-line {
            margin-top: 60px;
            display: flex;
            justify-content: space-between;
            gap: 80px;
          }
          .sig-box {
            flex: 1;
            text-align: center;
          }
          .sig-box .line {
            border-top: 1px solid #334155;
            margin-bottom: 4px;
            margin-top: 40px;
          }
          .sig-box .label {
            font-size: 12px;
            color: #64748b;
            font-weight: 500;
          }
          @media print {
            body { padding: 20px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const statusClass = (sensor: SensorKey, value: number) => {
    const s = getStatus(sensor, value);
    return s === 'DANGER' ? 'status-danger' : s === 'WARNING' ? 'status-warning' : 'status-safe';
  };

  const recClass = (sensor: SensorKey, value: number) => {
    const s = getStatus(sensor, value);
    return s === 'DANGER' ? 'recommendation danger' : s === 'WARNING' ? 'recommendation warning' : 'recommendation';
  };

  const mriBoxClass = () => {
    if (riskLevel === 'Critical') return 'mri-box critical';
    if (riskLevel === 'High') return 'mri-box high';
    if (riskLevel === 'Moderate') return 'mri-box moderate';
    return 'mri-box';
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-dark-800 rounded-2xl border border-dark-600/60 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rice-500/10 rounded-lg ring-1 ring-rice-500/30">
              <Printer className="w-5 h-5 text-rice-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Generate Report</h2>
              <p className="text-xs text-slate-400">Full sensor data analysis & recommendations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rice-500 to-rice-600 hover:from-rice-400 hover:to-rice-500 text-white text-sm font-bold rounded-xl transition-all duration-300 shadow-lg shadow-rice-500/25 hover:shadow-rice-500/40"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-dark-600/60 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Report Preview (scrollable) */}
        <div className="flex-1 overflow-y-auto p-6">
          <div
            ref={reportRef}
            className="bg-white rounded-xl p-8 text-slate-800"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {/* Report Header */}
            <div className="header">
              <h1>SiloGuard — Sensor Data Report</h1>
              <div className="subtitle">Smart Rice Storage Monitoring System • University of Southern Mindanao</div>
              <div className="date">Generated: {now}</div>
            </div>

            {/* Current Readings Summary */}
            <div className="section">
              <div className="section-title">📊 Current Sensor Readings</div>
              <div className="summary-grid">
                <div className="summary-card">
                  <div className="label">Temperature</div>
                  <div className="value">{temp.toFixed(1)}</div>
                  <div className="unit">°C</div>
                  <div className={statusClass('temperature', temp)} style={{ fontSize: '11px', marginTop: '4px' }}>
                    {getStatus('temperature', temp)}
                  </div>
                </div>
                <div className="summary-card">
                  <div className="label">Humidity</div>
                  <div className="value">{hum.toFixed(1)}</div>
                  <div className="unit">%</div>
                  <div className={statusClass('humidity', hum)} style={{ fontSize: '11px', marginTop: '4px' }}>
                    {getStatus('humidity', hum)}
                  </div>
                </div>
                <div className="summary-card">
                  <div className="label">Gas (MQ-135)</div>
                  <div className="value">{gas.toFixed(0)}</div>
                  <div className="unit">ppm</div>
                  <div className={statusClass('gas_ppm', gas)} style={{ fontSize: '11px', marginTop: '4px' }}>
                    {getStatus('gas_ppm', gas)}
                  </div>
                </div>
                <div className="summary-card">
                  <div className="label">Moisture</div>
                  <div className="value">{moist.toFixed(1)}</div>
                  <div className="unit">%</div>
                  <div className={statusClass('moisture', moist)} style={{ fontSize: '11px', marginTop: '4px' }}>
                    {getStatus('moisture', moist)}
                  </div>
                </div>
              </div>
            </div>

            {/* Mold Risk Index */}
            <div className="section">
              <div className="section-title">🛡️ Mold Risk Index (MRI)</div>
              <div className={mriBoxClass()}>
                <div className="mri-score">{mri}</div>
                <div>
                  <div className="mri-label">{riskLevel} Risk</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Score out of 100 • Formula: Humidity(40%) + Temperature(30%) + Gas(20%) + Moisture(10%)
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="section">
              <div className="section-title">💡 Recommendations & Analysis</div>
              {(['temperature', 'humidity', 'gas_ppm', 'moisture'] as SensorKey[]).map((key) => {
                const value = key === 'temperature' ? temp : key === 'humidity' ? hum : key === 'gas_ppm' ? gas : moist;
                return (
                  <div key={key} className={recClass(key, value)}>
                    <strong style={{ textTransform: 'capitalize' }}>
                      {key === 'gas_ppm' ? 'Air Quality' : key}:
                    </strong>{' '}
                    {getRecommendation(key, value)}
                  </div>
                );
              })}
            </div>

            {/* Statistical Summary */}
            <div className="section">
              <div className="section-title">📈 Statistical Summary (Last {readings.length} Readings)</div>
              <table>
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Current</th>
                    <th>Average</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th>Threshold (W/D)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Temperature</strong></td>
                    <td>{temp.toFixed(1)} °C</td>
                    <td>{avgTemp.toFixed(1)} °C</td>
                    <td>{minTemp.toFixed(1)} °C</td>
                    <td>{maxTemp.toFixed(1)} °C</td>
                    <td>{THRESHOLDS.temperature.warning} / {THRESHOLDS.temperature.danger} °C</td>
                    <td className={statusClass('temperature', temp)}>{getStatus('temperature', temp)}</td>
                  </tr>
                  <tr>
                    <td><strong>Humidity</strong></td>
                    <td>{hum.toFixed(1)}%</td>
                    <td>{avgHum.toFixed(1)}%</td>
                    <td>{minHum.toFixed(1)}%</td>
                    <td>{maxHum.toFixed(1)}%</td>
                    <td>{THRESHOLDS.humidity.warning} / {THRESHOLDS.humidity.danger}%</td>
                    <td className={statusClass('humidity', hum)}>{getStatus('humidity', hum)}</td>
                  </tr>
                  <tr>
                    <td><strong>Gas (MQ-135)</strong></td>
                    <td>{gas.toFixed(0)} ppm</td>
                    <td>{avgGas.toFixed(0)} ppm</td>
                    <td>{minGas.toFixed(0)} ppm</td>
                    <td>{maxGas.toFixed(0)} ppm</td>
                    <td>{THRESHOLDS.gas_ppm.warning} / {THRESHOLDS.gas_ppm.danger} ppm</td>
                    <td className={statusClass('gas_ppm', gas)}>{getStatus('gas_ppm', gas)}</td>
                  </tr>
                  <tr>
                    <td><strong>Moisture</strong></td>
                    <td>{moist.toFixed(1)}%</td>
                    <td>{avgMoist.toFixed(1)}%</td>
                    <td>{minMoist.toFixed(1)}%</td>
                    <td>{maxMoist.toFixed(1)}%</td>
                    <td>{THRESHOLDS.moisture.warning} / {THRESHOLDS.moisture.danger}%</td>
                    <td className={statusClass('moisture', moist)}>{getStatus('moisture', moist)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Recent Alerts */}
            {alerts.length > 0 && (
              <div className="section">
                <div className="section-title">🔔 Recent Alerts ({alerts.length})</div>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Type</th>
                      <th>Sensor</th>
                      <th>Value</th>
                      <th>MRI Score</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert, i) => (
                      <tr key={alert.id}>
                        <td>{i + 1}</td>
                        <td><strong>{alert.type}</strong></td>
                        <td style={{ textTransform: 'capitalize' }}>{alert.sensor}</td>
                        <td>{alert.value?.toFixed(1)}</td>
                        <td>{alert.mri_score}</td>
                        <td>{formatTimestamp(alert.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Historical Data */}
            <div className="section">
              <div className="section-title">📋 Raw Sensor Readings Log</div>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Timestamp</th>
                    <th>Temp (°C)</th>
                    <th>Humidity (%)</th>
                    <th>Gas (ppm)</th>
                    <th>Moisture (%)</th>
                    <th>Fan</th>
                    <th>Buzzer</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <td>{formatTimestamp(r.created_at)}</td>
                      <td className={statusClass('temperature', r.temperature)}>{r.temperature.toFixed(1)}</td>
                      <td className={statusClass('humidity', r.humidity)}>{r.humidity.toFixed(1)}</td>
                      <td className={statusClass('gas_ppm', r.gas_ppm)}>{r.gas_ppm.toFixed(0)}</td>
                      <td className={statusClass('moisture', r.moisture)}>{r.moisture.toFixed(1)}</td>
                      <td>{r.fan_on ? '✅ ON' : '⬜ OFF'}</td>
                      <td>{r.buzzer_on ? '🔴 ON' : '⬜ OFF'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signature Lines */}
            <div className="sig-line">
              <div className="sig-box">
                <div className="line"></div>
                <div className="label">Prepared by</div>
              </div>
              <div className="sig-box">
                <div className="line"></div>
                <div className="label">Verified by</div>
              </div>
              <div className="sig-box">
                <div className="line"></div>
                <div className="label">Approved by</div>
              </div>
            </div>

            {/* Footer */}
            <div className="footer">
              <p>SiloGuard — Smart Rice Storage Monitoring System</p>
              <p>University of Southern Mindanao • IoT Research Project • Confidential</p>
              <p style={{ marginTop: '4px' }}>This report was auto-generated on {now}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
