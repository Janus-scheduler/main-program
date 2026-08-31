import { Router, type Request, type Response } from "express";
import { google } from "googleapis";
import {
  saveTokens,
  isConnected,
  clearTokens,
} from "../services/tokenService.js";
import {
  getOrCreateJanusCalendar,
  getInitialSyncToken,
  saveCalendarState,
  clearCalendarState,
  getCalendarState,
} from "../services/calendarService.js";
import {
  registerWebhook,
  stopWebhook,
  fetchAllEvents,
} from "../services/googleService.js";

export function createAuthRouter(config: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  frontendUrl: string;
  webhookUrl: string;
  channelToken: string;
}) {
  const router = Router();

  function buildOAuthClient() {
    return new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    );
  }

  // Redirect to Google consent screen
  router.get("/google", (_req: Request, res: Response) => {
    const url = buildOAuthClient().generateAuthUrl({
      access_type: "offline",
      prompt: "consent", // always get refresh_token
      scope: [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar",
      ],
    });
    res.redirect(url);
  });

  // Google redirects back with auth code
  router.get("/google/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string;
    if (!code) {
      res.redirect(`${config.frontendUrl}?google_connected=false`);
      return;
    }

    try {
      const { tokens } = await buildOAuthClient().getToken(code);

      // refresh_token is what makes this connection durable — without it,
      // getValidToken can never refresh once the access token expires. Fail
      // the connect attempt clearly here rather than silently persisting a
      // token file that will only break later, invisibly.
      if (
        !tokens.access_token ||
        !tokens.refresh_token ||
        !tokens.expiry_date
      ) {
        console.error(
          "[Auth] OAuth callback response missing required token fields",
        );
        res.redirect(`${config.frontendUrl}?google_connected=false`);
        return;
      }

      await saveTokens({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
      });

      // Get or create "Janus Scheduler" calendar
      const calendarId = await getOrCreateJanusCalendar(
        config.clientId,
        config.clientSecret,
        config.redirectUri,
      );

      // Get sync token baseline
      const syncToken = await getInitialSyncToken(
        calendarId,
        config.clientId,
        config.clientSecret,
        config.redirectUri,
      );

      // Register webhook with Google
      const webhook = await registerWebhook(
        calendarId,
        config.webhookUrl,
        config.channelToken,
        config.clientId,
        config.clientSecret,
        config.redirectUri,
      );

      await saveCalendarState({
        janusCalendarId: calendarId,
        syncToken,
        webhookChannelId: webhook.channelId,
        webhookResourceId: webhook.resourceId,
        webhookExpiration: webhook.expiration,
      });

      res.redirect(`${config.frontendUrl}?google_connected=true`);
    } catch (err) {
      console.error("[Auth] OAuth callback error:", err);
      res.redirect(`${config.frontendUrl}?google_connected=false`);
    }
  });

  // Check if connected.
  // "Connected" means fully ready to sync — a token alone isn't enough:
  // the calendar bootstrap (create calendar / sync token / webhook) runs as
  // a separate sequence of steps right after the token is saved, so there's
  // a window where a token exists but calendar state doesn't yet. Callers
  // (GoogleSyncManager's push hooks) use this check to decide whether to
  // push — if it reports "connected" too early, the push 400s and
  // SchedulerManager rolls back the local event.
  router.get("/status", async (_req: Request, res: Response) => {
    const [tokenPresent, calendarState] = await Promise.all([
      isConnected(),
      getCalendarState(),
    ]);
    res.json({ connected: tokenPresent && calendarState !== null });
  });

  // Fetch all current events (called after first connect)
  router.get("/initial-events", async (_req: Request, res: Response) => {
    try {
      const state = await getCalendarState();
      if (!state) {
        res.status(400).json({ error: "Not connected" });
        return;
      }
      const events = await fetchAllEvents(
        state.janusCalendarId,
        config.clientId,
        config.clientSecret,
        config.redirectUri,
      );
      res.json({ events });
    } catch (err) {
      console.error("[Auth] Initial events error:", err);
      res.status(500).json({ error: "Failed to fetch initial events " });
    }
  });

  // Disconnect
  router.post("/disconnect", async (_req: Request, res: Response) => {
    const state = await getCalendarState();
    if (state) {
      try {
        await stopWebhook(
          state.webhookChannelId,
          state.webhookResourceId,
          config.clientId,
          config.clientSecret,
          config.redirectUri,
        );
      } catch (err) {
        // Non-fatal — the channel may already be gone. Disconnect proceeds
        // either way; Google will let it lapse on its own if this fails.
        console.warn("[Auth] Failed to stop webhook on disconnect:", err);
      }
    }

    await Promise.all([clearTokens(), clearCalendarState()]);
    res.json({ disconnected: true });
  });

  return router;
}
