# 08 · Smalltalk and awkward input

Covers greetings and help, and input that is empty, enormous, or hostile.

## PASS conditions

| #   | Type this                     | Expect                                    |
| --- | ----------------------------- | ----------------------------------------- |
| I8  | `what can you do`             | a capability reply                        |
| I9  | a room named `Help Desk`      | treated as a **room**, not a help request |
| I10 | `hi`                          | a greeting                                |
| I1  | `book <Room> tommorow at 3pm` | corrected **and disclosed**               |
| I3  | empty / whitespace input      | inert — nothing sent                      |
| I7  | a 400-character word          | survives, no crash                        |

## Smalltalk must never steal a real request

Two rules, both load-bearing:

**Patterns anchor to the whole utterance.** `HELP_RE` once matched the _start_
of a string, so a room called _Help Desk_, _Options_ or _Commands_ was offered
as a chip and then swallowed when tapped. A catalog guard backs this up.

**Smalltalk never runs while a question is pending.** Otherwise typing `help`
at a question orphaned it:

```
"schedule a design sync tomorrow at 10am for 1 hour"
   → "Which room or person is this for?"
"help"
   → "Try asking me to book a room..."      ← the question is gone
```

**PASS: typing `help` at a pending question re-asks that question.** The
invariant test asserts smalltalk claims **none** of the 237 routing fixtures —
if it ever claims one, it is stealing a booking.

## Typo tolerance

Correction runs on the raw utterance **before** classification and extraction,
so the frozen gate and the extractor never see different text. Every correction
is disclosed on the card:

> read "tommorow" as "tomorrow"

**A silent correction is a fail.** Rewriting what someone typed is a guess, and
guesses are shown.

## Manual check

1. `what can you do` → a real answer. (`what can you do` is exactly four words;
   a word-count guard once made every main help phrase unreachable.)
2. `hi` → a greeting. `thanks` → an acknowledgement.
3. Rename a room to **Help Desk**, then tap it on a resource question → it is
   **selected**, not answered with a help blurb.
4. Start a booking, then type `help` at the question → the question is answered
   or re-asked, **not replaced**.
5. `cancel the 3pm review` → still a cancellation.
6. Press send on an empty box → nothing happens.
