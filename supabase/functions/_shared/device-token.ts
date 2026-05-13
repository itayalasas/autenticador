export function normalizeDeviceToken(value?: string | null): string {
  return (value || '').trim();
}

export function generateDeviceToken(): string {
  return crypto.randomUUID();
}

export async function hashDeviceToken(value: string): Promise<string> {
  const normalized = normalizeDeviceToken(value);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
