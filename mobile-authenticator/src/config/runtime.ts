import Constants from 'expo-constants';

const FALLBACK_SUPABASE_URL = 'https://sfqtmnncgiqkveaoqckt.supabase.co';

export function getDefaultSupabaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const extraUrl = Constants.expoConfig?.extra?.supabaseUrl;

  return String(envUrl || extraUrl || FALLBACK_SUPABASE_URL).trim().replace(/\/+$/, '');
}
