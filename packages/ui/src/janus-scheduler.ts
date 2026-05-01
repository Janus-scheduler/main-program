import { LitElement, html, nothing } from "lit";
import { customElement, state, property } from "lit/decorators.js";
import { schedulerStyles } from "./styles";

const COLORS = ["orange", "blue", "green", "yellow", "purple"];

// ─── Icons ───────────────────────────────────────────────────────────────────

const CalendarIcon = () =>
  html`<svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>`;

const ClockIcon = () =>
  html`<svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>`;

const SearchIcon = () =>
  html`<svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>`;

const BellIcon = () =>
  html`<svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>`;

const TrashIcon = () =>
  html`<svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4h6v2" />
  </svg>`;

const XIcon = () =>
  html`<svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>`;

const UsersIcon = () =>
  html`<svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>`;

const TagIcon = () =>
  html`<svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path
      d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
    />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>`;

const ChevronDownIcon = () =>
  html`<svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>`;

const ChevronLeftIcon = () =>
  html`<svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>`;

const ChevronRightIcon = () =>
  html`<svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>`;

// ─── Avatar helpers ───────────────────────────────────────────────────────────

const avatarPalette: Record<string, string> = {
  "John Doe": "orange",
  "Sarah Chen": "blue",
};

function avatarHtml(name: string) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  const cls = avatarPalette[name]
    ? `avatar-${avatarPalette[name]}`
    : "avatar-orange";
  return html`<span class="avatar ${cls}">${initials}</span>`;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function isEndBeforeStart(
  sd: string,
  st: string,
  ed: string,
  et: string,
): boolean {
  if (!sd || !st || !ed || !et) return false;
  return new Date(`${ed}T${et}`).getTime() <= new Date(`${sd}T${st}`).getTime();
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
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

interface CalState {
  viewYear: number;
  viewMonth: number;
}

function calDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  return cells;
}

function isoFromParts(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ─── Time data ────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

type OpenPicker = "startDate" | "startTime" | "endDate" | "endTime" | null;

// ─── Component ───────────────────────────────────────────────────────────────

@customElement("janus-scheduler")
export class JanusScheduler extends LitElement {
  static styles = schedulerStyles;

  @state() title = "Strategy Workshop";
  @state() startDate = "2026-04-30";
  @state() startTime = "14:00";
  @state() endDate = "2026-04-30";
  @state() endTime = "15:00";
  @state() participants = ["John Doe", "Sarah Chen"];
  @state() participantInput = "";
  @state() description =
    "Discussing the Q4 roadmap and resource allocation for upcoming projects.";
  @state() activeColor = "orange";
  @state() sidebarOpen = false;
  @state() openPicker: OpenPicker = null;
  @state() startCal: CalState = { viewYear: 2026, viewMonth: 3 };
  @state() endCal: CalState = { viewYear: 2026, viewMonth: 3 };

  @property({ type: String }) error: string | null = null;

  // ─── Computed ──────────────────────────────────────────────────────────────

  private get _invalid() {
    return isEndBeforeStart(
      this.startDate,
      this.startTime,
      this.endDate,
      this.endTime,
    );
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  connectedCallback() {
    super.connectedCallback();
    this._outsideClick = this._outsideClick.bind(this);
    document.addEventListener("click", this._outsideClick);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("click", this._outsideClick);
  }
  private _outsideClick() {
    if (this.openPicker) this.openPicker = null;
  }
  private _toggle(p: OpenPicker) {
    this.openPicker = this.openPicker === p ? null : p;
  }

  // ─── Dispatchers ───────────────────────────────────────────────────────────

  private _onClose() {
    this.dispatchEvent(
      new CustomEvent("close", { bubbles: true, composed: true }),
    );
  }

  private _onSave() {
    if (this._invalid) return;
    this.dispatchEvent(
      new CustomEvent("save", {
        bubbles: true,
        composed: true,
        detail: {
          title: this.title,
          startDate: this.startDate,
          startTime: this.startTime,
          endDate: this.endDate,
          endTime: this.endTime,
          participants: this.participants,
          description: this.description,
          activeColor: this.activeColor,
        },
      }),
    );
  }

  private _onDelete() {
    this.dispatchEvent(
      new CustomEvent("delete", {
        bubbles: true,
        composed: true,
        detail: { title: this.title },
      }),
    );
  }

  // ─── Participants ──────────────────────────────────────────────────────────

  private _removeParticipant(name: string) {
    this.participants = this.participants.filter((p) => p !== name);
  }

  private _handleParticipantKey(e: KeyboardEvent) {
    if ((e.key === "Enter" || e.key === ",") && this.participantInput.trim()) {
      e.preventDefault();
      this.participants = [...this.participants, this.participantInput.trim()];
      this.participantInput = "";
    }
    if (
      e.key === "Backspace" &&
      !this.participantInput &&
      this.participants.length
    ) {
      this.participants = this.participants.slice(0, -1);
    }
  }

  // ─── Time helpers ──────────────────────────────────────────────────────────

  private _parseTime(t: string) {
    if (!t) return { h: 0, m: 0 };
    const [h, m] = t.split(":").map(Number);
    return { h, m };
  }

  private _setTime(which: "start" | "end", h: number, m: number) {
    const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (which === "start") this.startTime = val;
    else this.endTime = val;
  }

  // ─── Calendar date selection ───────────────────────────────────────────────

  private _selectDate(
    which: "start" | "end",
    y: number,
    mo: number,
    d: number,
  ) {
    const iso = isoFromParts(y, mo, d);
    if (which === "start") {
      this.startDate = iso;
      this.startCal = { viewYear: y, viewMonth: mo };
      // If end is now before start on the same day, nudge end date forward
      if (isEndBeforeStart(iso, this.startTime, this.endDate, this.endTime)) {
        this.endDate = iso;
        this.endCal = { viewYear: y, viewMonth: mo };
      }
    } else {
      this.endDate = iso;
      this.endCal = { viewYear: y, viewMonth: mo };
    }
    this.openPicker = null;
  }

  // ─── Calendar dropdown ─────────────────────────────────────────────────────

  private _calPicker(
    which: "start" | "end",
    selectedIso: string,
    cal: CalState,
    onNav: (d: -1 | 1) => void,
  ) {
    const { viewYear: vy, viewMonth: vm } = cal;
    const days = calDays(vy, vm);
    const [selY, selM, selD] = selectedIso
      ? selectedIso.split("-").map(Number)
      : [0, 0, 0];
    const now = new Date();
    const todY = now.getFullYear(),
      todM = now.getMonth(),
      todD = now.getDate();

    return html`
      <div class="cal-dropdown" @click=${(e: Event) => e.stopPropagation()}>
        <div class="cal-header">
          <button class="cal-nav-btn" type="button" @click=${() => onNav(-1)}>
            ${ChevronLeftIcon()}
          </button>
          <span class="cal-month-label">${MONTH_NAMES[vm]} ${vy}</span>
          <button class="cal-nav-btn" type="button" @click=${() => onNav(1)}>
            ${ChevronRightIcon()}
          </button>
        </div>
        <div class="cal-weekdays">
          ${WEEKDAYS.map((w) => html`<span class="cal-wd">${w}</span>`)}
        </div>
        <div class="cal-grid">
          ${days.map((d) => {
            if (d === null) return html`<span class="cal-empty"></span>`;
            const isSel = d === selD && vm === selM - 1 && vy === selY;
            const isToday = d === todD && vm === todM && vy === todY;
            return html`<button
              type="button"
              class="cal-day ${isSel ? "cal-day--selected" : ""} ${isToday &&
              !isSel
                ? "cal-day--today"
                : ""}"
              @click=${() => this._selectDate(which, vy, vm, d)}
            >
              ${d}
            </button>`;
          })}
        </div>
        <div class="cal-preview">
          ${selectedIso ? formatDate(selectedIso) : "No date selected"}
        </div>
      </div>
    `;
  }

  // ─── Time picker dropdown ──────────────────────────────────────────────────

  private _timePicker(which: "start" | "end", currentTime: string) {
    const { h: selH, m: selM } = this._parseTime(currentTime);
    return html`
      <div
        class="time-picker-dropdown"
        @click=${(e: Event) => e.stopPropagation()}
      >
        <div class="time-picker-header">Select Time</div>
        <div class="time-picker-body">
          <div class="time-col">
            <div class="time-col-label">Hour</div>
            <div class="time-scroll">
              ${HOURS.map(
                (h) =>
                  html`<button
                    type="button"
                    class="time-cell ${selH === h ? "time-cell--active" : ""}"
                    @click=${() => this._setTime(which, h, selM)}
                  >
                    ${h % 12 || 12} ${h >= 12 ? "PM" : "AM"}
                  </button>`,
              )}
            </div>
          </div>
          <div class="time-divider">:</div>
          <div class="time-col">
            <div class="time-col-label">Min</div>
            <div class="time-scroll">
              ${MINUTES.map(
                (m) =>
                  html`<button
                    type="button"
                    class="time-cell ${selM === m ? "time-cell--active" : ""}"
                    @click=${() => this._setTime(which, selH, m)}
                  >
                    ${String(m).padStart(2, "0")}
                  </button>`,
              )}
            </div>
          </div>
        </div>
        <div class="time-picker-preview">${formatTime(currentTime)}</div>
      </div>
    `;
  }

  // ─── Shared trigger button ─────────────────────────────────────────────────

  private _triggerBtn(
    icon: unknown,
    value: string,
    isOpen: boolean,
    isInvalid: boolean,
    pickerId: OpenPicker,
  ) {
    const cls = [
      "time-trigger",
      isOpen ? "time-trigger--open" : "",
      isInvalid ? "time-trigger--invalid" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return html`
      <button
        type="button"
        class="${cls}"
        @click=${(e: Event) => {
          e.stopPropagation();
          this._toggle(pickerId);
        }}
      >
        <span class="time-trigger-icon">${icon}</span>
        <span class="time-trigger-value">${value || "—"}</span>
        <span class="time-trigger-chevron">${ChevronDownIcon()}</span>
      </button>
    `;
  }

  // ─── Calendar nav helper ───────────────────────────────────────────────────

  private _navCal(which: "start" | "end", delta: -1 | 1) {
    const prev = which === "start" ? this.startCal : this.endCal;
    let { viewYear: y, viewMonth: m } = prev;
    m += delta;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    const next: CalState = { viewYear: y, viewMonth: m };
    if (which === "start") this.startCal = next;
    else this.endCal = next;
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  render() {
    const invalid = this._invalid;

    const multiDay = this.startDate !== this.endDate;

    const sidebarDate = multiDay
      ? `${formatDateShort(this.startDate)} – ${formatDateShort(this.endDate)}`
      : formatDate(this.startDate);

    // When multi-day, attach the date to each time so the sidebar is unambiguous
    const sidebarTime = multiDay
      ? `${formatDateShort(this.startDate)}, ${formatTime(this.startTime)} – ${formatDateShort(this.endDate)}, ${formatTime(this.endTime)}`
      : `${formatTime(this.startTime)} – ${formatTime(this.endTime)}`;

    return html`
      <div
        class="overlay"
        @click=${(e: Event) => e.target === e.currentTarget && this._onClose()}
      >
        <div class="modal" role="dialog" aria-modal="true">
          <!-- ── Sidebar ─────────────────────────────────────────────────── -->
          <aside class="sidebar ${this.sidebarOpen ? "sidebar--open" : ""}">
            <div class="sidebar-accent color-${this.activeColor}"></div>
            <div class="sidebar-top">
              <div class="sidebar-event-badge">Event</div>
              <h2 class="sidebar-title">${this.title || "Untitled Event"}</h2>
            </div>
            <div class="sidebar-meta">
              <div class="meta-item">
                <span class="meta-icon">${CalendarIcon()}</span>
                <div>
                  <div class="meta-label">Date</div>
                  <div class="meta-value">${sidebarDate || "—"}</div>
                </div>
              </div>
              <div class="meta-item">
                <span class="meta-icon">${ClockIcon()}</span>
                <div>
                  <div class="meta-label">Time</div>
                  <div class="meta-value">${sidebarTime}</div>
                </div>
              </div>
              <div class="meta-item">
                <span class="meta-icon">${UsersIcon()}</span>
                <div>
                  <div class="meta-label">Participants</div>
                  <div class="meta-value">
                    ${this.participants.length}
                    ${this.participants.length === 1 ? "person" : "people"}
                  </div>
                  <div class="avatar-stack">
                    ${this.participants.slice(0, 4).map((n) => avatarHtml(n))}
                    ${this.participants.length > 4
                      ? html`<span class="avatar avatar-more"
                          >+${this.participants.length - 4}</span
                        >`
                      : nothing}
                  </div>
                </div>
              </div>
              <div class="meta-item">
                <span class="meta-icon">${TagIcon()}</span>
                <div class="color-meta-block">
                  <div class="meta-label">Color</div>
                  <div class="swatches">
                    ${COLORS.map(
                      (c) =>
                        html`<button
                          class="swatch swatch-${c} ${this.activeColor === c
                            ? "active"
                            : ""}"
                          @click=${() => (this.activeColor = c)}
                          aria-label="${c} color"
                        ></button>`,
                    )}
                  </div>
                </div>
              </div>
              <div class="meta-item">
                <span class="meta-icon">${BellIcon()}</span>
                <div>
                  <div class="meta-label">Reminder</div>
                  <div class="meta-value">15 min before</div>
                </div>
              </div>
            </div>
            <div class="sidebar-footer">
              <button class="btn-delete" @click=${this._onDelete}>
                ${TrashIcon()} Delete Event
              </button>
            </div>
          </aside>

          <!-- ── Panel ───────────────────────────────────────────────────── -->
          <div class="panel">
            <div class="panel-header">
              <div class="panel-header-left">
                <button
                  class="mobile-summary-btn"
                  @click=${() => (this.sidebarOpen = !this.sidebarOpen)}
                  aria-label="Toggle event summary"
                >
                  <div class="dot dot-${this.activeColor}"></div>
                  <span class="mobile-summary-title"
                    >${this.title || "Untitled"}</span
                  >
                  <span class="chevron ${this.sidebarOpen ? "chevron--up" : ""}"
                    >${ChevronDownIcon()}</span
                  >
                </button>
                <span class="panel-heading">Edit Event</span>
              </div>
              <button
                class="close-btn"
                @click=${this._onClose}
                aria-label="Close"
              >
                ${XIcon()}
              </button>
            </div>

            <!-- Mobile summary strip -->
            <div
              class="mobile-summary-panel ${this.sidebarOpen
                ? "mobile-summary-panel--open"
                : ""}"
            >
              <div class="mobile-summary-grid">
                <div class="msummary-item">
                  <span class="meta-label">Start</span>
                  <span class="meta-value"
                    >${formatDateShort(this.startDate)}
                    ${formatTime(this.startTime)}</span
                  >
                </div>
                <div class="msummary-item">
                  <span class="meta-label">End</span>
                  <span class="meta-value"
                    >${formatDateShort(this.endDate)}
                    ${formatTime(this.endTime)}</span
                  >
                </div>
                <div class="msummary-item">
                  <span class="meta-label">Participants</span>
                  <span class="meta-value"
                    >${this.participants.length} people</span
                  >
                </div>
                <div class="msummary-item">
                  <span class="meta-label">Color</span>
                  <div class="swatches swatches--sm">
                    ${COLORS.map(
                      (c) =>
                        html`<button
                          class="swatch swatch-${c} ${this.activeColor === c
                            ? "active"
                            : ""}"
                          @click=${() => (this.activeColor = c)}
                        ></button>`,
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div class="panel-body">
              ${this.error
                ? html` <div class="error-alert">
                    <span class="error-icon">!</span>
                    <span class="error-message">${this.error}</span>
                  </div>`
                : nothing}

              <!-- Basic Info -->
              <div class="form-section">
                <div class="section-label">Basic Info</div>
                <div class="form-group">
                  <label for="event-title">Event Title</label>
                  <input
                    id="event-title"
                    type="text"
                    .value=${this.title}
                    @input=${(e: Event) =>
                      (this.title = (e.target as HTMLInputElement).value)}
                    placeholder="Add a title…"
                  />
                </div>
              </div>

              <!-- Date & Time -->
              <div class="form-section">
                <div class="section-label">Date &amp; Time</div>

                <!-- START -->
                <div class="dt-row-label">Start</div>
                <div class="dt-row">
                  <!-- Start date trigger + dropdown -->
                  <div class="dt-cell dt-cell--date">
                    ${this._triggerBtn(
                      CalendarIcon(),
                      formatDateShort(this.startDate),
                      this.openPicker === "startDate",
                      false,
                      "startDate",
                    )}
                    ${this.openPicker === "startDate"
                      ? this._calPicker(
                          "start",
                          this.startDate,
                          this.startCal,
                          (d) => this._navCal("start", d),
                        )
                      : nothing}
                  </div>
                  <!-- Start time trigger + dropdown -->
                  <div class="dt-cell dt-cell--time">
                    ${this._triggerBtn(
                      ClockIcon(),
                      formatTime(this.startTime),
                      this.openPicker === "startTime",
                      false,
                      "startTime",
                    )}
                    ${this.openPicker === "startTime"
                      ? this._timePicker("start", this.startTime)
                      : nothing}
                  </div>
                </div>

                <!-- END -->
                <div class="dt-row-label dt-row-label--end">End</div>
                <div class="dt-row">
                  <!-- End date trigger + dropdown -->
                  <div class="dt-cell dt-cell--date">
                    ${this._triggerBtn(
                      CalendarIcon(),
                      formatDateShort(this.endDate),
                      this.openPicker === "endDate",
                      invalid,
                      "endDate",
                    )}
                    ${this.openPicker === "endDate"
                      ? this._calPicker("end", this.endDate, this.endCal, (d) =>
                          this._navCal("end", d),
                        )
                      : nothing}
                  </div>
                  <!-- End time trigger + dropdown -->
                  <div class="dt-cell dt-cell--time">
                    ${this._triggerBtn(
                      ClockIcon(),
                      formatTime(this.endTime),
                      this.openPicker === "endTime",
                      invalid,
                      "endTime",
                    )}
                    ${this.openPicker === "endTime"
                      ? this._timePicker("end", this.endTime)
                      : nothing}
                  </div>
                </div>

                <!-- Validation warning -->
                ${invalid
                  ? html` <div class="dt-invalid-notice">
                      <span>⚠</span>
                      <span
                        >End must be after start. Please adjust the date or
                        time.</span
                      >
                    </div>`
                  : nothing}
              </div>

              <!-- People -->
              <div class="form-section">
                <div class="section-label">People</div>
                <div class="form-group">
                  <label>Participants</label>
                  <div
                    class="participants-box"
                    @click=${() =>
                      this.shadowRoot
                        ?.getElementById("participant-input")
                        ?.focus()}
                  >
                    ${this.participants.map(
                      (name) =>
                        html` <span class="chip">
                          ${avatarHtml(name)} ${name}
                          <button
                            class="chip-remove"
                            @click=${(e: Event) => {
                              e.stopPropagation();
                              this._removeParticipant(name);
                            }}
                          >
                            ${XIcon()}
                          </button>
                        </span>`,
                    )}
                    <input
                      id="participant-input"
                      class="participant-inline-input"
                      type="text"
                      placeholder="Add people…"
                      .value=${this.participantInput}
                      @input=${(e: Event) =>
                        (this.participantInput = (
                          e.target as HTMLInputElement
                        ).value)}
                      @keydown=${this._handleParticipantKey}
                    />
                    <span class="search-icon-wrap">${SearchIcon()}</span>
                  </div>
                </div>
              </div>

              <!-- Details -->
              <div class="form-section">
                <div class="section-label">Details</div>
                <div class="form-group">
                  <label for="description">Description</label>
                  <textarea
                    id="description"
                    rows="4"
                    .value=${this.description}
                    @input=${(e: Event) =>
                      (this.description = (
                        e.target as HTMLTextAreaElement
                      ).value)}
                    placeholder="Add a description…"
                  ></textarea>
                </div>
              </div>
            </div>

            <div class="panel-footer">
              <button
                class="btn-delete btn-delete--footer"
                @click=${this._onDelete}
              >
                ${TrashIcon()} Delete
              </button>
              <div class="footer-right">
                <button class="btn-cancel" @click=${this._onClose}>
                  Cancel
                </button>
                <button
                  class="btn-save"
                  ?disabled=${invalid}
                  @click=${this._onSave}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "janus-scheduler": JanusScheduler;
  }
}
