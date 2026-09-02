import { css } from "lit";

export const monthGridStyles = css`
  /* ── Design tokens ── */
  :host {
    --white: #ffffff;
    --bg: #f4f4f5;
    --border: #e4e4e7;
    --text-1: #18181b;
    --text-2: #71717a;
    --text-3: #a1a1aa;
    --orange: var(--janus-primary-color, #f97316);
    --orange-lt: var(--janus-primary-bg, #fff7ed);

    /* Event colours — same vars as timeline */
    --c-primary-bg: var(
      --janus-primary-bg,
      color-mix(in srgb, var(--c-primary) 12%, #ffffff)
    );
    --c-primary-bd: var(--janus-primary-border, var(--c-primary));
    --c-primary-tx: var(--janus-primary-text, var(--c-primary));
    --c-orange-bg: #fff7ed;
    --c-orange-bd: #f97316;
    --c-orange-tx: #c2410c;
    --c-blue-bg: #f0f9ff;
    --c-blue-bd: #0ea5e9;
    --c-blue-tx: #0369a1;
    --c-yellow-bg: #fefce8;
    --c-yellow-bd: #f59e0b;
    --c-yellow-tx: #b45309;
    --c-purple-bg: #faf5ff;
    --c-purple-bd: #8b5cf6;
    --c-purple-tx: #6d28d9;
    --c-green-bg: #f0fdf4;
    --c-green-bd: #10b981;
    --c-green-tx: #047857;
    --c-red-bg: #fef2f2;
    --c-red-bd: #ef4444;
    --c-red-tx: #991b1b;
    --c-pink-bg: #fdf2f8;
    --c-pink-bd: #ec4899;
    --c-pink-tx: #9d174d;
    --c-indigo-bg: #eef2ff;
    --c-indigo-bd: #6366f1;
    --c-indigo-tx: #3730a3;
    --c-cyan-bg: #ecfeff;
    --c-cyan-bd: #06b6d4;
    --c-cyan-tx: #155e75;
    --c-teal-bg: #f0fdfa;
    --c-teal-bd: #14b8a6;
    --c-teal-tx: #115e59;

    /* Layout */
    --topbar-h: 56px;
    --aicard-area-h: 60px;
    --day-hdr-h: 40px; /* weekday label row height */
    --today-bg: var(
      --janus-primary-bg,
      #fff7ed
    ); /* highlight for today's cell */

    display: flex;
    flex-direction: column;
    flex: 1;
    height: 100%;
    overflow: hidden;
    background: var(--bg);
    font-family: "DM Sans", sans-serif;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  /* ── Shell ──────────────────────────────────────────────────────────────── */
  .mg-shell {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
  }

  /* ── Main Panel ──────────────────────────────────────────────────────────────── */

  .mg-panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--white);
  }

  /* ── Weekday header row (MON TUE … SUN) ── */
  .mg-day-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    height: var(--day-hdr-h);
    min-height: var(--day-hdr-h);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--white);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .mg-day-header__cell {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    letter-spacing: 0.6px;
    border-right: 1px solid var(--border);
  }

  .mg-day-header__cell:last-child {
    border-right: none;
  }

  /* ── Calendar grid ── */
  .mg-grid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-rows: repeat(5, 1fr);
    overflow-y: auto;
  }

  .mg-week-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-bottom: 1px solid var(--border);
    min-height: 0;
  }

  .mg-week-row:last-child {
    border-bottom: none;
  }

  /* ── Day cell ── */
  .mg-day-cell {
    border-right: 1px solid var(--border);
    padding: 6px 6px 4px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    overflow: hidden;
    cursor: pointer;
    transition: background 0.12s;
    min-height: 0;
  }

  .mg-day-cell:last-child {
    border-right: none;
  }

  .mg-day-cell:hover {
    background: #fafafa;
  }

  /* Greyed out — prev / next month days */
  .mg-day-cell--other {
    background: var(--bg);
  }

  .mg-day-cell--other .mg-day-cell__num {
    color: var(--text-3);
  }

  .mg-day-cell__dots {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
  }

  /* Today highlight */
  .mg-day-cell--today {
    background: var(--today-bg);
  }

  /* ── Day number & Header button (navLinks) ── */
  .mg-day-cell__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    height: 24px;
  }

  .mg-day-cell__num-btn {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    border-radius: 12px;
    padding: 1px 4px;
    margin: -1px -4px;
    transition:
      background-color 0.15s ease,
      color 0.15s ease,
      transform 0.1s ease;
    font-family: inherit;
  }

  .mg-day-cell__num-btn:hover {
    background-color: var(--c-primary-bg, rgba(0, 0, 0, 0.05));
  }

  .mg-day-cell__num-btn:hover .mg-day-cell__num {
    color: var(--orange);
    font-weight: 600;
  }

  .mg-day-cell__num-btn:active {
    transform: scale(0.96);
  }

  .mg-day-cell__num-btn:focus-visible {
    outline: 2px solid var(--orange);
    outline-offset: 1px;
  }

  .mg-day-cell__num-btn--today:hover {
    background-color: transparent;
  }

  .mg-day-cell__num-btn--today:hover .mg-today-badge {
    filter: brightness(1.1);
    transform: scale(1.05);
  }

  .mg-day-cell__num {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-1);
    line-height: 1;
    transition: color 0.15s ease;
  }

  /* Selected day — orange outline */
  .mg-day-cell--selected {
    outline: 2px solid var(--orange);
    outline-offset: -2px;
  }

  /* Orange circle badge for today */
  .mg-today-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--orange);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    flex-shrink: 0;
    transition:
      transform 0.12s ease,
      filter 0.12s ease;
  }

  /* "TODAY" label shown beside the badge */
  .mg-today-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--orange);
    letter-spacing: 0.4px;
  }

  /* ── Event chips ── */
  .mg-event {
    display: flex;
    align-items: center;
    gap: 5px;
    border-radius: 5px;
    border: none;
    border-left: 3px solid transparent;
    padding: 4px 6px;
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    width: 100%;
    flex-shrink: 0;
    transition:
      filter 0.12s,
      transform 0.1s;
  }

  .mg-event:hover,
  .mg-event--hovered {
    filter: brightness(0.95);
    transform: scaleX(0.99);
  }

  .mg-event--clip-left {
    border-top-left-radius: 0 !important;
    border-bottom-left-radius: 0 !important;
    border-left: none !important;
    margin-left: 0 !important;
    width: calc(100% - 4px) !important;
  }
  .mg-event--clip-right {
    border-top-right-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
    margin-right: 0 !important;
    width: calc(100% - 4px) !important;
  }
  .mg-event--clip-left.mg-event--clip-right {
    width: 100% !important;
  }

  .mg-event:active {
    transform: scale(0.97);
  }

  .mg-event__title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  /* "+X more" button */
  .mg-more-btn {
    display: flex;
    align-items: center;
    background: transparent;
    border: none;
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-2);
    cursor: pointer;
    padding: 2px 6px;
    margin: 1px 4px 4px 4px;
    border-radius: 4px;
    transition:
      background 0.1s,
      color 0.1s;
    width: max-content;
    max-width: calc(100% - 8px);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    z-index: 2;
    align-self: flex-start;
  }

  .mg-more-btn__text::after {
    content: " more";
  }

  .mg-more-btn:hover {
    background: var(--bg-hover, #f0f0f0);
    color: var(--text-1);
  }

  /* Colour variants — identical mapping as timeline */
  .mg-event--primary {
    background: var(--c-primary-bg);
    border-color: var(--c-primary-bd);
    color: var(--c-primary-tx);
  }

  .mg-event--orange {
    background: var(--c-orange-bg);
    border-color: var(--c-orange-bd);
    color: var(--c-orange-tx);
  }

  .mg-event--blue {
    background: var(--c-blue-bg);
    border-color: var(--c-blue-bd);
    color: var(--c-blue-tx);
  }

  .mg-event--yellow {
    background: var(--c-yellow-bg);
    border-color: var(--c-yellow-bd);
    color: var(--c-yellow-tx);
  }

  .mg-event--purple {
    background: var(--c-purple-bg);
    border-color: var(--c-purple-bd);
    color: var(--c-purple-tx);
  }

  .mg-event--green {
    background: var(--c-green-bg);
    border-color: var(--c-green-bd);
    color: var(--c-green-tx);
  }

  .mg-event--red {
    background: var(--c-red-bg);
    border-color: var(--c-red-bd);
    color: var(--c-red-tx);
  }

  .mg-event--pink {
    background: var(--c-pink-bg);
    border-color: var(--c-pink-bd);
    color: var(--c-pink-tx);
  }

  .mg-event--indigo {
    background: var(--c-indigo-bg);
    border-color: var(--c-indigo-bd);
    color: var(--c-indigo-tx);
  }

  .mg-event--cyan {
    background: var(--c-cyan-bg);
    border-color: var(--c-cyan-bd);
    color: var(--c-cyan-tx);
  }

  .mg-event--teal {
    background: var(--c-teal-bg);
    border-color: var(--c-teal-bd);
    color: var(--c-teal-tx);
  }

  /* "+N more" overflow label */
  .mg-event--more {
    background: none;
    border: none;
    color: var(--text-3);
    font-size: 11px;
    font-weight: 500;
    padding: 1px 4px;
  }

  /* ── Fab ──────────────────────────────────────────────────────────────── */

  .mg-fab {
    position: absolute;
    bottom: 16px;
    right: 28px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--orange);
    color: #fff;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 18px var(--janus-primary-glow, rgba(249, 115, 22, 0.45));
    transition:
      background 0.18s,
      transform 0.14s,
      filter 0.18s,
      box-shadow 0.18s;
    z-index: 200;
  }

  .mg-fab:hover {
    filter: brightness(0.95);
    transform: scale(1.07);
  }

  .mg-fab:active {
    transform: scale(0.96);
  }

  /* ── Scrollbar ──────────────────────────────────────────────────────────────── */
  .mg-grid::-webkit-scrollbar {
    width: 6px;
  }

  .mg-grid::-webkit-scrollbar-track {
    background: transparent;
  }

  .mg-grid::-webkit-scrollbar-thumb {
    background: #d4d4d8;
    border-radius: 99px;
  }

  .mg-grid::-webkit-scrollbar-thumb:hover {
    background: #a1a1aa;
  }

  /* ══════════════════════════════════════════════════════════════════════════
   SELECTED DAY PANEL (mobile only)
  ══════════════════════════════════════════════════════════════════════════ */
  .mg-day-panel {
    display: none;
    flex-direction: column;
    background: var(--white);
    border-top: 1px solid var(--border);
    padding: 16px 20px;
    flex-shrink: 0;
    max-height: 280px;
    overflow-y: auto;
  }

  .mg-day-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .mg-day-panel__title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-2);
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .mg-day-panel__today-badge {
    font-size: 11px;
    font-weight: 600;
    color: var(--orange);
    background: var(--orange-lt);
    padding: 2px 8px;
    border-radius: 99px;
    letter-spacing: 0.4px;
  }

  .mg-day-panel__empty {
    font-size: 13px;
    color: var(--text-3);
    text-align: center;
    padding: 16px 0;
  }

  .mg-day-panel__event {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
    width: 100%;
    min-width: 0;
  }

  .mg-day-panel__event:last-child {
    border-bottom: none;
  }

  .mg-day-panel__color-bar {
    width: 3px;
    min-width: 3px;
    height: 32px;
    border-radius: 99px;
    flex-shrink: 0;
    align-self: center;
  }

  .mg-day-panel__color-bar--primary {
    background: var(--c-primary-bd);
  }
  .mg-day-panel__color-bar--orange {
    background: var(--c-orange-bd);
  }
  .mg-day-panel__color-bar--blue {
    background: var(--c-blue-bd);
  }
  .mg-day-panel__color-bar--yellow {
    background: var(--c-yellow-bd);
  }
  .mg-day-panel__color-bar--purple {
    background: var(--c-purple-bd);
  }
  .mg-day-panel__color-bar--green {
    background: var(--c-green-bd);
  }
  .mg-day-panel__color-bar--red {
    background: var(--c-red-bd);
  }
  .mg-day-panel__color-bar--pink {
    background: var(--c-pink-bd);
  }
  .mg-day-panel__color-bar--indigo {
    background: var(--c-indigo-bd);
  }
  .mg-day-panel__color-bar--cyan {
    background: var(--c-cyan-bd);
  }
  .mg-day-panel__color-bar--teal {
    background: var(--c-teal-bd);
  }

  .mg-day-panel__event-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1;
  }

  .mg-day-panel__event-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
    width: 100%;
  }

  .mg-day-panel__event-time {
    font-size: 12px;
    color: var(--text-2);
    display: block;
    white-space: nowrap;
  }

  /* ══════════════════════════════════════════════════════════════════════════
    RESPONSIVE
  ══════════════════════════════════════════════════════════════════════════ */

  @media (max-width: 640px) {
    :host {
      --aicard-area-h: 48px;
    }

    /* Shell becomes scrollable column on mobile */
    .mg-shell {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .mg-panel {
      flex-shrink: 0;
      flex: 0 0 auto;
    }

    .mg-grid {
      overflow-y: visible;
      min-height: 300px;
    }

    /* Day panel always visible below grid */
    .mg-day-panel {
      display: flex;
      flex: 1;
      min-height: 150px;
      max-height: none;
      overflow-y: auto;
    }

    .mg-week-row {
      min-height: 60px;
    }

    /* Compact day cells */
    .mg-day-cell {
      padding: 4px 3px;
      gap: 2px;
    }

    .mg-day-cell__num {
      font-size: 11px;
    }

    /* Make events flow horizontally as dots */
    .mg-day-cell {
      flex-direction: column;
      align-items: flex-start;
    }

    .mg-day-cell__dots {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 2px;
      padding: 2px 0;
    }

    .mg-today-badge {
      width: 20px;
      height: 20px;
      font-size: 10px;
    }

    .mg-today-label {
      display: none;
    }

    /* Events become small dots */
    .mg-event {
      width: 7px;
      height: 7px;
      min-width: 7px;
      min-height: 7px;
      border-radius: 50%;
      padding: 0;
      border: none;
      border-left: none;
      flex-shrink: 0;
      margin: 1px;
      display: block;
    }

    .mg-event__title {
      display: none;
    }

    .mg-more-btn {
      padding: 1px 4px;
      margin: 1px 4px;
      border-radius: 99px;
      background: #e4e4e7;
      color: #18181b;
      font-size: 9.5px;
      font-weight: 700;
      width: calc(100% - 8px);
      justify-content: center;
      line-height: 1;
      box-sizing: border-box;
    }

    .mg-more-btn__text::after {
      display: none;
    }

    /* Override the border-left from colour variants */
    .mg-event--primary {
      border-left: none;
      background: var(--c-primary-bd);
    }
    .mg-event--orange {
      border-left: none;
      background: var(--c-orange-bd);
    }
    .mg-event--blue {
      border-left: none;
      background: var(--c-blue-bd);
    }
    .mg-event--yellow {
      border-left: none;
      background: var(--c-yellow-bd);
    }
    .mg-event--purple {
      border-left: none;
      background: var(--c-purple-bd);
    }
    .mg-event--green {
      border-left: none;
      background: var(--c-green-bd);
    }
    .mg-event--red {
      border-left: none;
      background: var(--c-red-bd);
    }
    .mg-event--pink {
      border-left: none;
      background: var(--c-pink-bd);
    }
    .mg-event--indigo {
      border-left: none;
      background: var(--c-indigo-bd);
    }
    .mg-event--cyan {
      border-left: none;
      background: var(--c-cyan-bd);
    }
    .mg-event--teal {
      border-left: none;
      background: var(--c-teal-bd);
    }

    .mg-fab {
      width: 42px;
      height: 42px;
      bottom: 12px;
      right: 16px;
    }

    .mg-fab svg {
      width: 18px;
      height: 18px;
    }
  }

  @media (max-width: 480px) {
    .mg-view-toggle__btn {
      padding: 3px 8px;
      font-size: 11px;
    }

    .mg-icon-btn {
      width: 28px;
      height: 28px;
    }

    .mg-icon-btn svg {
      width: 15px;
      height: 15px;
    }
  }
`;
