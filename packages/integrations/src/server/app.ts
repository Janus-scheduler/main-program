import express, { type Express } from "express";
import cors from "cors";
import { createAuthRouter } from "./routes/auth.js";
import { createEventsRouter } from "./routes/events.js";
import { createWebhookRouter } from "./routes/webhook.js";
import { JanusWebSocketHub } from "./websocket.js";
import { setTokenStore } from "./services/tokenService.js";
import { setCalendarStateStore } from "./services/calendarService.js";
import type { TokenStore, CalendarStateStore } from "./stores/types.js";

export interface JanusServerConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  frontendUrl: string;
  webhookUrl: string;
  channelToken: string;
  port?: number;
  /**
   * Where to persist the Google OAuth tokens. Defaults to an encrypted
   * `janus-tokens.json` in the process working directory. Supply your own
   * implementation for a database-backed / multi-tenant deployment.
   */
  tokenStore?: TokenStore;
  /** Where to persist the calendar bootstrap state. Defaults to a JSON file in cwd. */
  calendarStateStore?: CalendarStateStore;
}

export interface JanusApp {
  app: Express;
  /** Bind this to the HTTP server once it exists: `wsHub.attach(httpServer)`. */
  wsHub: JanusWebSocketHub;
}

export function createJanusApp(config: JanusServerConfig): JanusApp {
  if (config.tokenStore) setTokenStore(config.tokenStore);
  if (config.calendarStateStore)
    setCalendarStateStore(config.calendarStateStore);

  const app = express();
  const wsHub = new JanusWebSocketHub();

  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json());

  app.use("/auth", createAuthRouter(config));
  app.use("/events", createEventsRouter(config));
  app.use("/webhook", createWebhookRouter(config, wsHub));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "janus-integrations" });
  });

  return { app, wsHub };
}
