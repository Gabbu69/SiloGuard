import { Thermometer, Droplets, Wind, Waves } from 'lucide-react';
import Navbar from './components/Navbar';
import SensorCard from './components/SensorCard';
import MoldRiskGauge from './components/MoldRiskGauge';
import RealtimeChart from './components/RealtimeChart';
import AlertsPanel from './components/AlertsPanel';
import ActuatorStatus from './components/ActuatorStatus';
import DataTable from './components/DataTable';
import { useRealtimeData } from './hooks/useRealtimeData';

export default function App() {
  const {
    readings,
    latestReading,
    alerts,
    isConnected,
    isLoading,
    error,
    toggleActuator,
  } = useRealtimeData();

  const temp = latestReading?.temperature ?? null;
  const hum = latestReading?.humidity ?? null;
  const gas = latestReading?.gas_ppm ?? null;
  const moist = latestReading?.moisture ?? null;
  const fanOn = latestReading?.fan_on ?? false;
  const buzzerOn = latestReading?.buzzer_on ?? false;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar isConnected={isConnected} />

      {/* Error Banner */}
      {error && (
        <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          {error}
          <span className="text-[10px] text-red-400/60 ml-auto">Running in demo mode</span>
        </div>
      )}

      <main className="flex-1 px-4 sm:px-6 py-6 space-y-6 max-w-[1440px] mx-auto w-full">
        {/* ─── Section 1: Sensor Cards ─────────────────── */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SensorCard
              label="Temperature"
              sensorKey="temperature"
              value={temp}
              icon={<Thermometer className="w-5 h-5" />}
              delay={1}
            />
            <SensorCard
              label="Humidity"
              sensorKey="humidity"
              value={hum}
              icon={<Droplets className="w-5 h-5" />}
              delay={2}
            />
            <SensorCard
              label="Air Quality (MQ-135)"
              sensorKey="gas_ppm"
              value={gas}
              icon={<Wind className="w-5 h-5" />}
              delay={3}
            />
            <SensorCard
              label="Moisture Level"
              sensorKey="moisture"
              value={moist}
              icon={<Waves className="w-5 h-5" />}
              delay={4}
            />
          </div>
        </section>

        {/* ─── Section 2: Gauge + Actuators + Alerts ──── */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Mold Risk Index Gauge */}
            <MoldRiskGauge
              temperature={temp}
              humidity={hum}
              gas_ppm={gas}
              moisture={moist}
            />

            {/* Actuator Controls */}
            <ActuatorStatus
              fanOn={fanOn}
              buzzerOn={buzzerOn}
              isLoading={isLoading}
              onToggleFan={(v) => toggleActuator('fan_on', v)}
              onToggleBuzzer={(v) => toggleActuator('buzzer_on', v)}
            />

            {/* Alerts Panel */}
            <AlertsPanel alerts={alerts} isLoading={isLoading} />
          </div>
        </section>

        {/* ─── Section 3: Real-time Chart ──────────────── */}
        <section>
          <RealtimeChart readings={readings} isLoading={isLoading} />
        </section>

        {/* ─── Section 4: Data Table ───────────────────── */}
        <section>
          <DataTable readings={readings} isLoading={isLoading} />
        </section>

        {/* ─── Footer ──────────────────────────────────── */}
        <footer className="text-center py-6 text-xs text-slate-600">
          <p>SiloGuard &mdash; Smart Rice Storage Monitoring System</p>
          <p className="mt-1">University of Southern Mindanao &bull; IoT Research Project</p>
        </footer>
      </main>
    </div>
  );
}
