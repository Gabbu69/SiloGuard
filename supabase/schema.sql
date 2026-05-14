-- SiloGuard: direct ESP32-to-Supabase telemetry schema with historical rollups.
-- Run in Supabase SQL Editor. The ESP32 inserts readings with the anon key.

create table if not exists public.current_sensor_readings (
  device_id text primary key default 'silo-1',
  temperature float8 not null check (temperature between -10 and 70),
  humidity float8 not null check (humidity between 0 and 100),
  gas_ppm float8 not null check (gas_ppm between 0 and 1200),
  moisture float8 not null check (moisture between 0 and 100),
  fan_on boolean not null default false,
  buzzer_on boolean not null default false,
  mri_score int not null default 0 check (mri_score between 0 and 100),
  risk_level text not null default 'Low' check (risk_level in ('Low', 'Moderate', 'High', 'Critical')),
  updated_at timestamptz not null default now()
);

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
  control_mode text not null default 'auto' check (control_mode in ('auto', 'manual')),
  updated_at timestamptz not null default now()
);

alter table public.actuator_commands
  add column if not exists control_mode text not null default 'auto';

do $$
begin
  alter table public.actuator_commands
    add constraint actuator_commands_control_mode_check
    check (control_mode in ('auto', 'manual'));
exception
  when duplicate_object then null;
end $$;

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
    $2, $1, device, 1,
    temp, temp, temp,
    hum, hum, hum,
    gas, gas, gas,
    moist, moist, moist,
    mri, mri
  )
  on conflict on constraint sensor_rollups_bucket_kind_bucket_start_device_id_key
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

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.throttle_sensor_reading_insert()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if exists (
    select 1
    from public.sensor_readings
    where device_id = new.device_id
      and created_at >= new.created_at - interval '55 seconds'
    limit 1
  ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists current_sensor_readings_touch_updated_at on public.current_sensor_readings;
create trigger current_sensor_readings_touch_updated_at
  before insert or update on public.current_sensor_readings
  for each row
  execute function private.touch_updated_at();

drop trigger if exists actuator_commands_touch_updated_at on public.actuator_commands;
create trigger actuator_commands_touch_updated_at
  before insert or update on public.actuator_commands
  for each row
  execute function private.touch_updated_at();

drop trigger if exists sensor_readings_throttle_insert on public.sensor_readings;
create trigger sensor_readings_throttle_insert
  before insert on public.sensor_readings
  for each row
  execute function private.throttle_sensor_reading_insert();

create or replace function private.handle_sensor_reading_insert()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  alert_type text;
  alert_sensor text;
  alert_value float8;
  since timestamptz := now() - interval '10 minutes';
begin
  perform public.upsert_sensor_rollup(date_trunc('hour', new.created_at), 'hour', to_jsonb(new));
  perform public.upsert_sensor_rollup(date_trunc('day', new.created_at), 'day', to_jsonb(new));

  alert_sensor := case
    when new.temperature > 38 then 'temperature'
    when new.humidity > 85 then 'humidity'
    when new.gas_ppm > 400 then 'gas_ppm'
    when new.moisture > 80 then 'moisture'
    when new.temperature > 32 then 'temperature'
    when new.humidity > 70 then 'humidity'
    when new.gas_ppm > 200 then 'gas_ppm'
    when new.moisture > 60 then 'moisture'
    when new.mri_score >= 40 then 'mri_score'
    else null
  end;

  if alert_sensor is null then
    return new;
  end if;

  alert_type := case
    when new.risk_level = 'Critical' then 'Critical Mold Risk'
    when alert_sensor = 'mri_score' then 'Mold Risk Rising'
    else 'Threshold Exceeded'
  end;

  alert_value := case alert_sensor
    when 'temperature' then new.temperature
    when 'humidity' then new.humidity
    when 'gas_ppm' then new.gas_ppm
    when 'moisture' then new.moisture
    else new.mri_score
  end;

  if not exists (
    select 1
    from public.alerts
    where device_id = new.device_id
      and type = alert_type
      and sensor = alert_sensor
      and created_at >= since
  ) then
    insert into public.alerts (device_id, type, sensor, value, mri_score, risk_level)
    values (new.device_id, alert_type, alert_sensor, round(alert_value::numeric, 1), new.mri_score, new.risk_level);
  end if;

  return new;
end;
$$;

drop trigger if exists sensor_readings_after_insert on public.sensor_readings;
create trigger sensor_readings_after_insert
  after insert on public.sensor_readings
  for each row
  execute function private.handle_sensor_reading_insert();

alter table public.current_sensor_readings enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.alerts enable row level security;
alter table public.sensor_rollups enable row level security;
alter table public.actuator_commands enable row level security;

drop policy if exists "Public read current_sensor_readings" on public.current_sensor_readings;
drop policy if exists "Allow device insert current_sensor_readings" on public.current_sensor_readings;
drop policy if exists "Allow device update current_sensor_readings" on public.current_sensor_readings;
drop policy if exists "Public read sensor_readings" on public.sensor_readings;
drop policy if exists "Public read alerts" on public.alerts;
drop policy if exists "Public read sensor_rollups" on public.sensor_rollups;
drop policy if exists "Public read actuator_commands" on public.actuator_commands;
drop policy if exists "Allow public insert on sensor_readings" on public.sensor_readings;
drop policy if exists "Allow ESP32 sensor inserts" on public.sensor_readings;
drop policy if exists "Allow public read access on sensor_readings" on public.sensor_readings;
drop policy if exists "Allow web app sensor reads" on public.sensor_readings;
drop policy if exists "Allow device insert sensor_readings" on public.sensor_readings;
drop policy if exists "Allow public update on sensor_readings" on public.sensor_readings;
drop policy if exists "Allow public insert on alerts" on public.alerts;
drop policy if exists "Allow public read access on alerts" on public.alerts;
drop policy if exists "Allow dashboard insert actuator_commands" on public.actuator_commands;
drop policy if exists "Allow dashboard update actuator_commands" on public.actuator_commands;

create policy "Public read current_sensor_readings"
  on public.current_sensor_readings for select
  to anon, authenticated
  using (true);

create policy "Allow device insert current_sensor_readings"
  on public.current_sensor_readings for insert
  to anon
  with check (device_id = 'silo-1');

create policy "Allow device update current_sensor_readings"
  on public.current_sensor_readings for update
  to anon
  using (device_id = 'silo-1')
  with check (device_id = 'silo-1');

create policy "Public read sensor_readings"
  on public.sensor_readings for select
  to anon, authenticated
  using (true);

create policy "Allow device insert sensor_readings"
  on public.sensor_readings for insert
  to anon
  with check (device_id = 'silo-1');

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

create policy "Allow dashboard insert actuator_commands"
  on public.actuator_commands for insert
  to anon
  with check (device_id = 'silo-1');

create policy "Allow dashboard update actuator_commands"
  on public.actuator_commands for update
  to anon
  using (device_id = 'silo-1')
  with check (device_id = 'silo-1');

do $$
begin
  alter publication supabase_realtime add table public.current_sensor_readings;
exception
  when duplicate_object then null;
end $$;

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
grant select on public.current_sensor_readings, public.sensor_readings, public.alerts, public.sensor_rollups, public.actuator_commands to anon, authenticated;
grant insert, update on public.current_sensor_readings to anon;
grant insert on public.sensor_readings to anon;
grant insert, update on public.actuator_commands to anon;
grant usage, select on all sequences in schema public to anon;
revoke execute on function public.upsert_sensor_rollup(timestamptz, text, jsonb) from public, anon, authenticated;
revoke execute on function public.delete_old_sensor_readings() from public, anon, authenticated;
revoke execute on function private.touch_updated_at() from public, anon, authenticated;
revoke execute on function private.throttle_sensor_reading_insert() from public, anon, authenticated;
revoke execute on function private.handle_sensor_reading_insert() from public, anon, authenticated;
