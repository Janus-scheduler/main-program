import { Injectable, signal, computed, Signal } from "@angular/core";
import {
  JanusEventData,
  JanusResourceData,
  JanusAssignmentData,
  SchedulerConfig,
  SchedulerState,
  SchedulerView,
} from "./types";

/**
 * SchedulerService
 *
 * Framework-agnostic design: all state lives in Angular Signals so the
 * underlying data layer (@janus-scheduler/core) can be swapped out without
 * touching consumers.  Components depend on this service via Angular DI.
 *
 * Usage
 * ─────
 * // Provide at root level (singleton):
 * @Component({ providers: [SchedulerService] })
 *
 * // Or register once in app.config.ts:
 * providers: [SchedulerService]
 *
 * // Inject in a component:
 * readonly scheduler = inject(SchedulerService);
 */
@Injectable()
export class SchedulerService {
  // ── Config ──────────────────────────────────────────────────────────────

  private readonly _config = signal<Required<SchedulerConfig>>({
    startHour: 0,
    endHour: 24,
    defaultView: "week",
    slotDuration: 30,
    enableDrag: false,
    enableResize: false,
  });

  readonly config: Signal<Required<SchedulerConfig>> =
    this._config.asReadonly();

  // ── Core State ───────────────────────────────────────────────────────────

  private readonly _events = signal<Map<string, JanusEventData>>(new Map());
  private readonly _resources = signal<Map<string, JanusResourceData>>(
    new Map(),
  );
  private readonly _assignments = signal<Map<string, JanusAssignmentData>>(
    new Map(),
  );
  private readonly _selectedEventId = signal<string | null>(null);
  private readonly _currentView = signal<SchedulerView>("week");
  private readonly _currentDate = signal<Date>(new Date());

  // ── Public Readonly Signals ───────────────────────────────────────────────

  readonly events: Signal<JanusEventData[]> = computed(() =>
    Array.from(this._events().values()),
  );

  readonly resources: Signal<JanusResourceData[]> = computed(() =>
    Array.from(this._resources().values()),
  );

  readonly assignments: Signal<JanusAssignmentData[]> = computed(() =>
    Array.from(this._assignments().values()),
  );

  readonly selectedEventId: Signal<string | null> =
    this._selectedEventId.asReadonly();

  readonly selectedEvent: Signal<JanusEventData | null> = computed(() => {
    const id = this._selectedEventId();
    return id ? (this._events().get(id) ?? null) : null;
  });

  readonly currentView: Signal<SchedulerView> = this._currentView.asReadonly();
  readonly currentDate: Signal<Date> = this._currentDate.asReadonly();

  readonly state: Signal<SchedulerState> = computed(() => ({
    events: this.events(),
    resources: this.resources(),
    assignments: this.assignments(),
    selectedEventId: this._selectedEventId(),
    currentView: this._currentView(),
    currentDate: this._currentDate(),
  }));

  // ── Derived Signals ───────────────────────────────────────────────────────

  readonly eventCount: Signal<number> = computed(() => this._events().size);
  readonly resourceCount: Signal<number> = computed(
    () => this._resources().size,
  );

  // ── Initialiser ───────────────────────────────────────────────────────────

  /**
   * Bootstrap the service with an optional initial dataset and config.
   * Call this once in your root component or APP_INITIALIZER.
   */
  init(options?: {
    events?: JanusEventData[];
    resources?: JanusResourceData[];
    assignments?: JanusAssignmentData[];
    config?: SchedulerConfig;
  }): void {
    if (options?.config) {
      this._config.update((prev) => ({ ...prev, ...options.config }));
    }
    if (options?.events) {
      const map = new Map<string, JanusEventData>();
      options.events.forEach((e) => map.set(e.id, e));
      this._events.set(map);
    }
    if (options?.resources) {
      const map = new Map<string, JanusResourceData>();
      options.resources.forEach((r) => map.set(r.id, r));
      this._resources.set(map);
    }
    if (options?.assignments) {
      const map = new Map<string, JanusAssignmentData>();
      options.assignments.forEach((a) => map.set(a.id, a));
      this._assignments.set(map);
    }
  }

  // ── Config API ────────────────────────────────────────────────────────────

  setConfig(partial: Partial<SchedulerConfig>): void {
    this._config.update((prev) => ({ ...prev, ...partial }));
  }

  // ── Event API ─────────────────────────────────────────────────────────────

  addEvent(data: JanusEventData): JanusEventData {
    this._validateEvent(data);
    this._events.update((map) => {
      const next = new Map(map);
      next.set(data.id, { ...data });
      return next;
    });
    return data;
  }

  getEvent(id: string): JanusEventData | undefined {
    return this._events().get(id);
  }

  /** Returns all events that belong to a specific resource */
  getEventsByResource(resourceId: string): JanusEventData[] {
    return this.events().filter((e) => e.resourceId === resourceId);
  }

  /** Returns all events that start on a given ISO date string (YYYY-MM-DD) */
  getEventsByDate(date: string): JanusEventData[] {
    const target = new Date(date).toISOString().split("T")[0];
    return this.events().filter(
      (e) => new Date(e.startTime).toISOString().split("T")[0] === target,
    );
  }

  updateEvent(id: string, changes: Partial<JanusEventData>): JanusEventData {
    const existing = this._events().get(id);
    if (!existing) {
      throw new Error(`[SchedulerService] Event "${id}" not found.`);
    }

    const updated: JanusEventData = { ...existing, ...changes, id };
    this._validateEvent(updated);

    this._events.update((map) => {
      const next = new Map(map);
      next.set(id, updated);
      return next;
    });
    return updated;
  }

  deleteEvent(id: string): boolean {
    if (!this._events().has(id)) return false;
    this._events.update((map) => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });
    if (this._selectedEventId() === id) this._selectedEventId.set(null);
    return true;
  }

  // ── Resource API ──────────────────────────────────────────────────────────

  addResource(data: JanusResourceData): JanusResourceData {
    this._validateResource(data);
    this._resources.update((map) => {
      const next = new Map(map);
      next.set(data.id, { ...data });
      return next;
    });
    return data;
  }

  getResource(id: string): JanusResourceData | undefined {
    return this._resources().get(id);
  }

  updateResource(
    id: string,
    changes: Partial<JanusResourceData>,
  ): JanusResourceData {
    const existing = this._resources().get(id);
    if (!existing) {
      throw new Error(`[SchedulerService] Resource "${id}" not found.`);
    }

    const updated: JanusResourceData = { ...existing, ...changes, id };
    this._resources.update((map) => {
      const next = new Map(map);
      next.set(id, updated);
      return next;
    });
    return updated;
  }

  deleteResource(id: string): boolean {
    const hasEvents = this.getEventsByResource(id).length > 0;
    if (hasEvents) {
      throw new Error(
        `[SchedulerService] Cannot delete resource "${id}" – it has assigned events.`,
      );
    }
    if (!this._resources().has(id)) return false;
    this._resources.update((map) => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });
    return true;
  }

  // ── Assignment API ────────────────────────────────────────────────────────

  addAssignment(data: JanusAssignmentData): JanusAssignmentData {
    if (!this._events().has(data.eventId)) {
      throw new Error(`[SchedulerService] Event "${data.eventId}" not found.`);
    }
    if (!this._resources().has(data.resourceId)) {
      throw new Error(
        `[SchedulerService] Resource "${data.resourceId}" not found.`,
      );
    }
    this._assignments.update((map) => {
      const next = new Map(map);
      next.set(data.id, { ...data });
      return next;
    });
    return data;
  }

  deleteAssignment(id: string): boolean {
    if (!this._assignments().has(id)) return false;
    this._assignments.update((map) => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });
    return true;
  }

  // ── Selection API ─────────────────────────────────────────────────────────

  selectEvent(id: string | null): void {
    this._selectedEventId.set(id);
  }

  // ── View / Navigation API ─────────────────────────────────────────────────

  setView(view: SchedulerView): void {
    this._currentView.set(view);
  }

  setDate(date: Date): void {
    this._currentDate.set(new Date(date));
  }

  navigateNext(): void {
    this._currentDate.update((d) => this._shiftDate(d, 1));
  }

  navigatePrev(): void {
    this._currentDate.update((d) => this._shiftDate(d, -1));
  }

  navigateToday(): void {
    this._currentDate.set(new Date());
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  clearAll(): void {
    this._events.set(new Map());
    this._resources.set(new Map());
    this._assignments.set(new Map());
    this._selectedEventId.set(null);
  }

  printSummary(): void {
    console.group("[SchedulerService] Summary");
    console.log("Events:", this._events().size);
    console.log("Resources:", this._resources().size);
    console.log("Assignments:", this._assignments().size);
    console.log("View:", this._currentView());
    console.log("Date:", this._currentDate().toISOString());
    console.groupEnd();
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  private _validateEvent(data: JanusEventData): void {
    if (!data.id || !data.title || !data.resourceId) {
      throw new Error(
        "[SchedulerService] Event must have id, title, and resourceId.",
      );
    }
    const start = new Date(data.startTime).getTime();
    const end = new Date(data.endTime).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) {
      throw new TypeError(
        "[SchedulerService] Event startTime / endTime must be valid ISO strings.",
      );
    }
    if (start >= end) {
      throw new Error(
        "[SchedulerService] Event startTime must be before endTime.",
      );
    }
  }

  private _validateResource(data: JanusResourceData): void {
    if (!data.id || !data.name) {
      throw new Error("[SchedulerService] Resource must have id and name.");
    }
  }

  private _shiftDate(base: Date, direction: 1 | -1): Date {
    const d = new Date(base);
    switch (this._currentView()) {
      case "day":
        d.setDate(d.getDate() + direction);
        break;
      case "week":
        d.setDate(d.getDate() + 7 * direction);
        break;
      case "month":
        d.setMonth(d.getMonth() + direction);
        break;
    }
    return d;
  }
}
