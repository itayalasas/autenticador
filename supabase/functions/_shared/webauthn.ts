export function getOriginAndRpId(authUrl: string) {
  const normalized = (authUrl || '').trim();

  if (!normalized) {
    throw new Error('auth_url is required');
  }

  const url = new URL(normalized);

  return {
    origin: url.origin,
    rpId: url.hostname,
  };
}

export function bytesToBase64Url(value: Uint8Array | ArrayBuffer) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
