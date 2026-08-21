import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { google } from "googleapis";
import type { TokenData } from "../../types/index.js";

// Store tokens next to where the server process runs
const TOKEN_FILE = path.join(process.cwd(), "janus-tokens.json");

interface EncryptedEnvelope {
  iv: string;
  tag: string;
  data: string;
}

// TOKEN_ENCRYPTION_KEY can be any passphrase — hashing it to 32 bytes means
// it doesn't need to be a precisely-formatted key, just kept secret.
function getEncryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY environment variable is required to store Google tokens.",
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(plaintext: string): EncryptedEnvelope {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const data = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  return {
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    data: data.toString("hex"),
  };
}

function decrypt(envelope: EncryptedEnvelope): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(envelope.iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "hex"));
  const data = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, "hex")),
    decipher.final(),
  ]);
  return data.toString("utf-8");
}

function readTokens(): TokenData | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const raw = fs.readFileSync(TOKEN_FILE, "utf-8");
    const envelope = JSON.parse(raw) as EncryptedEnvelope;
    return JSON.parse(decrypt(envelope)) as TokenData;
  } catch {
    // Covers a missing/corrupt file, a wrong/rotated encryption key, and a
    // plaintext file left over from before encryption was added — all
    // treated the same way as "not connected," prompting a clean reconnect.
    return null;
  }
}

function writeTokens(tokens: TokenData): void {
  const envelope = encrypt(JSON.stringify(tokens));
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(envelope, null, 2), "utf-8");
}

// Google's canonical OAuth2 error code for a refresh token that's been
// revoked, expired from disuse, or otherwise permanently invalidated — as
// opposed to a transient failure (network blip, 5xx) that's worth retrying.
function isInvalidGrantError(err: unknown): boolean {
  const data = (err as { response?: { data?: { error?: string } } })?.response
    ?.data;
  if (data?.error === "invalid_grant") return true;
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("invalid_grant");
}

export function saveTokens(tokens: TokenData): void {
  writeTokens(tokens);
}

export function isConnected(): boolean {
  return readTokens() !== null;
}

// Shared by concurrent getValidToken() callers so a burst of calls around the
// same expiry moment (e.g. several pushes during initial sync) joins one
// in-flight refresh instead of each firing its own redundant call to Google.
let refreshPromise: Promise<string> | null = null;

async function refreshTokens(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  currentRefreshToken: string,
): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  );
  oauth2Client.setCredentials({ refresh_token: currentRefreshToken });

  const credentials = await oauth2Client.refreshAccessToken().then(
    (result) => result.credentials,
    (err: unknown) => {
      if (isInvalidGrantError(err)) {
        // This connection can never recover on its own — clear local state
        // so isConnected() correctly reports "disconnected" instead of
        // getting stuck silently retrying a refresh that will never succeed.
        clearTokens();
      }
      throw err;
    },
  );

  const refreshed: TokenData = {
    access_token: credentials.access_token!,
    refresh_token: currentRefreshToken, // refresh_token does not rotate
    expiry_date: credentials.expiry_date!,
  };

  writeTokens(refreshed);
  return refreshed.access_token;
}

/**
 * Returns a valid access token.
 * Auto-refreshes using the refresh token if the access token
 * is within 5 minutes of expiry.
 */
export async function getValidToken(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<string> {
  const tokens = readTokens();
  if (!tokens) throw new Error("No tokens found. User not connected.");

  const fiveMinutesMs = 5 * 60 * 1000;
  const isExpiringSoon = tokens.expiry_date - Date.now() < fiveMinutesMs;

  if (!isExpiringSoon) {
    return tokens.access_token;
  }

  if (!refreshPromise) {
    refreshPromise = refreshTokens(
      clientId,
      clientSecret,
      redirectUri,
      tokens.refresh_token,
    ).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export function clearTokens(): void {
  if (fs.existsSync(TOKEN_FILE)) {
    fs.unlinkSync(TOKEN_FILE);
  }
}
