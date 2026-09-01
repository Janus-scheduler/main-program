import { LitElement, html, nothing, type TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";
// Reuse the timeline's existing icons and avatar helpers so a resource looks
// identical wherever it appears.
import { PlusIcon, RoomIcon, EquipmentIcon } from "./timeline-icons";
import { getInitials, avatarColor } from "./timeline-utils";
import type { TimeGridEvent, TimeGridEventResource } from "./time-grid-types";
import {
  assignEventsToDays,
  buildHourMarks,
  buildTimeGridEvents,
  fmt12,
  formatEventTimeRange,
  formatHourLabel,
  formatShortDate,
  nowMinutesFor,
  timeStrFromMinutes,
  type PositionedEvent,
  type TimeGridDay,
} from "./time-grid-utils";
import {
  TimeGridDragController,
  type TimeGridColumnBounds,
} from "./time-grid-drag";

import {
  schedulerStore,
  type SchedulerState,
  type ViewType,
} from "@janus-scheduler/core";

/** Below this width the views switch to their compact layouts. */
const NARROW_BREAKPOINT = 640;

/**
 * Shortest event card that still has room for a row of resource avatars
 * beneath the title and time. Below this the avatars are dropped rather than
 * overflowing the card — the names stay reachable via the card's tooltip.
 */
const MIN_HEIGHT_FOR_AVATARS = 56;

/** How often the now-line re-renders. */
const NOW_TICK_MS = 60_000;

/**
 * Shared implementation of the two hour-grid views.
 *
 * `<janus-day-grid>` and `<janus-week-grid>` differ only in how many day
 * columns they show and how navigation steps — everything else (store
 * subscription, layout, all-day row, now-line, slot selection, event
 * dispatching) lives here so the two components stay thin.
 *
 * Subclasses must provide {@link viewType}, {@link navStepDays},
 * {@link buildVisibleDays} and {@link navLabel}.
 *
 * @fires event-click  - An event block or all-day chip was clicked.
 * @fires day-click    - A column header (or mobile strip day) was clicked.
 * @fires slot-select  - An empty region of the grid was clicked.
 * @fires add-event    - The FAB was clicked.
 * @fires view-change  - `setView()` was called.
 * @fires nav-change   - The visible range changed; carries the topbar labels.
 */
export abstract class JanusTimeGridBase extends LitElement {
  // ── Public properties ─────────────────────────────────────────────────

  /** When true, renders a + Floating Action Button to add an event. Default: false */
  @property({ type: Boolean, attribute: "show-fab" }) showFab = false;

  /** When true, clicking an empty slot emits `slot-select`. Default: true */
  @property({ type: Boolean, attribute: "allow-create" }) allowCreate = true;

  /** First hour rendered (0–23). Default: 0 */
  @property({ type: Number, attribute: "start-hour" }) startHour = 0;

  /** Last hour rendered, exclusive (1–24). Default: 24 */
  @property({ type: Number, attribute: "end-hour" }) endHour = 24;

  /** Granularity of click-to-create, in minutes. Default: 30 */
  @property({ type: Number, attribute: "slot-minutes" }) slotMinutes = 30;

  /** Default duration of a slot-select, in minutes. Default: 60 */
  @property({ type: Number, attribute: "default-duration" }) defaultDuration =
    60;

  /** Hour the grid scrolls to on first paint. Default: 8 */
  @property({ type: Number, attribute: "scroll-to-hour" }) scrollToHour = 8;

  /**
   * Optional externally supplied events. When set (non-null), these take
   * precedence over events derived from the shared scheduler store, letting
   * consumers drive the grid directly via the `events` property. Leave unset
   * (null) to use the default store-subscription behavior.
   */
  @property({ attribute: false }) events: TimeGridEvent[] | null = null;

  // ── Internal state ────────────────────────────────────────────────────

  /** The date the visible range is derived from. */
  @state() protected _anchor: Date = new Date();
  @state() private _storeEvents: TimeGridEvent[] = [];
  @state() private _hoveredEventId: string | null = null;
  @state() protected _isNarrow = false;
  @state() private _nowTick = 0;

  private _unsubStore?: () => void;
  private _resizeObserver?: ResizeObserver;
  private _nowTimer?: ReturnType<typeof setInterval>;
  private _hasScrolled = false;

  /** Shared move/resize drag controller — see time-grid-drag.ts. */
  private _drag = new TimeGridDragController(() => this.requestUpdate());
  /** Suppresses the synthetic click that follows a real drag release. */
  private _wasDragging = false;
  private _dragUpHandler?: () => void;
  private _dragCancelHandler?: () => void;

  // ── Subclass contract ─────────────────────────────────────────────────

  /** The `ViewType` this component represents ("Day" | "Week"). */
  protected abstract readonly viewType: ViewType;

  /** The view this component renders — read-only mirror of {@link viewType}. */
  public get view(): ViewType {
    return this.viewType;
  }

  /** How many days prev/next moves by. */
  protected abstract get navStepDays(): number;

  /** Height of one hour row in px — also drives the `--hour-h` custom property. */
  protected abstract get hourHeight(): number;

  /** The bare day columns to render, in order. */
  protected abstract buildVisibleDays(): TimeGridDay[];

  /**
   * Days the store query must cover. Defaults to the visible columns; the Day
   * view widens it so its mobile week strip can show density dots for days it
   * isn't currently rendering.
   */
  protected buildFetchDays(): TimeGridDay[] {
    return this.buildVisibleDays();
  }

  /** The label the topbar shows for the current range. */
  protected abstract get navLabel(): string;

  /** Extra markup rendered above the column headers (the Day view's strip). */
  protected renderAboveHeader(): TemplateResult | typeof nothing {
    return nothing;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  connectedCallback() {
    super.connectedCallback();
    this._unsubStore = schedulerStore.subscribe((state) => {
      this._syncFromStore(state);
    });
    this._syncFromStore(schedulerStore.getState());
    this._nowTimer = setInterval(() => {
      this._nowTick++;
    }, NOW_TICK_MS);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubStore?.();
    this._resizeObserver?.disconnect();
    if (this._nowTimer) clearInterval(this._nowTimer);
    this._removeDragListeners();
    this._drag.cancel();
  }

  override firstUpdated() {
    this._isNarrow =
      this.offsetWidth > 0 && this.offsetWidth < NARROW_BREAKPOINT;
    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const narrow = entry.contentRect.width < NARROW_BREAKPOINT;
        if (narrow !== this._isNarrow) this._isNarrow = narrow;
      }
    });
    this._resizeObserver.observe(this);

    this._emitNavChange();
  }

  override updated() {
    if (!this._hasScrolled) {
      this._scrollToDefaultHour();
    }
  }

  willUpdate(changed: Map<string, unknown>) {
    // The visible window moved, so the store slice we need moved with it.
    if (changed.has("_anchor") || changed.has("_isNarrow")) {
      this._syncFromStore(schedulerStore.getState());
    }
  }

  /** Bring the configured hour into view on first paint. */
  private _scrollToDefaultHour() {
    const body = this.shadowRoot?.querySelector(".tg-body");
    if (!body) return;

    // Header and (when present) the all-day row are sticky rows inside the
    // same scrolling content as the hour grid, not separate fixed chrome —
    // so scrollTop=0 lands on them, and the hour grid starts after their
    // real (flow) height.
    const headerH =
      this.shadowRoot?.querySelector(".tg-head__cell")?.getBoundingClientRect()
        .height ?? 0;
    const alldayH =
      this.shadowRoot
        ?.querySelector(".tg-allday__cell, .tg-allday__label")
        ?.getBoundingClientRect().height ?? 0;

    const offsetHours = Math.max(0, this.scrollToHour - this.startHour);
    body.scrollTop = headerH + alldayH + offsetHours * this.hourHeight;
    this._hasScrolled = true;
  }

  // ── Store sync ────────────────────────────────────────────────────────

  private _syncFromStore(state: SchedulerState) {
    const days = this.buildFetchDays();
    if (days.length === 0) {
      this._storeEvents = [];
      return;
    }

    // Widen the query by a day on each side so events that start the previous
    // evening (or end the next morning) still contribute their segment.
    const first = days[0].date;
    const last = days[days.length - 1].date;
    const startRange = new Date(
      first.getFullYear(),
      first.getMonth(),
      first.getDate() - 1,
    ).getTime();
    const endRange = new Date(
      last.getFullYear(),
      last.getMonth(),
      last.getDate() + 2,
      0,
      0,
      0,
      -1,
    ).getTime();

    const resourceMap = new Map<string, TimeGridEventResource>(
      Object.values(state.resources).map((r) => [
        r.id,
        {
          id: r.id,
          name: r.name,
          avatar: r.avatar,
          type: r.type as TimeGridEventResource["type"],
        },
      ]),
    );

    this._storeEvents = buildTimeGridEvents(
      Object.values(state.events),
      state.timezone,
      startRange,
      endRange,
      resourceMap,
    );
  }

  /** External `events` property wins over store-derived events when set. */
  private get _effectiveEvents(): TimeGridEvent[] {
    return this.events ?? this._storeEvents;
  }

  // ── Navigation ────────────────────────────────────────────────────────

  private _shiftAnchor(days: number) {
    const d = new Date(this._anchor);
    d.setDate(d.getDate() + days);
    this._anchor = d;
    this._emitNavChange();
  }

  public goToPrev() {
    this._shiftAnchor(-this.navStepDays);
  }

  public goToNext() {
    this._shiftAnchor(this.navStepDays);
  }

  public goToToday() {
    this._anchor = new Date();
    this._emitNavChange();
  }

  /** Jump to an arbitrary date — mirrors `<janus-timeline>.goToDate()`. */
  public goToDate(date: string | number | Date) {
    const d =
      typeof date === "string"
        ? // "YYYY-MM-DD" parsed as local, not UTC
          (() => {
            const [y, m, day] = date.split("-").map(Number);
            return Number.isNaN(y) ? new Date(date) : new Date(y, m - 1, day);
          })()
        : new Date(date);
    if (Number.isNaN(d.getTime())) return;
    this._anchor = d;
    this._emitNavChange();
  }

  public setView(v: ViewType) {
    this.dispatchEvent(
      new CustomEvent("view-change", {
        detail: { view: v },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── Event dispatchers ─────────────────────────────────────────────────

  private _emitNavChange() {
    const days = this.buildVisibleDays();
    const focus = days.find((d) => d.isToday) ?? days[0] ?? null;

    this.dispatchEvent(
      new CustomEvent("nav-change", {
        detail: {
          navLabel: this.navLabel,
          dayName: focus ? focus.dowLong.toUpperCase() : "",
          shortDate: focus ? formatShortDate(focus.date) : "",
          zoomPercent: 100,
          zoomUnit: "",
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleEventClick(ev: TimeGridEvent) {
    // A drag release fires a native click right after on the same element —
    // swallow exactly that one so a completed drag doesn't also open the event.
    if (this._wasDragging) {
      this._wasDragging = false;
      return;
    }
    this.dispatchEvent(
      new CustomEvent("event-click", {
        detail: ev,
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected _handleDayClick(day: TimeGridDay) {
    this.dispatchEvent(
      new CustomEvent("day-click", {
        detail: { date: day.dateStr },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleAddEvent() {
    this.dispatchEvent(
      new CustomEvent("add-event", { bubbles: true, composed: true }),
    );
  }

  private _emitSlotSelect(dateStr: string, startMin: number) {
    const endMin = Math.min(
      this.endHour * 60,
      startMin + Math.max(this.slotMinutes, this.defaultDuration),
    );
    this.dispatchEvent(
      new CustomEvent("slot-select", {
        detail: {
          date: dateStr,
          startTime: timeStrFromMinutes(startMin),
          endTime: timeStrFromMinutes(endMin),
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── Slot hit-testing ──────────────────────────────────────────────────

  /** Snap a pixel offset inside a column to the start minute of its slot. */
  private _minuteAt(offsetY: number): number {
    const minutesFromTop = offsetY / (this.hourHeight / 60);
    const raw = this.startHour * 60 + minutesFromTop;
    const snapped = Math.floor(raw / this.slotMinutes) * this.slotMinutes;
    return Math.max(
      this.startHour * 60,
      Math.min(this.endHour * 60 - this.slotMinutes, snapped),
    );
  }

  private _handleSlotClick(e: MouseEvent, day: TimeGridDay) {
    // A completed drag (move/resize/create-by-drag) fires a native click
    // right after on the same element — swallow exactly that one so it
    // doesn't also create a second, default-duration event underneath it.
    if (this._wasDragging) {
      this._wasDragging = false;
      return;
    }
    if (!this.allowCreate) return;
    this._emitSlotSelect(day.dateStr, this._minuteAt(e.offsetY));
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────

  /** Viewport bounds of every visible day column, keyed by its `data-date`. */
  private _computeColumnBounds(): TimeGridColumnBounds[] {
    const cols =
      this.shadowRoot?.querySelectorAll<HTMLElement>(".tg-col[data-date]");
    if (!cols) return [];
    return Array.from(cols).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        dateStr: el.dataset.date ?? "",
        left: rect.left,
        right: rect.right,
      };
    });
  }

  private _onEventPointerDown(
    e: PointerEvent,
    ev: TimeGridEvent,
    dateStr: string,
  ) {
    if (e.button !== 0) return;
    // A multi-day event's on-screen segment is a clamped fragment (e.g.
    // "00:00"–"18:00" for the day it spills into) — its on-screen time
    // doesn't map cleanly back onto the real, multi-day event, so only
    // single-day events support drag-to-move.
    if (ev.isMultiDay) return;
    this._drag.updateLayout(
      this._pxPerMinute,
      this.slotMinutes,
      this._windowStartMin,
      this._windowEndMin,
      this._computeColumnBounds(),
    );
    this._drag.startMove(e, ev, dateStr);
    this._addDragUpListener();
  }

  private _onResizePointerDown(
    e: PointerEvent,
    ev: TimeGridEvent,
    dateStr: string,
    edge: "start" | "end",
  ) {
    if (e.button !== 0) return;
    // See _onEventPointerDown — multi-day segments can't be resized either.
    if (ev.isMultiDay) return;
    // Resizing never crosses a day column, so no bounds are needed.
    this._drag.updateLayout(
      this._pxPerMinute,
      this.slotMinutes,
      this._windowStartMin,
      this._windowEndMin,
      [],
    );
    this._drag.startResize(e, ev, dateStr, edge);
    this._addDragUpListener();
  }

  /**
   * Draw-to-create — mirrors `<janus-timeline>`'s row-background drag.
   * Child elements (events, resize handles) already stop propagation on
   * their own pointerdown, so this only ever fires for genuine empty space.
   */
  private _onColumnPointerDown(e: PointerEvent, day: TimeGridDay) {
    if (e.button !== 0) return;
    if (!this.allowCreate) return;
    const colTop = (e.currentTarget as HTMLElement).getBoundingClientRect().top;
    this._drag.updateLayout(
      this._pxPerMinute,
      this.slotMinutes,
      this._windowStartMin,
      this._windowEndMin,
      [], // creating never crosses columns
    );
    this._drag.startCreate(e, day.dateStr, colTop);
    this._addDragUpListener();
  }

  private _removeDragListeners() {
    if (this._dragUpHandler) {
      document.removeEventListener("pointerup", this._dragUpHandler);
      this._dragUpHandler = undefined;
    }
    if (this._dragCancelHandler) {
      document.removeEventListener("pointercancel", this._dragCancelHandler);
      this._dragCancelHandler = undefined;
    }
  }

  private _addDragUpListener() {
    this._removeDragListeners();

    this._dragUpHandler = () => {
      this._removeDragListeners();
      const result = this._drag.completeAndGetResult();
      if (!result) return;

      this._wasDragging = true;

      if (result.type === "event-move") {
        this.dispatchEvent(
          new CustomEvent("event-move", {
            detail: {
              event: result.event,
              oldDate: result.oldDate,
              newDate: result.newDate,
              newStartTime: result.newStartTime,
              newEndTime: result.newEndTime,
            },
            bubbles: true,
            composed: true,
          }),
        );
      } else if (result.type === "event-resize") {
        this.dispatchEvent(
          new CustomEvent("event-resize", {
            detail: {
              event: result.event,
              date: result.date,
              newStartTime: result.newStartTime,
              newEndTime: result.newEndTime,
            },
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        this.dispatchEvent(
          new CustomEvent("slot-select", {
            detail: {
              date: result.date,
              startTime: result.startTime,
              endTime: result.endTime,
            },
            bubbles: true,
            composed: true,
          }),
        );
      }
    };

    this._dragCancelHandler = () => {
      this._removeDragListeners();
      this._drag.cancel();
    };

    document.addEventListener("pointerup", this._dragUpHandler);
    document.addEventListener("pointercancel", this._dragCancelHandler);
  }

  // ── Render helpers ────────────────────────────────────────────────────

  private get _windowStartMin() {
    return this.startHour * 60;
  }

  private get _windowEndMin() {
    return this.endHour * 60;
  }

  private get _pxPerMinute() {
    return this.hourHeight / 60;
  }

  private get _bodyHeight() {
    return (this.endHour - this.startHour) * this.hourHeight;
  }

  /** Day columns with their events resolved and positioned. */
  protected buildPopulatedDays(): TimeGridDay[] {
    const days = this.buildVisibleDays();
    assignEventsToDays(
      days,
      this._effectiveEvents,
      this._windowStartMin,
      this._windowEndMin,
      this._pxPerMinute,
    );
    return days;
  }

  private _renderGutter() {
    const marks = buildHourMarks(this.startHour, this.endHour);
    return html`
      <div class="tg-gutter">
        ${marks.map(
          (h) => html`
            <div class="tg-gutter__mark">${formatHourLabel(h)}</div>
          `,
        )}
      </div>
    `;
  }

  private _renderChip(ev: TimeGridEvent) {
    return html`
      <button
        class="tg-chip tg-chip--${ev.color}"
        title="${ev.title}"
        @click=${(e: Event) => {
          e.stopPropagation();
          this._handleEventClick(ev);
        }}
      >
        ${ev.title}
      </button>
    `;
  }

  /** One round resource avatar — mirrors `<janus-timeline>`'s renderAvatar. */
  private _renderAvatar(r: TimeGridEventResource) {
    if (r.avatar) {
      return html`<img
        class="tg-avatar tg-avatar--image"
        src="${r.avatar}"
        alt="${r.name}"
        title="${r.name}"
      />`;
    }
    if (r.type === "room" || r.type === "equipment") {
      return html`
        <span
          class="tg-avatar tg-avatar--icon tg-avatar--${r.type}"
          title="${r.name}"
        >
          ${r.type === "room" ? RoomIcon() : EquipmentIcon()}
        </span>
      `;
    }
    return html`<span
      class="tg-avatar tg-avatar--initials"
      style="background: ${avatarColor(r.id)}"
      title="${r.name}"
      >${getInitials(r.name)}</span
    >`;
  }

  /**
   * The stacked avatar row on an event card.
   *
   * @param maxAvatars how many fit before overflowing into a "+N" badge —
   *   a Day view column is far wider than one of seven Week columns.
   */
  private _renderAvatars(ev: TimeGridEvent, maxAvatars: number) {
    const resources = ev.resources;
    if (!resources || resources.length === 0) return nothing;

    const shown = resources.slice(0, maxAvatars);
    const overflow = resources.length - shown.length;

    // The stack is the only part allowed to clip — the "+N" badge sits outside
    // it so a narrow card can never cut the count in half.
    return html`
      <span class="tg-event__avatars">
        <span class="tg-event__avatar-stack">
          ${shown.map((r) => this._renderAvatar(r))}
        </span>
        ${
          overflow > 0
            ? html`<span
                class="tg-avatar tg-avatar--more"
                title="${resources
                  .slice(maxAvatars)
                  .map((r) => r.name)
                  .join(", ")}"
                >+${overflow}</span
              >`
            : nothing
        }
      </span>
    `;
  }

  private _renderEvent(
    pos: PositionedEvent,
    dateStr: string,
    singleColumn: boolean,
  ) {
    const { event: ev } = pos;
    // Below ~34px there is no room for a second line of text.
    const compact = pos.height < 34;
    const dragging = this._drag.isDraggingEvent(ev);
    const resizing = this._drag.isResizingEvent(ev);
    // Multi-day segments are clamped fragments — see _onEventPointerDown.
    const draggable = !ev.isMultiDay;

    const classes = [
      "tg-event",
      `tg-event--${ev.color}`,
      compact ? "tg-event--compact" : "",
      pos.clipTop ? "tg-event--clip-top" : "",
      pos.clipBottom ? "tg-event--clip-bottom" : "",
      this._hoveredEventId === ev.id ? "tg-event--hovered" : "",
      dragging ? "tg-event--dragging" : "",
      resizing ? "tg-event--resizing" : "",
      draggable ? "" : "tg-event--static",
    ]
      .filter(Boolean)
      .join(" ");

    // Leave a sliver of gutter on the right so stacked events stay legible.
    const width = pos.width - (pos.width < 100 ? 1 : 0);

    // A Day column is the full grid width; a Week column is one of seven, and
    // narrower still once overlapping events split it into side-by-side halves.
    const maxAvatars = singleColumn ? 6 : pos.width >= 100 ? 3 : 2;
    const showAvatars = pos.height >= MIN_HEIGHT_FOR_AVATARS;
    // Names go in the tooltip regardless, so they stay reachable on cards too
    // short to draw the avatar row.
    const resourceNames = ev.resources?.map((r) => r.name).join(", ") ?? "";

    return html`
      <button
        class=${classes}
        style="
          top: ${pos.top}px;
          height: ${pos.height}px;
          left: calc(${pos.left}% + 3px);
          width: calc(${width}% - 6px);
        "
        title="${formatEventTimeRange(ev)} · ${ev.title}${
          resourceNames ? ` · ${resourceNames}` : ""
        }"
        @pointerdown=${(e: PointerEvent) =>
          this._onEventPointerDown(e, ev, dateStr)}
        @click=${(e: Event) => {
          e.stopPropagation();
          this._handleEventClick(ev);
        }}
        @mouseenter=${() => {
          this._hoveredEventId = ev.id;
        }}
        @mouseleave=${() => {
          this._hoveredEventId = null;
        }}
      >
        ${
          draggable
            ? html`<div
                class="tg-event-resize-handle tg-event-resize-handle--top"
                @pointerdown=${(e: PointerEvent) =>
                  this._onResizePointerDown(e, ev, dateStr, "start")}
              ></div>`
            : nothing
        }
        <span class="tg-event__title">${ev.title}</span>
        <span class="tg-event__time">${fmt12(ev.startTime)}</span>
        ${showAvatars ? this._renderAvatars(ev, maxAvatars) : nothing}
        ${
          draggable
            ? html`<div
                class="tg-event-resize-handle tg-event-resize-handle--bottom"
                @pointerdown=${(e: PointerEvent) =>
                  this._onResizePointerDown(e, ev, dateStr, "end")}
              ></div>`
            : nothing
        }
      </button>
    `;
  }

  private _renderDragGhost(dateStr: string) {
    if (!this._drag.active || this._drag.ghost.dateStr !== dateStr) {
      return nothing;
    }
    const g = this._drag.ghost;

    // Drawing a new event has no source event to read a color/title from.
    if (this._drag.mode === "creating") {
      return html`
        <div
          class="tg-drag-ghost tg-drag-ghost--primary"
          style="top: ${g.top}px; height: ${g.height}px;"
        >
          <span class="tg-drag-ghost__title">New Event</span>
          <span class="tg-drag-ghost__time">${g.timeLabel}</span>
        </div>
      `;
    }

    const ev = this._drag.activeEvent;
    if (!ev) return nothing;

    return html`
      <div
        class="tg-drag-ghost tg-drag-ghost--${ev.color}"
        style="top: ${g.top}px; height: ${g.height}px;"
      >
        <span class="tg-drag-ghost__title">${ev.title}</span>
        <span class="tg-drag-ghost__time">${g.timeLabel}</span>
      </div>
    `;
  }

  private _renderNowLine(day: TimeGridDay, showLabel: boolean) {
    if (!day.isToday) return nothing;
    const nowMin = nowMinutesFor(
      day.dateStr,
      schedulerStore.getState().timezone,
    );
    if (
      nowMin === null ||
      nowMin < this._windowStartMin ||
      nowMin > this._windowEndMin
    ) {
      return nothing;
    }

    const top = (nowMin - this._windowStartMin) * this._pxPerMinute;
    return html`
      <div class="tg-now" style="top: ${top}px">
        <span class="tg-now__dot"></span>
        ${
          showLabel
            ? html`<span class="tg-now__label"
                >${fmt12(timeStrFromMinutes(nowMin))}</span
              >`
            : nothing
        }
      </div>
    `;
  }

  /**
   * @param singleColumn true in the Day view — the column spans the whole grid,
   *   so there is room for the now-line's time pill and a wider avatar stack.
   */
  private _renderColumn(
    day: TimeGridDay,
    singleColumn: boolean,
    isLast: boolean,
  ) {
    const classes = [
      "tg-col",
      day.isToday ? "tg-col--today" : "",
      day.isWeekend ? "tg-col--weekend" : "",
      isLast ? "tg-col--last" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return html`
      <div
        class=${classes}
        data-date="${day.dateStr}"
        style="height: ${this._bodyHeight}px"
        @pointerdown=${(e: PointerEvent) => this._onColumnPointerDown(e, day)}
        @click=${(e: MouseEvent) => this._handleSlotClick(e, day)}
      >
        <div class="tg-col__lines"></div>
        ${day.timedEvents.map((pos) =>
          this._renderEvent(pos, day.dateStr, singleColumn),
        )}
        ${this._renderNowLine(day, singleColumn)}
        ${this._renderDragGhost(day.dateStr)}
      </div>
    `;
  }

  private _renderHeaderCell(day: TimeGridDay, isLast: boolean) {
    const classes = [
      "tg-head__cell",
      day.isToday ? "tg-head__cell--today" : "",
      isLast ? "tg-head__cell--last" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return html`
      <div class=${classes} @click=${() => this._handleDayClick(day)}>
        <span class="tg-head__dow">${day.dowShort}</span>
        <span class="tg-head__num">${day.dayNum}</span>
      </div>
    `;
  }

  private _renderAllDayCell(day: TimeGridDay, isLast: boolean) {
    const classes = ["tg-allday__cell", isLast ? "tg-allday__cell--last" : ""]
      .filter(Boolean)
      .join(" ");

    return html`
      <div class=${classes}>
        ${day.allDayEvents.map((ev) => this._renderChip(ev))}
      </div>
    `;
  }

  // ── Main render ───────────────────────────────────────────────────────

  render() {
    // Referenced so the interval tick re-runs the now-line maths.
    void this._nowTick;

    const days = this.buildPopulatedDays();
    // Day view — one full-width column, so the now-line's time pill fits and
    // event cards have room for a wider resource-avatar stack.
    const singleColumn = days.length === 1;
    const hasAllDay = days.some((d) => d.allDayEvents.length > 0);
    const lastIdx = days.length - 1;

    return html`
      <div
        class="tg-shell"
        style="--col-count: ${days.length}; --hour-h: ${this.hourHeight}px;"
      >
        ${this.renderAboveHeader()}

        <div class="tg-body">
          <div class="tg-grid">
            <div class="tg-head__corner"></div>
            ${days.map((day, i) => this._renderHeaderCell(day, i === lastIdx))}
            ${
              hasAllDay
                ? html`
                    <div class="tg-allday__label">All-day</div>
                    ${days.map((day, i) =>
                      this._renderAllDayCell(day, i === lastIdx),
                    )}
                  `
                : nothing
            }
            ${this._renderGutter()}
            ${days.map((day, i) =>
              this._renderColumn(day, singleColumn, i === lastIdx),
            )}
          </div>
        </div>

        ${
          this.showFab
            ? html`
                <button
                  class="tg-fab"
                  @click=${this._handleAddEvent}
                  aria-label="Add event"
                >
                  ${PlusIcon()}
                </button>
              `
            : nothing
        }
      </div>
    `;
  }

  // ── Shared helpers for subclasses ─────────────────────────────────────

  /** True when `dateStr` has at least one event — used by the mobile strip. */
  protected hasEventsOn(dateStr: string): boolean {
    return this._effectiveEvents.some((e) => e.date === dateStr);
  }
}
