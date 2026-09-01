import { useCallback, useMemo } from "react";
import { Chat, useJanusChat, schedulerStore } from "@janus-scheduler/react";
import type { SchedulerManager } from "@janus-scheduler/react";
import { catalogFromResources, commitSession } from "@janus-scheduler/nlp";
import type {
  SessionRequirements,
  SessionState,
  PresentMessage,
} from "@janus-scheduler/nlp";

import { useNlpEngine } from "../chat/useNlpEngine";

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
  // `title` is last on purpose: ask for the concrete things first, and only
  // then the name. Without it an unnamed event was silently created as
  // "New Event" — a default the user never saw offered and never agreed to.
  add_event: ["when", "duration", "resource", "title"],
  // Moving an event needs a new time; the target is resolved by title at
  // commit time, which refuses rather than guesses.
  modify_event: ["when"],
};

interface ChatSidebarProps {
  /**
   * Same policy the timeline enforces.
   *
   * Must be passed through: the chat commits via the same manager as a drag,
   * but `SchedulerManager.addEvent` runs no conflict check, so with this ON
   * the timeline blocked a double-booking and the chat created it anyway.
   */
  preventConflicts?: boolean;
  manager: SchedulerManager;
}

export function ChatSidebar({
  manager,
  preventConflicts = false,
}: ChatSidebarProps) {
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

  // Read at the start of each turn, from the SAME zone the timeline renders
  // in. It used to be the browser's zone, captured once in a `useMemo` with an
  // empty dependency list — so after changing the display timezone the card
  // would say 3:00 PM and the timeline would draw the block somewhere else.
  const timezone = useCallback(() => schedulerStore.getState().timezone, []);

  const handleConfirm = useCallback(
    (state: SessionState) => {
      const result = commitSession(manager, state, resources[0]?.id, {
        preventConflicts,
      });
      return result.ok
        ? { ok: true, message: result.summary, undo: result.undo }
        : { ok: false, message: result.message };
    },
    [manager, resources, preventConflicts],
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

  return (
    <div className="chat-sidebar">
      <div className="chat-sidebar__panel">
        <Chat
          messages={chat.thread}
          busy={chat.busy || engine.status === "loading"}
          disabled={chat.busy || engine.status === "loading"}
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
          // NOT `chat.edit?.() ?? chat.reset()`. `edit()` returns void, so the
          // `??` ALWAYS fell through and reset the thread: pressing Edit did
          // the edit and then wiped the conversation.
          onChatEdit={() => {
            if (chat.edit) chat.edit();
            else chat.reset();
          }}
        />
      </div>
    </div>
  );
}
