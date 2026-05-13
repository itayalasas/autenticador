import { getSupabaseAnonKey, getSupabaseUrl } from '../lib/supabaseRuntime';

function buildHeaders() {
  const anonKey = getSupabaseAnonKey();

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${anonKey}`,
    'apikey': anonKey,
    'X-Client-Info': 'authsystem-passkey-setup/1.0',
  };
}

async function post(endpoint: string, body: Record<string, unknown>) {
  const response = await fetch(`${getSupabaseUrl().replace(/\/+$/, '')}/functions/v1/${endpoint}`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!text) {
    return {
      success: false,
      error: { message: `Respuesta vacía del servidor (${response.status})` },
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: { message: `Respuesta inválida del servidor (${response.status})` },
    };
  }
}

export async function startPasskeySetup(input: {
  token: string;
  application_id: string;
}) {
  return post('passkey-setup-start', input);
}

export async function completePasskeySetup(input: {
  token: string;
  application_id: string;
  credential: any;
}) {
  return post('passkey-setup-complete', input);
}
