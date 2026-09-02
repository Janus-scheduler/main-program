# 07 · The Edit button

Covers changing one field on a parse card without disturbing the others.

## PASS conditions

Start from a known card: `book <RoomA> tomorrow at 3pm for 1 hour called standup`
→ **3:00 PM, 1 hr, RoomA, "standup"**.

| #   | Do this                    | Expect                                                |
| --- | -------------------------- | ----------------------------------------------------- |
| G1  | Edit → type `5pm`          | **5:00 PM**, still 1 hr, still RoomA, still "standup" |
| G2  | Edit → type `actually 5pm` | same                                                  |
| G3  | Edit → type `<RoomB>`      | room is **`[RoomB]`** — not both rooms                |
| G4  | Edit → type `planning`     | name is **`planning`** — not "standup planning"       |
| G5  | Edit → **Never mind**      | card **byte-identical**                               |
| G6  | Edit twice in a row        | both changes stick                                    |

**The rule: exactly one field changes, and it changes by replacement.**

## Why replacement, not appending

Every field's answer is merged back into the sentence and the whole thing is
re-parsed. Extraction is **first-mention-wins**, so an appended value always
loses to the one already there:

| Old behaviour                         | Result                              |
| ------------------------------------- | ----------------------------------- |
| `5pm` appended next to `3pm`          | original won — a **complete no-op** |
| `for 30 minutes` next to `for 1 hour` | original won                        |
| `<RoomB>` appended                    | card listed **both** rooms          |
| `planning` appended                   | name became `standup planning`      |

The Edit button also parked on a **dummy `title` slot** so it could accept any
reply, which sent everything typed after Edit to the title handler.

## Both tapping and typing work

Pressing Edit asks which field:

```
What would you like to change?
[ Time ] [ Length ] [ Room or person ] [ Name ] [ Never mind ]
```

Tapping a chip parks on that field's own question. **Typing also works**,
because pressing Edit and typing `5pm` is what people actually do — the field
is chosen from what the text demonstrably _is_: a parseable time is a time, a
catalog name is a room or person, anything else is a name.

That is not a blind guess. Nothing commits without the card being shown again.

## Manual check

1. Book the reference event above. Note all four values.
2. Edit → type `5pm` → **only** the time changed. If nothing changed, that is
   the original bug.
3. Edit → tap **Length** → `30 minutes` → length is 30 min, **time still 5pm**.
4. Edit → type your second room's name → **one** room chip, the new one.
5. Edit → type `planning` → named exactly `planning`.
6. Edit → **Never mind** → nothing changed at all.
7. Check the thread: tapping a chip must show its **label** ("Time"), never an
   internal value like `__edit__:when`.
