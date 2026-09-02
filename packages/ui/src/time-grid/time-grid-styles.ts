import { css } from "lit";

/**
 * Styles shared by the two hour-grid views (`<janus-day-grid>` and
 * `<janus-week-grid>`).
 *
 * Both components compose this with their own layout sheet:
 *   static styles = [timeGridStyles, css`…view specifics…`]
 *
 * Colour tokens mirror `month-grid-styles.ts` exactly so an event chip reads
 * the same in every view.
 */
export const timeGridStyles = css`
  /* ── Design tokens ── */
  :host {
    --white: #ffffff;
    --bg: #f4f4f5;
    --border: #e4e4e7;
    --border-strong: #d4d4d8;
    --text-1: #18181b;
    --text-2: #71717a;
    --text-3: #a1a1aa;
    --orange: var(--janus-primary-color, #f97316);
    --orange-lt: var(--janus-primary-bg, #fff7ed);

    /* Event colours — same vars as timeline + month */
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

    /* Layout — overridden per view */
    --gutter-w: 64px;
    --hour-h: 48px;
    --col-hdr-h: 56px;
    --today-bg: var(--janus-primary-bg, #fff7ed);

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
  .tg-shell {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
    background: var(--white);
  }

  /* ── Column header row (sticky row 1 inside .tg-grid) ──────────────────────
   * Header, all-day row and hour columns are all grid items of the SAME
   * .tg-grid, scrolled by the SAME .tg-body container — not three separate
   * grids each computing their own column widths. That's deliberate: when
   * the header lived outside the scrollable area, .tg-body's own scrollbar
   * shrank its content box while the header's didn't, so columns drifted out
   * of alignment (worse the further right a column sat). Sticky positioning
   * keeps this row pinned without needing a second grid. */
  .tg-head__corner,
  .tg-head__cell {
    position: sticky;
    top: 0;
    z-index: 20;
    height: var(--col-hdr-h);
    background: var(--white);
    border-bottom: 1px solid var(--border);
  }

  /* Empty top-left corner above the hour gutter */
  .tg-head__corner {
    border-right: 1px solid var(--border);
  }

  .tg-head__cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4px 6px;
    border-right: 1px solid var(--border);
    min-width: 0;
  }

  .tg-head__cell--last {
    border-right: none;
  }

  .tg-head__cell--today {
    background: var(--today-bg);
  }

  .tg-head__btn {
    all: unset;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    width: 100%;
    height: 100%;
    border-radius: 8px;
    cursor: pointer;
    transition:
      background 0.15s ease,
      transform 0.1s ease;
    font-family: inherit;
  }

  .tg-head__btn:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  .tg-head__btn:active {
    transform: scale(0.97);
  }

  .tg-head__btn:focus-visible {
    outline: 2px solid var(--orange);
    outline-offset: -2px;
  }

  .tg-head__btn--today:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  .tg-head__static {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    width: 100%;
    height: 100%;
  }

  .tg-head__dow {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.6px;
    color: var(--text-3);
  }

  .tg-head__cell--today .tg-head__dow {
    color: var(--orange);
  }

  .tg-head__num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 26px;
    padding: 0 6px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-2);
    line-height: 1;
  }

  .tg-head__cell--today .tg-head__num {
    background: var(--orange);
    color: #fff;
    font-weight: 700;
  }

  .tg-allday__label,
  .tg-allday__cell {
    position: sticky;
    top: var(--col-hdr-h);
    z-index: 15;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }

  .tg-allday__cell {
    border-right: 1px solid var(--border);
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 96px;
    overflow-y: auto;
    cursor: pointer;
    transition: background-color 0.12s ease;
  }

  .tg-allday__cell:hover {
    background-color: #fafafa;
  }

  .tg-allday__label {
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 8px 10px 8px 0;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--text-3);
    border-right: 1px solid var(--border);
  }

  .tg-allday__cell {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 5px 4px;
    border-right: 1px solid var(--border);
    min-width: 0;
    min-height: 34px;
  }

  .tg-allday__cell--last {
    border-right: none;
  }

  /* ── Scrollable grid ────────────────────────────────────────────────────── */
  .tg-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .tg-grid {
    display: grid;
    grid-template-columns: var(--gutter-w) repeat(var(--col-count, 1), 1fr);
    position: relative;
  }

  /* Hour labels down the left gutter */
  .tg-gutter {
    border-right: 1px solid var(--border);
    background: var(--white);
  }

  .tg-gutter__mark {
    height: var(--hour-h);
    padding: 0 8px 0 0;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-3);
    text-align: right;
    /* Nudge the label up so it sits on the hour line, not below it */
    transform: translateY(-6px);
    white-space: nowrap;
  }

  .tg-gutter__mark:first-child {
    /* The midnight label has no line above it to hang from */
    visibility: hidden;
  }

  /* ── Day column ─────────────────────────────────────────────────────────── */
  .tg-col {
    position: relative;
    border-right: 1px solid var(--border);
    min-width: 0;
  }

  .tg-col--last {
    border-right: none;
  }

  /*
   * Today's column stays plain white in the body — a full tint fights with
   * event chip colors (esp. blue events, which nearly vanish against the
   * default tint). The header cell above still carries the today highlight.
   */
  .tg-col--weekend:not(.tg-col--today) {
    background: #fcfcfd;
  }

  /* Hour lines, painted as a repeating gradient so there is no DOM per hour */
  .tg-col__lines {
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
      to bottom,
      var(--border) 0,
      var(--border) 1px,
      transparent 1px,
      transparent var(--hour-h)
    );
    pointer-events: none;
  }

  /*
   * Draw-to-create: a single click still creates a default-duration event
   * (no highlight needed, the click itself is the affordance); dragging
   * draws a custom range, shown live via .tg-drag-ghost. The crosshair is
   * the only hover affordance — no colored hover fill, matching Timeline.
   */
  :host([allow-create]) .tg-col {
    cursor: crosshair;
  }

  /* ── Event blocks ───────────────────────────────────────────────────────── */
  .tg-event {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 1px;
    border: none;
    border-left: 3px solid transparent;
    border-radius: 7px;
    padding: 4px 7px;
    font-family: inherit;
    text-align: left;
    cursor: grab;
    touch-action: none;
    overflow: hidden;
    z-index: 2;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    transition:
      filter 0.15s,
      transform 0.12s,
      background-color 0.15s,
      box-shadow 0.15s;
  }

  .tg-event:hover,
  .tg-event--hovered {
    filter: brightness(0.96);
    transform: scaleY(1.02);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.14);
    z-index: 4;
  }

  .tg-event:active {
    transform: scale(0.98);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
    cursor: grabbing;
  }

  /* Multi-day segments aren't draggable — see time-grid-base.ts _onEventPointerDown */
  .tg-event--static,
  .tg-event--static:active {
    cursor: pointer;
  }

  .tg-event--clip-top {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    border-top: none;
  }

  .tg-event--clip-bottom {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-bottom: none;
  }

  /* Short events collapse to a single line */
  .tg-event--compact {
    flex-direction: row;
    align-items: center;
    gap: 5px;
    padding: 2px 6px;
  }

  .tg-event__title {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tg-event__time {
    font-size: 11px;
    font-family: "DM Mono", monospace;
    white-space: nowrap;
    opacity: 0.85;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tg-event--compact .tg-event__title {
    font-size: 11px;
  }

  .tg-event--compact .tg-event__time {
    font-size: 10px;
    flex-shrink: 0;
  }

  /* ── Resource avatars on the event card ─────────────────────────────────── */

  .tg-event__avatars {
    display: flex;
    align-items: center;
    /*
     * Pinned to the card's bottom-right. Done with auto margin + align-self
     * rather than position:absolute so the row still occupies flow space —
     * the title and time can never end up running underneath it.
     */
    margin-top: auto;
    align-self: flex-end;
    flex-shrink: 0;
    /* Never let a long roster push past the card's own bounds */
    max-width: 100%;
  }

  /*
   * Only the avatars clip when a card is too narrow for them; the "+N" badge
   * lives outside this box so the count is never sliced in half.
   */
  .tg-event__avatar-stack {
    display: flex;
    align-items: center;
    min-width: 0;
    overflow: hidden;
  }

  .tg-avatar {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    /* Ring in the card colour so overlapped avatars stay separable */
    border: 1.5px solid var(--white);
    /* Overlap into a stack, like the participant rows in the editor */
    margin-left: -5px;
  }

  .tg-event__avatar-stack .tg-avatar:first-child {
    margin-left: 0;
  }

  /* The badge keeps its overlap with the stack, but must never shrink away */
  .tg-avatar--more {
    flex-shrink: 0;
  }

  .tg-avatar--initials {
    font-size: 8px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.2px;
    line-height: 1;
  }

  .tg-avatar--image {
    object-fit: cover;
  }

  /*
   * Rooms and equipment get fixed neutral/amber tints rather than the primary
   * token: an event card is already tinted with its own colour, and a
   * primary-tinted avatar disappears into a card of that same colour.
   */
  .tg-avatar--room {
    background: #e4e4e7;
    color: #52525b;
  }

  .tg-avatar--equipment {
    background: #fef3c7;
    color: #92400e;
  }

  /* The icons ship at 18px — scale them down to fit the smaller avatar */
  .tg-avatar--icon svg {
    width: 11px;
    height: 11px;
  }

  .tg-avatar--more {
    background: var(--bg);
    color: var(--text-2);
    font-size: 8px;
    font-weight: 700;
    line-height: 1;
  }

  /* ── Drag-and-drop ──────────────────────────────────────────────────────── */

  /* Resize handles — thin strips on the top/bottom edges */
  .tg-event-resize-handle {
    touch-action: none;
    position: absolute;
    left: 0;
    right: 0;
    height: 6px;
    cursor: row-resize;
    z-index: 3;
    border-radius: 2px;
    transition: background 0.15s;
  }

  .tg-event-resize-handle--top {
    top: 0;
  }

  .tg-event-resize-handle--bottom {
    bottom: 0;
  }

  .tg-event:hover .tg-event-resize-handle {
    background: rgba(0, 0, 0, 0.08);
  }

  .tg-event-resize-handle:hover {
    background: rgba(0, 0, 0, 0.18) !important;
  }

  /* Event being dragged or resized — dim the original, ghost stands in for it */
  .tg-event--dragging,
  .tg-event--resizing {
    opacity: 0.35;
    pointer-events: none;
  }

  /* Ghost preview, positioned the same way as a real .tg-event */
  .tg-drag-ghost {
    position: absolute;
    left: 4px;
    right: 6px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    border: 1.5px dashed;
    border-radius: 7px;
    padding: 4px 7px;
    z-index: 6;
    pointer-events: none;
    box-shadow:
      0 8px 24px rgba(24, 24, 27, 0.15),
      0 2px 8px rgba(24, 24, 27, 0.08);
    opacity: 0.92;
  }

  .tg-drag-ghost__title {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tg-drag-ghost__time {
    font-size: 11px;
    font-family: "DM Mono", monospace;
    opacity: 0.85;
    white-space: nowrap;
  }

  .tg-drag-ghost--primary {
    background: color-mix(in srgb, var(--c-primary-bg) 40%, var(--white));
    border-color: var(--c-primary-bd);
    color: var(--c-primary-tx);
  }
  .tg-drag-ghost--orange {
    background: color-mix(in srgb, var(--c-orange-bg) 40%, var(--white));
    border-color: var(--c-orange-bd);
    color: var(--c-orange-tx);
  }
  .tg-drag-ghost--blue {
    background: color-mix(in srgb, var(--c-blue-bg) 40%, var(--white));
    border-color: var(--c-blue-bd);
    color: var(--c-blue-tx);
  }
  .tg-drag-ghost--yellow {
    background: color-mix(in srgb, var(--c-yellow-bg) 40%, var(--white));
    border-color: var(--c-yellow-bd);
    color: var(--c-yellow-tx);
  }
  .tg-drag-ghost--purple {
    background: color-mix(in srgb, var(--c-purple-bg) 40%, var(--white));
    border-color: var(--c-purple-bd);
    color: var(--c-purple-tx);
  }
  .tg-drag-ghost--green {
    background: color-mix(in srgb, var(--c-green-bg) 40%, var(--white));
    border-color: var(--c-green-bd);
    color: var(--c-green-tx);
  }
  .tg-drag-ghost--red {
    background: color-mix(in srgb, var(--c-red-bg) 40%, var(--white));
    border-color: var(--c-red-bd);
    color: var(--c-red-tx);
  }
  .tg-drag-ghost--pink {
    background: color-mix(in srgb, var(--c-pink-bg) 40%, var(--white));
    border-color: var(--c-pink-bd);
    color: var(--c-pink-tx);
  }
  .tg-drag-ghost--indigo {
    background: color-mix(in srgb, var(--c-indigo-bg) 40%, var(--white));
    border-color: var(--c-indigo-bd);
    color: var(--c-indigo-tx);
  }
  .tg-drag-ghost--cyan {
    background: color-mix(in srgb, var(--c-cyan-bg) 40%, var(--white));
    border-color: var(--c-cyan-bd);
    color: var(--c-cyan-tx);
  }
  .tg-drag-ghost--teal {
    background: color-mix(in srgb, var(--c-teal-bg) 40%, var(--white));
    border-color: var(--c-teal-bd);
    color: var(--c-teal-tx);
  }

  /* All-day chip — same colours, flat layout matching Month chips */
  .tg-chip {
    display: flex;
    align-items: center;
    border: none;
    border-left: 3px solid transparent;
    border-radius: 5px;
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

  .tg-chip:hover {
    filter: brightness(0.95);
    transform: scaleX(0.99);
  }

  /* Colour variants — matching Timeline soft-mix and Month palette */
  .tg-event--primary,
  .tg-chip--primary {
    background: color-mix(in srgb, var(--c-primary-bg) 32%, var(--white));
    border-color: var(--c-primary-bd);
    color: var(--c-primary-tx);
  }
  .tg-event--primary:hover {
    background: color-mix(in srgb, var(--c-primary-bg) 55%, var(--white));
  }

  .tg-event--orange,
  .tg-chip--orange {
    background: color-mix(in srgb, var(--c-orange-bg) 32%, var(--white));
    border-color: var(--c-orange-bd);
    color: var(--c-orange-tx);
  }
  .tg-event--orange:hover {
    background: color-mix(in srgb, var(--c-orange-bg) 55%, var(--white));
  }

  .tg-event--blue,
  .tg-chip--blue {
    background: color-mix(in srgb, var(--c-blue-bg) 32%, var(--white));
    border-color: var(--c-blue-bd);
    color: var(--c-blue-tx);
  }
  .tg-event--blue:hover {
    background: color-mix(in srgb, var(--c-blue-bg) 55%, var(--white));
  }

  .tg-event--yellow,
  .tg-chip--yellow {
    background: color-mix(in srgb, var(--c-yellow-bg) 32%, var(--white));
    border-color: var(--c-yellow-bd);
    color: var(--c-yellow-tx);
  }
  .tg-event--yellow:hover {
    background: color-mix(in srgb, var(--c-yellow-bg) 55%, var(--white));
  }

  .tg-event--purple,
  .tg-chip--purple {
    background: color-mix(in srgb, var(--c-purple-bg) 32%, var(--white));
    border-color: var(--c-purple-bd);
    color: var(--c-purple-tx);
  }
  .tg-event--purple:hover {
    background: color-mix(in srgb, var(--c-purple-bg) 55%, var(--white));
  }

  .tg-event--green,
  .tg-chip--green {
    background: color-mix(in srgb, var(--c-green-bg) 32%, var(--white));
    border-color: var(--c-green-bd);
    color: var(--c-green-tx);
  }
  .tg-event--green:hover {
    background: color-mix(in srgb, var(--c-green-bg) 55%, var(--white));
  }

  .tg-event--red,
  .tg-chip--red {
    background: color-mix(in srgb, var(--c-red-bg) 32%, var(--white));
    border-color: var(--c-red-bd);
    color: var(--c-red-tx);
  }
  .tg-event--red:hover {
    background: color-mix(in srgb, var(--c-red-bg) 55%, var(--white));
  }

  .tg-event--pink,
  .tg-chip--pink {
    background: color-mix(in srgb, var(--c-pink-bg) 32%, var(--white));
    border-color: var(--c-pink-bd);
    color: var(--c-pink-tx);
  }
  .tg-event--pink:hover {
    background: color-mix(in srgb, var(--c-pink-bg) 55%, var(--white));
  }

  .tg-event--indigo,
  .tg-chip--indigo {
    background: color-mix(in srgb, var(--c-indigo-bg) 32%, var(--white));
    border-color: var(--c-indigo-bd);
    color: var(--c-indigo-tx);
  }
  .tg-event--indigo:hover {
    background: color-mix(in srgb, var(--c-indigo-bg) 55%, var(--white));
  }

  .tg-event--cyan,
  .tg-chip--cyan {
    background: color-mix(in srgb, var(--c-cyan-bg) 32%, var(--white));
    border-color: var(--c-cyan-bd);
    color: var(--c-cyan-tx);
  }
  .tg-event--cyan:hover {
    background: color-mix(in srgb, var(--c-cyan-bg) 55%, var(--white));
  }

  .tg-event--teal,
  .tg-chip--teal {
    background: color-mix(in srgb, var(--c-teal-bg) 32%, var(--white));
    border-color: var(--c-teal-bd);
    color: var(--c-teal-tx);
  }
  .tg-event--teal:hover {
    background: color-mix(in srgb, var(--c-teal-bg) 55%, var(--white));
  }

  /* ── Now line ───────────────────────────────────────────────────────────── */
  .tg-now {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--orange);
    z-index: 5;
    pointer-events: none;
  }

  .tg-now__dot {
    position: absolute;
    left: -5px;
    top: -4px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--orange);
  }

  .tg-now__label {
    position: absolute;
    right: 6px;
    top: -18px;
    padding: 2px 6px;
    border-radius: 5px;
    background: var(--orange);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.3px;
    line-height: 1.3;
  }

  /* ── FAB ────────────────────────────────────────────────────────────────── */
  .tg-fab {
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
      transform 0.14s,
      filter 0.18s;
    z-index: 200;
  }

  .tg-fab:hover {
    filter: brightness(0.95);
    transform: scale(1.07);
  }

  .tg-fab:active {
    transform: scale(0.96);
  }

  /* ── Scrollbars ─────────────────────────────────────────────────────────── */
  .tg-body::-webkit-scrollbar,
  .tg-allday__cell::-webkit-scrollbar {
    width: 6px;
  }

  .tg-body::-webkit-scrollbar-track,
  .tg-allday__cell::-webkit-scrollbar-track {
    background: transparent;
  }

  .tg-body::-webkit-scrollbar-thumb,
  .tg-allday__cell::-webkit-scrollbar-thumb {
    background: var(--border-strong);
    border-radius: 99px;
  }

  .tg-body::-webkit-scrollbar-thumb:hover,
  .tg-allday__cell::-webkit-scrollbar-thumb:hover {
    background: var(--text-3);
  }

  /* ── Responsive ─────────────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    :host {
      --gutter-w: 46px;
    }

    .tg-gutter__mark {
      font-size: 10px;
      padding-right: 6px;
    }

    .tg-head__num {
      min-width: 22px;
      height: 22px;
      font-size: 13px;
    }

    .tg-event {
      padding: 3px 5px;
      border-left-width: 3px;
    }

    .tg-event__title {
      font-size: 11px;
    }

    .tg-event__time {
      font-size: 9.5px;
    }

    .tg-fab {
      width: 42px;
      height: 42px;
      bottom: 12px;
      right: 16px;
    }

    .tg-fab svg {
      width: 18px;
      height: 18px;
    }
  }
`;
