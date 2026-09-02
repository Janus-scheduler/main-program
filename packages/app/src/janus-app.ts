import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  SchedulerManager,
  schedulerStore,
  isoToZonedDisplay,
  zonedInputToISO,
  type EventData,
  type ResourceData,
  type ResourceTypeConfig,
  type SchedulerHooks,
  type SchedulerSaveData,
  type ViewType,
} from "@janus-scheduler/core";

// Side-effect import: registers <janus-timeline>, <janus-topbar>, … Without it
// the tags below would render as unknown elements.
import "@janus-scheduler/ui";

import type {
  JanusAppChangeDetail,
  JanusAppData,
  JanusAppErrorDetail,
} from "./app-types";

/** The imperative navigation surface every view element exposes. */
interface NavHandle extends HTMLElement {
  goToPrev(): void;
  goToNext(): void;
  goToToday(): void;
  goToDate?(date: string | number | Date): void;
  toggleCreate?(): void;
  updateComplete?: Promise<unknown>;
}

/** Draft values handed to the editor modal when creating (not editing) an event. */
interface DraftSeed {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  participants?: string[];
  showConfirmOnCreate?: boolean;
}

/**
 * `<janus-app>` — the batteries-included Janus Scheduler.
 *
 * `@janus-scheduler/ui` is deliberately render-only: it never writes to the
 * store, so every consumer has to turn ~40 drag/resize/create/save callbacks
 * into `SchedulerManager` calls themselves. Each demo in this repo does exactly
 * that, and between them they duplicate the same ~1,000 lines four times over.
 *
 * This element does that wiring once. It owns a `SchedulerManager`, mounts the
 * topbar + the active view + the editor modal, and reports what changed through
 * a `change` event so a host can persist it.
 *
 * It is a plain custom element, so it works in Vue, Angular, Solid and vanilla
 * as-is; `@janus-scheduler/app/react` adds the idiomatic React binding.
 *
 * @fires change      - {@link JanusAppChangeDetail} an event was added/updated/deleted
 * @fires app-error   - {@link JanusAppErrorDetail} a lifecycle hook rejected; store rolled back
 * @fires view-change - the active view changed
 * @fires connect-calendar - the topbar's Google Calendar button was clicked
 */
@customElement("janus-app")
export class JanusApp extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 100%;
      width: 100%;
    }
    .janus-app {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      min-width: 0;
    }
    .view {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .view[hidden] {
      display: none;
    }
  `;

  // ── Data in ────────────────────────────────────────────────────────────────
  /**
   * Initial events. Seeded into the store once, on first render — `<janus-app>`
   * owns the store from then on. Call `load()` to replace the data later.
   */
  @property({ type: Array }) events: EventData[] = [];
  /** Initial resources. Same one-shot seeding rule as {@link events}. */
  @property({ type: Array }) resources: ResourceData[] = [];

  // ── Config ─────────────────────────────────────────────────────────────────
  /** The view shown on load. Also settable later to switch views. */
  @property({ type: String }) view: ViewType = "Timeline";
  /** Which views the topbar offers. */
  @property({ type: Array }) views: ViewType[] = [
    "Timeline",
    "Day",
    "Week",
    "Month",
    "Year",
  ];
  /** Hard-block conflicting drags/resizes/saves instead of only warning. */
  @property({ type: Boolean, attribute: "prevent-conflicts" })
  preventConflicts = false;
  /** Groups and labels resource rows on the timeline. */
  @property({ type: Object, attribute: false })
  resourceTypeConfig?: ResourceTypeConfig;
  /** IANA timezone for display. Defaults to the store's. */
  @property({ type: String }) timezone?: string;
  /** Render the Google Calendar button in its connected state. */
  @property({ type: Boolean, attribute: "google-connected" })
  googleConnected = false;
  /**
   * Lifecycle hooks forwarded to the internal `SchedulerManager` — the place to
   * persist changes, e.g. `{ onEventAdd: (e) => api.save(e) }`. A hook that
   * throws rolls the store back and fires `app-error`.
   *
   * Ignored when {@link manager} is supplied; configure that manager instead.
   */
  @property({ attribute: false }) hooks: SchedulerHooks = {};
  /**
   * Bring your own manager. When omitted, `<janus-app>` creates one and wires
   * {@link hooks} into it.
   */
  @property({ attribute: false }) manager?: SchedulerManager;

  // ── Internal state ─────────────────────────────────────────────────────────
  @state() private _showEditor = false;
  @state() private _selectedEventId: string | null = null;
  @state() private _draft: DraftSeed | null = null;
  @state() private _editorError: string | null = null;
  @state() private _allowCreate = true;
  @state() private _canUndo = false;
  @state() private _nav = {
    navLabel: "",
    dayName: "",
    shortDate: "",
    zoomPercent: 100,
    zoomUnit: "",
  };

  /** Owned manager, when the host did not supply one. */
  private _ownManager?: SchedulerManager;
  /** Unsubscribe from the manager's undo-state subscription. */
  private _undoUnsub?: () => void;
  /** Set by a day-click in one view; consumed once the next view has mounted. */
  private _pendingDate: string | null = null;
  private _seeded = false;

  /** The active `SchedulerManager` — the one supplied, or the one we created. */
  get schedulerManager(): SchedulerManager {
    if (this.manager) return this.manager;
    this._ownManager ??= new SchedulerManager(this._buildHooks());
    return this._ownManager;
  }

  private _buildHooks(): SchedulerHooks {
    const user = this.hooks ?? {};
    return {
      ...user,
      onEventAdd: (event) => {
        this._emitChange({ type: "add", id: event.id, event });
        return user.onEventAdd?.(event);
      },
      onEventUpdate: (event) => {
        this._emitChange({ type: "update", id: event.id, event });
        return user.onEventUpdate?.(event);
      },
      onEventDelete: (id) => {
        this._emitChange({ type: "delete", id });
        return user.onEventDelete?.(id);
      },
      onError: (ctx) => {
        this._editorError =
          ctx.error instanceof Error ? ctx.error.message : String(ctx.error);
        this._emit<JanusAppErrorDetail>("app-error", ctx);
        user.onError?.(ctx);
      },
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  connectedCallback(): void {
    super.connectedCallback();
    const mgr = this.schedulerManager;
    this._canUndo = mgr.canUndo();
    this._undoUnsub = mgr.subscribeUndo(() => {
      this._canUndo = mgr.canUndo();
    });
    window.addEventListener("keydown", this._onKeydown);
  }

  disconnectedCallback(): void {
    this._undoUnsub?.();
    this._undoUnsub = undefined;
    window.removeEventListener("keydown", this._onKeydown);
    super.disconnectedCallback();
  }

  protected firstUpdated(): void {
    if (!this._seeded) {
      this._seed(this.events, this.resources);
      this._seeded = true;
    }
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has("view")) void this._applyPendingNavigation();
  }

  /**
   * Replace the store's contents. Use this instead of reassigning `events` /
   * `resources`, which only seed on first render.
   */
  load(data: JanusAppData): void {
    this.schedulerManager.clearAll();
    this._seed(
      (data.events ?? []) as EventData[],
      (data.resources ?? []) as ResourceData[],
    );
  }

  private _seed(events: EventData[], resources: ResourceData[]): void {
    const mgr = this.schedulerManager;
    // Resources first — an event referencing an unknown resource is invalid.
    for (const r of resources ?? []) {
      try {
        mgr.addResource(r);
      } catch {
        /* one malformed seed row must not take down the whole app */
      }
    }
    if (events?.length) {
      try {
        mgr.batchAddEvents(events);
      } catch {
        /* same */
      }
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  private _activeNav(): NavHandle | null {
    const selector =
      {
        Timeline: "#timeline",
        Month: "#month",
        Day: "#day",
        Week: "#week",
        Year: "#year",
      }[this.view] ?? "#timeline";
    return this.renderRoot.querySelector<NavHandle>(selector);
  }

  /**
   * After a view switch, send the newly mounted view to the date the user
   * clicked in the previous one. The Timeline does not open on today the way
   * the calendar views do, so it gets an explicit reset when there is no target.
   */
  private async _applyPendingNavigation(): Promise<void> {
    const target = this._pendingDate;
    this._pendingDate = null;
    if (!target && this.view !== "Timeline") return;

    const el = this._activeNav();
    if (!el) return;
    await el.updateComplete;
    if (target) el.goToDate?.(target);
    else el.goToToday();
  }

  private _switchView(view: ViewType): void {
    if (view === this.view) return;
    this.view = view;
    this._emit("view-change", { view });
  }

  private _goToDateIn(view: ViewType, date: string): void {
    this._pendingDate = date;
    this._switchView(view);
  }

  private _onKeydown = (e: KeyboardEvent): void => {
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "z" &&
      !e.shiftKey
    ) {
      if (!this.schedulerManager.canUndo()) return;
      e.preventDefault();
      this.schedulerManager.undo();
    }
  };

  // ── Editor modal ───────────────────────────────────────────────────────────
  private _openEditor(eventId?: string, draft: DraftSeed | null = null): void {
    this._selectedEventId = eventId ?? null;
    this._draft = draft;
    this._editorError = null;
    this._showEditor = true;
  }

  private _closeEditor(): void {
    this._showEditor = false;
    this._selectedEventId = null;
    this._draft = null;
    this._editorError = null;
  }

  private _tz(): string {
    return this.timezone ?? schedulerStore.getState().timezone;
  }

  private _handleSave(data: SchedulerSaveData): void {
    const today = new Date().toISOString().split("T")[0];
    const tz = data.timezone || this._tz();
    const payload = {
      title: data.title || "New Event",
      startTime: zonedInputToISO(data.startDate || today, data.startTime, tz),
      endTime: zonedInputToISO(data.endDate || today, data.endTime, tz),
      resourceIds: data.participants ?? [],
      description: data.description,
      status: "confirmed" as const,
      color: data.activeColor,
      allDay: data.allDay,
      recurrenceRule: data.recurrenceRule,
    };
    try {
      if (data.id) {
        this.schedulerManager.updateEvent(data.id, payload);
      } else {
        this.schedulerManager.addEvent({
          id: `evt_${Date.now()}`,
          ...payload,
        });
      }
      this._closeEditor();
    } catch (err) {
      // Synchronous validation/conflict failure — keep the modal open and say why.
      this._editorError = err instanceof Error ? err.message : String(err);
    }
  }

  private _handleDelete(id: string): void {
    try {
      this.schedulerManager.deleteEvent(id);
      this._closeEditor();
    } catch (err) {
      this._editorError = err instanceof Error ? err.message : String(err);
    }
  }

  // ── Event → store wiring ───────────────────────────────────────────────────
  private _onTimelineMove = (e: Event): void => {
    const { event, oldResourceId, newResourceId, newStartTime, newEndTime } = (
      e as CustomEvent
    ).detail;
    const current = this.schedulerManager.getEvent(event.id);
    if (!current) return;
    this.schedulerManager.updateEvent(event.id, {
      resourceIds: current.resourceIds.map((id: string) =>
        id === oldResourceId ? newResourceId : id,
      ),
      startTime: newStartTime,
      endTime: newEndTime,
    });
  };

  private _onResize = (e: Event): void => {
    const { event, newStartTime, newEndTime } = (e as CustomEvent).detail;
    this.schedulerManager.updateEvent(event.id, {
      startTime: newStartTime,
      endTime: newEndTime,
    });
  };

  private _onTimelineCreate = (e: Event): void => {
    const { resourceId, startTime, endTime } = (e as CustomEvent).detail;
    const start = isoToZonedDisplay(startTime, this._tz());
    const end = isoToZonedDisplay(endTime, this._tz());
    this._openEditor(undefined, {
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      participants: [resourceId],
      showConfirmOnCreate: true,
    });
  };

  /**
   * Day/Week grids report drags as wall-clock date + time, not ISO instants
   * like the Timeline — so both handlers convert before writing to the store.
   */
  private _onTimeGridMove = (e: Event): void => {
    const { event, newDate, newStartTime, newEndTime } = (e as CustomEvent)
      .detail;
    const tz = this._tz();
    this.schedulerManager.updateEvent(event.id, {
      startTime: zonedInputToISO(newDate, newStartTime, tz),
      endTime: zonedInputToISO(newDate, newEndTime, tz),
    });
  };

  private _onTimeGridResize = (e: Event): void => {
    const { event, date, newStartTime, newEndTime } = (e as CustomEvent).detail;
    const tz = this._tz();
    this.schedulerManager.updateEvent(event.id, {
      startTime: zonedInputToISO(date, newStartTime, tz),
      endTime: zonedInputToISO(date, newEndTime, tz),
    });
  };

  private _onSlotSelect = (e: Event): void => {
    const { date, startTime, endTime } = (e as CustomEvent).detail;
    this._openEditor(undefined, {
      startDate: date,
      startTime,
      endDate: date,
      endTime,
      showConfirmOnCreate: true,
    });
  };

  private _onNavChange = (e: Event): void => {
    const d = (e as CustomEvent).detail ?? {};
    this._nav = {
      navLabel: d.navLabel ?? "",
      dayName: d.dayName ?? "",
      shortDate: d.shortDate ?? "",
      zoomPercent: d.zoomPercent ?? 100,
      zoomUnit: d.zoomUnit ?? "",
    };
  };

  private _onEventClick = (e: Event): void => {
    this._openEditor((e as CustomEvent).detail?.id);
  };

  private _onViewChangeEvent = (e: Event): void => {
    const next = (e as CustomEvent).detail?.view as ViewType | undefined;
    if (next) this._switchView(next);
  };

  // ── Emit helpers ───────────────────────────────────────────────────────────
  private _emit<T>(name: string, detail: T): void {
    this.dispatchEvent(
      new CustomEvent<T>(name, { detail, bubbles: true, composed: true }),
    );
  }

  private _emitChange(detail: JanusAppChangeDetail): void {
    this._emit<JanusAppChangeDetail>("change", detail);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  private _editorValues() {
    const stored = this._selectedEventId
      ? this.schedulerManager.getEvent(this._selectedEventId)
      : null;

    if (!stored) {
      return {
        title: this._draft ? "New Event" : "",
        startDate: this._draft?.startDate,
        startTime: this._draft?.startTime,
        endDate: this._draft?.endDate,
        endTime: this._draft?.endTime,
        participants: this._draft?.participants,
        description: undefined as string | undefined,
        color: undefined as string | undefined,
        allDay: false,
        recurrenceRule: "",
      };
    }

    const tz = stored.timezone || this._tz();
    const start = isoToZonedDisplay(stored.startTime, tz);
    const end = isoToZonedDisplay(stored.endTime, tz);
    return {
      title: stored.title,
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      participants: stored.resourceIds || undefined,
      description: stored.description,
      color: stored.color,
      allDay: stored.allDay,
      recurrenceRule: stored.recurrenceRule,
    };
  }

  render() {
    const v = this._editorValues();
    return html`
      <div class="janus-app">
        <janus-topbar
          .navLabel=${this._nav.navLabel}
          .dayName=${this._nav.dayName}
          .shortDate=${this._nav.shortDate}
          .view=${this.view}
          .views=${this.views}
          .allowCreate=${this._allowCreate}
          .canUndo=${this._canUndo}
          .zoomPercent=${this._nav.zoomPercent}
          .zoomUnit=${this._nav.zoomUnit}
          .isGoogleCalendarConnected=${this.googleConnected}
          @prev-click=${() => this._activeNav()?.goToPrev()}
          @next-click=${() => this._activeNav()?.goToNext()}
          @today-click=${() => this._activeNav()?.goToToday()}
          @view-switch=${this._onViewChangeEvent}
          @toggle-create=${() => {
            if (this.view === "Timeline") this._activeNav()?.toggleCreate?.();
            this._allowCreate = !this._allowCreate;
          }}
          @undo-click=${() => this.schedulerManager.undo()}
          @connect-calendar=${() => this._emit("connect-calendar", {})}
        ></janus-topbar>

        <!-- Timeline and Month stay mounted so their scroll/zoom state survives
             a view switch; the heavier grids are created on demand. -->
        <div class="view" ?hidden=${this.view !== "Timeline"}>
          <janus-timeline
            id="timeline"
            .allowCreate=${this._allowCreate}
            .showFab=${true}
            .preventConflicts=${this.preventConflicts}
            .resourceTypeConfig=${this.resourceTypeConfig}
            .timezone=${this.timezone}
            @add-event=${() => this._openEditor()}
            @event-click=${this._onEventClick}
            @event-move=${this._onTimelineMove}
            @event-resize=${this._onResize}
            @event-create=${this._onTimelineCreate}
            @header-date-click=${(e: Event) =>
              this._goToDateIn("Day", (e as CustomEvent).detail.date)}
            @view-change=${this._onViewChangeEvent}
            @nav-change=${(e: Event) => {
              if (this.view === "Timeline") this._onNavChange(e);
            }}
          ></janus-timeline>
        </div>

        <div class="view" ?hidden=${this.view !== "Month"}>
          <janus-month-grid
            id="month"
            .showFab=${true}
            .navLinks=${true}
            .timezone=${this.timezone}
            @add-event=${() => this._openEditor()}
            @event-click=${this._onEventClick}
            @day-header-click=${(e: Event) =>
              this._goToDateIn("Day", (e as CustomEvent).detail.date)}
            @slot-select=${(e: Event) => {
              const date = (e as CustomEvent).detail.date;
              this._openEditor(undefined, {
                startDate: date,
                startTime: "09:00",
                endDate: date,
                endTime: "10:00",
                showConfirmOnCreate: true,
              });
            }}
            @view-change=${this._onViewChangeEvent}
            @nav-change=${(e: Event) => {
              if (this.view === "Month") this._onNavChange(e);
            }}
          ></janus-month-grid>
        </div>

        ${
          this.view === "Day"
            ? html`<janus-day-grid
                id="day"
                class="view"
                .showFab=${true}
                .navLinks=${true}
                .allowCreate=${this._allowCreate}
                @add-event=${() => this._openEditor()}
                @event-click=${this._onEventClick}
                @slot-select=${this._onSlotSelect}
                @event-move=${this._onTimeGridMove}
                @event-resize=${this._onTimeGridResize}
                @view-change=${this._onViewChangeEvent}
                @nav-change=${this._onNavChange}
              ></janus-day-grid>`
            : nothing
        }
        ${
          this.view === "Week"
            ? html`<janus-week-grid
                id="week"
                class="view"
                .showFab=${true}
                .navLinks=${true}
                .allowCreate=${this._allowCreate}
                @add-event=${() => this._openEditor()}
                @event-click=${this._onEventClick}
                @slot-select=${this._onSlotSelect}
                @event-move=${this._onTimeGridMove}
                @event-resize=${this._onTimeGridResize}
                @day-header-click=${(e: Event) =>
                  this._goToDateIn("Day", (e as CustomEvent).detail.date)}
                @day-click=${(e: Event) =>
                  this._goToDateIn("Day", (e as CustomEvent).detail.date)}
                @view-change=${this._onViewChangeEvent}
                @nav-change=${this._onNavChange}
              ></janus-week-grid>`
            : nothing
        }
        ${
          this.view === "Year"
            ? html`<janus-year-grid
                id="year"
                class="view"
                .navLinks=${true}
                @day-click=${(e: Event) =>
                  this._goToDateIn("Day", (e as CustomEvent).detail.date)}
                @month-header-click=${(e: Event) =>
                  this._goToDateIn("Month", (e as CustomEvent).detail.date)}
                @view-change=${this._onViewChangeEvent}
                @nav-change=${this._onNavChange}
              ></janus-year-grid>`
            : nothing
        }
        ${
          this._showEditor
            ? html`<janus-scheduler
                .eventId=${this._selectedEventId}
                .error=${this._editorError}
                .preventConflicts=${this.preventConflicts}
                .title=${v.title}
                .startDate=${v.startDate ?? ""}
                .startTime=${v.startTime ?? ""}
                .endDate=${v.endDate ?? ""}
                .endTime=${v.endTime ?? ""}
                .participants=${v.participants ?? []}
                .description=${v.description ?? ""}
                .activeColor=${v.color ?? "primary"}
                .allDay=${v.allDay ?? false}
                .recurrenceRule=${v.recurrenceRule ?? ""}
                .timezone=${this.timezone}
                .showConfirmOnCreate=${
                  !this._selectedEventId && !!this._draft?.showConfirmOnCreate
                }
                @close=${() => this._closeEditor()}
                @save=${(e: Event) => this._handleSave((e as CustomEvent).detail)}
                @delete=${(e: Event) =>
                  this._handleDelete((e as CustomEvent).detail.id)}
              ></janus-scheduler>`
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "janus-app": JanusApp;
  }
}
