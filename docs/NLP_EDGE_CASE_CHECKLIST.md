# NLP Edge-Case Checklist

> **Step-by-step verification lives in [`docs/nlp/`](nlp/README.md)** — one
> file per step, each with explicit pass conditions and a manual walkthrough.
> Start there. This file is the historical record of what was measured and when.

**Last measured:** 2026-09-01, against the current build.
**Setup:** react demo, hospital catalog (_Operating Room 1_, _MRI Scanner A/B_,
_Dr. Sarah Chen_, _Dr. Michael Ross_, _Dr. Ann sherin_),
`REQUIRES = { add_event: ["when","duration","resource","title"], modify_event: ["when"] }`.

Legend: ✅ measured passing · ❌ measured failing · 🔍 **needs a human** — the
machine cannot check it

**43 of ~90 cases are machine-checked, and all 43 now pass.** Those rows do not
need your time. Everything marked 🔍 does — it is UI rendering, real commits, and
anything where "it looked right" is the only available oracle.

A green sweep has never meant a correct chat: the worst defects in this work
were all found by hand while it was green.

---

## What is failing right now (0 of the 43 tracked)

All 43 tracked cases pass. The list below is kept as the record of what each
tier fixed — and as a reminder that the harness only covers what someone
thought to write down. Two of the worst defects found in this work were caught
by hand and had no row here at all (see "Found by hand" below).

|     | Case                                    | Fixed by                                                                                                                                       |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅  | **A4** `on the 25th at 9am`             | `dayOfMonth` mention with an adjective guard                                                                                                   |
| ✅  | **A6** `at half past two tomorrow`      | Tier 3. `half past` / `quarter past` / `quarter to` patterns; the meridiem is guessed by the working day and disclosed                         |
| ✅  | **B8** `for 0 minutes`                  | Tier 3. A zero-length event is not a booking — the mention is claimed but carries no value, so the host asks for a real length                 |
| ✅  | **D10** time phrase becomes the title   | Tier 3. Same fix as A6: an unclaimed phrase is what fell through to the title                                                                  |
| ✅  | **D7** negation cue becomes the title   | Tier 3. The cue is blanked before extraction — it is routing information, never event content                                                  |
| ✅  | **C4** `MRI Scanner C` (not in catalog) | Catalog fallback in the session layer                                                                                                          |
| ✅  | **A14** `in 2 hours`                    | Tier 3. Its own `relativeOffset` kind — "for 2 hours" and "in 2 hours" are opposite meanings sharing a surface form                            |
| ✅  | **F4** round cap                        | Tier 2. `totalRounds` backstop + a real `escape` slot: skip-and-continue, or start over. Gates stay unskippable                                |
| ✅  | **F2** skipped slot                     | Tier 2. `outstanding` excludes skipped slots; the label counts what is left AFTER the question on screen ("last one" on the final requirement) |
| ✅  | **E7** gate diagnostics                 | Tier 1. `GATE_COPY` covers all seven gates; `state.reason` never reaches a rendered string                                                     |
| ✅  | **E8** markdown                         | Tier 1. No markup in copy the chat renders as plain text                                                                                       |
| ✅  | **I8** `what can you do`                | Tier 1. The `words.length >= 4` guard killed the main help phrases                                                                             |
| ✅  | **I9** `Help Desk`                      | Tier 1. Patterns anchored to the whole utterance, plus a catalog guard                                                                         |

---

## Found by hand — never had a checklist row

These were the most damaging defects in the whole effort, and the sweep was
green through every one of them. A clean sweep means the tracked list is clear,
not that the chat is correct.

| Case                                                   | Symptom                                                                                                                                                                  | Fixed |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `book <Room> for 30 minutes` then answering "tomorrow" | The stated duration was **destroyed** — answering `when` replaced the whole `timeSpan`, durations included, and the event was created at the 60-minute default           | ✅    |
| Same, before a date is given                           | `slotIsFilled("duration")` read the RESOLVED time, which is null until something anchors the event, so a duration visible in the user's own message was reported missing | ✅    |
| `half past two` with host `requires`                   | Resolved correctly, then re-asked "what time?" — the meridiem guess was recorded as `assumed.timeOfDay`, which means "no time given"                                     | ✅    |
| `don't book <Room> tomorrow at 2pm` → yes → Cancel     | **Dead end.** `resolveTarget` matched on title only, refused, and advised naming the event — advice that does not classify as a scheduling request in any form           | ✅    |
| Any duration answer containing a bare clock            | `3pm` became a **1440-minute** event; `9am` an 18-hour one. Any clock was treated as an end time with no cue required                                                    | ✅    |
| A half-applied edit left in the working tree           | `ReferenceError: MAX_TOTAL_ROUNDS is not defined` on every question the chat asked. Shipped because nothing type-checked `packages/nlp`                                  | ✅    |

---

## What is passing (30) — no need to re-check by hand

**Phase A · time & date** — ✅ A1 `tomorrow at 3pm` · ✅ A2 `next Tuesday at 10am`
· ✅ A5 `tomorrow morning` → 09:00 **and** disclosed · ✅ A7 `noon` · ✅ A8
`midnight` is 00:00 not 12:00 · ✅ A10 `3pm to 5pm` → 120 min · ✅ A13 `25:00`
not silently wrapped to 01:00

**Phase B · duration** — ✅ B1 `1.5 hours`→90 · ✅ B2 `2.5 hrs`→150 · ✅ B3
`0.5 hours`→30 · ✅ B4 `45mins`→45 · ✅ B9 `90 minutes`→90

**Phase C · resources** — ✅ C1 unknown room asks instead of becoming the title ·
✅ C5 `with Sarah` → Dr. Sarah Chen · ✅ C6 bare `Dr` does not match everyone ·
✅ C12 `the projector` asks

**Phase D · titles** — ✅ D3 explicit title kept · ✅ D4 `room inspection` stays a
title · ✅ D5 `projector demo` stays a title

**Phase E · intents** — ✅ E1 lookup · ✅ E2 cancel · ✅ E3 move · ✅ E4 bare
`cancel` not eaten by smalltalk · ✅ E5 gibberish refused

**Phase I · input** — ✅ I1 typo corrected **and** disclosed · ✅ I3 empty input
inert · ✅ I7 300-character word does not crash · ✅ I10 `hi` answered

**Phase F · flow** — ✅ F3 an unusable answer now explains itself instead of
saying "Got it"

---

## 🔍 What only you can check

The machine cannot judge these. This is the list worth your time.

### Phase K · commit correctness — ✅ **passed**

**Walked end to end in a browser by the user on 2026-09-01, and reported as
all passing.** Not machine-verified: this is the one phase where only a human
and a real calendar can judge the result, so the record is a report, not a
measurement.

That run is also where the seven most damaging defects in the whole effort
were found — none of them had a row in this table. See
[`docs/nlp/PROGRESS.md`](nlp/PROGRESS.md) for K-1 … K-11 and their fixes.

| #   | Do this                                       | Expect                                             | Result |
| --- | --------------------------------------------- | -------------------------------------------------- | ------ |
| K1  | Confirm an event with 2 rooms + 2 people      | all four attached on the timeline                  | ✅     |
| K2  | Compare the card's time to the rendered block | identical                                          | ✅     |
| K3  | Book into an occupied slot                    | refused when `preventConflicts` is on              | ✅     |
| K4  | Confirm, then **Undo**                        | event gone, card marked Undone                     | ✅     |
| K5  | **Double-click Confirm**                      | one event, not two                                 | ✅     |
| K6  | Skip the resource, confirm                    | lands on the disclosed fallback row                | ✅     |
| K7  | Skip the name, confirm                        | created event is called exactly what the card said | ✅     |
| K8  | Cancel an event, then **Undo**                | colour, recurrence and resources all restored      | ✅     |

**K3 took three attempts.** The first fix added a conflict check that had never
existed in `commit.ts`; the second found the demo passing three different
`preventConflicts` values to three surfaces, so the check was correctly
honouring `false`. It is one flag now.

**K6 changed shape.** The resource can no longer be skipped from a card at all
— the Skip chip is gone, on the user's instruction and matching their own note
that “resource should be there”. The fallback path still exists behind the
round-cap escape, and lands on the disclosed row.

### Phase G · editing

| #   | Do this                                | Expect                                  |
| --- | -------------------------------------- | --------------------------------------- |
| G1  | **Edit** → type `5pm` on a 3pm booking | ✅ Tier 4 — 17:00, duration unchanged   |
| G2  | **Edit** → type `actually 5pm`         | works                                   |
| G3  | **Edit** → type `Room B` / a new name  | ✅ Tier 4 — replaces, no longer appends |
| G4  | **Edit** → **Never mind**              | ✅ Tier 4 — draft byte-identical        |

### Phase F · conversation feel

| #   | Do this                                 | Expect                                                                                 |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| F5  | Answer a question with `help`           | ✅ Tier 1 — smalltalk never runs while a question is pending; the question is re-asked |
| F6  | Send two messages fast                  | second ignored while busy                                                              |
| F10 | Close and reopen the panel mid-question | defined behaviour                                                                      |

### Phase J · timezone (your recent work)

| #   | Do this                                            | Expect                                                       |
| --- | -------------------------------------------------- | ------------------------------------------------------------ |
| J1  | New event → change zone → type a title             | zone holds                                                   |
| J2  | Set display zone far away → book `tomorrow at 3pm` | amber warning with the converted time, Confirm still enabled |
| J3  | Set it back to your own zone                       | warning disappears                                           |
| J4  | Book across a DST transition                       | duration correct in wall-clock terms                         |

### Phase L · cross-framework

Everything in A–D is shared code, so it should behave identically. Only the
wiring differs. ⬜ react · ⬜ angular · ⬜ solid · ⬜ vue

---

## How this was measured

`node scratchpad/sweep.cjs` drives the built package against the demo catalog with
`now` pinned to 2026-08-29. Re-run it after any change — it takes seconds and it
has twice caught me reporting a finding as fixed when my probe was simply wrong
(a bad `requires` order, and never pressing Confirm).

**Do not trust a ✅ that was not re-measured after a change.**
