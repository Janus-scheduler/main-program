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
} from "./types";
import { schedulerStore, isoToZonedDisplay } from "@janus-scheduler/core";

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

  /** When true, dragging on empty row space creates a new event */
  readonly allowCreate = input<boolean>(false);

  /** When true, resource conflicts/double-bookings are strictly blocked */
  readonly preventConflicts = input<boolean>(false);

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
  readonly viewChange = output<{ view: "Timeline" | "Month" }>();

  /** Emitted when the date/zoom nav state changes */
  readonly navChange = output<Record<string, unknown>>();
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

    this._applyAllowCreate();

    // If an explicit resources input is provided, use it directly.
    // Otherwise, subscribe to the Zustand store so the web component
    // stays in sync when data is seeded/mutated by the SchedulerManager.
    if (this.resources() !== undefined) {
      this._syncResources();
    } else {
      this._subscribeToStore();
    }
  }

  ngOnChanges(): void {
    this._syncResources();
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
    this._unsubStore?.();
  }

  private _subscribeToStore(): void {
    // Immediately sync with the current store state
    this._pushStoreToElement(schedulerStore.getState());

    // Subscribe to future changes
    this._unsubStore = schedulerStore.subscribe((state) => {
      this._pushStoreToElement(state);
    });
  }

  private _pushStoreToElement(
    state: ReturnType<typeof schedulerStore.getState>,
  ): void {
    const el = this._elRef()?.nativeElement as
      | (HTMLElement & { resources: TimelineResource[] })
      | undefined;
    if (!el) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resources = Object.values(state.resources) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = Object.values(state.events) as any[];

    if (resources.length === 0) return;

    const typeOrder: Record<string, number> = {
      person: 1,
      room: 2,
      equipment: 3,
    };
    const sorted = [...resources].sort(
      (a, b) =>
        (typeOrder[a.type || "person"] || 99) -
        (typeOrder[b.type || "person"] || 99),
    );

    let currentGroupType = "";
    const mapped: TimelineResource[] = sorted.map((res) => {
      const resEvents = events

        .filter(
          (
            e: TimelineEvent & { resourceIds?: string[]; resourceId?: string },
          ) =>
            (e.resourceIds && e.resourceIds.includes(res.id)) ||
            e.resourceId === res.id,
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((e: any) => {
          const startD = new Date(e.startTime);
          const endD = new Date(e.endTime);
          const tz = state.timezone;
          const { time: startTime } = isoToZonedDisplay(e.startTime, tz);
          const { time: endTime, date } = isoToZonedDisplay(e.endTime, tz);
          return {
            id: e.id,
            title: e.title,
            startTime,
            endTime,
            startMs: startD.getTime(),
            endMs: endD.getTime(),
            color: "blue" as const,
            date,
          };
        });

      let avatarType: "initials" | "icon" = "initials";
      let avatarIcon: "room" | "equipment" | undefined = undefined;
      let groupLabel: string | undefined = undefined;
      const type = res.type || "person";

      if (type !== currentGroupType) {
        currentGroupType = type;
        if (type === "person") groupLabel = "STAFF";
        else if (type === "room") groupLabel = "ROOMS";
        else if (type === "equipment") groupLabel = "EQUIPMENT";
      }

      if (type === "room") {
        avatarType = "icon";
        avatarIcon = "room";
      } else if (type === "equipment") {
        avatarType = "icon";
        avatarIcon = "equipment";
      }

      return {
        id: res.id,
        name: res.name,
        subtitle:
          type === "person"
            ? "Staff"
            : type === "room"
              ? "Facility"
              : "Equipment",
        avatarType,
        avatarIcon,
        groupLabel,
        events: resEvents,
      };
    });

    el.resources = mapped;
  }

  private _syncResources(): void {
    const data = this.resources();
    if (!data) return;
    const el = this._elRef()?.nativeElement as
      | (HTMLElement & { resources: TimelineResource[] })
      | undefined;
    if (el) {
      el.resources = data;
    }
  }

  private _applyAllowCreate(): void {
    const el = this._elRef()?.nativeElement as
      | (HTMLElement & { allowCreate: boolean; preventConflicts: boolean })
      | undefined;
    if (el) {
      el.allowCreate = this.allowCreate();
      el.preventConflicts = this.preventConflicts();
    }
  }
}
