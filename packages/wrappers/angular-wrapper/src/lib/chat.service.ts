import { Injectable, signal, OnDestroy } from "@angular/core";
import {
  ChatController,
  JanusChatOptions,
  SessionState,
} from "@janus-scheduler/nlp";
import { ChatMessage } from "./types";

@Injectable({
  providedIn: "root",
})
export class JanusChatService implements OnDestroy {
  private controller: ChatController | null = null;
  private unsubscribe: (() => void) | null = null;

  public thread = signal<ChatMessage[]>([]);
  public busy = signal<boolean>(false);
  public session = signal<SessionState | null>(null);

  connect(options: JanusChatOptions) {
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    this.controller = new ChatController(options);

    // Initial sync
    this.sync();

    // Subscribe to future updates
    this.unsubscribe = this.controller.subscribe(() => this.sync());
  }

  private sync() {
    if (!this.controller) return;
    this.thread.set(this.controller.thread as ChatMessage[]);
    this.busy.set(this.controller.busy);
    this.session.set(this.controller.session);
  }

  submit(text: string) {
    this.controller?.submit(text);
  }

  choose(label: string) {
    this.controller?.choose(label);
  }

  confirm() {
    this.controller?.confirm();
  }

  undo(messageId: string) {
    this.controller?.undo(messageId);
  }

  reset() {
    this.controller?.reset();
  }

  ngOnDestroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
