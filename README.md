# SiloGuard - Smart Rice Storage Monitoring System

A real-time IoT dashboard for rice storage monitoring built with React, TypeScript, Tailwind CSS v4, Vercel Functions, and Supabase.

## Features

- Live sensor cards for temperature, humidity, MQ-135 air quality, and grain moisture.
- Mold Risk Index (MRI) calculation with Low, Moderate, High, and Critical risk levels.
- Fast live chart with capped in-memory readings so realtime updates do not grow without limit.
- Historical data filters for Live, 24h, 7d, 30d, and 90d.
- Hourly and daily Supabase rollups for longer history.
- Direct ESP32 telemetry inserts into Supabase using the anon key.
- Read-only dashboard access through Supabase RLS policies.
- Actuator command state through the `actuator_commands` table.
- Printable data report for the selected range.
- Demo mode when Supabase credentials are not configured.

## Data Flow

1. ESP32 reads sensors and prints each data cycle to Serial Monitor.
2. ESP32 sends readings directly to Supabase `sensor_readings` with `device_id`, MRI, and risk level.
3. A Supabase trigger creates alerts with cooldown protection and updates hourly/daily rollups.
4. The dashboard listens to realtime inserts for live data and fetches historical ranges on demand.
5. Long-range views use rollup rows instead of loading every raw reading.

## Environment

Copy `.env.example` to `.env` for local development and configure the same values in Vercel for deployment.

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_DEVICE_ID=silo-1
```

Use the same `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_DEVICE_ID` values in `esp32/SiloGuard_ESP32.ino`.

## Supabase Setup

Run `supabase/schema.sql` in the Supabase SQL Editor. It creates:

- `sensor_readings` with `device_id`, MRI, risk level, actuator states, and indexed timestamps.
- `alerts` with device-scoped alert history.
- `sensor_rollups` for hourly and daily history.
- `actuator_commands` for dashboard-to-device command state.
- RLS policies that allow public reads and allow anon inserts only into `sensor_readings` for `silo-1`.
- A private trigger that updates rollups and alerts after each sensor reading insert.

Raw readings are designed for 90-day retention. Run `select public.delete_old_sensor_readings();` manually or from a scheduled job if you want automatic cleanup.

## Local Development

```bash
npm install
npm run dev
```

The Vite dev server serves the dashboard.

## Build Checks

```bash
npm run lint
npm run build
```

## ESP32

Edit `esp32/SiloGuard_ESP32.ino`:

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `DEVICE_ID`

Serial Monitor output is printed as compact lines like:

```text
DATA,READ,device=silo-1,temp_c=28.4,humidity_pct=65.1,gas_ppm=180,moisture_pct=47.0,mri=26,risk=Moderate,fan=OFF,buzzer=OFF,retry=NONE
```

## Thresholds

| Sensor | Warning | Danger |
| --- | ---: | ---: |
| Temperature | > 32 C | > 38 C |
| Humidity | > 70% | > 85% |
| Gas PPM | > 200 | > 400 |
| Moisture | > 60% | > 80% |

MRI formula:

```text
MRI = humidity_score * 0.4 + temp_score * 0.3 + gas_score * 0.2 + moisture_score * 0.1
```

## University of Southern Mindanao - IoT Research Project
