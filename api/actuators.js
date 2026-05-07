import { createClient } from '@supabase/supabase-js';

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

function getDeviceId(input) {
  const deviceId = typeof input === 'string' ? input.trim() : '';
  return deviceId || 'silo-1';
}

function authorizeDashboard(req) {
  const expected = process.env.DASHBOARD_CONTROL_TOKEN;
  if (!expected) return true;
  return req.headers.authorization === `Bearer ${expected}`;
}

function authorizeDevice(req) {
  const expected = process.env.DEVICE_TOKEN;
  if (!expected) return false;
  return req.headers['x-device-token'] === expected;
}

function parseJsonBody(req) {
  if (typeof req.body !== 'string') return req.body || {};

  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-device-token');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      if (!authorizeDevice(req)) {
        res.status(401).json({ error: 'Invalid device token' });
        return;
      }

      const supabase = getSupabaseAdmin();
      const deviceId = getDeviceId(req.query.device_id);
      const { data, error } = await supabase
        .from('actuator_commands')
        .select('device_id, fan_on, buzzer_on, updated_at')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (error) throw error;
      res.status(200).json(data || { device_id: deviceId, fan_on: false, buzzer_on: false });
      return;
    }

    if (req.method === 'POST') {
      if (!authorizeDashboard(req)) {
        res.status(401).json({ error: 'Invalid dashboard control token' });
        return;
      }

      const supabase = getSupabaseAdmin();
      const body = parseJsonBody(req);
      if (!body) {
        res.status(400).json({ error: 'Invalid JSON body' });
        return;
      }

      const deviceId = getDeviceId(body.device_id);
      const payload = {
        device_id: deviceId,
        fan_on: Boolean(body.fan_on),
        buzzer_on: Boolean(body.buzzer_on),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('actuator_commands')
        .upsert(payload, { onConflict: 'device_id' })
        .select('device_id, fan_on, buzzer_on, updated_at')
        .single();

      if (error) throw error;
      res.status(200).json({ ok: true, command: data });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[SiloGuard] actuator command failed', error);
    res.status(500).json({ error: 'Failed to process actuator command' });
  }
}
