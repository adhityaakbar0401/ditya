import { isClientSupabaseConfigured } from './supabase';
import { executeSupabaseFallback } from './supabaseFallback';

const TOKEN_KEY = 'smk_prima_unggul_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      headers,
    });
  } catch {
    if (isClientSupabaseConfigured) {
      return (await executeSupabaseFallback(path, options, token)) as T;
    }
    throw new Error('Tidak dapat terhubung ke server API. Periksa koneksi atau konfigurasi server.');
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    if ((res.status === 404 || res.status >= 500) && !data) {
      if (isClientSupabaseConfigured) {
        return (await executeSupabaseFallback(path, options, token)) as T;
      }
      throw new Error(
        `Endpoint server (${path}) tidak merespons (${res.status}). Pastikan Environment Variables Supabase (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) sudah ditambahkan di Vercel lalu Redeploy.`
      );
    }
    const errMsg =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Terjadi kesalahan (${res.status})`;
    throw new Error(errMsg);
  }

  return data as T;
}
