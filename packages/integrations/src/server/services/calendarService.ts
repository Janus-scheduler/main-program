import { google } from "googleapis";
import { getValidToken } from "./tokenService.js";
import type { CalendarStateStore } from "../stores/types.js";
import { FileCalendarStateStore } from "../stores/FileCalendarStateStore.js";
import type { CalendarState } from "../../types/index.js";

// Module-level default so call sites keep their signatures; createJanusApp
// swaps it via setCalendarStateStore() when the host supplies their own.
let calendarStateStore: CalendarStateStore = new FileCalendarStateStore();

/** Replace the calendar-state store (called by createJanusApp before routers are mounted). */
export function setCalendarStateStore(store: CalendarStateStore): void {
  calendarStateStore = store;
}

export function getCalendarState(): Promise<CalendarState | null> {
  return calendarStateStore.get();
}

export function saveCalendarState(state: CalendarState): Promise<void> {
  return calendarStateStore.set(state);
}

export function clearCalendarState(): Promise<void> {
  return calendarStateStore.clear();
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
