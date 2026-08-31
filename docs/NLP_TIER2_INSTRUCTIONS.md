# Tier 2 — The conversation must be able to end

**Scope:** 2 failing checklist cases — **F4** and **F2** — plus one coupling
introduced by Tier 1.
**Estimate:** ~2 hours, two commits.
**Baseline:** `nlp 1633` · `core 88` · sweep `36 ok / 7 failing`.

F4 is the last case where a user can get **stuck with no way out**. Everything
else remaining either refuses cleanly or is cosmetic. That makes this the
highest-value tier left despite being smaller than Tier 3.

One file does most of the work: `packages/nlp/src/session.ts`. Nothing here
touches the frozen zone or the commit path.

---

## Standing rules

- **One commit at a time.** Finish it, run the checks, paste real output, then
  stop for a browser check before starting the next.
- **Verify by running, not reading.** Always
  `npm run build -w @janus-scheduler/nlp` before probing — `dist` goes stale
  silently.
- **Red-green every fix.** Disable the change, show the test fails, restore,
  show it passes.
- Probes go in the session scratchpad, never in the repo.

Every commit ends with:

```bash
cd packages/nlp && npx jest        # 1633 → higher, never lower
npm run lint                       # exit 0
npm run validate                   # exit 0
npm test -w @janus-scheduler/core  # 88

git diff --stat packages/nlp/src/{constants,normalize,wordpiece,embed,preprocess,classify,gates}.ts
#   ^ MUST print nothing
```

---

# Commit 1 — The round cap must terminate (F4)

**File:** `packages/nlp/src/session.ts` · **~1 hour**

## What is wrong — three separate bugs in one place

Measured: **10 consecutive unusable answers, still `awaiting`.** The cap never
fires. Three independent reasons, and fixing only one leaves the loop.

### Bug 1 — the counter resets when the question changes

`ask()` computes:

```ts
const spent = input.lastSlot === question.slot ? rounds : 0;
```

The cap counts **consecutive asks of one slot**. That is deliberate and right —
filling three empty fields is a conversation, asking "when?" three times is a
loop. But nothing counts the conversation as a whole, so a session that
alternates `when → resource → when → resource` never reaches the cap on either.

**Fix:** add a `totalRounds` to `SessionState` that increments on _every_
answer and **never resets**. Decline unconditionally at a hard ceiling
(suggest 6). Keep the per-slot counter exactly as it is — it produces the
better-targeted message; the new one is only a backstop.

### Bug 2 — the escape hatch's own buttons do nothing

When the cap does fire with a usable draft, it offers:

```ts
slot: "confirm",   // dummy slot to allow choice
choices: [
  { id: "edit",       label: "Open the editor", value: "edit" },
  { id: "start-over", label: "Start over",      value: "start over" },
]
```

But `provideAnswer`'s `case "confirm"` only tests `AFFIRMATIVE_RE` /
`NEGATIVE_RE`. Neither `"edit"` nor `"start over"` matches either, so both fall
to `return next({ unresolved: "confirm" })` — a re-ask. **The buttons are
inert.** Reusing `confirm` as a "dummy slot" is the cause.

**Fix:** give it a real slot. Add `"escape"` to `SlotName` and handle it
explicitly in `provideAnswer`.

### Bug 3 — "Open the editor" is not something the session can do

Nothing in `nlp` can open a host's editor, and inventing a host callback for
this is more surface than the case deserves.

**Fix:** offer only actions the session can actually perform:

| Stuck on                                                                     | Choices                                         |
| ---------------------------------------------------------------------------- | ----------------------------------------------- |
| a **host requirement** (`when`/`duration`/`resource`/`title` via `requires`) | `[ Skip that and continue ]` · `[ Start over ]` |
| a **gate** (`gate5_missing_slot`, `gate3b_resource_only`, …)                 | `[ Start over ]` only                           |

`Skip that and continue` reuses the existing mechanism — push the slot into
`state.skipped`, which `requirementQuestion` already honours — so the session
reaches `ready` with the fallback disclosed on the card.

**Gates are never skippable.** That invariant is not relaxed here, which is
exactly why the gate case offers only "start over". A test must pin it.

`Start over` returns `status: "declined"` with a friendly reason; the controller
calls `reset()` on seeing it.

## Also fix: the string coupling Tier 1 introduced

`presentSession.ts` currently identifies the round-cap decline by
**string-matching a diagnostic**:

```ts
state.reason.includes("starting over will be quicker");
```

That reason string lives in `session.ts` and **this commit rewords it**. Change
one and the copy silently reverts to the generic fallback with no test failing.

**Fix:** set a structural marker on the state — e.g. `roundCapReached: true` —
and branch on that in `presentSession`. Do this in the same commit, or the
coupling breaks the moment the wording changes.

## Steps

1. Add `totalRounds: number` to `SessionState` + `EvaluateInput`; increment in
   `provideAnswer`, never reset, carry through `evaluate`.
2. Add a hard ceiling (`MAX_TOTAL_ROUNDS = 6`) checked before the per-slot cap.
3. Add `"escape"` to `SlotName`; build the escape question with that slot and
   the two choice sets above.
4. Handle `case "escape"` in `provideAnswer` — skip-and-continue, or decline.
5. Add `roundCapReached?: boolean` to `SessionState`; set it on both cap exits;
   branch on it in `presentSession` and delete the `.includes(...)` match.
6. `ChatController`: on a `declined` state whose reason is the start-over one,
   call `reset()` so the thread clears.

## Tests — `packages/nlp/tests/session.test.ts`

| Assertion                                                                 | Why                                            |
| ------------------------------------------------------------------------- | ---------------------------------------------- |
| 10 consecutive unusable answers ⇒ `declined`, never `awaiting`            | the headline bug                               |
| alternating slots (`when`/`resource`) also terminates                     | Bug 1 — the per-slot counter alone never fires |
| `totalRounds` is monotonic across a whole conversation                    | the backstop can't be reset                    |
| `Skip that and continue` ⇒ `status: "ready"`, slot in `skipped`           | the escape works                               |
| `Start over` ⇒ `status: "declined"`                                       | the other escape works                         |
| a **gate**-stuck session offers **no** skip option                        | gates stay unskippable                         |
| the cap decline renders friendly copy via `roundCapReached`, not `reason` | the coupling is gone                           |

## Manual check

| Do this                                                 | Expect                                     |
| ------------------------------------------------------- | ------------------------------------------ |
| `book Operating Room 1`, then answer `dunno` five times | it stops and offers a way out              |
| Tap **Skip that and continue**                          | reaches a card with the fallback disclosed |
| Tap **Start over**                                      | thread resets                              |
| Answer a `when` gate question badly repeatedly          | offered only "start over", never a skip    |

---

# Commit 2 — Skipped slots leave the count (F2)

**File:** `packages/nlp/src/session.ts` · **~15 min**

## What is wrong

`session.ts:886`:

```ts
outstanding: (ctx.requires?.[draft.intent] ?? []).filter(
  (slot) => !slotIsFilled(slot, draft),
),
```

It filters on `slotIsFilled` only. A **skipped** slot is not filled, so it stays
in `outstanding` for ever. Measured: after skipping the title,
`skipped: ["title"]` and `outstanding: ["title"]` — and the clarify card's
"N more to go" is wrong from then on.

## Steps

1. Add `&& !input.skipped.includes(slot)` to the filter.
2. **Decide the off-by-one.** `outstanding` currently includes the slot being
   asked _right now_, so the last question reads "1 more to go" and then ends.
   Either exclude the current question's slot, or reword the label in
   `presentSession` (`"last one"` when the count is 1). Pick one and pin it —
   this is a wording decision, not a bug, so it needs a deliberate answer rather
   than being left ambiguous.

## Tests

| Assertion                                                                      |
| ------------------------------------------------------------------------------ |
| skipping a slot removes it from `outstanding`                                  |
| `outstanding` shrinks by exactly one per slot filled                           |
| a skipped slot never reappears on a later turn                                 |
| whichever off-by-one convention is chosen, the last question's label is pinned |

## Manual check

Start a booking with several requirements, **Skip** one, and watch the
"N more to go" counter decrease correctly and end at the right number.

---

## Definition of done

- Sweep goes **36 ok / 7 failing → 38 ok / 5 failing**
- `nlp` tests rise from 1633; `core` stays at 88
- `lint`, `validate`, `tsc` exit 0; frozen-zone diff empty
- No user-visible string is identified by matching a diagnostic
- Both manual checks signed off

## Out of scope

`A6 · A14 · B8 · D7 · D10` (Tier 3 parsing gaps) and `#2/#6` (the Edit button,
Tier 4). Tracked in `NLP_FIXES_PLAN.md` and `NLP_EDGE_CASE_CHECKLIST.md`.

**Note on Tier 4:** the Edit button is still the last silent-wrong-data path —
typing `5pm` on a 3pm booking leaves it at 3pm and changes the duration to 2
hours. Tier 2 is more urgent only because being trapped is worse than a wrong
edit the user can see. Do not let Tier 3's cosmetics jump the queue ahead of it.
