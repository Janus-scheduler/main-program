# 03 · Rooms and people

Covers matching names against the host's catalog, and what happens to a name
that is not in it.

## PASS conditions

| #   | Type this                                                 | Expect                                       |
| --- | --------------------------------------------------------- | -------------------------------------------- |
| C1  | `book Room A tomorrow at 3pm` (Room A **not** in catalog) | asks — "I don't have …"                      |
| C4  | `book MRI Scanner C tomorrow at 3pm` (not in catalog)     | asks. Must **not** silently become the title |
| C5  | `schedule with Sarah tomorrow at 10am`                    | matches **Dr. Sarah Chen**                   |
| C6  | `book with Dr tomorrow at 10am`                           | must **not** match every doctor              |
| C12 | `book the projector tomorrow at 3pm`                      | asks which one                               |

C4 is the reason the catalog check exists in the session layer: only names
containing a **frozen** resource word (`room`, `projector`, …) were caught, so
anything else — an equipment name, a ward, a bay — sailed past and became the
event's name.

## Multi-word and partial names

| Type this                               | Expect                                         |
| --------------------------------------- | ---------------------------------------------- |
| `book Operating Room 1 tomorrow at 3pm` | matches the room, not "Room"                   |
| `book ICU Bay 6 tomorrow at 3pm`        | matches — a trailing digit is part of the name |
| `meet Alex and Priya tomorrow at 10am`  | **both** people attached                       |
| `a retro with Alex in Room A tomorrow`  | Alex **and** Room A                            |

The last two are regressions worth keeping: a designator pattern once swallowed
short function words, so `and` and `in` ate the name after them and Alex was
silently dropped.

## Two kinds of unrecognised name

Both ask. They ask _different things_, and that is correct — do not read the
second as a bug.

| The name is                                                              | Detected because                                          | It asks                                     | Answering                                            |
| ------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| resource-**like** — `MRI Scanner C`, `Operating Room 9`, `the projector` | a frozen resource word, or a near-miss of a catalog entry | _“I don’t have X. Which one did you mean?”_ | **replaces** it — the name is gone from the title    |
| not resource-like — `Meeting Pod 4`                                      | nothing marks it as a room                                | _“Which room or person is X for?”_          | keeps it as the event **name** and attaches the room |

The second is a coherent reading: the user never said `Meeting Pod 4` was a
room, so an event of that name, in the room they then pick, is what they asked
for.

**The invariant, and the only thing that must never happen:** an unrecognised
name reaching a confirmable card without anything being asked.

## Head-noun rule

The last noun decides what a phrase is:

| Phrase            | Read as                                 |
| ----------------- | --------------------------------------- |
| `3rd floor room`  | a **room**                              |
| `room inspection` | an **inspection** — a title, not a room |

## Manual check

1. Type a room name **that is not in your catalog**. It must **ask**, and the
   name must not appear as the event title.
2. Answer with a real room from the chips → the card shows that room, and the
   rejected name is gone.
3. `book <Room> with <Person> tomorrow at 3pm` → both chips on the card.
4. Confirm → the timeline attaches **all** named rows, not just the first.
