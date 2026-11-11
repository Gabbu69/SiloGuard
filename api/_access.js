import { timingSafeEqual } from 'node:crypto';

export function tokenMatches(expected, received) {
  if (typeof expected !== 'string' || expected.length < 32 || typeof received !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function allowedDevice(input, configured = process.env.DEVICE_ID) {
  return typeof configured === 'string' && configured.length > 0 && input === configured;
}

export function parseBody(body) {
  try {
    const value = typeof body === 'string' ? JSON.parse(body) : body;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

export function validCommand(body) {
  return body && typeof body.fan_on === 'boolean' && typeof body.buzzer_on === 'boolean'
    && ['auto', 'manual'].includes(body.control_mode);
}
