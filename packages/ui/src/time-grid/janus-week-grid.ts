import { customElement, property } from "lit/decorators.js";
import { weekGridStyles } from "./week-grid-styles";
import { JanusTimeGridBase } from "./time-grid-base";
import {
  buildDayRange,
  formatWeekLabel,
  startOfWeek,
  type TimeGridDay,
} from "./time-grid-utils";
import type { ViewType } from "@janus-scheduler/core";

/** Columns shown once the component is narrower than the mobile breakpoint. */
const NARROW_COLUMNS = 3;

/**
 * `<janus-week-grid>` — seven days on one hour grid.
 *
 * Today's column is tinted with the brand token and carries the now-line.
 * On narrow screens the week collapses to a three-day window centred on the
 * anchor date, matching the design spec's mobile layout.
 *
 * All behavior beyond the column maths lives in {@link JanusTimeGridBase}.
 */
@customElement("janus-week-grid")
export class JanusWeekGrid extends JanusTimeGridBase {
  static readonly styles = weekGridStyles;

  /**
   * First day of the week, using JS day indexing (0 = Sunday, 1 = Monday).
   * Default: 1 (Monday), matching `<janus-month-grid>`.
   */
  @property({ type: Number, attribute: "week-starts-on" }) weekStartsOn = 1;

  protected readonly viewType: ViewType = "Week";

  protected get navStepDays(): number {
    return this._isNarrow ? NARROW_COLUMNS : 7;
  }

  protected get hourHeight(): number {
    return this._isNarrow ? 56 : 44;
  }

  protected buildVisibleDays(): TimeGridDay[] {
    if (this._isNarrow) {
      // Centre the compact window on the anchor day.
      const start = new Date(this._anchor);
      start.setDate(start.getDate() - Math.floor(NARROW_COLUMNS / 2));
      return buildDayRange(start, NARROW_COLUMNS);
    }
    return buildDayRange(startOfWeek(this._anchor, this.weekStartsOn), 7);
  }

  protected get navLabel(): string {
    const days = this.buildVisibleDays();
    if (days.length === 0) return "";
    return formatWeekLabel(days[0].date, days[days.length - 1].date);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "janus-week-grid": JanusWeekGrid;
  }
}
