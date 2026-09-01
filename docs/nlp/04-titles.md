# 04 · Event titles

Covers what becomes the event's name — and, more importantly, what must not.

Anything the extractor does not claim falls through and becomes the title. That
is the single route by which several unrelated defects all produced a nonsense
event name.

## PASS conditions

| #   | Type this                                    | Title must be            |
| --- | -------------------------------------------- | ------------------------ |
| D3  | `book <Room> tomorrow at 3pm called standup` | `standup`                |
| D4  | `book room inspection tomorrow at 3pm`       | `room inspection` — kept |
| D5  | `book projector demo tomorrow at 3pm`        | `projector demo` — kept  |
| D7  | `don't book <Room> tomorrow at 3pm`          | **not** `don't book`     |
| D10 | `book <Room> at half past two tomorrow`      | **not** `half past two`  |

## The three rules

**A time phrase is never a title.** D10 was a missing pattern, not a title bug:
`half past two` matched nothing, so it stayed unclaimed and fell through. Fixing
the parse fixed the title.

**A negation cue is never a title.** Whether the user said "don't" is the
negation gate's business — it is routing information, not event content. The cue
is blanked before extraction.

**A naming verb introduces a title but is not part of it.** `called`, `named`,
`titled`, `entitled` are dropped, so `called standup` is `standup`.

## No title is a valid answer

An event with no name is committed as the card's fallback, and the card **says
so in a note**. The name on the card and the name on the created event must be
identical — including when the typed title is only whitespace.

## Manual check

1. `book <Room> at half past two tomorrow` → time is **2:30 PM**, and the event
   has **no** name (or asks for one). `half past two` must not be the name.
2. `don't book <Room> tomorrow at 3pm` → confirm the negation → the card must
   not be named `don't book`.
3. `book <Room> tomorrow at 3pm called standup` → named exactly `standup`.
4. Skip the name when asked → the card discloses the fallback, and the created
   event is called **exactly** what the card showed.

## Known limit

`do not book …` leaves `do book` as the name. The cue is removed, but the
leftover auxiliary is not, and `LEADING_WRAPPERS` lives in the frozen zone so
the verb cannot be recognised after it. `don't` — far commoner — is clean.
