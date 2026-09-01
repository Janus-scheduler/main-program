import {
  Component,
  output,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  input,
  viewChild,
  ChangeDetectionStrategy,
  effect,
} from "@angular/core";
// Side-effect import: ensures the <janus-year-grid> custom element is registered
import { JanusYearGrid } from "@janus-scheduler/ui";
// Ensure the class is not dropped
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _yg = JanusYearGrid;
import { type ViewType } from "@janus-scheduler/core";

@Component({
  selector: "janus-year-grid-ng",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <janus-year-grid #yearGridEl></janus-year-grid>`,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class YearGridComponent implements AfterViewInit, OnDestroy {
  private readonly _elRef =
    viewChild.required<ElementRef<HTMLElement>>("yearGridEl");

  readonly viewYear = input<number | undefined>(undefined);

  readonly dayClick = output<{ date: string }>();
  readonly viewChange = output<{ view: ViewType }>();
  readonly navChange = output<Record<string, unknown>>();

  constructor() {
    effect(() => {
      this._syncProps();
    });
  }

  private _dayClickHandler = (e: Event) => {
    e.stopPropagation();
    this.dayClick.emit((e as CustomEvent).detail);
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

  ngAfterViewInit(): void {
    const el = this._elRef().nativeElement;
    el.addEventListener("day-click", this._dayClickHandler);
    el.addEventListener("view-change", this._viewChangeHandler);
    el.addEventListener("nav-change", this._navChangeHandler);
    this._syncProps();
  }

  private _syncProps(): void {
    try {
      const el = this._elRef()?.nativeElement as
        (HTMLElement & { viewYear?: number }) | undefined;
      if (el && this.viewYear() !== undefined) {
        el.viewYear = this.viewYear()!;
      }
    } catch {
      // ViewChild might not be initialized yet before first view init
    }
  }

  ngOnDestroy(): void {
    const el = this._elRef()?.nativeElement;
    if (el) {
      el.removeEventListener("day-click", this._dayClickHandler);
      el.removeEventListener("view-change", this._viewChangeHandler);
      el.removeEventListener("nav-change", this._navChangeHandler);
    }
  }
}
