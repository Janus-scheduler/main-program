import { css } from "lit";

export const yearGridStyles = css`
  /* ── Design tokens ── */
  :host {
    --white: #ffffff;
    --bg: #ffffff; /* Mockup shows a white background */
    --border: #e4e4e7;
    --text-1: #18181b;
    --text-2: #71717a;
    --text-3: #a1a1aa;
    --orange: var(--janus-primary-color, #f97316);

    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    width: 100%;
    background: var(--bg);
    font-family: "DM Sans", sans-serif;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  .yg-container {
    padding: 12px 16px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    /* Desktop: 4 columns. */
    grid-template-columns: repeat(4, 1fr);
    column-gap: 16px;
    row-gap: 16px;
    align-content: start;
  }

  @media (max-width: 1024px) {
    .yg-container {
      grid-template-columns: repeat(3, 1fr);
      padding: 12px;
      column-gap: 12px;
      row-gap: 16px;
    }
  }

  @media (max-width: 768px) {
    .yg-container {
      grid-template-columns: repeat(2, 1fr);
      padding: 8px;
      column-gap: 8px;
      row-gap: 16px;
    }
  }

  @media (max-width: 480px) {
    .yg-container {
      grid-template-columns: 1fr;
      padding: 8px;
      row-gap: 16px;
    }
  }

  /* Month Card */
  .yg-month-card {
    display: flex;
    flex-direction: column;
    background: transparent;
  }

  .yg-month-header {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-1);
    margin-bottom: 4px;
    padding-left: 4px;
  }

  .yg-month-header--current {
    color: var(--orange);
  }

  /* Day Grid */
  .yg-day-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    row-gap: 1px;
  }

  /* Weekday Header */
  .yg-weekday {
    text-align: center;
    font-size: 9px;
    font-weight: 600;
    color: var(--text-3);
    margin-bottom: 2px;
  }

  /* Day Cell */
  .yg-day-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    height: 20px;
    cursor: pointer;
    border-radius: 4px;
    transition: background-color 0.15s ease;
    position: relative;
  }

  .yg-day-cell:hover {
    background-color: #f4f4f5;
  }

  .yg-day-cell:focus-visible {
    outline: 2px solid var(--orange);
    outline-offset: 1px;
  }

  .yg-day-cell--empty {
    visibility: hidden;
    pointer-events: none;
  }

  .yg-day-number {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-2);
    height: 18px;
    width: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .yg-day-cell:hover .yg-day-number {
    color: var(--text-1);
  }

  .yg-day-number--today {
    background: var(--orange);
    color: var(--white) !important;
    font-weight: 600;
  }

  /* Density Dot */
  .yg-density-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--orange);
    position: absolute;
    bottom: 2px;
  }

  .yg-density-dot--today {
    background: var(--white);
  }
`;
