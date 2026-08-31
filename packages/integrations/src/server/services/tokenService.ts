import { google } from "googleapis";
import type { TokenData } from "../../types/index.js";
import type { TokenStore } from "../stores/types.js";
import { FileTokenStore } from "../stores/FileTokenStore.js";

// The token store is a module-level default so existing call sites keep their
// signatures. `createJanusApp` swaps it via setTokenStore() when the host
// supplies their own. This is single-tenant by design — one token set per
// process; a multi-tenant host implements TokenStore against their own DB.
let tokenStore: TokenStore = new FileTokenStore();

/** Replace the token store (called by createJanusApp before routers are mounted). */
export function setTokenStore(store: TokenStore): void {
  tokenStore = store;
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

export async function saveTokens(tokens: TokenData): Promise<void> {
  await tokenStore.set(tokens);
}

export async function isConnected(): Promise<boolean> {
  return (await tokenStore.get()) !== null;
}

export async function clearTokens(): Promise<void> {
  await tokenStore.clear();
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
    async (err: unknown) => {
      if (isInvalidGrantError(err)) {
        // This connection can never recover on its own — clear local state
        // so isConnected() correctly reports "disconnected" instead of
        // getting stuck silently retrying a refresh that will never succeed.
        await clearTokens();
      }
      throw err;
    },
  );

  const refreshed: TokenData = {
    access_token: credentials.access_token!,
    refresh_token: currentRefreshToken, // refresh_token does not rotate
    expiry_date: credentials.expiry_date!,
  };

  await tokenStore.set(refreshed);
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
  const tokens = await tokenStore.get();
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
