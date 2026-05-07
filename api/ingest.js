import { createClient } from '@supabase/supabase-js';

const SENSOR_LIMITS = {
  temperature: { min: -10, max: 70 },
  humidity: { min: 0, max: 100 },
  gas_ppm: { min: 0, max: 1200 },
  moisture: { min: 0, max: 100 },
};

const THRESHOLDS = {
  temperature: { warning: 32, danger: 38 },
  humidity: { warning: 70, danger: 85 },
  gas_ppm: { warning: 200, danger: 400 },
  moisture: { warning: 60, danger: 80 },
};

const ALERT_COOLDOWN_MINUTES = Number(process.env.ALERT_COOLDOWN_MINUTES || 10);

let adminClient;

function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }

  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

function normalizeScore(value, warning, danger) {
  const low = warning * 0.5;
  const high = danger * 1.2;
  if (value <= low) return 0;
  if (value >= high) return 100;
  return Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100));
}

function computeMRI(reading) {
  const humidityScore = normalizeScore(reading.humidity, THRESHOLDS.humidity.warning, THRESHOLDS.humidity.danger);
  const tempScore = normalizeScore(reading.temperature, THRESHOLDS.temperature.warning, THRESHOLDS.temperature.danger);
  const gasScore = normalizeScore(reading.gas_ppm, THRESHOLDS.gas_ppm.warning, THRESHOLDS.gas_ppm.danger);
  const moistureScore = normalizeScore(reading.moisture, THRESHOLDS.moisture.warning, THRESHOLDS.moisture.danger);

  return Math.round((humidityScore * 0.4) + (tempScore * 0.3) + (gasScore * 0.2) + (moistureScore * 0.1));
}

function getRiskLevel(mri) {
  if (mri >= 75) return 'Critical';
  if (mri >= 50) return 'High';
  if (mri >= 25) return 'Moderate';
  return 'Low';
}

function worstSensor(reading) {
  const order = ['temperature', 'humidity', 'gas_ppm', 'moisture'];
  const danger = order.find((key) => reading[key] > THRESHOLDS[key].danger);
  if (danger) return danger;
  const warning = order.find((key) => reading[key] > THRESHOLDS[key].warning);
  return warning || null;
}

function round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

function validatePayload(payload) {
  const errors = [];
  const deviceId = typeof payload.device_id === 'string' ? payload.device_id.trim() : '';

  if (!deviceId || deviceId.length > 64) {
    errors.push('device_id is required and must be 64 characters or fewer');
  }

  for (const [key, limit] of Object.entries(SENSOR_LIMITS)) {
    const value = Number(payload[key]);
    if (!Number.isFinite(value) || value < limit.min || value > limit.max) {
      errors.push(`${key} must be between ${limit.min} and ${limit.max}`);
    }
  }

  return { errors, deviceId };
}

function parseJsonBody(req) {
  if (typeof req.body !== 'string') return req.body || {};

  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return null;
  }
}

async function createAlertIfNeeded(supabase, reading) {
  const sensor = worstSensor(reading);
  if (!sensor && reading.mri_score < 40) return null;

  const type = reading.risk_level === 'Critical'
    ? 'Critical Mold Risk'
    : sensor
      ? 'Threshold Exceeded'
      : 'Mold Risk Rising';
  const value = sensor ? reading[sensor] : reading.mri_score;
  const since = new Date(Date.now() - ALERT_COOLDOWN_MINUTES * 60 * 1000).toISOString();

  const { data: recentAlert, error: recentError } = await supabase
    .from('alerts')
    .select('id')
    .eq('device_id', reading.device_id)
    .eq('type', type)
    .eq('sensor', sensor || 'mri_score')
    .gte('created_at', since)
    .limit(1)
    .maybeSingle();

  if (recentError) throw recentError;
  if (recentAlert) return null;

  const alertPayload = {
    device_id: reading.device_id,
    type,
    sensor: sensor || 'mri_score',
    value: round1(value),
    mri_score: reading.mri_score,
    risk_level: reading.risk_level,
  };

  const { data, error } = await supabase
    .from('alerts')
    .insert(alertPayload)
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

async function upsertRollups(supabase, reading) {
  const createdAt = new Date(reading.created_at);
  const hourBucket = new Date(createdAt);
  hourBucket.setMinutes(0, 0, 0);

  const dayBucket = new Date(createdAt);
  dayBucket.setHours(0, 0, 0, 0);

  const rollupPayload = {
    device_id: reading.device_id,
    temperature: reading.temperature,
    humidity: reading.humidity,
    gas_ppm: reading.gas_ppm,
    moisture: reading.moisture,
    mri_score: reading.mri_score,
  };

  const { error: hourlyError } = await supabase.rpc('upsert_sensor_rollup', {
    bucket: hourBucket.toISOString(),
    bucket_kind: 'hour',
    reading: rollupPayload,
  });
  if (hourlyError) throw hourlyError;

  const { error: dailyError } = await supabase.rpc('upsert_sensor_rollup', {
    bucket: dayBucket.toISOString(),
    bucket_kind: 'day',
    reading: rollupPayload,
  });
  if (dailyError) throw dailyError;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-token');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const expectedToken = process.env.DEVICE_TOKEN;
  const receivedToken = req.headers['x-device-token'];

  if (!expectedToken || receivedToken !== expectedToken) {
    res.status(401).json({ error: 'Invalid device token' });
    return;
  }

  const payload = parseJsonBody(req);
  if (!payload) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const { errors, deviceId } = validatePayload(payload);

  if (errors.length > 0) {
    res.status(400).json({ error: 'Invalid sensor payload', details: errors });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const mriScore = computeMRI(payload);
    const reading = {
      device_id: deviceId,
      temperature: round1(payload.temperature),
      humidity: round1(payload.humidity),
      gas_ppm: round1(payload.gas_ppm),
      moisture: round1(payload.moisture),
      fan_on: Boolean(payload.fan_on),
      buzzer_on: Boolean(payload.buzzer_on),
      mri_score: mriScore,
      risk_level: getRiskLevel(mriScore),
    };

    const { data, error } = await supabase
      .from('sensor_readings')
      .insert(reading)
      .select('id, created_at, mri_score, risk_level')
      .single();

    if (error) throw error;

    const savedReading = { ...reading, ...data };
    const [alert] = await Promise.all([
      createAlertIfNeeded(supabase, savedReading),
      upsertRollups(supabase, savedReading),
    ]);

    res.status(201).json({
      ok: true,
      id: data.id,
      created_at: data.created_at,
      mri_score: data.mri_score,
      risk_level: data.risk_level,
      alert_created: Boolean(alert),
    });
  } catch (error) {
    console.error('[SiloGuard] ingestion failed', error);
    res.status(500).json({ error: 'Failed to record sensor reading' });
  }
}
