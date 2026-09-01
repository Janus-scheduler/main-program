import { css } from "lit";

export const yearGridStyles = css`
  /* ── Design tokens ── */
  :host {
    --white: #ffffff;
    --bg: #ffffff;
    --border: #e4e4e7;
    --text-1: #18181b;
    --text-2: #71717a;
    --text-3: #a1a1aa;
    --orange: var(--janus-primary-color, #f97316);
    --orange-lt: var(--janus-primary-bg, #fff7ed);
    --today-bg: var(--janus-primary-bg, #fff7ed);

    /* Event colours — matching Timeline and Month */
    --c-primary-bd: var(--janus-primary-border, #f97316);
    --c-orange-bd: #f97316;
    --c-blue-bd: #0ea5e9;
    --c-yellow-bd: #f59e0b;
    --c-purple-bd: #8b5cf6;
    --c-green-bd: #10b981;
    --c-red-bd: #ef4444;
    --c-pink-bd: #ec4899;
    --c-indigo-bd: #6366f1;
    --c-cyan-bd: #06b6d4;
    --c-teal-bd: #14b8a6;

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
    padding: 16px 20px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    /* Desktop: 4 columns. */
    grid-template-columns: repeat(4, 1fr);
    column-gap: 20px;
    row-gap: 20px;
    align-content: start;
  }

  @media (max-width: 1024px) {
    .yg-container {
      grid-template-columns: repeat(3, 1fr);
      padding: 14px;
      column-gap: 14px;
      row-gap: 18px;
    }
  }

  @media (max-width: 768px) {
    .yg-container {
      grid-template-columns: repeat(2, 1fr);
      padding: 10px;
      column-gap: 10px;
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
    padding: 4px;
    border-radius: 8px;
    transition: background 0.12s;
  }

  .yg-month-header {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-1);
    margin-bottom: 6px;
    padding-left: 4px;
    letter-spacing: 0.2px;
  }

  .yg-month-header--current {
    color: var(--orange);
  }

  /* Day Grid */
  .yg-day-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    row-gap: 2px;
  }

  /* Weekday Header */
  .yg-weekday {
    text-align: center;
    font-size: 9.5px;
    font-weight: 600;
    color: var(--text-3);
    margin-bottom: 4px;
    letter-spacing: 0.4px;
  }

  /* Day Cell */
  .yg-day-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 24px;
    cursor: pointer;
    border-radius: 6px;
    transition: background-color 0.12s ease;
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
    font-size: 11px;
    font-weight: 500;
    color: var(--text-2);
    height: 20px;
    width: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition:
      background-color 0.12s ease,
      color 0.12s ease;
  }

  .yg-day-cell:hover .yg-day-number {
    color: var(--text-1);
  }

  .yg-day-number--today {
    background: var(--orange);
    color: var(--white) !important;
    font-weight: 700;
  }

  /* Density Dot */
  .yg-density-dot {
    width: 3.5px;
    height: 3.5px;
    border-radius: 50%;
    background: var(--orange);
    position: absolute;
    bottom: 1px;
    transition: transform 0.1s ease;
  }

  .yg-density-dot--today {
    background: var(--white);
    bottom: 2px;
  }

  .yg-density-dot--blue {
    background: var(--c-blue-bd);
  }
  .yg-density-dot--green {
    background: var(--c-green-bd);
  }
  .yg-density-dot--purple {
    background: var(--c-purple-bd);
  }
  .yg-density-dot--red {
    background: var(--c-red-bd);
  }
  .yg-density-dot--yellow {
    background: var(--c-yellow-bd);
  }
  .yg-density-dot--pink {
    background: var(--c-pink-bd);
  }
  .yg-density-dot--indigo {
    background: var(--c-indigo-bd);
  }
  .yg-density-dot--cyan {
    background: var(--c-cyan-bd);
  }
  .yg-density-dot--teal {
    background: var(--c-teal-bd);
  }
`;
