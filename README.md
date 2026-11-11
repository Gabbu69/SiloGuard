# SiloGuard — rice-storage monitoring prototype

## Access model

The public viewer key can only read the dashboard. Devices POST telemetry to
`/api/ingest` with `x-device-token`; operators POST commands to `/api/actuators`
with a separate Bearer token. Both secrets must have at least 32 characters;
missing/short secrets deny access. A token is scoped to the server's configured
`DEVICE_ID`. Devices cannot use their token to submit operator commands.

Apply `supabase/schema.sql` to both new and existing databases. It preserves
records, removes legacy anonymous write policies, and revokes browser-role writes.
This is a source change: applying it to a hosted database is a separate operation.

## Configure and run

Copy `.env.example` into an ignored environment file. Public `VITE_` values are
viewer configuration only. Keep the service key, device token, and operator token
in server configuration. The operator enters the separate control token into a
password field; the browser retains it only in component memory for that session.
For a single-device controlled prototype, distribute that token only to authorized
operators. It is a shared operator credential, not a per-user account/audit system.

```powershell
npm ci
npm test
npm run lint
npm run build
npm run dev
```

Use a Vercel development/deployment runtime for `/api` handlers. Vite by itself
only serves the frontend. With no public database configuration, the dashboard
is an explicitly labeled synthetic demo. Configured connection failures remain
errors; they never silently replace live readings with simulated data.

## Device and command contract

Configure `API_ORIGIN`, `DEVICE_TOKEN`, `DEVICE_ID`, and the PEM `API_ROOT_CA` in
`esp32/SiloGuard_ESP32.ino`. The firmware never embeds a database service key or
viewer key. HTTPS certificate validation is required; an empty CA blocks requests.

Send numeric `temperature`, `humidity`, `gas_ppm`, and `moisture`, boolean `fan_on`
and `buzzer_on`, a `device_id`, and `kind` (`live` or `history`). Live requests
update current telemetry. History requests insert bounded history; existing
triggers compute alerts and rollups once.

Commands contain boolean output states and `control_mode` (`auto` or `manual`).
The server records requested intent. The firmware applies it, then echoes its
exact `updated_at` as `acknowledged_command_at` in live telemetry. The API checks
that it matches the current command. Pin-state acknowledgment is not proof of
fan rotation, buzzer sound, wiring correctness, or calibration.

The viewer labels fresh readings, stale readings after 15 seconds, and offline
readings after 120 seconds. It keeps old values visible with their timestamp.
Reported outputs change only on telemetry; saving a command does not change them.
Controls require fresh data and wait for acknowledgment of the previous request.

## Verification boundaries

The automated access tests cover fail-closed configuration, role-token separation,
device scope, strict boolean/numeric input, request-only command writes, freshness,
and acknowledgment matching. Database permission tests, hosted endpoint behavior,
firmware compilation, sensor calibration, TLS chain configuration, and physical
command acceptance require their own results before operational use.

The mold-risk index remains an experimental weighted threshold calculation. It
is not independently validated mold detection.
