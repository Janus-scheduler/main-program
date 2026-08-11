import { useCallback, useEffect, useMemo, useRef } from "react";
import { Chat, useJanusChat } from "@janus-scheduler/react";
import type { SchedulerManager } from "@janus-scheduler/react";
import type {
  SessionRequirements,
  SessionState,
  PresentMessage,
} from "@janus-scheduler/nlp";

import { useNlpEngine } from "../chat/useNlpEngine";
import { catalogFromResources, commitSession } from "../chat/commitToScheduler";

/**
 * ChatDock — the conversation panel, docked over the scheduler.
 *
 * The design's own framing: _"The clean input is the entry point — pressing it
 * opens a full conversation."_ So `<janus-ai-bar>` stays exactly where it was
 * and this opens on top of it; every existing `ai-submit` consumer is
 * untouched.
 *
 * This is where verify-then-act finally closes. `onConfirm` is the only route
 * from this feature to `SchedulerManager`, and it is reachable only from a
 * parse card the user has pressed Confirm on.
 */

const INTRO: PresentMessage = {
  id: "intro",
  role: "assistant",
  kind: "text",
  text: "Tell me what to schedule. I'll show you what I understood before anything is added.",
};

/**
 * What THIS app considers a complete event.
 *
 * The frozen gates only ever require a time — enough for the classifier to be
 * sure of the intent, not enough to create anything. "schedule a meeting at
 * 5pm today" clears every gate with no room and nobody in it, and without this
 * it would go straight to a confirmable card and land on whichever row happens
 * to be first.
 *
 * `resource` covers people and rooms alike: both are rows on the timeline, and
 * `Event.isValid()` requires at least one.
 */
const REQUIRES: SessionRequirements = {
  add_event: ["when", "resource"],
  // Moving an event needs a new time; the target is resolved by title at
  // commit time, which refuses rather than guesses.
  modify_event: ["when"],
};

interface ChatDockProps {
  manager: SchedulerManager;
  open: boolean;
  /** Sent as the first utterance when the dock opens. */
  initialPrompt: string | null;
  onClose: () => void;
}

export function ChatDock({
  manager,
  open,
  initialPrompt,
  onClose,
}: ChatDockProps) {
  const engine = useNlpEngine();

  // The LIVE store is the catalog. This is the whole reason `extractEntities`
  // takes the catalog as a parameter rather than importing anything from core:
  // real rooms and real people resolve, and the frozen 23-name research corpus
  // ("sarah", "marketing", "parking") never reaches a user's screen.
  const resources = manager.getAllResources();
  const rosterKey = resources
    .map((r) => `${r.id}:${r.name}:${r.type}`)
    .join("|");
  const catalog = useMemo(
    () => catalogFromResources(resources),
    // Rebuild when the roster actually changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rosterKey],
  );

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  const handleConfirm = useCallback(
    (state: SessionState) => {
      const result = commitSession(manager, state, resources[0]?.id);
      return result.ok
        ? { ok: true, message: result.summary, undo: result.undo }
        : { ok: false, message: result.message };
    },
    [manager, resources],
  );

  const chat = useJanusChat({
    engine: engine.status === "ready" ? engine.engine : null,
    catalog,
    timezone,
    intro: INTRO,
    requires: REQUIRES,
    // Only reached if the user SKIPS the resource question — and the card says
    // so, with a dashed chip and a note, before Confirm is available.
    fallbackResourceName: resources[0]?.name,
    onConfirm: handleConfirm,
  });

  // Deliver the prompt that opened the dock, once — and only once the engine
  // is actually up, or it would be dropped on the floor.
  const delivered = useRef<string | null>(null);
  const { submit } = chat;
  useEffect(() => {
    if (!open || engine.status !== "ready") return;
    if (!initialPrompt || delivered.current === initialPrompt) return;
    delivered.current = initialPrompt;
    submit(initialPrompt);
  }, [open, engine.status, initialPrompt, submit]);

  // Forget the delivered prompt when the dock closes, so reopening with the
  // same text sends it again.
  useEffect(() => {
    if (!open) delivered.current = null;
  }, [open]);

  if (!open) return null;

  return (
    <div className="chat-dock">
      <div className="chat-dock__panel">
        <Chat
          messages={chat.thread}
          busy={chat.busy || engine.status === "loading"}
          theme="light"
          showClose
          placeholder={
            engine.status === "ready"
              ? "Ask me to schedule something…"
              : "Loading the language model…"
          }
          onChatSubmit={(d) => chat.submit(d.prompt)}
          onChatClarifyResponse={(d) => chat.choose(d.label)}
          onChatConfirm={chat.confirm}
          onChatUndo={(d) => chat.undo(d.messageId)}
          onChatEdit={chat.reset}
          onChatClose={onClose}
        />
      </div>
    </div>
  );
}
