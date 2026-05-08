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
    --orange: #f97316;
    --orange-lt: #fff7ed;

    /* Event colours — same vars as timeline */
    --c-orange-bg: #fff7ed;
    --c-orange-bd: #f97316;
    --c-orange-tx: #c2410c;
    --c-blue-bg: #eff6ff;
    --c-blue-bd: #3b82f6;
    --c-blue-tx: #1d4ed8;
    --c-yellow-bg: #fefce8;
    --c-yellow-bd: #f59e0b;
    --c-yellow-tx: #b45309;
    --c-purple-bg: #faf5ff;
    --c-purple-bd: #8b5cf6;
    --c-purple-tx: #6d28d9;
    --c-green-bg: #f0fdf4;
    --c-green-bd: #10b981;
    --c-green-tx: #047857;

    /* Layout */
    --topbar-h: 56px;
    --aicard-area-h: 60px;
    --day-hdr-h: 40px;       /* weekday label row height */
    --today-bg: #fff7ed;     /* highlight for today's cell */

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

  /* ── Top Bar ──────────────────────────────────────────────────────────────── */
  
  .mg-topbar {
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

  .mg-nav {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
  }

  .mg-nav__arrow {
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
    transition: background 0.15s, color 0.15s;
  }

  .mg-nav__arrow svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    stroke: currentColor;
  }

  .mg-nav__arrow:hover {
    background: var(--bg);
    color: var(--text-1);
  }

  .mg-nav__today {
    padding: 5px 12px;
    border: 1.5px solid var(--border);
    border-radius: 7px;
    background: var(--white);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-1);
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .mg-nav__today:hover {
    border-color: var(--orange);
  }

  .mg-nav__month {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-1);
    margin-left: 8px;
    letter-spacing: -0.3px;
  }

  /* Right side — view toggle + icons */
  .mg-topbar__right {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .mg-view-toggle {
    display: flex;
    background: var(--bg);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
  }

  .mg-view-toggle__btn {
    padding: 5px 14px;
    border: none;
    border-radius: 6px;
    background: transparent;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-2);
    cursor: pointer;
    transition: background 0.15s,
    color: 0.15s;
  }

  .mg-view-toggle__btn.active {
    background: var(--white);
    color: var(--text-1);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  .mg-icon-btn {
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
    transition: background 0.15s, color 0.15s;
  }

  .mg-icon-btn svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .mg-icon-btn:hover {
    background: var(--bg);
    color: var(--text-1);
  }

  .mg-icon-btn--bell {
    position: relative;
  }

  .mg-bell-dot {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 7px;
    height: 7px;
    background: var(--orange);
    border-radius: 50%;
    border: 1.5px solid var(--white);
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
    padding: 8px 6px 6px;
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

  /* ── Day number ── */
  .mg-day-cell__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .mg-day-cell__num {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-1);
    line-height: 1;
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
    transition: filter 0.12s, transform 0.1s;
  }

  .mg-event:hover {
    filter: brightness(0.95);
    transform: scaleX(0.99);
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

  /* Colour variants — identical mapping as timeline */
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
    bottom: calc(var(--aicard-area-h) + 16px);
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
    box-shadow: 0 4px 18px rgba(249, 115, 22, 0.45);
    transition: background 0.18s, transform 0.14s, box-shadow 0.18s;
    z-index: 200;
  }

  .mg-fab:hover {
    background: #ea6c0a;
    transform: scale(1.07);
  }

  .mg-fab:active {
    transform: scale(0.96);
  }

  /* ── AI Bar ──────────────────────────────────────────────────────────────── */

  .mg-ai-wrap {
    height: var(--aicard-area-h);
    min-height: var(--aicard-area-h);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: 0 24px;
    background: var(--bg);
  }

  .mg-ai-card {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--white);
    border: 1.5px solid var(--border);
    border-radius: 14px;
    padding: 6px 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04);
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .mg-ai-card:focus-within {
    border-color: var(--orange);
    box-shadow: 0 4px 20px rgba(249, 115, 22, 0.12),
      0 0 0 3px rgba(249, 115, 22, 0.08);
  }

  .mg-ai-card__input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    font-family: inherit;
    font-size: 14px;
    color: var(--text-1);
    background: transparent;
  }

  .mg-ai-card__input::placeholder {
    color: var(--text-3);
  }

  .mg-ai-card__btn {
    padding: 6px 18px;
    background: var(--orange);
    color: #fff;
    border: none;
    border-radius: 9px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(249, 115, 22, 0.3);
    transition: background 0.15s, transform 0.12s;
  }

  .mg-ai-card__btn:hover {
    background: #ea6c0a;
  }

  .mg-ai-card__btn:active {
    transform: scale(0.97);
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

  .mg-day-panel__color-bar--orange { background: var(--c-orange-bd); }
  .mg-day-panel__color-bar--blue   { background: var(--c-blue-bd); }
  .mg-day-panel__color-bar--yellow { background: var(--c-yellow-bd); }
  .mg-day-panel__color-bar--purple { background: var(--c-purple-bd); }
  .mg-day-panel__color-bar--green  { background: var(--c-green-bd); }

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
  @media (max-width: 900px) {
    .mg-nav__month {
      font-size: 14px;
    }
  }

  @media (max-width: 768px) {
    .mg-topbar {
      padding: 0 12px;
      gap: 8px;
    }
    .mg-nav__today {
      padding: 4px 8px;
      font-size: 12px;
    }
  }

  @media (max-width: 640px) {
    :host {
      --aicard-area-h: 48px;
    }

    .mg-topbar {
      padding: 0 10px;
      gap: 6px;
    }

    .mg-icon-btn--bell {
      display: none;
    }

    .mg-view-toggle__btn {
      padding: 4px 10px;
      font-size: 12px;
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

    .mg-event--more {
      display: none;
    }

    /* Override the border-left from colour variants */
    .mg-event--orange { border-left: none; background: var(--c-orange-bd); }
    .mg-event--blue   { border-left: none; background: var(--c-blue-bd); }
    .mg-event--yellow { border-left: none; background: var(--c-yellow-bd); }
    .mg-event--purple { border-left: none; background: var(--c-purple-bd); }
    .mg-event--green  { border-left: none; background: var(--c-green-bd); }

    .mg-fab {
      width: 42px;
      height: 42px;
      bottom: calc(var(--aicard-area-h) + 12px);
      right: 16px;
    }

    .mg-fab svg {
      width: 18px;
      height: 18px;
    }

    .mg-ai-wrap {
      height: auto;
      min-height: auto;
      padding: 8px 12px;
    }

    .mg-ai-card {
      padding: 4px 10px;
      border-radius: 10px;
    }

    .mg-ai-card__input {
      font-size: 12px;
    }

    .mg-ai-card__btn {
      padding: 5px 12px;
      font-size: 12px;
      border-radius: 7px;
    }

    .mg-ai-card__input::placeholder {
      font-size: 11px;
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
