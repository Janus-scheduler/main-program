import {
  SessionState,
  SessionContext,
  EntityCatalog,
  SessionRequirements,
  Artifacts,
  Prototype,
} from "./types";
import { beginSession, provideAnswer, editFieldQuestion } from "./session";
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
  /**
   * IANA zone the user's words are resolved in — "3pm" means 3pm HERE.
   *
   * Pass a FUNCTION when the host has a display timezone the user can change.
   * It is called at the start of each turn, so switching the calendar's zone
   * takes effect on the next message rather than on the next page load.
   *
   * This matters because the host renders the timeline in one zone while the
   * chat used to resolve in another (the browser's), so a card could say
   * 3:00 PM and the timeline draw the block somewhere else entirely. Whatever
   * the calendar is displaying is the only zone the user can reasonably mean.
   *
   * Omitted entirely, it falls back to the browser's zone — right for a host
   * with no timezone control, wrong for one that has it and does not pass it.
   */
  timezone?: string | (() => string);
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

  /**
   * The zone this turn resolves in.
   *
   * A thrown or empty getter falls back to the browser rather than propagating
   * — a broken timezone source should degrade to a plausible answer, not take
   * the whole conversation down.
   */
  private resolveTimezone(): string {
    const configured = this.options.timezone;
    try {
      const resolved =
        typeof configured === "function" ? configured() : configured;
      if (resolved) return resolved;
    } catch {
      /* fall through to the browser's zone */
    }
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * What the presentation layer needs beyond the session itself.
   *
   * `deviceTimezone` is read here rather than inside `presentSession` so that
   * layer stays a pure data mapper and the timezone warning can be tested
   * without touching the machine's clock settings.
   */
  private presentOptions() {
    return {
      fallbackResourceName: this.options.fallbackResourceName,
      deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
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

    const isAwaiting = this.session?.status === "awaiting";
    const smalltalk = isAwaiting
      ? null
      : classifySmalltalk(text, this.options.catalog);

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
      // Resolved HERE, at the start of the turn — not captured when the chat
      // was constructed. A host whose display zone can change passes a getter.
      timezone: this.resolveTimezone(),
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
        ...this.presentOptions(),
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

  /**
   * Ask WHICH field, rather than accepting any text against a dummy slot.
   *
   * The old version parked on `slot: "title"` so it could take a free reply,
   * which meant everything typed after Edit went to the title handler: a time
   * was swallowed (extraction is first-mention-wins, so the ORIGINAL time won)
   * and a room or name was appended rather than replacing. Editing a 3pm
   * booking to 5pm changed nothing at all.
   */
  public edit() {
    if (!this.session || this.session.status !== "ready" || !this.session.draft)
      return;

    this.session = {
      ...this.session,
      status: "awaiting",
      question: editFieldQuestion(this.session.draft),
    };
    const reply = presentSession(this.session, this.nextId(), {
      ...this.presentOptions(),
    });
    if (reply) {
      this.append(reply);
    }
    this.notify();
  }
}
