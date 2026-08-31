# Fixtures — provenance

**Nothing in this directory is needed at runtime.** These files are test inputs
only. `package.json`'s `files` allowlist is `["dist", "artifacts", "docs"]`, so
`fixtures/` is never published to npm. `@janus-scheduler/nlp` has zero runtime
dependencies and consumers never see any of this.

Both files were produced by the **Python reference implementation** in the
research repo (`C:/Users/HP/Desktop/NLP-Learn/static-embedding/packages/nlp`).
That is the entire point: a fixture generated from the TypeScript would only
prove the TypeScript agrees with itself. Once these exist, the Python
implementation can be retired — which is `PROJECT.md`'s stated goal.

**Python is required to _regenerate_ these files, never to _use_ them.** The
test suite, CI, and the published package all read the committed JSON.

---

## `parity.json` — 120 rows

Copied byte-identical from the research repo's `src/artifacts/parity.json`
(verified with `cmp`). Records, per input: the stripped text, the verb phrase,
the normalized text, both token-id sequences, and both float vectors.

Consumed by [`tests/parity.test.ts`](../tests/parity.test.ts) — proves the
**embedding** half of the pipeline reproduces Python exactly.

## `routing_fixtures.json` — 237 rows

Generated 2026-08-07 by [`tools/gen_routing_fixtures.py`](tools/gen_routing_fixtures.py).

`PROJECT.md` §7 listed generating this as a "do this **before** migrating" TODO
that was never executed. It calls the exact function that section prescribes —
`gates.route_query` — and records `{text, source, intent, confidence, margin,
route, gate}` per row.

| source                                                                | rows                       |
| --------------------------------------------------------------------- | -------------------------- |
| `corpus/dev.jsonl`                                                    | 105                        |
| `scripts/typo_robustness_check.py` (`TYPO_ROWS`, imported not copied) | 12                         |
| `src/artifacts/parity.json` texts                                     | 120                        |
| **total**                                                             | **237** (all texts unique) |

Consumed by [`tests/routing.test.ts`](../tests/routing.test.ts) — proves the
**scoring and gate** half agrees with Python. This is the only thing that can
catch a wrong `CONF_FLOOR`, an inverted margin, a reordered gate, or a typo in
`EVENT_NOUNS`; `parity.json` structurally cannot, because it never calls
`classify()` or any gate.

Recorded distribution (Python's measured behaviour, not a target):

| route   | rows | gates                                                                               |
| ------- | ---- | ----------------------------------------------------------------------------------- |
| PROCEED | 59   | —                                                                                   |
| CLARIFY | 93   | `negation` 28, `gate3b_resource_only` 30, `gate4_margin` 3, `gate5_missing_slot` 32 |
| REJECT  | 85   | `gate1_confidence` 34, `gate2_nearest_none` 27, `gate3_no_anchor` 24                |

Every gate fires at least 3 times, so "237/237 agree" is a statement about the
whole gate layer rather than about a few popular paths.

---

## Regenerating `routing_fixtures.json`

Only necessary if `artifacts/` changes — i.e. if the model is retrained. The
frozen algorithm alone changing is not a valid reason; it is frozen.

```bash
python -m venv .venv                 # anywhere outside both repos
.venv/Scripts/python -m pip install numpy
.venv/Scripts/python packages/nlp/fixtures/tools/gen_routing_fixtures.py \
    packages/nlp/fixtures/routing_fixtures.json
```

`numpy` is the only install. `scripts/requirements.txt` in the research repo
also lists `spacy`, but `scripts/preprocess.py` merely `import`s it at module
top — the only callers are `head_verb_phrase()` and `content_words()`, and the
routing path reaches neither:

```
gates.route_query
  └─ reference_classifier.classify
       ├─ preprocess.strip_slots               pure regex
       ├─ preprocess.head_verb_phrase_lexicon  pure regex
       └─ reference_embedder.embed_text        numpy only
  └─ gates.route_from_classification           pure regex + comparisons
```

So [`tools/spacy_stub/`](tools/spacy_stub/) satisfies the import instead. It
**raises** on any actual use rather than returning a plausible dummy — if the
real spaCy were ever needed the run fails loudly instead of silently emitting
fixtures from degraded behaviour. The generator additionally asserts it is
running against the stub, so a silent swap cannot go unnoticed.

## Why the routing test compares numbers with a tolerance

`intent`, `route` and `gate` are compared **exactly** — they are the decision.

`confidence` and `margin` are compared within `1e-5`, and cannot be exact by
construction: Python accumulates the dot product in float32 via NumPy/BLAS
(which may also reassociate the sum), while JavaScript has no float32
arithmetic and accumulates float32 inputs in a float64 number. Measured
worst-case disagreement across all 237 rows is **1.2e-7** — float32 epsilon —
which the test also asserts stays an order of magnitude below the tolerance, so
a loosened tolerance can never quietly mask a real divergence.
