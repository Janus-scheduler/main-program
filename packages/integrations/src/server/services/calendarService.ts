import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { getValidToken } from "./tokenService.js";
import type { CalendarState } from "../../types/index.js";

const STATE_FILE = path.join(process.cwd(), "janus-calendar-state.json");

export function getCalendarState(): CalendarState | null {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as CalendarState;
  } catch {
    return null;
  }
}

export function saveCalendarState(state: CalendarState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export function clearCalendarState(): void {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}

function buildCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * Finds the existing "Janus Scheduler" calendar or creates it.
 * Returns the calendar ID.
 */
export async function getOrCreateJanusCalendar(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<string> {
  const token = await getValidToken(clientId, clientSecret, redirectUri);
  const calendar = buildCalendarClient(token);

  const listResponse = await calendar.calendarList.list();
  const existing = listResponse.data.items?.find(
    (cal) => cal.summary === "Janus Scheduler",
  );

  if (existing?.id) return existing.id;

  const created = await calendar.calendars.insert({
    requestBody: {
      summary: "Janus Scheduler",
      description: "Events managed by Janus Scheduler",
      timeZone: "UTC",
    },
  });

  return created.data.id!;
}

/**
 * Gets the initial sync token by doing an empty list call.
 * Used after first connect so we only track future changes.
 */
export async function getInitialSyncToken(
  calendarId: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<string> {
  const token = await getValidToken(clientId, clientSecret, redirectUri);
  const calendar = buildCalendarClient(token);

  const response = await calendar.events.list({
    calendarId,
    maxResults: 1,
  });

  return response.data.nextSyncToken!;
}
