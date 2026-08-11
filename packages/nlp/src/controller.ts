import {
  SessionState,
  SessionContext,
  EntityCatalog,
  SessionRequirements,
  Artifacts,
  Prototype,
} from "./types";
import { beginSession, provideAnswer } from "./session";
import { presentSession, summarise, PresentMessage } from "./presentSession";

export interface ConfirmOutcome {
  ok: boolean;
  message: string;
  undo?: () => void;
}

export interface NlpEngine {
  artifacts: Artifacts;
  prototypes: Prototype[];
}

// A minimal interface to decouple NLP from Core's SchedulerManager
export interface ExternalSchedulerManager {
  addEvent(event: Record<string, unknown>): { id: string } | undefined;
  deleteEvent(id: string): void;
}

export interface JanusChatOptions {
  engine: NlpEngine | null;
  catalog: EntityCatalog;
  timezone?: string;
  intro?: PresentMessage;
  requires?: SessionRequirements;
  fallbackResourceName?: string;
  manager?: ExternalSchedulerManager;
  onConfirm?: (state: SessionState) => ConfirmOutcome | void;
}

export const DEFAULT_INTRO: PresentMessage = {
  id: "intro",
  role: "assistant",
  kind: "text",
  text: "Tell me what to schedule or ask about your schedule. I'll show you what I understood before taking action.",
};

export class ChatController {
  public thread: PresentMessage[];
  public busy: boolean = false;
  public session: SessionState | null = null;

  private listeners: (() => void)[] = [];
  private seq = 0;
  private undos = new Map<string, () => void>();

  constructor(public options: JanusChatOptions) {
    this.thread = [options.intro || DEFAULT_INTRO];
  }

  public updateOptions(options: JanusChatOptions) {
    this.options = options;
  }

  private nextId(): string {
    this.seq++;
    return `m${this.seq}`;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private append(message: PresentMessage) {
    this.thread = [...this.thread, message];
    this.notify();
  }

  public submit(text: string) {
    if (!this.options.engine || text.trim().length === 0) return;

    this.append({ id: this.nextId(), role: "user", kind: "text", text });
    this.busy = true;
    this.notify();

    const ctx: SessionContext = {
      artifacts: this.options.engine.artifacts,
      prototypes: this.options.engine.prototypes,
      catalog: this.options.catalog,
      requires: this.options.requires,
      correctSpelling: true,
      now: new Date(),
      timezone:
        this.options.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    // Use a small delay for UI animation "thinking" effect
    setTimeout(() => {
      let next: SessionState | null = null;
      try {
        next =
          this.session && this.session.status === "awaiting"
            ? provideAnswer(this.session, text, ctx)
            : beginSession(text, ctx);
      } catch (error) {
        console.error("nlp threw error", error);
      }

      this.busy = false;
      if (!next) {
        this.notify();
        return;
      }

      this.session = next;
      const reply = presentSession(next, this.nextId(), {
        fallbackResourceName: this.options.fallbackResourceName,
      });

      if (reply) {
        this.thread = [...this.thread, reply];
      }
      this.notify();
    }, 220);
  }

  public choose(label: string) {
    const choice = this.session?.question?.choices?.find(
      (c) => c.label === label,
    );
    this.submit(choice ? choice.value : label);
  }

  public confirm() {
    if (!this.session || this.session.status !== "ready") return;

    let outcome: ConfirmOutcome | undefined = undefined;

    // Direct store operation via SchedulerManager if provided
    if (this.options.manager && this.session.draft) {
      const draft = this.session.draft;
      if (draft.intent === "add_event") {
        try {
          const res = draft.resources[0]?.id ?? undefined;
          const created = this.options.manager.addEvent({
            id: `evt-${Date.now()}`,
            title: draft.title || "New Event",
            startTime: draft.time?.startISO || new Date().toISOString(),
            endTime:
              draft.time?.endISO ||
              new Date(Date.now() + 3600000).toISOString(),
            resourceId: res,
          });
          outcome = {
            ok: true,
            message: `Created "${draft.title || "Event"}"`,
            undo: () => {
              if (created?.id) this.options.manager!.deleteEvent(created.id);
            },
          };
        } catch (err) {
          outcome = {
            ok: false,
            message: `Failed to create event: ${String(err)}`,
          };
        }
      } else if (draft.intent === "get_details") {
        outcome = {
          ok: true,
          message: summarise(this.session),
        };
      }
    }

    if (!outcome) {
      outcome = this.options.onConfirm?.(this.session) ?? {
        ok: true,
        message: summarise(this.session),
      };
    }

    if (!outcome.ok) {
      this.append({
        id: this.nextId(),
        role: "assistant",
        kind: "text",
        text: outcome.message,
      });
      return;
    }

    const id = this.nextId();
    if (outcome.undo) this.undos.set(id, outcome.undo);

    this.session = null;
    this.append({
      id,
      role: "assistant",
      kind: "success",
      summary: outcome.message,
      canUndo: Boolean(outcome.undo),
    });
  }

  public undo(messageId: string) {
    const revert = this.undos.get(messageId);
    if (!revert) return;

    revert();
    this.undos.delete(messageId);

    this.thread = this.thread.map((m) =>
      m.id === messageId && m.kind === "success"
        ? { ...m, canUndo: false, title: "Undone" }
        : m,
    );
    this.notify();
  }

  public reset() {
    this.thread = [this.options.intro || DEFAULT_INTRO];
    this.session = null;
    this.undos.clear();
    this.notify();
  }
}
