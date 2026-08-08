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
    --orange: var(--janus-primary-color, #f97316);
    --orange-lt: var(--janus-primary-bg, #fff7ed);

    /* Event colours */
    --c-primary-bg: var(--janus-primary-bg, color-mix(in srgb, var(--c-primary) 12%, #ffffff));
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
  .tl-avatar--image {
    object-fit: cover;
  }

  /* ══════════════════════════════════════════════════════════════════════════════
     SCROLLABLE TIME GRID
  ══════════════════════════════════════════════════════════════════════════════ */
  .tl-time-scroll {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    overflow-y: scroll;
    display: block;
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
    height: max-content;
    min-height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* Super header (parent-level labels: day name, month, year) */
  .tl-super-header {
    height: var(--super-hdr-h);
    min-height: var(--super-hdr-h);
    flex-shrink: 0;
    position: sticky;
    top: 0;
    background: var(--white);
    z-index: 30;
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
    z-index: 29;
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
    touch-action: none;
    height: var(--row-h);
    position: relative;
    z-index: 2;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    contain: layout paint;
  }

  .tl-vlines-layer {
    position: absolute;
    top: calc(var(--hour-hdr-h) + var(--super-hdr-h));
    bottom: 0;
    left: 0;
    right: 0;
    pointer-events: none;
    z-index: 0;
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
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition:
      filter 0.15s,
      transform 0.12s,
      background-color 0.15s,
      box-shadow 0.15s;
  }

  .tl-event:hover {
    filter: brightness(0.96);
    transform: scaleY(1.02);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.14);
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

  .tl-event--primary {
    background: color-mix(in srgb, var(--c-primary-bg) 32%, var(--white));
    border-color: var(--c-primary-bd);
    color: var(--c-primary-tx);
  }
  .tl-event--primary:hover {
    background: color-mix(in srgb, var(--c-primary-bg) 55%, var(--white));
  }

  .tl-event--orange {
    background: color-mix(in srgb, var(--c-orange-bg) 32%, var(--white));
    border-color: var(--c-orange-bd);
    color: var(--c-orange-tx);
  }
  .tl-event--orange:hover {
    background: color-mix(in srgb, var(--c-orange-bg) 55%, var(--white));
  }

  .tl-event--blue {
    background: color-mix(in srgb, var(--c-blue-bg) 32%, var(--white));
    border-color: var(--c-blue-bd);
    color: var(--c-blue-tx);
  }
  .tl-event--blue:hover {
    background: color-mix(in srgb, var(--c-blue-bg) 55%, var(--white));
  }

  .tl-event--yellow {
    background: color-mix(in srgb, var(--c-yellow-bg) 32%, var(--white));
    border-color: var(--c-yellow-bd);
    color: var(--c-yellow-tx);
  }
  .tl-event--yellow:hover {
    background: color-mix(in srgb, var(--c-yellow-bg) 55%, var(--white));
  }

  .tl-event--purple {
    background: color-mix(in srgb, var(--c-purple-bg) 32%, var(--white));
    border-color: var(--c-purple-bd);
    color: var(--c-purple-tx);
  }
  .tl-event--purple:hover {
    background: color-mix(in srgb, var(--c-purple-bg) 55%, var(--white));
  }

  .tl-event--green {
    background: color-mix(in srgb, var(--c-green-bg) 32%, var(--white));
    border-color: var(--c-green-bd);
    color: var(--c-green-tx);
  }
  .tl-event--green:hover {
    background: color-mix(in srgb, var(--c-green-bg) 55%, var(--white));
  }

  .tl-event--red {
    background: color-mix(in srgb, var(--c-red-bg) 32%, var(--white));
    border-color: var(--c-red-bd);
    color: var(--c-red-tx);
  }
  .tl-event--red:hover {
    background: color-mix(in srgb, var(--c-red-bg) 55%, var(--white));
  }

  .tl-event--pink {
    background: color-mix(in srgb, var(--c-pink-bg) 32%, var(--white));
    border-color: var(--c-pink-bd);
    color: var(--c-pink-tx);
  }
  .tl-event--pink:hover {
    background: color-mix(in srgb, var(--c-pink-bg) 55%, var(--white));
  }

  .tl-event--indigo {
    background: color-mix(in srgb, var(--c-indigo-bg) 32%, var(--white));
    border-color: var(--c-indigo-bd);
    color: var(--c-indigo-tx);
  }
  .tl-event--indigo:hover {
    background: color-mix(in srgb, var(--c-indigo-bg) 55%, var(--white));
  }

  .tl-event--cyan {
    background: color-mix(in srgb, var(--c-cyan-bg) 32%, var(--white));
    border-color: var(--c-cyan-bd);
    color: var(--c-cyan-tx);
  }
  .tl-event--cyan:hover {
    background: color-mix(in srgb, var(--c-cyan-bg) 55%, var(--white));
  }

  .tl-event--teal {
    background: color-mix(in srgb, var(--c-teal-bg) 32%, var(--white));
    border-color: var(--c-teal-bd);
    color: var(--c-teal-tx);
  }
  .tl-event--teal:hover {
    background: color-mix(in srgb, var(--c-teal-bg) 55%, var(--white));
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

  .tl-drag-ghost--primary {
    background: var(--c-primary-bg);
    border-color: var(--c-primary-bd);
    color: var(--c-primary-tx);
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

  .tl-drag-ghost--red {
    background: var(--c-red-bg);
    border-color: var(--c-red-bd);
    color: var(--c-red-tx);
  }

  .tl-drag-ghost--pink {
    background: var(--c-pink-bg);
    border-color: var(--c-pink-bd);
    color: var(--c-pink-tx);
  }

  .tl-drag-ghost--indigo {
    background: var(--c-indigo-bg);
    border-color: var(--c-indigo-bd);
    color: var(--c-indigo-tx);
  }

  .tl-drag-ghost--cyan {
    background: var(--c-cyan-bg);
    border-color: var(--c-cyan-bd);
    color: var(--c-cyan-tx);
  }

  .tl-drag-ghost--teal {
    background: var(--c-teal-bg);
    border-color: var(--c-teal-bd);
    color: var(--c-teal-tx);
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
    box-shadow: 0 4px 18px var(--janus-primary-glow, rgba(249, 115, 22, 0.45));
    transition:
      background 0.18s,
      transform 0.14s,
      filter 0.18s;
      box-shadow 0.18s;
    z-index: 200;
  }

  .tl-fab:hover {
    filter: brightness(0.95);
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
  /* ── Time Conflict Banner & Indicators ───────────────────────────────────── */
  .tl-conflict-banner {
    position: relative;
    background: #fffbeb;
    border-bottom: 1px solid #fef3c7;
    color: #b45309;
    padding: 10px 20px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 13px;
    font-weight: 500;
    z-index: 40;
    animation: slideDown 0.2s ease-out;
  }

  .tl-conflict-banner__icon {
    font-size: 16px;
    line-height: 1;
    margin-top: 1px;
  }

  .tl-conflict-banner__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .tl-conflict-banner__summary {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .tl-conflict-details-toggle {
    background: none;
    border: none;
    padding: 0;
    color: #b45309;
    text-decoration: underline;
    font-weight: 600;
    cursor: pointer;
    font-size: inherit;
    font-family: inherit;
    transition: color 0.15s;
  }

  .tl-conflict-details-toggle:hover {
    color: #78350f;
  }

  .tl-conflict-details-list {
    margin: 6px 0 0 0;
    padding-left: 20px;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tl-conflict-details-list li {
    list-style-type: disc;
  }

  .tl-conflict-banner__close {
    background: none;
    border: none;
    padding: 2px 6px;
    color: #b45309;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background 0.15s,
      color 0.15s;
    margin-top: -2px;
  }

  .tl-conflict-banner__close:hover {
    background: rgba(180, 83, 9, 0.1);
    color: #78350f;
  }

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

  .tl-event--conflict {
    /* No outline border, style conflicts purely with a corner warning badge dot */
  }

  .tl-event__conflict-dot {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 6px;
    height: 6px;
    background-color: #ef4444;
    border-radius: 50%;
    border: 1px solid #ffffff;
    box-shadow: 0 0 3px rgba(239, 68, 68, 0.5);
    z-index: 4;
  }

  .tl-drag-ghost--conflict {
    outline: 2px dashed #ef4444 !important;
    outline-offset: -1px;
    background: #fef2f2 !important;
    color: #991b1b !important;
  }

  .tl-drag-ghost__conflict-icon {
    color: #ef4444;
    font-weight: 700;
    margin-right: 4px;
  }

  @keyframes slideDown {
    from {
      transform: translateY(-10px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  /* ── Blocked Conflict Alert Dialog ────────────────────────────────────────── */
  .tl-alert-dialog-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(24, 24, 27, 0.4);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.18s ease-out;
  }

  .tl-alert-dialog {
    background: var(--white);
    border-radius: 12px;
    width: 90%;
    max-width: 400px;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    border: 1px solid var(--border);
    overflow: hidden;
    animation: scaleIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .tl-alert-dialog__header {
    padding: 18px 20px 12px;
    border-bottom: 1px solid var(--border);
  }

  .tl-alert-dialog__title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
  }

  .tl-alert-dialog__body {
    padding: 20px;
    font-size: 13.5px;
    color: var(--text-2);
    line-height: 1.5;
  }

  .tl-alert-dialog__footer {
    padding: 12px 20px 16px;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid var(--border);
    background: #fafafa;
  }

  .tl-alert-dialog__btn {
    padding: 6px 16px;
    background: var(--orange);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    padding: 7px 16px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 6px var(--janus-primary-glow, rgba(249, 115, 22, 0.2));
    transition:
      background 0.15s,
      transform 0.1s,
      filter 0.15s;
  }

  .tl-alert-dialog__btn:hover {
    filter: brightness(0.95);
    transform: translateY(-1px);
  }.tl-alert-dialog__btn:active {
    transform: scale(0.97);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scaleIn {
    from {
      transform: scale(0.94);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
`;
