import {
  Component,
  output,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  input,
  viewChild,
  ChangeDetectionStrategy,
} from "@angular/core";
import { JanusMonthGrid } from "@janus-scheduler/ui";
const _ = JanusMonthGrid;

import type { TimelineEvent } from "@janus-scheduler/ui";
import { schedulerStore } from "@janus-scheduler/core";

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
export class MonthGridComponent implements AfterViewInit, OnDestroy, OnChanges {
  private readonly _elRef =
    viewChild.required<ElementRef<HTMLElement>>("monthGridEl");

  readonly events = input<TimelineEvent[] | undefined>(undefined);

  readonly eventClick = output<TimelineEvent>();
  readonly dayClick = output<{ date: string }>();
  readonly addEvent = output<void>();
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

    if (this.events() !== undefined) {
      this._syncEvents();
    } else {
      this._subscribeToStore();
    }
  }

  ngOnChanges(): void {
    this._syncEvents();
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
    this._pushStoreToElement(schedulerStore.getState());
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
    if (coreEvents.length === 0) return;

    const mapped = coreEvents.map((e) => {
      const startD = new Date(e.startTime);
      const endD = new Date(e.endTime);
      const pad = (n: number) => n.toString().padStart(2, "0");
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

  private _syncEvents(): void {
    const data = this.events();
    if (!data) return;
    const el = this._elRef()?.nativeElement as
      | (HTMLElement & { events: any[] })
      | undefined;
    if (el) {
      el.events = data;
    }
  }
}
