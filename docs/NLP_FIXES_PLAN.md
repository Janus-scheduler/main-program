# NLP Fixes — Implementation Plan

**Status:** proposed, not started
**Source:** review of `b77e878` (`feat: improvements in nlp module phase 1`)
**Baseline:** 1446 tests passing, 11 suites. None of the defects below are covered.

---

## Context

Steps 7A–7F landed and most of the work is sound: `disabled` is wired through
the composer, the busy-guard and timer cancellation are in, `when`-slot answers
do proper span replacement, and the `duration` slot and `pastRelativeWeekday`
disambiguation are new and working. The frozen zone is untouched.

Twelve defects survive. They were found by running the built package, not by
reading it — every "observed" block below is real output. They fall into three
groups:

1. **Two write the wrong data silently** — the user confirms a card that says
   one thing and gets another.
2. **Three trap the user** — loops and dead ends with no way out.
3. **Seven degrade the conversation** — leaked internals, wrong counts, dead
   code paths.

### Zone rules that constrain these fixes

`constants.ts · normalize.ts · wordpiece.ts · embed.ts · preprocess.ts ·
classify.ts · gates.ts` are **frozen** and are not edited by this plan. In
particular the duration fix below touches `datetime.ts` (Zone 2, additive) and
**must not** touch `TIME_PATTERNS` in `constants.ts` — that list is the gate
anchor, it is pinned by the 237-row routing fixture, and duration answers never
need a gate anchor because they are host requirements asked after `PROCEED`.

Verify after every step:

```bash
cd packages/nlp && npx jest            # must stay green, count only goes up
git diff --stat packages/nlp/src/{constants,normalize,wordpiece,embed,preprocess,classify,gates}.ts
#   ^ must print nothing
npm run lint && npm run validate       # both exit 0
```

---

# Phase 1 — Stop writing wrong data

Do these first. A dead end wastes a minute; a wrong event goes in the calendar
and nobody notices.

## Fix 1 — Every fractional duration becomes 5 hours

**Severity:** critical · **Effort:** ~10 min

### Observed

```
"1.5 hours"  -> durationMinutes = 300   (expected 90)
"2.5 hrs"    -> durationMinutes = 300   (expected 150)
"0.5 hours"  -> durationMinutes = 300   (expected 30)
```

### Root cause

`packages/nlp/src/datetime.ts:310`

```ts
{ kind: "duration", re: /\b(\d+)\s+(minutes?|mins?|hours?|hrs?)\b/gi },
```

`\b(\d+)` cannot span a decimal point. On `"1.5 hours"` the match fails at
index 0 (`\s+` cannot match `.`), restarts at the `5` — where `.`→`5` is a word
boundary — and captures `"5"`. `durationOf` (`datetime.ts:505`) then computes
`5 * 60 = 300`. The rule is general: **it always captures the digits after the
decimal point.** `"1.25 hours"` becomes 25 hours.

### Change

`datetime.ts:310` — allow an optional fractional part, and allow the unit to
sit flush against the number (see Fix 12):

```ts
{ kind: "duration", re: /\b(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)\b/gi },
```

`durationOf` needs no change — `Number(m[1])` already handles `1.5`, and
`Number.isFinite` already guards. Confirm `n * 60` yields `90`, not `90.0000001`
(it does; 1.5 and 60 are both exact in binary floating point).

### Tests to add — `tests/datetime.test.ts`

| Input         | Expected `durationMinutes` |
| ------------- | -------------------------- |
| `"1.5 hours"` | 90                         |
| `"2.5 hrs"`   | 150                        |
| `"0.5 hours"` | 30                         |
| `"45 mins"`   | 45 (regression)            |
| `"45mins"`    | 45 (new, Fix 12)           |
| `"2hrs"`      | 120 (new, Fix 12)          |
| `"an hour"`   | 60 (regression)            |
| `"a day"`     | 480 (regression)           |

### Risk

`\s*` makes the regex slightly greedier. Confirm `"3pm"` is still a clock and
not a duration — it is, `pm` is not in the unit alternation — and re-run the
routing fixture to be certain nothing shifted.

---

## Fix 2 — The Edit button produces an event nobody asked for

**Severity:** critical · **Effort:** ~2–3 h

### Observed

```
"book Room A tomorrow at 3pm"   -> card: Mon 3:00 PM, 1 hr
press Edit, type "5pm"          -> card: Mon 3:00 PM, 2 hr
accumulated text: "book Room A tomorrow at 3pm 5pm"
title: undefined  (card reads "New Event")
```

The time did not change **and** the duration silently became 2 hours, because
`"3pm 5pm"` parses as a start→end range. The user asked to move the meeting and
got a two-hour 3pm meeting instead.

Typing `"actually 5pm"` works correctly (verified: rewrites to
`"book Room A tomorrow 5pm"`, 1 hr). So the feature works only when the user
happens to include a correction cue.

### Root cause

`packages/nlp/src/controller.ts:292`

```ts
question: {
  slot: "title",     // dummy slot to allow any text reply
  ...
}
```

`provideAnswer`'s `case "title"` appends the reply verbatim
(`session.ts:1000`). Everything typed after Edit is treated as title text.

### Change

**Step 2a — carry `titleSpan` into the draft.** `titleFromRemainder` already
returns a `TextSpan` and `extractEntities` already exposes it
(`entities.ts:404-416`, `types.ts:329`), but `buildDraft` drops it. Add
`titleSpan?: TextSpan` to `SessionDraft` (`types.ts:~322`) and pass it through
`buildDraft` (`session.ts:208`). **This means all three editable slots already
have spans** — no new extraction work is needed.

**Step 2b — a real edit question.** Add `"revise"` to `SlotName`. `edit()`
becomes:

```
"Sure — what should I change?"
[ Time ]  [ Room or person ]  [ Title ]  [ Never mind ]
```

**Step 2c — route the answer by slot, not by cue.** Picking a chip asks for
that one slot with its normal choices; the reply goes through `reviseSlot` with
the matching span:

| Slot       | Span                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| `when`     | `draft.timeSpan`                                                                                            |
| `resource` | `draft.resources[0]` / `draft.participants[0]` — preserve the preposition, as `session.ts:983` already does |
| `title`    | `draft.titleSpan` (new from 2a)                                                                             |

**Step 2d — delete the cue-sniffing branch from `submit()`.** The
`CORRECTION_RE` block (`controller.ts:126-143`, `161-184`) becomes redundant for
the Edit path. Keep it **only** for unprompted typed corrections
(`"actually 5pm"` with no Edit press), and gate it on
`this.session.status === "ready"` so it can never intercept an answer to a
pending question.

"Never mind" returns to the card unchanged.

### Tests to add — `tests/revise.test.ts`

- Edit → Time → `"5pm"` on a 3pm booking ⇒ **17:00, duration unchanged at 60**.
  This is the regression that motivates the whole fix.
- Edit → Room → `"Room B"` ⇒ resources `["Room B"]`, not `["Room A","Room B"]`.
- Edit → Title → `"standup"` ⇒ title `"standup"`, time and room unchanged.
- Edit → Never mind ⇒ state identical to before the Edit press.
- Every revision path re-runs the full gate ladder (assert `route.gate` is
  recomputed, not carried).

### Risk

Largest change in the plan. `reviseSlot` currently restarts the session — do
**Fix 6 first or together**, or every edit will re-ask questions the user has
already answered.

---

# Phase 2 — Stop trapping the user

## Fix 3 — The round-cap escape hatch is an infinite loop

**Severity:** high · **Effort:** ~1 h

### Observed

```
t0 -> "When would you like Room A?"
t1 -> "When would you like Room A?"          rounds: 1
t2 -> "I'm still having trouble..."          rounds: 2
t3 -> "When would you like Room A?"          rounds: 0    <- reset
answering 'edit'       -> "When would you like Room A?"
answering 'start over' -> "When would you like Room A?"
```

### Root cause — two independent bugs

**(a) The buttons are inert.** `session.ts:607-617` builds the escape hatch on
`slot: "confirm"` with values `"edit"` and `"start over"`. `provideAnswer`'s
`case "confirm"` (`session.ts:~885`) only tests `AFFIRMATIVE_RE` / `NEGATIVE_RE`;
neither value matches either, so both fall to `next({ unresolved: "confirm" })`.

**(b) The cap resets.** `session.ts:595` — `spent = input.lastSlot ===
question.slot ? rounds : 0`. After the escape hatch (slot `confirm`) the next
question is `when`, so `lastSlot !== question.slot` and the counter resets to
zero. The cycle repeats forever.

### Change

**(a) Give the hatch its own slot and real actions.** Add `"escape"` to
`SlotName` and handle it explicitly in `provideAnswer`. Offer only actions the
session can actually perform — no host hook needed:

| Stuck on                                                                     | Choices                                       |
| ---------------------------------------------------------------------------- | --------------------------------------------- |
| a **host requirement** (`when`/`resource`/`title`/`duration` via `requires`) | `[ Skip that and continue ]` `[ Start over ]` |
| a **gate** (`gate5_missing_slot`, `gate3b_resource_only`, …)                 | `[ Start over ]` only                         |

`Skip that and continue` reuses the existing mechanism — push the stuck slot
into `state.skipped`, which `requirementQuestion` already honours
(`session.ts:409`) — so the session reaches `ready` with the fallback disclosed
on the card. **Gates are never skippable**; that invariant is not relaxed here,
which is why the gate case offers only "start over".

`Start over` returns `status: "declined"` with a friendly reason; the controller
calls `reset()` on seeing it.

**(b) Add a non-resetting ceiling.** Keep per-slot consecutive counting for the
normal case, and add `totalRounds: number` to `SessionState` that increments on
every answer and never resets. At `totalRounds >= 6`, decline unconditionally.

### Tests to add — `tests/session.test.ts`

- Three unusable answers to one slot ⇒ escape hatch appears.
- `"Skip that and continue"` ⇒ `status: "ready"`, stuck slot in `skipped`.
- `"Start over"` ⇒ `status: "declined"`.
- A gate-stuck session offers **no** skip option.
- **Loop guard:** 10 consecutive unusable answers ⇒ `declined`, never
  `awaiting`. Assert `totalRounds` is monotonic across the whole conversation.

---

## Fix 4 — Smalltalk swallows answers mid-question

**Severity:** high · **Effort:** ~30 min

### Observed

```
"schedule a design sync tomorrow at 10am"
  -> "Which room or person is design sync for?"  [Room A, Sarah Chen, Skip]
"help"
  -> "Try asking me to book a room..."       <- question orphaned, still awaiting

classifySmalltalk("Help Desk") -> "help"     <- a real room name
classifySmalltalk("what can you do") -> null <- the main help phrase is dead
```

### Root cause — three bugs in one small file

1. **No awaiting guard.** `controller.ts:97` calls `classifySmalltalk` before
   checking whether a question is pending. The "never while awaiting" guard from
   the design was never implemented.
2. **Prefix matching.** `smalltalk.ts:8` — `HELP_RE = /^\s*(help|…)\b/i` matches
   the _start_ of `"Help Desk"`. Any room named _Help Desk_, _Options_ or
   _Commands_ is offered as a chip and then eaten when tapped.
3. **Off-by-one word cap.** `smalltalk.ts:18` — `if (words.length >= 4) return
null` rejects `"what can you do"` (4 words) and `"how does this work"` (4).
   Only `help` / `stuck` / `commands` / `options` survive.

### Change

**In `controller.ts:97`** — skip the branch entirely while a question is open:

```ts
const pending = this.session?.status === "awaiting";
const smalltalk = pending ? null : classifySmalltalk(text);
```

**In `smalltalk.ts`** — anchor every pattern to the whole utterance and drop the
word counter, which becomes redundant:

```ts
const HELP_RE =
  /^\s*(help|what can you do|what can i say|how does this work|commands|options|stuck)\s*[?!.]*\s*$/i;
```

…and the same `^…$` treatment for greeting / thanks / farewell.

**Belt and braces** — accept an optional catalog and return `null` when the text
matches an entry name or alias, so a room called "Help" is safe even if a future
pattern regresses:

```ts
export function classifySmalltalk(
  text: string,
  catalogNames?: string[],
): SmalltalkKind | null;
```

Keep the existing `hasDomainAnchor` guard unchanged — it is what stops
`"cancel the 3pm review"` being intercepted.

### Tests to add — `tests/smalltalk.test.ts` (new file)

- `"what can you do"`, `"what can you do?"`, `"how does this work"` ⇒ `"help"`.
- `"Help Desk"`, `"Options Room"`, `"Commands"` as a **catalog name** ⇒ `null`.
- **Fixture sweep:** `classifySmalltalk` returns `null` for all 237 routing
  fixture utterances. This is the test that stops it ever swallowing a real
  request.
- Controller-level: `"help"` while `awaiting` reaches `provideAnswer`, not the
  smalltalk branch.

---

## Fix 5 — "Got it" — then the same question again

**Severity:** high · **Effort:** ~20 min

### Observed

```
"book Room A"    -> "When would you like Room A?"
"sometime soon"
  unresolved:        "when"
  rendered ack:      "Got it — sometime soon."
  rendered question: "When would you like Room A?"
```

It confirms understanding of an answer it just rejected, then repeats itself
verbatim. This is the single most broken-feeling path in the product.

### Root cause

`presentSession.ts:294` reads `state.unresolved` only inside the `declined`
branch. But `provideAnswer` sets `unresolved` while returning an **awaiting**
state (`session.ts:873, 890, 901, 928, 1016`), so the recovery lead is dead
code, and the `ack` at `presentSession.ts:257-261` fires unconditionally on the
last answer.

### Change

In the `awaiting` branch of `presentSession`:

1. Suppress `ack` when `state.unresolved === state.question.slot`.
2. Emit a recovery lead instead, per slot:

| Slot       | Lead                                                                        |
| ---------- | --------------------------------------------------------------------------- |
| `when`     | "I didn't catch a time in that — try 'tomorrow at 2pm', or pick one below." |
| `duration` | "I didn't catch a length — try '45 mins' or 'until 4pm'."                   |
| `resource` | "I don't have anyone or anywhere by that name — pick one below."            |
| `intent`   | "Pick one of these so I know what to do."                                   |
| `confirm`  | "A yes or a no is all I need."                                              |

Delete the now-duplicated block at `presentSession.ts:294-299`.

### Tests to add — `tests/presentSession.test.ts`

- Unusable `when` answer ⇒ `ack` is `undefined` **and** the lead is present.
- Usable answer ⇒ `ack` present, lead absent.
- One case per slot in the table.

---

# Phase 3 — Conversation quality

## Fix 6 — `reviseSlot` restarts the session

**Severity:** medium · **Effort:** ~45 min · **Do with Fix 2**

### Observed

```
"don't book Room A tomorrow at 3pm"  -> "…do you want me to cancel …?"
"yes"        -> status: ready,    satisfied: ["negation"]
reviseSlot   -> status: awaiting, satisfied: []
             -> gate: negation, same question asked again
             -> answers carried: 0, skipped: []
```

### Root cause

`revise.ts:19` and `revise.ts:27` call `beginSession(newText, ctx)`, which
starts from zero and discards `satisfied`, `answers`, `skipped`, `corrections`,
`intentChoice` and `rounds`.

### Change

Export a `reviseSession(state, newText, ctx)` from `session.ts` that calls the
internal `evaluate()` with the accumulated fields carried over and `rounds: 0`
(a revision is a fresh topic, so per-slot counting should restart — but
`totalRounds` from Fix 3 must **not** reset). Move `reviseSlot` into
`session.ts` or have `revise.ts` delegate to the new export.

The gate ladder still re-runs in full — that invariant is preserved, because
`evaluate()` is the same function every other turn goes through.

### Tests

- Confirmed negation survives a revision (no second confirm prompt).
- A disambiguated `intentChoice` survives a revision.
- A skipped slot stays skipped.
- The ladder still re-runs: revising into an invalid state re-asks rather than
  proceeding.

---

## Fix 7 — The negation cue becomes the event title

**Severity:** medium · **Effort:** ~30 min

### Observed

```
"don't book Room A tomorrow at 3pm"
  draft.title: "don't book"
  question:    That reads like a negative — do you want me to cancel "don't book"?
```

### Root cause

`titleFromRemainder` (`entities.ts:289`) blanks time, resource and participant
spans plus the leading verb prefix, but nothing removes negation cues, so
`"don't book"` survives into the remainder.

### Change

In `extractEntities`, blank negation cues before computing `titleSpan`, using
the frozen `hasNegation` as its own oracle — the same technique
`stripNegationCues` already uses (`session.ts:178`). Do **not** re-declare the
cue list; that is what keeps it from drifting from `gates.ts`.

Note `leadingVerbPrefixLength` also mis-measures here, because `"don't"` sits
before the verb. Blanking the cue first fixes both.

### Tests

- `"don't book Room A tomorrow at 3pm"` ⇒ `title` is `undefined` or `"Room A"`,
  never contains `"don't"`.
- The confirmation question reads naturally.
- `"book Room A"` title unchanged (no regression from the blanking pass).

---

## Fix 8 — Markdown renders literally

**Severity:** medium · **Effort:** ~5 min

### Observed

```
I didn't quite follow that. Try something like **book Room A tomorrow at 10am**.
```

The chat bubble is plain text (`janus-chat.ts` `case "text"`), so users see the
asterisks.

### Change

Drop the `**` from `GATE_COPY` (`presentSession.ts:239-245`). Optionally
promote the examples to tappable chips by adding `examples?: string[]` to the
text message variant — better UX, and it makes a refusal a starting point rather
than a wall. Chips are optional; removing the asterisks is not.

### Test

No rendered message contains `**`.

---

## Fix 9 — Gate reasons still leak to users

**Severity:** medium · **Effort:** ~15 min

`GATE_COPY` covers only `gate1_confidence`, `gate2_nearest_none` and
`gate3_no_anchor`. Every other decline falls through to
`presentSession.ts:289`, which interpolates `state.reason` — engineer
diagnostics. A `gate4_margin` decline shows:

> I can't act on that — margin 0.04 below floor 0.1 - ambiguous vs next-best intent.

### Change

Add copy for `gate4_margin`, `gate5_missing_slot` and `negation`, and replace
the `state.reason` interpolation with a generic fallback. **`state.reason` must
never reach a rendered string** — keep it on the state for diagnostics only.

### Test

Assert over **every** `FiredGate` that the rendered text contains none of:
`gate`, `floor`, `margin `, `confidence 0.`, `below`.

---

## Fix 10 — `outstanding` ignores skipped slots

**Severity:** low · **Effort:** ~5 min

### Observed

```
after SKIP -> skipped: ["resource"], outstanding: ["resource"]
```

`session.ts:578` filters on `slotIsFilled` only, so a skipped slot is counted
forever and the "N more to go" progress line is wrong.

### Change

```ts
outstanding: (ctx.requires?.[draft.intent] ?? []).filter(
  (slot) => !slotIsFilled(slot, draft) && !input.skipped.includes(slot),
),
```

Also consider excluding the slot currently being asked — today asking the last
question shows "1 more to go", which reads as off-by-one.

### Test

Skipping a slot removes it from `outstanding`.

---

## Fix 11 — Fold into Fix 4

`"what can you do"` returning `null` is bug 3 of Fix 4. No separate work.

---

## Fix 12 — The two duration regexes disagree

**Severity:** low · **Effort:** ~10 min · **Do with Fix 1**

`session.ts:922` accepts `\s*` (so `"45mins"` passes the check and is appended),
but `datetime.ts:310` requires `\s+` (so it is never parsed). `assumed.duration`
stays `true`, `slotIsFilled("duration")` stays `false`, and the question repeats
until it hits the broken escape hatch in Fix 3.

### Change

Fix 1 already relaxes `datetime.ts` to `\s*`. Then **delete the fallback branch
at `session.ts:921-929` entirely** and rely on `parseTimeSpan` as the single
source of truth. Two regexes for one concept is the bug.

### Test

`"45mins"` and `"2hrs"` answering the duration question ⇒ `status: "ready"`,
duration 45 and 120.

---

# Phase 4 — Hygiene

| Item                                         | Location                                                                         | Change                                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `finalized` crosses the package seam untyped | set at `controller.ts:248`, declared only in `packages/ui/src/chat-types.ts:124` | Add it to the `parse` variant of `PresentMessage` in `presentSession.ts`                                                       |
| Dead conditional                             | `controller.ts:224-231` — `let outcome = undefined; if (!outcome)`               | Remove; leftover from deleting the manager branch                                                                              |
| Invented title                               | `presentSession.ts:318` — `"New Event"` fallback                                 | Mark the chip `assumed: true` and add a note, or drop the fallback. Silent invention contradicts the disclose-every-guess rule |
| `MAX_RESOURCE_CHOICES` removed               | `session.ts` `resourceChoices` returns the whole catalog                         | Acceptable given `searchable` above 5 — confirm the UI is usable at ~50 rooms, else reinstate a cap                            |
| `confirm()` finalizes all cards              | `controller.ts:247` maps over every `parse` message                              | Finalize only the active one                                                                                                   |

---

# Sequencing

```
Phase 1  Fix 1  ──────────────────────────►  independent, ship alone
         Fix 12 ──┘ (same regex)

         Fix 6  ──┐
         Fix 2  ──┴──────────────────────►  must land together

Phase 2  Fix 4  ──────────────────────────►  independent
         Fix 5  ──────────────────────────►  independent
         Fix 3  ──────────────────────────►  independent

Phase 3  Fix 7, 8, 9, 10 ─────────────────►  independent, batchable

Phase 4  hygiene ─────────────────────────►  last
```

**Fix 2 must not ship before Fix 6.** Editing a slot that resets the session
would re-ask every question the user already answered — worse than the bug it
replaces.

Everything else is independent and can be reviewed in isolation.

## Suggested commits

| Commit | Contents                                                | Rough size              |
| ------ | ------------------------------------------------------- | ----------------------- |
| 1      | Fix 1 + Fix 12 — duration parsing                       | ~2 files, 8 tests       |
| 2      | Fix 4 — smalltalk guards                                | ~2 files, new test file |
| 3      | Fix 5 — recovery leads                                  | ~1 file, 7 tests        |
| 4      | Fix 3 — escape hatch + loop ceiling                     | ~2 files, 5 tests       |
| 5      | Fix 6 + Fix 2 — session-preserving revision + real Edit | ~4 files, 9 tests       |
| 6      | Fixes 7–10 — copy and counting                          | ~3 files, 6 tests       |
| 7      | Phase 4 hygiene                                         | ~3 files                |

---

# Verification

Per the standing process: **one commit at a time, real output pasted, park at 🟦
awaiting browser check, nothing starts on the next until sign-off.**

Every commit:

```bash
cd packages/nlp && npx jest        # green, count only rises from 1446
npm run lint                       # exit 0
npm run validate                   # exit 0
git diff --stat packages/nlp/src/{constants,normalize,wordpiece,embed,preprocess,classify,gates}.ts
#   ^ empty — the frozen zone is not touched by any fix in this plan
```

`gates.ts` must stay at 100% statement and branch coverage.

## End-to-end script for the browser check

Run against the live `ChatDock` at `http://localhost:5174/` — the scripted
scenarios in `ChatGallery.tsx` do not exercise `session.ts` and are not
sufficient evidence.

| #   | Type this                                                           | Expect                                           |
| --- | ------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | `book Room A tomorrow at 3pm for 1.5 hours`                         | card shows **1.5 hr**, not 5 hr                  |
| 2   | press **Edit** → **Time** → `5pm`                                   | **5:00 PM, 1 hr** — duration unchanged           |
| 3   | `schedule a sync tomorrow at 10am` → tap a room named **Help Desk** | the room is selected, not a help blurb           |
| 4   | `book Room A` → `sometime soon`                                     | recovery lead, **no** "Got it"                   |
| 5   | `book Room A` → three unusable answers → **Skip that and continue** | reaches a card with the fallback disclosed       |
| 6   | `book Room A` → three unusable answers → **Start over**             | thread resets                                    |
| 7   | `don't book Room A tomorrow at 3pm`                                 | question does **not** read `cancel "don't book"` |
| 8   | `the quarterly figures look strong`                                 | refusal with **no** `**asterisks**`              |
| 9   | `what can you do`                                                   | capability reply                                 |
| 10  | `don't book Room A tomorrow at 3pm` → `yes` → Edit → Time → `5pm`   | **no** second cancellation prompt                |

---

# Out of scope

- The three known false accepts in the frozen classifier — deliberate, documented.
- `"what is the weather in paris today"` classifying as scheduling — frozen gate
  behaviour (`today` is a domain anchor), same category as above.
- Rolling the chat out to Angular / Solid / Vue.
- Design tokens, responsive layout, a11y, and wiring the nlp suite into
  `.github/workflows/build.yml` + `sonar-project.properties` — that is Step 8.
