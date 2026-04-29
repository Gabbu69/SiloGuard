import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '[SiloGuard] Supabase credentials not found. Running in DEMO mode. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file for live data.'
  );
}

export interface SensorReading {
  id: number;
  created_at: string;
  temperature: number;
  humidity: number;
  gas_ppm: number;
  moisture: number;
  fan_on: boolean;
  buzzer_on: boolean;
}

export interface Alert {
  id: number;
  created_at: string;
  type: string;
  sensor: string;
  value: number;
  mri_score: number;
}

// Create client only if configured, otherwise use a dummy placeholder
// The app will detect isSupabaseConfigured and run in demo mode
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');
