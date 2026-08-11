/**
 * Holds one conversation: the `SessionState`, the rendered thread, and the
 * bridge between them.
 *
 * Shared by the docked chat in the app and the `?chat=live` inspector, so the
 * two cannot drift apart — the inspector is only useful as a debugging view if
 * it is running the identical flow.
 *
 * The commit is injected. This hook knows how to have a conversation and
 * nothing at all about scheduling, which is what lets `?chat=live` run the full
 * flow with no store attached.
 */

import { useCallback, useRef, useState } from "react";
import { beginSession, provideAnswer } from "@janus-scheduler/nlp";
import type {
  EntityCatalog,
  SessionContext,
  SessionRequirements,
  SessionState,
} from "@janus-scheduler/nlp";
import type { ChatMessage } from "@janus-scheduler/react";

import type { NlpEngine } from "./useNlpEngine";
import { presentSession, summarise } from "./presentSession";

/** What a confirm attempt reports back. `undo` absent = not reversible. */
export interface ConfirmOutcome {
  ok: boolean;
  /** Shown in the success bubble, or as a plain refusal when `ok` is false. */
  message: string;
  undo?: () => void;
}

export interface ConversationOptions {
  engine: NlpEngine | null;
  catalog: EntityCatalog;
  timezone: string;
  intro: ChatMessage;
  /**
   * What this app considers a complete event. The frozen gates only ever
   * require a time, so without this a bare "schedule a meeting at 5pm" goes
   * straight to a confirmable card with no room and nobody in it.
   */
  requires?: SessionRequirements;
  /**
   * Shown on the card when the utterance named no resource — the row the
   * commit will fall back to. The user has to see it BEFORE pressing Confirm,
   * not afterwards in the receipt.
   */
  fallbackResourceName?: string;
  /**
   * Called only after the user presses Confirm on a parse card. Omit for a
   * read-only conversation — the success bubble then just echoes the draft.
   */
  onConfirm?: (state: SessionState) => ConfirmOutcome;
}

export interface Conversation {
  thread: ChatMessage[];
  busy: boolean;
  /** The current turn, or `null` before the first utterance / after a commit. */
  session: SessionState | null;
  submit: (text: string) => void;
  /** A tapped clarification chip, by its label. */
  choose: (label: string) => void;
  confirm: () => void;
  undo: (messageId: string) => void;
  reset: () => void;
}

export function useChatConversation(
  options: ConversationOptions,
): Conversation {
  const {
    engine,
    catalog,
    timezone,
    intro,
    requires,
    fallbackResourceName,
    onConfirm,
  } = options;

  const [thread, setThread] = useState<ChatMessage[]>([intro]);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<SessionState | null>(null);

  const seq = useRef(0);
  const nextId = () => `m${++seq.current}`;

  // Undo is per success bubble, not global: two commits in one thread each get
  // their own, and undoing the older one must not touch the newer.
  const undos = useRef(new Map<string, () => void>());

  const append = (message: ChatMessage) =>
    setThread((prev) => [...prev, message]);

  const submit = useCallback(
    (text: string) => {
      if (!engine || text.trim().length === 0) return;

      append({ id: nextId(), role: "user", kind: "text", text });
      setBusy(true);

      // `now` is read HERE, at the moment of the turn — "tomorrow" has to mean
      // tomorrow relative to when the user pressed enter, not to page load.
      const ctx: SessionContext = {
        artifacts: engine.artifacts,
        prototypes: engine.prototypes,
        catalog,
        requires,
        // "schedule a meeting tommorow" otherwise has no time anchor, so the
        // user gets asked "when?" about a sentence that plainly said when —
        // and "tommorow" ends up as part of the event's title.
        correctSpelling: true,
        now: new Date(),
        timezone,
      };

      // A beat, so the thinking state is observable. The classifier itself
      // takes single-digit milliseconds; this is honesty about the UI, not a
      // delay pretending the work is hard.
      window.setTimeout(() => {
        let next: SessionState | null = null;
        try {
          next =
            session && session.status === "awaiting"
              ? provideAnswer(session, text, ctx)
              : beginSession(text, ctx);
        } catch (error) {
          console.error("nlp threw", error);
        }
        setBusy(false);
        if (!next) return;

        setSession(next);
        const reply = presentSession(next, nextId(), { fallbackResourceName });
        if (reply) append(reply);
      }, 220);
    },
    [catalog, engine, fallbackResourceName, requires, session, timezone],
  );

  /** A tapped chip sends its `value`, so chips and typing take one path. */
  const choose = useCallback(
    (label: string) => {
      const choice = session?.question?.choices.find((c) => c.label === label);
      submit(choice ? choice.value : label);
    },
    [session, submit],
  );

  const confirm = useCallback(() => {
    if (!session || session.status !== "ready") return;

    const outcome = onConfirm?.(session) ?? {
      ok: true,
      message: summarise(session),
    };

    if (!outcome.ok) {
      // A refusal is a plain message, not a card. Nothing was written, and the
      // draft stays live so the user can amend it rather than retype.
      append({
        id: nextId(),
        role: "assistant",
        kind: "text",
        text: outcome.message,
      });
      return;
    }

    const id = nextId();
    if (outcome.undo) undos.current.set(id, outcome.undo);
    append({
      id,
      role: "assistant",
      kind: "success",
      summary: outcome.message,
      canUndo: Boolean(outcome.undo),
    });
    setSession(null);
  }, [onConfirm, session]);

  const undo = useCallback((messageId: string) => {
    const revert = undos.current.get(messageId);
    if (!revert) return;
    revert();
    undos.current.delete(messageId);

    // The bubble loses its Undo button rather than disappearing: the thread is
    // a record of what happened, and it did happen.
    setThread((prev) =>
      prev.map((m) =>
        m.id === messageId && m.kind === "success"
          ? { ...m, canUndo: false, title: "Undone" }
          : m,
      ),
    );
  }, []);

  const reset = useCallback(() => {
    setThread([intro]);
    setSession(null);
    undos.current.clear();
  }, [intro]);

  return { thread, busy, session, submit, choose, confirm, undo, reset };
}
