import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
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

  // ── Internal state ────────────────────────────────────────────────────
  @state() private _eventsMap: Map<string, boolean> = new Map();
  @state() private _viewYear: number = new Date().getFullYear();
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

  willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("_viewYear")) {
      this._syncFromStore(schedulerStore.getState());
    }
  }

  override firstUpdated() {
    this._emitNavChange();
  }

  // ── Navigation ────────────────────────────────────────────────────────
  public goToPrev() {
    this._viewYear -= 1;
    this._emitNavChange();
  }

  public goToNext() {
    this._viewYear += 1;
    this._emitNavChange();
  }

  public goToToday() {
    this._viewYear = new Date().getFullYear();
    this._emitNavChange();
  }

  private _emitNavChange() {
    this.dispatchEvent(
      new CustomEvent("nav-change", {
        detail: {
          navLabel: `${this._viewYear}`,
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

    // View bounds for the entire year
    const startRange = new Date(this._viewYear, 0, 1).getTime();
    const endRange = new Date(this._viewYear + 1, 0, 1).getTime();

    // Expand recurrences for the year
    const coreEvents = expandEvents(
      Object.values(rawEvents),
      startRange,
      endRange,
    );

    const newEventsMap = new Map<string, boolean>();

    for (const e of coreEvents) {
      const startD = new Date(e.startTime);
      const endD = new Date(e.endTime);

      const loopStartMs = Math.max(startD.getTime(), startRange);
      const loopEndMs = Math.min(endD.getTime(), endRange);

      if (loopStartMs > loopEndMs) continue;

      const loopStartD = new Date(loopStartMs);
      const loopEndD = new Date(loopEndMs);

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

      while (current.getTime() <= endLimit.getTime()) {
        const dateStr = toLocalDateStr(
          current.getFullYear(),
          current.getMonth(),
          current.getDate(),
        );
        newEventsMap.set(dateStr, true);
        current.setDate(current.getDate() + 1);
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
      today.getFullYear() === this._viewYear && today.getMonth() === monthIndex;

    const firstDay = new Date(this._viewYear, monthIndex, 1).getDay();
    const totalDays = new Date(this._viewYear, monthIndex + 1, 0).getDate();

    const cells = [];

    // Empty cells before start of month
    for (let i = 0; i < firstDay; i++) {
      cells.push(html`<div class="yg-day-cell yg-day-cell--empty"></div>`);
    }

    // Actual days
    for (let day = 1; day <= totalDays; day++) {
      const isToday = isCurrentMonth && today.getDate() === day;
      const dateStr = toLocalDateStr(this._viewYear, monthIndex, day);
      const hasEvent = this._eventsMap.has(dateStr);

      cells.push(html`
        <div
          class="yg-day-cell"
          @click=${() => this._handleDayClick(this._viewYear, monthIndex, day)}
        >
          <div class="yg-day-number ${isToday ? "yg-day-number--today" : ""}">
            ${day}
          </div>
          ${hasEvent && !isToday
            ? html`<div class="yg-density-dot"></div>`
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
