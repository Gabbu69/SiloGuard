-- SiloGuard: secure telemetry schema with historical rollups.
-- Run in Supabase SQL Editor. Server-side API writes with the service role key.

create table if not exists public.sensor_readings (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  device_id text not null default 'silo-1',
  temperature float8 not null check (temperature between -10 and 70),
  humidity float8 not null check (humidity between 0 and 100),
  gas_ppm float8 not null check (gas_ppm between 0 and 1200),
  moisture float8 not null check (moisture between 0 and 100),
  fan_on boolean not null default false,
  buzzer_on boolean not null default false,
  mri_score int not null default 0 check (mri_score between 0 and 100),
  risk_level text not null default 'Low' check (risk_level in ('Low', 'Moderate', 'High', 'Critical'))
);

alter table public.sensor_readings
  add column if not exists device_id text not null default 'silo-1',
  add column if not exists mri_score int not null default 0,
  add column if not exists risk_level text not null default 'Low';

create table if not exists public.alerts (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  device_id text not null default 'silo-1',
  type text not null,
  sensor text not null,
  value float8 not null default 0,
  mri_score int not null default 0,
  risk_level text not null default 'Low' check (risk_level in ('Low', 'Moderate', 'High', 'Critical'))
);

alter table public.alerts
  add column if not exists device_id text not null default 'silo-1',
  add column if not exists risk_level text not null default 'Low';

create table if not exists public.sensor_rollups (
  id bigserial primary key,
  bucket_kind text not null check (bucket_kind in ('hour', 'day')),
  bucket_start timestamptz not null,
  device_id text not null default 'silo-1',
  sample_count int not null default 0,
  avg_temperature float8 not null default 0,
  min_temperature float8 not null default 0,
  max_temperature float8 not null default 0,
  avg_humidity float8 not null default 0,
  min_humidity float8 not null default 0,
  max_humidity float8 not null default 0,
  avg_gas_ppm float8 not null default 0,
  min_gas_ppm float8 not null default 0,
  max_gas_ppm float8 not null default 0,
  avg_moisture float8 not null default 0,
  min_moisture float8 not null default 0,
  max_moisture float8 not null default 0,
  avg_mri_score float8 not null default 0,
  max_mri_score int not null default 0,
  updated_at timestamptz not null default now(),
  unique (bucket_kind, bucket_start, device_id)
);

create table if not exists public.actuator_commands (
  device_id text primary key,
  fan_on boolean not null default false,
  buzzer_on boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.actuator_commands (device_id, fan_on, buzzer_on)
values ('silo-1', false, false)
on conflict (device_id) do nothing;

create index if not exists idx_sensor_readings_device_created_at
  on public.sensor_readings (device_id, created_at desc);

create index if not exists idx_alerts_device_created_at
  on public.alerts (device_id, created_at desc);

create index if not exists idx_rollups_device_kind_bucket
  on public.sensor_rollups (device_id, bucket_kind, bucket_start desc);

create or replace function public.upsert_sensor_rollup(bucket timestamptz, bucket_kind text, reading jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  device text := coalesce(reading->>'device_id', 'silo-1');
  temp float8 := (reading->>'temperature')::float8;
  hum float8 := (reading->>'humidity')::float8;
  gas float8 := (reading->>'gas_ppm')::float8;
  moist float8 := (reading->>'moisture')::float8;
  mri int := (reading->>'mri_score')::int;
begin
  insert into public.sensor_rollups (
    bucket_kind, bucket_start, device_id, sample_count,
    avg_temperature, min_temperature, max_temperature,
    avg_humidity, min_humidity, max_humidity,
    avg_gas_ppm, min_gas_ppm, max_gas_ppm,
    avg_moisture, min_moisture, max_moisture,
    avg_mri_score, max_mri_score
  )
  values (
    bucket_kind, bucket, device, 1,
    temp, temp, temp,
    hum, hum, hum,
    gas, gas, gas,
    moist, moist, moist,
    mri, mri
  )
  on conflict (bucket_kind, bucket_start, device_id)
  do update set
    sample_count = sensor_rollups.sample_count + 1,
    avg_temperature = ((sensor_rollups.avg_temperature * sensor_rollups.sample_count) + temp) / (sensor_rollups.sample_count + 1),
    min_temperature = least(sensor_rollups.min_temperature, temp),
    max_temperature = greatest(sensor_rollups.max_temperature, temp),
    avg_humidity = ((sensor_rollups.avg_humidity * sensor_rollups.sample_count) + hum) / (sensor_rollups.sample_count + 1),
    min_humidity = least(sensor_rollups.min_humidity, hum),
    max_humidity = greatest(sensor_rollups.max_humidity, hum),
    avg_gas_ppm = ((sensor_rollups.avg_gas_ppm * sensor_rollups.sample_count) + gas) / (sensor_rollups.sample_count + 1),
    min_gas_ppm = least(sensor_rollups.min_gas_ppm, gas),
    max_gas_ppm = greatest(sensor_rollups.max_gas_ppm, gas),
    avg_moisture = ((sensor_rollups.avg_moisture * sensor_rollups.sample_count) + moist) / (sensor_rollups.sample_count + 1),
    min_moisture = least(sensor_rollups.min_moisture, moist),
    max_moisture = greatest(sensor_rollups.max_moisture, moist),
    avg_mri_score = ((sensor_rollups.avg_mri_score * sensor_rollups.sample_count) + mri) / (sensor_rollups.sample_count + 1),
    max_mri_score = greatest(sensor_rollups.max_mri_score, mri),
    updated_at = now();
end;
$$;

create or replace function public.delete_old_sensor_readings()
returns int
language plpgsql
set search_path = public
as $$
declare
  deleted_count int;
begin
  delete from public.sensor_readings
  where created_at < now() - interval '90 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

alter table public.sensor_readings enable row level security;
alter table public.alerts enable row level security;
alter table public.sensor_rollups enable row level security;
alter table public.actuator_commands enable row level security;

drop policy if exists "Public read sensor_readings" on public.sensor_readings;
drop policy if exists "Public read alerts" on public.alerts;
drop policy if exists "Public read sensor_rollups" on public.sensor_rollups;
drop policy if exists "Public read actuator_commands" on public.actuator_commands;
drop policy if exists "Allow public insert on sensor_readings" on public.sensor_readings;
drop policy if exists "Allow public update on sensor_readings" on public.sensor_readings;
drop policy if exists "Allow public insert on alerts" on public.alerts;

create policy "Public read sensor_readings"
  on public.sensor_readings for select
  to anon, authenticated
  using (true);

create policy "Public read alerts"
  on public.alerts for select
  to anon, authenticated
  using (true);

create policy "Public read sensor_rollups"
  on public.sensor_rollups for select
  to anon, authenticated
  using (true);

create policy "Public read actuator_commands"
  on public.actuator_commands for select
  to anon, authenticated
  using (true);

do $$
begin
  alter publication supabase_realtime add table public.sensor_readings;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.alerts;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.actuator_commands;
exception
  when duplicate_object then null;
end $$;

grant usage on schema public to anon, authenticated;
grant select on public.sensor_readings, public.alerts, public.sensor_rollups, public.actuator_commands to anon, authenticated;
revoke execute on function public.upsert_sensor_rollup(timestamptz, text, jsonb) from public, anon, authenticated;
revoke execute on function public.delete_old_sensor_readings() from public, anon, authenticated;
