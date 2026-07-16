import {
  schedulerStore,
  type SchedulerManager,
  type EventData,
} from "@janus-scheduler/core";
//import type { EventData } from '@janus-scheduler/core'
import { GoogleCalendarClient } from "../client/GoogleCalendarClient.js";
import { GoogleEventMapper } from "../mapper/GoogleEventMapper.js";
import type { WebSocketMessage, GoogleCalendarEvent } from "../types/index.js";

export class GoogleSyncManager {
  private readonly client: GoogleCalendarClient;
  private readonly mapper: GoogleEventMapper;
  private isGoogleConnected = false;

  // Call this from App.tsx after OAuth completes
  setConnected(value: boolean): void {
    this.isGoogleConnected = value;
  }

  // janusId → googleId
  private readonly mappingTable = new Map<string, string>();
  // googleId → janusId
  private readonly reverseTable = new Map<string, string>();
  /**
   * janusIds that originated from Google.
   * When these appear in onEventAdd/Update/Delete hooks,
   * we skip pushing them back to Google to prevent sync loops.
   */
  private readonly googleSourceIds = new Set<string>();
  // janusId → the resourceIds it was assigned to in Janus (so a reload
  // can restore it under the right resource instead of "google-calendar")
  private readonly resourceIdsTable = new Map<string, string[]>();

  private static readonly STORAGE_KEY = "janus-google-sync-map";

  constructor(client: GoogleCalendarClient, mapper: GoogleEventMapper) {
    this.client = client;
    this.mapper = mapper;
    this.loadPersistedMapping();
  }

  private loadPersistedMapping(): void {
    try {
      const raw = localStorage.getItem(GoogleSyncManager.STORAGE_KEY);
      if (!raw) return;
      const entries = JSON.parse(raw) as Array<{
        janusId: string;
        googleId: string;
        resourceIds: string[];
      }>;
      for (const e of entries) {
        this.mappingTable.set(e.janusId, e.googleId);
        this.reverseTable.set(e.googleId, e.janusId);
        this.resourceIdsTable.set(e.janusId, e.resourceIds);
      }
    } catch (err) {
      console.error(
        "[Janus Integrations] Failed to load persisted mapping:",
        err,
      );
    }
  }

  private persistMapping(): void {
    try {
      const entries = Array.from(this.mappingTable.entries()).map(
        ([janusId, googleId]) => ({
          janusId,
          googleId,
          resourceIds: this.resourceIdsTable.get(janusId) ?? [],
        }),
      );
      localStorage.setItem(
        GoogleSyncManager.STORAGE_KEY,
        JSON.stringify(entries),
      );
    } catch (err) {
      console.error("[Janus Integrations] Failed to persist mapping:", err);
    }
  }

  /**
   * Returns SchedulerManager hooks to be passed into new SchedulerManager().
   * These intercept every Janus mutation and sync it to Google Calendar.
   *
   * Usage:
   *   const manager = new SchedulerManager(syncManager.getHooks())
   */
  getHooks() {
    return {
      onEventAdd: async (event: import("@janus-scheduler/core").Event) => {
        await this.onJanusEventAdd(event);
      },
      onEventUpdate: async (event: import("@janus-scheduler/core").Event) => {
        await this.onJanusEventUpdate(event);
      },
      onEventDelete: async (id: string) => {
        await this.onJanusEventDelete(id);
      },
    };
  }

  /**
   * Load all existing Google Calendar events into the Janus store.
   * Called once after OAuth completes.
   * Also ensures the "google-calendar" resource exists in the store.
   */
  async loadInitialEvents(googleEvents: GoogleCalendarEvent[]): Promise<void> {
    // Ensure the google-calendar resource exists
    const state = schedulerStore.getState();
    if (!state.resources[GoogleEventMapper.defaultResourceId]) {
      state.addResource({
        id: GoogleEventMapper.defaultResourceId,
        name: "Google Calendar",
        type: "person",
      });
    }

    for (const ge of googleEvents) {
      if (!ge.id) continue;

      const existingJanusId = this.reverseTable.get(ge.id);
      const janusData = this.mapper.toJanus(ge, existingJanusId);

      if (existingJanusId) {
        const originalResourceIds = this.resourceIdsTable.get(existingJanusId);
        if (originalResourceIds && originalResourceIds.length > 0) {
          janusData.resourceIds = originalResourceIds;
          janusData.resourceId = originalResourceIds[0];
        }
      }

      this.googleSourceIds.add(janusData.id);

      try {
        state.addEvent(janusData);
        this.mappingTable.set(janusData.id, ge.id);
        this.reverseTable.set(ge.id, janusData.id);
        if (!existingJanusId) {
          this.persistMapping();
        }
      } catch (err) {
        console.error(
          "[Janus Integrations] Failed to load Google event:",
          ge.id,
          err,
        );
      }
    }

    console.log(
      `[Janus Integrations] Loaded ${googleEvents.length} Google Calendar events`,
    );
  }

  /**
   * Handle an incoming change from Google (received via WebSocket from backend).
   * Directly updates the Zustand store — bypasses SchedulerManager hooks
   * to avoid triggering push-back to Google.
   */
  handleGoogleChange(message: WebSocketMessage): void {
    const { type, event } = message;

    if (!event.id) return;

    if (type === "deleted") {
      const janusId = this.reverseTable.get(event.id);
      if (!janusId) return;

      this.googleSourceIds.add(janusId);
      schedulerStore.getState().deleteEvent(janusId);
      this.mappingTable.delete(janusId);
      this.reverseTable.delete(event.id);
      console.log("[Janus Integrations] Deleted from Google sync:", janusId);
      return;
    }

    // upserted — create or update
    const existingJanusId = this.reverseTable.get(event.id);
    const janusData = this.mapper.toJanus(event, existingJanusId);

    this.googleSourceIds.add(janusData.id);

    const storeState = schedulerStore.getState();

    if (existingJanusId && storeState.events[existingJanusId]) {
      // Update existing
      storeState.updateEvent(existingJanusId, janusData);
      console.log(
        "[Janus Integrations] Updated from Google sync:",
        existingJanusId,
      );
    } else {
      // Ensure resource exists
      if (!storeState.resources[GoogleEventMapper.defaultResourceId]) {
        storeState.addResource({
          id: GoogleEventMapper.defaultResourceId,
          name: "Google Calendar",
          type: "person",
        });
      }

      try {
        storeState.addEvent(janusData);
        this.mappingTable.set(janusData.id, event.id);
        this.reverseTable.set(event.id, janusData.id);
        console.log(
          "[Janus Integrations] Added from Google sync:",
          janusData.id,
        );
      } catch (err) {
        console.error("[Janus Integrations] Failed to add Google event:", err);
      }
    }
  }

  // ── SchedulerManager hook handlers ─────────────────────────────────────────

  private async onJanusEventAdd(
    event: import("@janus-scheduler/core").Event,
  ): Promise<void> {
    // Skip events that came from Google
    if (this.googleSourceIds.has(event.id)) {
      this.googleSourceIds.delete(event.id);
      return;
    }

    const connected = await this.client.isConnected();
    // if (!connected) return;
    // if (!this.isGoogleConnected) return;
    if (!connected) {
      console.warn(
        "[Janus Integrations] Skipped push — client.isConnected() returned false",
      );
      return;
    }

    try {
      const googleEvent = this.mapper.toGoogle(event as unknown as EventData);
      const googleId = await this.client.pushEvent(googleEvent);
      this.mappingTable.set(event.id, googleId);
      this.reverseTable.set(googleId, event.id);
      this.resourceIdsTable.set(event.id, event.resourceIds);
      this.persistMapping();
      console.log(`[Janus Integrations] Pushed to Google: ${event.title}`);
    } catch (err) {
      console.error(
        "[Janus Integrations] Failed to push event to Google:",
        err,
      );
      // Re-throw so SchedulerManager rolls back the store
      throw err;
    }
  }

  private async onJanusEventUpdate(
    event: import("@janus-scheduler/core").Event,
  ): Promise<void> {
    if (this.googleSourceIds.has(event.id)) {
      this.googleSourceIds.delete(event.id);
      return;
    }

    const connected = await this.client.isConnected();
    if (!connected) return;

    const googleId = this.mappingTable.get(event.id);
    if (!googleId) return; // event not synced to Google yet

    try {
      const googleEvent = this.mapper.toGoogle(event as unknown as EventData);
      await this.client.updateEvent(googleId, googleEvent);
      this.resourceIdsTable.set(event.id, event.resourceIds);
      this.persistMapping();
      console.log(`[Janus Integrations] Updated in Google: ${event.title}`);
    } catch (err) {
      console.error(
        "[Janus Integrations] Failed to update event in Google:",
        err,
      );
      throw err;
    }
  }

  private async onJanusEventDelete(id: string): Promise<void> {
    if (this.googleSourceIds.has(id)) {
      this.googleSourceIds.delete(id);
      return;
    }

    const connected = await this.client.isConnected();
    if (!connected) return;

    const googleId = this.mappingTable.get(id);
    if (!googleId) return;

    try {
      await this.client.deleteEvent(googleId);
      this.mappingTable.delete(id);
      this.reverseTable.delete(googleId);
      this.resourceIdsTable.delete(id);
      this.persistMapping();
      console.log(`[Janus Integrations] Deleted from Google: ${id}`);
    } catch (err) {
      console.error(
        "[Janus Integrations] Failed to delete event from Google:",
        err,
      );
      throw err;
    }
  }
}
