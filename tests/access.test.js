import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tokenMatches, allowedDevice } from '../api/_access.js';
import { createHandler as commands } from '../api/actuators.js';
import { createHandler as telemetry } from '../api/ingest.js';
import { commandState, freshness } from '../src/lib/deviceState.ts';

const operator = 'o'.repeat(40);
const device = 'd'.repeat(40);
process.env.DEVICE_ID = 'silo-test';
process.env.DEVICE_TOKEN = device;
process.env.DASHBOARD_CONTROL_TOKEN = operator;
const response = () => ({ code: 0, body: null, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const noDatabase = () => { throw new Error('Unauthorized request reached the database'); };

test('missing configuration, short tokens and wrong devices fail closed', () => {
  assert.equal(tokenMatches(undefined, undefined), false);
  assert.equal(tokenMatches('short', 'short'), false);
  assert.equal(tokenMatches(operator, device), false);
  assert.equal(tokenMatches(operator, operator), true);
  assert.equal(allowedDevice('another-device'), false);
});

test('public viewers and device tokens cannot issue commands', async () => {
  for (const headers of [{}, { authorization: `Bearer ${device}` }, { 'x-device-token': device }]) {
    const res = response();
    await commands(noDatabase)({ method: 'POST', headers, body: {} }, res);
    assert.equal(res.code, 401);
  }
  const previous = process.env.DASHBOARD_CONTROL_TOKEN;
  delete process.env.DASHBOARD_CONTROL_TOKEN;
  const res = response();
  await commands(noDatabase)({ method: 'POST', headers: {}, body: {} }, res);
  assert.equal(res.code, 401);
  process.env.DASHBOARD_CONTROL_TOKEN = previous;
});

test('authorized operators cannot control another device or coerce strings to output booleans', async () => {
  for (const [body, expected] of [
    [{ device_id: 'other', fan_on: false, buzzer_on: false, control_mode: 'auto' }, 403],
    [{ device_id: 'silo-test', fan_on: 'false', buzzer_on: false, control_mode: 'manual' }, 400],
    [{ device_id: 'silo-test', fan_on: false, buzzer_on: false }, 400],
  ]) {
    const res = response();
    await commands(noDatabase)({ method: 'POST', headers: { authorization: `Bearer ${operator}` }, body }, res);
    assert.equal(res.code, expected);
  }
});

test('command writes record requested intent without fabricating telemetry', async () => {
  const writes = [];
  const db = { from(table) {
    assert.equal(table, 'actuator_commands');
    return { upsert(row) { writes.push(row); return { select() { return { single: async () => ({ data: row, error: null }) }; } }; } };
  } };
  const res = response();
  await commands(() => db)({ method: 'POST', headers: { authorization: `Bearer ${operator}` }, body: {
    device_id: 'silo-test', fan_on: false, buzzer_on: false, control_mode: 'auto',
  } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.status, 'requested');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].control_mode, 'auto');
});

test('telemetry rejects viewer keys, foreign devices and invalid sensor data', async () => {
  const base = { device_id: 'silo-test', temperature: 28, humidity: 60, gas_ppm: 100, moisture: 40, fan_on: false, buzzer_on: false, kind: 'live' };
  for (const [headers, body, expected] of [
    [{}, base, 401],
    [{ 'x-device-token': operator }, base, 401],
    [{ 'x-device-token': device }, { ...base, device_id: 'foreign' }, 403],
    [{ 'x-device-token': device }, { ...base, temperature: null }, 400],
    [{ 'x-device-token': device }, { ...base, humidity: 101 }, 400],
    [{ 'x-device-token': device }, { ...base, fan_on: 'false' }, 400],
  ]) {
    const res = response();
    await telemetry(noDatabase)({ method: 'POST', headers, body }, res);
    assert.equal(res.code, expected);
  }
});

test('freshness ages without a new event and acknowledgment must match the request', () => {
  const now = Date.parse('2026-11-11T00:00:00Z');
  assert.equal(freshness(new Date(now).toISOString(), now), 'fresh');
  assert.equal(freshness(new Date(now - 16000).toISOString(), now), 'stale');
  assert.equal(freshness(new Date(now - 120000).toISOString(), now), 'offline');
  assert.equal(freshness(null, now), 'offline');
  assert.equal(freshness('invalid', now), 'offline');
  assert.equal(freshness(new Date(now + 60000).toISOString(), now), 'offline');
  assert.match(commandState('2026-11-11T00:00:00Z', '2026-11-10T00:00:00Z'), /awaiting/);
  assert.match(commandState('2026-11-11T00:00:00Z', '2026-11-11T00:00:00Z'), /acknowledged/);
  assert.match(commandState('2026-11-11T00:00:00.123999Z', '2026-11-11T00:00:00.123001Z'), /awaiting/);
});
