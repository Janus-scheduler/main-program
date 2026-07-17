import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { type EventDraft } from "@janus-scheduler/core";

// Helper functions for dates & times formatting
function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${String(m).padStart(2, "0")} ${ampm}`;
}

@customElement("janus-confirm-dialog")
export class JanusConfirmDialog extends LitElement {
  @property({ type: String }) title = "";
  @property({ type: String }) subtitle = "";
  @property({ type: String }) confirmText = "Confirm";
  @property({ type: String }) cancelText = "Cancel";
  @property({ type: String }) accentColor = ""; // "red" or "orange"
  @property({ type: Object }) draft: EventDraft | null = null;
  @property({ attribute: false }) resolveResourceName: (id: string) => string =
    (id) => id;

  static styles = css`
    :host {
      position: absolute;
      inset: 0;
      background: rgba(9, 9, 11, 0.3);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 1000;
      animation: confirmFadeIn 0.18s ease-out;
    }

    @keyframes confirmFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .confirm-card {
      background: #ffffff;
      border: 1px solid var(--border, #e4e4e7);
      border-radius: 16px;
      width: 100%;
      max-width: 440px;
      max-height: calc(100% - 48px);
      box-shadow:
        0 20px 40px rgba(9, 9, 11, 0.08),
        0 4px 12px rgba(9, 9, 11, 0.04);
      display: flex;
      flex-direction: column;
      padding: 28px;
      color: var(--text-primary, #18181b);
      box-sizing: border-box;
      align-self: center;
      animation: confirmSlideUp 0.22s cubic-bezier(0.25, 1, 0.5, 1);
    }

    .confirm-card.accent-red {
      border-top: 5px solid var(--c-red, #ef4444);
      --confirm-accent: var(--c-red, #ef4444);
      --confirm-accent-text: #ffffff;
    }

    .confirm-card.accent-orange {
      border-top: 5px solid var(--janus-primary-color, #f97316);
      --confirm-accent: var(--janus-primary-color, #f97316);
      --confirm-accent-text: #ffffff;
    }

    .confirm-scroll-content {
      flex: 1;
      overflow-y: auto;
      margin-right: -14px;
      padding-right: 14px;
    }

    @keyframes confirmSlideUp {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .confirm-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary, #18181b);
      margin: 0 0 6px 0;
      letter-spacing: -0.4px;
    }

    .confirm-subtitle {
      font-size: 13px;
      color: var(--text-secondary, #71717a);
      margin: 0 0 24px 0;
    }

    .confirm-summary-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .confirm-summary-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      font-size: 14px;
      color: var(--text-primary, #18181b);
    }

    .confirm-summary-item svg {
      width: 16px;
      height: 16px;
      stroke: var(--text-secondary, #71717a);
      fill: none;
      stroke-width: 2;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .confirm-summary-item-val {
      line-height: 1.4;
      text-align: left;
    }

    .confirm-summary-item-val.event-title-val {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary, #18181b);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .confirm-color-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .confirm-divider {
      border: none;
      border-bottom: 1px solid var(--border, #e4e4e7);
      margin: 18px 0;
      width: 100%;
    }

    .confirm-description {
      font-size: 13px;
      color: var(--text-secondary, #71717a);
      line-height: 1.6;
      text-align: left;
      margin: 0;
      background: #f4f4f5;
      padding: 10px 14px;
      border-radius: 8px;
    }

    .confirm-footer {
      margin-top: 28px;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .confirm-btn-back {
      background: #ffffff;
      border: 1.5px solid var(--border, #e4e4e7);
      color: var(--text-secondary, #71717a);
      padding: 8px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition:
        background 0.15s,
        border-color 0.15s,
        color 0.15s;
    }

    .confirm-btn-back:hover {
      background: #f4f4f5;
      border-color: #d1d5db;
      color: var(--text-primary, #18181b);
    }

    .confirm-btn-create {
      background: var(--confirm-accent, #f97316);
      border: none;
      color: var(--confirm-accent-text, #ffffff);
      padding: 8px 22px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition:
        transform 0.15s,
        opacity 0.15s;
    }

    .confirm-btn-create:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }
  `;

  render() {
    if (!this.draft) return nothing;

    const draft = this.draft;
    const accentClass = this.accentColor ? `accent-${this.accentColor}` : "";

    return html`
      <div
        class="confirm-card ${accentClass}"
        role="alertdialog"
        aria-modal="true"
      >
        <h2 class="confirm-title">${this.title}</h2>
        <p class="confirm-subtitle">${this.subtitle}</p>

        <div class="confirm-scroll-content">
          <div class="confirm-summary-list">
            <!-- Event Title with Active Color Dot -->
            <div class="confirm-summary-item">
              <div class="confirm-summary-item-val event-title-val">
                <span
                  class="confirm-color-dot"
                  style="background-color: var(--c-${draft.activeColor}, #f97316);"
                ></span>
                ${draft.title || "Untitled Event"}
              </div>
            </div>

            <!-- Date Row with Calendar SVG Icon -->
            <div class="confirm-summary-item">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <div class="confirm-summary-item-val">
                ${formatDate(draft.startDate)}
              </div>
            </div>

            <!-- Time Row with Clock SVG Icon -->
            ${!draft.allDay
              ? html`
                  <div class="confirm-summary-item">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <div class="confirm-summary-item-val">
                      ${formatTime(draft.startTime)} –
                      ${formatTime(draft.endTime)}
                    </div>
                  </div>
                `
              : html`
                  <div class="confirm-summary-item">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <div class="confirm-summary-item-val">All Day</div>
                  </div>
                `}

            <!-- Resources/Participants Row with Users SVG Icon -->
            ${draft.participants && draft.participants.length > 0
              ? html`
                  <div class="confirm-summary-item">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                      ></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <div class="confirm-summary-item-val">
                      ${draft.participants
                        .map((pId: string) => this.resolveResourceName(pId))
                        .join(", ")}
                    </div>
                  </div>
                `
              : nothing}
          </div>

          <!-- Divider & Description -->
          ${draft.description
            ? html`
                <hr class="confirm-divider" />
                <p class="confirm-description">${draft.description}</p>
              `
            : nothing}
        </div>

        <!-- Footer Buttons -->
        <div class="confirm-footer">
          <button class="confirm-btn-back" @click=${this._onCancel}>
            ${this.cancelText}
          </button>
          <button class="confirm-btn-create" @click=${this._onConfirm}>
            ${this.confirmText}
          </button>
        </div>
      </div>
    `;
  }

  private _onCancel() {
    this.dispatchEvent(
      new CustomEvent("cancel", { bubbles: true, composed: true }),
    );
  }

  private _onConfirm() {
    this.dispatchEvent(
      new CustomEvent("confirm", { bubbles: true, composed: true }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "janus-confirm-dialog": JanusConfirmDialog;
  }
}
