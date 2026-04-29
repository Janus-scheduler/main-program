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

  ngAfterViewInit(): void {
    const el = this._elRef().nativeElement;
    el.addEventListener("event-click", this._eventClickHandler);
    el.addEventListener("add-event", this._addEventHandler);
    el.addEventListener("event-move", this._eventMoveHandler);
    el.addEventListener("event-resize", this._eventResizeHandler);
    el.addEventListener("event-create", this._eventCreateHandler);
    this._syncResources();
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
