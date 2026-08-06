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
  Directive,
} from "@angular/core";
// Side-effect imports: ensure the custom elements are registered
import { JanusDayGrid, JanusWeekGrid } from "@janus-scheduler/ui";
// Ensure the classes are not dropped
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _dg = JanusDayGrid;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _wg = JanusWeekGrid;
import type {
  TimeGridEvent,
  SlotSelectDetail,
  TimeGridEventMoveDetail,
  TimeGridEventResizeDetail,
  ViewType,
} from "@janus-scheduler/core";

/**
 * Shared adapter for the two hour-grid web components.
 *
 * `<janus-day-grid>` and `<janus-week-grid>` expose an identical prop and event
 * surface, so `DayGridComponent` and `WeekGridComponent` differ only in which
 * element their template renders.
 */
@Directive()
export abstract class TimeGridBaseComponent
  implements AfterViewInit, OnDestroy, OnChanges
{
  protected abstract get elRef(): ElementRef<HTMLElement>;

  /** Externally supplied events. Omit to read from the shared store. */
  readonly events = input<TimeGridEvent[] | undefined>(undefined);

  /** When true, renders a + Floating Action Button */
  readonly showFab = input<boolean>(false);

  /** Emit `slotSelect` when an empty slot is clicked. Default: true */
  readonly allowCreate = input<boolean>(true);

  /** First hour rendered (0–23). Default: 0 */
  readonly startHour = input<number>(0);

  /** Last hour rendered, exclusive (1–24). Default: 24 */
  readonly endHour = input<number>(24);

  /** Granularity of click-to-create, in minutes. Default: 30 */
  readonly slotMinutes = input<number>(30);

  /** Duration applied to a slot selection, in minutes. Default: 60 */
  readonly defaultDuration = input<number>(60);

  /** Hour scrolled into view on first paint. Default: 8 */
  readonly scrollToHour = input<number>(8);

  /** First day of the week — 0 = Sunday, 1 = Monday. Default: 1 */
  readonly weekStartsOn = input<number>(1);

  readonly eventClick = output<TimeGridEvent>();
  readonly dayClick = output<{ date: string }>();
  readonly slotSelect = output<SlotSelectDetail>();
  readonly eventMove = output<TimeGridEventMoveDetail>();
  readonly eventResize = output<TimeGridEventResizeDetail>();
  readonly addEvent = output<void>();
  readonly viewChange = output<{ view: ViewType }>();
  readonly navChange = output<Record<string, unknown>>();

  private readonly _eventClickHandler = (e: Event) => {
    e.stopPropagation();
    this.eventClick.emit((e as CustomEvent).detail);
  };
  private readonly _dayClickHandler = (e: Event) => {
    e.stopPropagation();
    this.dayClick.emit((e as CustomEvent).detail);
  };
  private readonly _slotSelectHandler = (e: Event) => {
    e.stopPropagation();
    this.slotSelect.emit((e as CustomEvent).detail);
  };
  private readonly _eventMoveHandler = (e: Event) => {
    e.stopPropagation();
    this.eventMove.emit((e as CustomEvent).detail);
  };
  private readonly _eventResizeHandler = (e: Event) => {
    e.stopPropagation();
    this.eventResize.emit((e as CustomEvent).detail);
  };
  private readonly _addEventHandler = (e: Event) => {
    e.stopPropagation();
    this.addEvent.emit();
  };
  private readonly _viewChangeHandler = (e: Event) => {
    e.stopPropagation();
    this.viewChange.emit((e as CustomEvent).detail);
  };
  private readonly _navChangeHandler = (e: Event) => {
    e.stopPropagation();
    this.navChange.emit((e as CustomEvent).detail);
  };

  // ── Imperative navigation — mirrors the web component's public API ──

  private _call(method: string, ...args: unknown[]): void {
    const el = this.elRef?.nativeElement as unknown as Record<
      string,
      (...a: unknown[]) => void
    >;
    el?.[method]?.(...args);
  }

  public goToPrev(): void {
    this._call("goToPrev");
  }

  public goToNext(): void {
    this._call("goToNext");
  }

  public goToToday(): void {
    this._call("goToToday");
  }

  public goToDate(date: string | number | Date): void {
    this._call("goToDate", date);
  }

  public setView(view: ViewType): void {
    this._call("setView", view);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    const el = this.elRef.nativeElement;
    el.addEventListener("event-click", this._eventClickHandler);
    el.addEventListener("day-click", this._dayClickHandler);
    el.addEventListener("slot-select", this._slotSelectHandler);
    el.addEventListener("event-move", this._eventMoveHandler);
    el.addEventListener("event-resize", this._eventResizeHandler);
    el.addEventListener("add-event", this._addEventHandler);
    el.addEventListener("view-change", this._viewChangeHandler);
    el.addEventListener("nav-change", this._navChangeHandler);

    this._syncProps();
  }

  ngOnChanges(): void {
    this._syncProps();
  }

  ngOnDestroy(): void {
    const el = this.elRef?.nativeElement;
    el?.removeEventListener("event-click", this._eventClickHandler);
    el?.removeEventListener("day-click", this._dayClickHandler);
    el?.removeEventListener("slot-select", this._slotSelectHandler);
    el?.removeEventListener("event-move", this._eventMoveHandler);
    el?.removeEventListener("event-resize", this._eventResizeHandler);
    el?.removeEventListener("add-event", this._addEventHandler);
    el?.removeEventListener("view-change", this._viewChangeHandler);
    el?.removeEventListener("nav-change", this._navChangeHandler);
  }

  private _syncProps(): void {
    const el = this.elRef?.nativeElement as
      | (HTMLElement & Record<string, unknown>)
      | undefined;
    if (!el) return;

    // `events` stays undefined unless the host supplies it, so the web
    // component keeps its own store subscription.
    if (this.events() !== undefined) el["events"] = this.events();

    el["showFab"] = this.showFab();
    el["allowCreate"] = this.allowCreate();
    el["startHour"] = this.startHour();
    el["endHour"] = this.endHour();
    el["slotMinutes"] = this.slotMinutes();
    el["defaultDuration"] = this.defaultDuration();
    el["scrollToHour"] = this.scrollToHour();
    el["weekStartsOn"] = this.weekStartsOn();
  }
}

/**
 * `<janus-day-grid-ng>` — a single day on an hour grid.
 */
@Component({
  selector: "janus-day-grid-ng",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <janus-day-grid #gridEl></janus-day-grid>`,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class DayGridComponent extends TimeGridBaseComponent {
  private readonly _gridEl =
    viewChild.required<ElementRef<HTMLElement>>("gridEl");

  protected get elRef(): ElementRef<HTMLElement> {
    return this._gridEl();
  }
}

/**
 * `<janus-week-grid-ng>` — seven days on one hour grid.
 */
@Component({
  selector: "janus-week-grid-ng",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <janus-week-grid #gridEl></janus-week-grid>`,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class WeekGridComponent extends TimeGridBaseComponent {
  private readonly _gridEl =
    viewChild.required<ElementRef<HTMLElement>>("gridEl");

  protected get elRef(): ElementRef<HTMLElement> {
    return this._gridEl();
  }
}
