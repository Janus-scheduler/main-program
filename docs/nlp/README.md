# NLP chat — verification steps

One file per step. Each is self-contained: what it covers, the **pass
conditions**, and a **manual check** you can run in a browser without reading
any source.

Work through them in order the first time. After a change, run
[00 · gates](00-gates.md) plus the file covering what you touched.

## The steps

| #                                | Step                   | Covers                                           | Automated?      |
| -------------------------------- | ---------------------- | ------------------------------------------------ | --------------- |
| [00](00-gates.md)                | **Automated gates**    | build, lint, types, suites, frozen zone          | fully           |
| [01](01-dates-and-times.md)      | Dates & times          | `tomorrow at 3pm`, `half past two`, `in 2 hours` | 11 cases        |
| [02](02-durations.md)            | Durations              | `for 45 mins`, `until 6pm`, zero-length refusal  | 6 cases         |
| [03](03-resources-and-people.md) | Rooms & people         | catalog matching, unknown names                  | 5 cases         |
| [04](04-titles.md)               | Event titles           | what becomes a name, and what must not           | 5 cases         |
| [05](05-intents-and-refusals.md) | Intents & refusals     | book / move / cancel / look up, refusal copy     | 7 cases         |
| [06](06-conversation-flow.md)    | Conversation flow      | questions, skipping, the round cap, the way out  | 3 cases         |
| [07](07-editing.md)              | The Edit button        | changing one field without disturbing the rest   | partial         |
| [08](08-smalltalk-and-input.md)  | Smalltalk & odd input  | greetings, help, empty and hostile input         | 6 cases         |
| [09](09-timezone.md)             | Timezone               | the card and the timeline must agree             | manual only     |
| [10](10-commit-correctness.md)   | **Commit correctness** | the only step that writes to a real calendar     | **manual only** |
| [11](11-cross-framework.md)      | Cross-framework        | react · angular · solid · vue                    | manual only     |

## Read this before trusting a green run

The automated sweep covers 43 cases and passes all of them. **That has never
meant the chat is correct.** Every one of the most damaging defects found in
this work was caught by hand, in a browser, while the sweep was green:

- a stated duration silently destroyed when the next question was answered
- `3pm` given as a duration answer becoming a **1440-minute** event
- a cancellation that could not identify its target and dead-ended
- a `ReferenceError` on every question the chat asked

The harness only covers what someone thought to write down. Steps
[09](09-timezone.md), [10](10-commit-correctness.md) and
[11](11-cross-framework.md) have no automated coverage at all, and step 10 is
the one where a defect puts wrong data in someone's calendar.

## Conventions

- **PASS** conditions are literal. If the doc says `14:30`, `14:00` is a fail.
- Where a step says _disclosed_, the parse card must **say so in a note**.
  Getting the right answer silently is a fail — the card is a verification
  surface, and one that hides its own guesses is not doing its job.
- `<Room>` means any room in your demo's catalog. `<Person>` likewise.
