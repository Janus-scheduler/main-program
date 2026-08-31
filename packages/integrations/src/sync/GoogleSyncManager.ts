import { schedulerStore, type EventData } from "@janus-scheduler/core";
import { GoogleCalendarClient } from "../client/GoogleCalendarClient.js";
import { GoogleWebSocketListener } from "../listener/GoogleWebSocketListener.js";
import { GoogleEventMapper } from "../mapper/GoogleEventMapper.js";
import type {
  WebSocketMessage,
  GoogleCalendarEvent,
  GoogleAttendee,
} from "../types/index.js";

interface PersistedMappingEntry {
  janusId: string;
  googleId: string;
  resourceIds: string[];
}

/**
 * Runtime shape check for one persisted mapping entry. localStorage is
 * user-writable and survives across app versions, so a well-formed-but-wrong
 * JSON payload (an object, an array of strings, entries missing fields) must be
 * rejected rather than cast blindly — otherwise `undefined` ids leak into the
 * lookup tables and get re-serialised on the next persist.
 */
function isValidMappingEntry(value: unknown): value is PersistedMappingEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.janusId === "string" &&
    entry.janusId.length > 0 &&
    typeof entry.googleId === "string" &&
    entry.googleId.length > 0 &&
    Array.isArray(entry.resourceIds) &&
    entry.resourceIds.every((id) => typeof id === "string")
  );
}

export class GoogleSyncManager {
  private readonly client: GoogleCalendarClient;
  private readonly mapper: GoogleEventMapper;
  private isGoogleConnected = false;
  private readonly statusListeners = new Set<(connected: boolean) => void>();

  setConnected(value: boolean): void {
    this.isGoogleConnected = value;
    for (const listener of this.statusListeners) listener(value);
  }

  /**
   * Subscribe to connection status changes. Invoked immediately with the
   * current status, then again on every change. Returns an unsubscribe
   * function — call it on unmount to avoid updating state after teardown.
   */
  onStatusChange(callback: (connected: boolean) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.isGoogleConnected);
    return () => this.statusListeners.delete(callback);
  }

  /** Starts the OAuth flow — redirects the browser to the backend's /auth/google. */
  connect(): void {
    this.client.connect();
  }

  /**
   * Disconnects from Google Calendar and broadcasts the status change to any
   * onStatusChange subscribers.
   */
  async disconnect(): Promise<void> {
    await this.client.disconnect();
    this.setConnected(false);
  }

  /**
   * Asks the backend whether Google Calendar is actually connected right now
   * (tokens + calendar bootstrap both present — see the backend's /auth/status)
   * and updates/broadcasts status accordingly. Call this once on mount to
   * pick up an already-connected backend from a previous session (a plain
   * page reload with no OAuth redirect in progress).
   */
  async refreshStatus(): Promise<boolean> {
    const connected = await this.client.isConnected();
    this.setConnected(connected);
    return connected;
  }

  /**
   * Detects a Google OAuth redirect back to this page (the backend appends
   * `?google_connected=true|false` after the callback completes), updates
   * status accordingly, and cleans the query param from the URL. Call this
   * once on mount, before subscribing via onStatusChange. Safe to call when
   * there's no such param — it's then a no-op.
   */
  handleOAuthRedirect(): "connected" | "failed" | "none" {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("google_connected");

    if (connected === "true") {
      this.setConnected(true);
      window.history.replaceState({}, "", window.location.pathname);
      return "connected";
    }
    if (connected === "false") {
      console.error("[Janus Integrations] Google OAuth failed");
      window.history.replaceState({}, "", window.location.pathname);
      return "failed";
    }
    return "none";
  }

  private wsListener: GoogleWebSocketListener | null = null;
  // While the initial fetch/load/push sequence runs, live WebSocket messages
  // are queued here instead of applied, then flushed once it completes — see
  // startRealtimeSync.
  private isBufferingInitialSync = false;
  private readonly initialSyncBuffer: WebSocketMessage[] = [];

  /**
   * Starts real-time sync once a connection is confirmed: opens the WebSocket
   * for live Google → Janus updates, pulls in Google's current events (skipping
   * ones already known locally), then pushes any local events that never got a
   * chance to sync (e.g. seed data created before connecting).
   *
   * The WebSocket is opened *before* the initial fetch so that changes made on
   * the Google side during the load window aren't lost in the gap; messages
   * that arrive in that window are buffered and applied once the initial load
   * finishes.
   *
   * Call this once per connection (e.g. from the host app's effect gated on
   * connected status). Returns a stop function — call it when disconnecting
   * or tearing down, to close the WebSocket and avoid acting on stale data.
   */
  async startRealtimeSync(): Promise<() => void> {
    this.wsListener?.stop();
    this.isBufferingInitialSync = true;
    this.initialSyncBuffer.length = 0;

    this.wsListener = new GoogleWebSocketListener(
      { backendUrl: this.client.getBackendUrl() },
      (message) => {
        if (this.isBufferingInitialSync) {
          this.initialSyncBuffer.push(message);
        } else {
          this.handleGoogleChange(message);
        }
      },
    );
    this.wsListener.start();

    try {
      const events = await this.client.fetchInitialEvents();
      await this.loadInitialEvents(events);
      await this.pushUnsyncedLocalEvents();
    } catch (err) {
      console.error(
        "[Janus Integrations] Failed to load initial Google events:",
        err,
      );
    } finally {
      // Flush anything that arrived during the load window, in order, then
      // switch to applying messages live. handleGoogleChange is idempotent
      // (upsert keyed by reverseTable), so a buffered message that duplicates
      // an already-loaded event is a harmless no-op.
      this.isBufferingInitialSync = false;
      const buffered = this.initialSyncBuffer.splice(0);
      for (const message of buffered) {
        this.handleGoogleChange(message);
      }
    }

    return () => {
      this.wsListener?.stop();
      this.wsListener = null;
      this.isBufferingInitialSync = false;
      this.initialSyncBuffer.length = 0;
    };
  }

  // janusId → googleId
  private readonly mappingTable = new Map<string, string>();
  // googleId → janusId
  private readonly reverseTable = new Map<string, string>();
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
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        console.warn(
          "[Janus Integrations] Persisted mapping is not an array — ignoring",
        );
        return;
      }
      for (const entry of parsed) {
        if (!isValidMappingEntry(entry)) {
          console.warn(
            "[Janus Integrations] Skipping malformed persisted mapping entry",
          );
          continue;
        }
        this.mappingTable.set(entry.janusId, entry.googleId);
        this.reverseTable.set(entry.googleId, entry.janusId);
        this.resourceIdsTable.set(entry.janusId, entry.resourceIds);
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
   * Resolve a Janus event's assigned resourceIds into Google Calendar attendees.
   * Only "person" resources with an email are included — room/equipment
   * resources are silently skipped.
   *
   */
  private resolveAttendees(resourceIds: string[]): GoogleAttendee[] {
    const { resources } = schedulerStore.getState();
    const attendees: GoogleAttendee[] = [];

    for (const resourceId of resourceIds) {
      const resource = resources[resourceId];
      if (!resource) continue;
      if (resource.type !== "person") continue;
      if (!resource.email) continue;

      attendees.push({ email: resource.email });
    }

    return attendees;
  }

  /**
   * Resolve a Janus event's assigned resourceIds into the room/equipment
   * names + full resourceId list toGoogle() needs to populate `location`,
   * the generated equipment block in `description`, and
   * `extendedProperties`. Person resources are excluded here — they're
   * already covered by resolveAttendees.
   */
  private resolveResourceContext(resourceIds: string[]): {
    roomNames: string[];
    equipmentNames: string[];
    resourceIds: string[];
  } {
    const { resources } = schedulerStore.getState();
    const roomNames: string[] = [];
    const equipmentNames: string[] = [];

    for (const resourceId of resourceIds) {
      const resource = resources[resourceId];
      if (!resource) continue;
      if (resource.type === "room") roomNames.push(resource.name);
      else if (resource.type === "equipment")
        equipmentNames.push(resource.name);
    }

    return { roomNames, equipmentNames, resourceIds };
  }

  /**
   * Reverse-map a Google event's `extendedProperties.private.janusResourceIds`
   * (written by toGoogle() on push — see GoogleResourceContext) back into a
   * resourceIds array. Unlike resolveResourceIdsFromAttendees, this covers
   * room/equipment assignments too, not just person invitees — it's the only
   * source for those, since Google has no other field to hold them.
   *
   * Callers should exclude "person" resources from the result (see
   * excludeResourceType) and merge the rest with resolveResourceIdsFromAttendees
   * rather than preferring one or the other outright: extendedProperties is a
   * snapshot frozen at the moment Janus last pushed, so treating it as
   * authoritative for people too would mean an attendee added/removed by hand
   * directly in Google — which never touches extendedProperties — silently
   * never reaches Janus. Attendees are the live source of truth for people;
   * extendedProperties are the only source for room/equipment.
   *
   * Ids that no longer exist locally (e.g. the resource was deleted since
   * the push) are filtered out. Returns undefined when there's nothing usable.
   */
  private resolveResourceIdsFromExtendedProperties(
    event: GoogleCalendarEvent,
  ): string[] | undefined {
    const raw =
      event.extendedProperties?.private?.[
        GoogleEventMapper.resourceIdsPropertyKey
      ];
    if (!raw) return undefined;

    const { resources } = schedulerStore.getState();
    const resourceIds = raw.split(",").filter((id) => id && resources[id]);

    return resourceIds.length > 0 ? resourceIds : undefined;
  }

  /** Drops resourceIds of the given type from a resolver result (e.g. excluding "person" so attendees stay the live source of truth for people). */
  private excludeResourceType(
    resourceIds: string[] | undefined,
    type: "person" | "room" | "equipment",
  ): string[] | undefined {
    if (!resourceIds) return undefined;
    const { resources } = schedulerStore.getState();
    const filtered = resourceIds.filter((id) => resources[id]?.type !== type);
    return filtered.length > 0 ? filtered : undefined;
  }

  /**
   * Reverse-map a Google event's attendee emails back to known Janus
   * resourceIds (for events that originated on the Google side). Returns
   * undefined when there are no attendees or none match a known resource —
   * the caller falls back to the default placeholder resource in that case.
   */
  private resolveResourceIdsFromAttendees(
    attendees?: GoogleAttendee[],
  ): string[] | undefined {
    if (!attendees || attendees.length === 0) return undefined;

    const { resources } = schedulerStore.getState();
    const emailToResourceId = new Map<string, string>();
    for (const resource of Object.values(resources)) {
      if (resource.type === "person" && resource.email) {
        emailToResourceId.set(resource.email.toLowerCase(), resource.id);
      }
    }

    const resourceIds = attendees
      .map((a) => emailToResourceId.get(a.email.toLowerCase()))
      .filter((id): id is string => !!id);

    return resourceIds.length > 0 ? resourceIds : undefined;
  }

  /**
   * Reverse-map a Google event's `location` text back into room resourceIds
   * — the only source for rooms on an event Janus never touched (no
   * `extendedProperties` to read instead). `location` is split on ","
   * (mirroring how toGoogle() joins room names on push) and each trimmed,
   * lowercased segment is compared for an *exact* match against a room
   * resource's name.
   *
   * Deliberately exact, not substring: a looser match risks pulling in an
   * unrelated room whose name happens to appear inside other text. Equipment
   * is deliberately NOT matched from `description` at all — free text is far
   * noisier than the purpose-built `location` field (a resource name can
   * appear in prose without meaning "this is booked"), so unrecognized
   * equipment is preferable to false matches.
   */
  private resolveResourceIdsFromLocation(
    event: GoogleCalendarEvent,
  ): string[] | undefined {
    const locationSegments = new Set(
      (event.location ?? "")
        .split(",")
        .map((segment) => segment.trim().toLowerCase())
        .filter(Boolean),
    );
    if (locationSegments.size === 0) return undefined;

    const { resources } = schedulerStore.getState();
    const resourceIds = Object.values(resources)
      .filter(
        (resource) =>
          resource.type === "room" &&
          locationSegments.has(resource.name.trim().toLowerCase()),
      )
      .map((resource) => resource.id);

    return resourceIds.length > 0 ? resourceIds : undefined;
  }

  /**
   * Dedupe-merge any number of possibly-undefined resourceId lists into one.
   * Used to combine the independent partial signals a Google event carries —
   * live people from attendees, room/equipment from extendedProperties,
   * room from location text — none of which alone is a complete picture, so
   * they're combined rather than tried in preference order.
   */
  private mergeResourceIds(
    ...idLists: (string[] | undefined)[]
  ): string[] | undefined {
    const merged = new Set<string>();
    for (const ids of idLists) {
      for (const id of ids ?? []) merged.add(id);
    }
    return merged.size > 0 ? Array.from(merged) : undefined;
  }

  /**
   * Creates the "Google Calendar" placeholder resource, but only the first
   * time it's actually needed by an event whose attendees didn't resolve to
   * any known resource — not eagerly on every connect.
   */
  private ensurePlaceholderResourceIfNeeded(resourceIds?: string[]): void {
    if (!resourceIds?.includes(GoogleEventMapper.defaultResourceId)) return;

    const state = schedulerStore.getState();
    if (!state.resources[GoogleEventMapper.defaultResourceId]) {
      state.addResource({
        id: GoogleEventMapper.defaultResourceId,
        name: "Google Calendar",
        type: "person",
        email: "google-calendar@placeholder.local",
      });
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
   */
  async loadInitialEvents(googleEvents: GoogleCalendarEvent[]): Promise<void> {
    const state = schedulerStore.getState();

    for (const ge of googleEvents) {
      if (!ge.id) continue;

      const existingJanusId = this.reverseTable.get(ge.id);

      // If this Google event already maps to an event that's present in the
      // local store, don't overwrite it — the local copy is canonical here.
      // (This is a one-time "bring in what Google has that Janus doesn't"
      // import, not an ongoing reconciliation; live updates already flow
      // through handleGoogleChange via the webhook/WebSocket.) Overwriting
      // unconditionally was clobbering freshly-created local events with
      // whatever — possibly stale/duplicate — copy Google returned.
      if (existingJanusId && state.events[existingJanusId]) {
        this.mappingTable.set(existingJanusId, ge.id);
        this.reverseTable.set(ge.id, existingJanusId);
        continue;
      }

      const resolvedResourceIds = this.mergeResourceIds(
        this.resolveResourceIdsFromAttendees(ge.attendees),
        this.excludeResourceType(
          this.resolveResourceIdsFromExtendedProperties(ge),
          "person",
        ),
        this.resolveResourceIdsFromLocation(ge),
      );
      const janusData = this.mapper.toJanus(
        ge,
        existingJanusId,
        resolvedResourceIds,
      );

      if (existingJanusId) {
        const originalResourceIds = this.resourceIdsTable.get(existingJanusId);
        if (originalResourceIds && originalResourceIds.length > 0) {
          janusData.resourceIds = originalResourceIds;
          janusData.resourceId = originalResourceIds[0];
        }
      }

      this.ensurePlaceholderResourceIfNeeded(janusData.resourceIds);

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

      schedulerStore.getState().deleteEvent(janusId);
      this.mappingTable.delete(janusId);
      this.reverseTable.delete(event.id);
      console.log("[Janus Integrations] Deleted from Google sync:", janusId);
      return;
    }

    // upserted — create or update
    const existingJanusId = this.reverseTable.get(event.id);
    const resolvedResourceIds = this.mergeResourceIds(
      this.resolveResourceIdsFromAttendees(event.attendees),
      this.excludeResourceType(
        this.resolveResourceIdsFromExtendedProperties(event),
        "person",
      ),
      this.resolveResourceIdsFromLocation(event),
    );
    const janusData = this.mapper.toJanus(
      event,
      existingJanusId,
      resolvedResourceIds,
    );

    const storeState = schedulerStore.getState();

    if (existingJanusId && storeState.events[existingJanusId]) {
      // Update existing
      storeState.updateEvent(existingJanusId, janusData);
      console.log(
        "[Janus Integrations] Updated from Google sync:",
        existingJanusId,
      );
    } else {
      this.ensurePlaceholderResourceIfNeeded(janusData.resourceIds);

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
    const connected = await this.client.isConnected();
    // if (!connected) return;
    // if (!this.isGoogleConnected) return;
    if (!connected) {
      console.warn(
        "[Janus Integrations] Skipped push — client.isConnected() returned false",
      );
      return;
    }

    // If this Janus id already has a Google mapping (restored from
    // localStorage on a previous session), this "add" is really a re-seed of
    // an event that was already pushed before — update it in place instead
    // of inserting a duplicate. Without this check, reloading the demo app
    // (which re-seeds fixed event ids on every page load) creates a new
    // Google event on every reload while connected.
    const existingGoogleId = this.mappingTable.get(event.id);
    if (existingGoogleId) {
      await this.pushUpdateOrRecreate(event, existingGoogleId);
      return;
    }

    await this.pushCreateToGoogle(event);
  }

  /**
   * janusId → in-flight create push promise. De-dupes concurrent create
   * attempts for the same event — e.g. right after connecting, the seed-time
   * onEventAdd hook and pushUnsyncedLocalEvents's catch-up sweep can both see
   * the same not-yet-mapped event and race to create it, producing a
   * duplicate Google event before either one's mapping is recorded.
   */
  private readonly inFlightCreates = new Map<string, Promise<void>>();

  /** Shared by onJanusEventAdd (new events) and pushUnsyncedLocalEvents (catch-up). */
  private async pushCreateToGoogle(
    event: import("@janus-scheduler/core").Event,
  ): Promise<void> {
    const inFlight = this.inFlightCreates.get(event.id);
    if (inFlight) {
      await inFlight;
      return;
    }

    const promise = this.doPushCreateToGoogle(event);
    this.inFlightCreates.set(event.id, promise);
    try {
      await promise;
    } finally {
      this.inFlightCreates.delete(event.id);
    }
  }

  private async doPushCreateToGoogle(
    event: import("@janus-scheduler/core").Event,
  ): Promise<void> {
    // Re-check after acquiring: if a concurrent call already completed the
    // push while this one was queued, don't create a second copy.
    if (this.mappingTable.has(event.id)) return;

    try {
      const attendees = this.resolveAttendees(event.resourceIds);
      const resourceContext = this.resolveResourceContext(event.resourceIds);
      const googleEvent = this.mapper.toGoogle(
        event as unknown as EventData,
        attendees,
        resourceContext,
      );
      const googleId = await this.client.pushEvent(googleEvent);
      this.mappingTable.set(event.id, googleId);
      this.reverseTable.set(googleId, event.id);
      this.resourceIdsTable.set(event.id, event.resourceIds);
      this.persistMapping();
      console.log(`[Janus Integrations] Pushed to Google: ${event.title}`);
    } catch (err) {
      // Deliberately NOT re-thrown. A failed push to Google shouldn't delete
      // an event the user just created in Janus — that's the harshest
      // possible outcome for what's meant to be a best-effort external sync.
      // The event just stays local with no mapping; it'll be retried on the
      // next pushUnsyncedLocalEvents() call (e.g. next reconnect/reload).
      console.error(
        "[Janus Integrations] Failed to push event to Google (event kept locally, will retry later):",
        err,
      );
    }
  }

  /**
   * Push any local events that don't yet have a Google mapping.
   * Needed because events created BEFORE the user connects Google (e.g. the
   * demo's seed data, added while `isConnected()` was still false) are never
   * retried automatically — onEventAdd only fires once, at creation time.
   * Call this once, right after OAuth completes / connection is confirmed.
   */
  async pushUnsyncedLocalEvents(): Promise<void> {
    const { events } = schedulerStore.getState();
    const unsynced = Object.values(events).filter(
      (event) => !this.mappingTable.has(event.id),
    );

    for (const event of unsynced) {
      // pushCreateToGoogle logs its own failures and never throws — a
      // failure here just leaves that one event unsynced for next time.
      await this.pushCreateToGoogle(event);
    }

    console.log(
      `[Janus Integrations] Pushed ${unsynced.length} previously-unsynced local event(s) to Google`,
    );
  }

  private async onJanusEventUpdate(
    event: import("@janus-scheduler/core").Event,
  ): Promise<void> {
    const connected = await this.client.isConnected();
    if (!connected) return;

    const googleId = this.mappingTable.get(event.id);
    if (!googleId) return; // event not synced to Google yet

    await this.pushUpdateOrRecreate(event, googleId);
  }

  /**
   * Updates the mapped Google event; if that fails — most commonly because
   * the remembered Google event (or its calendar) no longer exists, e.g. a
   * stale mapping left over from a deleted/recreated "Janus Scheduler"
   * calendar in an earlier session — clears the stale mapping and creates a
   * fresh Google event instead of leaving this event permanently stuck.
   */
  private async pushUpdateOrRecreate(
    event: import("@janus-scheduler/core").Event,
    googleId: string,
  ): Promise<void> {
    const updated = await this.pushUpdateToGoogle(event, googleId);
    if (updated) return;

    this.mappingTable.delete(event.id);
    this.reverseTable.delete(googleId);
    this.persistMapping();
    await this.pushCreateToGoogle(event);
  }

  /** Shared by pushUpdateOrRecreate and onJanusEventUpdate. Returns success. */
  private async pushUpdateToGoogle(
    event: import("@janus-scheduler/core").Event,
    googleId: string,
  ): Promise<boolean> {
    try {
      const attendees = this.resolveAttendees(event.resourceIds);
      const resourceContext = this.resolveResourceContext(event.resourceIds);
      const googleEvent = this.mapper.toGoogle(
        event as unknown as EventData,
        attendees,
        resourceContext,
      );
      await this.client.updateEvent(googleId, googleEvent);
      this.resourceIdsTable.set(event.id, event.resourceIds);
      this.persistMapping();
      console.log(`[Janus Integrations] Updated in Google: ${event.title}`);
      return true;
    } catch (err) {
      console.error(
        "[Janus Integrations] Failed to update event in Google:",
        err,
      );
      return false;
    }
  }

  private async onJanusEventDelete(id: string): Promise<void> {
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
