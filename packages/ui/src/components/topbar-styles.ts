import { css } from "lit";

export const topbarStyles = css`
  /* ── Design tokens (inherited from host) ───────────────────────────────── */
  :host {
    --white: #ffffff;
    --bg: #f4f4f5;
    --border: #e4e4e7;
    --text-1: #18181b;
    --text-2: #71717a;
    --text-3: #a1a1aa;
    --orange: var(--janus-primary-color, #f97316);
    --orange-lt: var(--janus-primary-bg, #fff7ed);
    --topbar-h: 56px;

    display: block;
    font-family: "DM Sans", sans-serif;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  /* ══════════════════════════════════════════════════════════════════════════════
     TOP BAR
  ══════════════════════════════════════════════════════════════════════════════ */
  .tl-topbar {
    position: relative;
    height: var(--topbar-h);
    min-height: var(--topbar-h);
    flex-shrink: 0;
    background: var(--white);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 20px;
    z-index: 50;
  }

  /* Centre nav */
  .tl-nav {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .tl-nav__center {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
  }

  .tl-nav__arrow {
    width: 30px;
    height: 30px;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-2);
    flex-shrink: 0;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .tl-nav__arrow svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    stroke: currentColor;
  }

  .tl-nav__arrow:hover {
    background: var(--bg);
    color: var(--text-1);
  }

  .tl-nav__today {
    padding: 5px 12px;
    border: 1.5px solid var(--border);
    border-radius: 7px;
    background: var(--white);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-1);
    cursor: pointer;
    flex-shrink: 0;
    transition: border-color 0.15s;
  }

  .tl-nav__today:hover {
    border-color: var(--orange);
  }

  .tl-nav__date-btn {
    all: unset;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    border-radius: 6px;
    padding: 3px 6px;
    margin-left: 2px;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
    font-family: inherit;
    min-width: 0;
  }

  .tl-nav__date-btn:hover {
    background-color: var(--bg, #f4f4f5);
  }

  .tl-nav__date-btn:hover .tl-nav__date {
    color: var(--orange);
  }

  .tl-nav__date-btn:focus-visible {
    outline: 2px solid var(--orange);
    outline-offset: 1px;
  }

  .tl-nav__date {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 0 1 auto;
    max-width: fit-content;
    min-width: 0;
    transition: color 0.15s ease;
  }

  .tl-nav__date--short {
    display: none;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.2px;
  }

  /* Right actions */
  .tl-topbar__right {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .tl-gcal-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 12px;
    border: 1.5px solid var(--border);
    border-radius: 7px;
    background: var(--white);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-1);
    cursor: pointer;
    white-space: nowrap;
    transition:
      border-color 0.15s,
      background 0.15s,
      color 0.15s;
  }

  .tl-gcal-btn svg {
    flex-shrink: 0;
  }

  .tl-gcal-btn:hover {
    border-color: var(--orange);
  }

  .tl-gcal-btn--connected {
    border-color: var(--orange);
    background: var(--orange-lt);
    color: var(--orange);
  }

  .tl-gcal-btn--connected:hover {
    filter: brightness(0.96);
  }

  .tl-view-toggle {
    display: flex;
    background: var(--bg);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
  }

  .tl-view-toggle__btn {
    padding: 5px 14px;
    border: none;
    border-radius: 6px;
    background: transparent;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-2);
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }

  .tl-view-toggle__btn.active {
    background: var(--white);
    color: var(--text-1);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  .tl-icon-btn {
    width: 34px;
    height: 34px;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-2);
    transition:
      background 0.15s,
      color 0.15s;
  }

  .tl-icon-btn svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .tl-icon-btn:hover {
    background: var(--bg);
    color: var(--text-1);
  }

  .tl-icon-btn--bell {
    position: relative;
  }

  .tl-bell-dot {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 7px;
    height: 7px;
    background: var(--orange);
    border-radius: 50%;
    border: 1.5px solid var(--white);
  }

  /* Warning count badge */
  .tl-warning-badge {
    height: 28px;
    padding: 0 10px;
    border-radius: 6px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #ef4444;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: inherit;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    margin-right: 8px;
    box-shadow: 0 1px 2px rgba(239, 68, 68, 0.05);
  }

  .tl-warning-badge:hover {
    background: rgba(239, 68, 68, 0.14);
    border-color: rgba(239, 68, 68, 0.35);
    box-shadow: 0 2px 6px rgba(239, 68, 68, 0.12);
    transform: translateY(-0.5px);
  }

  .tl-warning-badge:active {
    transform: translateY(0);
  }

  .tl-warning-badge span:first-child {
    font-size: 13px;
    animation: tlPulse 2s infinite ease-in-out;
  }

  @keyframes tlPulse {
    0% {
      opacity: 0.7;
      transform: scale(0.95);
    }
    50% {
      opacity: 1;
      transform: scale(1.05);
    }
    100% {
      opacity: 0.7;
      transform: scale(0.95);
    }
  }

  /* Benchmark button */
  .tl-benchmark-btn {
    height: 30px;
    padding: 0 12px;
    border-radius: 7px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    color: #ffffff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: inherit;
    box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
    transition: all 0.18s ease;
    white-space: nowrap;
    margin-right: 4px;
  }

  .tl-benchmark-btn:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
    box-shadow: 0 3px 10px rgba(99, 102, 241, 0.35);
  }

  .tl-benchmark-btn:active {
    transform: translateY(0);
  }

  .tl-benchmark-btn--active {
    background: linear-gradient(135deg, #10b981, #059669);
    box-shadow: 0 2px 6px rgba(16, 185, 129, 0.25);
  }

  .tl-benchmark-btn--active:hover {
    box-shadow: 0 3px 10px rgba(16, 185, 129, 0.35);
  }

  /* Zoom badge */
  .tl-zoom-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 3px 10px;
    border-radius: 6px;
    background: var(--orange-lt);
    color: var(--orange);
    font-size: 12px;
    font-weight: 600;
    font-family: "DM Mono", monospace;
    letter-spacing: 0.3px;
    white-space: nowrap;
    user-select: none;
    transition: opacity 0.2s;
  }

  .tl-draw-toggle {
    position: relative;
  }

  .tl-draw-toggle--active {
    background: var(--orange);
    color: #fff;
  }

  .tl-draw-toggle--active:hover {
    filter: brightness(0.95);
    color: #fff;
  }

  /* Custom tooltip using data-tooltip attribute (title doesn't work in Shadow DOM) */
  .tl-draw-toggle::before {
    content: attr(data-tooltip);
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    transform: translateY(-4px);
    background: #18181b;
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.5;
    white-space: normal;
    max-width: 220px;
    width: max-content;
    padding: 8px 12px;
    border-radius: 8px;
    pointer-events: none;
    opacity: 0;
    transition:
      opacity 0.18s ease,
      transform 0.18s ease;
    z-index: 9999;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    font-family: "DM Sans", sans-serif;
    text-align: left;
  }

  /* Tooltip caret — points UP, aligned to right side */
  .tl-draw-toggle::after {
    content: "";
    position: absolute;
    top: calc(100% + 2px);
    right: 10px;
    transform: translateY(-4px);
    border: 5px solid transparent;
    border-bottom-color: #18181b;
    pointer-events: none;
    opacity: 0;
    transition:
      opacity 0.18s ease,
      transform 0.18s ease;
    z-index: 9999;
  }

  .tl-draw-toggle:hover::before,
  .tl-draw-toggle:hover::after {
    opacity: 1;
    transform: translateY(0);
  }

  /* ══════════════════════════════════════════════════════════════════════════════
     RESPONSIVE
  ══════════════════════════════════════════════════════════════════════════════ */
  @media (max-width: 900px) {
    .tl-topbar {
      padding: 0 12px;
      gap: 8px;
    }
    .tl-nav__date {
      font-size: 14px;
    }
    .tl-benchmark-btn {
      display: none;
    }
  }

  @media (max-width: 700px) {
    :host {
      --topbar-h: 60px;
    }

    .tl-topbar {
      height: auto;
      padding: 10px 14px;
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }
    .tl-topbar__right {
      width: 100%;
      margin-left: 0;
      justify-content: space-between;
    }
    .tl-view-toggle {
      margin-right: auto;
    }
    .tl-nav {
      flex: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .tl-nav__today {
      display: none;
    }

    .tl-nav__arrow {
      width: 36px;
      height: 36px;
      color: #18181b;
      background: transparent;
      border-radius: 8px;
    }
    .tl-nav__arrow:active {
      background: var(--bg);
    }
    .tl-nav__date {
      display: none;
    }
    .tl-nav__date--short {
      display: flex;
      flex-direction: column;
      align-items: center; /* Center-align text */
      margin: 0;
      line-height: 1.2;
    }
    .tl-nav-day-name {
      font-size: 10px;
      text-transform: uppercase;
      color: var(--text-2);
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .tl-nav-date-text {
      font-size: 15px;
      color: #1d4ed8; /* Match mockup blue text */
      font-weight: 700;
    }
  }
`;
