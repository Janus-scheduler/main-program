import {
  Component,
  input,
  output,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  viewChild,
  ChangeDetectionStrategy,
} from "@angular/core";
import "@janus-scheduler/ui";

@Component({
  selector: "janus-ai-bar-ng",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<janus-ai-bar #aiBarEl></janus-ai-bar>`,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class AiBarComponent implements AfterViewInit, OnDestroy {
  private readonly _elRef =
    viewChild.required<ElementRef<HTMLElement>>("aiBarEl");

  readonly placeholder = input<string | undefined>(undefined);
  readonly buttonLabel = input<string | undefined>(undefined);

  readonly aiSubmit = output<{ prompt: string }>();
  readonly aiInput = output<{ prompt: string }>();

  private readonly _aiSubmitHandler = (e: Event) => {
    e.stopPropagation();
    this.aiSubmit.emit((e as CustomEvent<{ prompt: string }>).detail);
  };
  private readonly _aiInputHandler = (e: Event) => {
    e.stopPropagation();
    this.aiInput.emit((e as CustomEvent<{ prompt: string }>).detail);
  };

  ngAfterViewInit(): void {
    const el = this._elRef().nativeElement;
    el.addEventListener("ai-submit", this._aiSubmitHandler);
    el.addEventListener("ai-input", this._aiInputHandler);

    const elTyped = el as HTMLElement & {
      placeholder?: string;
      buttonLabel?: string;
    };
    if (this.placeholder() !== undefined)
      elTyped.placeholder = this.placeholder();
    if (this.buttonLabel() !== undefined)
      elTyped.buttonLabel = this.buttonLabel();
  }

  ngOnDestroy(): void {
    const el = this._elRef()?.nativeElement;
    el?.removeEventListener("ai-submit", this._aiSubmitHandler);
    el?.removeEventListener("ai-input", this._aiInputHandler);
  }
}
