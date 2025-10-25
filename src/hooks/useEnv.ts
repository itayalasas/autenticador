import { getEnvVariable } from '../services/envConfigService';

export function useEnv(key: string): string {
  return getEnvVariable(key);
}

export function useSupabaseUrl(): string {
  return getEnvVariable('VITE_SUPABASE_URL');
}

export function useSupabaseAnonKey(): string {
  return getEnvVariable('VITE_SUPABASE_ANON_KEY');
}

export function useDLocalCheckoutUrl(): string {
  return getEnvVariable('VITE_DLOCAL_CHECKOUT_URL') || 'https://checkout-sbx.dlocalgo.com';
}

export function useNetlifyAccessToken(): string {
  return getEnvVariable('VITE_NETLIFY_ACCESS_TOKEN');
}
