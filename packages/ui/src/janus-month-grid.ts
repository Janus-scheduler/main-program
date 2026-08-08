import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { monthGridStyles } from "./month-grid-styles";
import { MonthEvent } from "./month-grid-types";
import "./janus-ai-bar";

import {
  WEEK_DAYS,
  CalendarDay,
  buildCalendarGrid,
  formatMonthYear,
  fmt12,
} from "./month-grid-utils";
import { PlusIcon } from "./timeline-icons"; // reuse existing icons

import {
  schedulerStore,
  expandEvents,
  type EventColor,
  type SchedulerState,
  type ViewType,
} from "@janus-scheduler/core";

interface WeekEventBar extends MonthEvent {
  startIdx: number;
  endIdx: number;
  track: number;
}

/** "YYYY-MM-DD" from a Date using local components */
function toLocalDateStr(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "HH:MM" from a Date using UTC components */
function toUtcTimeStr(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

@customElement("janus-month-grid")
export class JanusMonthGrid extends LitElement {
  static readonly styles = monthGridStyles;

  /** When true, renders a + Floating Action Button to add an event. Default: false */
  @property({ type: Boolean, attribute: "show-fab" }) showFab = false;

  /**
   * Optional externally supplied events. When set (non-null), these take
   * precedence over events derived from the shared scheduler store, letting
   * consumers drive the grid directly via the `events` property. Leave unset
   * (null) to use the default store-subscription behavior.
   */
  @property({ attribute: false }) events: MonthEvent[] | null = null;

  // ── Internal state ────────────────────────────────────────────────────
  @state() private _events: MonthEvent[] = [];
  @state() private _gridHeight = 0;
  private _unsubStore?: () => void;
  private _resizeObserver?: ResizeObserver;

  connectedCallback() {
    super.connectedCallback();
    this._unsubStore = schedulerStore.subscribe((state) => {
      this._syncFromStore(state);
    });
    this._syncFromStore(schedulerStore.getState());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._unsubStore) this._unsubStore();
    if (this._resizeObserver) this._resizeObserver.disconnect();
  }

  private _syncFromStore(state: SchedulerState) {
    const rawEvents = Object.values(state.events);
    const startRange = new Date(this._year, this._month - 1, 1).getTime();
    const endRange = new Date(
      this._year,
      this._month + 2,
      0,
      23,
      59,
      59,
      999,
    ).getTime();
    const coreEvents = expandEvents(rawEvents, startRange, endRange);
    console.log("MonthGrid sync:", {
      rawEvents: rawEvents.length,
      coreEvents: coreEvents.length,
      startRange: new Date(startRange),
      endRange: new Date(endRange),
    });

    const newEvents: MonthEvent[] = [];

    for (const e of coreEvents) {
      const startD = new Date(e.startTime);
      const endD = new Date(e.endTime);

      const startDateStr = toLocalDateStr(startD);
      const endDateStr = toLocalDateStr(endD);
      const startTimeStr = toUtcTimeStr(startD);
      const endTimeStr = toUtcTimeStr(endD);

      // Clamp loop bounds to the visible month window [startRange, endRange]
      const loopStartMs = Math.max(startD.getTime(), startRange);
      const loopEndMs = Math.min(endD.getTime(), endRange);

      if (loopStartMs > loopEndMs) continue;

      const loopStartD = new Date(loopStartMs);
      const loopEndD = new Date(loopEndMs);

      // Create a local midnight/noon safe cursor to iterate through all calendar dates.
      // Setting time to 12:00:00 avoids timezone/DST boundary jump errors.
      const current = new Date(
        loopStartD.getFullYear(),
        loopStartD.getMonth(),
        loopStartD.getDate(),
        12,
        0,
        0,
      );
      const endLimit = new Date(
        loopEndD.getFullYear(),
        loopEndD.getMonth(),
        loopEndD.getDate(),
        12,
        0,
        0,
      );

      while (current <= endLimit) {
        const currentDateStr = toLocalDateStr(current);
        const isMultiDay = startDateStr !== endDateStr;

        let spanPosition: MonthEvent["spanPosition"] = "single";
        if (isMultiDay) {
          if (currentDateStr === startDateStr) {
            spanPosition = "start";
          } else if (currentDateStr === endDateStr) {
            spanPosition = "end";
          } else {
            spanPosition = "middle";
          }
        }

        newEvents.push({
          id: e.id,
          title: e.title,
          color: (e.color || "primary") as EventColor,
          date: currentDateStr,
          startTime: e.allDay ? undefined : startTimeStr,
          endTime: e.allDay ? undefined : endTimeStr,
          allDay: e.allDay,
          recurrenceRule: e.recurrenceRule,
          isMultiDay,
          spanPosition,
          startDate: startDateStr,
          endDate: endDateStr,
        });
        current.setDate(current.getDate() + 1);
      }
    }

    console.log("MonthGrid newEvents length:", newEvents.length);
    this._events = newEvents;
  }

  /** External `events` property wins over store-derived events when set. */
  private get _effectiveEvents(): MonthEvent[] {
    return this.events ?? this._events;
  }

  // ── Internal state ────────────────────────────────────────────────────
  @state() private _year = new Date().getFullYear();
  @state() private _month = new Date().getMonth(); // 0-based
  @state() private _view: ViewType = "Month";
  @state() private _selectedDateStr: string | null = null;
  @state() private _hoveredEventId: string | null = null;

  // ── Navigation ────────────────────────────────────────────────────────
  public goToPrev() {
    if (this._month === 0) {
      this._month = 11;
      this._year -= 1;
    } else {
      this._month -= 1;
    }

    // Select first day of new month
    this._selectedDateStr = new Date(this._year, this._month, 1)
      .toISOString()
      .split("T")[0];
    this._emitNavChange();
  }

  public goToNext() {
    if (this._month === 11) {
      this._month = 0;
      this._year += 1;
    } else {
      this._month += 1;
    }

    // Select first day of new month
    this._selectedDateStr = new Date(this._year, this._month, 1)
      .toISOString()
      .split("T")[0];
    this._emitNavChange();
  }

  public goToToday() {
    const now = new Date();
    this._year = now.getFullYear();
    this._month = now.getMonth();
    this._emitNavChange();
  }

  willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("_year") || changedProperties.has("_month")) {
      this._syncFromStore(schedulerStore.getState());
    }
  }

  override firstUpdated() {
    const grid = buildCalendarGrid(
      this._year,
      this._month,
      this._effectiveEvents,
    );
    const todayCell = grid.flat().find((d) => d.isToday) ?? grid[0][0];
    this._selectedDateStr = todayCell.dateStr;

    const gridEl = this.shadowRoot?.querySelector(".mg-grid");
    if (gridEl) {
      this._resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (this._gridHeight !== entry.contentRect.height) {
            this._gridHeight = entry.contentRect.height;
          }
        }
      });
      this._resizeObserver.observe(gridEl);
    }

    requestAnimationFrame(() => {
      this.requestUpdate();
    });
    this._emitNavChange();
  }

  private _emitNavChange() {
    const navLabel = formatMonthYear(this._year, this._month);
    this.dispatchEvent(
      new CustomEvent("nav-change", {
        detail: {
          navLabel,
          dayName: "",
          shortDate: "",
          zoomPercent: 100,
          zoomUnit: "",
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── Event dispatchers ─────────────────────────────────────────────────
  private _handleEventClick(ev: MonthEvent) {
    this.dispatchEvent(
      new CustomEvent("event-click", {
        detail: ev,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDayClick(day: CalendarDay) {
    this._selectedDateStr = day.dateStr;
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

  public setView(v: ViewType) {
    this._view = v;
    // Let the parent app know so it can swap components if needed
    this.dispatchEvent(
      new CustomEvent("view-change", {
        detail: { view: v },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── Render helpers ────────────────────────────────────────────────────

  private _renderDayPanel(day: CalendarDay | null) {
    if (!day) return nothing;

    const title = day.date
      .toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })
      .toUpperCase(); // e.g. "MAY 15"

    return html`
      <div class="mg-day-panel">
        <div class="mg-day-panel__header">
          <span class="mg-day-panel__title">${title} EVENTS</span>
          ${day.isToday
            ? html`<span class="mg-day-panel__today-badge">TODAY</span>`
            : nothing}
        </div>

        ${day.events.length === 0
          ? html`<p class="mg-day-panel__empty">No events</p>`
          : day.events.map(
              (ev) => html`
                <div class="mg-day-panel__event">
                  <div
                    class="mg-day-panel__color-bar mg-day-panel__color-bar--${ev.color}"
                  ></div>
                  <div class="mg-day-panel__event-info">
                    <span class="mg-day-panel__event-title">${ev.title}</span>
                    ${ev.allDay
                      ? html`<span class="mg-day-panel__event-time"
                          >All-day</span
                        >`
                      : ev.startTime && ev.endTime
                        ? html`<span class="mg-day-panel__event-time">
                            ${fmt12(ev.startTime)} – ${fmt12(ev.endTime)}
                          </span>`
                        : nothing}
                  </div>
                </div>
              `,
            )}
      </div>
    `;
  }

  // ── Main render ───────────────────────────────────────────────────────
  render() {
    const grid = buildCalendarGrid(
      this._year,
      this._month,
      this._effectiveEvents,
    );
    const rowCount = grid.length;
    const selectedDay =
      grid.flat().find((d) => d.dateStr === this._selectedDateStr) ?? null;

    return html`
      <div class="mg-shell">
        <!-- ── Calendar panel ── -->
        <div class="mg-panel">
          <!-- Weekday labels row -->
          <div class="mg-day-header">
            ${WEEK_DAYS.map(
              (d) => html`<div class="mg-day-header__cell">${d}</div>`,
            )}
          </div>

          <!-- 6 × 7 grid -->
          <div
            class="mg-grid"
            style="grid-template-rows: repeat(${rowCount}, 1fr)"
          >
            ${grid.map((week) => {
              const weekEvents: WeekEventBar[] = [];
              const uniqueIds = new Set<string>();
              for (const day of week) {
                for (const ev of day.events) {
                  uniqueIds.add(ev.id);
                }
              }

              for (const id of uniqueIds) {
                let startIdx = -1;
                let endIdx = -1;
                let eventRef: MonthEvent | undefined;

                for (let idx = 0; idx < 7; idx++) {
                  const ev = week[idx].events.find((e) => e.id === id);
                  if (ev) {
                    if (startIdx === -1) {
                      startIdx = idx;
                    }
                    endIdx = idx;
                    eventRef = ev;
                  }
                }

                if (eventRef) {
                  weekEvents.push({
                    id: eventRef.id,
                    title: eventRef.title,
                    color: eventRef.color,
                    allDay: eventRef.allDay,
                    startTime: eventRef.startTime,
                    endTime: eventRef.endTime,
                    date: eventRef.date,
                    isMultiDay: eventRef.isMultiDay,
                    spanPosition: eventRef.spanPosition,
                    startDate: eventRef.startDate,
                    endDate: eventRef.endDate,
                    startIdx,
                    endIdx,
                    track: -1,
                  });
                }
              }

              // Sort bars: wider first
              weekEvents.sort((a, b) => {
                const durA = a.endIdx - a.startIdx;
                const durB = b.endIdx - b.startIdx;
                if (durA !== durB) return durB - durA;
                return a.startIdx - b.startIdx;
              });

              // Greedy track assignment
              const trackFills: boolean[][] = [];
              for (const bar of weekEvents) {
                let assignedTrack = 0;
                while (true) {
                  if (!trackFills[assignedTrack]) {
                    trackFills[assignedTrack] = new Array(7).fill(false);
                  }
                  let hasConflict = false;
                  for (let day = bar.startIdx; day <= bar.endIdx; day++) {
                    if (trackFills[assignedTrack][day]) {
                      hasConflict = true;
                      break;
                    }
                  }
                  if (!hasConflict) {
                    bar.track = assignedTrack;
                    for (let day = bar.startIdx; day <= bar.endIdx; day++) {
                      trackFills[assignedTrack][day] = true;
                    }
                    break;
                  }
                  assignedTrack++;
                }
              }

              const numTracks = trackFills.length;

              // Dynamically calculate how many events can fit in the row
              let maxEventsPerDay = 2; // fallback
              if (this._gridHeight > 0) {
                const weekRowHeight = this._gridHeight / rowCount;
                // row height - 28px(header) - 26px(more btn + padding). Each track is 26px
                maxEventsPerDay = Math.max(
                  0,
                  Math.floor((weekRowHeight - 54) / 26),
                );
              }

              const visibleTracks = Math.min(numTracks, maxEventsPerDay);
              const spanRows = visibleTracks + 2;

              // Compute hidden events per day
              const hiddenPerDay = new Array(7).fill(0);
              for (const bar of weekEvents) {
                if (bar.track >= maxEventsPerDay) {
                  for (let i = bar.startIdx; i <= bar.endIdx; i++) {
                    hiddenPerDay[i]++;
                  }
                }
              }

              return html`
                <div
                  class="mg-week-row"
                  style="grid-template-rows: 28px repeat(${visibleTracks}, 26px) 1fr; padding-bottom: 4px;"
                >
                  <!-- Background Day Cells -->
                  ${week.map((day, colIdx) => {
                    const classes = [
                      "mg-day-cell",
                      day.isCurrentMonth ? "" : "mg-day-cell--other",
                      day.isToday ? "mg-day-cell--today" : "",
                      day.dateStr === this._selectedDateStr
                        ? "mg-day-cell--selected"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return html`
                      <div
                        class=${classes}
                        style="grid-column: ${colIdx +
                        1}; grid-row: 1 / span ${spanRows};"
                        @click=${() => this._handleDayClick(day)}
                      >
                        <div class="mg-day-cell__top">
                          ${day.isToday
                            ? html`
                                <span class="mg-today-badge"
                                  >${day.dayNum}</span
                                >
                                <span class="mg-today-label">TODAY</span>
                              `
                            : html`<span class="mg-day-cell__num"
                                >${day.dayNum}</span
                              >`}
                        </div>
                      </div>
                    `;
                  })}

                  <!-- Overlay Event Bars -->
                  ${weekEvents
                    .filter((bar) => bar.track < maxEventsPerDay)
                    .map((bar) => {
                      const timeLabel = bar.startTime
                        ? `${fmt12(bar.startTime)} · `
                        : "";
                      const clipLeft =
                        bar.startDate && bar.startDate < week[0].dateStr;
                      const clipRight =
                        bar.endDate && bar.endDate > week[6].dateStr;
                      const isHovered = this._hoveredEventId === bar.id;

                      const barClasses = [
                        "mg-event",
                        `mg-event--${bar.color}`,
                        clipLeft ? "mg-event--clip-left" : "",
                        clipRight ? "mg-event--clip-right" : "",
                        isHovered ? "mg-event--hovered" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return html`
                        <button
                          class=${barClasses}
                          style="
                            grid-column: ${bar.startIdx +
                          1} / span ${bar.endIdx - bar.startIdx + 1}; 
                            grid-row: ${bar.track + 2}; 
                            margin: 1px 4px; 
                            width: calc(100% - 8px);
                          "
                          @click=${(e: Event) => {
                            e.stopPropagation();
                            this._handleEventClick(bar);
                          }}
                          @mouseenter=${() => {
                            this._hoveredEventId = bar.id;
                          }}
                          @mouseleave=${() => {
                            this._hoveredEventId = null;
                          }}
                          title="${timeLabel}${bar.title}"
                        >
                          <span class="mg-event__title">${bar.title}</span>
                        </button>
                      `;
                    })}

                  <!-- +X more indicators -->
                  ${hiddenPerDay.map((count, colIdx) => {
                    if (count === 0) return nothing;
                    return html`
                      <button
                        class="mg-more-btn"
                        style="grid-column: ${colIdx +
                        1}; grid-row: ${visibleTracks + 2};"
                        @click=${(e: Event) => {
                          e.stopPropagation();
                          this._handleDayClick(week[colIdx]);
                        }}
                      >
                        <span class="mg-more-btn__text">+${count}</span>
                      </button>
                    `;
                  })}
                </div>
              `;
            })}
          </div>
        </div>

        <!-- ── Selected day panel (mobile) ── -->
        ${this._renderDayPanel(selectedDay)}

        <!-- ── FAB ── -->
        ${this.showFab
          ? html`
              <button
                class="mg-fab"
                @click=${this._handleAddEvent}
                aria-label="Add event"
              >
                ${PlusIcon()}
              </button>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "janus-month-grid": JanusMonthGrid;
  }
}
