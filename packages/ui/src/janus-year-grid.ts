import { LitElement, html, nothing } from "lit";
import { customElement, state, property } from "lit/decorators.js";
import { yearGridStyles } from "./year-grid-styles";

import {
  schedulerStore,
  expandEvents,
  type SchedulerState,
  type ViewType,
} from "@janus-scheduler/core";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** "YYYY-MM-DD" from a Date using local components */
function toLocalDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

@customElement("janus-year-grid")
export class JanusYearGrid extends LitElement {
  static readonly styles = yearGridStyles;

  // ── Internal state & properties ───────────────────────────────────────
  @property({ type: Number, attribute: "view-year" })
  viewYear: number = new Date().getFullYear();

  @state() private _eventsMap: Map<string, string> = new Map();
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
    this._unsubStore?.();
  }

  override firstUpdated() {
    this._emitNavChange();
  }

  override willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("viewYear")) {
      this._syncFromStore(schedulerStore.getState());
      this._emitNavChange();
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────
  public goToPrev() {
    this.viewYear -= 1;
  }

  public goToNext() {
    this.viewYear += 1;
  }

  public goToToday() {
    const currentYear = new Date().getFullYear();
    if (this.viewYear === currentYear) {
      this._emitNavChange();
    } else {
      this.viewYear = currentYear;
    }
  }

  public goToDate(date: string | number | Date) {
    let d: Date;
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) {
      const parts = date.split("-").map(Number);
      d = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
    } else {
      d = new Date(date);
    }
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      if (this.viewYear === year) {
        this._emitNavChange();
      } else {
        this.viewYear = year;
      }
    }
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

  private _emitNavChange() {
    this.dispatchEvent(
      new CustomEvent("nav-change", {
        detail: {
          navLabel: `${this.viewYear}`,
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

  private _syncFromStore(state: SchedulerState) {
    const rawEvents = state.events;
    const year = this.viewYear;

    // View bounds for the entire calendar year [Jan 1 00:00:00.000 to Dec 31 23:59:59.999]
    const startRange = new Date(year, 0, 1, 0, 0, 0, 0).getTime();
    const endRange = new Date(year, 11, 31, 23, 59, 59, 999).getTime();

    // Expand recurrences for the year
    const coreEvents = expandEvents(
      Object.values(rawEvents),
      startRange,
      endRange,
    );

    const newEventsMap = new Map<string, string>();

    for (const e of coreEvents) {
      const origStartMs = new Date(e.startTime).getTime();
      let origEndMs = new Date(e.endTime).getTime();

      // Handle midnight end boundary: if event ends exactly at 00:00:00.000,
      // subtract 1ms to stay on preceding day before range clamping.
      if (origEndMs > origStartMs) {
        const endDCheck = new Date(origEndMs);
        if (
          endDCheck.getHours() === 0 &&
          endDCheck.getMinutes() === 0 &&
          endDCheck.getSeconds() === 0 &&
          endDCheck.getMilliseconds() === 0
        ) {
          origEndMs -= 1;
        }
      }

      const startMs = Math.max(origStartMs, startRange);
      const endMs = Math.min(origEndMs, endRange);

      if (startMs > endMs) continue;

      // Iterate day-by-day using local calendar date increments
      const cur = new Date(startMs);
      cur.setHours(0, 0, 0, 0);

      const endD = new Date(endMs);
      endD.setHours(0, 0, 0, 0);
      const endCurMs = endD.getTime();

      while (cur.getTime() <= endCurMs) {
        const dateStr = toLocalDateStr(
          cur.getFullYear(),
          cur.getMonth(),
          cur.getDate(),
        );
        if (!newEventsMap.has(dateStr)) {
          newEventsMap.set(dateStr, e.color || "orange");
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    this._eventsMap = newEventsMap;
  }

  private _handleDayClick(year: number, month: number, day: number) {
    const dateStr = toLocalDateStr(year, month, day);
    this.dispatchEvent(
      new CustomEvent("day-click", {
        detail: { date: dateStr },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderMonth(monthIndex: number) {
    const today = new Date();
    const isCurrentMonth =
      today.getFullYear() === this.viewYear && today.getMonth() === monthIndex;

    const firstDay = new Date(this.viewYear, monthIndex, 1).getDay();
    const totalDays = new Date(this.viewYear, monthIndex + 1, 0).getDate();

    const cells = [];

    // Empty cells before start of month
    for (let i = 0; i < firstDay; i++) {
      cells.push(html`<div class="yg-day-cell yg-day-cell--empty"></div>`);
    }

    // Actual days
    for (let day = 1; day <= totalDays; day++) {
      const isToday = isCurrentMonth && today.getDate() === day;
      const dateStr = toLocalDateStr(this.viewYear, monthIndex, day);
      const eventColor = this._eventsMap.get(dateStr);
      const hasEvent = !!eventColor;

      cells.push(html`
        <div
          class="yg-day-cell"
          role="button"
          tabindex=${isToday ? "0" : "-1"}
          aria-label="${MONTH_NAMES[monthIndex]} ${day}, ${this.viewYear}"
          @click=${() => this._handleDayClick(this.viewYear, monthIndex, day)}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              this._handleDayClick(this.viewYear, monthIndex, day);
            }
          }}
        >
          <div class="yg-day-number ${isToday ? "yg-day-number--today" : ""}">
            ${day}
          </div>
          ${
            hasEvent
              ? html`<div
                  class="yg-density-dot ${
                    isToday
                      ? "yg-density-dot--today"
                      : `yg-density-dot--${eventColor}`
                  }"
                ></div>`
              : nothing
          }
        </div>
      `);
    }

    return html`
      <div class="yg-month-card">
        <div
          class="yg-month-header ${
            isCurrentMonth ? "yg-month-header--current" : ""
          }"
        >
          ${MONTH_NAMES[monthIndex]}
        </div>
        <div class="yg-day-grid">
          ${WEEK_DAYS.map((wd) => html`<div class="yg-weekday">${wd}</div>`)}
          ${cells}
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="yg-container">
        ${Array.from({ length: 12 }).map((_, i) => this._renderMonth(i))}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "janus-year-grid": JanusYearGrid;
  }
}
