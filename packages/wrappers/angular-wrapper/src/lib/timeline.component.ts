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
import "@janus-scheduler/ui";
import type { TimelineResource, TimelineEvent } from "@janus-scheduler/ui";

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

  private _eventClickHandler = (e: Event) => {
    e.stopPropagation();
    this.eventClick.emit((e as CustomEvent).detail);
  };
  private _addEventHandler = (e: Event) => {
    e.stopPropagation();
    this.addEvent.emit();
  };

  ngAfterViewInit(): void {
    const el = this._elRef().nativeElement;
    el.addEventListener("event-click", this._eventClickHandler);
    el.addEventListener("add-event", this._addEventHandler);
    this._syncResources();
  }

  ngOnChanges(): void {
    this._syncResources();
  }

  ngOnDestroy(): void {
    const el = this._elRef()?.nativeElement;
    el?.removeEventListener("event-click", this._eventClickHandler);
    el?.removeEventListener("add-event", this._addEventHandler);
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
