# @janus-scheduler/nlp

The natural-language layer behind **Janus Scheduler**: intent classification, entity extraction and a conversational session manager that turns "book Alice the small meeting room next Tuesday at 2" into a scheduled event.

```bash
npm install @janus-scheduler/nlp
```

> **You almost certainly get this already.** It is a runtime dependency of `@janus-scheduler/react`, `/angular` and `/solid`, all of which re-export the parts you need. Install it directly only if you are using the engine on its own.

## Two entry points

| Import                      | Runs in          | Purpose                                                 |
| --------------------------- | ---------------- | ------------------------------------------------------- |
| `@janus-scheduler/nlp`      | Browser and Node | The pure engine. No `fs`, no `fetch`, no Node builtins. |
| `@janus-scheduler/nlp/node` | Node only        | Loads the model artifacts from disk.                    |

The split is deliberate: the main entry stays free of Node builtins so bundlers can tree-shake the loader out of a browser build.

## Model artifacts

The classifier needs three data files, shipped in the package and **never imported** — they total ~6 MB, so you load them at runtime and cache them:

```
@janus-scheduler/nlp/artifacts/vocab.json       (487 kB)
@janus-scheduler/nlp/artifacts/vectors.bin      (3.0 MB)
@janus-scheduler/nlp/artifacts/prototypes.json  (2.5 MB)
```

In a browser, let your bundler give you URLs and fetch them:

```ts
import vocabUrl from "@janus-scheduler/nlp/artifacts/vocab.json?url";
import vectorsUrl from "@janus-scheduler/nlp/artifacts/vectors.bin?url";
import protoUrl from "@janus-scheduler/nlp/artifacts/prototypes.json?url";
import { parseArtifacts, parsePrototypes } from "@janus-scheduler/nlp";

const [vocab, vectors, protos] = await Promise.all([
  fetch(vocabUrl).then((r) => r.json()),
  fetch(vectorsUrl).then((r) => r.arrayBuffer()),
  fetch(protoUrl).then((r) => r.json()),
]);

const artifacts = parseArtifacts(vocab, vectors);
const prototypes = parsePrototypes(protos);
```

In Node, use the loader:

```ts
import { loadArtifacts, loadPrototypes } from "@janus-scheduler/nlp/node";
```

## Conversation

`ChatController` drives a multi-turn conversation: it asks for whatever is missing (who, when, how long), accepts corrections, and produces a committable session.

```ts
import {
  ChatController,
  catalogFromResources,
  commitSession,
} from "@janus-scheduler/nlp";

const catalog = catalogFromResources(manager.getAllResources());
// …run the conversation, then:
commitSession(manager, state, fallbackId, { preventConflicts: false });
```

`commitSession` writes through `SchedulerManager`, so lifecycle hooks and rollback apply as usual.

The framework packages wrap this for you — `useJanusChat()` in React, `createJanusChat()` in Solid, `JanusChatService` in Angular — and `<janus-chat>` in `@janus-scheduler/ui` is the matching UI.

## Also exported

`normalize`, `wordpiece`, `embedText`, `cosine`, `classify`, `classifySmalltalk`, `extractEntities`, `correctTimeWords`, `reviseSlot`, `NLP_VERSION`.

## Dependencies

`chrono-node` for date and time parsing. Everything else — tokenisation, embeddings, classification — is implemented in this package.

## Documentation

Full docs and the framework packages: [Janus-scheduler/main-program](https://github.com/Janus-scheduler/main-program).

## Licence

ISC
