import { google } from "googleapis";
import { getValidToken } from "./tokenService.js";
import type { GoogleCalendarEvent } from "../../types/index.js";

function buildCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

async function getCalendar(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
) {
  const token = await getValidToken(clientId, clientSecret, redirectUri);
  return buildCalendarClient(token);
}

export async function createGoogleEvent(
  calendarId: string,
  event: GoogleCalendarEvent,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<string> {
  const calendar = await getCalendar(clientId, clientSecret, redirectUri);
  // sendUpdates:"all" — for personal Gmail attendees, Google does not honor
  // an organizer-set responseStatus and ignores silent (sendUpdates:"none")
  // invites entirely: the attendee never even sees a pending invite. Sending
  // the real notification is the only way they actually get the event.
  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
    sendUpdates: "all",
  });
  return response.data.id!;
}

export async function updateGoogleEvent(
  calendarId: string,
  googleEventId: string,
  event: GoogleCalendarEvent,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<void> {
  const calendar = await getCalendar(clientId, clientSecret, redirectUri);
  await calendar.events.patch({
    calendarId,
    eventId: googleEventId,
    requestBody: event,
    sendUpdates: "all",
  });
}

export async function deleteGoogleEvent(
  calendarId: string,
  googleEventId: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<void> {
  const calendar = await getCalendar(clientId, clientSecret, redirectUri);
  await calendar.events.delete({
    calendarId,
    eventId: googleEventId,
  });
}

export async function fetchAllEvents(
  calendarId: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<GoogleCalendarEvent[]> {
  const calendar = await getCalendar(clientId, clientSecret, redirectUri);
  const response = await calendar.events.list({
    calendarId,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });
  return (response.data.items || []) as GoogleCalendarEvent[];
}

export async function fetchChanges(
  calendarId: string,
  syncToken: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ events: GoogleCalendarEvent[]; newSyncToken: string }> {
  const calendar = await getCalendar(clientId, clientSecret, redirectUri);
  const response = await calendar.events.list({
    calendarId,
    syncToken,
  });
  return {
    events: (response.data.items || []) as GoogleCalendarEvent[],
    newSyncToken: response.data.nextSyncToken!,
  };
}

export async function registerWebhook(
  calendarId: string,
  webhookUrl: string,
  channelToken: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ channelId: string; resourceId: string; expiration: string }> {
  const calendar = await getCalendar(clientId, clientSecret, redirectUri);
  const { v4: uuidv4 } = await import("uuid");

  const response = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: uuidv4(),
      type: "web_hook",
      address: webhookUrl,
      token: channelToken,
    },
  });

  return {
    channelId: response.data.id!,
    resourceId: response.data.resourceId!,
    expiration: response.data.expiration!,
  };
}

export async function stopWebhook(
  channelId: string,
  resourceId: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<void> {
  const calendar = await getCalendar(clientId, clientSecret, redirectUri);
  await calendar.channels.stop({
    requestBody: { id: channelId, resourceId },
  });
}
