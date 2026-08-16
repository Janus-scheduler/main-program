import { css } from "lit";

/**
 * The design's dark palette, as a reusable declaration block.
 *
 * Extracted so it can be applied from two different selectors — an explicit
 * `theme="dark"` and an `auto` theme under `prefers-color-scheme` — without
 * the values existing twice and drifting apart.
 */
const darkTokens = css`
  --janus-bg: var(--janus-chat-bg, #09090b);
  --janus-surface: var(--janus-chat-surface, #141416);
  --janus-surface-2: #1c1c1f;
  --janus-surface-3: #27272a;
  --janus-border: #27272a;
  --janus-border-strong: #3f3f46;
  --janus-text: #fafafa;
  --janus-text-2: #a1a1aa;
  --janus-text-3: #8b8b93;

  --janus-primary-fg: #ffffff;
  --janus-primary-subtle: rgba(249, 115, 22, 0.16);
  --janus-primary-border: rgba(249, 115, 22, 0.34);
  --janus-primary-ring: rgba(251, 146, 60, 0.45);

  --janus-ai: #a78bfa;
  --janus-ai-strong: #c4b5fd;
  --janus-ai-subtle: rgba(124, 92, 255, 0.18);
  --janus-ai-border: rgba(124, 92, 255, 0.38);

  --janus-info: #60a5fa;
  --janus-info-subtle: rgba(37, 99, 235, 0.18);
  --janus-info-border: rgba(37, 99, 235, 0.38);

  --janus-success: #4ade80;
  --janus-success-subtle: rgba(34, 197, 94, 0.15);
  --janus-success-border: rgba(34, 197, 94, 0.34);

  --janus-warning: #fbbf24;
  --janus-warning-subtle: rgba(217, 119, 6, 0.18);
  --janus-warning-border: rgba(217, 119, 6, 0.38);

  --janus-error: #f87171;
  --janus-error-subtle: rgba(239, 68, 68, 0.15);
  --janus-error-border: rgba(239, 68, 68, 0.36);

  --janus-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.5);
  --janus-shadow-lg:
    0 14px 36px rgba(0, 0, 0, 0.6), 0 4px 10px rgba(0, 0, 0, 0.4);
`;

/**
 * Styles for `<janus-chat>`, ported from the `Janus Screens.dc.html` design.
 *
 * TOKENS — the design ships a `--janus-*` palette. It is declared here on
 * `:host` rather than globally, because every Janus component is Shadow-DOM
 * encapsulated and this is the first one to use that palette. Two rules:
 *
 *   1. Every token is `var(--janus-x, fallback)`, so a host application can
 *      override any of them from a light-DOM ancestor — custom properties
 *      inherit through shadow boundaries.
 *   2. `--janus-primary` defers to `--janus-primary-color`, the hook the rest
 *      of this package already honours (see the primary-colour decoupling in
 *      `ai-bar-styles.ts`). Setting that one variable retints the chat too,
 *      with no chat-specific configuration.
 *
 * THEMING — light is the DEFAULT, and that is deliberate. Every other
 * component in this package is light-only (`ai-bar-styles.ts`,
 * `timeline-styles.ts` … all hardcode their colours), so a chat panel that
 * silently followed `prefers-color-scheme` would render dark inside an
 * otherwise light application for every user whose OS is set to dark. Dark is
 * therefore opt-in via `theme="dark"`, and `theme="auto"` restores the
 * OS-following behaviour for hosts that are themselves dark-aware.
 */
export const chatStyles = css`
  :host {
    /* ── palette ─────────────────────────────────────────────────────── */
    --janus-bg: var(--janus-chat-bg, #fafafa);
    --janus-surface: var(--janus-chat-surface, #ffffff);
    --janus-surface-2: #f4f4f5;
    --janus-surface-3: #ebebee;
    --janus-border: #e4e4e7;
    --janus-border-strong: #d4d4d8;
    --janus-text: #18181b;
    --janus-text-2: #52525b;
    --janus-text-3: #71717a;

    /* The one hook the rest of the package already uses. */
    --janus-primary: var(--janus-primary-color, #f97316);
    --janus-primary-solid: var(--janus-primary-color, #f97316);
    --janus-primary-fg: #ffffff;
    --janus-primary-subtle: #fff2e8;
    --janus-primary-border: #fed7aa;
    --janus-primary-ring: rgba(249, 115, 22, 0.4);

    --janus-ai: #6d4aff;
    --janus-ai-strong: #5b3fd9;
    --janus-ai-subtle: #f1ecff;
    --janus-ai-border: #ddd2ff;

    --janus-info: #1d4ed8;
    --janus-info-subtle: #dbeafe;
    --janus-info-border: #bfdbfe;

    --janus-success: #15803d;
    --janus-success-subtle: #dcfce7;
    --janus-success-border: #bbf7d0;

    --janus-warning: #b45309;
    --janus-warning-subtle: #fef3c7;
    --janus-warning-border: #fde68a;

    --janus-error: #b91c1c;
    --janus-error-subtle: #fee2e2;
    --janus-error-border: #fecaca;

    --janus-radius-sm: 6px;
    --janus-radius-md: 10px;
    --janus-radius-lg: 14px;
    --janus-radius-full: 9999px;

    --janus-shadow-sm:
      0 1px 2px rgba(24, 24, 27, 0.06), 0 1px 3px rgba(24, 24, 27, 0.08);
    --janus-shadow-lg:
      0 12px 32px rgba(24, 24, 27, 0.12), 0 4px 10px rgba(24, 24, 27, 0.06);
    --janus-shadow-focus: 0 0 0 3px var(--janus-primary-ring);

    --janus-font:
      "Geist", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --janus-font-mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;

    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--janus-surface);
    color: var(--janus-text);
    font-family: var(--janus-font);
    box-sizing: border-box;
  }

  /* Explicit opt-in. Wins regardless of the OS setting. */
  :host([theme="dark"]) {
    ${darkTokens}
  }

  /* Only theme="auto" follows the OS — never the default. */
  @media (prefers-color-scheme: dark) {
    :host([theme="auto"]) {
      ${darkTokens}
    }
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  /* ── header ────────────────────────────────────────────────────────── */

  .header {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 16px 18px;
    border-bottom: 1px solid var(--janus-border);
    flex-shrink: 0;
  }

  .header__badge {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: var(--janus-ai-subtle);
    border: 1px solid var(--janus-ai-border);
    color: var(--janus-ai-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .header__titles {
    line-height: 1.2;
    min-width: 0;
  }

  .header__title {
    font-size: 14px;
    font-weight: 600;
  }

  .header__subtitle {
    font-size: 11.5px;
    color: var(--janus-text-3);
  }

  .header__close {
    margin-left: auto;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: var(--janus-surface-2);
    color: var(--janus-text-2);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .header__close:hover {
    background: var(--janus-surface-3);
    color: var(--janus-text);
  }

  /* ── thread ────────────────────────────────────────────────────────── */

  .thread {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 20px 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .row {
    display: flex;
    gap: 10px;
    max-width: 94%;
  }

  .row--user {
    align-self: flex-end;
    max-width: 82%;
  }

  .avatar {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: var(--janus-ai-subtle);
    color: var(--janus-ai-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .bubble {
    background: var(--janus-surface-2);
    border: 1px solid var(--janus-border);
    border-radius: 4px 14px 14px 14px;
    padding: 11px 14px;
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--janus-text);
  }

  .bubble--user {
    background: var(--janus-primary-solid);
    color: var(--janus-primary-fg);
    border: none;
    border-radius: 14px 14px 4px 14px;
  }

  .divider {
    align-self: center;
    font-size: 11px;
    color: var(--janus-text-3);
    background: var(--janus-surface-2);
    padding: 3px 12px;
    border-radius: var(--janus-radius-full);
  }

  /* ── thinking ──────────────────────────────────────────────────────── */

  .thinking {
    background: var(--janus-surface-2);
    border: 1px solid var(--janus-border);
    border-radius: 4px 14px 14px 14px;
    padding: 14px 16px;
    display: flex;
    gap: 5px;
    align-items: center;
  }

  .thinking__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--janus-ai);
    animation: janus-dot 1.2s infinite;
  }

  .thinking__dot:nth-child(2) {
    animation-delay: 0.15s;
  }

  .thinking__dot:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes janus-dot {
    0%,
    80%,
    100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    40% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }

  /* ── parse card ────────────────────────────────────────────────────── */

  .card {
    background: var(--janus-surface);
    border: 1px solid var(--janus-border);
    border-radius: 4px 14px 14px 14px;
    padding: 14px;
    box-shadow: var(--janus-shadow-sm);
    animation: janus-pop 0.2s ease;
    min-width: 0;
  }

  .card--warning {
    border-color: var(--janus-warning-border);
    padding: 13px 14px;
  }

  .card--destructive {
    border-color: var(--janus-error-border);
  }

  @keyframes janus-pop {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .card__lead {
    font-size: 12px;
    color: var(--janus-text-2);
    margin-bottom: 11px;
  }

  .card__lead strong {
    color: var(--janus-text);
  }

  .card__question {
    font-size: 13px;
    color: var(--janus-text);
    line-height: 1.5;
    margin-bottom: 10px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-bottom: 12px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px 4px 8px;
    border-radius: var(--janus-radius-full);
    font-size: 12px;
    font-weight: 500;
    background: var(--janus-surface-2);
    border: 1px solid var(--janus-border);
    color: var(--janus-text-2);
  }

  .chip--person {
    background: var(--janus-ai-subtle);
    border-color: var(--janus-ai-border);
    color: var(--janus-ai-strong);
  }

  .chip--time {
    background: var(--janus-info-subtle);
    border-color: var(--janus-info-border);
    color: var(--janus-info);
  }

  .chip--place {
    background: var(--janus-primary-subtle);
    border-color: var(--janus-primary-border);
    color: var(--janus-primary-solid);
  }

  /* Assumed values get a dashed edge — the user is confirming a guess. */
  .chip--assumed {
    border-style: dashed;
  }

  .confidence {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }

  .confidence__pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: var(--janus-radius-full);
    background: var(--janus-success-subtle);
    border: 1px solid var(--janus-success-border);
    color: var(--janus-success);
    font-size: 11.5px;
    font-weight: 600;
  }

  .notes {
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .notes__item {
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--janus-text-3);
    padding-left: 13px;
    position: relative;
  }

  .notes__item::before {
    content: "•";
    position: absolute;
    left: 3px;
  }

  .change {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-family: var(--janus-font-mono);
    margin-bottom: 4px;
  }

  .change__from {
    color: var(--janus-text-3);
    text-decoration: line-through;
  }

  .change__to {
    color: var(--janus-info);
    font-weight: 600;
  }

  /* ── buttons ───────────────────────────────────────────────────────── */

  .actions {
    display: flex;
    gap: 8px;
    margin-top: 14px;
  }

  .btn {
    padding: 9px 14px;
    border-radius: var(--janus-radius-md);
    border: 1px solid var(--janus-border-strong);
    background: var(--janus-surface);
    color: var(--janus-text);
    font-family: var(--janus-font);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    line-height: 1.2;
  }

  .btn:hover {
    background: var(--janus-surface-2);
  }

  .btn--primary {
    flex: 1;
    padding: 9px;
    border: none;
    background: var(--janus-primary-solid);
    color: var(--janus-primary-fg);
  }

  .btn--primary:hover {
    filter: brightness(0.94);
    background: var(--janus-primary-solid);
  }

  .btn--destructive {
    background: var(--janus-error);
    color: #ffffff;
  }

  .btn--destructive:hover {
    background: var(--janus-error);
    filter: brightness(0.94);
  }

  .btn--small {
    padding: 6px 13px;
    font-size: 12px;
  }

  .btn--link {
    border: none;
    background: transparent;
    color: var(--janus-primary-solid);
    text-decoration: underline;
  }

  .btn--link:hover {
    background: transparent;
    filter: brightness(0.9);
  }

  .btn:disabled,
  .btn--choice:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }

  .btn--choice-selected {
    background: var(--janus-primary-solid) !important;
    color: var(--janus-primary-fg) !important;
    border-color: var(--janus-primary-solid) !important;
    opacity: 1 !important;
  }

  .card__hint {
    font-size: 11.5px;
    color: var(--janus-text-3);
    margin-top: 6px;
    margin-bottom: 8px;
  }

  .clarify-search {
    margin-bottom: 10px;
  }

  .clarify-search__input {
    width: 100%;
    box-sizing: border-box;
    padding: 7px 11px;
    border-radius: var(--janus-radius-md);
    border: 1px solid var(--janus-border-strong);
    background: var(--janus-surface);
    color: var(--janus-text);
    font-family: var(--janus-font);
    font-size: 12.5px;
    outline: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .clarify-search__input:focus {
    border-color: var(--janus-primary-solid);
    box-shadow: 0 0 0 2px var(--janus-primary-ring);
  }

  .clarify-selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px dashed var(--janus-border);
  }

  .clarify-selected-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: var(--janus-radius-full);
    font-size: 11.5px;
    font-weight: 600;
    background: var(--janus-primary-subtle);
    border: 1px solid var(--janus-primary-border);
    color: var(--janus-primary-solid);
  }

  .clarify-selected-tag__remove {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--janus-primary-solid);
    display: inline-flex;
    align-items: center;
    font-size: 13px;
    line-height: 1;
  }

  .clarify-scroll {
    max-height: 180px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 4px;
    margin-bottom: 10px;
  }

  .clarify-group-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--janus-text-3);
    margin-top: 4px;
    margin-bottom: 4px;
  }

  .clarify-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--janus-border);
  }

  .btn--choice {
    padding: 6px 12px;
    border-radius: var(--janus-radius-full);
    font-size: 12.5px;
    font-weight: 500;
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  /* ── success ───────────────────────────────────────────────────────── */

  .success {
    background: var(--janus-success-subtle);
    border: 1px solid var(--janus-success-border);
    border-radius: 4px 14px 14px 14px;
    padding: 13px 14px;
    animation: janus-pop 0.2s ease;
  }

  .success__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--janus-success);
    margin-bottom: 4px;
  }

  .success__summary {
    font-size: 12.5px;
    color: var(--janus-text-2);
    font-family: var(--janus-font-mono);
    line-height: 1.45;
  }

  .success .actions {
    margin-top: 10px;
  }

  /* ── suggestions ───────────────────────────────────────────────────── */

  .composer-area {
    padding: 14px 16px;
    border-top: 1px solid var(--janus-border);
    flex-shrink: 0;
    position: relative;
  }

  .suggestions {
    background: var(--janus-surface);
    border: 1px solid var(--janus-border);
    border-radius: var(--janus-radius-lg);
    box-shadow: var(--janus-shadow-lg);
    overflow: hidden;
    margin-bottom: 8px;
    max-height: 220px;
    overflow-y: auto;
  }

  .suggestions__group {
    padding: 7px 13px 3px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--janus-text-3);
  }

  .suggestion {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 13px;
    cursor: pointer;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
    font-family: var(--janus-font);
    color: var(--janus-text);
  }

  .suggestion + .suggestion {
    border-top: 1px solid var(--janus-border);
  }

  .suggestion[aria-selected="true"] {
    background: var(--janus-primary-subtle);
  }

  .suggestion__icon {
    display: flex;
    color: var(--janus-ai);
    flex-shrink: 0;
  }

  .suggestion__label {
    font-size: 13px;
    font-weight: 500;
  }

  .suggestion__badge {
    margin-left: auto;
    font-size: 10.5px;
    color: var(--janus-success);
    font-weight: 600;
  }

  /* ── composer ──────────────────────────────────────────────────────── */

  .composer {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--janus-surface);
    border: 1.5px solid var(--janus-border);
    border-radius: var(--janus-radius-full);
    padding: 6px 6px 6px 14px;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .composer:focus-within {
    border-color: var(--janus-primary);
    box-shadow: var(--janus-shadow-focus);
  }

  .composer__spark {
    display: flex;
    color: var(--janus-ai);
    flex-shrink: 0;
  }

  .composer__input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-family: var(--janus-font);
    font-size: 13.5px;
    color: var(--janus-text);
    padding: 0;
  }

  .composer__input::placeholder {
    color: var(--janus-text-3);
  }

  .icon-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: none;
    background: var(--janus-surface-2);
    color: var(--janus-text-2);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .icon-btn:hover {
    background: var(--janus-surface-3);
  }

  .send {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: none;
    background: var(--janus-primary-solid);
    color: var(--janus-primary-fg);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  /* Muted, not hidden — the design keeps the affordance visible when empty. */
  .send:disabled {
    background: var(--janus-surface-3);
    color: var(--janus-text-3);
    cursor: default;
  }

  /* ── focus visibility ──────────────────────────────────────────────── */

  .btn:focus-visible,
  .icon-btn:focus-visible,
  .send:focus-visible,
  .header__close:focus-visible,
  .suggestion:focus-visible {
    outline: 2px solid var(--janus-primary);
    outline-offset: 2px;
  }

  /* ── responsive ────────────────────────────────────────────────────── */

  @media (max-width: 640px) {
    .thread {
      padding: 18px;
      gap: 14px;
    }

    .row {
      max-width: 92%;
    }

    .bubble,
    .composer__input {
      font-size: 14px;
    }

    .composer-area {
      padding: 14px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    }

    .actions {
      flex-wrap: wrap;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .thinking__dot,
    .card,
    .success {
      animation: none;
    }
  }
`;
