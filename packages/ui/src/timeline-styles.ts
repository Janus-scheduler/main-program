import { css } from "lit";

export const timelineStyles = css`
  /* ── Design tokens ────────────────────────────────────────────────────────── */
  :host {
    --white: #ffffff;
    --bg: #f4f4f5;
    --border: #e4e4e7;
    --text-1: #18181b;
    --text-2: #71717a;
    --text-3: #a1a1aa;
    --orange: #f97316;
    --orange-lt: #fff7ed;

    /* Event colours */
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

    /* Layout sizes */
    --topbar-h: 56px;
    --aibar-h: 58px;
    --aicard-area-h: 60px;
    --res-col-w: 240px;
    --row-h: 72px;
    --grp-label-h: 32px;
    --hour-hdr-h: 40px;
    --super-hdr-h: 24px;

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

  .tl-component-shell {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* ══════════════════════════════════════════════════════════════════════════════
     TIMELINE CONTENT
  ══════════════════════════════════════════════════════════════════════════════ */
  .tl-panel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--white);
  }

  .tl-grid-wrap {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Resource names column */
  .tl-res-col {
    width: var(--res-col-w);
    min-width: var(--res-col-w);
    max-width: var(--res-col-w);
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    overflow-y: scroll;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    scrollbar-width: none;
  }

  .tl-res-col::-webkit-scrollbar {
    display: none;
  }

  .tl-res-col__header {
    height: calc(var(--hour-hdr-h) + var(--super-hdr-h));
    min-height: calc(var(--hour-hdr-h) + var(--super-hdr-h));
    display: flex;
    align-items: center;
    padding: 0 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    letter-spacing: 0.6px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--white);
    z-index: 5;
    flex-shrink: 0;
  }

  /* Group label row */
  .tl-res-group-label {
    height: var(--grp-label-h);
    min-height: var(--grp-label-h);
    display: flex;
    align-items: center;
    padding: 0 4px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-3);
    letter-spacing: 0.7px;
    border-bottom: 1px solid var(--border);
    background: #fafafa;
    flex-shrink: 0;
  }

  /* Resource row */
  .tl-res-row {
    height: var(--row-h);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    overflow: hidden;
  }

  .tl-res-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .tl-res-name {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tl-res-sub {
    font-size: 11.5px;
    color: var(--text-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Avatar */
  .tl-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tl-avatar--initials {
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.3px;
  }

  .tl-avatar--icon {
    border-radius: 10px;
    background: var(--orange-lt);
    color: var(--orange);
  }

  .tl-avatar--equipment {
    background: #fef3c7;
    color: #92400e;
  }

  /* ══════════════════════════════════════════════════════════════════════════════
     SCROLLABLE TIME GRID
  ══════════════════════════════════════════════════════════════════════════════ */
  .tl-time-scroll {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    overflow-y: scroll;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    will-change: scroll-position;
    -webkit-overflow-scrolling: touch;
    scroll-behavior: auto;
  }

  /* Smooth scrollbar */
  .tl-time-scroll::-webkit-scrollbar {
    height: 8px;
    width: 8px;
  }
  .tl-time-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .tl-time-scroll::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 4px;
  }
  .tl-time-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.25);
  }

  .tl-time-inner {
    position: relative;
    flex: 1;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    contain: layout style;
  }

  /* Super header (parent-level labels: day name, month, year) */
  .tl-super-header {
    height: var(--super-hdr-h);
    min-height: var(--super-hdr-h);
    flex-shrink: 0;
    position: sticky;
    top: 0;
    background: var(--white);
    z-index: 11;
    border-bottom: 1px solid var(--border);
    display: block;
    overflow: hidden;
  }

  .tl-super-cell {
    position: absolute;
    top: 0;
    height: var(--super-hdr-h);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-2);
    letter-spacing: 0.3px;
    border-right: 1px solid var(--border);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 8px;
  }

  /* Hour header (column labels) */
  .tl-hour-header {
    height: var(--hour-hdr-h);
    min-height: var(--hour-hdr-h);
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: var(--super-hdr-h);
    background: var(--white);
    z-index: 10;
    display: block;
    overflow: hidden;
  }

  .tl-hour-cell {
    position: absolute;
    top: 0;
    height: var(--hour-hdr-h);
    display: flex;
    align-items: center;
    padding-left: 12px;
    padding-right: 4px;
    font-family: "DM Mono", monospace;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-3);
    border-right: 1px solid var(--border);
    box-sizing: border-box;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tl-group-spacer {
    height: var(--grp-label-h);
    border-bottom: 1px solid var(--border);
    background: #fafafa;
    flex-shrink: 0;
  }

  .tl-event-row {
    height: var(--row-h);
    position: relative;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .tl-vline {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--border);
    pointer-events: none;
  }

  .tl-now-line {
    position: absolute;
    top: calc(var(--hour-hdr-h) + var(--super-hdr-h));
    bottom: 0;
    width: 2px;
    background: var(--orange);
    z-index: 20;
    pointer-events: none;
  }

  .tl-now-dot {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--orange);
  }

  /* ══════════════════════════════════════════════════════════════════════════════
     EVENT BLOCKS
  ══════════════════════════════════════════════════════════════════════════════ */
  .tl-event {
    touch-action: none;
    position: absolute;
    top: 8px;
    bottom: 8px;
    border-radius: 7px;
    border: none;
    border-left: 3px solid transparent;
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    overflow: hidden;
    box-shadow:
      0 3px 8px rgba(0, 0, 0, 0.12),
      0 1px 3px rgba(0, 0, 0, 0.08);
    transition:
      filter 0.15s,
      transform 0.12s,
      box-shadow 0.15s;
  }

  .tl-event:hover {
    filter: brightness(0.96);
    transform: scaleY(1.02);
    box-shadow:
      0 6px 16px rgba(0, 0, 0, 0.16),
      0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .tl-event:active {
    transform: scale(0.98);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
  }

  .tl-event--tiny {
    padding: 2px 4px;
    border-left-width: 3px;
    min-width: 24px;
    cursor: pointer;
    overflow: visible; /* allow tooltip ::before to escape the bounds */
  }

  /* Tooltip shown when event is too narrow to display text inline */
  .tl-event--tiny::before {
    content: attr(data-tooltip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: #18181b;
    color: #fff;
    font-size: 11.5px;
    font-weight: 500;
    line-height: 1.5;
    white-space: nowrap;
    padding: 5px 10px;
    border-radius: 7px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
    z-index: 9999;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    font-family: "DM Sans", sans-serif;
  }

  .tl-event--tiny:hover::before {
    opacity: 1;
  }

  .tl-event__title {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tl-event__time {
    font-size: 11px;
    font-family: "DM Mono", monospace;
    white-space: nowrap;
    opacity: 0.85;
  }

  .tl-event--orange {
    background: var(--c-orange-bg);
    border-color: var(--c-orange-bd);
    color: var(--c-orange-tx);
  }

  .tl-event--blue {
    background: var(--c-blue-bg);
    border-color: var(--c-blue-bd);
    color: var(--c-blue-tx);
  }

  .tl-event--yellow {
    background: var(--c-yellow-bg);
    border-color: var(--c-yellow-bd);
    color: var(--c-yellow-tx);
  }

  .tl-event--purple {
    background: var(--c-purple-bg);
    border-color: var(--c-purple-bd);
    color: var(--c-purple-tx);
  }

  .tl-event--green {
    background: var(--c-green-bg);
    border-color: var(--c-green-bd);
    color: var(--c-green-tx);
  }

  /* ══════════════════════════════════════════════════════════════════════════════
     DRAG-AND-DROP
  ══════════════════════════════════════════════════════════════════════════════ */

  /* Resize handles — thin strips on left/right edges */
  .tl-event-resize-handle {
    touch-action: none;
    position: absolute;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    z-index: 2;
    border-radius: 2px;
    transition: background 0.15s;
  }

  .tl-event-resize-handle--start {
    left: 0;
  }

  .tl-event-resize-handle--end {
    right: 0;
  }

  .tl-event:hover .tl-event-resize-handle {
    background: rgba(0, 0, 0, 0.08);
  }

  .tl-event-resize-handle:hover {
    background: rgba(0, 0, 0, 0.18) !important;
  }

  /* Event being dragged — dim the original */
  .tl-event--dragging {
    opacity: 0.35;
    pointer-events: none;
  }

  /* Ghost preview during drag */
  .tl-drag-ghost {
    position: absolute;
    height: 56px;
    border-radius: 7px;
    border-left: 3px solid transparent;
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    z-index: 100;
    pointer-events: none;
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.15),
      0 2px 8px rgba(0, 0, 0, 0.08);
    opacity: 0.9;
    transition: top 0.08s ease-out;
  }

  .tl-drag-ghost__title {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tl-drag-ghost__time {
    font-size: 11px;
    font-family: "DM Mono", monospace;
    white-space: nowrap;
    opacity: 0.85;
  }

  .tl-drag-ghost--orange {
    background: var(--c-orange-bg);
    border-color: var(--c-orange-bd);
    color: var(--c-orange-tx);
  }

  .tl-drag-ghost--blue {
    background: var(--c-blue-bg);
    border-color: var(--c-blue-bd);
    color: var(--c-blue-tx);
  }

  .tl-drag-ghost--yellow {
    background: var(--c-yellow-bg);
    border-color: var(--c-yellow-bd);
    color: var(--c-yellow-tx);
  }

  .tl-drag-ghost--purple {
    background: var(--c-purple-bg);
    border-color: var(--c-purple-bd);
    color: var(--c-purple-tx);
  }

  .tl-drag-ghost--green {
    background: var(--c-green-bg);
    border-color: var(--c-green-bd);
    color: var(--c-green-tx);
  }

  /* Empty-space creation cursor */
  .tl-component-shell--draw-mode .tl-event-row {
    touch-action: none;
    cursor: crosshair;
  }

  .tl-event {
    touch-action: none;
    cursor: grab;
  }

  .tl-event:active {
    cursor: grabbing;
  }

  /* ══════════════════════════════════════════════════════════════════════════════
     FAB
  ══════════════════════════════════════════════════════════════════════════════ */
  .tl-fab {
    position: absolute; /* changed to absolute so it stays in the component bounds */
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
    transition:
      background 0.18s,
      transform 0.14s,
      box-shadow 0.18s;
    z-index: 200;
  }

  .tl-fab:hover {
    background: #ea6c0a;
    transform: scale(1.07);
  }

  .tl-fab:active {
    transform: scale(0.96);
  }

  /* SCROLLBARS */
  .tl-time-scroll::-webkit-scrollbar {
    height: 6px;
    width: 6px;
  }
  .tl-time-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .tl-time-scroll::-webkit-scrollbar-thumb {
    background: #d4d4d8;
    border-radius: 99px;
  }
  .tl-time-scroll::-webkit-scrollbar-thumb:hover {
    background: #a1a1aa;
  }

  /* ══════════════════════════════════════════════════════════════════════════════
     RESPONSIVE
  ══════════════════════════════════════════════════════════════════════════════ */
  @media (max-width: 700px) {
    /* Main Layout */
    :host {
      --res-col-w: 72px;
      --aicard-area-h: 70px;
    }

    /* Fit group labels into the narrow 72px resource column */
    .tl-res-group-label {
      justify-content: center;
      padding: 0;
      font-size: 9px;
      letter-spacing: 0.2px;
    }

    /* Resource Column Vertical Stacking */
    .tl-res-row {
      flex-direction: column;
      justify-content: center;
      align-items: center; /* Ensures avatar and text are centered horizontally */
      gap: 6px;
      padding: 0 4px;
    }
    .tl-res-info {
      display: flex;
      width: 100%;
      justify-content: center;
    }
    .tl-res-sub {
      display: none;
    }
    .tl-res-name {
      font-size: 10.5px;
      text-align: center;
      white-space: normal;
      line-height: 1.1;
      font-weight: 500;
      color: #18181b;
      word-break: break-word;
    }

    .tl-avatar {
      width: 32px;
      height: 32px;
    }
    .tl-avatar--initials {
      font-size: 11px;
    }

    /* Time grid adjustments */
    .tl-hour-cell {
      justify-content: center;
      padding: 0;
      font-size: 11px;
      font-weight: 600;
      color: #52525b;
      border-right: none;
    }

    .tl-now-line {
      width: 1px;
      background: #dc2626; /* Red line for now like mockup */
    }
    .tl-now-dot {
      width: 8px;
      height: 8px;
      background: #dc2626;
      border: 2px solid #fff;
    }

    .tl-vline {
      background: #f4f4f5;
    }

    .tl-event-row {
      border-bottom: 1px solid #f4f4f5;
    }

    /* Hide floating add button if bottom nav handles it */
    .tl-fab {
      display: none;
    }
  }

  @media (max-width: 480px) {
    /* Mobile micro-adjustments */
    :host {
      --res-col-w: 64px;
    }
    .tl-res-name {
      font-size: 9.5px;
    }
  }
`;
