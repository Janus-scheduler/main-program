# 11 · Cross-framework

**No automated coverage.** All the behaviour in steps 01–10 is shared code, so
it should be identical everywhere. Only the **wiring** differs, and wiring is
exactly what these demos get wrong.

## The demos

```bash
npm run dev:react-demo
npm run dev:angular-demo
npm run dev:solid-demo
cd demo/vue-demo && npm run dev      # not a root script
```

Angular's wrapper builds with `tsc`, not Vite — its `dist` goes stale silently.
Rebuild it explicitly after wrapper changes:

```bash
npm run build -w @janus-scheduler/angular
```

## PASS conditions

Per framework: ⬜ react · ⬜ angular · ⬜ solid · ⬜ vue

| #   | Check                  | Expect                                              |
| --- | ---------------------- | --------------------------------------------------- |
| L1  | One booking end to end | identical card to the other frameworks              |
| L2  | Tap a choice chip      | shows the chip's **label**, not an internal value   |
| L3  | Confirm → the timeline | event appears on the right row at the right time    |
| L4  | **Undo**               | works from the success bubble                       |
| L5  | Timezone getter wired  | changing the display zone affects the **next** turn |
| L6  | Console                | **no errors**, and no `nlp threw error`             |

## L6 deserves special attention

The controller wraps the whole turn in a `try`/`catch` that logs
`nlp threw error` and returns. To a user that is not an error — it is the chat
going **silent**: the thinking dots vanish and no reply ever arrives.

**Keep the console open for the whole pass.** A silent turn is the single
easiest failure to miss by eye, and it is how a shipped `ReferenceError` on
every question went unnoticed.

## Things that differ legitimately

- Event **unwrapping**. Each wrapper intercepts the web components'
  `CustomEvent`s and hands the consumer `event.detail`, so no consumer sees a
  raw DOM event. A framework where callbacks receive the DOM event is
  mis-wired.
- Vue has **no wrapper package** — the demo consumes the web components and
  core directly. That is expected, not a gap.

## Manual check

For each of the four, in order:

1. Start the demo. Open the console.
2. Book something with a room, a person, a time and a name.
3. Tap at least one choice chip — check the bubble shows its label.
4. Confirm. Find the event on the timeline: right row, right time.
5. Undo. It disappears.
6. Change the display timezone, book again → the new zone applies.
7. Console clean.

Record the result against the ⬜ boxes above and in
`docs/NLP_EDGE_CASE_CHECKLIST.md` (Phase L).
