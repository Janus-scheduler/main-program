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
const _ = JanusTimeline;
import type {
  TimelineResource,
  TimelineEvent,
  EventMoveDetail,
  EventResizeDetail,
  EventCreateDetail,
} from "@janus-scheduler/ui";
import { schedulerStore } from "@janus-scheduler/core";

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

  private _unsubStore?: () => void;

  private _eventClickHandler = (e: Event) => {
    e.stopPropagation();
    this.eventClick.emit((e as CustomEvent).detail);
  };
  private _addEventHandler = (e: Event) => {
    e.stopPropagation();
    this.addEvent.emit();
  };
  private _eventMoveHandler = (e: Event) => {
    e.stopPropagation();
    this.eventMove.emit((e as CustomEvent).detail);
  };
  private _eventResizeHandler = (e: Event) => {
    e.stopPropagation();
    this.eventResize.emit((e as CustomEvent).detail);
  };
  private _eventCreateHandler = (e: Event) => {
    e.stopPropagation();
    this.eventCreate.emit((e as CustomEvent).detail);
  };
  private _viewChangeHandler = (e: Event) => {
    e.stopPropagation();
    this.viewChange.emit((e as CustomEvent).detail);
  };

  ngAfterViewInit(): void {
    const el = this._elRef().nativeElement;
    el.addEventListener("event-click", this._eventClickHandler);
    el.addEventListener("add-event", this._addEventHandler);
    el.addEventListener("event-move", this._eventMoveHandler);
    el.addEventListener("event-resize", this._eventResizeHandler);
    el.addEventListener("event-create", this._eventCreateHandler);
    el.addEventListener("view-change", this._viewChangeHandler);

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
  }

  ngOnDestroy(): void {
    const el = this._elRef()?.nativeElement;
    el?.removeEventListener("event-click", this._eventClickHandler);
    el?.removeEventListener("add-event", this._addEventHandler);
    el?.removeEventListener("event-move", this._eventMoveHandler);
    el?.removeEventListener("event-resize", this._eventResizeHandler);
    el?.removeEventListener("event-create", this._eventCreateHandler);
    el?.removeEventListener("view-change", this._viewChangeHandler);
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

    const resources = Object.values(state.resources) as any[];
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
        .filter((e: any) => e.resourceId === res.id)
        .map((e: any) => {
          const startD = new Date(e.startTime);
          const endD = new Date(e.endTime);
          const pad = (n: number) => n.toString().padStart(2, "0");
          return {
            id: e.id,
            title: e.title,
            startTime: `${pad(startD.getUTCHours())}:${pad(startD.getUTCMinutes())}`,
            endTime: `${pad(endD.getUTCHours())}:${pad(endD.getUTCMinutes())}`,
            color: "blue" as const,
            date: `${startD.getFullYear()}-${pad(startD.getMonth() + 1)}-${pad(startD.getDate())}`,
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
    if (!data) return; // let the web component use its built-in SAMPLE data
    const el = this._elRef()?.nativeElement as
      | (HTMLElement & { resources: TimelineResource[] })
      | undefined;
    if (el) {
      el.resources = data;
    }
  }
}
