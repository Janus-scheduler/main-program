# 01 · Dates and times

Covers turning a phrase into an instant, and disclosing anything invented.

## PASS conditions

Type each into the chat. `NOW` below means the moment you run it.

| #   | Type this                               | Card must show                             |
| --- | --------------------------------------- | ------------------------------------------ |
| A1  | `book <Room> tomorrow at 3pm`           | tomorrow, **3:00 PM**                      |
| A2  | `book <Room> next Tuesday at 10am`      | the _coming_ Tuesday, 10:00 AM             |
| A4  | `book <Room> on the 25th at 9am`        | the 25th of the current month, 09:00       |
| A5  | `book <Room> tomorrow morning`          | 09:00 **and a note** saying it was assumed |
| A6  | `book <Room> tomorrow at half past two` | **2:30 PM** + a note reading it as 14:30   |
| A7  | `book <Room> tomorrow at noon`          | **12:00 PM**                               |
| A8  | `book <Room> tomorrow at midnight`      | **12:00 AM** — 00:00, never 12:00          |
| A10 | `book <Room> tomorrow 3pm to 5pm`       | 3:00 PM, **2 hr**                          |
| A13 | `book <Room> tomorrow at 25:00`         | **not** 01:00 — it must refuse or ask      |
| A14 | `book <Room> in 2 hours`                | NOW **+ 2 hours**, to the minute           |

## Conversational clock phrases

`half past`, `quarter past`, `quarter to`, in words or digits.

| Type this           | Expect                             |
| ------------------- | ---------------------------------- |
| `half past two`     | 14:30                              |
| `half past nine`    | 09:30                              |
| `quarter past 3`    | 15:15                              |
| `quarter to 4`      | **15:45** — the hour _before_ four |
| `quarter to twelve` | 11:45                              |
| `half past two pm`  | 14:30, and **no** note             |

**The meridiem rule.** A bare hour has no half of the day, so one is chosen by
the working day: **1–5 → afternoon, 6–11 → morning, 12 → noon**. That is a
guess, so it is disclosed:

> "half past two" taken as 14:30

**PASS: the note is present when no am/pm was typed, and absent when it was.**
Resolving correctly _without_ the note is a fail — that presents our guess as
the user's own words.

## "in 2 hours" is a start time, not a length

`for 2 hours` and `in 2 hours` are opposite meanings sharing a surface form.

| Type this                                 | Expect                                                        |
| ----------------------------------------- | ------------------------------------------------------------- |
| `book <Room> in 2 hours`                  | starts 2 hours from now                                       |
| `book <Room> in 30 minutes`               | starts in 30 minutes — **not** a 30-minute event with no time |
| `book <Room> in 2 hours for 30 minutes`   | starts in 2 hours, **30 min** long                            |
| `book <Room> tomorrow at 3pm for 2 hours` | 3:00 PM, **2 hr** — unchanged                                 |

Minutes and hours only. `in 2 days` is deliberately left to the ordinary date
patterns: a day-scale offset says nothing about the time of day, and deriving
one from the current clock would be worse than the 09:00 default, which is
disclosed.

**No rounding.** At 08:37, `in 2 hours` is **10:37**. Tidying it to 10:30 would
invent a time nobody asked for.

## Manual check

1. `book <Room> tomorrow at half past two` → card says **2:30 PM**, carries the
   note, and the event name is **not** "half past two".
2. Confirm it. The timeline block must sit at 2:30 PM.
3. `book <Room> in 2 hours` → check the card against your own clock.
4. `book <Room> tomorrow at 25:00` → must **not** silently become 1:00 AM.

## Known limits

- `quarter past midnight` resolves to 00:00, not 00:15. Pre-existing, rare, and
  not worth complicating the pattern for.
- A phrase the **frozen** gate does not recognise as a time anchor still needs
  another anchor in the sentence. `book <Room> at half past two` (no day) may
  still ask "when?" — the gate layer is frozen and is not changed by this step.
