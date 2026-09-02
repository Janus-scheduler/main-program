# janus-scheduler NLP — project documentation

Complete record of what was built, why each decision was made, where it landed, and what happens
next. Written at the end of Phase 1.7, when the algorithm was frozen.

- **Spec (normative):** [packages/nlp/docs/ALGORITHM.md](packages/nlp/docs/ALGORITHM.md) — the
  frozen pipeline, every constant, and the working log behind each choice. If this file and that
  one ever disagree, **ALGORITHM.md wins**.
- **Diagram:** [architecture.drawio](architecture.drawio) — open at [app.diagrams.net](https://app.diagrams.net).
  Three pages: build pipeline, runtime pipeline, migration topology.

> ⚠️ [README.md](README.md) and [CLAUDE.md](CLAUDE.md) at this root are **stale**. README.md still
> describes the abandoned 8-intent taxonomy. CLAUDE.md predates Tasks 4.5–7. Trust this file and
> ALGORITHM.md.

---

## 1. What this is

A **Tier-0 intent classifier** for scheduling utterances. It maps a sentence to one of five
intents — `add_event`, `delete_event`, `modify_event`, `get_details`, `none` — and then *routes*
it to one of three outcomes: `PROCEED`, `CLARIFY`, or `REJECT`.

The defining constraint: **no neural inference at runtime.** No ONNX, no WASM, no model server, no
ML dependency on the request path. Classifying a sentence is array lookups, a weighted mean, and
dot products.

That is possible because [`model2vec`](https://github.com/MinishLab/model2vec)'s
`minishlab/potion-base-8M` is a *frozen token → vector lookup table*, not a network. It is never
trained or fine-tuned. It is used exactly once, offline, to produce a pruned int8 table plus a set
of labelled example vectors. Runtime does cosine-kNN against those.

**Nothing in this project trains a model.** All of the work described below is data curation,
deterministic preprocessing, scoring-function design, and calibration.

---

## 2. Current state at a glance

Measured on `corpus/dev.jsonl` (105 rows: 65 genuine, 40 `none`). `test.jsonl` remains **sealed and
never scored**.

### Routed metrics — what a user actually experiences

| metric | value | target | status |
|---|---|---|---|
| false-accept (PROCEED + wrong) | **2.86%** (3/105) | <2% | ✗ |
| none recall | **87.50%** (35/40) | ≥95% | ✗ |
| REJECT precision | **94.59%** (35/37) | ≥90% | ✓ |
| false-negative (genuine REJECTed) | **3.08%** (2/65) | <2% | ✗ |
| PROCEED precision — all rows | 91.18% (31/34) | — | |
| **PROCEED precision — genuine only** | **100%** (31/31) | — | |

Route distribution: PROCEED 34/105 (32.4%) · CLARIFY 34/105 (32.4%) · REJECT 37/105 (35.2%).
Genuine-only: PROCEED 31/65 (47.7%) · CLARIFY 32/65 (49.2%) · REJECT 2/65 (3.1%).

> The dev set is **deliberately adversarial** — 38% out-of-domain, far more than real traffic.
> Always read the genuine-only column alongside the aggregate.

### ⚠️ The single most important fact for anyone porting this

The **raw classifier without gates is not shippable.** Same 105 rows, `classify()` alone:

| | raw classifier | with gates |
|---|---|---|
| false-accept | **21.90%** (23/105) | **2.86%** (3/105) |
| none recall | **35.00%** (14/40) | **87.50%** (35/40) |
| flat accuracy | 67.62% (71/105) | — |

The gate layer is not a polish pass — it **eliminates 87% of the raw classifier's false accepts**
(21.90% → 2.86%) and more than doubles none recall. Any port that implements the embedding and kNN
but stops before `gates.py` will look like it works on happy paths and fail catastrophically on
real traffic.

This gap *widened* during Phase 1.7 rather than closing: raw false-accept went 3.70% (Task 4 entry)
→ 8.64% (after Task 4.5's `none` rescoring) → 21.90% (after Task 5's `none` growth), while the
routed figure stayed between 1.23% and 2.86% throughout. Both changes deliberately made the raw
classifier's job harder in exchange for outcomes the gates could act on — which is only a good
trade if the gates ship.

---

## 3. How it works

Full normative detail in [ALGORITHM.md](packages/nlp/docs/ALGORITHM.md). Summary:

```
raw text
  ├─────────────────────────────────────────────┐  (gates read the RAW text)
  ▼                                             │
two views built in parallel:                    │
  strip_slots(text) ──► normalize ► wordpiece ► embed ► vec_full
  head_verb_phrase_lexicon(text) ─► normalize ► wordpiece ► embed ► vec_verb
  ▼                                             │
dual-vector kNN vs 222 prototypes:              │
  sim = α·cos(q_full, p_full) + β·cos(q_verb, p_verb)
        α=0.2 β=0.8  for the 4 event intents
        α=1.0 β=0.0  for `none`      ◄── deliberate asymmetry
  ▼                                             │
max-similarity-per-intent vote  ──► intent, confidence, margin
                                    (margin skips `none` entirely)
  ▼                                             │
gate layer  ◄───────────────────────────────────┘
  negation → gate1 conf → gate2 nearest-none → gate3 no-anchor
           → gate3b resource-only → gate4 margin → gate5 missing-slot
  ▼
PROCEED  |  CLARIFY  |  REJECT
```

**Why two vectors.** Mean-pooling dilutes: in *"cancel the design review in seminar room 1 at 5pm
tomorrow"*, the one word carrying the intent (the verb) is averaged against nine words of slot
detail that are identical across add/delete/modify. Splitting the verb into its own vector and
weighting it at β=0.8 restores that signal.

---

## 4. The journey

### Phase 1 — build the thing
Offline build (`build_embeddings.py`), a from-scratch reference embedder, a CLI oracle, and eval.

`reference_embedder.py` deliberately does **not** call `model2vec.StaticModel.encode()`. It
reimplements normalization, WordPiece, and pooling from scratch, because those exact semantics
have to be reproduced in TypeScript with zero ML dependencies later. This decision paid for itself
repeatedly.

### Phase 1.5 / 1.6 — the corpus was lying
Audits found **59+ mislabelled rows**. The dominant bug: resource-*consumption* utterances
mislabelled as resource-*catalogue* intents.

**Taxonomy rule established: resources are a slot, not an intent.** *"book the conference room"* is
`add_event` where a resource happens to be the object — not a distinct user goal. The original
`add_resource`/`edit_resource`/`view_resource` trio was **deferred, not deleted**
(`corpus/deferred_resource_*`), collapsing 8 intents → 5.

The same mislabelling bug escaped detection **twice** — once because no check existed for one
intent, once because the check covered `intents.yaml` but not the gold splits. `audit_corpus.py`
was therefore rewritten to scan **every file and every intent unconditionally, with no scoping
flag**. That was a process fix, not a code fix.

**Entry baseline for 1.7:** 61.64% flat accuracy, 4.11% false-accept, 88.89% accuracy given
margin>0.15 — but that confident band covered only **37%** of rows.

### Phase 1.7 — accuracy & calibration
Diagnosed the bottleneck as **dilution, not label noise**. The signature — well-calibrated when
confident, but confident far too rarely — is dilution's fingerprint.

| task | what happened |
|---|---|
| **0** | Applied 11 signed-off `test.jsonl` corrections, logged to `TEST_SET_CHANGELOG.md` with a written disclosure that the set had never been scored. |
| **1** | Ablations on the clean corpus. A deterministic **verb lexicon beat spaCy** (86.30% vs much lower) — spaCy lemmatizes `is`/`are`/`what's` → `be`, destroying `get_details`, and mistags imperatives. Verified the lexicon was not harvested from `dev.jsonl` before trusting it. |
| **2** | Slot-stripping moved *before* embedding, applied identically at build and query time. |
| **3** | **Dual-vector scoring.** α/β swept over 21 points; α=0.05–0.20 is a flat plateau. Picked **α=0.2 / β=0.8** (upper end, for distance from the lexicon's ~25% OOV rate). Verified it was a plateau and not a spike fitted to 73 rows. |
| **4** | **Gate layer + negation.** Gates run on pre-strip raw text. Negation is checked *first* and forces CLARIFY unconditionally — SIF/Zipf downweighting suppresses "not" almost by design, so confidence cannot be trusted when negation is present. False-accept 3.70% → 1.23%; none recall 50% → 93.75%. |
| **4.5** | **The `none`-attractor collision.** See below — the most interesting finding of the project. |
| **checks** | Four pre-Task-5 audits: counted anchor-bearing near-misses (found exactly 1 in 295 utterances), audited `EVENT_NOUNS` (26/28 clean), computed **granularity ceilings**, and redefined margin. |
| **5** | Grew `none` 21 → 75 in three measured batches. Batch 3 was run as a deliberate **experiment**, expected to make a metric worse — and it did, informatively. |
| **6** | Threshold sweep. **Concluded: change nothing.** See below. |
| **7** | Froze constants, wrote the spec, regenerated `parity.json` with the dual-vector schema, rewrote the JS REPL. |

#### Task 4.5 — `none` is object-carried, not verb-carried

A genuine `modify_event` utterance was being silently rejected:

```
"update our av setup for the call"        → verb "update"   (genuine)
"update the parking pass for the client"  → verb "update"   (a `none` prototype)
                                            margin: 0.0124
```

Both lexicon-match the **same verb**, so `cos(q_verb, p_verb)` is **exactly 1.0 for both**. At
β=0.8, **80% of the score was a tie by construction**, and the decision fell to a 0.0124 residual —
noise.

Root cause: out-of-domain-ness lives in the **object** ("parking pass", "email signature"), not the
verb — an OOD utterance's verb is frequently an ordinary scheduling verb. Verb-anchoring is correct
for the four event intents and **wrong for `none`**.

Fix: `none` prototypes score on `vec_full` alone (`NONE_ALPHA=1.0`, `NONE_BETA=0.0`) while event
intents keep 0.2/0.8. Margin was then also redefined to **exclude `none` from the runner-up search
entirely** — the two classes are scored by different blends, so a margin measured against `none`
sits on a different scale.

This mattered for sequencing: Task 5 was about to *triple* the `none` class, which would have
multiplied this exact collision. Fixing it first was the difference between growth helping and
growth hurting.

#### Task 5 — Batch 3 was designed to fail

Batches 1 (object-distinct OOD) and 2 (anchor-free near-misses) improved things with **zero**
measurable effect on genuine-utterance routing. Batch 3 deliberately added the one shape Task 4.5
made *harder* — utterances carrying both a scheduling verb and a domain anchor.

Result: none recall dropped 93.75% → 87.50% and two new false accepts appeared. **This was the
expected, informative outcome, and was not reverted.** It also surfaced something the category name
didn't predict: `"what's for breakfast tomorrow"` slips through on a bare **time** anchor, not an
event-noun. Gate 3 treats all four anchor types as equally sufficient, but a time word is far
weaker evidence — see "known limitations".

#### Task 6 — the sweep that changed nothing

Swept `CONF_FLOOR` ∈ [0.35, 0.90] × `MARGIN_FLOOR` ∈ [0.05, 0.30].

- `MARGIN_FLOOR` is **inert** across the whole range. The only sensitive rows sit below 0.05, where
  lowering it *costs* precision. 0.10 was already optimal.
- `CONF_FLOOR` is flat 0.35–0.80, then trades badly. Reaching 0 false-accepts (0.87) costs
  false-negative rate 3.08% → **10.77%**.

A naive "first point clearing PROCEED precision ≥95%" filter picks 0.90 and looks like a clean win —
0 false accepts, 100% precision — while hiding false-negatives exploding **6×**. Raising the floor
doesn't only catch bad PROCEEDs; it intercepts genuine utterances *earlier*, converting a
reasonable CLARIFY question into a flat REJECT.

**Decision: freeze 0.45 / 0.10 unchanged.** A false accept yields a correctable confirmation card; a
false negative yields *"I didn't understand"* on a command the user got right. For a
confirm-before-commit product those are not symmetric. `CONF_FLOOR=0.87` is recorded in ALGORITHM.md
as explicitly considered and rejected, with its numbers, so nobody re-derives it.

The honest conclusion was *"nothing to tune here"* rather than a forced pick from a bad menu.

### Post-freeze verification
- **`bin/parity_check.js`** — automated JS↔Python parity across all **120/120** fixtures
  (`normalized_full` exact, token ids deep-equal, cosine > 0.9999 on both vectors). Verified the
  harness actually catches drift by injecting a corrupted fixture and confirming it failed.
- **Typo probe** (`scripts/typo_robustness_check.py`) — 12 typo variants. Result: **0/12 correct
  PROCEED** (9 REJECT, 2 CLARIFY, 1 confidently wrong). Documented below.

---

## 5. Decisions that look like bugs but aren't

Anyone "tidying" these will silently break the model.

| # | Looks wrong | Why it's correct |
|---|---|---|
| 1 | `none` uses different α/β than every other intent | `none` is object-carried; a shared blend guarantees verb collisions (Task 4.5) |
| 2 | `margin` ignores `none` **even when `none` wins** | The two classes are scored by different blends; a cross-blend margin is not on one scale |
| 3 | Gates run on raw text, *not* the stripped text | `strip_slots` removes exactly the anchors the gates look for |
| 4 | Negation is checked *before* confidence | Zipf downweighting suppresses "not"; a confident score on a negated sentence is confidently wrong |
| 5 | Vote takes **max** similarity per intent, not sum | Summing double-counts an intent occupying several top-5 slots and deflates confidence |
| 6 | 7 lexicon entries never fire on the corpus | Retained for real-user coverage; narrowing to only-seen phrasings is the opposite of generalising |
| 7 | The Zipf/SIF formula is duplicated from model2vec | It must mirror the model's own distillation-time weighting exactly |
| 8 | Six apostrophe-less contractions are *excluded* | `were`/`its`/`ill`/`well`/`id`/`wed` are real words; blind expansion is wrong more often than right |

---

## 6. Known limitations

**Three unmet criteria, two distinct root causes** (a correction to an earlier framing that lumped
all three together):

1. **False-accept (2.86%) + none recall (87.50%)** — genuinely the same 3 rows: anchor-bearing
   near-misses (`"what's for lunch today"`, `"book a haircut appointment for saturday"`,
   `"what's for breakfast tomorrow"`). Not fixable by thresholds — they score 0.84–0.87, right in
   the middle of correct answers.
2. **False-negative (3.08%)** — a *different* cause: `"set aside"` is in `modify_event`'s lexicon
   while also being the corpus's own `add_event` example; `"lock in"` isn't in the lexicon at all.
   A lexicon-coverage gap, unrelated to the above.

**Gate 3 anchor-strength gap.** Time, resource, participant, and event-noun anchors are treated as
equally sufficient. A bare time anchor is much weaker evidence (*"what's the weather tomorrow"*).
The obvious fixes both break: requiring a second anchor kills `"cancel my 3pm"` (genuine,
time-only), and the verb lexicon can't discriminate — `"what's my next meeting"` and `"what's for
breakfast"` both match `"what"`. Recorded as a candidate `time_only_anchor` sub-gate, deferred.

**~Zero typo tolerance.** `head_verb_phrase_lexicon` is exact-match, so one dropped letter in the
verb falls through to a subword embedding with no relation to the intended word. 12 typo variants →
0 correct PROCEED. Mostly safe-failing (9 REJECT), but `"scedule a meeting at 5pm"` lands
confidently on `modify_event` because the truncated token sits nearer `reschedule` than `schedule`
in subword space. **The most likely candidate for the next phase.**

**Small-sample measurement.** At n=40 `none` rows, none recall can only be 87.5%, 92.5%, 95%…
Several targets are near their granularity floor. Test set (46 rows) is still sealed and unscored.

---

## 7. What's next — migration to the main repo

The training work is done. What moves is the **result**.

**Decided:** consume-only (the main repo never rebuilds artifacts; corpus + Python stay here), and
the target is an **npm package, framework-agnostic** — must work under Node, bundlers, browsers,
and edge without dragging `fs` into a browser bundle.

### Moves — ship at runtime (5.76 MB; this *is* the model)
| file | size |
|---|---|
| `src/artifacts/vectors.bin` | 2.92 MB — int8, 11,949 × 256 |
| `src/artifacts/vocab.json` | 476 KB — tokens/scales/weights, `dim=256`, `unkId=1`, `pooling="zipf"` |
| `src/artifacts/prototypes.json` | 2.37 MB — 222 exemplars × `{intent, text, vec_full, vec_verb}` |

Keep the `text` field — it is only 9 KB of the 2.37 MB and is what makes `:explain` possible. Ship
as asset files, never base64-inlined.

### Moves — port, don't copy
`bin/index.js` (445 lines, the only parity-verified implementation) and
`docs/ALGORITHM.md` (the contract).

### Moves — CI only
`parity.json` (120 fixtures) + `bin/parity_check.js`, excluded from the published bundle.

### Stays here
All 24 `scripts/*.py`, `.venv/`, `corpus/`, `audit_review*.tsv`.

### ⚠️ Delete, do not migrate
`src/embed.ts` and `src/intent.ts` are **Phase-1 pseudocode**: undefined helpers, the dead
single-vector `p.vec` schema, sum-based voting, `none` included in margin, no gate layer. They look
like the port. They are a trap.

### ⚠️ Do this before migrating
`parity.json` covers normalize → wordpiece → embed → strip_slots → verb-lexicon. It does **not**
cover the scoring blend or the gate layer. Once Python stays behind, nothing in the main repo can
re-derive correctness for that half — a typo in `EVENT_NOUNS` or a wrong `CONF_FLOOR` would ship
green.

**Generate `routing_fixtures.json` here first**: every `dev.jsonl` row + the typo rows + parity edge
cases → `{intent, confidence, margin, route, gate}` from `gates.route_query`. That becomes a second
test and locks the pipeline end to end.

### Porting notes
- Put **all** constants in one `constants.ts`. They currently live inside `bin/index.js` and are
  duplicated in Python; once Python stays behind, the TS copy becomes canonical.
- **Regex statefulness:** `TIME_RE` is `/gi` and shared between `stripSlots` (`.replace`) and
  `hasTimeAnchor` (`.test`, which *advances* `lastIndex`). `bin/index.js:312-315` works only
  because it manually resets. Build two separate instances in the port.
- Preserve decisions 1–5 in §5 verbatim, each with a comment pointing at ALGORITHM.md.

---

## 8. Map & commands

```
static-embedding/
├── PROJECT.md            ← this file
├── architecture.drawio   ← diagram (app.diagrams.net)
├── README.md  CLAUDE.md  ← STALE
└── packages/nlp/
    ├── docs/ALGORITHM.md ← frozen spec (normative)
    ├── corpus/           intents.yaml (222) · dev.jsonl (105) · test.jsonl (46, SEALED)
    │                     gold.FROZEN.jsonl (151 = dev ∪ test) · deferred_resource_*
    ├── scripts/          24 Python files — offline build, eval, audits, sweeps
    ├── src/artifacts/    vectors.bin · vocab.json · prototypes.json · parity.json
    └── bin/              index.js (REPL + reference impl) · parity_check.js
```

Prototypes: `add_event` 45 · `delete_event` 20 · `modify_event` 39 · `get_details` 43 · `none` 75.

```bash
cd packages/nlp/scripts && python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
```
On Windows, plain `python` may hit the Microsoft Store alias stub — use `py` or
`.venv\Scripts\python.exe`.

From `packages/nlp/`:
```bash
python scripts/build_embeddings.py       # corpus -> artifacts
python scripts/classify.py "some text"   # full trace for one utterance
python scripts/eval.py                   # raw classifier metrics (dev.jsonl)
python scripts/eval_gates.py             # ROUTED metrics — the ones that matter
python scripts/audit_corpus.py           # mislabelling audit, all files/intents
node bin/index.js                        # REPL
node bin/parity_check.js                 # 120-fixture JS↔Python parity
```
From root: `npm run nlp:build` · `nlp:eval` · `nlp:ablate` · `nlp:check` · `nlp:parity`.

**Never run `eval.py corpus/test.jsonl`.** The set is sealed; score it once, at a phase's true end,
and log it in `TEST_SET_CHANGELOG.md`.

---

## 9. Working rules that made the difference

1. **`test.jsonl` is sealed.** Every touch needs per-row sign-off and a changelog entry disclosing
   what has and hasn't been scored. Correcting wrong ground truth is allowed; tuning to test is not.
2. **Never merge gold phrasings into `intents.yaml`** — the accuracy numbers stop meaning anything.
3. **Measure between batches, not at the end.** Task 5's three batches each got their own report;
   that is what made Batch 3's regression attributable.
4. **Prove causation, not correlation.** Regressions were isolated by swapping single vectors and
   re-running, not inferred from aggregate deltas.
5. **Report the failure you found, not the one you expected.** Task 6's answer was "change
   nothing"; Batch 3's job was to make a metric worse.
6. **Absolute counts beside every percentage.** At n=40, one row is 2.5 points.
