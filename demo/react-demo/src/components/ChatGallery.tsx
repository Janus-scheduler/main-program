import { useState } from "react";
import { Chat } from "@janus-scheduler/react";
import type { ChatMessage, ChatSuggestion } from "@janus-scheduler/react";

/**
 * ChatGallery — a fixture-driven harness for <janus-chat>.
 *
 * STEP 4 SCAFFOLD. There is no classifier here and no store: every scenario
 * below is hand-written data. That is the point — the component is a pure view,
 * so it can be reviewed against the design before any live wiring exists, and a
 * visual regression can be told apart from a classification regression.
 *
 * Step 6 replaces this with the real flow. Reach it at `?chat=1`.
 */

interface Scenario {
  id: string;
  label: string;
  /** What to look at, shown above the panel. */
  note: string;
  messages: ChatMessage[];
  suggestions?: ChatSuggestion[];
  busy?: boolean;
}

const INTRO: ChatMessage = {
  id: "intro",
  role: "assistant",
  kind: "text",
  text: "Hi! Tell me what to schedule — e.g. “Book Room A with Alex tomorrow at 10.”",
};

const USER_ASK: ChatMessage = {
  id: "u1",
  role: "user",
  kind: "text",
  text: "Schedule a design sync with Alex tomorrow at 10am in Room A",
};

const SCENARIOS: Scenario[] = [
  {
    id: "empty",
    label: "1 · Empty composer",
    note: "Send button is muted but still visible — the affordance stays, per the design. Placeholder in --janus-text-3.",
    messages: [INTRO],
  },
  {
    id: "typing",
    label: "2 · Typing → suggestions",
    note: "role=listbox above the composer, PEOPLE group heading, first row aria-selected with the Free badge. Try ↑/↓ and Escape.",
    messages: [INTRO],
    suggestions: [
      {
        id: "p1",
        label: "Alex Rivera",
        group: "PEOPLE",
        badge: "Free",
        kind: "person",
      },
      { id: "p2", label: "Alex Tan", group: "PEOPLE", kind: "person" },
      { id: "r1", label: "Room A", group: "ROOMS", kind: "place" },
    ],
  },
  {
    id: "thinking",
    label: "3 · Thinking",
    note: "Three dots, 1.2s stagger. Honours prefers-reduced-motion.",
    messages: [INTRO, USER_ASK],
    busy: true,
  },
  {
    id: "parse",
    label: "4 · Parse card (PROCEED)",
    note: "The end story. Chips are semantic: violet person, blue time, orange place. Confidence pill in success green. Nothing is written until Confirm.",
    messages: [
      INTRO,
      USER_ASK,
      {
        id: "a1",
        role: "assistant",
        kind: "parse",
        card: {
          chips: [
            { kind: "person", label: "Alex Rivera" },
            { kind: "time", label: "Wed 10:00 AM" },
            { kind: "place", label: "Room A" },
          ],
          confidence: 0.96,
        },
      },
    ],
  },
  {
    id: "parse-assumed",
    label: "4b · Parse card with assumptions",
    note: "What the resolver invented is shown, not hidden: dashed chip border plus the plain-English notes from ResolvedTime.assumptions.",
    messages: [
      INTRO,
      {
        id: "u2",
        role: "user",
        kind: "text",
        text: "book the quarterly review tomorrow",
      },
      {
        id: "a2",
        role: "assistant",
        kind: "parse",
        card: {
          title: "Quarterly review",
          lead: "Here's what I understood —",
          chips: [
            { kind: "time", label: "Thu 09:00 AM", assumed: true },
            { kind: "time", label: "60 min", assumed: true },
          ],
          confidence: 0.83,
          notes: [
            "no time of day given — assumed 09:00",
            "no duration given — assumed 60 minutes",
          ],
        },
      },
    ],
  },
  {
    id: "clarify",
    label: "5 · Needs clarification (CLARIFY)",
    note: "Warning-bordered card, tappable chip answers. ~39% of real traffic lands here — Step 5 makes these answers continue the conversation.",
    messages: [
      INTRO,
      {
        id: "u3",
        role: "user",
        kind: "text",
        text: "book Room Z for the vendor demo tomorrow",
      },
      {
        id: "a3",
        role: "assistant",
        kind: "clarify",
        question: "I couldn't find “Room Z.” Which room did you mean?",
        choices: [
          { id: "r1", label: "Room A" },
          { id: "r2", label: "Conference Room B" },
          { id: "all", label: "Show all" },
        ],
      },
    ],
  },
  {
    id: "modify",
    label: "6 · Reschedule card",
    note: "Monospaced before → after, old time struck through. Confirm label changes to match the action.",
    messages: [
      INTRO,
      {
        id: "u4",
        role: "user",
        kind: "text",
        text: "Move my 3pm standup to 4:30",
      },
      {
        id: "a4",
        role: "assistant",
        kind: "parse",
        card: {
          lead: "Reschedule",
          title: "Standup",
          chips: [],
          change: { from: "3:00 PM", to: "4:30 PM" },
          confirmLabel: "Confirm move",
        },
      },
    ],
  },
  {
    id: "destructive",
    label: "7 · Delete card",
    note: "Destructive framing for delete_event — red confirm, red card border. Matches the design's “Cancel this event?” treatment.",
    messages: [
      INTRO,
      {
        id: "u5",
        role: "user",
        kind: "text",
        text: "cancel tomorrow's vendor demo",
      },
      {
        id: "a5",
        role: "assistant",
        kind: "parse",
        card: {
          lead: "Cancel this event —",
          title: "Vendor demo",
          chips: [
            { kind: "time", label: "Thu 2:00 PM" },
            { kind: "place", label: "Conference Room B" },
          ],
          destructive: true,
          confirmLabel: "Cancel event",
          editLabel: "Keep it",
        },
      },
    ],
  },
  {
    id: "success",
    label: "8 · Scheduled (success)",
    note: "Green card, monospaced summary, View + Undo. Undo maps onto SchedulerManager's existing rollback in Step 6.",
    messages: [
      INTRO,
      USER_ASK,
      {
        id: "a6",
        role: "assistant",
        kind: "success",
        summary: "Design sync · Wed 10:00 · Room A",
        canUndo: true,
      },
    ],
  },
  {
    id: "reject",
    label: "9 · Declined (REJECT)",
    note: "REJECT has no card in the design — it is a plain assistant message. Correct reading of gates 2 and 3.",
    messages: [
      INTRO,
      {
        id: "u7",
        role: "user",
        kind: "text",
        text: "what's the weather like tomorrow",
      },
      {
        id: "a7",
        role: "assistant",
        kind: "text",
        text: "I can only help with scheduling — try “book Room A tomorrow at 10am”.",
      },
    ],
  },
  {
    id: "full",
    label: "10 · Full thread",
    note: "Everything together, with a Today divider. Check spacing rhythm, bubble tails, and that the thread auto-scrolls to the newest row.",
    messages: [
      { id: "d1", role: "assistant", kind: "divider", text: "Today" },
      INTRO,
      USER_ASK,
      {
        id: "a8",
        role: "assistant",
        kind: "parse",
        card: {
          chips: [
            { kind: "person", label: "Alex Rivera" },
            { kind: "time", label: "Wed 10:00 AM" },
            { kind: "place", label: "Room A" },
          ],
          confidence: 0.96,
        },
      },
      {
        id: "u9",
        role: "user",
        kind: "text",
        text: "yes, and add the projector",
      },
      {
        id: "a9",
        role: "assistant",
        kind: "success",
        summary: "Design sync · Wed 10:00 · Room A · Projector",
        canUndo: true,
      },
    ],
  },
];

/** Newest-first log of the events the component emitted. */
interface LoggedEvent {
  at: string;
  type: string;
  detail: string;
}

type Theme = "light" | "dark" | "auto";

const THEMES: Array<{ id: Theme; label: string; hint: string }> = [
  {
    id: "light",
    label: "Light",
    hint: "the default — matches the rest of Janus",
  },
  { id: "dark", label: "Dark", hint: "explicit opt-in" },
  { id: "auto", label: "Auto", hint: "follows your OS setting" },
];

export function ChatGallery() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[3].id);
  const [theme, setTheme] = useState<Theme>("light");
  const [log, setLog] = useState<LoggedEvent[]>([]);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];

  // The gallery chrome follows the same choice, so the panel is never a dark
  // rectangle sitting on a light page (or the reverse).
  const chromeIsDark =
    theme === "dark" ||
    (theme === "auto" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  const record = (type: string, detail?: unknown) => {
    setLog((prev) =>
      [
        {
          at: new Date().toLocaleTimeString(),
          type,
          detail: detail ? JSON.stringify(detail) : "",
        },
        ...prev,
      ].slice(0, 12),
    );
  };

  return (
    <div className="chat-gallery" data-theme={chromeIsDark ? "dark" : "light"}>
      <aside className="chat-gallery__rail">
        <h1 className="chat-gallery__title">&lt;janus-chat&gt;</h1>
        <p className="chat-gallery__lead">
          Step 4 · fixture-driven. No classifier, no store — every scenario is
          static data, so what you see is the component alone.
        </p>

        <div className="chat-gallery__themes" role="group" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.hint}
              className={
                "chat-gallery__theme" +
                (t.id === theme ? " chat-gallery__theme--active" : "")
              }
              onClick={() => setTheme(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <nav className="chat-gallery__nav">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={
                "chat-gallery__tab" +
                (s.id === scenarioId ? " chat-gallery__tab--active" : "")
              }
              onClick={() => setScenarioId(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="chat-gallery__log">
          <div className="chat-gallery__log-title">Events emitted</div>
          {log.length === 0 ? (
            <div className="chat-gallery__log-empty">
              Nothing yet — click Confirm, Edit, Undo, a chip answer, or send a
              message.
            </div>
          ) : (
            log.map((entry, i) => (
              <div key={i} className="chat-gallery__log-row">
                <span className="chat-gallery__log-time">{entry.at}</span>
                <span className="chat-gallery__log-type">{entry.type}</span>
                <span className="chat-gallery__log-detail">{entry.detail}</span>
              </div>
            ))
          )}
        </div>
      </aside>

      <section className="chat-gallery__stage">
        <p className="chat-gallery__note">{scenario.note}</p>
        <div className="chat-gallery__panel">
          <Chat
            key={scenario.id}
            theme={theme}
            messages={scenario.messages}
            suggestions={scenario.suggestions ?? []}
            busy={scenario.busy ?? false}
            showVoice
            onChatSubmit={(d) => record("chat-submit", d)}
            onChatConfirm={(d) => record("chat-confirm", d)}
            onChatEdit={(d) => record("chat-edit", d)}
            onChatClarifyResponse={(d) => record("chat-clarify-response", d)}
            onChatUndo={(d) => record("chat-undo", d)}
            onChatView={(d) => record("chat-view", d)}
            onChatSuggestionSelect={(d) => record("chat-suggestion-select", d)}
            onChatClose={() => record("chat-close")}
          />
        </div>
      </section>
    </div>
  );
}
