# Tier 1 — Refusal copy and smalltalk

**Scope:** 4 failing checklist cases — **E7, E8, I8, I9** — plus finding **#4**.
**Estimate:** ~1 hour total, two independent commits.
**Baseline:** `nlp 1618` · `core 88` · sweep `32 ok / 11 failing`.

Two files change. Neither touches the frozen zone, the classifier, or anything
that writes to a calendar. This is the lowest-risk work remaining, and E7 is the
most embarrassing thing a stakeholder can currently see.

---

## Standing rules

- **One commit at a time.** Finish it, run the checks below, paste real output,
  then stop and wait for a browser check before starting the next.
- **Verify by running, not reading.** `dist` goes stale silently — always
  `npm run build -w @janus-scheduler/nlp` before probing.
- **Red-green every fix.** Temporarily disable the change, show the test fails,
  restore, show it passes. A green test that never failed proves nothing.
- Probes go in the session scratchpad, never in the repo.

Every commit must end with:

```bash
cd packages/nlp && npx jest        # 1618 → higher, never lower
npm run lint                       # exit 0
npm run validate                   # exit 0
npm test -w @janus-scheduler/core  # 88

git diff --stat packages/nlp/src/{constants,normalize,wordpiece,embed,preprocess,classify,gates}.ts
#   ^ MUST print nothing
```

---

# Commit 1 — Refusal copy (E7 + E8)

**File:** `packages/nlp/src/presentSession.ts` · **~20 min**

## What is wrong

`GATE_COPY` covers only 3 of the 6 gates. Everything else falls through to this
line, which interpolates `state.reason` — engineer diagnostics:

```ts
let copy = `I can't act on that — ${state.reason}. Try something like “book Room A tomorrow at 10am”.`;
```

**E7** — what a user actually sees on a `gate4_margin` decline:

> I can't act on that — **margin 0.04 below floor 0.1 - ambiguous vs next-best intent**.

**E8** — `gate1_confidence` contains markdown, and the chat bubble renders plain
text, so the asterisks are literal:

> Try something like **\*\*book Room A tomorrow at 10am\*\***

## Every reason string that can reach a user

Confirmed by grep. These are what the fallback currently exposes:

| Source            | `reason`                                                          |
| ----------------- | ----------------------------------------------------------------- |
| `gates.ts:125`    | `confidence 0.32 below floor 0.45`                                |
| `gates.ts:133`    | `nearest neighbour is none`                                       |
| `gates.ts:159`    | `margin 0.04 below floor 0.1 - ambiguous vs next-best intent`     |
| `gates.ts:170`    | `add_event predicted with no time slot found`                     |
| `session.ts:935`  | `still unclear after 2 questions - starting over will be quicker` |
| `session.ts:1156` | `<route.reason> - and no follow-up question can resolve it`       |
| `session.ts:1306` | `you asked me not to - nothing was changed`                       |

## Steps

**1.1** — Extend `GATE_COPY` to cover **all six** `FiredGate` values. Remove the
`**` markdown. Suggested wording:

| Gate                   | Copy                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `gate1_confidence`     | "I didn't quite follow that. Try something like: book Room A tomorrow at 10am"            |
| `gate2_nearest_none`   | "That doesn't look like a scheduling request. I can add, move, cancel or look up events." |
| `gate3_no_anchor`      | "I need something to go on — a time, a room, or a person."                                |
| `gate3b_resource_only` | "I've got the room, but not when. Try adding a time."                                     |
| `gate4_margin`         | "I couldn't tell whether you wanted to book, move or cancel that. Try naming the action." |
| `gate5_missing_slot`   | "I need a time for that — try 'tomorrow at 2pm'."                                         |
| `negation`             | "Nothing was changed."                                                                    |

**1.2** — **Delete the `state.reason` interpolation entirely.** Replace the
fallback with a fixed generic string. `state.reason` stays on the state for
diagnostics and must never reach a rendered string again.

**1.3** — Handle the round-cap decline (`session.ts:935`), whose `route.gate` is
whatever last fired, so it will hit a gate entry that does not describe it.
Prefer a dedicated message when `state.rounds` is at the cap.

## Tests — `packages/nlp/tests/presentSession.test.ts`

**The invariant test that matters.** Assert over **every** `FiredGate`, not a
sample:

```ts
const FORBIDDEN =
  /\*\*|gate\d|floor|margin |confidence 0\.|below floor|nearest neighbour|predicted with/i;

it.each(ALL_FIRED_GATES)("%s produces no diagnostics", (gate) => {
  const msg = presentSession(declinedState(gate), "m");
  expect(msg?.kind).toBe("text");
  expect(msg!.text).not.toMatch(FORBIDDEN);
  expect(msg!.text.length).toBeGreaterThan(10); // not empty
});
```

Plus: a decline with **no** matching gate entry still yields readable copy, and
no message anywhere contains `**`.

## Manual check

| Type this                                       | Expect                                   |
| ----------------------------------------------- | ---------------------------------------- |
| `the quarterly figures look strong`             | friendly refusal, **no asterisks**       |
| `asdkjh qwe zxc`                                | "doesn't look like a scheduling request" |
| anything ambiguous enough to hit `gate4_margin` | **no** "margin 0.04 below floor"         |

---

# Commit 2 — Smalltalk (I8 + I9 + #4)

**Files:** `packages/nlp/src/smalltalk.ts`, `packages/nlp/src/controller.ts`
**~30 min**

## What is wrong — three bugs in 26 lines

**I8 — the main help phrases are dead.** `smalltalk.ts:18`:

```ts
if (words.length >= 4) return null;
```

`"what can you do"` is **exactly 4 words**. So is `"how does this work"`. Both
are in `HELP_RE` and neither can ever match. Only `help`, `stuck`, `commands`,
`options` survive.

**I9 — prefix matching eats real names.** `HELP_RE` is `/^\s*(help|…)\b/i`, which
matches the _start_ of `"Help Desk"`. Any room named _Help Desk_, _Options_ or
_Commands_ is offered as a chip and then swallowed when tapped.

**#4 — it runs while a question is pending.** `controller.ts:145` calls
`classifySmalltalk(text)` **before** checking whether a question is open:

```
"schedule a design sync tomorrow at 10am for 1 hour"
   → "Which room or person is design sync for?"   [Room A] [Dr. Sarah Chen] [Skip]
"help"
   → "Try asking me to book a room..."            ← the question is orphaned
```

## Steps

**2.1 — Anchor every pattern to the whole utterance.** This fixes I9 and makes
the word counter redundant:

```ts
const HELP_RE =
  /^\s*(help|what can you do|what can i say|how does this work|commands|options|stuck)\s*[?!.]*\s*$/i;
```

Same `^…$` treatment for `GREETING_RE`, `THANKS_RE`, `FAREWELL_RE`.

**2.2 — Delete the `words.length >= 4` guard.** Anchoring replaces it, and it is
what breaks I8.

**2.3 — Add a catalog guard.** Belt and braces, so a room called _Help_ is safe
even if a pattern regresses later:

```ts
export function classifySmalltalk(
  text: string,
  catalogNames?: string[],
): SmalltalkKind | null;
```

Return `null` when the trimmed text case-insensitively equals any catalog name
or alias. Pass the names from `ChatController`.

**2.4 — Never run while a question is pending.** In `controller.ts`, around
line 145:

```ts
const pending = this.session?.status === "awaiting";
const smalltalk = pending ? null : classifySmalltalk(text, catalogNames);
```

This is the guard the original design specified and that was never implemented.
Without it, `"no"` answering a negation confirm could be intercepted.

**2.5 — Keep `hasDomainAnchor` untouched.** It is what stops
`"cancel the 3pm review"` being read as smalltalk, and it still works.

## Tests — new file `packages/nlp/tests/smalltalk.test.ts`

**The invariant test.** This is the one that prevents the whole class of bug:

```ts
it("never intercepts a real request", () => {
  for (const f of routingFixtures) {
    expect(classifySmalltalk(f.text)).toBeNull();
  }
});
```

All **237** fixtures. If smalltalk ever claims one, it is stealing a booking.

Also assert:

| Case                                                        | Expect                                            |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `what can you do`, `what can you do?`, `how does this work` | `"help"`                                          |
| `hi`, `thanks`, `bye`                                       | their kinds                                       |
| `Help Desk`, `Options`, `Commands` **as catalog names**     | `null`                                            |
| `cancel`, `yes`, `no`                                       | `null`                                            |
| `help` while a session is `awaiting` (controller level)     | reaches `provideAnswer`, not the smalltalk branch |

## Manual check

| Do this                                                              | Expect                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------- |
| `what can you do`                                                    | a capability reply                                      |
| `hi`                                                                 | a greeting                                              |
| Rename a room to **Help Desk**, then tap it on the resource question | selected, **not** a help blurb                          |
| Start a booking, then type `help` at a question                      | the question is answered or re-asked — **not** replaced |
| `cancel the 3pm review`                                              | still a cancellation                                    |

---

## Definition of done

- Sweep goes **32 ok / 11 failing → 36 ok / 7 failing**
- `nlp` tests rise from 1618; `core` stays at 88
- `lint`, `validate`, `tsc` all exit 0
- Frozen-zone diff empty
- Both manual checks signed off

## Out of scope

Do not touch in these commits: the round cap (F4), skipped counting (F2), the
Edit button (#2/#6), the negation title (D7), or the parsing gaps (A6/A14/B8).
They are tracked in `NLP_FIXES_PLAN.md` and `NLP_EDGE_CASE_CHECKLIST.md`.
