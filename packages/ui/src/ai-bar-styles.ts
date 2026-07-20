import { css } from "lit";

export const aiBarStyles = css`
  :host {
    --white: #ffffff;
    --bg: #f4f4f5;
    --border: #e4e4e7;
    --text-1: #18181b;
    --text-3: #a1a1aa;
    --primary: var(--janus-primary-color, #3b82f6);
    --primary: #f97316;
    --aicard-area-h: 60px;

    display: flex;
    flex-direction: column;
    justify-content: center;
    height: var(--aicard-area-h);
    min-height: var(--aicard-area-h);
    padding: 0 24px;
    background: var(--bg);
    width: 100%;
    box-sizing: border-box;
  }

  .ai-bar-drag-handle {
    display: none;
  }

  .ai-card {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--white);
    border: 1.5px solid var(--border);
    border-radius: 14px;
    padding: 6px 12px;
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.08),
      0 1px 4px rgba(0, 0, 0, 0.04);
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .ai-card:focus-within {
    border-color: var(--primary);
    box-shadow:
      0 4px 20px var(--janus-primary-glow, rgba(249, 115, 22, 0.12)),
      0 0 0 3px var(--janus-primary-glow, rgba(249, 115, 22, 0.08));
  }

  .ai-card__input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    font-family: inherit;
    font-size: 14px;
    color: var(--text-1);
    background: transparent;
  }

  .ai-card__input::placeholder {
    color: var(--text-3);
  }

  .ai-card__btn {
    padding: 6px 18px;
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: 9px;
    font-family: "DM Sans", sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    box-shadow: 0 2px 8px var(--janus-primary-glow, rgba(249, 115, 22, 0.3));
    transition:
      background 0.15s,
      transform 0.12s,
      filter 0.15s;
  }

  .ai-card__btn:hover {
    filter: brightness(0.95);
  }

  .ai-card__btn:active {
    transform: scale(0.97);
  }

  .ai-card__icon-desktop {
    display: flex;
    align-items: center;
    color: var(--primary);
  }

  .ai-card__icon-mobile {
    display: none;
    align-items: center;
    color: var(--text-2);
  }

  .ai-card__btn-icon {
    display: none;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 640px) {
    :host {
      --aicard-area-h: 90px;
      padding: 8px 16px 16px;
      border-top: 1px solid var(--border);
    }

    .ai-bar-drag-handle {
      display: block;
      width: 36px;
      height: 6px;
      background: #d4d4d8;
      border-radius: 4px;
      margin: 0 auto 12px;
    }

    .ai-card {
      border-radius: 9999px; /* Pill shape */
      padding: 6px 6px 6px 16px; /* Less padding on right for the circle button */
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
      gap: 8px;
    }

    .ai-card__icon-desktop {
      display: none;
    }

    .ai-card__icon-mobile {
      display: flex;
    }

    .ai-card__input {
      font-size: 13px;
    }

    .ai-card__input::placeholder {
      font-size: 13px;
      color: var(--text-3);
    }

    .ai-card__btn {
      padding: 0;
      width: 40px;
      height: 40px;
      border-radius: 50%; /* Circle button */
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ai-card__btn-text {
      display: none;
    }

    .ai-card__btn-icon {
      display: flex;
    }
  }
`;
