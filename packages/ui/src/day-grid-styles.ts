import { css } from "lit";
import { timeGridStyles } from "./time-grid-styles";

/**
 * `<janus-day-grid>` styles — the shared hour-grid sheet plus the single-column
 * specifics (52px hour rows, per the design spec) and the mobile day strip.
 */
export const dayGridStyles = [
  timeGridStyles,
  css`
    :host {
      --gutter-w: 64px;
      --hour-h: 52px;
    }

    /* ── Day header — the full weekday + date, left-aligned ── */
    .tg-head__cell {
      flex-direction: row;
      align-items: baseline;
      justify-content: flex-start;
      gap: 8px;
      padding: 10px 16px;
    }

    .tg-head__dow {
      font-size: 11px;
      letter-spacing: 0.7px;
    }

    .tg-head__num {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-1);
    }

    /* ── Mobile day strip — seven tappable days above the grid ── */
    .tg-strip {
      display: none;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      background: var(--white);
      flex-shrink: 0;
    }

    .tg-strip__day {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 7px 0;
      border: none;
      border-radius: 12px;
      background: transparent;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.12s;
    }

    .tg-strip__day:hover {
      background: var(--bg);
    }

    .tg-strip__dow {
      font-size: 9.5px;
      font-weight: 600;
      color: var(--text-3);
    }

    .tg-strip__num {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-1);
      line-height: 1;
    }

    .tg-strip__dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--janus-primary-color, #f97316);
    }

    .tg-strip__dot--empty {
      background: transparent;
    }

    .tg-strip__day--selected {
      background: var(--janus-primary-color, #f97316);
    }

    .tg-strip__day--selected .tg-strip__dow,
    .tg-strip__day--selected .tg-strip__num {
      color: #fff;
      font-weight: 700;
    }

    .tg-strip__day--selected .tg-strip__dot {
      background: #fff;
    }

    .tg-strip__day--selected .tg-strip__dot--empty {
      background: transparent;
    }

    .tg-strip__day--today:not(.tg-strip__day--selected) .tg-strip__num {
      color: var(--janus-primary-color, #f97316);
      font-weight: 700;
    }

    @media (max-width: 640px) {
      :host {
        --hour-h: 58px;
        /* The header row is hidden below, so the all-day row's sticky
           offset (top: var(--col-hdr-h)) must collapse to 0 with it —
           otherwise it sticks 56px below the top, leaving a blank gap
           where the (now-hidden) header used to be. */
        --col-hdr-h: 0px;
      }

      /* The strip replaces the single-column header on mobile */
      .tg-strip {
        display: grid;
      }

      .tg-head__corner,
      .tg-head__cell {
        display: none;
      }
    }
  `,
];
