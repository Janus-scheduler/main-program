import { css } from "lit";

export const schedulerStyles = css`
  @import url("https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap");

  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :host {
    --orange: #f97316;
    --orange-light: #fff7ed;
    --orange-glow: rgba(249, 115, 22, 0.15);

    --border: #e4e4e7;
    --text-primary: #18181b;
    --text-secondary: #71717a;
    --text-muted: #a1a1aa;

    --sidebar-bg: #fafaf9;
    --panel-bg: #ffffff;

    --chip-bg: #f4f4f5;
    --chip-border: #e4e4e7;
    --input-bg: #fafafa;
    --input-border: #e4e4e7;
    --input-radius: 10px;

    --red: #ef4444;

    --c-orange: #f97316;
    --c-blue: #3b82f6;
    --c-green: #10b981;
    --c-yellow: #f59e0b;
    --c-purple: #8b5cf6;

    font-family: "Roboto", sans-serif;
    display: block;
  }

  /* ══════════════════════════════════
   OVERLAY
══════════════════════════════════ */
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 999;
    animation: fadeIn 0.18s ease;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* ══════════════════════════════════
   MODAL SHELL
══════════════════════════════════ */
  .modal {
    display: flex;
    width: 100%;
    max-width: 740px;
    /* On desktop: fixed comfortable height; on mobile: full height */
    max-height: 90vh;
    border-radius: 18px;
    overflow: hidden;
    box-shadow:
      0 20px 60px rgba(0, 0, 0, 0.16),
      0 2px 8px rgba(0, 0, 0, 0.08);
    border: 1px solid var(--border);
    background: var(--panel-bg);
    animation: slideUp 0.24s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ══════════════════════════════════
   SIDEBAR  (hidden on mobile)
══════════════════════════════════ */
  .sidebar {
    width: 230px;
    flex-shrink: 0;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .sidebar-accent {
    height: 5px;
    width: 100%;
    flex-shrink: 0;
  }
  .sidebar-accent.color-orange {
    background: var(--c-orange);
  }
  .sidebar-accent.color-blue {
    background: var(--c-blue);
  }
  .sidebar-accent.color-green {
    background: var(--c-green);
  }
  .sidebar-accent.color-yellow {
    background: var(--c-yellow);
  }
  .sidebar-accent.color-purple {
    background: var(--c-purple);
  }

  .sidebar-top {
    padding: 18px 18px 14px;
    border-bottom: 1px solid var(--border);
  }

  .sidebar-event-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--orange);
    background: var(--orange-light);
    border-radius: 4px;
    padding: 2px 7px;
    margin-bottom: 8px;
  }

  .sidebar-title {
    font-size: 14.5px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.4;
    letter-spacing: 0.07em;
    word-break: break-word;
  }

  .sidebar-meta {
    flex: 1;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .meta-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
  }

  .meta-icon {
    margin-top: 1px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .meta-label {
    font-size: 12px;
    font-weight: 300;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-muted);
    margin-bottom: 2px;
  }

  .meta-value {
    font-size: 12px;
    font-weight: 400;
    text-align: left;
    color: var(--text-primary);
    word-break: break-word;
  }

  .color-meta-block {
    min-width: 0;
    width: 100%;
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-top: 6px;
  }

  .swatches--sm {
    margin-top: 4px;
    gap: 6px;
  }

  /* ── Perfect circles ── */
  .swatch {
    width: 18px;
    height: 18px;
    min-width: 18px;
    min-height: 18px;
    border-radius: 50%;
    border: 2.5px solid transparent;
    cursor: pointer;
    padding: 0;
    outline: none;
    transition:
      transform 0.15s,
      box-shadow 0.15s;
    display: block;
    flex-shrink: 0;
  }
  .swatch:hover {
    transform: scale(1.15);
  }
  .swatch.active {
    box-shadow:
      0 0 0 2px #fff,
      0 0 0 4px currentColor;
  }

  .swatch-orange {
    background: var(--c-orange);
    color: var(--c-orange);
  }
  .swatch-blue {
    background: var(--c-blue);
    color: var(--c-blue);
  }
  .swatch-green {
    background: var(--c-green);
    color: var(--c-green);
  }
  .swatch-yellow {
    background: var(--c-yellow);
    color: var(--c-yellow);
  }
  .swatch-purple {
    background: var(--c-purple);
    color: var(--c-purple);
  }

  /* Avatars */
  .avatar-stack {
    display: flex;
    margin-top: 6px;
  }

  .avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-size: 9.5px;
    font-weight: 600;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-right: -5px;
    border: 2px solid var(--sidebar-bg);
  }
  .avatar-orange {
    background: linear-gradient(135deg, #f97316, #fb923c);
  }
  .avatar-blue {
    background: linear-gradient(135deg, #3b82f6, #60a5fa);
  }
  .avatar-more {
    background: #e4e4e7;
    color: var(--text-secondary);
  }

  .sidebar-footer {
    padding: 14px 18px;
    border-top: 1px solid var(--border);
  }

  .btn-delete {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: "Roboto", sans-serif;
    font-size: 15px;
    font-weight: 500;
    color: var(--red);
    padding: 8px 16px;
    border-radius: 9px;
    transition:
      background 0.15s,
      color 0.15s;
  }
  .btn-delete:hover {
    color: #dc2626;
    background: var(--chip-bg);
  }

  button:focus,
  button:focus-visible {
    outline: 4px auto -webkit-focus-ring-color;
  }
  /* Footer delete — only visible on mobile */
  .btn-delete--footer {
    display: none;
  }

  /* ══════════════════════════════════
   RIGHT PANEL
══════════════════════════════════ */
  .panel {
    flex: 1;
    background: var(--panel-bg);
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 22px 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    gap: 8px;
  }

  .panel-header-left {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 1;
  }

  /* Desktop heading — shown on >=600px */
  .panel-heading {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.1px;
  }

  /* Mobile summary button — hidden on desktop */
  .mobile-summary-btn {
    display: none;
    align-items: center;
    gap: 8px;
    background: var(--chip-bg);
    border: 1px solid var(--border);
    border-radius: 100px;
    padding: 5px 12px 5px 8px;
    cursor: pointer;
    font-family: "Roboto", sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
  }

  .mobile-summary-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .dot {
    width: 10px;
    height: 10px;
    min-width: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot-orange {
    background: var(--c-orange);
  }
  .dot-blue {
    background: var(--c-blue);
  }
  .dot-green {
    background: var(--c-green);
  }
  .dot-yellow {
    background: var(--c-yellow);
  }
  .dot-purple {
    background: var(--c-purple);
  }

  .chevron {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .chevron--up {
    transform: rotate(180deg);
  }

  /* Mobile summary panel (collapsed by default) */
  .mobile-summary-panel {
    display: none;
    overflow: hidden;
    max-height: 0;
    transition:
      max-height 0.25s ease,
      padding 0.25s ease;
    background: var(--sidebar-bg);
    border-bottom: 1px solid var(--border);
    padding: 0 16px;
  }
  .mobile-summary-panel--open {
    max-height: 200px;
    padding: 12px 16px;
    display: block;
  }

  .mobile-summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .msummary-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    padding: 5px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    transition:
      color 0.15s,
      background 0.15s;
  }
  .close-btn:hover {
    color: var(--text-primary);
    background: var(--chip-bg);
  }

  /* Panel body */
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 18px 22px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  /* Sections */
  .form-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-label {
    font-size: 13px;
    text-align: left;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--orange);
    padding-bottom: 6px;
    border-bottom: 3px solid var(--orange-light);
  }

  .form-group {
    display: flex;
    font-size: 12px;
    flex-direction: column;
    gap: 5px;
    text-align: left;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  label {
    font-size: 13px;
    letter-spacing: 0.01em;
    text-transform: uppercase;
    font-weight: 300;
    color: var(--text-secondary);
  }

  /* Inputs */
  .input-icon-wrap {
    position: relative;
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .input-icon {
    position: absolute;
    left: 10px;
    color: var(--text-muted);
    pointer-events: none;
    display: flex;
    align-items: center;
    z-index: 1;
  }

  input[type="text"],
  .date-time-input {
    width: 100%;
    padding: 9px 12px;
    border: 1.5px solid var(--input-border);
    border-radius: var(--input-radius);
    background: var(--input-bg);
    font-family: "Roboto", sans-serif;
    font-size: 13.5px;
    color: var(--text-primary);
    outline: none;
    transition:
      border-color 0.18s,
      box-shadow 0.18s;
    appearance: none;
    -webkit-appearance: none;
  }

  .input-icon-wrap .date-time-input {
    padding-left: 34px;
    cursor: pointer;
  }

  input[type="text"]:focus,
  .date-time-input:focus {
    border-color: var(--orange);
    box-shadow: 0 0 0 3px var(--orange-glow);
  }

  .date-time-input::-webkit-calendar-picker-indicator {
    opacity: 0;
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    cursor: pointer;
  }

  textarea {
    width: 100%;
    padding: 9px 12px;
    border: 1.5px solid var(--input-border);
    border-radius: var(--input-radius);
    background: var(--input-bg);
    font-family: "Roboto", sans-serif;
    font-size: 12px;
    color: var(--text-primary);
    outline: none;
    resize: none;
    line-height: 1.5;
    transition:
      border-color 0.18s,
      box-shadow 0.18s;
  }
  textarea:focus {
    border-color: var(--orange);
    box-shadow: 0 0 0 3px var(--orange-glow);
  }

  /* Participants */
  .participants-box {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    padding: 7px 10px;
    border: 1.5px solid var(--input-border);
    border-radius: var(--input-radius);
    background: var(--input-bg);
    cursor: text;
    min-height: 42px;
    transition:
      border-color 0.18s,
      box-shadow 0.18s;
    text-align: left;
    width: 100%;
  }
  .participants-box:focus-within {
    border-color: var(--orange);
    box-shadow: 0 0 0 3px var(--orange-glow);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--chip-bg);
    border: 1px solid var(--chip-border);
    border-radius: 100px;
    padding: 2px 7px 2px 3px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
  }

  .chip-remove {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    padding: 0;
    transition: color 0.12s;
  }
  .chip-remove:hover {
    color: var(--text-primary);
  }

  .participant-inline-input {
    border: none !important;
    background: transparent !important;
    outline: none !important;
    box-shadow: none !important;
    padding: 2px 4px !important;
    font-size: 13px !important;
    font-family: "Roboto", sans-serif;
    color: var(--text-primary);
    flex: 1;
    min-width: 80px;
  }

  .search-icon-wrap {
    margin-left: auto;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  /* Panel Footer */
  .panel-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 14px 22px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .footer-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-cancel {
    background: none;
    border: none;
    cursor: pointer;
    font-family: "Roboto", sans-serif;
    font-size: 15px;
    font-weight: 500;
    color: var(--text-secondary);
    padding: 8px 16px;
    border-radius: 9px;
    transition:
      background 0.15s,
      color 0.15s;
  }
  .btn-cancel:hover {
    background: var(--chip-bg);
    color: var(--text-primary);
  }

  .btn-save {
    background: var(--orange);
    color: #fff;
    border: none;
    cursor: pointer;
    font-family: "Roboto", sans-serif;
    font-size: 15px;
    font-weight: 600;
    padding: 8px 20px;
    border-radius: 9px;
    box-shadow: 0 2px 10px rgba(249, 115, 22, 0.3);
    transition:
      background 0.15s,
      box-shadow 0.15s,
      transform 0.1s;
    white-space: nowrap;
  }
  .btn-save:hover {
    background: #ea6c0a;
    box-shadow: 0 4px 16px rgba(249, 115, 22, 0.4);
  }
  .btn-save:active {
    transform: scale(0.97);
  }

  /* ══════════════════════════════════
   RESPONSIVE BREAKPOINTS
══════════════════════════════════ */

  @media (max-width: 739px) {
    .overlay {
      padding: 0;
      align-items: flex-end; /* sheet slides up from bottom */
    }

    .modal {
      flex-direction: column;
      max-width: 100%;
      width: 100%;
      max-height: 95vh;
      border-radius: 20px 20px 0 0;
      border-bottom: none;
    }

    .sidebar {
      display: none;
    }
    .mobile-summary-btn {
      display: flex;
    }
    .panel-heading {
      display: none;
    }
    .mobile-summary-panel {
      display: block;
    }
    .btn-delete--footer {
      display: inline-flex;
    }

    .panel-footer {
      justify-content: space-between;
      padding: 12px 16px;
    }

    .panel-body {
      padding: 16px;
      gap: 18px;
    }

    .panel-header {
      padding: 14px 16px 12px;
    }
  }

  @media (max-width: 480px) {
    .form-row {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .mobile-summary-grid {
      grid-template-columns: 1fr;
    }

    .panel-body {
      padding: 14px;
      gap: 16px;
    }

    .panel-header {
      padding: 12px 14px 10px;
    }

    .panel-footer {
      padding: 10px 14px;
      flex-wrap: wrap;
      gap: 8px;
    }

    .footer-right {
      flex: 1;
      justify-content: flex-end;
    }

    .btn-save {
      flex: 1;
      justify-content: center;
    }

    input[type="text"],
    .date-time-input,
    textarea {
      font-size: 16px; /* prevents iOS auto-zoom on focus */
    }
  }
`;
