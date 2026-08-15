import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { yearGridStyles } from "./year-grid-styles";

import {
  schedulerStore,
  expandEvents,
  type SchedulerState,
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

  @state() private _eventsMap: Map<string, boolean> = new Map();
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
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────
  public goToPrev() {
    this.viewYear -= 1;
    this._emitNavChange();
  }

  public goToNext() {
    this.viewYear += 1;
    this._emitNavChange();
  }

  public goToToday() {
    this.viewYear = new Date().getFullYear();
    this._emitNavChange();
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
    this.dispatchEvent(
      new CustomEvent("view-change", {
        detail: { view: "Year" },
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

    const newEventsMap = new Map<string, boolean>();

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

      // Iterate using UTC day timestamps (86,400,000 ms) to avoid DST shift issues
      const startDate = new Date(startMs);
      const endDate = new Date(endMs);

      const startUTC = Date.UTC(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
      );
      const endUTC = Date.UTC(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
      );

      const ONE_DAY_MS = 86400000;
      for (
        let currentMs = startUTC;
        currentMs <= endUTC;
        currentMs += ONE_DAY_MS
      ) {
        const d = new Date(currentMs);
        const dateStr = toLocalDateStr(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
        );
        newEventsMap.set(dateStr, true);
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
      const hasEvent = this._eventsMap.has(dateStr);

      cells.push(html`
        <div
          class="yg-day-cell"
          tabindex="0"
          role="button"
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
          ${hasEvent
            ? html`<div
                class="yg-density-dot ${isToday ? "yg-density-dot--today" : ""}"
              ></div>`
            : nothing}
        </div>
      `);
    }

    return html`
      <div class="yg-month-card">
        <div
          class="yg-month-header ${isCurrentMonth
            ? "yg-month-header--current"
            : ""}"
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
