import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { chatStyles } from "./chat-styles";
import { SparkleIcon, MicIcon, SendIcon } from "./timeline-icons";
import type {
  ChatChip,
  ChatChoice,
  ChatClarifyMessage,
  ChatMessage,
  ChatParseCard,
  ChatSuggestion,
} from "./chat-types";

// ── local icons ────────────────────────────────────────────────────────────
// Chat-specific glyphs from the design. The shared `timeline-icons.ts` set is
// sized and styled for the timeline chrome; these are 12-14px inline marks that
// inherit `currentColor` from their chip.

const PersonIcon = (size = 12) => html`
  <svg
    width=${size}
    height=${size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    aria-hidden="true"
  >
    <circle cx="12" cy="8" r="4"></circle>
    <path d="M4 21a8 8 0 0 1 16 0"></path>
  </svg>
`;

const ClockIcon = (size = 12) => html`
  <svg
    width=${size}
    height=${size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9"></circle>
    <path d="M12 7v5l3 2"></path>
  </svg>
`;

const PinIcon = (size = 12) => html`
  <svg
    width=${size}
    height=${size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    aria-hidden="true"
  >
    <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"></path>
    <circle cx="12" cy="10" r="2.6"></circle>
  </svg>
`;

const BoxIcon = (size = 12) => html`
  <svg
    width=${size}
    height=${size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    aria-hidden="true"
  >
    <rect x="3" y="4" width="18" height="17" rx="3"></rect>
    <path d="M3 9h18"></path>
  </svg>
`;

const CheckIcon = (size = 12, width = 2.6) => html`
  <svg
    width=${size}
    height=${size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width=${width}
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5"></path>
  </svg>
`;

const CloseIcon = () => html`
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M18 6 6 18M6 6l12 12"></path>
  </svg>
`;

const ArrowIcon = () => html`
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6"></path>
  </svg>
`;

const CHIP_ICONS = {
  person: PersonIcon,
  time: ClockIcon,
  place: PinIcon,
  thing: BoxIcon,
} as const;

/**
 * <janus-chat>
 *
 * The conversation panel from `Janus Screens.dc.html`. Renders the design's
 * discrete states — thinking, parse card, needs-clarification, success — plus
 * the composer and its typing-suggestion dropdown.
 *
 * ── This component is a VIEW. ──────────────────────────────────────────────
 *
 * It holds no scheduling logic, never classifies anything, and never touches
 * the store. It takes `messages` and emits intent events; a controller decides
 * what a confirmation means. That is what lets it be driven from static
 * fixtures, from a live classifier, or from a test, unchanged.
 *
 * It also never commits anything on its own. `chat-confirm` is a request, and
 * the success bubble appears only when the controller pushes one — the
 * verify-then-act contract lives in the controller, and this component cannot
 * accidentally bypass it.
 *
 * `<janus-ai-bar>` remains the entry point ("The clean input is the entry
 * point — pressing it opens a full conversation"); this is what opens.
 *
 * ── Events ────────────────────────────────────────────────────────────────
 *   chat-submit            { prompt }
 *   chat-confirm           { messageId }
 *   chat-edit              { messageId }
 *   chat-clarify-response  { messageId, choiceId, label }
 *   chat-undo              { messageId }
 *   chat-view              { messageId }
 *   chat-suggestion-select { id, label }
 *   chat-input             { prompt }
 *   chat-close             {}
 */
@customElement("janus-chat")
export class JanusChat extends LitElement {
  static readonly styles = chatStyles;

  /** The conversation, oldest first. */
  @property({ type: Array })
  messages: ChatMessage[] = [];

  /**
   * Typing suggestions. Rendered above the composer when non-empty; the host
   * owns the filtering, since only it knows the catalog.
   */
  @property({ type: Array })
  suggestions: ChatSuggestion[] = [];

  @property({ type: String })
  heading = "Ask Janus";

  @property({ type: String })
  subheading = "Schedule with plain language";

  @property({ type: String })
  placeholder = "Message Janus…";

  /**
   * Colour scheme: `"light"` (default), `"dark"`, or `"auto"` to follow
   * `prefers-color-scheme`.
   *
   * Light is the default on purpose. Every other component in this package is
   * light-only, so following the OS by default would render a dark chat panel
   * inside an otherwise light application for every dark-OS user. Use `"auto"`
   * only when the host application is itself dark-aware.
   *
   * Reflected to an attribute because the stylesheet selects on
   * `:host([theme="dark"])`.
   */
  @property({ type: String, reflect: true })
  theme: "light" | "dark" | "auto" = "light";

  /** Controlled input value. The component also tracks its own. */
  @property({ type: String })
  value = "";

  /** Show the header close button. */
  @property({ type: Boolean, attribute: "show-close" })
  showClose = true;

  /** Show the voice button. Off by default — nothing is wired to it yet. */
  @property({ type: Boolean, attribute: "show-voice" })
  showVoice = false;

  /**
   * Append a thinking bubble without the host having to add and remove one.
   * A host that wants finer control can push a `kind: "thinking"` message
   * instead; both render identically.
   */
  @property({ type: Boolean })
  busy = false;

  @property({ type: Boolean })
  disabled = false;

  @state() private _prompt = "";
  @state() private _activeSuggestion = 0;
  @state() private _answeredMessageIds = new Set<string>();
  @state() private _selectedChoices: Record<string, Set<string>> = {};
  @state() private _searchQueries: Record<string, string> = {};
  @state() private _answeredChoiceMap: Record<string, string> = {};

  @query(".thread") private _thread?: HTMLElement;

  /** Number of rendered rows at the last scroll-pin, to detect growth. */
  private _lastRowCount = -1;

  override render() {
    const rows: ChatMessage[] = this.busy
      ? [
          ...this.messages,
          { id: "__busy__", role: "assistant", kind: "thinking" },
        ]
      : this.messages;

    const text = this._prompt || this.value;
    const canSend = text.trim().length > 0;

    let latestActiveId: string | undefined;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i];
      if (
        msg.role === "assistant" &&
        (msg.kind === "clarify" || msg.kind === "parse")
      ) {
        latestActiveId = msg.id;
        break;
      }
    }

    let currentPlaceholder = this.placeholder;
    if (this.messages.length > 0) {
      const lastMsg = this.messages[this.messages.length - 1];
      if (
        lastMsg.kind === "clarify" &&
        lastMsg.inputPlaceholder &&
        !this._answeredMessageIds.has(lastMsg.id) &&
        !lastMsg.answered
      ) {
        currentPlaceholder = lastMsg.inputPlaceholder;
      }
    }

    return html`
      ${this._renderHeader()}
      <div
        class="thread"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        ${repeat(
          rows,
          (m) => m.id,
          (m) => this._renderMessage(m, latestActiveId),
        )}
      </div>
      <div class="composer-area">
        ${this._renderSuggestions()}
        <div class="composer">
          <span class="composer__spark">${SparkleIcon()}</span>
          <input
            class="composer__input"
            type="text"
            .value=${text}
            placeholder=${currentPlaceholder}
            aria-label=${currentPlaceholder}
            autocomplete="off"
            ?disabled=${this.disabled}
            @input=${this._onInput}
            @keydown=${this._onKeydown}
          />
          ${this.showVoice
            ? html`<button
                class="icon-btn"
                type="button"
                aria-label="Voice input"
                ?disabled=${this.disabled}
                @click=${() => this._emit("chat-voice", {})}
              >
                ${MicIcon()}
              </button>`
            : nothing}
          <button
            class="send"
            type="button"
            aria-label="Send"
            ?disabled=${!canSend || this.disabled}
            @click=${this._submit}
          >
            ${SendIcon()}
          </button>
        </div>
      </div>
    `;
  }

  private _renderHeader() {
    return html`
      <div class="header">
        <div class="header__badge">${SparkleIcon()}</div>
        <div class="header__titles">
          <div class="header__title">${this.heading}</div>
          ${this.subheading
            ? html`<div class="header__subtitle">${this.subheading}</div>`
            : nothing}
        </div>
        ${this.showClose
          ? html`<button
              class="header__close"
              type="button"
              aria-label="Close chat"
              @click=${() => this._emit("chat-close", {})}
            >
              ${CloseIcon()}
            </button>`
          : nothing}
      </div>
    `;
  }

  private _renderMessage(
    m: ChatMessage,
    latestActiveId?: string,
  ): TemplateResult {
    switch (m.kind) {
      case "divider":
        return html`<div class="divider">${m.text}</div>`;

      case "text":
        return m.role === "user"
          ? html`<div class="row row--user">
              <div class="bubble bubble--user">${m.text}</div>
            </div>`
          : this._assistantRow(html`<div class="bubble">${m.text}</div>`);

      case "thinking":
        return this._assistantRow(html`
          <div class="thinking" role="status" aria-label="Janus is thinking">
            <span class="thinking__dot"></span>
            <span class="thinking__dot"></span>
            <span class="thinking__dot"></span>
          </div>
        `);

      case "parse":
        return this._assistantRow(
          this._renderParseCard(
            m.id,
            m.card,
            m.id === latestActiveId,
            Boolean(m.finalized),
          ),
        );

      case "clarify": {
        const isAnswered = Boolean(
          this._answeredMessageIds.has(m.id) || m.answered,
        );
        const isLatest = m.id === latestActiveId;
        const isDisabled = this.disabled || isAnswered || !isLatest;

        const selectedSet = this._selectedChoices[m.id] ?? new Set<string>();
        const query = (this._searchQueries[m.id] ?? "").toLowerCase().trim();

        const allChoices = m.choices ?? [];
        const filteredChoices = query
          ? allChoices.filter(
              (c) =>
                c.label.toLowerCase().includes(query) ||
                (c.group && c.group.toLowerCase().includes(query)),
            )
          : allChoices;

        const hasGroups = allChoices.some((c) => Boolean(c.group));
        const groups: Record<string, ChatChoice[]> = {};
        if (hasGroups) {
          for (const c of filteredChoices) {
            const grp = c.group || "Other";
            groups[grp] = groups[grp] || [];
            groups[grp].push(c);
          }
        }

        const selectedCount = selectedSet.size;

        return this._assistantRow(html`
          <div class="card card--warning">
            ${m.ack ? html`<div class="card__lead">${m.ack}</div>` : nothing}
            ${m.chips && m.chips.length
              ? html`<div class="chips">
                  ${m.chips.map((chip) => this._renderChip(chip))}
                </div>`
              : nothing}
            <div class="card__question">${m.question}</div>
            ${m.hint ? html`<div class="card__hint">${m.hint}</div>` : nothing}
            ${m.searchable && !isAnswered
              ? html`
                  <div class="clarify-search">
                    <input
                      class="clarify-search__input"
                      type="text"
                      placeholder="🔍 Search rooms & people…"
                      .value=${this._searchQueries[m.id] ?? ""}
                      ?disabled=${isDisabled}
                      @input=${(e: Event) => {
                        const val = (e.target as HTMLInputElement).value;
                        this._searchQueries = {
                          ...this._searchQueries,
                          [m.id]: val,
                        };
                      }}
                    />
                  </div>
                `
              : nothing}
            ${m.multiselect && selectedSet.size > 0 && !isAnswered
              ? html`
                  <div class="clarify-selected-tags">
                    ${Array.from(selectedSet).map((choiceId) => {
                      const c = allChoices.find((ch) => ch.id === choiceId);
                      return html`
                        <span class="clarify-selected-tag">
                          ${c?.label ?? choiceId}
                          <button
                            class="clarify-selected-tag__remove"
                            type="button"
                            ?disabled=${isDisabled}
                            @click=${() => this._toggleChoice(m.id, choiceId)}
                          >
                            ×
                          </button>
                        </span>
                      `;
                    })}
                  </div>
                `
              : nothing}

            <div
              class="${allChoices.length > 6 || hasGroups
                ? "clarify-scroll"
                : "choices"}"
            >
              ${hasGroups
                ? Object.entries(groups).map(
                    ([groupName, groupChoices]) => html`
                      <div class="clarify-group-title">${groupName}</div>
                      <div class="choices">
                        ${groupChoices.map((c) =>
                          this._renderChoiceButton(
                            m,
                            c,
                            isDisabled,
                            selectedSet,
                          ),
                        )}
                      </div>
                    `,
                  )
                : filteredChoices.map((c) =>
                    this._renderChoiceButton(m, c, isDisabled, selectedSet),
                  )}
            </div>

            ${m.multiselect && !isAnswered
              ? html`
                  <div class="clarify-footer">
                    <button
                      class="btn btn--primary"
                      type="button"
                      ?disabled=${isDisabled || selectedCount === 0}
                      @click=${() => this._submitMultiSelect(m)}
                    >
                      Confirm ${selectedCount > 0 ? `(${selectedCount})` : ""}
                    </button>
                  </div>
                `
              : nothing}
            ${m.progress
              ? html`<div
                  class="progress"
                  style="font-size: 0.8em; opacity: 0.7; margin-top: 8px;"
                >
                  ${m.progress}
                </div>`
              : nothing}
          </div>
        `);
      }

      case "success":
        return this._assistantRow(html`
          <div class="success">
            <div class="success__title">
              ${CheckIcon(15, 2.4)}${m.title ?? "Scheduled"}
            </div>
            <div class="success__summary">${m.summary}</div>
            ${m.canView !== false || m.canUndo
              ? html`<div class="actions">
                  ${m.canView !== false
                    ? html`<button
                        class="btn btn--small"
                        type="button"
                        @click=${() =>
                          this._emit("chat-view", { messageId: m.id })}
                      >
                        View
                      </button>`
                    : nothing}
                  ${m.canUndo
                    ? html`<button
                        class="btn btn--small btn--link"
                        type="button"
                        @click=${() =>
                          this._emit("chat-undo", { messageId: m.id })}
                      >
                        Undo
                      </button>`
                    : nothing}
                </div>`
              : nothing}
          </div>
        `);
    }
  }

  private _toggleChoice(messageId: string, choiceId: string) {
    const current = new Set(this._selectedChoices[messageId] ?? []);
    if (current.has(choiceId)) current.delete(choiceId);
    else current.add(choiceId);
    this._selectedChoices = { ...this._selectedChoices, [messageId]: current };
  }

  private _submitChoice(m: ChatClarifyMessage, c: ChatChoice) {
    this._answeredMessageIds = new Set(this._answeredMessageIds).add(m.id);
    this._answeredChoiceMap = { ...this._answeredChoiceMap, [m.id]: c.id };
    this._emit("chat-clarify-response", {
      messageId: m.id,
      choiceId: c.id,
      label: c.label,
    });
  }

  private _submitMultiSelect(m: ChatClarifyMessage) {
    const selected = this._selectedChoices[m.id];
    if (!selected || selected.size === 0) return;
    const choiceIds = Array.from(selected);
    const choices = (m.choices ?? []).filter((c) => selected.has(c.id));
    const labels = choices.map((c) => c.label);
    const combinedLabel = labels.join(" and ");

    this._answeredMessageIds = new Set(this._answeredMessageIds).add(m.id);
    this._emit("chat-clarify-response", {
      messageId: m.id,
      choiceId: choiceIds.join(","),
      label: combinedLabel,
      choiceIds,
      labels,
    });
  }

  private _renderChoiceButton(
    m: ChatClarifyMessage,
    c: ChatChoice,
    isDisabled: boolean,
    selectedSet: Set<string>,
  ): TemplateResult {
    const isSelected = m.multiselect
      ? selectedSet.has(c.id)
      : this._answeredChoiceMap[m.id] === c.id;

    return html`
      <button
        class="btn btn--choice ${isSelected ? "btn--choice-selected" : ""}"
        type="button"
        ?disabled=${isDisabled && !isSelected}
        @click=${() => {
          if (m.multiselect) {
            this._toggleChoice(m.id, c.id);
          } else {
            this._submitChoice(m, c);
          }
        }}
      >
        ${c.label}
      </button>
    `;
  }

  private _assistantRow(body: TemplateResult): TemplateResult {
    return html`
      <div class="row">
        <div class="avatar">${SparkleIcon()}</div>
        ${body}
      </div>
    `;
  }

  private _renderParseCard(
    id: string,
    card: ChatParseCard,
    isLatest: boolean,
    isFinalized: boolean,
  ): TemplateResult {
    const lead = card.lead ?? "Here's what I understood:";
    const isDisabled =
      this.disabled ||
      isFinalized ||
      !isLatest ||
      this._answeredMessageIds.has(id);

    return html`
      <div class="card ${card.destructive ? "card--destructive" : ""}">
        <div class="card__lead">
          ${lead}${card.title ? html` <strong>${card.title}</strong>` : nothing}
        </div>

        ${card.change
          ? html`<div class="change">
              <span class="change__from">${card.change.from}</span>
              ${ArrowIcon()}
              <span class="change__to">${card.change.to}</span>
            </div>`
          : nothing}
        ${card.chips.length
          ? html`<div class="chips">
              ${card.chips.map((chip) => this._renderChip(chip))}
            </div>`
          : nothing}
        ${card.notes?.length
          ? html`<ul class="notes" aria-label="Assumptions">
              ${card.notes.map(
                (note) => html`<li class="notes__item">${note}</li>`,
              )}
            </ul>`
          : nothing}
        ${typeof card.confidence === "number"
          ? html`<div class="confidence">
              <span
                class="confidence__pill"
                title=${card.confidenceLabel ??
                "How sure the classifier is that this is the right kind of request. It says nothing about the details above."}
              >
                ${CheckIcon()}${Math.round(card.confidence * 100)}%
                ${card.confidenceLabel ?? "sure what you meant"}
              </span>
            </div>`
          : nothing}

        <div class="actions">
          <button
            class="btn btn--primary ${card.destructive
              ? "btn--destructive"
              : ""}"
            type="button"
            ?disabled=${isDisabled}
            @click=${() => {
              this._answeredMessageIds = new Set(this._answeredMessageIds).add(
                id,
              );
              this._emit("chat-confirm", { messageId: id });
            }}
          >
            ${card.confirmLabel ?? "Confirm & schedule"}
          </button>
          ${card.editLabel === null
            ? nothing
            : html`<button
                class="btn"
                type="button"
                ?disabled=${isDisabled}
                @click=${() => {
                  this._answeredMessageIds = new Set(
                    this._answeredMessageIds,
                  ).add(id);
                  this._emit("chat-edit", { messageId: id });
                }}
              >
                ${card.editLabel ?? "Edit"}
              </button>`}
        </div>
      </div>
    `;
  }

  private _renderChip(chip: ChatChip): TemplateResult {
    const icon = CHIP_ICONS[chip.kind] ?? BoxIcon;
    return html`
      <span
        class="chip chip--${chip.kind} ${chip.assumed ? "chip--assumed" : ""}"
        title=${chip.assumed ? "Assumed — check before confirming" : chip.label}
      >
        ${icon()}${chip.label}
      </span>
    `;
  }

  private _renderSuggestions() {
    if (this.suggestions.length === 0) return nothing;

    // Consecutive rows sharing a `group` render under one heading, so the host
    // controls grouping purely by ordering its array.
    let lastGroup: string | undefined;
    return html`
      <div class="suggestions" role="listbox" aria-label="Suggestions">
        ${this.suggestions.map((s, i) => {
          const heading =
            s.group && s.group !== lastGroup
              ? html`<div class="suggestions__group">${s.group}</div>`
              : nothing;
          lastGroup = s.group;
          const icon = CHIP_ICONS[s.kind ?? "person"] ?? PersonIcon;
          return html`
            ${heading}
            <button
              class="suggestion"
              type="button"
              role="option"
              aria-selected=${i === this._activeSuggestion ? "true" : "false"}
              @click=${() => this._selectSuggestion(i)}
            >
              <span class="suggestion__icon">${icon(14)}</span>
              <span class="suggestion__label">${s.label}</span>
              ${s.badge
                ? html`<span class="suggestion__badge">${s.badge}</span>`
                : nothing}
            </button>
          `;
        })}
      </div>
    `;
  }

  // ── behaviour ───────────────────────────────────────────────────────────

  private _onInput(e: Event) {
    this._prompt = (e.target as HTMLInputElement).value;
    this._activeSuggestion = 0;
    this._emit("chat-input", { prompt: this._prompt });
  }

  private _onKeydown(e: KeyboardEvent) {
    const hasSuggestions = this.suggestions.length > 0;

    if (hasSuggestions && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      const n = this.suggestions.length;
      this._activeSuggestion = (this._activeSuggestion + delta + n) % n;
      return;
    }

    if (e.key === "Escape" && hasSuggestions) {
      e.preventDefault();
      this.suggestions = [];
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      // Enter picks the highlighted suggestion when the list is open — the
      // same key sending the message instead would be a constant misfire.
      if (hasSuggestions) this._selectSuggestion(this._activeSuggestion);
      else this._submit();
    }
  }

  private _selectSuggestion(index: number) {
    const s = this.suggestions[index];
    if (!s) return;
    this._emit("chat-suggestion-select", { id: s.id, label: s.label });
  }

  private _submit() {
    const prompt = (this._prompt || this.value).trim();
    if (!prompt) return;
    this._emit("chat-submit", { prompt });
    this._prompt = "";
    this.value = "";
    const inputEl =
      this.renderRoot?.querySelector<HTMLInputElement>(".composer__input");
    if (inputEl) inputEl.value = "";
  }

  private _emit(type: string, detail: Record<string, unknown>) {
    this.dispatchEvent(
      new CustomEvent(type, { detail, bubbles: true, composed: true }),
    );
  }

  /**
   * Keep the newest message in view as the thread grows.
   *
   * Only scrolls when the row count actually increased, so re-rendering an
   * existing message (a card losing its buttons after confirmation, say) does
   * not yank a user who has scrolled up to read history.
   */
  protected override updated() {
    const rowCount = this.messages.length + (this.busy ? 1 : 0);
    if (rowCount !== this._lastRowCount) {
      this._lastRowCount = rowCount;
      const thread = this._thread;
      if (thread) thread.scrollTop = thread.scrollHeight;
    }
  }

  /** Move focus into the composer — call this when opening the panel. */
  focusComposer() {
    this.renderRoot
      ?.querySelector<HTMLInputElement>(".composer__input")
      ?.focus();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "janus-chat": JanusChat;
  }
}
