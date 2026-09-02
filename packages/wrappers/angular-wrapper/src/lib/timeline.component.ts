import {
  Component,
  input,
  output,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  viewChild,
  ChangeDetectionStrategy,
} from "@angular/core";
// Side-effect import: ensures the <janus-timeline> custom element is registered
import { JanusTimeline } from "@janus-scheduler/ui";
// Ensure the class is not dropped
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ = JanusTimeline;
import type {
  TimelineResource,
  TimelineEvent,
  EventMoveDetail,
  EventResizeDetail,
  EventCreateDetail,
  ViewType,
  ResourceTypeConfig,
  TimelineResourceClickDetail,
  TimelineHeaderDateClickDetail,
  TimelineConflictClickDetail,
} from "./types";

/**
 * TimelineComponent
 *
 * Thin Angular standalone wrapper around the `<janus-timeline>` Lit web
 * component from @janus-scheduler/ui. This keeps the Angular wrapper
 * fully framework-agnostic — the UI is rendered by the shared web component.
 *
 * @example
 * ```html
 * <janus-timeline-ng
 *   [resources]="myResources"
 *   (eventClick)="onEventClick($event)"
 *   (addEvent)="onAddEvent()" />
 * ```
 */
@Component({
  selector: "janus-timeline-ng",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <janus-timeline #timelineEl></janus-timeline>`,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class TimelineComponent implements AfterViewInit, OnDestroy, OnChanges {
  private readonly _elRef =
    viewChild.required<ElementRef<HTMLElement>>("timelineEl");

  /** Timeline resource data to display — leave unset to use built-in sample data */
  readonly resources = input<TimelineResource[] | undefined>(undefined);

  /** Custom resource type mapping config */
  readonly resourceTypeConfig = input<ResourceTypeConfig | undefined>(
    undefined,
  );

  /** When true, dragging on empty row space creates a new event */
  readonly allowCreate = input<boolean>(false);

  /** When true, renders a + Floating Action Button */
  readonly showFab = input<boolean>(false);

  /** When true, resource conflicts/double-bookings are strictly blocked */
  readonly preventConflicts = input<boolean>(false);

  /** Explicit display timezone */
  readonly timezone = input<string | undefined>(undefined);

  /** Emitted when an event is clicked */
  readonly eventClick = output<TimelineEvent>();

  /** Emitted when the "add event" FAB is clicked */
  readonly addEvent = output<void>();

  /** Emitted when an event is moved via drag-and-drop */
  readonly eventMove = output<EventMoveDetail>();

  /** Emitted when an event is resized via drag */
  readonly eventResize = output<EventResizeDetail>();

  /** Emitted when a new event is created by dragging on empty space */
  readonly eventCreate = output<EventCreateDetail>();

  /** Emitted when the user toggles the view */
  readonly viewChange = output<{ view: ViewType }>();

  /** Emitted when the date/zoom nav state changes */
  readonly navChange = output<Record<string, unknown>>();

  /** Emitted when a resource row/card in the left column is clicked */
  readonly resourceClick = output<TimelineResourceClickDetail>();

  /** Emitted when a super-header date on the time ruler is clicked */
  readonly headerDateClick = output<TimelineHeaderDateClickDetail>();

  /** Emitted when a conflict warning banner or badge is clicked */
  readonly conflictClick = output<TimelineConflictClickDetail>();

  /** Emitted when a resource conflict is detected */
  readonly conflictDetected = output<{
    message: string;
    action: string;
    detail: EventMoveDetail | EventResizeDetail | EventCreateDetail;
  }>();

  private _unsubStore?: () => void;

  private _eventClickHandler = (e: Event) => {
    e.stopPropagation();
    this.eventClick.emit((e as CustomEvent).detail);
  };
  private _addEventHandler = (e: Event) => {
    e.stopPropagation();
    this.addEvent.emit();
  };
  private _emitWithConflictBypass<T>(
    output: { emit: (val: T) => void },
    event: Event,
  ) {
    const detail = (event as CustomEvent).detail;
    if (this.preventConflicts() && detail.hasConflict) {
      return;
    }
    output.emit(detail);
  }

  private _eventMoveHandler = (e: Event) => {
    e.stopPropagation();
    this._emitWithConflictBypass(this.eventMove, e);
  };
  private _eventResizeHandler = (e: Event) => {
    e.stopPropagation();
    this._emitWithConflictBypass(this.eventResize, e);
  };
  private _eventCreateHandler = (e: Event) => {
    e.stopPropagation();
    this._emitWithConflictBypass(this.eventCreate, e);
  };
  private _viewChangeHandler = (e: Event) => {
    e.stopPropagation();
    this.viewChange.emit((e as CustomEvent).detail);
  };
  private _navChangeHandler = (e: Event) => {
    e.stopPropagation();
    this.navChange.emit((e as CustomEvent).detail);
  };
  private _resourceClickHandler = (e: Event) => {
    e.stopPropagation();
    this.resourceClick.emit((e as CustomEvent).detail);
  };
  private _headerDateClickHandler = (e: Event) => {
    e.stopPropagation();
    this.headerDateClick.emit((e as CustomEvent).detail);
  };
  private _conflictClickHandler = (e: Event) => {
    e.stopPropagation();
    this.conflictClick.emit((e as CustomEvent).detail);
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

  public goToDate(date: string | number | Date): void {
    (
      this._elRef().nativeElement as HTMLElement & {
        goToDate: (d: string | number | Date) => void;
      }
    ).goToDate(date);
  }

  public setView(view: ViewType): void {
    (
      this._elRef().nativeElement as HTMLElement & {
        setView: (v: string) => void;
      }
    ).setView(view);
  }

  public toggleCreate(): void {
    (
      this._elRef().nativeElement as HTMLElement & { toggleCreate: () => void }
    ).toggleCreate();
  }
  private _conflictDetectedHandler = (e: Event) => {
    e.stopPropagation();
    this.conflictDetected.emit((e as CustomEvent).detail);
  };

  ngAfterViewInit(): void {
    const el = this._elRef().nativeElement;
    el.addEventListener("event-click", this._eventClickHandler);
    el.addEventListener("add-event", this._addEventHandler);
    el.addEventListener("event-move", this._eventMoveHandler);
    el.addEventListener("event-resize", this._eventResizeHandler);
    el.addEventListener("event-create", this._eventCreateHandler);
    el.addEventListener("view-change", this._viewChangeHandler);
    el.addEventListener("nav-change", this._navChangeHandler);
    el.addEventListener("conflict-detected", this._conflictDetectedHandler);
    el.addEventListener("resource-click", this._resourceClickHandler);
    el.addEventListener("header-date-click", this._headerDateClickHandler);
    el.addEventListener("conflict-click", this._conflictClickHandler);

    this._applyAllowCreate();

    // If an explicit resources input is provided, use it directly.
    // The web component natively subscribes to the Zustand store internally,
    // so we don't need to do it here.
    if (this.resources() !== undefined) {
      this._syncResources();
    }

    // Pass config if provided
    this._syncConfig();
  }

  ngOnChanges(): void {
    this._syncResources();
    this._syncConfig();
    this._applyAllowCreate();
  }

  ngOnDestroy(): void {
    const el = this._elRef()?.nativeElement;
    el?.removeEventListener("event-click", this._eventClickHandler);
    el?.removeEventListener("add-event", this._addEventHandler);
    el?.removeEventListener("event-move", this._eventMoveHandler);
    el?.removeEventListener("event-resize", this._eventResizeHandler);
    el?.removeEventListener("event-create", this._eventCreateHandler);
    el?.removeEventListener("view-change", this._viewChangeHandler);
    el?.removeEventListener("nav-change", this._navChangeHandler);
    el?.removeEventListener("conflict-detected", this._conflictDetectedHandler);
    el?.removeEventListener("resource-click", this._resourceClickHandler);
    el?.removeEventListener("header-date-click", this._headerDateClickHandler);
    el?.removeEventListener("conflict-click", this._conflictClickHandler);
    this._unsubStore?.();
  }

  private _syncConfig(): void {
    const config = this.resourceTypeConfig();
    if (!config) return;
    type TimelineElement = HTMLElement & {
      resourceTypeConfig: ResourceTypeConfig;
    };
    const el = this._elRef()?.nativeElement as TimelineElement | undefined;
    if (el) {
      el.resourceTypeConfig = config;
    }
  }

  private _syncResources(): void {
    const data = this.resources();
    if (!data) return;
    const el = this._elRef()?.nativeElement as
      (HTMLElement & { resources: TimelineResource[] }) | undefined;
    if (el) {
      el.resources = data;
    }
  }

  private _applyAllowCreate(): void {
    const el = this._elRef()?.nativeElement as
      | (HTMLElement & {
          allowCreate: boolean;
          showFab: boolean;
          preventConflicts: boolean;
          timezone?: string;
        })
      | undefined;
    if (el) {
      el.allowCreate = this.allowCreate();
      el.showFab = this.showFab();
      el.preventConflicts = this.preventConflicts();
      if (this.timezone() !== undefined) el.timezone = this.timezone();
    }
  }
}
