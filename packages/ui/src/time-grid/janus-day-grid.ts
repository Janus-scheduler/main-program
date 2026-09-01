import { html, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { dayGridStyles } from "./day-grid-styles";
import { JanusTimeGridBase } from "./time-grid-base";
import {
  buildDayRange,
  formatDayLabel,
  startOfWeek,
  type TimeGridDay,
} from "./time-grid-utils";
import type { ViewType } from "@janus-scheduler/core";

/**
 * `<janus-day-grid>` — a single day on an hour grid, the precision view.
 *
 * All-day items pin to the top, the now-line tracks the current minute, and
 * clicking an empty slot emits `slot-select` with that time. On narrow screens
 * a week strip above the grid selects which day is shown, matching the design
 * spec's mobile layout.
 *
 * All behavior beyond the single-column maths lives in
 * {@link JanusTimeGridBase}.
 */
@customElement("janus-day-grid")
export class JanusDayGrid extends JanusTimeGridBase {
  static readonly styles = dayGridStyles;

  /**
   * First day of the mobile week strip, using JS day indexing
   * (0 = Sunday, 1 = Monday). Default: 1 (Monday).
   */
  @property({ type: Number, attribute: "week-starts-on" }) weekStartsOn = 1;

  protected readonly viewType: ViewType = "Day";

  protected get navStepDays(): number {
    return 1;
  }

  protected get hourHeight(): number {
    return this._isNarrow ? 58 : 52;
  }

  protected buildVisibleDays(): TimeGridDay[] {
    return buildDayRange(this._anchor, 1);
  }

  /**
   * Fetch the whole strip week, not just the visible day, so the mobile strip
   * can show a density dot for every day it offers.
   */
  protected override buildFetchDays(): TimeGridDay[] {
    return this._stripDays();
  }

  protected get navLabel(): string {
    return formatDayLabel(this._anchor);
  }

  /** The week containing the anchor date — the mobile strip's day set. */
  private _stripDays(): TimeGridDay[] {
    return buildDayRange(startOfWeek(this._anchor, this.weekStartsOn), 7);
  }

  /** The seven-day selector shown above the grid on mobile. */
  protected override renderAboveHeader(): TemplateResult {
    const strip = this._stripDays();
    const selected = this.buildVisibleDays()[0]?.dateStr;

    return html`
      <div class="tg-strip">
        ${strip.map((day) => {
          const classes = [
            "tg-strip__day",
            day.dateStr === selected ? "tg-strip__day--selected" : "",
            day.isToday ? "tg-strip__day--today" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return html`
            <button
              class=${classes}
              @click=${() => {
                this.goToDate(day.dateStr);
                this._handleDayClick(day);
              }}
            >
              <span class="tg-strip__dow">${day.dowShort.charAt(0)}</span>
              <span class="tg-strip__num">${day.dayNum}</span>
              <span
                class="tg-strip__dot ${
                  this.hasEventsOn(day.dateStr) ? "" : "tg-strip__dot--empty"
                }"
              ></span>
            </button>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "janus-day-grid": JanusDayGrid;
  }
}
