import { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import type { SensorReading, Alert } from '../lib/supabase';
import {
  THRESHOLDS,
  getStatus,
  computeMRI,
  getRiskLevel,
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
      SAFE: 'Temperature is within the optimal storage range. Maintain current environment controls.',
      WARNING: 'Temperature is elevated. Monitor closely and ensure ventilation systems are active.',
      DANGER: 'CRITICAL: Temperature dangerously high. Immediate intervention required to prevent stock damage.',
    },
    humidity: {
      SAFE: 'Humidity levels are well-controlled. Low risk of fungal growth.',
      WARNING: 'Humidity is rising. Consider increasing dehumidification or ventilation.',
      DANGER: 'CRITICAL: Excessive humidity detected. High risk of mold. Deploy emergency dehumidification immediately.',
    },
    gas_ppm: {
      SAFE: 'Air quality is nominal. No indications of spoilage or abnormal off-gassing.',
      WARNING: 'Elevated gas levels detected. Investigate for potential early-stage spoilage.',
      DANGER: 'CRITICAL: Dangerous air quality. Likely spoilage or contamination. Evacuate personnel and inspect stock.',
    },
    moisture: {
      SAFE: 'Moisture content is optimal. Grain preservation is stable.',
      WARNING: 'Moisture is approaching upper safety limits. Schedule drying if trend continues.',
      DANGER: 'CRITICAL: Severe moisture levels. Immediate drying required to prevent catastrophic stock loss.',
    },
  };
  return recs[sensor][status];
}

export default function PrintReport({ readings, latestReading, onClose }: PrintReportProps) {
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
    hour12: true,
  });

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
        <title>SiloGuard Official Report</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
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

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8">
      <div className="bg-dark-800 rounded-2xl border border-dark-600/60 w-full max-w-5xl h-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b border-dark-600/40 bg-dark-900/50">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="p-2 sm:p-3 bg-rice-500/10 rounded-xl ring-1 ring-rice-500/30 flex-shrink-0">
              <Printer className="w-5 h-5 sm:w-6 sm:h-6 text-rice-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide truncate">Official Audit Report</h2>
              <p className="text-xs sm:text-sm text-slate-400 truncate">Preview document before printing or exporting</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
            <button
              onClick={handlePrint}
              className="group flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 bg-dark-700/80 hover:bg-rice-600 text-white text-xs sm:text-sm font-semibold rounded-full border border-dark-600 hover:border-rice-500 transition-all duration-300 shadow-lg hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] backdrop-blur-md overflow-visible"
            >
              <Printer className="w-4 h-4 text-rice-400 group-hover:text-white" />
              <span className="whitespace-nowrap pr-1">Print Report</span>
            </button>
            <div className="w-px h-6 bg-dark-600/50 hidden sm:block"></div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-dark-700/50 border border-dark-600/50 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 text-slate-400 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Report Preview (scrollable) */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-8 flex justify-center">
          <div
            ref={reportRef}
            className="w-full max-w-[850px] bg-white shadow-xl relative"
          >
            <style>{`
              .print-doc {
                font-family: 'Plus Jakarta Sans', sans-serif;
                color: #0f172a;
                padding: 50px 60px;
                background: #fff;
                position: relative;
                overflow: hidden;
              }
              /* Watermark */
              .print-doc::before {
                content: 'CONFIDENTIAL';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-45deg);
                font-size: 120px;
                font-weight: 800;
                color: rgba(0,0,0,0.02);
                white-space: nowrap;
                z-index: 0;
                pointer-events: none;
              }
              .content-wrapper {
                position: relative;
                z-index: 1;
              }
              .doc-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                border-bottom: 2px solid #0f172a;
                padding-bottom: 24px;
                margin-bottom: 32px;
              }
              .doc-logo-area {
                display: flex;
                align-items: center;
                gap: 16px;
              }
              .doc-logo {
                width: 50px;
                height: 50px;
              }
              .doc-title {
                font-size: 28px;
                font-weight: 800;
                letter-spacing: -0.5px;
                text-transform: uppercase;
                margin-bottom: 4px;
                color: #0f172a;
              }
              .doc-subtitle {
                font-size: 13px;
                color: #475569;
                font-weight: 600;
                letter-spacing: 0.5px;
                text-transform: uppercase;
              }
              .doc-meta {
                text-align: right;
              }
              .doc-meta-item {
                font-size: 12px;
                color: #475569;
                margin-bottom: 4px;
              }
              .doc-meta-item strong {
                color: #0f172a;
              }
              .doc-section {
                margin-bottom: 36px;
                page-break-inside: avoid;
              }
              .section-heading {
                font-size: 15px;
                font-weight: 700;
                color: #0f172a;
                text-transform: uppercase;
                letter-spacing: 1px;
                border-bottom: 1px solid #cbd5e1;
                padding-bottom: 8px;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 10px;
              }
              
              /* Overview Grid */
              .overview-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 16px;
                margin-bottom: 20px;
              }
              .overview-card {
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 16px;
                text-align: center;
                background: #f8fafc;
              }
              .overview-label {
                font-size: 11px;
                font-weight: 700;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 8px;
              }
              .overview-value {
                font-size: 26px;
                font-weight: 800;
                color: #0f172a;
                font-family: 'JetBrains Mono', monospace;
              }
              .overview-unit {
                font-size: 12px;
                color: #94a3b8;
                font-family: 'Plus Jakarta Sans', sans-serif;
              }
              
              /* Risk Assessment */
              .risk-panel {
                display: flex;
                gap: 30px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-left: 6px solid #16a34a;
                padding: 24px;
                border-radius: 8px;
              }
              .risk-panel.warning { border-left-color: #f59e0b; background: #fffbeb; }
              .risk-panel.danger { border-left-color: #dc2626; background: #fef2f2; }
              .risk-score {
                font-size: 48px;
                font-weight: 800;
                line-height: 1;
                color: #0f172a;
              }
              .risk-details h4 {
                font-size: 18px;
                font-weight: 700;
                margin-bottom: 4px;
              }
              .risk-details p {
                font-size: 13px;
                color: #475569;
                line-height: 1.5;
              }
              
              /* Tables */
              .data-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
                font-family: 'JetBrains Mono', monospace;
              }
              .data-table th {
                font-family: 'Plus Jakarta Sans', sans-serif;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: #475569;
                background: #f1f5f9;
                padding: 12px;
                text-align: left;
                border-top: 1px solid #cbd5e1;
                border-bottom: 2px solid #cbd5e1;
              }
              .data-table td {
                padding: 12px;
                border-bottom: 1px solid #e2e8f0;
                color: #0f172a;
              }
              .data-table tr:nth-child(even) td {
                background: #f8fafc;
              }
              
              /* Status Badges */
              .status-safe { color: #16a34a; font-weight: 700; }
              .status-warning { color: #d97706; font-weight: 700; }
              .status-danger { color: #dc2626; font-weight: 700; }
              
              /* Signatures */
              .signatures {
                display: flex;
                justify-content: space-between;
                margin-top: 80px;
                page-break-inside: avoid;
              }
              .sig-block {
                width: 30%;
                text-align: center;
              }
              .sig-line {
                border-bottom: 1px solid #0f172a;
                height: 40px;
                margin-bottom: 8px;
              }
              .sig-title {
                font-size: 11px;
                font-weight: 700;
                color: #475569;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              
              /* Footer */
              .doc-footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                font-size: 10px;
                color: #94a3b8;
                font-family: 'JetBrains Mono', monospace;
              }
              
              @media print {
                .print-doc { padding: 0; }
                @page { margin: 1.5cm; }
              }
            `}</style>

            <div className="print-doc">
              <div className="content-wrapper">
                
                {/* Header */}
                <div className="doc-header">
                  <div className="doc-logo-area">
                    <img src="/logo.png" alt="Logo" className="doc-logo" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <div>
                      <div className="doc-title">SiloGuard Report</div>
                      <div className="doc-subtitle">Smart Rice Storage Monitoring System</div>
                    </div>
                  </div>
                  <div className="doc-meta">
                    <div className="doc-meta-item"><strong>Date:</strong> {now}</div>
                    <div className="doc-meta-item"><strong>Ref:</strong> SG-{Math.floor(Date.now() / 1000).toString().slice(-6)}</div>
                    <div className="doc-meta-item"><strong>Facility:</strong> USM IoT Lab</div>
                  </div>
                </div>

                {/* Section 1: Executive Summary */}
                <div className="doc-section">
                  <div className="section-heading">Current Environmental State</div>
                  <div className="overview-grid">
                    <div className="overview-card">
                      <div className="overview-label">Temperature</div>
                      <div className="overview-value">{temp.toFixed(1)}<span className="overview-unit">°C</span></div>
                      <div className={statusClass('temperature', temp)} style={{ fontSize: '10px', marginTop: '6px' }}>
                        {getStatus('temperature', temp)}
                      </div>
                    </div>
                    <div className="overview-card">
                      <div className="overview-label">Relative Humidity</div>
                      <div className="overview-value">{hum.toFixed(1)}<span className="overview-unit">%</span></div>
                      <div className={statusClass('humidity', hum)} style={{ fontSize: '10px', marginTop: '6px' }}>
                        {getStatus('humidity', hum)}
                      </div>
                    </div>
                    <div className="overview-card">
                      <div className="overview-label">Air Quality (MQ-135)</div>
                      <div className="overview-value">{gas.toFixed(0)}<span className="overview-unit">PPM</span></div>
                      <div className={statusClass('gas_ppm', gas)} style={{ fontSize: '10px', marginTop: '6px' }}>
                        {getStatus('gas_ppm', gas)}
                      </div>
                    </div>
                    <div className="overview-card">
                      <div className="overview-label">Grain Moisture</div>
                      <div className="overview-value">{moist.toFixed(1)}<span className="overview-unit">%</span></div>
                      <div className={statusClass('moisture', moist)} style={{ fontSize: '10px', marginTop: '6px' }}>
                        {getStatus('moisture', moist)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Mold Risk Assessment */}
                <div className="doc-section">
                  <div className="section-heading">Mold Risk Assessment</div>
                  <div className={`risk-panel ${riskLevel === 'Critical' || riskLevel === 'High' ? 'danger' : riskLevel === 'Moderate' ? 'warning' : ''}`}>
                    <div className="risk-score">{mri}</div>
                    <div className="risk-details">
                      <h4>{riskLevel} Risk Level</h4>
                      <p>
                        The Mold Risk Index (MRI) is a composite metric derived from current humidity, temperature, 
                        gas emissions, and moisture content. An elevated score indicates a statistically higher probability 
                        of fungal propagation and stock deterioration.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 3: Recommendations */}
                <div className="doc-section">
                  <div className="section-heading">Automated Recommendations</div>
                  <table className="data-table" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    <tbody>
                      {(['temperature', 'humidity', 'gas_ppm', 'moisture'] as SensorKey[]).map((key) => {
                        const value = key === 'temperature' ? temp : key === 'humidity' ? hum : key === 'gas_ppm' ? gas : moist;
                        return (
                          <tr key={key}>
                            <td style={{ width: '20%', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: '#64748b' }}>
                              {key === 'gas_ppm' ? 'Air Quality' : key}
                            </td>
                            <td style={{ width: '15%' }} className={statusClass(key, value)}>
                              {getStatus(key, value)}
                            </td>
                            <td style={{ fontSize: '13px' }}>{getRecommendation(key, value)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Section 4: Statistical Data */}
                <div className="doc-section">
                  <div className="section-heading">Aggregate Telemetry (Last {readings.length} Cycles)</div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>Current</th>
                        <th>Average</th>
                        <th>Minimum</th>
                        <th>Maximum</th>
                        <th>Threshold Limit</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Temperature</td>
                        <td className={statusClass('temperature', temp)}>{temp.toFixed(1)} °C</td>
                        <td>{avgTemp.toFixed(1)} °C</td>
                        <td>{minTemp.toFixed(1)} °C</td>
                        <td>{maxTemp.toFixed(1)} °C</td>
                        <td>&lt; {THRESHOLDS.temperature.warning} °C</td>
                      </tr>
                      <tr>
                        <td style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Humidity</td>
                        <td className={statusClass('humidity', hum)}>{hum.toFixed(1)}%</td>
                        <td>{avgHum.toFixed(1)}%</td>
                        <td>{minHum.toFixed(1)}%</td>
                        <td>{maxHum.toFixed(1)}%</td>
                        <td>&lt; {THRESHOLDS.humidity.warning}%</td>
                      </tr>
                      <tr>
                        <td style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Gas Level</td>
                        <td className={statusClass('gas_ppm', gas)}>{gas.toFixed(0)} ppm</td>
                        <td>{avgGas.toFixed(0)} ppm</td>
                        <td>{minGas.toFixed(0)} ppm</td>
                        <td>{maxGas.toFixed(0)} ppm</td>
                        <td>&lt; {THRESHOLDS.gas_ppm.warning} ppm</td>
                      </tr>
                      <tr>
                        <td style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Moisture</td>
                        <td className={statusClass('moisture', moist)}>{moist.toFixed(1)}%</td>
                        <td>{avgMoist.toFixed(1)}%</td>
                        <td>{minMoist.toFixed(1)}%</td>
                        <td>{maxMoist.toFixed(1)}%</td>
                        <td>&lt; {THRESHOLDS.moisture.warning}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Signatures */}
                <div className="signatures">
                  <div className="sig-block">
                    <div className="sig-line"></div>
                    <div className="sig-title">System Operator</div>
                  </div>
                  <div className="sig-block">
                    <div className="sig-line"></div>
                    <div className="sig-title">Quality Assurance</div>
                  </div>
                  <div className="sig-block">
                    <div className="sig-line"></div>
                    <div className="sig-title">Facility Manager</div>
                  </div>
                </div>

                {/* Footer */}
                <div className="doc-footer">
                  <div>SiloGuard Audit Engine v2.1.0</div>
                  <div>CONFIDENTIAL DOCUMENT</div>
                  <div>Page 1 of 1</div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
