import { Router, type Request, type Response } from "express";
import {
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
} from "../services/googleService.js";
import { getCalendarState } from "../services/calendarService.js";

function getCalendarId(res: Response): string | null {
  const state = getCalendarState();
  if (!state) {
    res.status(400).json({ error: "Not connected to Google Calendar" });
    return null;
  }
  return state.janusCalendarId;
}

export function createEventsRouter(config: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const router = Router();

  // Create event in Google Calendar
  router.post("/", async (req: Request, res: Response) => {
    const calendarId = getCalendarId(res);
    if (!calendarId) return;

    try {
      const googleEventId = await createGoogleEvent(
        calendarId,
        req.body,
        config.clientId,
        config.clientSecret,
        config.redirectUri,
      );
      res.json({ googleEventId });
    } catch (err) {
      console.error("'[Events] Create error:'", err);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  // Update event in Google Calendar
  router.patch("/:googleEventId", async (req: Request, res: Response) => {
    const calendarId = getCalendarId(res);
    if (!calendarId) return;

    try {
      await updateGoogleEvent(
        calendarId,
        req.params.googleEventId,
        req.body,
        config.clientId,
        config.clientSecret,
        config.redirectUri,
      );
      res.json({ updated: true });
    } catch (err) {
      console.error("[Events] Update error:", err);
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  // Delete event from Google Calendar
  router.delete("/:googleEventId", async (req: Request, res: Response) => {
    const calendarId = getCalendarId(res);
    if (!calendarId) return;

    try {
      await deleteGoogleEvent(
        calendarId,
        req.params.googleEventId,
        config.clientId,
        config.clientSecret,
        config.redirectUri,
      );
      res.json({ deleted: true });
    } catch (err) {
      console.error("[Events] Delete error:", err);
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  return router;
}
