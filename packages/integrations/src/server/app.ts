import express from "express";
import cors from "cors";
import { createAuthRouter } from "./routes/auth.js";
import { createEventsRouter } from "./routes/events.js";
import { createWebhookRouter } from "./routes/webhook.js";

export interface JanusServerConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  frontendUrl: string;
  webhookUrl: string;
  channelToken: string;
  port?: number;
}

export function createJanusApp(config: JanusServerConfig) {
  const app = express();

  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json());

  app.use("/auth", createAuthRouter(config));
  app.use("/events", createEventsRouter(config));
  app.use("/webhook", createWebhookRouter(config));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "janus-integrations" });
  });

  return app;
}
