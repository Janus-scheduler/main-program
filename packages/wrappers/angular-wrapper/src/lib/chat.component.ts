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
import type {
  ChatActionDetail,
  ChatClarifyResponseDetail,
  ChatMessage,
  ChatSubmitDetail,
  ChatSuggestion,
  ChatSuggestionDetail,
} from "./types";

/**
 * Angular binding for `<janus-chat>`.
 *
 * A thin adapter, like every other component in this package: it forwards
 * properties onto the custom element and unwraps `CustomEvent.detail` so
 * consumers never touch a DOM event. All conversation logic lives in
 * `@janus-scheduler/nlp` and all rendering in `@janus-scheduler/ui`.
 *
 * The nine events are wired from a table rather than nine near-identical
 * handler pairs — at nine, spelling each one out is nine places for a typo to
 * hide, and a missing `removeEventListener` leaks a listener per mount.
 */
@Component({
  selector: "janus-chat-ng",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<janus-chat #chatEl></janus-chat>`,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class ChatComponent implements AfterViewInit, OnDestroy {
  private readonly _elRef =
    viewChild.required<ElementRef<HTMLElement>>("chatEl");

  readonly messages = input<ChatMessage[] | undefined>(undefined);
  readonly suggestions = input<ChatSuggestion[] | undefined>(undefined);
  readonly heading = input<string | undefined>(undefined);
  readonly subheading = input<string | undefined>(undefined);
  readonly placeholder = input<string | undefined>(undefined);
  readonly value = input<string | undefined>(undefined);
  readonly busy = input<boolean | undefined>(undefined);
  readonly showClose = input<boolean | undefined>(undefined);
  readonly showVoice = input<boolean | undefined>(undefined);
  /** `"light"` (default) · `"dark"` · `"auto"` follows the OS. */
  readonly theme = input<"light" | "dark" | "auto" | undefined>(undefined);

  readonly chatSubmit = output<ChatSubmitDetail>();
  readonly chatConfirm = output<ChatActionDetail>();
  readonly chatEdit = output<ChatActionDetail>();
  readonly chatClarifyResponse = output<ChatClarifyResponseDetail>();
  readonly chatUndo = output<ChatActionDetail>();
  readonly chatView = output<ChatActionDetail>();
  readonly chatSuggestionSelect = output<ChatSuggestionDetail>();
  readonly chatInput = output<ChatSubmitDetail>();
  readonly chatClose = output<void>();

  /** `[DOM event name, the output it feeds]`. */
  private readonly _events: Array<[string, { emit: (d: never) => void }]> = [
    ["chat-submit", this.chatSubmit],
    ["chat-confirm", this.chatConfirm],
    ["chat-edit", this.chatEdit],
    ["chat-clarify-response", this.chatClarifyResponse],
    ["chat-undo", this.chatUndo],
    ["chat-view", this.chatView],
    ["chat-suggestion-select", this.chatSuggestionSelect],
    ["chat-input", this.chatInput],
    ["chat-close", this.chatClose],
  ] as Array<[string, { emit: (d: never) => void }]>;

  /** Kept so every listener added can be removed again. */
  private readonly _attached: Array<[string, (e: Event) => void]> = [];

  ngAfterViewInit(): void {
    const el = this._elRef().nativeElement;

    for (const [name, target] of this._events) {
      const listener = (e: Event) => {
        e.stopPropagation();
        target.emit((e as CustomEvent).detail as never);
      };
      el.addEventListener(name, listener);
      this._attached.push([name, listener]);
    }

    const typed = el as HTMLElement & Record<string, unknown>;
    const set = (key: string, value: unknown) => {
      if (value !== undefined) typed[key] = value;
    };
    set("messages", this.messages());
    set("suggestions", this.suggestions());
    set("heading", this.heading());
    set("subheading", this.subheading());
    set("placeholder", this.placeholder());
    set("value", this.value());
    set("busy", this.busy());
    set("showClose", this.showClose());
    set("showVoice", this.showVoice());
    set("theme", this.theme());
  }

  ngOnDestroy(): void {
    const el = this._elRef()?.nativeElement;
    for (const [name, listener] of this._attached) {
      el?.removeEventListener(name, listener);
    }
    this._attached.length = 0;
  }
}
