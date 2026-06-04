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

import { schedulerStore } from "@janus-scheduler/core";

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

  private _syncFromStore(state: any) {
    const coreEvents = Object.values(state.events) as any[];
    const newEvents = coreEvents.map((e) => {
      const startD = new Date(e.startTime);
      const endD = new Date(e.endTime);
      const pad = (n: number) => n.toString().padStart(2, "0");
      // Use LOCAL date so event.date matches the calendar cell dateStr,
      // which is also derived from local date components (see month-grid-utils toDateStr).
      const localDate = `${startD.getFullYear()}-${pad(startD.getMonth() + 1)}-${pad(startD.getDate())}`;
      return {
        id: e.id,
        title: e.title,
        color: "blue",
        date: localDate,
        startTime: `${pad(startD.getUTCHours())}:${pad(startD.getUTCMinutes())}`,
        endTime: `${pad(endD.getUTCHours())}:${pad(endD.getUTCMinutes())}`,
      };
    });

    if (newEvents.length > 0) {
      this.events = newEvents as MonthEvent[];
    }
  }

  // ── Internal state ────────────────────────────────────────────────────
  @state() private _year = new Date().getFullYear();
  @state() private _month = new Date().getMonth(); // 0-based
  @state() private _view: "Timeline" | "Month" = "Month";
  @state() private _selectedDateStr: string | null = null;

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

  /** Renders a single event chip inside a day cell */
  private _renderEventChip(ev: MonthEvent) {
    const timeLabel = ev.startTime ? `${fmt12(ev.startTime)} · ` : "";
    return html`
      <button
        class="mg-event mg-event--${ev.color}"
        @click=${(e: Event) => {
          e.stopPropagation(); // don't also fire day-click
          this._handleEventClick(ev);
        }}
        title="${timeLabel}${ev.title}"
      >
        <span class="mg-event__title">${ev.title}</span>
      </button>
    `;
  }

  /** Renders one day cell */
  private _renderDay(day: CalendarDay) {
    const MAX_VISIBLE = 3; // how many chips to show before "+N more"
    const visible = day.events.slice(0, MAX_VISIBLE);

    const classes = [
      "mg-day-cell",
      day.isCurrentMonth ? "" : "mg-day-cell--other",
      day.isToday ? "mg-day-cell--today" : "",
      day.dateStr === this._selectedDateStr ? "mg-day-cell--selected" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return html`
      <div class=${classes} @click=${() => this._handleDayClick(day)}>
        <div class="mg-day-cell__top">
          ${day.isToday
            ? html`
                <span class="mg-today-badge">${day.dayNum}</span>
                <span class="mg-today-label">TODAY</span>
              `
            : html`<span class="mg-day-cell__num">${day.dayNum}</span>`}
        </div>

        <div class="mg-day-cell__dots">
          ${visible.map((ev) => this._renderEventChip(ev))}
        </div>
      </div>
    `;
  }

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
                    ${ev.startTime && ev.endTime
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
            ${grid.map(
              (week) => html`
                <div class="mg-week-row">
                  ${week.map((day) => this._renderDay(day))}
                </div>
              `,
            )}
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
