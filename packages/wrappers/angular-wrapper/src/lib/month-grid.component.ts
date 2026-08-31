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
// Side-effect import: ensures the <janus-month-grid> custom element is registered
import { JanusMonthGrid } from "@janus-scheduler/ui";
// Ensure the class is not dropped
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _mg = JanusMonthGrid;
import {
  schedulerStore,
  isoToZonedDisplay,
  type TimelineEvent,
} from "@janus-scheduler/core";

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

  /** When true, renders a + Floating Action Button */
  readonly showFab = input<boolean>(false);

  /** Explicit display timezone */
  readonly timezone = input<string | undefined>(undefined);

  readonly eventClick = output<TimelineEvent>();
  readonly dayClick = output<{ date: string }>();
  readonly addEvent = output<void>();
  readonly viewChange = output<{ view: "Timeline" | "Month" }>();
  readonly navChange = output<Record<string, unknown>>();

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
  private _navChangeHandler = (e: Event) => {
    e.stopPropagation();
    this.navChange.emit((e as CustomEvent).detail);
  };

  public goToPrev(): void {
    (
      this._elRef().nativeElement as HTMLElement & { goToPrev: () => void }
    ).goToPrev();
  }

  public goToNext(): void {
    (
      this._elRef().nativeElement as HTMLElement & { goToNext: () => void }
    ).goToNext();
  }

  public goToToday(): void {
    (
      this._elRef().nativeElement as HTMLElement & { goToToday: () => void }
    ).goToToday();
  }

  public setView(view: "Timeline" | "Month"): void {
    (
      this._elRef().nativeElement as HTMLElement & {
        setView: (v: string) => void;
      }
    ).setView(view);
  }

  ngAfterViewInit(): void {
    const el = this._elRef().nativeElement;
    el.addEventListener("event-click", this._eventClickHandler);
    el.addEventListener("day-click", this._dayClickHandler);
    el.addEventListener("add-event", this._addEventHandler);
    el.addEventListener("view-change", this._viewChangeHandler);
    el.addEventListener("nav-change", this._navChangeHandler);
    this._syncProps();
    this._syncEvents();
    this._subscribeToStore();
  }

  ngOnChanges(): void {
    this._syncEvents();
    this._syncProps();
  }

  private _syncProps(): void {
    const el = this._elRef()?.nativeElement as
      | (HTMLElement & { showFab: boolean; timezone?: string })
      | undefined;
    if (el) {
      el.showFab = this.showFab();
      if (this.timezone() !== undefined) el.timezone = this.timezone();
    }
  }

  ngOnDestroy(): void {
    const el = this._elRef()?.nativeElement;
    el?.removeEventListener("event-click", this._eventClickHandler);
    el?.removeEventListener("day-click", this._dayClickHandler);
    el?.removeEventListener("add-event", this._addEventHandler);
    el?.removeEventListener("view-change", this._viewChangeHandler);
    el?.removeEventListener("nav-change", this._navChangeHandler);
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
      | (HTMLElement & { events: unknown[] })
      | undefined;
    if (!el) return;

    const coreEvents = Object.values(state.events) as Array<{
      id: string;
      title: string;
      startTime: string;
      endTime: string;
    }>;
    if (coreEvents.length === 0) return;

    const tz = state.timezone;
    const mapped = coreEvents.map((e) => {
      const { date: localDate, time: startTime } = isoToZonedDisplay(
        e.startTime,
        tz,
      );
      const { time: endTime } = isoToZonedDisplay(e.endTime, tz);
      return {
        id: e.id,
        title: e.title,
        color: "blue",
        date: localDate,
        startTime,
        endTime,
      };
    });

    el.events = mapped;
  }

  private _syncEvents(): void {
    const data = this.events();
    if (!data) return;
    const el = this._elRef()?.nativeElement as
      | (HTMLElement & { events: unknown[] })
      | undefined;
    if (el) {
      el.events = data;
    }
  }
}
