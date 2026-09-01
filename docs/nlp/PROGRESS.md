# Progress tracker

**Any agent picking this up: read this file first, then do the step named in
"Next action". Update this file as part of the same turn you do the work.**

Last updated: 2026-09-01 — **steps 00-08 and 10 pass**; 09 and 11 left

## Status

| #                                | Step               | Status               | Evidence                                                                                           |
| -------------------------------- | ------------------ | -------------------- | -------------------------------------------------------------------------------------------------- |
| [00](00-gates.md)                | Automated gates    | ✅ passed            | build 0 · nlp **1780**/14 · core 134/10 · lint 0 · validate 0 · frozen pristine                    |
| [01](01-dates-and-times.md)      | Dates & times      | ✅ passed            | 28/28 — full documented table, incl. every clock phrase + the disclosure rule                      |
| [02](02-durations.md)            | Durations          | ✅ passed            | 40/40 — every end-time answer shape, plus the overnight cues                                       |
| [03](03-resources-and-people.md) | Rooms & people     | ✅ passed            | 18/18 — both unknown-name paths                                                                    |
| [04](04-titles.md)               | Titles             | ✅ passed            | 17/17 — cue, time-phrase and naming-verb exclusion                                                 |
| [05](05-intents-and-refusals.md) | Intents & refusals | ✅ passed            | 29/29 — all 7 gates produce clean copy                                                             |
| [06](06-conversation-flow.md)    | Conversation flow  | ✅ passed            | 13/13 — 40 answer strategies all terminate, worst 4 turns                                          |
| [07](07-editing.md)              | Edit button        | ✅ passed            | 21/21 — typed and tapped, all four fields                                                          |
| [08](08-smalltalk-and-input.md)  | Smalltalk & input  | ✅ passed            | 27/27 — F-1 and F-2 fixed and pinned                                                               |
| [09](09-timezone.md)             | Timezone           | ⬜ **needs a human** | —                                                                                                  |
| [10](10-commit-correctness.md)   | Commit correctness | ✅ **passed**        | K1-K8 all confirmed by the user in a browser, 2026-09-01. 11 defects found and fixed along the way |
| [11](11-cross-framework.md)      | Cross-framework    | ⬜ **needs a human** | —                                                                                                  |

Legend: ⬜ not run · 🟨 partly · ✅ passed · ❌ failed (see notes)

## Next action

> **Steps 00-08 and 10 all pass.** Two left, both needing a human:
>
> 1. [09 · timezone](09-timezone.md) — never run. The card and the timeline
>    are rendered by different code from different sources and must agree.
> 2. [11 · cross-framework](11-cross-framework.md) — never run. Angular,
>    Solid and Vue share all the logic; only the WIRING differs, and wiring
>    is what has been breaking (the Edit `??` bug was demo-only).
>
> An agent must NOT mark these passed; record who reported it and when.
>
> Also unbanked: ~20 changed files, `HEAD` still at `9bee8ec`.

## How to run a step

Steps 00–08 are machine-checkable. Build first — the demos and every probe read
`dist`, which goes stale silently:

```bash
npm run build -w @janus-scheduler/nlp
```

Steps 09–11 need a browser and a human. An agent must **not** mark them passed;
record the user's reported result and who reported it.

## Re-running steps 01-08

Each step doc carries its pass conditions as a literal table — **the doc is
the specification**, and the checks are re-derivable from it. The scripts used
for this run lived in a session scratchpad and are gone; that is deliberate,
probes do not belong in the repo.

To redo one, drive the **built** package the way the demos do:

```js
const nlp = await import("<repo>/packages/nlp/dist/index.es.js");
const artifacts = nlp.parseArtifacts({ vocab, vectors }); // from packages/nlp/artifacts
const prototypes = nlp.parsePrototypes(protos);
const ctx = {
  artifacts,
  prototypes,
  catalog,
  requires,
  now,
  timezone,
  correctSpelling: true,
};
nlp.beginSession(text, ctx);
```

Two traps that cost time on this run, both recorded under Findings:

1. **Pass the host `requires` config.** Session-level consequences — which
   question is asked, what the counter says — are invisible without it.
2. **Set `correctSpelling: true`.** It defaults OFF at this layer.

## Rules for whoever continues this

1. **One step per turn.** Finish it, paste the real output, update this file,
   then stop.
2. **Never mark a step passed from reading source.** Run it. Reading the code
   has produced wrong conclusions on this repo repeatedly.
3. **A failure is a finding, not a blocker to route around.** Record it in
   "Findings" below with the measured symptom, then fix it as its own step.
4. **Do not edit the frozen zone** — `constants · normalize · wordpiece ·
embed · preprocess · classify · gates`. Step 00 checks this.
5. When scoping a formatter, **never glob `src/*.ts`** — it rewrites the frozen
   files' line endings and dirties the check in rule 4.

## Findings

### F-1 — `what can you do?` with a question mark is not understood ✅ FIXED

**Found:** step 08 · **Severity:** low, but it is the commonest phrasing.

`HELP_RE` ends in `\s*$`, which does not tolerate trailing punctuation.
`what can you do` works; **`what can you do?` returns `null`** and falls
through to the classifier, which refuses it.
`docs/NLP_TIER1_INSTRUCTIONS.md` §2.1 specified `\s*[?!.]*\s*$` — the shipped
regex dropped it.

### F-2 — `what can i say` is missing from `HELP_RE` ✅ FIXED

**Found:** step 08 · **Severity:** low.

The same instruction listed it as a help phrase. It is not in the shipped
alternation, so it is refused.

**Fixed 2026-09-01** in `packages/nlp/src/smalltalk.ts` — one regex, restored
to what the instruction specified:

```js
/^s*(help|what can you do|what can i say|how does this work|commands|options|stuck)s*[?!.]*s*$/i;
```

Ten cases added to `packages/nlp/tests/smalltalk.test.ts`, including three
that pin the anchor **against** the punctuation tolerance — it must not become
a prefix match, or a room called “Help Desk” is swallowed again. Red-green:
reverting the regex fails 8 of the 15.

### Not findings — recorded so nobody re-investigates them

- **Smalltalk answers 2 of the 237 routing fixtures** (`thank you so much`,
  `see you later`). Both are `REJECT` by the frozen layer, so nothing is
  stolen — a friendly reply beats “I didn’t follow that”. The real invariant
  is that it claims none of the **152 actionable** fixtures, and it does not.
- **`correctSpelling` is OFF by default** when calling `beginSession`
  directly; `ChatController` sets `?? true`. A probe that omits it sees
  uncorrected typos and wrongly concludes correction is broken.
- **A name with no frozen keyword and no catalog near-miss** (`Meeting Pod 4`)
  is read as the event NAME and asked about differently. Correct — step 03.

---

## Phase K findings — from the user's browser run, 2026-09-01

Seven defects, none of which had a checklist row. All fixed the same day.

| #       | Defect                                                                                                                                                                                           | Fix                                                                                                                                                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **K-1** | **Chat bypassed conflict prevention entirely.** With `preventConflicts` ON the timeline refused a double-booking and the chat created it. `commit.ts` contained no reference to conflict at all. | `commitSession` takes `{ preventConflicts }` and refuses a clashing `add_event` or `modify_event`, naming the clash and the row. Predicate mirrors core's `checkSlotConflict` (half-open, `_occ_` ids stripped) — restated, not imported, because nlp must not depend on core. |
| **K-2** | **Edit wiped the thread.** `onChatEdit={() => chat.edit?.() ?? chat.reset()}` — `edit()` returns void, so `??` ALWAYS fell through to `reset()`.                                                 | Explicit `if/else` in the react demo. Only that demo had it.                                                                                                                                                                                                                   |
| **K-3** | **`cancel the event X` could never find X.** "event" was taken as part of the name, so the lookup searched for `"event Pre-op Assessment"`.                                                      | `CLASSIFIER_NOUNS` (`event`, `appointment`, `booking`) dropped when they INTRODUCE a name. `team event` keeps its head noun.                                                                                                                                                   |
| **K-4** | **`cancel the Dr X event today at 1pm` failed** with a title of `"event"`, while holding the person and time that identify it.                                                                   | A lone classifier noun yields no title; and `resolveTarget` now falls THROUGH to room/person + time when a title matches nothing.                                                                                                                                              |
| **K-5** | **A stray verb became the title** — `"...and schedule Dr. Chen..."` → title `"schedule"`. `leadingVerbPrefixLength` only strips a verb at position 0.                                            | A title that is a LONE command verb is refused. Restricted to a lone token on purpose: `plan`, `hold`, `block off` are ordinary words inside real titles.                                                                                                                      |
| **K-6** | **The View button did nothing.** It emitted `chat-view`; nothing listens. (The wrapper's `onViewChange` maps to `view-change`, the timeline's view switcher.)                                    | `canView` added to the success message, defaulting to **false**. A host that handles `chat-view` can opt back in.                                                                                                                                                              |
| **K-7** | **A missing timestamp silently disabled the conflict guard.** Found while testing K-1: the stub's `TIME` had no `startMs`, so the overlap compared `undefined` and passed.                       | Falls back to `Date.parse(startISO)`. A silently skipped check is worse than none — it looks like protection.                                                                                                                                                                  |

| **K-8** | **The conflict fix never took effect in the demo.** Three surfaces, three values: `<Timeline>` hard-coded `true`, while `App.tsx` held `false` and passed it to the modal AND the chat. The chat was faithfully honouring `false`. | One `preventConflicts` in `App.tsx`, passed to all three. `<Timeline>` no longer hard-codes it. |
| **K-9** | **Editing the room deleted the time.** The resource edit replaced ONE range from the first named entity to the last, which also covers whatever sits between them. | Each entity replaced as its own span (`replaceSpans`), gaps untouched. |
| **K-10** | **The title swallowed the whole booking.** It was sliced from the first surviving word to the last out of the ORIGINAL text, so every claimed room, person and time in between reappeared inside the event's name. | Titles are built from RUNS — stretches with nothing claimed between them — each tidied separately, junk runs dropped. |
| **K-11** | **Skip was the only escape on every question**, and it asked the user to give up without saying what that costs. | Skip chip removed. “Other…” added, but ONLY on `when` and `duration`, whose chips are a sample of something unbounded. The room list is the host's whole catalog — there is no other room — so it gets `searchable` instead. `skippable` stays true internally so the round-cap escape still works. |

### Two bugs I introduced while fixing these

Both from backslashes being eaten when writing code through a shell heredoc.
Worth recording as a working practice, not just a defect:

- `spliceSpans` had `.replace(/s+/g, " ")` — replacing the LETTER s, which is
  why “schedule” became “chedule”.
- `commit.ts` had `/_occ_d+$/` instead of `/_occ_\d+$/`, silently disabling the
  recurrence-id guard inside the brand-new conflict check.

**Never write a regex through a heredoc.** Construct the backslash explicitly,
or edit the file directly.

### Still open from that run

- ~~**K6 (skip the resource)**~~ — **closed.** Measured: the card discloses,
  the commit lands on the fallback row, and with no fallback id it refuses
  rather than writing a resource-less event. The question is now largely moot
  in the UI: with the Skip chip removed, a resource cannot be skipped from a
  card at all — matching the user's own note that “resource should be there”.
  The path survives only behind the round-cap escape.
- **`cancel the Pre-op Assessment`** (name only, no time or room) is refused
  by the FROZEN gate (`gate3_no_anchor`). The classifier has never seen the
  user's calendar, so an event name means nothing to it. Fixing this means
  the host passing existing event names in — a design change, not a patch.
- **Skip UX** — the user asked for suggested names plus an “Other” option
  rather than a bare Skip. An enhancement, not a defect.

## Session log

| Date       | Step  | Result                                                        |
| ---------- | ----- | ------------------------------------------------------------- |
| 2026-09-01 | —     | tracker created                                               |
| 2026-09-01 | 00    | ✅ all gates green                                            |
| 2026-09-01 | 01    | ✅ 28/28                                                      |
| 2026-09-01 | 02    | ✅ 40/40                                                      |
| 2026-09-01 | 03    | ✅ 18/18 — 2 of my expectations were wrong, corrected first   |
| 2026-09-01 | 04    | ✅ 17/17                                                      |
| 2026-09-01 | 05    | ✅ 29/29                                                      |
| 2026-09-01 | 06    | ✅ 13/13 — 1 expectation corrected first                      |
| 2026-09-01 | 07    | ✅ 21/21                                                      |
| 2026-09-01 | 08    | ❌ 20/21 — findings F-1, F-2                                  |
| 2026-09-01 | fix   | ✅ F-1 + F-2 fixed; nlp 1748 → **1758** tests                 |
| 2026-09-01 | 08    | ✅ 27/27 on re-run                                            |
| 2026-09-01 | 01-07 | ✅ re-run after the fix, all still green                      |
| 2026-09-01 | 10    | ❌ run by the USER in a browser — 7 defects (K-1…K-7)         |
| 2026-09-01 | fix   | ✅ all 7 fixed; nlp 1758 → **1771** tests                     |
| 2026-09-01 | 01-08 | ✅ all re-run after the K fixes, still green                  |
| 2026-09-01 | 10    | ❌ user re-ran: conflicts still allowed; Skip UX              |
| 2026-09-01 | fix   | ✅ K-8…K-11 fixed; nlp 1771 → **1780** tests                  |
| 2026-09-01 | 10    | ✅ **USER re-ran the full Phase K in a browser — all 8 pass** |
