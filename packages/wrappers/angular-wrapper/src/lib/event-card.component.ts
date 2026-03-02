import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { JanusEventData, EventClickPayload, EventDeletePayload } from "./types";

/**
 * EventCardComponent
 *
 * Standalone component that renders a single scheduler event.
 * Framework-agnostic: it only knows about JanusEventData and emits
 * typed output events — no service dependency required.
 *
 * @example
 * <janus-event-card
 *   [event]="ev"
 *   [selected]="true"
 *   (eventClick)="onEventClick($event)"
 *   (eventDelete)="onEventDelete($event)" />
 */
@Component({
  selector: "janus-event-card",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="janus-event-card"
      [class]="'janus-event-card--' + event().status"
      [class.janus-event-card--selected]="selected()"
      (click)="handleClick($event)"
      role="button"
      [attr.aria-label]="event().title"
      tabindex="0"
      (keydown.enter)="handleClick($event)"
    >
      <div class="janus-event-card__header">
        <span class="janus-event-card__status-dot"></span>
        <span class="janus-event-card__title">{{ event().title }}</span>

        @if (showDelete()) {
          <button
            class="janus-event-card__delete"
            aria-label="Delete event"
            (click)="handleDelete($event)"
          >
            ✕
          </button>
        }
      </div>

      <div class="janus-event-card__meta">
        <span class="janus-event-card__time">
          {{ startFormatted() }} – {{ endFormatted() }}
        </span>
        @if (duration() >= 60) {
          <span class="janus-event-card__duration">
            ({{ durationLabel() }})
          </span>
        }
      </div>

      @if (event().description) {
        <p class="janus-event-card__description">{{ event().description }}</p>
      }

      <div class="janus-event-card__footer">
        <span
          class="janus-event-card__badge janus-event-card__badge--{{
            event().status
          }}"
        >
          {{ event().status }}
        </span>
      </div>
    </div>
  `,
  styles: [
    `
      .janus-event-card {
        background: var(--janus-event-bg, #e8f0fe);
        border-left: 4px solid var(--janus-event-accent, #4285f4);
        border-radius: 6px;
        padding: 8px 12px;
        cursor: pointer;
        transition:
          box-shadow 0.15s ease,
          transform 0.1s ease;
        font-family: var(--janus-font, inherit);
        position: relative;
        user-select: none;
      }
      .janus-event-card:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transform: translateY(-1px);
      }
      .janus-event-card--selected {
        outline: 2px solid var(--janus-event-accent, #4285f4);
        outline-offset: 2px;
      }
      .janus-event-card--confirmed {
        --janus-event-accent: #34a853;
        --janus-event-bg: #e6f4ea;
      }
      .janus-event-card--cancelled {
        --janus-event-accent: #ea4335;
        --janus-event-bg: #fce8e6;
        opacity: 0.7;
        text-decoration: line-through;
      }
      .janus-event-card__header {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .janus-event-card__status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--janus-event-accent, #4285f4);
        flex-shrink: 0;
      }
      .janus-event-card__title {
        font-weight: 600;
        font-size: 0.875rem;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .janus-event-card__delete {
        background: none;
        border: none;
        cursor: pointer;
        color: #999;
        padding: 0 2px;
        font-size: 0.75rem;
        line-height: 1;
        transition: color 0.1s;
      }
      .janus-event-card__delete:hover {
        color: #ea4335;
      }
      .janus-event-card__meta {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 4px;
      }
      .janus-event-card__time {
        font-size: 0.75rem;
        color: #555;
      }
      .janus-event-card__duration {
        font-size: 0.7rem;
        color: #888;
      }
      .janus-event-card__description {
        font-size: 0.75rem;
        color: #444;
        margin: 4px 0 0;
        overflow: hidden;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
      }
      .janus-event-card__footer {
        margin-top: 6px;
      }
      .janus-event-card__badge {
        font-size: 0.65rem;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background: var(--janus-event-accent, #4285f4);
        color: #fff;
      }
    `,
  ],
})
export class EventCardComponent {
  // ── Inputs ────────────────────────────────────────────────────────────────

  /** The event to render */
  readonly event = input.required<JanusEventData>();

  /** Whether this card is currently selected */
  readonly selected = input<boolean>(false);

  /** Whether to show the delete button */
  readonly showDelete = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────

  readonly eventClick = output<EventClickPayload>();
  readonly eventDelete = output<EventDeletePayload>();

  // ── Computed ─────────────────────────────────────────────────────────────

  readonly startFormatted = computed(() =>
    this._formatTime(this.event().startTime),
  );

  readonly endFormatted = computed(() =>
    this._formatTime(this.event().endTime),
  );

  readonly duration = computed(() => {
    const s = new Date(this.event().startTime).getTime();
    const e = new Date(this.event().endTime).getTime();
    return (e - s) / 60_000; // minutes
  });

  readonly durationLabel = computed(() => {
    const mins = this.duration();
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  handleClick(sourceEvent: Event): void {
    this.eventClick.emit({
      event: this.event(),
      sourceEvent: sourceEvent as MouseEvent,
    });
  }

  handleDelete(sourceEvent: MouseEvent): void {
    sourceEvent.stopPropagation();
    this.eventDelete.emit({ id: this.event().id });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
