import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { topbarStyles } from "./topbar-styles";
import type { ViewType } from "@janus-scheduler/core";
import {
  BellIcon,
  ChevronLeft,
  ChevronRight,
  PencilRulerIcon,
  CalendarIcon,
  UndoIcon,
  SearchIcon,
} from "./timeline-icons";

/**
 * `<janus-topbar>` — standalone toolbar for the Janus timeline / month views.
 *
 * Renders the date navigation (< Today Date >) and right-side actions
 * (connect-calendar, view toggle, draw-to-create, search, notifications).
 *
 * Communicates with its parent via custom events so the parent retains
 * full control over state.
 *
 * @fires prev-click  - User clicked the "previous" arrow.
 * @fires next-click  - User clicked the "next" arrow.
 * @fires today-click - User clicked the "Today" button.
 * @fires view-switch - User selected a view tab.  `event.detail.view` is a `ViewType`.
 * @fires toggle-create - User toggled draw-to-create mode.
 * @fires connect-calendar - User clicked the Google Calendar connect/disconnect button.
 */
@customElement("janus-topbar")
export class JanusTopbar extends LitElement {
  static readonly styles = topbarStyles;

  /** Full navigation label shown on desktop (e.g. "Tuesday, June 30, 2026"). */
  @property({ type: String, attribute: "nav-label" }) navLabel = "";

  /** Day name shown on mobile (e.g. "FRIDAY"). */
  @property({ type: String, attribute: "day-name" }) dayName = "";

  /** Short date shown on mobile (e.g. "Jun 12"). */
  @property({ type: String, attribute: "short-date" }) shortDate = "";

  /** Currently active view */
  @property({ type: String }) view: ViewType = "Timeline";

  /**
   * Which view tabs to offer, in order. Override to hide views a host app
   * doesn't mount — e.g. `["Day", "Week", "Month"]` for a plain calendar.
   */
  @property({ type: Array }) views: ViewType[] = [
    "Day",
    "Week",
    "Month",
    "Year",
    "Timeline",
  ];

  /** Whether draw-to-create mode is active. */
  @property({ type: Boolean, attribute: "allow-create" }) allowCreate = false;

  /** Whether undo is available. */
  @property({ type: Boolean, attribute: "can-undo" }) canUndo = false;

  /** Current zoom percentage (100 = default). If not 100, a badge is shown. */
  @property({ type: Number, attribute: "zoom-percent" }) zoomPercent = 100;

  /** Current zoom-level unit label (e.g. "15 min", "1 hr"). */
  @property({ type: String, attribute: "zoom-unit" }) zoomUnit = "";

  @property({ type: Boolean, attribute: "has-conflict" }) hasConflict = false;
  @property({ type: Number, attribute: "conflict-count" }) conflictCount = 0;
  @property({ type: Boolean, attribute: "is-conflicts-banner-dismissed" })
  isConflictsBannerDismissed = false;

  /** Whether Google Calendar is currently connected. Controls the button's label/state. */
  @property({ type: Boolean, attribute: "is-google-calendar-connected" })
  isGoogleCalendarConnected = false;

  private _emitRestoreConflicts() {
    this.dispatchEvent(
      new CustomEvent("restore-conflicts-banner", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  /* ──────────────────────────────────────────────────────────────────────── */
  /*  Event dispatchers                                                      */
  /* ──────────────────────────────────────────────────────────────────────── */

  private _emitPrev() {
    this.dispatchEvent(
      new CustomEvent("prev-click", { bubbles: true, composed: true }),
    );
  }

  private _emitNext() {
    this.dispatchEvent(
      new CustomEvent("next-click", { bubbles: true, composed: true }),
    );
  }

  private _emitToday() {
    this.dispatchEvent(
      new CustomEvent("today-click", { bubbles: true, composed: true }),
    );
  }

  private _emitViewSwitch(v: ViewType) {
    this.dispatchEvent(
      new CustomEvent("view-switch", {
        bubbles: true,
        composed: true,
        detail: { view: v },
      }),
    );
  }

  private _emitToggleCreate() {
    this.dispatchEvent(
      new CustomEvent("toggle-create", { bubbles: true, composed: true }),
    );
  }

  private _emitConnectCalendar() {
    this.dispatchEvent(
      new CustomEvent("connect-calendar", { bubbles: true, composed: true }),
    );
  }

  private _emitUndo() {
    this.dispatchEvent(
      new CustomEvent("undo-click", { bubbles: true, composed: true }),
    );
  }

  /* ──────────────────────────────────────────────────────────────────────── */
  /*  Render                                                                 */
  /* ──────────────────────────────────────────────────────────────────────── */

  render() {
    return html`
      <header class="tl-topbar">
        <nav class="tl-nav">
          <button
            class="tl-nav__arrow"
            aria-label="Previous"
            @click=${this._emitPrev}
          >
            ${ChevronLeft()}
          </button>
          <div class="tl-nav__center">
            <button class="tl-nav__today" @click=${this._emitToday}>
              Today
            </button>
            <span class="tl-nav__date">${this.navLabel}</span>
            <div class="tl-nav__date--short">
              <span class="tl-nav-day-name">${this.dayName}</span>
              <span class="tl-nav-date-text">${this.shortDate}</span>
            </div>
          </div>
          <button
            class="tl-nav__arrow"
            aria-label="Next"
            @click=${this._emitNext}
          >
            ${ChevronRight()}
          </button>
        </nav>
        <div class="tl-topbar__right">
          ${this.hasConflict && this.isConflictsBannerDismissed
            ? html`
                <button
                  class="tl-warning-badge"
                  @click=${this._emitRestoreConflicts}
                  title="Restore conflict warning banner"
                >
                  <span>⚠</span>
                  <span>${this.conflictCount}</span>
                </button>
              `
            : nothing}
          ${this.zoomPercent !== 100
            ? html`<span class="tl-zoom-badge"
                >${this.zoomPercent}% · ${this.zoomUnit}</span
              >`
            : nothing}
          <button
            class="tl-gcal-btn ${this.isGoogleCalendarConnected
              ? "tl-gcal-btn--connected"
              : ""}"
            @click=${this._emitConnectCalendar}
          >
            ${CalendarIcon()}
            ${this.isGoogleCalendarConnected
              ? "Google Calendar Connected"
              : "Connect Google Calendar"}
          </button>
          <div class="tl-view-toggle">
            ${this.views.map(
              (v) => html`
                <button
                  class="tl-view-toggle__btn ${this.view === v ? "active" : ""}"
                  @click=${() => this._emitViewSwitch(v)}
                >
                  ${v}
                </button>
              `,
            )}
          </div>

          ${this.canUndo
            ? html`
                <button
                  class="tl-icon-btn"
                  aria-label="Undo"
                  data-tooltip="Undo last action (Cmd+Z)"
                  @click=${this._emitUndo}
                >
                  ${UndoIcon()}
                </button>
              `
            : nothing}

          <button
            class="tl-icon-btn tl-draw-toggle ${this.allowCreate
              ? "tl-draw-toggle--active"
              : ""}"
            aria-label="Toggle draw-to-create"
            data-tooltip="${this.allowCreate
              ? "Draw Event ON — click to disable"
              : "Draw Event OFF — drag on empty space to create an event"}"
            @click=${this._emitToggleCreate}
          >
            ${PencilRulerIcon()}
          </button>
          <button class="tl-icon-btn" aria-label="Search">
            ${SearchIcon()}
          </button>
          <button
            class="tl-icon-btn tl-icon-btn--bell"
            aria-label="Notifications"
          >
            ${BellIcon()}
            <span class="tl-bell-dot"></span>
          </button>
        </div>
      </header>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "janus-topbar": JanusTopbar;
  }
}
