import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) || '').trim();
const supabaseAnonKey = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '').trim();

function isValidHttpUrl(val: string): boolean {
  if (!val) return false;
  if (val.includes('your-project') || val.includes('your-supabase') || val.includes('MY_')) return false;
  try {
    const parsed = new URL(val);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isConfiguredKey(val: string): boolean {
  if (!val) return false;
  if (val.includes('your-project') || val.includes('your-supabase') || val.includes('MY_')) return false;
  return val.length > 10;
}

export const isClientSupabaseConfigured =
  isValidHttpUrl(supabaseUrl) && isConfiguredKey(supabaseAnonKey);

function createSafeSupabaseClient(): SupabaseClient | null {
  if (!isClientSupabaseConfigured) {
    return null;
  }
  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch {
    return null;
  }
}

export const supabaseClient: SupabaseClient | null = createSafeSupabaseClient();

export function createAuthedSupabaseClient(token?: string | null): SupabaseClient | null {
  if (!isClientSupabaseConfigured) return null;
  if (!token) return supabaseClient;
  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  } catch {
    return supabaseClient;
  }
}
