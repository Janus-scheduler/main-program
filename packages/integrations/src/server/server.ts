import http from "node:http";
import cron from "node-cron";
import dotenv from "dotenv";
import { createJanusApp } from "./app.js";
import { initWebSocket } from "./websocket.js";
import {
  getCalendarState,
  saveCalendarState,
} from "./services/calendarService.js";
import { registerWebhook, stopWebhook } from "./services/googleService.js";
import { isConnected } from "./services/tokenService.js";

dotenv.config();

// ── Validate required environment variables ───────────────────────────────────
const required = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "REDIRECT_URI",
  "FRONTEND_URL",
  "WEBHOOK_URL",
  "CHANNEL_TOKEN",
  "TOKEN_ENCRYPTION_KEY",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[Janus] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const config = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.REDIRECT_URI!,
  frontendUrl: process.env.FRONTEND_URL!,
  webhookUrl: process.env.WEBHOOK_URL!,
  channelToken: process.env.CHANNEL_TOKEN!,
  port: Number(process.env.PORT) || 3001,
};

const app = createJanusApp(config);
const server = http.createServer(app);

initWebSocket(server);

// ── Renew Google webhook before it expires ───────────────────────────────────
// Checks the channel's actual Google-assigned expiration (rather than blindly
// renewing on a fixed schedule) and only renews once it's within a day of
// expiring. Registers the replacement channel *before* stopping the old one:
// if registration fails, the old (still valid) channel is left untouched and
// state is left unchanged, so the next check simply retries — a transient
// failure can no longer permanently wedge renewal. Failing to stop the old
// channel afterward is non-fatal, since the new one is already active.
async function renewWebhookIfNeeded(): Promise<void> {
  try {
    if (!isConnected()) return;

    const state = getCalendarState();
    if (!state) return;

    const renewBufferMs = 24 * 60 * 60 * 1000;
    const expiresAt = Number(state.webhookExpiration);
    if (Number.isFinite(expiresAt) && expiresAt - Date.now() > renewBufferMs) {
      return;
    }

    console.log("[Janus] Renewing webhook channel...");

    const webhook = await registerWebhook(
      state.janusCalendarId,
      config.webhookUrl,
      config.channelToken,
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    );

    saveCalendarState({
      ...state,
      webhookChannelId: webhook.channelId,
      webhookResourceId: webhook.resourceId,
      webhookExpiration: webhook.expiration,
    });

    try {
      await stopWebhook(
        state.webhookChannelId,
        state.webhookResourceId,
        config.clientId,
        config.clientSecret,
        config.redirectUri,
      );
    } catch (err) {
      console.warn("[Janus] Failed to stop old webhook channel:", err);
    }

    console.log("[Janus] Webhook renewed successfully");
  } catch (err) {
    console.error("[Janus] Webhook renewal failed:", err);
  }
}

// Check once a day.
cron.schedule("0 0 * * *", renewWebhookIfNeeded);

server.listen(config.port, () => {
  console.log(`[Janus] Backend running on http://localhost:${config.port}`);
  console.log(`[Janus] WebSocket ready on ws://localhost:${config.port}`);

  // Check once at startup — catches channels that expired while the server
  // was down (the daily cron alone would otherwise wait for its next tick).
  // Fired after listen() so a slow/unreachable Google API can't delay the
  // server from accepting unrelated requests.
  void renewWebhookIfNeeded();
});
