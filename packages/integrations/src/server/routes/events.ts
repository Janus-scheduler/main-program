import { Router, type Request, type Response } from "express";
import {
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
} from "../services/googleService.js";
import { getCalendarState } from "../services/calendarService.js";

/**
 * Extracts the HTTP status from a googleapis (Gaxios) error, if present.
 * Gaxios puts it on `.code` (number, sometimes string) and `.response.status`.
 */
function getGoogleErrorStatus(err: unknown): number | undefined {
  const e = err as { code?: unknown; response?: { status?: unknown } };
  const raw = e?.response?.status ?? e?.code;
  const status = typeof raw === "string" ? Number(raw) : raw;
  return typeof status === "number" && Number.isFinite(status)
    ? status
    : undefined;
}

async function getCalendarId(res: Response): Promise<string | null> {
  const state = await getCalendarState();
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
    const calendarId = await getCalendarId(res);
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
    const calendarId = await getCalendarId(res);
    if (!calendarId) return;

    try {
      await updateGoogleEvent(
        calendarId,
        req.params.googleEventId as string,
        req.body,
        config.clientId,
        config.clientSecret,
        config.redirectUri,
      );
      res.json({ updated: true });
    } catch (err) {
      const status = getGoogleErrorStatus(err);
      if (status === 404 || status === 410) {
        console.warn(
          `[Events] Update warning: Event ${req.params.googleEventId} not found in Google`,
        );
        res
          .status(status)
          .json({ error: "Event not found in Google Calendar" });
        return;
      }
      console.error("[Events] Update error:", err);
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  // Delete event from Google Calendar
  router.delete("/:googleEventId", async (req: Request, res: Response) => {
    const calendarId = await getCalendarId(res);
    if (!calendarId) return;

    try {
      await deleteGoogleEvent(
        calendarId,
        req.params.googleEventId as string,
        config.clientId,
        config.clientSecret,
        config.redirectUri,
      );
      res.json({ deleted: true });
    } catch (err) {
      // A 404/410 from Google means the event is already gone — surface that
      // status so the client can treat the delete as a success (idempotent)
      // rather than the caller rolling back and resurrecting the local event.
      const status = getGoogleErrorStatus(err);
      if (status === 404 || status === 410) {
        res
          .status(status)
          .json({ error: "Event not found in Google Calendar" });
        return;
      }
      console.error("[Events] Delete error:", err);
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  return router;
}
