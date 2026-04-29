import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type SensorReading, type Alert } from '../lib/supabase';

interface RealtimeState {
  readings: SensorReading[];
  latestReading: SensorReading | null;
  alerts: Alert[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

/* ─── Demo data generator (used when Supabase is not configured) ─── */
function generateDemoReading(index: number): SensorReading {
  const now = new Date();
  now.setSeconds(now.getSeconds() - (19 - index) * 30);
  return {
    id: index + 1,
    created_at: now.toISOString(),
    temperature: 26 + Math.random() * 14,
    humidity: 55 + Math.random() * 35,
    gas_ppm: 80 + Math.random() * 350,
    moisture: 35 + Math.random() * 50,
    fan_on: Math.random() > 0.5,
    buzzer_on: Math.random() > 0.8,
  };
}

function generateDemoAlert(index: number): Alert {
  const types = ['Fan Activated', 'Buzzer Triggered', 'Threshold Exceeded'];
  const sensors = ['temperature', 'humidity', 'gas_ppm', 'moisture'];
  const now = new Date();
  now.setMinutes(now.getMinutes() - index * 5);
  return {
    id: index + 1,
    created_at: now.toISOString(),
    type: types[index % types.length],
    sensor: sensors[index % sensors.length],
    value: 50 + Math.random() * 100,
    mri_score: Math.round(20 + Math.random() * 60),
  };
}

export function useRealtimeData() {
  const [state, setState] = useState<RealtimeState>({
    readings: [],
    latestReading: null,
    alerts: [],
    isConnected: false,
    isLoading: true,
    error: null,
  });

  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSupabaseConfigured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  /* ─── Fetch initial data from Supabase ─── */
  const fetchInitialData = useCallback(async () => {
    try {
      const [readingsRes, alertsRes] = await Promise.all([
        supabase
          .from('sensor_readings')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('alerts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (readingsRes.error) throw readingsRes.error;
      if (alertsRes.error) throw alertsRes.error;

      const readings = (readingsRes.data || []).reverse();
      setState((prev) => ({
        ...prev,
        readings,
        latestReading: readings[readings.length - 1] || null,
        alerts: alertsRes.data || [],
        isLoading: false,
        isConnected: true,
        error: null,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data';
      setState((prev) => ({ ...prev, error: message, isLoading: false }));
    }
  }, []);

  /* ─── Start demo mode ─── */
  const startDemoMode = useCallback(() => {
    const initialReadings = Array.from({ length: 20 }, (_, i) => generateDemoReading(i));
    const initialAlerts = Array.from({ length: 10 }, (_, i) => generateDemoAlert(i));

    setState({
      readings: initialReadings,
      latestReading: initialReadings[initialReadings.length - 1],
      alerts: initialAlerts,
      isConnected: true,
      isLoading: false,
      error: null,
    });

    // Simulate real-time updates
    demoIntervalRef.current = setInterval(() => {
      const newReading: SensorReading = {
        id: Date.now(),
        created_at: new Date().toISOString(),
        temperature: 26 + Math.random() * 14,
        humidity: 55 + Math.random() * 35,
        gas_ppm: 80 + Math.random() * 350,
        moisture: 35 + Math.random() * 50,
        fan_on: Math.random() > 0.5,
        buzzer_on: Math.random() > 0.8,
      };

      setState((prev) => {
        const updatedReadings = [...prev.readings.slice(-19), newReading];
        return {
          ...prev,
          readings: updatedReadings,
          latestReading: newReading,
        };
      });
    }, 5000);
  }, []);

  /* ─── Toggle actuator (Supabase or demo) ─── */
  const toggleActuator = useCallback(
    async (actuator: 'fan_on' | 'buzzer_on', value: boolean) => {
      if (!isSupabaseConfigured) {
        // Demo: just toggle local state
        setState((prev) => {
          if (!prev.latestReading) return prev;
          const updated = { ...prev.latestReading, [actuator]: value };
          const readings = [...prev.readings.slice(0, -1), updated];
          return { ...prev, latestReading: updated, readings };
        });
        return;
      }

      try {
        const latest = state.latestReading;
        if (!latest) return;
        await supabase
          .from('sensor_readings')
          .update({ [actuator]: value })
          .eq('id', latest.id);
      } catch (err) {
        console.error('Toggle actuator failed:', err);
      }
    },
    [isSupabaseConfigured, state.latestReading]
  );

  /* ─── Setup subscriptions ─── */
  useEffect(() => {
    if (!isSupabaseConfigured) {
      startDemoMode();
      return () => {
        if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
      };
    }

    fetchInitialData();

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sensor_readings' },
        (payload) => {
          const newReading = payload.new as SensorReading;
          setState((prev) => {
            const updatedReadings = [...prev.readings.slice(-19), newReading];
            return {
              ...prev,
              readings: updatedReadings,
              latestReading: newReading,
            };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          const newAlert = payload.new as Alert;
          setState((prev) => ({
            ...prev,
            alerts: [newAlert, ...prev.alerts.slice(0, 9)],
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sensor_readings' },
        (payload) => {
          const updated = payload.new as SensorReading;
          setState((prev) => {
            const readings = prev.readings.map((r) =>
              r.id === updated.id ? updated : r
            );
            const latestReading =
              prev.latestReading?.id === updated.id ? updated : prev.latestReading;
            return { ...prev, readings, latestReading };
          });
        }
      )
      .subscribe((status) => {
        setState((prev) => ({
          ...prev,
          isConnected: status === 'SUBSCRIBED',
        }));
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSupabaseConfigured, fetchInitialData, startDemoMode]);

  return { ...state, toggleActuator };
}
