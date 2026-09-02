import { css } from "lit";
import { timeGridStyles } from "./time-grid-styles";

/**
 * `<janus-week-grid>` styles — the shared hour-grid sheet plus the seven-column
 * specifics (44px hour rows, per the design spec).
 */
export const weekGridStyles = [
  timeGridStyles,
  css`
    :host {
      --gutter-w: 64px;
      --hour-h: 44px;
    }

    /* The day-number badge sits beside the weekday label on wide screens */
    .tg-head__cell {
      padding: 9px 8px;
    }

    /* Week columns get tighter event padding than the Day view */
    .tg-event {
      padding: 3px 6px;
      border-radius: 6px;
    }

    .tg-event__title {
      font-size: 11.5px;
    }

    .tg-event__time {
      font-size: 10px;
    }

    /*
     * Narrow screens render three day columns instead of seven (the component
     * drops the columns in JS); these rules just tighten the chrome to match.
     */
    @media (max-width: 640px) {
      :host {
        --hour-h: 56px;
      }

      .tg-head__cell {
        padding: 8px 4px;
        gap: 2px;
      }

      .tg-head__dow {
        font-size: 9.5px;
      }

      .tg-event {
        padding: 3px 4px;
        border-radius: 6px;
      }
    }
  `,
];
