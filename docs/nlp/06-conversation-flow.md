# 06 · Conversation flow

Covers asking for missing values, skipping, the progress counter, and — most
importantly — the conversation being able to **end**.

## PASS conditions

| #   | Situation                 | Expect                                        |
| --- | ------------------------- | --------------------------------------------- |
| F3  | an unusable answer        | explains itself, does not just re-ask blankly |
| F4  | repeated unusable answers | **terminates** — never loops forever          |
| F2  | a skipped slot            | leaves the outstanding count                  |

## The way out — the most important behaviour here

A user must never be trapped. Two independent caps:

- **per-slot** — the same question may be asked twice, then it stops.
- **whole-conversation** — a hard ceiling of **8 answers**, which never resets.

The per-slot cap alone could not catch a session alternating between two slots:
each move reset the counter, so it ran forever. The ceiling is deliberately
generous — a productive four-requirement conversation costs four answers, and
cutting a working conversation off is worse than one extra prompt in a stuck one.

When a cap fires with a usable draft, the chat offers a **closed choice**:

```
I'm still not getting that. Want me to skip it and carry on, or start over?
[ Skip that and continue ]  [ Start over ]
```

**PASS conditions for the escape:**

- Both buttons **do something**. (They were once inert: the question reused the
  `confirm` slot, whose handler only tests yes/no, so neither matched and both
  fell through to a re-ask.)
- **Skip that and continue** is offered only for a _host requirement_.
- A **gate** question offers **only** "Start over". Gates are never skippable —
  that invariant is what stops "just say yes twice" becoming a way past the
  classifier.
- Free text at the escape ends the session rather than looping. By then the cap
  has already proved more questions are not working.

## The progress counter

"N more to go" counts what is left **after** the question on screen.

| Asking   | Shows          |
| -------- | -------------- |
| 1st of 3 | `2 more to go` |
| 2nd of 3 | `1 more to go` |
| last     | `last one`     |

A **skipped** slot leaves the count immediately. It used to stay outstanding
for ever, so the session could reach a finished card still claiming two slots
to go.

## Manual check

1. `book <Room>` then answer `dunno` five or six times.
   **It must stop** and offer a way out.
2. Tap **Skip that and continue** → reaches a card, with the substituted value
   disclosed in a note.
3. Start again, tap **Start over** → the conversation resets.
4. Answer a **when** question badly several times → you are offered only
   "Start over", never a skip.
5. Watch the counter through a full booking: `2 more to go` → `1 more to go` →
   `last one` → card.
6. Skip one requirement mid-way → the count drops by one immediately and never
   mentions that slot again.
