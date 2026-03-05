import { getEnvVariable } from '../services/envConfigService';

function resolveEnvValue(key: string): string {
  const runtimeValue = getEnvVariable(key);
  const buildValue = (import.meta.env[key] as string | undefined) || '';
  return (runtimeValue || buildValue || '').trim();
}

export function getSupabaseUrl(): string {
  return resolveEnvValue('VITE_SUPABASE_URL').replace(/\/+$/, '');
}

export function getSupabaseAnonKey(): string {
  return resolveEnvValue('VITE_SUPABASE_ANON_KEY');
}

export function requireSupabaseUrl(): string {
  const url = getSupabaseUrl();

  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error('VITE_SUPABASE_URL no está configurada correctamente');
  }

  return url;
}

export function requireSupabaseAnonKey(): string {
  const anonKey = getSupabaseAnonKey();

  if (!anonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY no está configurada correctamente');
  }

  return anonKey;
}
