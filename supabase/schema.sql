-- SiloGuard: Smart Rice Storage Monitoring System
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Create sensor_readings table
CREATE TABLE IF NOT EXISTS sensor_readings (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  temperature FLOAT8 NOT NULL DEFAULT 0,
  humidity FLOAT8 NOT NULL DEFAULT 0,
  gas_ppm FLOAT8 NOT NULL DEFAULT 0,
  moisture FLOAT8 NOT NULL DEFAULT 0,
  fan_on BOOLEAN NOT NULL DEFAULT FALSE,
  buzzer_on BOOLEAN NOT NULL DEFAULT FALSE
);

-- 2. Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL,
  sensor TEXT NOT NULL,
  value FLOAT8 NOT NULL DEFAULT 0,
  mri_score FLOAT8 NOT NULL DEFAULT 0
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for public read access (anon key)
CREATE POLICY "Allow public read access on sensor_readings"
  ON sensor_readings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert on sensor_readings"
  ON sensor_readings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update on sensor_readings"
  ON sensor_readings FOR UPDATE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access on alerts"
  ON alerts FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert on alerts"
  ON alerts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 5. Enable Realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE sensor_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sensor_readings_created_at ON sensor_readings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts (created_at DESC);

-- 7. Insert sample data (optional - remove if using real sensors)
INSERT INTO sensor_readings (temperature, humidity, gas_ppm, moisture, fan_on, buzzer_on) VALUES
  (28.5, 65.2, 120, 45.0, false, false),
  (30.1, 72.8, 185, 55.3, false, false),
  (33.4, 78.5, 250, 62.1, true, false),
  (35.2, 82.1, 310, 70.5, true, false),
  (37.8, 86.3, 420, 78.2, true, true),
  (29.0, 68.0, 150, 48.7, false, false),
  (31.5, 74.2, 210, 58.9, true, false),
  (27.3, 62.5, 95, 42.1, false, false),
  (34.1, 80.0, 280, 65.8, true, false),
  (36.5, 84.7, 380, 75.0, true, true);

INSERT INTO alerts (type, sensor, value, mri_score) VALUES
  ('Threshold Exceeded', 'temperature', 37.8, 72),
  ('Fan Activated', 'humidity', 82.1, 65),
  ('Buzzer Triggered', 'gas_ppm', 420, 80),
  ('Threshold Exceeded', 'moisture', 78.2, 68),
  ('Fan Activated', 'temperature', 35.2, 58);
