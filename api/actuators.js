import { getDatabase } from './_database.js';
import { allowedDevice, parseBody, tokenMatches, validCommand } from './_access.js';

export function createHandler(database = getDatabase) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
    const deviceRequest = req.method === 'GET';
    const authorized = deviceRequest
      ? tokenMatches(process.env.DEVICE_TOKEN, req.headers['x-device-token'])
      : process.env.DASHBOARD_CONTROL_TOKEN !== process.env.DEVICE_TOKEN
        && tokenMatches(process.env.DASHBOARD_CONTROL_TOKEN, typeof req.headers.authorization === 'string'
          && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);
    if (!authorized) return res.status(401).json({ error: 'Authorization required' });
    const body = deviceRequest ? null : parseBody(req.body);
    const deviceId = deviceRequest ? req.query.device_id : body?.device_id;
    if (!allowedDevice(deviceId)) return res.status(403).json({ error: 'Device is not authorized' });
    if (!deviceRequest && !validCommand(body)) return res.status(400).json({ error: 'Boolean actuator states and a valid control mode are required' });
    try {
      const db = database();
      if (deviceRequest) {
        const { data, error } = await db.from('actuator_commands')
          .select('device_id,fan_on,buzzer_on,control_mode,updated_at').eq('device_id', deviceId).maybeSingle();
        if (error) throw error;
        return res.status(200).json(data || { device_id: deviceId, fan_on: false, buzzer_on: false, control_mode: 'auto' });
      }
      const { data, error } = await db.from('actuator_commands').upsert({
        device_id: deviceId, fan_on: body.fan_on, buzzer_on: body.buzzer_on,
        control_mode: body.control_mode, updated_at: new Date().toISOString(),
      }, { onConflict: 'device_id' }).select('device_id,fan_on,buzzer_on,control_mode,updated_at').single();
      if (error) throw error;
      // A stored request is not evidence of execution. Firmware echoes this
      // timestamp in telemetry only after applying the command to output pins.
      return res.status(200).json({ ok: true, command: data, status: 'requested' });
    } catch {
      return res.status(503).json({ error: 'Command service unavailable' });
    }
  };
}
export default createHandler();
