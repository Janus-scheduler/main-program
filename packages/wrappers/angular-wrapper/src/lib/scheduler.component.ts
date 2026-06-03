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
// Side-effect import: ensures the <janus-scheduler> custom element is registered
import { JanusScheduler } from "@janus-scheduler/ui";
// Ensure the class is not dropped
const _ = JanusScheduler;
import { SchedulerSaveData, SchedulerDeleteData } from "./types";

/**
 * SchedulerComponent
 *
 * Thin Angular standalone wrapper around the `<janus-scheduler>` Lit web
 * component from @janus-scheduler/ui. This keeps the Angular wrapper
 * fully framework-agnostic — the UI is rendered by the shared web component.
 *
 * @example
 * ```html
 * <janus-scheduler-ng (close)="onClose()" />
 * ```
 */
@Component({
  selector: "janus-scheduler-ng",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <janus-scheduler #schedulerEl></janus-scheduler>`,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class SchedulerComponent implements AfterViewInit, OnDestroy, OnChanges {
  private readonly _elRef =
    viewChild.required<ElementRef<HTMLElement>>("schedulerEl");

  /** Error message to display in the scheduler */
  readonly error = input<string | null>(null);
  readonly eventId = input<string | null>(null);
  readonly title = input<string | undefined>(undefined);
  readonly startDate = input<string | undefined>(undefined);
  readonly startTime = input<string | undefined>(undefined);
  readonly endDate = input<string | undefined>(undefined);
  readonly endTime = input<string | undefined>(undefined);
  readonly participants = input<string[] | undefined>(undefined);
  readonly description = input<string | undefined>(undefined);
  readonly activeColor = input<string | undefined>(undefined);
  readonly allDay = input<boolean | undefined>(undefined);
  readonly recurrenceRule = input<string | undefined>(undefined);

  /** Emitted when the user closes the scheduler modal */
  readonly close = output<void>();

  /** Emitted when the user saves an event */
  readonly save = output<SchedulerSaveData>();

  /** Emitted when the user deletes an event */
  readonly delete = output<SchedulerDeleteData>();

  private _closeHandler = (e: Event) => {
    e.stopPropagation();
    this.close.emit();
  };
  private _saveHandler = (e: Event) => {
    e.stopPropagation();
    this.save.emit((e as CustomEvent).detail);
  };
  private _deleteHandler = (e: Event) => {
    e.stopPropagation();
    this.delete.emit((e as CustomEvent).detail);
  };

  ngAfterViewInit(): void {
    const el = this._elRef().nativeElement;
    el.addEventListener("close", this._closeHandler);
    el.addEventListener("save", this._saveHandler);
    el.addEventListener("delete", this._deleteHandler);
    this._syncProps();
  }

  ngOnChanges(): void {
    this._syncProps();
  }

  ngOnDestroy(): void {
    const el = this._elRef()?.nativeElement;
    el?.removeEventListener("close", this._closeHandler);
    el?.removeEventListener("save", this._saveHandler);
    el?.removeEventListener("delete", this._deleteHandler);
  }

  private _syncProps(): void {
    const el = this._elRef()?.nativeElement as any;
    if (el) {
      if (this.error() !== undefined) el.error = this.error();
      if (this.eventId() !== undefined) el.eventId = this.eventId();
      if (this.title() !== undefined) el.title = this.title();
      if (this.startDate() !== undefined) el.startDate = this.startDate();
      if (this.startTime() !== undefined) el.startTime = this.startTime();
      if (this.endDate() !== undefined) el.endDate = this.endDate();
      if (this.endTime() !== undefined) el.endTime = this.endTime();
      if (this.participants() !== undefined)
        el.participants = this.participants();
      if (this.description() !== undefined) el.description = this.description();
      if (this.activeColor() !== undefined) el.activeColor = this.activeColor();
      if (this.allDay() !== undefined) el.allDay = this.allDay();
      if (this.recurrenceRule() !== undefined)
        el.recurrenceRule = this.recurrenceRule();
    }
  }
}
