import { useMemo } from "react";
import { Chat, useJanusChat } from "@janus-scheduler/react";
import type { EntityCatalog, PresentMessage } from "@janus-scheduler/nlp";

import { useNlpEngine } from "../chat/useNlpEngine";

/**
 * ChatLive — a debugging harness for the conversation, at `?chat=live`.
 *
 * It runs the SAME `useJanusChat` hook the docked chat runs, over a
 * fixed catalog and with **no commit attached** — so a parse card can be
 * inspected without writing to the store, and the gate inspector shows exactly
 * what the frozen layer decided for the current turn.
 *
 * Sharing the hook is the point: an inspector that reimplements the flow it is
 * meant to be inspecting is worse than no inspector at all.
 */

/** Fixed, so a route can be reproduced without depending on the demo's data. */
const CATALOG: EntityCatalog = {
  resources: [
    { id: "r1", name: "Room A", type: "room" },
    { id: "r2", name: "Conference Room B", type: "room", aliases: ["Conf B"] },
    { id: "r3", name: "Demo Room", type: "room" },
    { id: "r4", name: "Projector", type: "equipment" },
  ],
  participants: [
    { id: "p1", name: "Alex Rivera", type: "person" },
    { id: "p2", name: "Priya Nair", type: "person" },
    { id: "p3", name: "Sarah Chen", type: "person" },
  ],
};

const INTRO: PresentMessage = {
  id: "intro",
  role: "assistant",
  kind: "text",
  text: "Tell me what to schedule. I'll show you what I understood before anything happens.",
};

/** One per route, so every path is reachable without having to guess wording. */
const TRY_THESE: Array<{ label: string; text: string; note: string }> = [
  {
    label: "Fully specified",
    text: "Schedule a design sync with Alex tomorrow at 10am in Room A",
    note: "PROCEED — straight to a parse card",
  },
  {
    label: "Missing the time",
    text: "schedule a meeting with Alex",
    note: "CLARIFY · gate5_missing_slot — the slot-filling path",
  },
  {
    label: "Room, nothing else",
    text: "book the demo room",
    note: "CLARIFY · gate3b_resource_only — the parking case",
  },
  {
    label: "Negative phrasing",
    text: "i don't want the standup tomorrow at 9am",
    note: "CLARIFY · negation — confirm, never silently invert",
  },
  {
    label: "Not scheduling at all",
    text: "what's the weather like tomorrow",
    note: "REJECT — plain message, no card",
  },
];

export function ChatLive() {
  const engine = useNlpEngine();
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  // No `onConfirm`: this harness deliberately cannot write to the store, so a
  // parse card can be poked at repeatedly without leaving a trail.
  const chat = useJanusChat({
    engine: engine.status === "ready" ? engine.engine : null,
    catalog: CATALOG,
    timezone,
    intro: INTRO,
  });

  const { submit: handleSubmit, session, reset } = chat;

  return (
    <div className="chat-gallery" data-theme="light">
      <aside className="chat-gallery__rail">
        <h1 className="chat-gallery__title">Live conversation</h1>
        <p className="chat-gallery__lead">
          The real classifier, running in your browser, over a fixed catalog.
          Deliberately not wired to the store — for the one that actually
          schedules, use the AI bar on the main app.
        </p>

        <div className="chat-live__engine">
          {engine.status === "loading" && <span>Loading artifacts…</span>}
          {engine.status === "error" && (
            <span className="chat-live__error">
              Artifacts failed to load — {engine.message}
            </span>
          )}
          {engine.status === "ready" && (
            <span>
              {(engine.bytes / 1e6).toFixed(2)} MB fetched and decoded in{" "}
              {engine.ms} ms — never bundled
            </span>
          )}
        </div>

        <nav className="chat-gallery__nav">
          <div className="chat-gallery__log-title">Try these</div>
          {TRY_THESE.map((t) => (
            <button
              key={t.label}
              type="button"
              className="chat-gallery__tab chat-live__try"
              disabled={engine.status !== "ready"}
              onClick={() => handleSubmit(t.text)}
            >
              <strong>{t.label}</strong>
              <span className="chat-live__try-note">{t.note}</span>
            </button>
          ))}
          <button type="button" className="chat-gallery__tab" onClick={reset}>
            Clear the thread
          </button>
        </nav>

        <div className="chat-gallery__log">
          <div className="chat-gallery__log-title">What the gates decided</div>
          {!session ? (
            <div className="chat-gallery__log-empty">
              Send something — the route, gate, confidence and margin for the
              current turn show up here.
            </div>
          ) : (
            <dl className="chat-live__inspector">
              <dt>route</dt>
              <dd>{session.route.route}</dd>
              <dt>gate</dt>
              <dd>{session.route.gate ?? "—"}</dd>
              <dt>intent</dt>
              <dd>{session.route.intent}</dd>
              <dt>confidence</dt>
              <dd>{session.route.confidence.toFixed(3)}</dd>
              <dt>margin</dt>
              <dd>{session.route.margin.toFixed(3)}</dd>
              <dt>status</dt>
              <dd>{session.status}</dd>
              <dt>rounds</dt>
              <dd>{session.rounds}</dd>
              <dt>answered</dt>
              <dd>{session.satisfied.join(", ") || "—"}</dd>
              <dt>merged text</dt>
              <dd>{session.text}</dd>
              <dt>reason</dt>
              <dd>{session.route.reason}</dd>
              {session.softened && (
                <>
                  {/* The gates said REJECT and the session asked anyway. That
                      disagreement is worth showing, not smoothing over. */}
                  <dt>softened</dt>
                  <dd>{session.softened.note}</dd>
                </>
              )}
            </dl>
          )}
        </div>
      </aside>

      <section className="chat-gallery__stage">
        <p className="chat-gallery__note">
          Under-specify something on purpose — “schedule a meeting with Alex” —
          then answer the question it asks. The parse card should come back
          complete, with the time you gave it merged into the utterance.
        </p>
        <div className="chat-gallery__panel">
          <Chat
            messages={chat.thread}
            busy={chat.busy}
            theme="light"
            onChatSubmit={(d) => handleSubmit(d.prompt)}
            onChatClarifyResponse={(d) => chat.choose(d.label)}
            onChatConfirm={chat.confirm}
            onChatUndo={(d) => chat.undo(d.messageId)}
            onChatEdit={reset}
          />
        </div>
      </section>
    </div>
  );
}
