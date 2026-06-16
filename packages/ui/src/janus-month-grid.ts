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
import {
  ChevronLeft,
  ChevronRight,
  SearchIcon,
  BellIcon,
  PlusIcon,
} from "./timeline-icons"; // reuse existing icons

import {
  schedulerStore,
  expandEvents,
  type EventColor,
  type SchedulerState,
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

  // ── Internal state ────────────────────────────────────────────────────
  @property({ type: Array }) events: MonthEvent[] = [];
  private _unsubStore?: () => void;

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
          color: (e.color || "blue") as EventColor,
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

    this.events = newEvents;
  }

  // ── Internal state ────────────────────────────────────────────────────
  @state() private _year = new Date().getFullYear();
  @state() private _month = new Date().getMonth(); // 0-based
  @state() private _view: "Timeline" | "Month" = "Month";
  @state() private _selectedDateStr: string | null = null;
  @state() private _hoveredEventId: string | null = null;

  // ── Navigation ────────────────────────────────────────────────────────
  private _prevMonth() {
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
  }

  private _nextMonth() {
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
  }

  private _goToToday() {
    const now = new Date();
    this._year = now.getFullYear();
    this._month = now.getMonth();
  }

  willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("_year") || changedProperties.has("_month")) {
      this._syncFromStore(schedulerStore.getState());
    }
  }

  override firstUpdated() {
    const grid = buildCalendarGrid(this._year, this._month, this.events);
    const todayCell = grid.flat().find((d) => d.isToday) ?? grid[0][0];
    this._selectedDateStr = todayCell.dateStr;

    requestAnimationFrame(() => {
      this.requestUpdate();
    });
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

  private _handleViewSwitch(v: "Timeline" | "Month") {
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
    const grid = buildCalendarGrid(this._year, this._month, this.events);
    const monthLabel = formatMonthYear(this._year, this._month);
    const rowCount = grid.length;
    const selectedDay =
      grid.flat().find((d) => d.dateStr === this._selectedDateStr) ?? null;

    return html`
      <div class="mg-shell">
        <!-- ── Top bar ── -->
        <header class="mg-topbar">
          <nav class="mg-nav">
            <button
              class="mg-nav__arrow"
              aria-label="Previous month"
              @click=${this._prevMonth}
            >
              ${ChevronLeft()}
            </button>
            <span class="mg-nav__month">${monthLabel}</span>
            <button
              class="mg-nav__arrow"
              aria-label="Next month"
              @click=${this._nextMonth}
            >
              ${ChevronRight()}
            </button>
          </nav>

          <div class="mg-topbar__right">
            <div class="mg-view-toggle">
              ${(["Timeline", "Month"] as const).map(
                (v) => html`
                  <button
                    class="mg-view-toggle__btn ${this._view === v
                      ? "active"
                      : ""}"
                    @click=${() => this._handleViewSwitch(v)}
                  >
                    ${v}
                  </button>
                `,
              )}
            </div>
            <button class="mg-icon-btn" aria-label="Search">
              ${SearchIcon()}
            </button>
            <button
              class="mg-icon-btn mg-icon-btn--bell"
              aria-label="Notifications"
            >
              ${BellIcon()}
              <span class="mg-bell-dot"></span>
            </button>
          </div>
        </header>

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
              const spanRows = numTracks + 2;

              return html`
                <div
                  class="mg-week-row"
                  style="grid-template-rows: 28px repeat(${numTracks}, 26px) 1fr; padding-bottom: 4px;"
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
                  ${weekEvents.map((bar) => {
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
                </div>
              `;
            })}
          </div>
        </div>

        <!-- ── Selected day panel (mobile) ── -->
        ${this._renderDayPanel(selectedDay)}

        <!-- ── FAB ── -->
        <button
          class="mg-fab"
          @click=${this._handleAddEvent}
          aria-label="Add event"
        >
          ${PlusIcon()}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "janus-month-grid": JanusMonthGrid;
  }
}
