import { Router, type Request, type Response } from "express";
import type { JanusWebSocketHub } from "../websocket.js";
import {
  getCalendarState,
  saveCalendarState,
} from "../services/calendarService.js";
import { fetchChanges } from "../services/googleService.js";

export function createWebhookRouter(
  config: {
    channelToken: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  },
  wsHub: JanusWebSocketHub,
) {
  const router = Router();

  router.post("/google", async (req: Request, res: Response) => {
    // Always respond 200 immediately — Google requires a fast response
    res.status(200).send();

    // Verify this came from our registered Google channel
    const channelToken = req.headers["x-goog-channel-token"];
    if (channelToken !== config.channelToken) {
      console.warn("'[Webhook] Invalid channel token — ignoring request'");
      return;
    }

    const resourceState = req.headers["x-goog-resource-state"];

    // 'sync' = Google confirming channel registration — nothing to process
    if (resourceState === "sync") {
      console.log("[Webhook] Sync confirmation received");
    }

    try {
      const state = await getCalendarState();
      if (!state) return;

      const { events, newSyncToken } = await fetchChanges(
        state.janusCalendarId,
        state.syncToken,
        config.clientId,
        config.clientSecret,
        config.redirectUri,
      );

      // Save new sync token for next incremental fetch
      await saveCalendarState({ ...state, syncToken: newSyncToken });

      // Broadcast each changed event to connected frontend clients
      for (const event of events) {
        wsHub.broadcast({
          type: event.status === "cancelled" ? "deleted" : "upserted",
          event,
        });
      }
    } catch (err) {
      console.error("[Webhook] Error processing notification:", err);
    }
  });

  return router;
}
