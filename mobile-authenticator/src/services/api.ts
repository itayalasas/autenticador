type BaseCredentials = {
  baseUrl: string;
  application_id: string;
  api_key: string;
  email: string;
  password?: string;
  device_token?: string;
  device_id?: string;
  device_name?: string;
  push_token?: string;
  push_provider?: 'expo';
  device_platform?: string;
};

async function post(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

function normalizedBaseUrl(baseUrl: string) {
  return (baseUrl || '').trim().replace(/\/+$/, '');
}

export async function generatePairingToken(credentials: BaseCredentials) {
  return post(`${normalizedBaseUrl(credentials.baseUrl)}/functions/v1/mfa-generate-pairing-token`, credentials);
}

export async function registerDevice(input: {
  baseUrl: string;
  pairing_token?: string;
  pairing_code?: string;
  device_id: string;
  device_name?: string;
  push_token?: string;
  push_provider?: 'expo';
  device_platform?: string;
}) {
  return post(`${normalizedBaseUrl(input.baseUrl)}/functions/v1/mfa-register-device`, input);
}

export async function unlinkDevice(input: BaseCredentials & { device_id: string }) {
  return post(`${normalizedBaseUrl(input.baseUrl)}/functions/v1/mfa-unlink-device`, input);
}

export async function listPendingChallenges(credentials: BaseCredentials) {
  return post(`${normalizedBaseUrl(credentials.baseUrl)}/functions/v1/mfa-list-pending-challenges`, credentials);
}

export async function approveChallenge(input: BaseCredentials & {
  challenge_id: string;
  challenge_code: string;
  verification_number?: string;
  action?: 'approve' | 'reject';
}) {
  return post(`${normalizedBaseUrl(input.baseUrl)}/functions/v1/mfa-approve-challenge`, input);
}

export async function checkChallenge(input: {
  baseUrl: string;
  challenge_id: string;
  application_id: string;
}) {
  return post(`${normalizedBaseUrl(input.baseUrl)}/functions/v1/mfa-check-challenge`, input);
}

export async function sendEmail(input: {
  baseUrl: string;
  to: string;
  subject: string;
  html: string;
  application_id?: string;
  app_user_id?: string;
}) {
  return post(`${normalizedBaseUrl(input.baseUrl)}/functions/v1/send-email`, input);
}

export async function getAccountSecurityOverview(input: BaseCredentials & {
  device_id?: string;
  device_name?: string;
  device_platform?: string;
}) {
  return post(`${normalizedBaseUrl(input.baseUrl)}/functions/v1/mfa-account-security`, {
    ...input,
    action: 'overview',
  });
}

export async function revokeAccountDevice(input: BaseCredentials & {
  target_device_id: string;
  device_id?: string;
  device_name?: string;
  device_platform?: string;
}) {
  return post(`${normalizedBaseUrl(input.baseUrl)}/functions/v1/mfa-account-security`, {
    ...input,
    action: 'revoke_device',
  });
}

export async function resetAccountSecurity(input: BaseCredentials & {
  device_id?: string;
  device_name?: string;
  device_platform?: string;
}) {
  return post(`${normalizedBaseUrl(input.baseUrl)}/functions/v1/mfa-account-security`, {
    ...input,
    action: 'reset_security',
  });
}

export async function createPasskeyInvite(input: BaseCredentials & {
  device_name?: string;
}) {
  return post(`${normalizedBaseUrl(input.baseUrl)}/functions/v1/passkey-invite`, input);
}
