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
import type { ViewType } from "@janus-scheduler/core";
// Side-effect import: ensures the <janus-topbar> custom element is registered
import { JanusTopbar } from "@janus-scheduler/ui";
// Ensure the class is not dropped
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _topbar = JanusTopbar;

@Component({
  selector: "janus-topbar-ng",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <janus-topbar #topbarEl></janus-topbar>`,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class TopbarComponent implements AfterViewInit, OnDestroy, OnChanges {
  private readonly _elRef =
    viewChild.required<ElementRef<HTMLElement>>("topbarEl");

  readonly navLabel = input<string | undefined>(undefined);
  readonly dayName = input<string | undefined>(undefined);
  readonly shortDate = input<string | undefined>(undefined);
  readonly view = input<ViewType | undefined>(undefined);
  readonly allowCreate = input<boolean>(false);
  readonly zoomPercent = input<number>(100);
  readonly zoomUnit = input<string | undefined>(undefined);

  readonly prevClick = output<void>();
  readonly nextClick = output<void>();
  readonly todayClick = output<void>();
  readonly viewSwitch = output<{ view: ViewType }>();
  readonly toggleCreate = output<void>();

  private readonly _prevClickHandler = (e: Event) => {
    e.stopPropagation();
    this.prevClick.emit();
  };
  private readonly _nextClickHandler = (e: Event) => {
    e.stopPropagation();
    this.nextClick.emit();
  };
  private readonly _todayClickHandler = (e: Event) => {
    e.stopPropagation();
    this.todayClick.emit();
  };
  private readonly _viewSwitchHandler = (e: Event) => {
    e.stopPropagation();
    this.viewSwitch.emit((e as CustomEvent<{ view: ViewType }>).detail);
  };
  private readonly _toggleCreateHandler = (e: Event) => {
    e.stopPropagation();
    this.toggleCreate.emit();
  };

  ngAfterViewInit(): void {
    const el = this._elRef().nativeElement;
    el.addEventListener("prev-click", this._prevClickHandler);
    el.addEventListener("next-click", this._nextClickHandler);
    el.addEventListener("today-click", this._todayClickHandler);
    el.addEventListener("view-switch", this._viewSwitchHandler);
    el.addEventListener("toggle-create", this._toggleCreateHandler);

    this._syncInputs();
  }

  ngOnChanges(): void {
    this._syncInputs();
  }

  ngOnDestroy(): void {
    const el = this._elRef()?.nativeElement;
    el?.removeEventListener("prev-click", this._prevClickHandler);
    el?.removeEventListener("next-click", this._nextClickHandler);
    el?.removeEventListener("today-click", this._todayClickHandler);
    el?.removeEventListener("view-switch", this._viewSwitchHandler);
    el?.removeEventListener("toggle-create", this._toggleCreateHandler);
  }

  private _syncInputs(): void {
    const el = this._elRef()?.nativeElement;
    if (!el) return;

    if (this.navLabel() !== undefined) {
      el.setAttribute("nav-label", this.navLabel()!);
    }
    if (this.dayName() !== undefined) {
      el.setAttribute("day-name", this.dayName()!);
    }
    if (this.shortDate() !== undefined) {
      el.setAttribute("short-date", this.shortDate()!);
    }
    if (this.zoomUnit() !== undefined) {
      el.setAttribute("zoom-unit", this.zoomUnit()!);
    }

    // Props
    const element = el as HTMLElement & {
      view?: string;
      allowCreate?: boolean;
      zoomPercent?: number;
    };
    element.view = this.view();
    element.allowCreate = this.allowCreate();
    element.zoomPercent = this.zoomPercent();
  }
}
