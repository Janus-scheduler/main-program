// ── Google Calendar attendee ──────────────────────────────────────────────────
export interface GoogleAttendee {
  email: string;
}

// ── Google Calendar event format ──────────────────────────────────────────────
export interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  status?: string;
  attendees?: GoogleAttendee[];
  /** iCalendar RRULE/EXRULE/RDATE/EXDATE lines, e.g. ["RRULE:FREQ=WEEKLY;COUNT=5"]. */
  recurrence?: string[];
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
}

// ── Config passed by the developer ───────────────────────────────────────────
export interface JanusGoogleConfig {
  /**
   * Base URL of the backend server.
   * For the reference backend: 'http://localhost:3001'
   * For production: your deployed backend URL
   */
  backendUrl: string;
}

// ── WebSocket message shape broadcast by the backend ─────────────────────────
export interface WebSocketMessage {
  type: "upserted" | "deleted";
  event: GoogleCalendarEvent;
}

// ── Token data stored in JSON file ───────────────────────────────────────────
export interface TokenData {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

// ── Calendar state stored in JSON file ───────────────────────────────────────
export interface CalendarState {
  janusCalendarId: string;
  syncToken: string;
  webhookChannelId: string;
  webhookResourceId: string;
  webhookExpiration: string;
}
