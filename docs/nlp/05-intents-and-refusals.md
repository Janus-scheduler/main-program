# 05 · Intents and refusals

Covers routing an utterance to book / move / cancel / look up, and what a
refusal is allowed to say.

## PASS conditions

| #   | Type this                         | Expect                               |
| --- | --------------------------------- | ------------------------------------ |
| E1  | `what is on my calendar tomorrow` | a **lookup**, not a booking          |
| E2  | `cancel the 3pm review`           | a **cancellation**                   |
| E3  | `move my 3pm to 4pm`              | a **change**                         |
| E4  | `cancel` alone                    | not eaten as smalltalk               |
| E5  | `asdkjh qwe zxc`                  | refused, readably                    |
| E7  | anything ambiguous                | **no gate diagnostics** in the reply |
| E8  | any refusal                       | **no literal `**` asterisks\*\*      |

## Refusals must never leak diagnostics

`state.reason` is engineer text. It must never reach the screen. Real examples
that used to:

> I can't act on that — **margin 0.04 below floor 0.1 - ambiguous vs next-best intent**.

> Try something like \***\*book Room A tomorrow at 10am\*\***

**PASS:** no reply anywhere contains `gate1`…`gate5`, `margin`, `floor`,
`confidence 0.`, `nearest neighbour`, `predicted with`, or `**`.

All seven gates have their own plain-English copy. A refusal with no matching
gate still produces readable text, never an empty bubble.

## Refusal advice must actually work

If a refusal tells the user what to type, **typing it must succeed**. This was
violated badly on the cancel path: the commit refused with _"try naming it"_,
and naming the event was rejected — a bare event name does not classify as a
scheduling request. There was no way forward at all.

**PASS: every phrasing a refusal suggests, typed verbatim, gets further than
the refusal did.**

## Verb coverage

Unfamiliar verbs are rewritten before classification, so the vocabulary is
wider than the training set:

| Type this                          | Routes as    |
| ---------------------------------- | ------------ |
| `timetable maths tomorrow at 9am`  | booking      |
| `drop the meeting with <Person>`   | cancellation |
| `bump my 3pm with <Person> to 4pm` | change       |

The rewrite is applied to the string the **classifier** sees; gating still runs
on the original.

## Manual check

1. `the quarterly figures look strong` → a friendly refusal, **no asterisks**,
   no numbers.
2. `asdkjh qwe zxc` → "doesn't look like a scheduling request".
3. Anything ambiguous enough to be borderline → **no** "margin 0.04 below floor".
4. Read any refusal that suggests a phrasing, then **type that phrasing**. It
   must work.
