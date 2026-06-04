import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { aiBarStyles } from "./ai-bar-styles";
import { SparkleIcon } from "./timeline-icons";

/**
 * <janus-ai-bar>
 *
 * A standalone AI prompt bar component. Fires a "ai-submit" custom event
 * with `{ detail: { prompt: string } }` when the user clicks Schedule
 * or presses Enter.
 */
@customElement("janus-ai-bar")
export class JanusAiBar extends LitElement {
  static styles = aiBarStyles;

  /** Placeholder text shown in the input */
  @property({ type: String })
  placeholder =
    "Try 'Schedule a design sync with Alex tomorrow at 10am in Room A'";

  /** Controlled value (optional — component also manages internal state) */
  @property({ type: String })
  value = "";

  /** Button label */
  @property({ type: String })
  buttonLabel = "Schedule";

  @state() private _prompt = "";

  override render() {
    return html`
      <div class="ai-card">
        ${SparkleIcon()}
        <input
          class="ai-card__input"
          type="text"
          .value=${this._prompt || this.value}
          placeholder=${this.placeholder}
          @input=${this._handleInput}
          @keydown=${this._handleKeydown}
        />
        <button class="ai-card__btn" @click=${this._handleSubmit}>
          ${this.buttonLabel}
        </button>
      </div>
    `;
  }

  private _handleInput(e: Event) {
    this._prompt = (e.target as HTMLInputElement).value;
    // Bubble a "ai-input" event so parent components can sync if needed
    this.dispatchEvent(
      new CustomEvent("ai-input", {
        detail: { prompt: this._prompt },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") this._handleSubmit();
  }

  private _handleSubmit() {
    const prompt = this._prompt.trim();
    if (!prompt) return;
    this.dispatchEvent(
      new CustomEvent("ai-submit", {
        detail: { prompt },
        bubbles: true,
        composed: true,
      }),
    );
    this._prompt = "";
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "janus-ai-bar": JanusAiBar;
  }
}
