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

// ── Renew Google webhook every 6 days ────────────────────────────────────────
// Google webhook channels expire after 7 days maximum.
cron.schedule("0 0 */6 * *", async () => {
  console.log("[Janus] Renewing webhook channel...");
  try {
    if (!isConnected()) return;

    const state = getCalendarState();
    if (!state) return;

    await stopWebhook(
      state.webhookChannelId,
      state.webhookResourceId,
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    );

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

    console.log("[Janus] Webhook renewed successfully");
  } catch (err) {
    console.error("[Janus] Webhook renewal failed:", err);
  }
});

server.listen(config.port, () => {
  console.log(`[Janus] Backend running on http://localhost:${config.port}`);
  console.log(`[Janus] WebSocket ready on ws://localhost:${config.port}`);
});
