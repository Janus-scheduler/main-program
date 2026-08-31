import type { JanusGoogleConfig, GoogleCalendarEvent } from "../types/index.js";

type FetchInit = Parameters<typeof fetch>[1];

export class GoogleCalendarClient {
  private readonly backendUrl: string;

  constructor(config: JanusGoogleConfig) {
    // Strip trailing slash for consistent URL building
    this.backendUrl = config.backendUrl.replace(/\/$/, "");
  }

  /**
   * `credentials: "include"` so a backend protected by the host's own
   * cookie/session auth receives the session on cross-origin calls. Harmless
   * when the backend is unauthenticated (the default) — the existing
   * `cors({ credentials: true })` config already permits it.
   */
  private fetch(path: string, init?: FetchInit): Promise<Response> {
    return fetch(`${this.backendUrl}${path}`, {
      credentials: "include",
      ...init,
    });
  }

  /** The backend base URL this client talks to (e.g. for constructing a matching WebSocket listener). */
  getBackendUrl(): string {
    return this.backendUrl;
  }

  /** Create event in Google Calendar via backend. Returns googleEventId. */
  async pushEvent(event: GoogleCalendarEvent): Promise<string> {
    const res = await this.fetch(`/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!res.ok)
      throw new Error(`pushEvent failed: ${res.status} ${res.statusText}`);
    const data = (await res.json()) as { googleEventId: string };
    return data.googleEventId;
  }

  /** Update an existing Google Calendar event via backend. */
  async updateEvent(
    googleEventId: string,
    event: GoogleCalendarEvent,
  ): Promise<void> {
    const res = await this.fetch(`/events/${googleEventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!res.ok)
      throw new Error(`updateEvent failed: ${res.status} ${res.statusText}`);
  }

  /** Delete a Google Calendar event via backend. */
  async deleteEvent(googleEventId: string): Promise<void> {
    const res = await this.fetch(`/events/${googleEventId}`, {
      method: "DELETE",
    });
    // 404 (Not Found) / 410 (Gone) mean the event is already absent from Google —
    // for a delete, that's the desired end state, not a failure. Treating it as
    // success lets the caller clear its local mapping instead of the delete being
    // rolled back (which would resurrect an event the user just removed).
    if (res.ok || res.status === 404 || res.status === 410) return;
    throw new Error(`deleteEvent failed: ${res.status} ${res.statusText}`);
  }

  /** Redirect the browser to the backend's OAuth start endpoint. */
  connect(): void {
    window.location.href = `${this.backendUrl}/auth/google`;
  }

  /** Tell the backend to disconnect (clears its stored tokens/calendar state). */
  async disconnect(): Promise<void> {
    const res = await this.fetch(`/auth/disconnect`, {
      method: "POST",
    });
    if (!res.ok)
      throw new Error(`disconnect failed: ${res.status} ${res.statusText}`);
  }

  /** Check whether the user is connected to Google Calendar. */
  async isConnected(): Promise<boolean> {
    try {
      const res = await this.fetch(`/auth/status`);
      const data = (await res.json()) as { connected: boolean };
      return data.connected;
    } catch {
      return false;
    }
  }

  /** Fetch all existing Google Calendar events (called once after OAuth). */
  async fetchInitialEvents(): Promise<GoogleCalendarEvent[]> {
    const res = await this.fetch(`/auth/initial-events`);
    if (!res.ok) throw new Error(`fetchInitialEvents failed: ${res.status}`);
    const data = (await res.json()) as { events: GoogleCalendarEvent[] };
    return data.events;
  }
}
