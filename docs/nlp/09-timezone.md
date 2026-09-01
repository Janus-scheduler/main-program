# 09 · Timezone

**No automated coverage.** A defect here is invisible in tests and obvious to a
user: the card says one time, the timeline draws another.

## The rule

The chat resolves what you type in the zone the **calendar is displaying**. If
you are looking at Tokyo time, "3pm" means 3pm as shown on screen. That is the
only zone the user can reasonably mean.

The host passes the zone as a **function**, so it is re-read at the start of
every turn. Passed as a captured string, changing the display zone mid-session
leaves the chat resolving in the old one — the card and the block then disagree
by hours, silently.

## PASS conditions

| #   | Do this                                                                  | Expect                                                                  |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| J1  | Start an event, change the display zone, type a title                    | zone holds; no jump                                                     |
| J2  | Set the display zone several hours from your own, book `tomorrow at 3pm` | an **amber warning** with the converted time, Confirm still **enabled** |
| J3  | Set the zone back to your own                                            | the warning disappears                                                  |
| J4  | Book across a DST transition                                             | duration correct in **wall-clock** terms                                |
| J5  | Compare the card's time with the rendered block                          | **identical**                                                           |

## Warnings never block

The amber row is a **warning**, not a gate: it says the calendar is showing a
zone you are not in, and leaves the decision to the human. Distinct from the
notes below it, which disclose values the system _invented_.

Confirm must stay enabled. A warning that disables the button is a fail.

## Manual check

1. Set the calendar's display timezone several hours from your own.
2. `book <Room> tomorrow at 3pm`.
   - The card says **3:00 PM**.
   - An amber row names the display zone and gives your local equivalent.
   - **Confirm is enabled.**
3. Confirm. The timeline block sits at **3:00 PM in the displayed zone** —
   the same position the card described.
4. Switch back to your own zone → the warning is gone on the next booking.
5. Book across a DST boundary → a "1 hour" event still reads as one hour on the
   wall clock.

## If it fails

Check the host is passing `timezone` as a **getter**, not a captured string.
A thrown or empty getter degrades to the browser zone rather than taking the
turn down — that fallback is deliberate.
