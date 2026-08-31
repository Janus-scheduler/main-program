import { Injectable, signal, OnDestroy } from '@angular/core';
import { type JanusChatOptions, type SessionState, ChatController } from '@janus-scheduler/nlp';
import type { ChatMessage } from '@janus-scheduler/ui';

@Injectable({
  providedIn: 'root',
})
export class JanusChatService implements OnDestroy {
  public thread = signal<ChatMessage[]>([]);
  public busy = signal<boolean>(false);
  public session = signal<SessionState | null>(null);

  private controller!: ChatController;
  private unsubscribe?: () => void;

  public initialize(options: JanusChatOptions) {
    if (!this.controller) {
      this.controller = new ChatController(options);

      this.thread.set(this.controller.thread as unknown as ChatMessage[]);
      this.busy.set(this.controller.busy);
      this.session.set(this.controller.session);

      this.unsubscribe = this.controller.subscribe(() => {
        this.thread.set([...this.controller.thread] as unknown as ChatMessage[]);
        this.busy.set(this.controller.busy);
        this.session.set(this.controller.session);
      });
    } else {
      this.controller.updateOptions(options);
    }
  }

  public submit(text: string) {
    this.controller?.submit(text);
  }

  public choose(label: string) {
    this.controller?.choose(label);
  }

  public confirm() {
    this.controller?.confirm();
  }

  public undo(id: string) {
    this.controller?.undo(id);
  }

  public reset() {
    this.controller?.reset();
  }

  public edit() {
    if (this.controller) {
      this.controller.edit();
    }
  }

  ngOnDestroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
