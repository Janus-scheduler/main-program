import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { schedulerStyles } from "./styles";

const COLORS = ["orange", "blue", "green", "yellow", "purple"];

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
  const colorClass = avatarPalette[name]
    ? `avatar-${avatarPalette[name]}`
    : "avatar-orange";
  return html`<span class="avatar ${colorClass}">${initials}</span>`;
}

function formatDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeVal: string): string {
  if (!timeVal) return "";
  const [h, m] = timeVal.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

@customElement("janus-scheduler")
export class JanusScheduler extends LitElement {
  static styles = schedulerStyles;

  @state() title = "Strategy Workshop";
  @state() date = "2023-10-30";
  @state() startTime = "14:00";
  @state() endTime = "15:00";
  @state() participants = ["John Doe", "Sarah Chen"];
  @state() participantInput = "";
  @state() description =
    "Discussing the Q4 roadmap and resource allocation for upcoming projects.";
  @state() activeColor = "orange";
  @state() sidebarOpen = false;

  private _onClose() {
    this.dispatchEvent(
      new CustomEvent("close", { bubbles: true, composed: true }),
    );
  }

  private _removeParticipant(nameToRemove: string) {
    this.participants = this.participants.filter((p) => p !== nameToRemove);
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

  render() {
    const timeDisplay =
      this.startTime && this.endTime
        ? `${formatTime(this.startTime)} – ${formatTime(this.endTime)}`
        : "—";

    return html`
      <div
        class="overlay"
        @click=${(e: Event) => e.target === e.currentTarget && this._onClose()}
      >
        <div class="modal" role="dialog" aria-modal="true">
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
                  <div class="meta-value">
                    ${this.date ? formatDate(this.date) : "—"}
                  </div>
                </div>
              </div>
              <div class="meta-item">
                <span class="meta-icon">${ClockIcon()}</span>
                <div>
                  <div class="meta-label">Time</div>
                  <div class="meta-value">${timeDisplay}</div>
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
                    ${this.participants
                      .slice(0, 4)
                      .map((name) => avatarHtml(name))}
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
              <button class="btn-delete">${TrashIcon()} Delete Event</button>
            </div>
          </aside>

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

            <div
              class="mobile-summary-panel ${this.sidebarOpen
                ? "mobile-summary-panel--open"
                : ""}"
            >
              <div class="mobile-summary-grid">
                <div class="msummary-item">
                  <span class="meta-label">Date</span>
                  <span class="meta-value"
                    >${this.date ? formatDate(this.date) : "—"}</span
                  >
                </div>
                <div class="msummary-item">
                  <span class="meta-label">Time</span>
                  <span class="meta-value">${timeDisplay}</span>
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
                <div class="form-group">
                  <label>Date</label>
                  <div class="input-icon-wrap">
                    <span class="input-icon">${CalendarIcon()}</span>
                    <input
                      type="date"
                      .value=${this.date}
                      @input=${(e: Event) =>
                        (this.date = (e.target as HTMLInputElement).value)}
                      class="date-time-input"
                    />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Start Time</label>
                    <div class="input-icon-wrap">
                      <span class="input-icon">${ClockIcon()}</span>
                      <input
                        type="time"
                        .value=${this.startTime}
                        @input=${(e: Event) =>
                          (this.startTime = (
                            e.target as HTMLInputElement
                          ).value)}
                        class="date-time-input"
                      />
                    </div>
                  </div>
                  <div class="form-group">
                    <label>End Time</label>
                    <div class="input-icon-wrap">
                      <span class="input-icon">${ClockIcon()}</span>
                      <input
                        type="time"
                        .value=${this.endTime}
                        @input=${(e: Event) =>
                          (this.endTime = (e.target as HTMLInputElement).value)}
                        class="date-time-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

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
                      (name) => html`
                        <span class="chip">
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
                        </span>
                      `,
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

              <div class="form-section">
                <div class="section-label">Details</div>
                <div class="form-group">
                  <label for="description">Description</label>
                  <textarea
                    id="description"
                    .value=${this.description}
                    @input=${(e: Event) =>
                      (this.description = (
                        e.target as HTMLTextAreaElement
                      ).value)}
                    placeholder="Add a description…"
                    rows="4"
                  ></textarea>
                </div>
              </div>
            </div>

            <div class="panel-footer">
              <button class="btn-delete btn-delete--footer">
                ${TrashIcon()} Delete
              </button>
              <div class="footer-right">
                <button class="btn-cancel" @click=${this._onClose}>
                  Cancel
                </button>
                <button class="btn-save">Save Changes</button>
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
