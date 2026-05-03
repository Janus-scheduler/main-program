import {
  Component,
  output,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  viewChild,
  ChangeDetectionStrategy,
} from "@angular/core";
// Side-effect import: ensures the <janus-month-grid> custom element is registered
import { JanusMonthGrid } from "@janus-scheduler/ui";
// Ensure the class is not dropped
const _ = JanusMonthGrid;
import type { TimelineEvent } from "@janus-scheduler/ui";
import { schedulerStore } from "@janus-scheduler/core";

/**
 * MonthGridComponent
 *
 * Thin Angular standalone wrapper around the `<janus-month-grid>` Lit web
 * component from @janus-scheduler/ui.
 *
 * Instead of relying on the web component's own store subscription (which may
 * use a different bundled store instance), this wrapper subscribes to the
 * Zustand store directly and pushes mapped events into the element — the same
 * pattern used by TimelineComponent.
 */
@Component({
  selector: "janus-month-grid-ng",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <janus-month-grid #monthGridEl></janus-month-grid>`,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class MonthGridComponent implements AfterViewInit, OnDestroy {
  private readonly _elRef =
    viewChild.required<ElementRef<HTMLElement>>("monthGridEl");

  /** Emitted when an event chip is clicked */
  readonly eventClick = output<TimelineEvent>();

  /** Emitted when a day cell is clicked */
  readonly dayClick = output<{ date: string }>();

  /** Emitted when the "add event" FAB is clicked */
  readonly addEvent = output<void>();

  /** Emitted when the user switches between Timeline and Month views */
  readonly viewChange = output<{ view: "Timeline" | "Month" }>();

  private _unsubStore?: () => void;

  private _eventClickHandler = (e: Event) => {
    e.stopPropagation();
    this.eventClick.emit((e as CustomEvent).detail);
  };
  private _dayClickHandler = (e: Event) => {
    e.stopPropagation();
    this.dayClick.emit((e as CustomEvent).detail);
  };
  private _addEventHandler = (e: Event) => {
    e.stopPropagation();
    this.addEvent.emit();
  };
  private _viewChangeHandler = (e: Event) => {
    e.stopPropagation();
    this.viewChange.emit((e as CustomEvent).detail);
  };

  ngAfterViewInit(): void {
    const el = this._elRef().nativeElement;
    el.addEventListener("event-click", this._eventClickHandler);
    el.addEventListener("day-click", this._dayClickHandler);
    el.addEventListener("add-event", this._addEventHandler);
    el.addEventListener("view-change", this._viewChangeHandler);

    // Subscribe to the Zustand store and push events into the web component.
    // This guarantees the correct store instance is used, regardless of how
    // Angular bundles the packages.
    this._subscribeToStore();
  }

  ngOnDestroy(): void {
    const el = this._elRef()?.nativeElement;
    el?.removeEventListener("event-click", this._eventClickHandler);
    el?.removeEventListener("day-click", this._dayClickHandler);
    el?.removeEventListener("add-event", this._addEventHandler);
    el?.removeEventListener("view-change", this._viewChangeHandler);
    this._unsubStore?.();
  }

  private _subscribeToStore(): void {
    // Immediately sync with current state
    this._pushStoreToElement(schedulerStore.getState());

    // Subscribe to all future updates
    this._unsubStore = schedulerStore.subscribe((state) => {
      this._pushStoreToElement(state);
    });
  }

  private _pushStoreToElement(
    state: ReturnType<typeof schedulerStore.getState>,
  ): void {
    const el = this._elRef()?.nativeElement as
      | (HTMLElement & { events: any[] })
      | undefined;
    if (!el) return;

    const coreEvents = Object.values(state.events) as any[];

    // Map core EventData → MonthEvent shape (same logic as janus-month-grid._syncFromStore)
    const mapped = coreEvents.map((e: any) => {
      const startD = new Date(e.startTime);
      const endD = new Date(e.endTime);
      const pad = (n: number) => n.toString().padStart(2, "0");
      // Use LOCAL date so the event.date matches the calendar cell's dateStr
      const localDate = `${startD.getFullYear()}-${pad(startD.getMonth() + 1)}-${pad(startD.getDate())}`;
      return {
        id: e.id,
        title: e.title,
        color: "blue",
        date: localDate,
        startTime: `${pad(startD.getUTCHours())}:${pad(startD.getUTCMinutes())}`,
        endTime: `${pad(endD.getUTCHours())}:${pad(endD.getUTCMinutes())}`,
      };
    });

    el.events = mapped;
  }
}
