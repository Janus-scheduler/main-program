import {
  SessionState,
  SessionContext,
  EntityCatalog,
  SessionRequirements,
  Artifacts,
  Prototype,
} from "./types";
import { beginSession, provideAnswer } from "./session";
import { reviseSlot } from "./revise";
import { parseTimeSpan } from "./datetime";
import { classifySmalltalk } from "./smalltalk";
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

export interface JanusChatOptions {
  engine: NlpEngine | null;
  catalog: EntityCatalog;
  correctSpelling?: boolean;
  timezone?: string;
  intro?: PresentMessage;
  requires?: SessionRequirements;
  fallbackResourceName?: string;
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
  private timerId?: ReturnType<typeof setTimeout>;

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
    if (!this.options.engine || text.trim().length === 0 || this.busy) return;

    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = undefined;
    }

    this.append({ id: this.nextId(), role: "user", kind: "text", text });
    this.busy = true;
    this.notify();

    const smalltalk = classifySmalltalk(text);
    if (smalltalk) {
      let reply = "";
      switch (smalltalk) {
        case "greeting":
          reply = "Hi! I can schedule, move, or cancel events for you.";
          break;
        case "thanks":
          reply = "You're welcome.";
          break;
        case "farewell":
          reply = "Goodbye!";
          break;
        case "help":
          reply =
            "Try asking me to book a room, move a meeting, or check your schedule.";
          break;
      }
      this.append({
        id: this.nextId(),
        role: "assistant",
        kind: "text",
        text: reply,
      });
      this.busy = false;
      this.notify();
      return;
    }

    const CORRECTION_RE =
      /^\s*(actually|instead|no,|no |change it to|make it)\b\s*(.*)/i;
    const correctionMatch = text.match(CORRECTION_RE);

    // If it's a correction and we have a draft, we'll try to apply it.
    // reviseSlot will re-evaluate with the new text. We'll pass undefined for span
    // to just append the correction and re-evaluate, since the entities extractor
    // will pick up the new span and override.
    // We do this by intercepting before provideAnswer.
    let isCorrection = false;
    if (
      correctionMatch &&
      this.session &&
      this.session.draft &&
      this.session.status !== "declined"
    ) {
      isCorrection = true;
    }

    const ctx: SessionContext = {
      artifacts: this.options.engine.artifacts,
      prototypes: this.options.engine.prototypes,
      catalog: this.options.catalog,
      requires: this.options.requires,
      correctSpelling: this.options.correctSpelling ?? true,
      now: new Date(),
      timezone:
        this.options.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    // Use a small delay for UI animation "thinking" effect
    this.timerId = setTimeout(() => {
      let next: SessionState | null = null;
      try {
        if (isCorrection && this.session) {
          const payload =
            correctionMatch && correctionMatch[2].trim().length > 0
              ? correctionMatch[2].trim()
              : text;
          const parsed = parseTimeSpan(payload);
          if (parsed && this.session.draft?.timeSpan) {
            const originalSpan = this.session.draft.timeSpan;
            let replacementText = payload;
            if (!parsed.date && originalSpan.date) {
              const dateMention = originalSpan.mentions.find(
                (m) =>
                  m.kind !== "clock" &&
                  m.kind !== "duration" &&
                  m.kind !== "partOfDay",
              );
              if (dateMention) {
                replacementText = `${dateMention.text} ${payload}`.trim();
              }
            }
            next = reviseSlot(this.session, originalSpan, replacementText, ctx);
          } else {
            next = reviseSlot(this.session, undefined, payload, ctx);
          }
        } else {
          next =
            this.session && this.session.status === "awaiting"
              ? provideAnswer(this.session, text, ctx)
              : beginSession(text, ctx);
        }
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
    if (this.busy) return;
    const choice = this.session?.question?.choices?.find(
      (c) => c.label === label,
    );
    this.submit(choice ? choice.value : label);
  }

  public confirm() {
    if (this.busy || !this.session || this.session.status !== "ready") return;

    let outcome: ConfirmOutcome | undefined = undefined;

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
    this.thread = this.thread.map((m) =>
      m.kind === "parse" ? { ...m, finalized: true } : m,
    );
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
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = undefined;
    }
    this.thread = [this.options.intro || DEFAULT_INTRO];
    this.session = null;
    this.undos.clear();
    this.notify();
  }

  public edit() {
    if (!this.session || this.session.status !== "ready") return;

    this.session = {
      ...this.session,
      status: "awaiting",
      question: {
        slot: "title", // dummy slot to allow any text reply
        gate: null,
        source: "requirement",
        skippable: true,
        text: "What would you like to change? (e.g., 'actually 3pm', 'instead of Room A')",
        choices: [],
      },
    };
    const reply = presentSession(this.session, this.nextId(), {
      fallbackResourceName: this.options.fallbackResourceName,
    });
    if (reply) {
      this.append(reply);
    }
    this.notify();
  }
}
