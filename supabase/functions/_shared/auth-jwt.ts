import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

export interface AuthSessionClaims extends Record<string, unknown> {
  sub: string;
  app_id: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  type?: "access" | "refresh";
}

interface IssueAuthTokensOptions {
  accessTtlSeconds?: number;
  refreshTtlSeconds?: number;
}

const DEFAULT_ACCESS_TTL_SECONDS = 24 * 60 * 60;
const DEFAULT_REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

function removeUndefinedValues<T extends Record<string, unknown>>(value: T): T {
  return Object.entries(value).reduce((acc, [key, entryValue]) => {
    if (entryValue !== undefined) {
      acc[key] = entryValue;
    }
    return acc;
  }, {} as Record<string, unknown>) as T;
}

function generateRandomSecret(byteLength = 32): string {
  const buffer = new Uint8Array(byteLength);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function resolveFallbackJwtSecret(): string {
  return (
    Deno.env.get("AUTH_JWT_SECRET")
    || Deno.env.get("JWT_SECRET")
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || "authsystem-edge-jwt-secret-change-me"
  );
}

async function importHmacKey(jwtSecret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(jwtSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function resolveApplicationJwtSecret(
  supabase: any,
  applicationId: string,
  currentSecret?: string | null,
): Promise<string> {
  const normalizedCurrentSecret = typeof currentSecret === "string" ? currentSecret.trim() : "";
  if (normalizedCurrentSecret) {
    return normalizedCurrentSecret;
  }

  try {
    const { data: applicationRecord, error: selectError } = await supabase
      .from("applications")
      .select("id, jwt_secret")
      .eq("id", applicationId)
      .maybeSingle();

    if (!selectError) {
      const secretFromDb = typeof applicationRecord?.jwt_secret === "string"
        ? applicationRecord.jwt_secret.trim()
        : "";

      if (secretFromDb) {
        return secretFromDb;
      }

      const generatedSecret = generateRandomSecret();
      const { error: updateError } = await supabase
        .from("applications")
        .update({ jwt_secret: generatedSecret })
        .eq("id", applicationId);

      if (!updateError) {
        return generatedSecret;
      }

      console.warn("JWT secret fallback in use after update failure:", updateError);
    } else {
      console.warn("JWT secret fallback in use after select failure:", selectError);
    }
  } catch (error) {
    console.warn("JWT secret fallback in use after unexpected error:", error);
  }

  return resolveFallbackJwtSecret();
}

export async function issueAuthTokens(
  jwtSecret: string,
  baseClaims: Omit<AuthSessionClaims, "iat" | "exp" | "type"> & Record<string, unknown>,
  options: IssueAuthTokensOptions = {},
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessTtlSeconds = options.accessTtlSeconds ?? DEFAULT_ACCESS_TTL_SECONDS;
  const refreshTtlSeconds = options.refreshTtlSeconds ?? DEFAULT_REFRESH_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const key = await importHmacKey(jwtSecret);

  const accessClaims = removeUndefinedValues({
    ...baseClaims,
    type: "access",
    iat: now,
    exp: now + accessTtlSeconds,
  });

  const refreshClaims = removeUndefinedValues({
    ...baseClaims,
    type: "refresh",
    iat: now,
    exp: now + refreshTtlSeconds,
  });

  const accessToken = await create({ alg: "HS256", typ: "JWT" }, accessClaims, key);
  const refreshToken = await create({ alg: "HS256", typ: "JWT" }, refreshClaims, key);

  return { accessToken, refreshToken };
}

export async function verifyAuthToken(
  token: string,
  jwtSecret: string,
): Promise<AuthSessionClaims> {
  const key = await importHmacKey(jwtSecret);
  const verifiedPayload = await verify(token, key);

  const claims = Array.isArray(verifiedPayload) ? verifiedPayload[0] : verifiedPayload;
  return claims as AuthSessionClaims;
}
