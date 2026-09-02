# 02 · Durations

Covers how long an event is, and refusing lengths that are not lengths.

## PASS conditions

| #   | Type this                   | Card must show                          |
| --- | --------------------------- | --------------------------------------- |
| B1  | `... for 1.5 hours`         | **90 min**                              |
| B2  | `... for 2.5 hrs`           | 150 min                                 |
| B3  | `... for 0.5 hours`         | 30 min                                  |
| B4  | `... for 45mins` (no space) | 45 min                                  |
| B9  | `... for 90 minutes`        | 1.5 hr                                  |
| B8  | `... for 0 minutes`         | **refused** — never a zero-length event |

Fractions and unspaced forms are both load-bearing regressions. `1.5 hours`
once became **five hours**, and `45mins` was accepted but never parsed back, so
the question repeated until the conversation died.

## A duration stated before a date

```
book <Room> for 30 minutes
  → asks when
tomorrow at 3pm
```

**PASS: the card shows 30 min.**

This is the shape that silently destroyed data. Answering `when` used to
replace the whole time span — durations included — so the message became
"book <Room> for tomorrow" and the event was created at the 60-minute default.
The count was wrong too: the progress line said "2 more to go" while the words
"for 30 minutes" were visible in the user's own message.

**Also PASS:** the counter must not ask for a length you already gave.

## Answering the "how long?" question

The question is _"How long should it be, or when should it end?"_, so it takes
both shapes.

| Answer                                              | Result           |
| --------------------------------------------------- | ---------------- |
| `45 mins`, `1 hour`, `2 hr`                         | that length      |
| `until 6pm`, `till 5:30pm`, `to 4pm`, `ends at 5pm` | start → that end |
| `at 4pm` (start 3pm)                                | 60 min           |
| `3pm` when it starts at 3pm                         | **re-asks**      |
| `2pm` when it starts at 3pm                         | **re-asks**      |
| `the 3pm one`                                       | **re-asks**      |

**Any clock at or before the start must re-ask, never resolve.** This branch
used to treat _any_ clock as an end time and roll a whole day when it was
earlier: `3pm` produced a **1440-minute** event, `9am` an 18-hour one, and
re-typing the original request produced 24 hours and reported success.

**Overnight bookings still work** — the day-roll survives, but only with an
explicit cue:

| Starting 10pm  | Result      |
| -------------- | ----------- |
| `until 2am`    | 240 min     |
| `to 6am`       | 480 min     |
| `2am` (no cue) | **re-asks** |

## Manual check

1. `book <Room> tomorrow at 3pm` → at "how long?", answer **`3pm`**.
   It must re-ask. A card showing **24 hr** is the bug.
2. Answer `until 6pm` → **3 hr**.
3. `book <Room> for 30 minutes` → answer `tomorrow at 3pm` → card says
   **30 min**, and you were never asked for a length.
4. `book <Room> tomorrow at 3pm for 0 minutes` → must ask for a real length.
