import { getDatabase } from './_database.js';
import { allowedDevice, parseBody, tokenMatches } from './_access.js';

const limits = { temperature: [-10, 70], humidity: [0, 100], gas_ppm: [0, 1200], moisture: [0, 100] };
const score = (value, warning, danger) => Math.min(100, Math.max(0, (value - warning * 0.5) / (danger * 1.2 - warning * 0.5) * 100));

export function createHandler(database = getDatabase) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!tokenMatches(process.env.DEVICE_TOKEN, req.headers['x-device-token'])) return res.status(401).json({ error: 'Authorization required' });
    const body = parseBody(req.body);
    if (!body) return res.status(400).json({ error: 'Invalid JSON object' });
    if (!allowedDevice(body.device_id)) return res.status(403).json({ error: 'Device is not authorized' });
    const valid = Object.entries(limits).every(([key, [min, max]]) =>
      typeof body[key] === 'number' && Number.isFinite(body[key]) && body[key] >= min && body[key] <= max);
    if (!valid || typeof body.fan_on !== 'boolean' || typeof body.buzzer_on !== 'boolean'
      || !['live', 'history'].includes(body.kind)) return res.status(400).json({ error: 'Invalid sensor payload' });
    const mri = Math.round(score(body.humidity, 70, 85) * .4 + score(body.temperature, 32, 38) * .3
      + score(body.gas_ppm, 200, 400) * .2 + score(body.moisture, 60, 80) * .1);
    const reading = {
      device_id: body.device_id, temperature: body.temperature, humidity: body.humidity,
      gas_ppm: body.gas_ppm, moisture: body.moisture, fan_on: body.fan_on, buzzer_on: body.buzzer_on,
      mri_score: mri, risk_level: mri >= 75 ? 'Critical' : mri >= 50 ? 'High' : mri >= 25 ? 'Moderate' : 'Low',
    };
    try {
      const db = database();
      if (body.kind === 'live') {
        let acknowledged = null;
        if (typeof body.acknowledged_command_at === 'string') {
          const { data, error } = await db.from('actuator_commands').select('updated_at')
            .eq('device_id', body.device_id).maybeSingle();
          if (error) throw error;
          if (data?.updated_at === body.acknowledged_command_at) acknowledged = data.updated_at;
        }
        const { error } = await db.from('current_sensor_readings').upsert({
          ...reading, updated_at: new Date().toISOString(), acknowledged_command_at: acknowledged,
        }, { onConflict: 'device_id' });
        if (error) throw error;
      } else {
        // Database triggers throttle history and derive alerts/rollups once.
        const { error } = await db.from('sensor_readings').insert(reading);
        if (error) throw error;
      }
      return res.status(202).json({ ok: true, kind: body.kind });
    } catch {
      return res.status(503).json({ error: 'Telemetry service unavailable' });
    }
  };
}
export default createHandler();
