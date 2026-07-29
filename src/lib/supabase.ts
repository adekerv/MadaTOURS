import { createClient } from '@supabase/supabase-js';

const meta = import.meta as any;

const getSupabaseUrl = () => {
  return (
    meta?.env?.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://xyzplaceholder.supabase.co'
  );
};

const getSupabaseAnonKey = () => {
  return (
    meta?.env?.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'placeholder-anon-key'
  );
};

export const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());

