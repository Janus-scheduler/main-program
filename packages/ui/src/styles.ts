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
    --c-red: #ef4444;
    --c-pink: #ec4899;
    --c-indigo: #6366f1;
    --c-cyan: #06b6d4;
    --c-teal: #14b8a6;

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
  .sidebar-accent.color-red {
    background: var(--c-red);
  }
  .sidebar-accent.color-pink {
    background: var(--c-pink);
  }
  .sidebar-accent.color-indigo {
    background: var(--c-indigo);
  }
  .sidebar-accent.color-cyan {
    background: var(--c-cyan);
  }
  .sidebar-accent.color-teal {
    background: var(--c-teal);
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
  .swatch-red {
    background: var(--c-red);
    color: var(--c-red);
  }
  .swatch-pink {
    background: var(--c-pink);
    color: var(--c-pink);
  }
  .swatch-indigo {
    background: var(--c-indigo);
    color: var(--c-indigo);
  }
  .swatch-cyan {
    background: var(--c-cyan);
    color: var(--c-cyan);
  }
  .swatch-teal {
    background: var(--c-teal);
    color: var(--c-teal);
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
  .dot-red {
    background: var(--c-red);
  }
  .dot-pink {
    background: var(--c-pink);
  }
  .dot-indigo {
    background: var(--c-indigo);
  }
  .dot-cyan {
    background: var(--c-cyan);
  }
  .dot-teal {
    background: var(--c-teal);
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

  /* ── Time picker trigger button ─────────────────────────────────────────── */
  .time-picker-wrap {
    position: relative;
  }

  .time-trigger {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 9px 12px;
    background: var(--input-bg);
    border: 1.5px solid var(--input-border);
    border-radius: var(--input-radius);
    cursor: pointer;
    font-family: "Roboto", sans-serif;
    font-size: 13.5px;
    color: var(--text-primary);
    text-align: left;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .time-trigger:hover {
    border-color: #d1d1d6;
  }

  .time-trigger--open {
    border-color: var(--orange);
    box-shadow: 0 0 0 3px var(--orange-glow);
  }

  .time-trigger--overnight {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.12);
    color: #6d28d9;
  }

  .time-trigger-icon {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .time-trigger-value {
    flex: 1;
    font-weight: 500;
  }

  .time-trigger-chevron {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    transition: transform 0.2s;
  }

  .time-trigger--open .time-trigger-chevron {
    transform: rotate(180deg);
  }

  /* ── Dropdown panel ──────────────────────────────────────────────────────── */

  .time-picker-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 200;
    width: 240px;
    background: #ffffff;
    border: 1.5px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
    overflow: hidden;
    animation: picker-in 0.15s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes picker-in {
    from {
      opacity: 0;
      transform: translateY(-6px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .time-picker-header {
    padding: 10px 14px 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
  }

  .time-picker-body {
    display: flex;
    align-items: flex-start;
    gap: 0;
  }

  .time-col {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .time-col-label {
    padding: 6px 0 4px;
    text-align: center;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .time-scroll {
    max-height: 168px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #e4e4e7 transparent;
    display: flex;
    flex-direction: column;
  }

  .time-scroll::-webkit-scrollbar {
    width: 4px;
  }
  .time-scroll::-webkit-scrollbar-thumb {
    background: #e4e4e7;
    border-radius: 4px;
  }

  .time-cell {
    padding: 7px 0;
    text-align: center;
    font-size: 13px;
    font-family: "Roboto", sans-serif;
    font-weight: 400;
    color: var(--text-primary);
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 6px;
    margin: 1px 6px;
    transition: background 0.1s;
    color 0.1s;
  }

  .time-cell:hover {
    background: var(--orange-light);
    color: var(--orange);
  }

  .time-cell--active {
    background: var(--orange);
    color: #ffffff;
    font-weight: 600;
  }

  .time-cell--active:hover {
    background: var(--orange);
    color: #ffffff;
  }

  .time-divider {
    padding-top: 38px;
    font-size: 16px;
    font-weight: 700;
    color: var(--text-muted);
    user-select: none;
  }

  .time-picker-preview {
    padding: 8px 14px;
    border-top: 1px solid var(--border);
    text-align: center;
    font-size: 15px;
    font-weight: 600;
    color: var(--orange);
    letter-spacing: 0.02em;
    background: var(--orange-light);
  }

  /* ── Overnight indicators ────────────────────────────────────────────────── */

  .time-value-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .overnight-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px;
    background: rgba(139, 92, 246, 0.1);
    color: #6d28d9;
    border-radius: 20px;
    font-size: 10.5px;
    font-weight: 600;
    white-space: nowrap;
  }

  .next-day-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-left: 6px;
    padding: 1px 6px;
    background: rgba(139, 92, 246, 0.1);
    color: #6d28d9;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 600;
    vertical-align: middle;
  }

  .overnight-notice {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 10px;
    padding: 9px 13px;
    background: rgba(139, 92, 246, 0.07);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 9px;
    font-size: 12.5px;
    color: #5b21b6;
    line-height: 1.4;
  }

  .overnight-notice svg {
    flex-shrink: 0;
    color: #8b5cf6;
  }
.cal-dropdown,
.time-picker-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 200;
  background: #ffffff;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
  overflow: hidden;
  animation: picker-in 0.15s cubic-bezier(0.22, 1, 0.36, 1);
}
 
@keyframes picker-in {
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
 
/* ── Date & Time two-column layout ───────────────────────────────────────── */
 
.dt-row-label {
  font-size: 12px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin: 10px 0 5px;
  color: var(--text-secondary);
}
 
.dt-row-label--end {
  margin-top: 10px;
}
 
.dt-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
 
.dt-cell {
  position: relative; /* anchor for dropdown */
}
 
/* ── Trigger button (shared by date and time) ────────────────────────────── */
 
.time-trigger {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 9px 11px;
  background: var(--input-bg);
  border: 1.5px solid var(--input-border);
  border-radius: var(--input-radius);
  cursor: pointer;
  font-family: "Roboto", sans-serif;
  font-size: 13px;
  color: var(--text-primary);
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s;
  white-space: nowrap;
  overflow: hidden;
}
 
.time-trigger:hover {
  border-color: #d1d1d6;
}
 
.time-trigger--open {
  border-color: var(--orange);
  box-shadow: 0 0 0 3px var(--orange-glow);
}
 
.time-trigger--invalid {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
}
 
.time-trigger-icon {
  color: var(--text-muted);
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
 
.time-trigger-value {
  flex: 1;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
}
 
.time-trigger-chevron {
  color: var(--text-muted);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition: transform 0.2s;
}
 
.time-trigger--open .time-trigger-chevron {
  transform: rotate(180deg);
}
 
/* ── Validation notice ───────────────────────────────────────────────────── */
 
.dt-invalid-notice {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 10px;
  padding: 9px 13px;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 9px;
  font-size: 12.5px;
  color: #b91c1c;
}
 
/* ── Calendar dropdown ───────────────────────────────────────────────────── */
 
.cal-dropdown {
  width: 256px;
}
 
.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--border);
}
 
.cal-month-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
 
.cal-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 7px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: background 0.12s, color 0.12s;
}
 
.cal-nav-btn:hover {
  background: var(--orange-light);
  color: var(--orange);
}
 
.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 6px 8px 2px;
}
 
.cal-wd {
  text-align: center;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  padding: 2px 0;
}
 
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  padding: 2px 8px 8px;
}
 
.cal-empty {
  display: block;
}
 
.cal-day {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  border: none;
  background: transparent;
  border-radius: 7px;
  font-family: "Roboto", sans-serif;
  font-size: 12.5px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
 
.cal-day:hover {
  background: var(--orange-light);
  color: var(--orange);
}
 
.cal-day--today {
  font-weight: 700;
  color: var(--orange);
}
 
.cal-day--selected {
  background: var(--orange) !important;
  color: #ffffff !important;
  font-weight: 600;
}
 
.cal-preview {
  padding: 7px 12px;
  border-top: 1px solid var(--border);
  text-align: center;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--orange);
  background: var(--orange-light);
}
 
/* ── Time picker dropdown ────────────────────────────────────────────────── */
 
.time-picker-dropdown {
  width: 240px;
}
 
.time-picker-header {
  padding: 10px 14px 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}
 
.time-picker-body {
  display: flex;
  align-items: flex-start;
}
 
.time-col {
  flex: 1;
  display: flex;
  flex-direction: column;
}
 
.time-col-label {
  padding: 6px 0 4px;
  text-align: center;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-muted);
}
 
.time-scroll {
  max-height: 168px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #e4e4e7 transparent;
  display: flex;
  flex-direction: column;
}
 
.time-scroll::-webkit-scrollbar { width: 4px; }
.time-scroll::-webkit-scrollbar-thumb { background: #e4e4e7; border-radius: 4px; }
 
.time-cell {
  padding: 7px 0;
  text-align: center;
  font-size: 13px;
  font-family: "Roboto", sans-serif;
  font-weight: 400;
  color: var(--text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 6px;
  margin: 1px 6px;
  transition: background 0.1s, color 0.1s;
}
 
.time-cell:hover {
  background: var(--orange-light);
  color: var(--orange);
}
 
.time-cell--active {
  background: var(--orange);
  color: #ffffff;
  font-weight: 600;
}
 
.time-cell--active:hover {
  background: var(--orange);
  color: #ffffff;
}
 
.time-divider {
  padding-top: 38px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-muted);
  user-select: none;
}
 
.time-picker-preview {
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--orange);
  background: var(--orange-light);
}
 
/* ── Save button disabled state ──────────────────────────────────────────── */
 
.btn-save:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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

  /* Error Alert */
  .error-alert {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 4px;
    animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }

  @keyframes shake {
    10%,
    90% {
      transform: translate3d(-1px, 0, 0);
    }
    20%,
    80% {
      transform: translate3d(2px, 0, 0);
    }
    30%,
    50%,
    70% {
      transform: translate3d(-3px, 0, 0);
    }
    40%,
    60% {
      transform: translate3d(3px, 0, 0);
    }
  }

  .error-icon {
    width: 20px;
    height: 20px;
    background: var(--red);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: bold;
    flex-shrink: 0;
  }

  .error-message {
    font-size: 13px;
    color: #991b1b;
    font-weight: 500;
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
    position: relative;
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

  /* Suggestions Autocomplete Dropdown */
  .suggestions-dropdown {
    position: absolute;
    top: calc(100% - 2px);
    left: 0;
    right: 0;
    background: var(--panel-bg, #ffffff);
    border: 1.5px solid var(--input-border, #e4e4e7);
    border-radius: var(--input-radius, 10px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    z-index: 100;
    max-height: 200px;
    overflow-y: auto;
    margin-top: 4px;
    padding: 4px 0;
  }
  .suggestions-dropdown ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .suggestion-item.active,
  .suggestion-item:hover {
    background: var(--chip-bg, #f4f4f5);
  }
  .suggestion-info {
    display: flex;
    flex-direction: column;
    text-align: left;
  }
  .suggestion-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
  }
  .suggestion-id {
    font-size: 11px;
    color: var(--text-secondary);
  }
  .suggestions-empty {
    padding: 12px;
    text-align: center;
    font-size: 12px;
    color: var(--text-secondary);
    font-style: italic;
  }

  /* Shake Animation */
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-4px); }
    40%, 80% { transform: translateX(4px); }
  }
  .participants-box.shake {
    animation: shake 0.4s ease-in-out;
    border-color: var(--red) !important;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15) !important;
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

  /* ── Timezone row ─────────────────────────────────────────────────────────── */

  .dt-tz-row {
    margin-top: 10px;
  }

  .dt-cell--tz {
    position: relative;
  }

  /* ── Timezone picker dropdown ─────────────────────────────────────────────── */

  .tz-picker-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 220;
    width: 300px;
    background: #ffffff;
    border: 1.5px solid var(--border);
    border-radius: 14px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.14),
      0 2px 8px rgba(0, 0, 0, 0.06);
    overflow: hidden;
    animation: picker-in 0.15s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .tz-search-wrap {
    padding: 10px 12px 8px;
    border-bottom: 1px solid var(--border);
  }

  .tz-search-input {
    width: 100%;
    padding: 7px 10px;
    background: var(--input-bg);
    border: 1.5px solid var(--input-border);
    border-radius: 8px;
    font-family: "Roboto", sans-serif;
    font-size: 13px;
    color: var(--text-primary);
    outline: none;
    transition: border-color 0.15s;
  }

  .tz-search-input:focus {
    border-color: var(--orange);
    box-shadow: 0 0 0 3px var(--orange-glow);
  }

  .tz-list {
    list-style: none;
    max-height: 220px;
    overflow-y: auto;
    padding: 6px 0;
    scrollbar-width: thin;
    scrollbar-color: #e4e4e7 transparent;
  }

  .tz-list::-webkit-scrollbar {
    width: 4px;
  }
  .tz-list::-webkit-scrollbar-thumb {
    background: #e4e4e7;
    border-radius: 4px;
  }

  .tz-item {
    padding: 8px 14px;
    font-size: 12.5px;
    font-family: "Roboto", sans-serif;
    color: var(--text-primary);
    cursor: pointer;
    transition: background 0.1s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tz-item:hover {
    background: var(--orange-light);
    color: var(--orange);
  }

  .tz-item--active {
    background: var(--orange);
    color: #ffffff;
    font-weight: 600;
  }

  .tz-item--active:hover {
    background: var(--orange);
    color: #ffffff;
  }

  .tz-item--empty {
    color: var(--text-muted);
    font-style: italic;
    cursor: default;
  }

  /* ══════════════════════════════════
   VIEW MODE THEMING & LAYOUT
   ══════════════════════════════════ */
  .modal--view {
    max-width: 500px;
  }

  .view-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    background: var(--panel-bg);
  }

  .view-header {
    padding: 20px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border);
    transition: background 0.2s, border-color 0.2s;
  }

  .view-header.color-orange {
    background: linear-gradient(135deg, #fff7ed, #ffedd5);
    border-bottom-color: #fed7aa;
  }
  .view-header.color-blue {
    background: linear-gradient(135deg, #eff6ff, #dbeafe);
    border-bottom-color: #bfdbfe;
  }
  .view-header.color-green {
    background: linear-gradient(135deg, #f0fdf4, #dcfce7);
    border-bottom-color: #bbf7d0;
  }
  .view-header.color-yellow {
    background: linear-gradient(135deg, #fefce8, #fef9c3);
    border-bottom-color: #fef08a;
  }
  .view-header.color-purple {
    background: linear-gradient(135deg, #faf5ff, #f3e8ff);
    border-bottom-color: #e9d5ff;
  }
  .view-header.color-red {
    background: linear-gradient(135deg, #fef2f2, #fee2e2);
    border-bottom-color: #fca5a5;
  }
  .view-header.color-pink {
    background: linear-gradient(135deg, #fdf2f8, #fce7f3);
    border-bottom-color: #fbcfe8;
  }
  .view-header.color-indigo {
    background: linear-gradient(135deg, #eef2ff, #e0e7ff);
    border-bottom-color: #c7d2fe;
  }
  .view-header.color-cyan {
    background: linear-gradient(135deg, #ecfeff, #cffafe);
    border-bottom-color: #a5f3fc;
  }
  .view-header.color-teal {
    background: linear-gradient(135deg, #f0fdfa, #ccfbf1);
    border-bottom-color: #99f6e4;
  }

  .view-header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .view-header-icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: #ffffff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.05);
  }
  .view-header.color-orange .view-header-icon-box { color: var(--c-orange); }
  .view-header.color-blue .view-header-icon-box { color: var(--c-blue); }
  .view-header.color-green .view-header-icon-box { color: var(--c-green); }
  .view-header.color-yellow .view-header-icon-box { color: var(--c-yellow); }
  .view-header.color-purple .view-header-icon-box { color: var(--c-purple); }
  .view-header.color-red .view-header-icon-box { color: var(--c-red); }
  .view-header.color-pink .view-header-icon-box { color: var(--c-pink); }
  .view-header.color-indigo .view-header-icon-box { color: var(--c-indigo); }
  .view-header.color-cyan .view-header-icon-box { color: var(--c-cyan); }
  .view-header.color-teal .view-header-icon-box { color: var(--c-teal); }

  .view-header-titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .view-header-tag {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-secondary);
    opacity: 0.8;
  }

  .view-header-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.3;
  }

  .view-body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 22px;
    overflow-y: auto;
    max-height: 60vh;
  }

  .view-datetime-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: #fafafa;
    border-radius: 12px;
    border: 1px solid var(--border);
  }

  .view-datetime-icon {
    display: flex;
    align-items: center;
    color: var(--text-secondary);
  }

  .view-datetime-text {
    font-size: 14.5px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .view-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .view-section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-secondary);
  }

  .view-resource-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  }

  .view-lead-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .view-lead-details {
    display: flex;
    flex-direction: column;
  }

  .view-lead-name {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .view-lead-role {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .view-avatar-stack {
    display: flex;
    align-items: center;
  }

  .view-desc-card {
    padding: 16px;
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 12px;
    min-height: 80px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  }

  .view-desc-text {
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-primary);
    white-space: pre-wrap;
  }

  .view-desc-text--empty {
    color: var(--text-muted);
    font-style: italic;
  }

  .view-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .view-meta-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .view-meta-val-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #fafafa;
    border: 1px solid var(--border);
    border-radius: 10px;
  }

  .view-meta-icon {
    display: flex;
    align-items: center;
    color: var(--text-secondary);
  }

  .view-meta-val {
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .view-color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
  }

  .capitalize {
    text-transform: capitalize;
  }

  .view-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fafafa;
    border-bottom-left-radius: 18px;
    border-bottom-right-radius: 18px;
  }

  .view-footer-right {
    display: flex;
    gap: 12px;
  }

  .btn-edit-event {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 9px 18px;
    border-radius: 10px;
    border: none;
    font-family: "Roboto", sans-serif;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    background: var(--orange);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    transition: transform 0.15s, filter 0.15s;
  }
  .btn-edit-event:hover {
    transform: translateY(-1px);
    filter: brightness(0.95);
  }
  .btn-edit-event:active {
    transform: translateY(0);
  }

  .btn-edit-event.color-orange { background-color: var(--c-orange); color: white; }
  .btn-edit-event.color-blue { background-color: var(--c-blue); color: white; }
  .btn-edit-event.color-green { background-color: var(--c-green); color: white; }
  .btn-edit-event.color-yellow { background-color: var(--c-yellow); color: var(--text-primary); }
  .btn-edit-event.color-purple { background-color: var(--c-purple); color: white; }
  .btn-edit-event.color-red { background-color: var(--c-red); color: white; }
  .btn-edit-event.color-pink { background-color: var(--c-pink); color: white; }
  .btn-edit-event.color-indigo { background-color: var(--c-indigo); color: white; }
  .btn-edit-event.color-cyan { background-color: var(--c-cyan); color: white; }
  .btn-edit-event.color-teal { background-color: var(--c-teal); color: white; }
`;
