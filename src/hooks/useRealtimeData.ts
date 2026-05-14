import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isSupabaseConfigured,
  supabase,
  type ActuatorCommand,
  type Alert,
  type ControlMode,
  type CurrentSensorReading,
  type HistoryRange,
  type SensorReading,
} from '../lib/supabase';
import { computeMRI, getRiskLevel } from '../lib/thresholds';

const DEVICE_ID = import.meta.env.VITE_DEVICE_ID || 'silo-1';
const LIVE_LIMIT = 90;
const HISTORY_PAGE_SIZE = 100;

interface RealtimeState {
  readings: SensorReading[];
  historyReadings: SensorReading[];
  latestReading: SensorReading | null;
  alerts: Alert[];
  isConnected: boolean;
  isLoading: boolean;
  isHistoryLoading: boolean;
  isLoadingMore: boolean;
  hasMoreHistory: boolean;
  error: string | null;
  selectedRange: HistoryRange;
  lastReceivedAt: string | null;
  totalSamples: number;
  controlStatus: string | null;
  controlMode: ControlMode;
}

function rangeStart(range: HistoryRange): string | null {
  if (range === 'live') return null;
  const hours: Record<Exclude<HistoryRange, 'live'>, number> = {
    '24h': 24,
    '7d': 24 * 7,
    '30d': 24 * 30,
    '90d': 24 * 90,
  };
  return new Date(Date.now() - hours[range] * 60 * 60 * 1000).toISOString();
}

function makeReading(
  input: Omit<SensorReading, 'mri_score' | 'risk_level'> &
    Partial<Pick<SensorReading, 'mri_score' | 'risk_level'>>
): SensorReading {
  const mri = input.mri_score ?? computeMRI(input.temperature, input.humidity, input.gas_ppm, input.moisture);
  return {
    ...input,
    mri_score: mri,
    risk_level: input.risk_level ?? getRiskLevel(mri),
  };
}

function currentToReading(input: CurrentSensorReading): SensorReading {
  return {
    id: Math.max(1, Date.parse(input.updated_at)),
    created_at: input.updated_at,
    device_id: input.device_id,
    temperature: input.temperature,
    humidity: input.humidity,
    gas_ppm: input.gas_ppm,
    moisture: input.moisture,
    fan_on: input.fan_on,
    buzzer_on: input.buzzer_on,
    mri_score: input.mri_score,
    risk_level: input.risk_level,
  };
}

function generateDemoReading(index: number, total = LIVE_LIMIT): SensorReading {
  const now = new Date();
  now.setSeconds(now.getSeconds() - (total - index) * 30);
  return makeReading({
    id: index + 1,
    created_at: now.toISOString(),
    device_id: DEVICE_ID,
    temperature: 26 + Math.random() * 14,
    humidity: 55 + Math.random() * 35,
    gas_ppm: 80 + Math.random() * 350,
    moisture: 35 + Math.random() * 50,
    fan_on: Math.random() > 0.5,
    buzzer_on: Math.random() > 0.85,
  });
}

function generateDemoAlert(index: number): Alert {
  const types = ['Fan Activated', 'Buzzer Triggered', 'Threshold Exceeded'];
  const sensors = ['temperature', 'humidity', 'gas_ppm', 'moisture'];
  const now = new Date();
  now.setMinutes(now.getMinutes() - index * 8);
  const mri = Math.round(20 + Math.random() * 60);

  return {
    id: index + 1,
    created_at: now.toISOString(),
    device_id: DEVICE_ID,
    type: types[index % types.length],
    sensor: sensors[index % sensors.length],
    value: 50 + Math.random() * 100,
    mri_score: mri,
    risk_level: getRiskLevel(mri),
  };
}

function toRollupReading(row: {
  id: number;
  bucket_start: string;
  bucket_kind: 'hour' | 'day';
  device_id: string;
  sample_count: number;
  avg_temperature: number;
  avg_humidity: number;
  avg_gas_ppm: number;
  avg_moisture: number;
  avg_mri_score: number;
  max_mri_score: number;
}): SensorReading {
  const mri = Math.round(row.avg_mri_score || row.max_mri_score || 0);
  return {
    id: row.id,
    created_at: row.bucket_start,
    device_id: row.device_id,
    temperature: row.avg_temperature,
    humidity: row.avg_humidity,
    gas_ppm: row.avg_gas_ppm,
    moisture: row.avg_moisture,
    fan_on: false,
    buzzer_on: row.max_mri_score >= 75,
    mri_score: mri,
    risk_level: getRiskLevel(mri),
    rollup_kind: row.bucket_kind,
    sample_count: row.sample_count,
  };
}

export function useRealtimeData() {
  const [state, setState] = useState<RealtimeState>({
    readings: [],
    historyReadings: [],
    latestReading: null,
    alerts: [],
    isConnected: false,
    isLoading: true,
    isHistoryLoading: true,
    isLoadingMore: false,
    hasMoreHistory: false,
    error: null,
    selectedRange: 'live',
    lastReceivedAt: null,
    totalSamples: 0,
    controlStatus: null,
    controlMode: 'auto',
  });

  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const historyLengthRef = useRef(0);

  useEffect(() => {
    historyLengthRef.current = state.historyReadings.length;
  }, [state.historyReadings.length]);

  const fetchHistory = useCallback(async (range: HistoryRange, append = false) => {
    if (!isSupabaseConfigured) return;

    setState((prev) => ({
      ...prev,
      isHistoryLoading: !append,
      isLoadingMore: append,
    }));

    try {
      const offset = append ? historyLengthRef.current : 0;
      const since = rangeStart(range);
      const useRollups = range === '7d' || range === '30d' || range === '90d';

      if (useRollups) {
        const bucketKind = range === '90d' ? 'day' : 'hour';
        let query = supabase
          .from('sensor_rollups')
          .select('id,bucket_start,bucket_kind,device_id,sample_count,avg_temperature,avg_humidity,avg_gas_ppm,avg_moisture,avg_mri_score,max_mri_score')
          .eq('device_id', DEVICE_ID)
          .eq('bucket_kind', bucketKind)
          .order('bucket_start', { ascending: false })
          .range(offset, offset + HISTORY_PAGE_SIZE - 1);

        if (since) query = query.gte('bucket_start', since);

        const { data, error } = await query;
        if (error) throw error;

        const nextReadings = (data || []).map((row) => toRollupReading(row)).reverse();
        setState((prev) => ({
          ...prev,
          historyReadings: append ? [...prev.historyReadings, ...nextReadings] : nextReadings,
          isHistoryLoading: false,
          isLoadingMore: false,
          hasMoreHistory: nextReadings.length === HISTORY_PAGE_SIZE,
        }));
        return;
      }

      let query = supabase
        .from('sensor_readings')
        .select('id,created_at,device_id,temperature,humidity,gas_ppm,moisture,fan_on,buzzer_on,mri_score,risk_level')
        .eq('device_id', DEVICE_ID)
        .order('created_at', { ascending: false })
        .range(offset, offset + HISTORY_PAGE_SIZE - 1);

      if (since) query = query.gte('created_at', since);

      const { data, error } = await query;
      if (error) throw error;

      const nextReadings = ((data || []) as SensorReading[]).reverse();
      setState((prev) => ({
        ...prev,
        historyReadings: append ? [...prev.historyReadings, ...nextReadings] : nextReadings,
        isHistoryLoading: false,
        isLoadingMore: false,
        hasMoreHistory: nextReadings.length === HISTORY_PAGE_SIZE,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch history';
      setState((prev) => ({
        ...prev,
        isHistoryLoading: false,
        isLoadingMore: false,
        error: message,
      }));
    }
  }, []);

  const startDemoMode = useCallback(() => {
    const demoHistory = Array.from({ length: 96 }, (_, index) => generateDemoReading(index, 96));
    const live = demoHistory.slice(-LIVE_LIMIT);
    const alerts = Array.from({ length: 10 }, (_, index) => generateDemoAlert(index));

    setState((prev) => ({
      ...prev,
      readings: live,
      historyReadings: demoHistory,
      latestReading: live[live.length - 1],
      alerts,
      isConnected: true,
      isLoading: false,
      isHistoryLoading: false,
      hasMoreHistory: false,
      error: null,
      lastReceivedAt: live[live.length - 1]?.created_at ?? null,
      totalSamples: demoHistory.length,
      controlMode: 'auto',
    }));

    demoIntervalRef.current = setInterval(() => {
      const newReading = generateDemoReading(Date.now(), LIVE_LIMIT);
      setState((prev) => ({
        ...prev,
        readings: [...prev.readings.slice(-(LIVE_LIMIT - 1)), newReading],
        historyReadings: [...prev.historyReadings.slice(-199), newReading],
        latestReading: newReading,
        lastReceivedAt: newReading.created_at,
        totalSamples: prev.totalSamples + 1,
      }));
    }, 5000);
  }, []);

  const fetchInitialData = useCallback(async () => {
    try {
      const [currentRes, readingsRes, alertsRes, commandRes] = await Promise.all([
        supabase
          .from('current_sensor_readings')
          .select('device_id,temperature,humidity,gas_ppm,moisture,fan_on,buzzer_on,mri_score,risk_level,updated_at')
          .eq('device_id', DEVICE_ID)
          .maybeSingle(),
        supabase
          .from('sensor_readings')
          .select('id,created_at,device_id,temperature,humidity,gas_ppm,moisture,fan_on,buzzer_on,mri_score,risk_level')
          .eq('device_id', DEVICE_ID)
          .order('created_at', { ascending: false })
          .limit(LIVE_LIMIT),
        supabase
          .from('alerts')
          .select('id,created_at,device_id,type,sensor,value,mri_score,risk_level')
          .eq('device_id', DEVICE_ID)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('actuator_commands')
          .select('device_id,fan_on,buzzer_on,control_mode,updated_at')
          .eq('device_id', DEVICE_ID)
          .maybeSingle(),
      ]);

      if (currentRes.error) throw currentRes.error;
      if (readingsRes.error) throw readingsRes.error;
      if (alertsRes.error) throw alertsRes.error;
      if (commandRes.error) throw commandRes.error;

      const historyReadings = ((readingsRes.data || []) as SensorReading[]).reverse();
      const currentReading = currentRes.data ? currentToReading(currentRes.data as CurrentSensorReading) : null;
      const readings = currentReading
        ? [...historyReadings, currentReading].slice(-LIVE_LIMIT)
        : historyReadings;

      setState((prev) => ({
        ...prev,
        readings,
        latestReading: currentReading || readings[readings.length - 1] || null,
        alerts: (alertsRes.data || []) as Alert[],
        isLoading: false,
        isConnected: true,
        error: null,
        lastReceivedAt: (currentReading || readings[readings.length - 1])?.created_at ?? null,
        totalSamples: historyReadings.length,
        controlMode: (commandRes.data?.control_mode as ControlMode | undefined) || 'auto',
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data';
      console.warn('[SiloGuard] Supabase fetch failed, falling back to demo mode:', message);
      startDemoMode();
      setState((prev) => ({ ...prev, error: message }));
    }
  }, [startDemoMode]);

  const setSelectedRange = useCallback((range: HistoryRange) => {
    setState((prev) => ({ ...prev, selectedRange: range, historyReadings: [] }));
    void fetchHistory(range);
  }, [fetchHistory]);

  const loadMoreHistory = useCallback(() => {
    void fetchHistory(state.selectedRange, true);
  }, [fetchHistory, state.selectedRange]);

  const toggleActuator = useCallback(
    async (actuator: 'fan_on' | 'buzzer_on', value: boolean) => {
      const latest = state.latestReading;
      if (!latest) return;

      const command: ActuatorCommand = {
        device_id: DEVICE_ID,
        fan_on: actuator === 'fan_on' ? value : latest.fan_on,
        buzzer_on: actuator === 'buzzer_on' ? value : latest.buzzer_on,
        control_mode: 'manual',
      };

      if (!isSupabaseConfigured) {
        const updated: SensorReading = { ...latest, fan_on: command.fan_on, buzzer_on: command.buzzer_on };
        setState((prev) => ({
          ...prev,
          latestReading: updated,
          readings: prev.readings.map((reading) => (reading.id === latest.id ? updated : reading)),
          historyReadings: prev.historyReadings.map((reading) => (reading.id === latest.id ? updated : reading)),
          controlStatus: 'Demo command updated locally',
          controlMode: 'manual',
        }));
        return;
      }

      try {
        const { error } = await supabase
          .from('actuator_commands')
          .upsert(
            { ...command, updated_at: new Date().toISOString() },
            { onConflict: 'device_id' }
          );

        if (error) throw error;

        const updated: SensorReading = { ...latest, fan_on: command.fan_on, buzzer_on: command.buzzer_on };
        setState((prev) => ({
          ...prev,
          latestReading: updated,
          readings: prev.readings.map((reading) => (reading.id === latest.id ? updated : reading)),
          historyReadings: prev.historyReadings.map((reading) => (reading.id === latest.id ? updated : reading)),
          controlStatus: 'Manual command sent to device',
          controlMode: 'manual',
        }));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Actuator command failed';
        setState((prev) => ({ ...prev, controlStatus: message }));
      }
    },
    [state.latestReading]
  );

  const setAutoControl = useCallback(async () => {
    const latest = state.latestReading;
    const command: ActuatorCommand = {
      device_id: DEVICE_ID,
      fan_on: latest?.fan_on ?? false,
      buzzer_on: latest?.buzzer_on ?? false,
      control_mode: 'auto',
    };

    if (!isSupabaseConfigured) {
      setState((prev) => ({
        ...prev,
        controlMode: 'auto',
        controlStatus: 'Auto mode enabled locally',
      }));
      return;
    }

    try {
      const { error } = await supabase
        .from('actuator_commands')
        .upsert(
          { ...command, updated_at: new Date().toISOString() },
          { onConflict: 'device_id' }
        );

      if (error) throw error;

      setState((prev) => ({
        ...prev,
        controlMode: 'auto',
        controlStatus: 'Auto mode sent to device',
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Auto mode command failed';
      setState((prev) => ({ ...prev, controlStatus: message }));
    }
  }, [state.latestReading]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const demoTimer = window.setTimeout(startDemoMode, 0);
      return () => {
        window.clearTimeout(demoTimer);
        if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
      };
    }

    const initialLoadTimer = window.setTimeout(() => {
      void fetchInitialData();
      void fetchHistory('live');
    }, 0);

    const channel = supabase
      .channel(`dashboard-realtime-${DEVICE_ID}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'current_sensor_readings',
          filter: `device_id=eq.${DEVICE_ID}`,
        },
        (payload) => {
          const newReading = currentToReading(payload.new as CurrentSensorReading);
          setState((prev) => ({
            ...prev,
            readings: [...prev.readings.slice(-(LIVE_LIMIT - 1)), newReading],
            latestReading: newReading,
            lastReceivedAt: newReading.created_at,
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_readings',
          filter: `device_id=eq.${DEVICE_ID}`,
        },
        (payload) => {
          const newReading = payload.new as SensorReading;
          setState((prev) => ({
            ...prev,
            historyReadings: prev.selectedRange === 'live'
              ? [...prev.historyReadings.slice(-(HISTORY_PAGE_SIZE - 1)), newReading]
              : prev.historyReadings,
            totalSamples: prev.totalSamples + 1,
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts',
          filter: `device_id=eq.${DEVICE_ID}`,
        },
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
        {
          event: '*',
          schema: 'public',
          table: 'actuator_commands',
          filter: `device_id=eq.${DEVICE_ID}`,
        },
        (payload) => {
          const command = payload.new as ActuatorCommand;
          setState((prev) => ({ ...prev, controlMode: command.control_mode || 'auto' }));
        }
      )
      .subscribe((status) => {
        setState((prev) => ({ ...prev, isConnected: status === 'SUBSCRIBED' }));
      });

    return () => {
      window.clearTimeout(initialLoadTimer);
      void supabase.removeChannel(channel);
    };
  }, [fetchHistory, fetchInitialData, startDemoMode]);

  return {
    ...state,
    deviceId: DEVICE_ID,
    setSelectedRange,
    loadMoreHistory,
    toggleActuator,
    setAutoControl,
  };
}
