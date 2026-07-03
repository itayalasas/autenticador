export type PkceCodeChallengeMethod = 'S256' | 'plain';

const PKCE_VALUE_REGEX = /^[A-Za-z0-9\-._~]+$/;

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function normalizePkceCodeChallengeMethod(raw: unknown): PkceCodeChallengeMethod | null {
  const normalized = String(raw || '').trim();
  if (normalized === 'S256' || normalized.toLowerCase() === 's256') return 'S256';
  if (normalized === 'plain') return 'plain';
  return null;
}

export function isValidPkceValue(raw: unknown, minLength = 43, maxLength = 128): boolean {
  const value = String(raw || '').trim();
  if (!value) return false;
  if (value.length < minLength || value.length > maxLength) return false;
  return PKCE_VALUE_REGEX.test(value);
}

export async function derivePkceCodeChallenge(
  codeVerifier: string,
  method: PkceCodeChallengeMethod,
): Promise<string> {
  if (method === 'plain') {
    return codeVerifier;
  }

  const encoded = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return base64UrlEncode(digest);
}

export async function verifyPkceCodeVerifier(options: {
  codeVerifier: string;
  expectedCodeChallenge: string;
  method: PkceCodeChallengeMethod;
}): Promise<boolean> {
  const derivedCodeChallenge = await derivePkceCodeChallenge(options.codeVerifier, options.method);
  return derivedCodeChallenge === options.expectedCodeChallenge;
}
