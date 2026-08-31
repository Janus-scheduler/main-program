**Ready for review**

Select text to add comments on the plan

# s Conversational depth: make the chat behave like a chat

## Context

The chat already asks follow-up questions. `session.ts` turns every `CLARIFY` route into a question, merges the answer, and re-runs the frozen ladder. That machinery works and is not what needs building.

What is missing is everything that makes an exchange feel like a conversation rather than a form:

| SymptomWhere it comes from                                                                                              |                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users see **"confidence 0.32 below floor 0.45"**                                                                        | `presentSession.ts:250` renders `state.reason` — engineer diagnostics — straight into the refusal bubble                                                                                                                                                         |
| A question arrives with **no context**. "When should this be?" with no sign that "design sync with Alex" was understood | `presentSession.ts:232-243` builds the `clarify` message from `question` + `choices` only and **discards \*\***`state.draft`\*\* — even though `types.ts:400-404` says the draft is populated during `awaiting` precisely so a UI can show partial understanding |
| **No acknowledgement.** Answer "Room A" and the next question appears with no "got it"                                  | Nothing derives prose from `state.answers`                                                                                                                                                                                                                       |
| **Dead end after two tries**: *"still unclear after 2 questions - starting over will be quicker"*                       | `session.ts:539`                                                                                                                                                                                                                                                 |
| **"hi" / "thanks" / "what can you do?" get a cold refusal**                                                             | No domain anchor → `gate3_no_anchor` → REJECT                                                                                                                                                                                                                    |
| **An answer that doesn't parse silently re-asks the same question**                                                     | `provideAnswer` returns `next()` with no signal that the answer was unusable — `session.ts:734`, `751`, `762`                                                                                                                                                    |
| **"Edit" wipes the entire conversation**                                                                                | `ChatDock.tsx:146` — `onChatEdit={chat.reset}`                                                                                                                                                                                                                   |

### Two findings that shape the work

**1. The live path is not what the status report says.** It is `ChatDock → useJanusChat` (react-wrapper `index.ts:119`) `→ ChatController` (`nlp/src/controller.ts`) `→ session.ts` + `presentSession.ts`. The *demo* files `demo/react-demo/src/chat/useChatConversation.ts` and `demo/react-demo/src/chat/presentSession.ts` are **dead** — nothing imports them. `docs/NLP_CODE_MAP.md` §9 and `docs/NLP_STATUS_REPORT.md` both say the reverse and need correcting.

**2. Text-append cannot express a correction.** `toTimeSpan` merges mentions with `??=` (`datetime.ts:401`) — **first mention wins**. Appending "actually Friday at 5pm" to "…tomorrow at 3pm…" keeps *tomorrow 3pm* and silently drops the correction. Any edit feature built on appending is wrong.

The way through: `TimeSpan` and `EntityMatch extends TextSpan` both carry `start`/`end` offsets into the accumulated text (`types.ts:281`), so a correction can **splice** — cut the old phrase out, put the new one in, re-run the whole pipeline on the result. The draft stays a pure function of one string and the frozen invariant is untouched.

### Non-goals

No XState (it would break the zero-dependency guarantee in `packages/nlp`, and the slot loop is a fold over an accumulating string, not a transition graph). No LLM. No change to any file in the frozen zone — `constants · normalize · wordpiece · embed · preprocess · classify · gates` are not edited by this plan.

**Renumbering:** the polish work previously called Step 7 (design tokens, responsive, a11y, CI wiring for the nlp suite) becomes **Step 8**.

---

## Step 7A — Single shipping path, and no races

Foundation. Nothing conversational is worth building on two diverging copies.

**Delete the dead duplicates:** `demo/react-demo/src/chat/useChatConversation.ts` and `demo/react-demo/src/chat/presentSession.ts`. Confirm with a repo-wide grep that nothing imports them first.

**Fix \*\***`packages/nlp/src/controller.ts`\***\*:**

- Keep the pending `setTimeout` id on the instance; **cancel it** in `submit()` and `reset()`. Today a second submit inside the 220 ms window queues a second `evaluate` against the same `this.session`.
- Ignore `submit()` while `this.busy` is true.
- `correctSpelling` comes from `JanusChatOptions`, defaulting to `true` — it is hardcoded at `controller.ts:99`.
- **Delete the \*\***`ExternalSchedulerManager`\***\* branch** (`controller.ts:24-27`, `149-182`). It handles only `add_event`, drops participants via `draft.resources[0]?.id`, and falls back to `new Date().toISOString()` — silently scheduling "now" when no time resolved. `ChatDock` does not pass `manager`; it passes `onConfirm`, which reaches `commitSession` and handles all four intents correctly. Remove the export from `index.ts` too.

**Add a \*\***`disabled`\***\* property to \*\***`<janus-chat>`\*\* (`packages/ui/src/janus-chat.ts`) that disables the composer input, the send button and every choice button. `busy` currently only appends a thinking bubble (`janus-chat.ts:232`); it does not stop input. Wire `disabled=${chat.busy}` in `ChatDock.tsx`.

---

## Step 7B — Never show a user a gate reason

**`packages/nlp/src/presentSession.ts`** — add a `FiredGate → human copy` map and rewrite the `declined` branch (currently `presentSession.ts:245-252`). `state.reason` stays on the state for diagnostics and is never rendered.

| GateWhat the user reads |                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `gate1_confidence`      | "I didn't quite follow that. Try something like **book Room A tomorrow at 10am**."        |
| `gate2_nearest_none`    | "That doesn't look like a scheduling request. I can add, move, cancel or look up events." |
| `gate3_no_anchor`       | "I need something to go on — a time, a room, or a person."                                |
| round cap               | see 7D                                                                                    |

Each carries 2–3 tappable example chips, so a refusal is a starting point rather than a wall.

---

## Step 7C — Questions that carry context

**`packages/ui/src/chat-types.ts`** — extend `ChatClarifyMessage`:

```
export interface ChatClarifyMessage extends ChatMessageBase {
  kind: "clarify";
  role: "assistant";
  /** "Got it — Room A." Acknowledges the previous answer. */
  ack?: string;
  /** What is understood so far, same shapes as a parse card. */
  chips?: ChatChip[];
  question: string;
  choices?: ChatChoice[];
  /** "1 more to go" — remaining required slots. */
  progress?: string;
}

```

**`packages/nlp/src/session.ts`** — add `outstanding: RequiredSlot[]` to `SessionState`, computed in `evaluate()` from `ctx.requires?.[draft.intent]` filtered through the existing `slotIsFilled` (`session.ts:321`). Compute it on every path, not only `PROCEED`, so a gate question can show progress too.

**`packages/nlp/src/presentSession.ts`** — populate the new fields:

- `chips` — reuse the existing `draftChips(state, options)` unchanged.
- `ack` — from the last entry of `state.answers`: its `merged` value ("in Room A" → "Got it — Room A."), or "No problem, skipping that." when `skipped`. Omitted on the first turn.
- `progress` — from `state.outstanding.length`.

**`packages/ui/src/janus-chat.ts`\*\*** + \***\*`chat-styles.ts`** — render the three new fields in the `clarify` branch (`janus-chat.ts:342`). Chips reuse the existing parse-card chip markup and classes; nothing new to style there.

---

## Step 7D — Recover instead of repeating

**`packages/nlp/src/session.ts`** — add `unresolved?: SlotName` to `SessionState`, set on the four paths that currently re-ask in silence:

| PathLineSet when |           |                                               |
| ---------------- | --------- | --------------------------------------------- |
| empty answer     | `734`     | always                                        |
| `confirm`        | `748-752` | neither affirmative nor negative              |
| `intent`         | `762`     | no choice matched                             |
| `when`           | `819`     | `parseTimeSpan(trimmed)` returned `undefined` |

`presentSession` turns it into a lead on the re-ask: *"I didn't catch a time in that — try 'tomorrow at 2pm', or tap one below."*

**Rewrite the round-cap exit** (`session.ts:533-541`). Instead of "starting over will be quicker", offer what exists: if `draft` has anything usable, offer **[Open the editor with what I have]** and **[Start over]**. `MAX_CLARIFY_ROUNDS` stays 2 — the fix is the exit, not the count.

---

## Step 7E — Greetings, thanks and help

New file **`packages/nlp/src/smalltalk.ts`**. Same architectural position as `spelling.ts`: a pre-filter that runs **before** the pipeline, imports no frozen module except `hasDomainAnchor`, and adds no dependency.

```
export type SmalltalkKind = "greeting" | "thanks" | "farewell" | "help";
export function classifySmalltalk(text: string): SmalltalkKind | null;

```

Three guards, all mandatory — this must never swallow a real request:

1. **Never while a session is awaiting.** Enforced in `ChatController.submit`, not here — otherwise "no" answering a negation confirm gets eaten.
2. **Only when \*\***`!hasDomainAnchor(text)`\***\*.** "cancel the 3pm review" is never intercepted.
3. **Only under \~4 words**, matched against a short closed list. Bare "cancel", "yes" and "no" are deliberately **not** on it.

`help` returns a capability card listing the four intents with a tappable example for each — this is the recovery path for a user who has no idea what to type.

---

## Step 7F — Correcting what was understood

The largest step. Two entry points, one mechanism.

### The mechanism: splice, then re-run

New **`packages/nlp/src/revise.ts`**:

```
export function reviseSlot(
  state: SessionState,
  slot: RequiredSlot,
  replacement: string,
  ctx: SessionContext,
): SessionState;

```

It rebuilds `state.text` by cutting the old span and inserting the replacement, then calls the same `evaluate()` every other turn goes through. No gate is skipped; the whole ladder re-runs on the new sentence.

| SlotSpan source |                                                                                                                                                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `when`          | `draft.timeSpan.start/end`                                                                                                                                                                                                                                             |
| `resource`      | `draft.resources[0]` / `participants[0]` — `EntityMatch extends TextSpan`. Preserve the leading preposition, as `provideAnswer`'s `resource` case already does (`session.ts:785`)                                                                                      |
| `title`         | **No span exists today** — `ExtractedEntities.title` is assembled from the remainder (`entities.ts:365`). Add a `titleSpan?: TextSpan` output to `extractEntities` covering the region `titleFromRemainder` already computes. Additive, Zone 2, no frozen file touched |

Also update `state.utterances` so the replayed conversation is not stale.

### Entry point 1 — the Edit button

`onChatEdit` stops calling `chat.reset()`. Instead `ChatController.edit()` puts the session into `awaiting` with a slot-picker question:

```
Sure — what should I change?
[ Time ]  [ Room or person ]  [ Title ]  [ Never mind ]

```

Picking a slot asks for that slot with its normal chips; the answer goes through `reviseSlot`. "Never mind" returns to the card unchanged.

### Entry point 2 — typed correction

While `status === "ready"`, an utterance opening with a closed cue list — `actually`, `no wait`, `make it`, `change it to`, `instead` — is a revision, not a new request. Strip the cue, infer the slot from what the remainder parses as (a time phrase → `when`; a catalog hit → `resource`), and call `reviseSlot`. When nothing parses, fall through to the normal path rather than guessing.

---

## Files touched

```
packages/nlp/src/
  controller.ts     7A  timer cancellation, busy guard, delete manager branch
  session.ts        7C  outstanding[]   7D  unresolved, round-cap exit
  presentSession.ts 7B  gate copy       7C  ack/chips/progress   7D  recovery leads
  smalltalk.ts      7E  NEW
  revise.ts         7F  NEW
  entities.ts       7F  titleSpan output
  types.ts          7C 7D 7F  SessionState + SmalltalkKind
  index.ts          7A 7E 7F  exports

packages/ui/src/
  janus-chat.ts     7A  disabled       7C  clarify ack/chips/progress
  chat-types.ts     7C  ChatClarifyMessage fields
  chat-styles.ts    7C  clarify card layout

demo/react-demo/src/
  components/ChatDock.tsx   7A  disabled   7F  onChatEdit → chat.edit()
  chat/useChatConversation.ts   7A  DELETE (dead)
  chat/presentSession.ts        7A  DELETE (dead)

packages/wrappers/react-wrapper/index.ts   7F  expose edit() on the hook
docs/NLP_CODE_MAP.md · docs/NLP_STATUS_REPORT.md   correct the controller claim

```

---

## Verification

Per the standing process: **one step at a time, real output pasted, park at 🟦 awaiting your browser check, no work starts on the next step until sign-off.**

Every step:

```
npm test -w @janus-scheduler/nlp     # was 1423 passing
npm run lint                         # exit 0
npm run validate                     # exit 0

```

`gates.ts` must stay at **100% statement and branch coverage** and the frozen files must show a zero diff — `git diff --stat packages/nlp/src/{constants,normalize,wordpiece,embed,preprocess,classify,gates}.ts` returns nothing.

New tests, per step:

- **7A** — a second `submit` inside 220 ms is ignored; `reset` cancels a pending timer.
- **7B** — no rendered message contains a gate id, a floor value, or the substring "confidence 0." Assert over every `FiredGate`.
- **7C** — a clarify state with a partial draft yields chips; `outstanding` shrinks by one per filled slot; `ack` is absent on turn one.
- **7D** — "sometime soon" answering "when?" sets `unresolved: "when"`; the round-cap state offers choices rather than a dead end.
- **7E** — `classifySmalltalk` returns `null` for every one of the 237 routing fixture utterances (it must never intercept a real request); "no" during an `awaiting` session reaches `provideAnswer`, not the pre-filter.
- **7F** — **the regression that motivates this step**: "book design sync tomorrow at 3pm in Room A" then a `when` revision to "Friday at 5pm" resolves to **Friday 17:00**, not tomorrow 15:00. Plus: revision re-runs every gate; revising a slot into an invalid state re-asks rather than committing.

Browser check at `http://localhost:5174/` after each step, driving the real `ChatDock` — the scripted scenarios in `ChatGallery.tsx` do not exercise `session.ts` and are not sufficient evidence.

Add Comment
