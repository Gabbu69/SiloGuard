import { useMemo, useState } from 'react';
import { Activity, Clock, Database, Droplets, ShieldAlert, Thermometer, Waves, Wind } from 'lucide-react';
import Navbar from './components/Navbar';
import SensorCard from './components/SensorCard';
import MoldRiskGauge from './components/MoldRiskGauge';
import RealtimeChart from './components/RealtimeChart';
import AlertsPanel from './components/AlertsPanel';
import ActuatorStatus from './components/ActuatorStatus';
import DataTable from './components/DataTable';
import PrintReport from './components/PrintReport';
import { useRealtimeData } from './hooks/useRealtimeData';
import { getRiskColor, getRiskLevel } from './lib/thresholds';

function formatLastReceived(iso: string | null) {
  if (!iso) return 'No readings yet';
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function App() {
  const [showReport, setShowReport] = useState(false);
  const {
    readings,
    historyReadings,
    latestReading,
    alerts,
    isConnected,
    isLoading,
    isHistoryLoading,
    isLoadingMore,
    hasMoreHistory,
    error,
    selectedChartRange,
    selectedRange,
    lastReceivedAt,
    totalSamples,
    controlStatus,
    controlMode,
    deviceId,
    setSelectedChartRange,
    setSelectedRange,
    loadMoreHistory,
    toggleActuator,
    setAutoControl,
  } = useRealtimeData();

  const temp = latestReading?.temperature ?? null;
  const hum = latestReading?.humidity ?? null;
  const gas = latestReading?.gas_ppm ?? null;
  const moist = latestReading?.moisture ?? null;
  const fanOn = latestReading?.fan_on ?? false;
  const buzzerOn = latestReading?.buzzer_on ?? false;

  const summary = useMemo(() => {
    const mri = latestReading?.mri_score ?? 0;
    const risk = getRiskLevel(mri);
    return { mri, risk, color: getRiskColor(risk) };
  }, [latestReading?.mri_score]);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Navbar isConnected={isConnected} onPrint={() => setShowReport(true)} />

      {error && (
        <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          {error}
          <span className="text-[10px] text-red-400/60 ml-auto">Demo fallback may be active</span>
        </div>
      )}

      <main className="flex-1 px-4 sm:px-6 py-6 space-y-6 max-w-[1440px] mx-auto w-full">
        <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="metric-strip">
            <Activity className="w-4 h-4 text-rice-400" />
            <div>
              <p className="metric-strip-label">Device</p>
              <p className="metric-strip-value">{deviceId}</p>
            </div>
          </div>
          <div className="metric-strip">
            <Clock className="w-4 h-4 text-sky-400" />
            <div>
              <p className="metric-strip-label">Last received</p>
              <p className="metric-strip-value">{formatLastReceived(lastReceivedAt)}</p>
            </div>
          </div>
          <div className="metric-strip">
            <Database className="w-4 h-4 text-amber-400" />
            <div>
              <p className="metric-strip-label">Loaded samples</p>
              <p className="metric-strip-value">{totalSamples}</p>
            </div>
          </div>
          <div className="metric-strip">
            <ShieldAlert className="w-4 h-4" style={{ color: summary.color }} />
            <div>
              <p className="metric-strip-label">Current MRI</p>
              <p className="metric-strip-value" style={{ color: summary.color }}>
                {summary.mri} / {summary.risk}
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SensorCard label="Temperature" sensorKey="temperature" value={temp} icon={<Thermometer className="w-5 h-5" />} delay={1} />
            <SensorCard label="Humidity" sensorKey="humidity" value={hum} icon={<Droplets className="w-5 h-5" />} delay={2} />
            <SensorCard label="Air Quality (MQ-135)" sensorKey="gas_ppm" value={gas} icon={<Wind className="w-5 h-5" />} delay={3} />
            <SensorCard label="Moisture Level" sensorKey="moisture" value={moist} icon={<Waves className="w-5 h-5" />} delay={4} />
          </div>
        </section>

        <section>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <MoldRiskGauge temperature={temp} humidity={hum} gas_ppm={gas} moisture={moist} />
            <div className="space-y-3">
              <ActuatorStatus
                fanOn={fanOn}
                buzzerOn={buzzerOn}
                controlMode={controlMode}
                isLoading={isLoading}
                onToggleFan={(value) => toggleActuator('fan_on', value)}
                onToggleBuzzer={(value) => toggleActuator('buzzer_on', value)}
                onSetAuto={setAutoControl}
              />
              {controlStatus && (
                <div className="rounded-xl border border-dark-600/40 bg-dark-800/60 px-4 py-3 text-xs text-slate-400">
                  {controlStatus}
                </div>
              )}
            </div>
            <AlertsPanel alerts={alerts} isLoading={isLoading} />
          </div>
        </section>

        <section>
          <RealtimeChart
            readings={readings}
            isLoading={isLoading}
            lastReceivedAt={lastReceivedAt}
            selectedRange={selectedChartRange}
            onRangeChange={setSelectedChartRange}
          />
        </section>

        <section>
          <DataTable
            readings={historyReadings}
            isLoading={isHistoryLoading}
            selectedRange={selectedRange}
            hasMore={hasMoreHistory}
            isLoadingMore={isLoadingMore}
            onRangeChange={setSelectedRange}
            onLoadMore={loadMoreHistory}
          />
        </section>

        <footer className="text-center py-6 text-xs text-slate-600">
          <p>SiloGuard - Smart Rice Storage Monitoring System</p>
          <p className="mt-1">University of Southern Mindanao - IoT Research Project</p>
        </footer>
      </main>

      {showReport && (
        <PrintReport
          readings={historyReadings}
          latestReading={latestReading}
          alerts={alerts}
          selectedRange={selectedRange}
          deviceId={deviceId}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
