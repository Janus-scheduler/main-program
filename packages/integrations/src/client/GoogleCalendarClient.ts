import type { JanusGoogleConfig, GoogleCalendarEvent } from "../types/index.js";

export class GoogleCalendarClient {
  private readonly backendUrl: string;

  constructor(config: JanusGoogleConfig) {
    // Strip trailing slash for consistent URL building
    this.backendUrl = config.backendUrl.replace(/\/$/, "");
  }

  /** The backend base URL this client talks to (e.g. for constructing a matching WebSocket listener). */
  getBackendUrl(): string {
    return this.backendUrl;
  }

  /** Create event in Google Calendar via backend. Returns googleEventId. */
  async pushEvent(event: GoogleCalendarEvent): Promise<string> {
    const res = await fetch(`${this.backendUrl}/events`, {
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
    const res = await fetch(`${this.backendUrl}/events/${googleEventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!res.ok)
      throw new Error(`updateEvent failed: ${res.status} ${res.statusText}`);
  }

  /** Delete a Google Calendar event via backend. */
  async deleteEvent(googleEventId: string): Promise<void> {
    const res = await fetch(`${this.backendUrl}/events/${googleEventId}`, {
      method: "DELETE",
    });
    if (!res.ok)
      throw new Error(`deleteEvent failed: ${res.status} ${res.statusText}`);
  }

  /** Redirect the browser to the backend's OAuth start endpoint. */
  connect(): void {
    window.location.href = `${this.backendUrl}/auth/google`;
  }

  /** Tell the backend to disconnect (clears its stored tokens/calendar state). */
  async disconnect(): Promise<void> {
    const res = await fetch(`${this.backendUrl}/auth/disconnect`, {
      method: "POST",
    });
    if (!res.ok)
      throw new Error(`disconnect failed: ${res.status} ${res.statusText}`);
  }

  /** Check whether the user is connected to Google Calendar. */
  async isConnected(): Promise<boolean> {
    try {
      const res = await fetch(`${this.backendUrl}/auth/status`);
      const data = (await res.json()) as { connected: boolean };
      return data.connected;
    } catch {
      return false;
    }
  }

  /** Fetch all existing Google Calendar events (called once after OAuth). */
  async fetchInitialEvents(): Promise<GoogleCalendarEvent[]> {
    const res = await fetch(`${this.backendUrl}/auth/initial-events`);
    if (!res.ok) throw new Error(`fetchInitialEvents failed: ${res.status}`);
    const data = (await res.json()) as { events: GoogleCalendarEvent[] };
    return data.events;
  }
}
