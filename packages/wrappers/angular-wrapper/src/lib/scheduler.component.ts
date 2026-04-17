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
// Side-effect import: ensures the <janus-scheduler> custom element is registered
import "@janus-scheduler/ui";

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
export class SchedulerComponent implements AfterViewInit, OnDestroy {
  private readonly _elRef =
    viewChild.required<ElementRef<HTMLElement>>("schedulerEl");

  /** Emitted when the user closes the scheduler modal */
  readonly close = output<void>();

  private _closeHandler = () => this.close.emit();

  ngAfterViewInit(): void {
    const el = this._elRef().nativeElement;
    el.addEventListener("close", this._closeHandler);
  }

  ngOnDestroy(): void {
    const el = this._elRef()?.nativeElement;
    el?.removeEventListener("close", this._closeHandler);
  }
}
