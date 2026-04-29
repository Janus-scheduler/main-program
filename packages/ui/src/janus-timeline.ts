import { LitElement, html, nothing } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { timelineStyles } from "./timeline-styles";

import { TimelineEvent, TimelineResource } from "./timeline-types";
import {
  RoomIcon,
  EquipmentIcon,
  ChevronLeft,
  ChevronRight,
  SearchIcon,
  BellIcon,
  SparkleIcon,
  PlusIcon,
} from "./timeline-icons";
import {
  HOUR_START,
  HOUR_WIDTH,
  VISIBLE_HOURS,
  fmt12,
  getInitials,
  avatarColor,
  eventStyle,
  toDateStr,
  nowLeft,
  formatDateFull,
  formatDateShort,
} from "./timeline-utils";
import { SAMPLE } from "./timeline-data";

@customElement("janus-timeline")
export class JanusTimeline extends LitElement {
  static styles = timelineStyles;

  @property({ type: Array }) resources: TimelineResource[] = SAMPLE;

  @state() view: "Timeline" | "Month" = "Timeline";
  @state() currentDate = new Date();
  @state() aiPrompt = "";

  @query(".tl-res-col") resColRef!: HTMLElement;
  @query(".tl-time-scroll") gridScrollRef!: HTMLElement;

  firstUpdated() {
    // On mount: scroll horizontally so 8:00 AM is the first visible hour
    if (this.gridScrollRef) {
      this.gridScrollRef.scrollLeft = 8 * HOUR_WIDTH;
    }
  }

  private _onGridScroll() {
    if (this.resColRef && this.gridScrollRef) {
      this.resColRef.scrollTop = this.gridScrollRef.scrollTop;
    }
  }

  private _goToPrevDay() {
    const d = new Date(this.currentDate);
    d.setDate(d.getDate() - 1);
    this.currentDate = d;
  }

  private _goToNextDay() {
    const d = new Date(this.currentDate);
    d.setDate(d.getDate() + 1);
    this.currentDate = d;
  }

  private _goToToday() {
    this.currentDate = new Date();
  }

  private _handleEventClick(ev: TimelineEvent) {
    this.dispatchEvent(
      new CustomEvent("event-click", {
        detail: ev,
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

  private renderAvatar(r: TimelineResource) {
    if (r.avatarType === "initials") {
      return html`<span
        class="tl-avatar tl-avatar--initials"
        style="background: ${avatarColor(r.id)}"
        >${getInitials(r.name)}</span
      >`;
    }
    return html`
      <span class="tl-avatar tl-avatar--icon tl-avatar--${r.avatarIcon}">
        ${r.avatarIcon === "room" ? RoomIcon() : EquipmentIcon()}
      </span>
    `;
  }

  render() {
    const activeDateStr = toDateStr(this.currentDate);

    // Filter resources conditionally by activeDate
    const filteredResources = this.resources.map((r) => ({
      ...r,
      events: r.events.filter((ev) => !ev.date || ev.date === activeDateStr),
    }));

    // Grouping
    const groups: { label: string; items: TimelineResource[] }[] = [];
    let cur: (typeof groups)[0] | null = null;
    for (const r of filteredResources) {
      if (r.groupLabel) {
        cur = { label: r.groupLabel, items: [r] };
        groups.push(cur);
      } else if (cur) {
        cur.items.push(r);
      } else {
        cur = { label: "", items: [r] };
        groups.push(cur);
      }
    }

    const totalW = VISIBLE_HOURS.length * HOUR_WIDTH;
    const nl = nowLeft();

    return html`
      <div class="tl-component-shell">
        <header class="tl-topbar">
          <nav class="tl-nav">
            <button
              class="tl-nav__arrow"
              aria-label="Previous"
              @click=${this._goToPrevDay}
            >
              ${ChevronLeft()}
            </button>
            <button class="tl-nav__today" @click=${this._goToToday}>
              Today
            </button>
            <button
              class="tl-nav__arrow"
              aria-label="Next"
              @click=${this._goToNextDay}
            >
              ${ChevronRight()}
            </button>
            <span class="tl-nav__date"
              >${formatDateFull(this.currentDate)}</span
            >
            <span class="tl-nav__date--short"
              >${formatDateShort(this.currentDate)}</span
            >
          </nav>
          <div class="tl-topbar__right">
            <div class="tl-view-toggle">
              ${(["Timeline", "Month"] as const).map(
                (v) => html`
                  <button
                    class="tl-view-toggle__btn ${this.view === v
                      ? "active"
                      : ""}"
                    @click=${() => {
                      this.view = v;
                      this.dispatchEvent(
                        new CustomEvent("view-change", {
                          detail: { view: v },
                          bubbles: true,
                          composed: true,
                        }),
                      );
                    }}
                  >
                    ${v}
                  </button>
                `,
              )}
            </div>
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

        <div class="tl-panel">
          <div class="tl-grid-wrap">
            <div
              class="tl-res-col"
              @scroll=${
                (e: Event) =>
                  e.preventDefault() /* Native lock, handled by ref */
              }
            >
              <div class="tl-res-col__header">RESOURCE</div>
              ${groups.map(
                (g) => html`
                  <div>
                    ${g.label
                      ? html`<div class="tl-res-group-label">${g.label}</div>`
                      : nothing}
                    ${g.items.map(
                      (r) => html`
                        <div class="tl-res-row">
                          ${this.renderAvatar(r)}
                          <div class="tl-res-info">
                            <span class="tl-res-name">${r.name}</span>
                            <span class="tl-res-sub">${r.subtitle}</span>
                          </div>
                        </div>
                      `,
                    )}
                  </div>
                `,
              )}
            </div>

            <div class="tl-time-scroll" @scroll=${this._onGridScroll}>
              <div class="tl-time-inner" style="width: ${totalW}px">
                <div class="tl-hour-header">
                  ${VISIBLE_HOURS.map(
                    (h) => html`
                      <div class="tl-hour-cell" style="width: ${HOUR_WIDTH}px">
                        ${h.toString().padStart(2, "0")}:00
                      </div>
                    `,
                  )}
                </div>

                ${nl > 0 && nl < totalW
                  ? html`
                      <div class="tl-now-line" style="left: ${nl}px">
                        <span class="tl-now-dot"></span>
                      </div>
                    `
                  : nothing}
                ${groups.map(
                  (g) => html`
                    <div>
                      ${g.label
                        ? html`<div class="tl-group-spacer"></div>`
                        : nothing}
                      ${g.items.map(
                        (r) => html`
                          <div class="tl-event-row">
                            ${VISIBLE_HOURS.map(
                              (h) =>
                                html`<div
                                  class="tl-vline"
                                  style="left: ${(h - HOUR_START) *
                                  HOUR_WIDTH}px"
                                ></div>`,
                            )}
                            ${r.events.map(
                              (ev) => html`
                                <button
                                  class="tl-event tl-event--${ev.color}"
                                  style=${eventStyle(ev)}
                                  @click=${() => this._handleEventClick(ev)}
                                >
                                  <span class="tl-event__title"
                                    >${ev.title}</span
                                  >
                                  <span class="tl-event__time"
                                    >${fmt12(ev.startTime)} –
                                    ${fmt12(ev.endTime)}</span
                                  >
                                </button>
                              `,
                            )}
                          </div>
                        `,
                      )}
                    </div>
                  `,
                )}
              </div>
            </div>
          </div>

          <div class="tl-ai-wrap">
            <div class="tl-ai-card">
              ${SparkleIcon()}
              <input
                class="tl-ai-card__input"
                type="text"
                .value=${this.aiPrompt}
                @input=${(e: Event) =>
                  (this.aiPrompt = (e.target as HTMLInputElement).value)}
                placeholder="Try 'Schedule a design sync with Alex tomorrow at 10am in Room A'"
              />
              <button class="tl-ai-card__btn">Schedule</button>
            </div>
          </div>
        </div>

        <button
          class="tl-fab"
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
    "janus-timeline": JanusTimeline;
  }
}
