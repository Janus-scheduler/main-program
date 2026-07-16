import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import type { TokenData } from "../../types/index.js";

// Store tokens next to where the server process runs
const TOKEN_FILE = path.join(process.cwd(), "janus-tokens.json");

function readTokens(): TokenData | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const raw = fs.readFileSync(TOKEN_FILE, "utf-8");
    return JSON.parse(raw) as TokenData;
  } catch {
    return null;
  }
}

function writeTokens(tokens: TokenData): void {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), "utf-8");
}

export function saveTokens(tokens: TokenData): void {
  writeTokens(tokens);
}

export function isConnected(): boolean {
  return readTokens() !== null;
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

  // Refresh
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  );
  oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });

  const { credentials } = await oauth2Client.refreshAccessToken();

  const refreshed: TokenData = {
    access_token: credentials.access_token!,
    refresh_token: tokens.refresh_token, // refresh_token does not rotate
    expiry_date: credentials.expiry_date!,
  };

  writeTokens(refreshed);
  return refreshed.access_token;
}

export function clearTokens(): void {
  if (fs.existsSync(TOKEN_FILE)) {
    fs.unlinkSync(TOKEN_FILE);
  }
}
