# 10 · Commit correctness

> **This step has never been completed in a browser.**
>
> It is the only step where a defect puts **wrong data in a real calendar** and
> reports success. Everything else wastes a click. Do this one first if you do
> only one.

Automated tests cover this path against an in-memory stub, and a stub only
reproduces what its author remembered to reproduce. The two behaviours that
actually caused data loss — the store throwing on invalid data, and silently
overwriting on a duplicate id — are pinned in
`packages/core/tests/nlp-commit.integration.test.ts` against a real
`SchedulerManager`. Everything below is what neither can check.

## PASS conditions

| #   | Do this                                       | Expect                                            |
| --- | --------------------------------------------- | ------------------------------------------------- |
| K1  | Book with **2 rooms + 2 people**, confirm     | **all four** attached on the timeline             |
| K2  | Compare the card's time to the rendered block | **identical**                                     |
| K3  | Book into an **occupied** slot                | conflict still flagged on the timeline            |
| K4  | Confirm, then **Undo**                        | event gone; the bubble reads _Undone_             |
| K5  | **Double-click Confirm**                      | **one** event, not two                            |
| K6  | **Skip the resource**, confirm                | lands on the row the card disclosed               |
| K7  | **Skip the name**, confirm                    | named **exactly** what the card said              |
| K8  | **Cancel** an event, then **Undo**            | colour, recurrence **and** resources all restored |

## What each one is really testing

**K1 — multi-resource.** The commit sends every named row. Watch for only the
first being attached.

**K2 — see also [09 · Timezone](09-timezone.md).** The card and the block are
rendered by different code from different sources. They must agree.

**K3 — conflicts.** The chat commits through the same manager as the rest of
the app, so the timeline's own conflict detection still applies. A chat booking
must not be able to double-book where a dragged one could not.

**K4 / K8 — undo fidelity.** Undo must restore **exactly** what was there, not
a reconstruction. K8 is the strict one: cancel an event that has a colour, a
recurrence rule and several resources, then undo, then inspect **all** of them.
A field missing from the snapshot is a field undo silently drops.

**K5 — double confirm.** Guarded twice: the session is cleared on success, and
the UI disables the button once the card is finalised. Event ids are random
UUIDs — the old `nlp_${Date.now()}` repeated within a millisecond, and the store
is a keyed map, so the second commit **replaced** the first.

**K6 / K7 — disclosed fallbacks.** When you skip a field, the card says what
will be substituted. The created event must match that promise exactly,
including a title that is only whitespace.

## Cancelling by room and time

A cancellation does not need the event's name. `cancel <Room> tomorrow at 2pm`
identifies one room and one instant, which is how people actually speak.

| Do this                                                | Expect                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `don't book <Room> tomorrow at 2pm` → **yes** → Cancel | cancels the real booking, and the success message **names it**                       |
| Same, with **two** events in that room then            | refuses and **names both**                                                           |
| Same, with **nothing** booked then                     | "I couldn't find anything booked on `<Room>` at …"                                   |
| `cancel <Room> tomorrow` (no time)                     | falls back to that **whole day**; exactly one booking cancels, more than one refuses |

Exactly one match commits. Deleting the wrong event is far worse than asking.

**A cancellation card must show no invented duration** — no `1 hr` chip, no
"assumed 60 minutes" note. The event being removed already has a length, and
that text above a red **Cancel event** button reads as though something is
about to be created. The invented **time** is still disclosed: that is how the
event is identified.

## Lookups write nothing

`what's on my calendar tomorrow` answers in one turn. It must **not** produce a
"✓ Scheduled" bubble, an Undo button, or a calendar change of any kind.

## Manual check — run in order

1. **K1** — book naming two rooms and two people. Confirm. Inspect the
   timeline: all four rows.
2. **K2** — note the card's time before confirming; compare to the block.
3. **K5** — book again and **double-click Confirm**. Count the events: one.
4. **K4** — press **Undo**. The event disappears; the bubble says _Undone_.
5. **K6** — book naming no room, skip when asked. The card names the fallback
   row. Confirm. It lands **there**.
6. **K7** — book with no name, skip when asked. The card shows the fallback
   name. Confirm. The event is called **exactly** that.
7. **K3** — book into a slot that is already taken. The timeline flags the
   conflict as it would for a dragged booking.
8. **K8** — find an event with a colour, a recurrence and several resources.
   Cancel it via chat. Undo. Check **every** attribute came back.
9. **Lookup** — `what's on my calendar tomorrow`. No card, no Confirm, no Undo,
   nothing written.

## Record the result

Tick these off in `docs/NLP_EDGE_CASE_CHECKLIST.md` as you go. Until then that
file's Phase K section is accurate: _nothing here has been checked in a browser._
