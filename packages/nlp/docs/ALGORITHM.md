# Algorithm spec

**Status: FROZEN (Phase 1.7 Task 7).** This is the complete, implementation-ready specification
Phase 2.0's TypeScript port (`src/normalize.ts`, `wordpiece.ts`, `embed.ts`, `intent.ts`) must
reproduce bit-for-bit. Every constant below is frozen — do not retune without a new phase and a
new sweep table. The sections after "Frozen pipeline specification" are the working log that
justifies these choices (Tasks 4–6); keep them, they're what a future maintainer needs to
understand *why* before touching anything.

## Frozen pipeline specification

Runtime order for classifying one utterance, `text`:

```
route_from_classification(classify(text, artifacts, prototypes), text)
```

`classify()` produces `{intent, confidence, margin, normalized, tokens}`; `route_from_classification()`
adds `{route, gate, reason}`. Below, in the order data actually flows.

### 1. Normalization — `normalize(text)` (`reference_embedder.py`)

Order matters; each step operates on the previous step's output:

1. Lowercase.
2. Expand `w/` → `with ` (regex `\bw/`).
3. Expand apostrophe'd contractions (`CONTRACTIONS`, longest-match-first via alternation, table
   below).
4. Expand apostrophe-LESS contractions (`NO_APOSTROPHE_CONTRACTIONS`, word-boundary matched, table
   below).
5. Strip punctuation: `[^a-z0-9\s]` → space.
6. Collapse whitespace: `\s+` → single space, then `.strip()`.

**`CONTRACTIONS`** (apostrophe'd; matched as literal substrings via longest-first alternation, not
word-boundary — safe because the apostrophe makes every key unambiguous):
```
won't→will not   can't→can not    n't→ not          i'm→i am
you're→you are   we're→we are     they're→they are  it's→it is
that's→that is   what's→what is   who's→who is      there's→there is
here's→here is   let's→let us     i've→i have       you've→you have
we've→we have    they've→they have  i'll→i will     you'll→you will
we'll→we will    they'll→they will  i'd→i would     you'd→you would
we'd→we would    they'd→they would
```

**`NO_APOSTROPHE_CONTRACTIONS`** (apostrophe-less; word-boundary matched, since a bare word could
collide with an unrelated real word — see exclusions below):
```
dont→do not        doesnt→does not     didnt→did not
wont→will not       cant→can not
isnt→is not         arent→are not       wasnt→was not      werent→were not
hasnt→has not       havent→have not     hadnt→had not
wouldnt→would not   couldnt→could not   shouldnt→should not
im→i am             youre→you are       theyre→they are
whats→what is       thats→that is       whos→who is
theres→there is     heres→here is       lets→let us
ive→i have          youve→you have      weve→we have       theyve→they have
youll→you will      theyll→they will
youd→you would      theyd→they would
```
**Deliberately excluded** (real-word collisions — `were`/we're, `its`/it's, `ill`/i'll,
`well`/we'll, `id`/i'd, `wed`/we'd): a bare-word rule would be wrong more often than right for
these six specifically. Do not add them without a context-aware (not blind word-swap) rule.

### 2. WordPiece tokenization — `wordpiece(normalized_text, token_to_id, unk_id)`

Greedy longest-match-first, BERT-style, split on whitespace then per-word:
- `MAX_WORD_CHARS = 100` — a word longer than this maps straight to `[UNK]` (mirrors BERT's
  `WordpieceTokenizer.max_input_chars_per_word`).
- Per word: find the longest substring starting at position 0 that exists in vocab; if none,
  emit `[UNK]` for the whole word. Otherwise consume it, prefix all subsequent pieces with `##`,
  and repeat from the consumed boundary. If any position finds no match, the WHOLE word becomes
  `[UNK]` (not a partial split).
- `token_to_id`/vocab is build-time artifact (`vocab.json`), not derived at runtime.

### 3. Pooling — `embed_ids(ids, artifacts)`

1. Empty `ids` → zero vector (dimension `artifacts.dim`).
2. Dequantize: `table[ids].astype(float32) * scales[ids]` (per-row int8 scale, computed at build
   time as `max(abs(row)) / 127`).
3. Weight: if `pooling == "zipf"`, `w = weights[ids]` (below); if `"mean"`, `w = ones`.
4. Weighted mean: `sum(rows * w) / sum(w)` (guard `sum(w) == 0` → divide by 1.0).
5. L2-normalize (guard norm `== 0` → return unnormalized zero vector).

**Zipf/SIF weight formula** (`compute_weights(n_tokens, sif_coefficient)`, applied once at build
time over the *pruned* vocab's rank order, stored in `vocab.json.weights` — no runtime frequency
table needed):
```
inv_rank = 1 / arange(2, n_tokens + 2)
proba = inv_rank / sum(inv_rank)
weight = sif_coefficient / (sif_coefficient + proba)
```
`SIF_COEFFICIENT = 1e-4` — **do not change**; mirrors `model2vec/distill/inference.py`'s own
`compute_weights`, which `potion-base-8M` already baked into its pretrained vectors
(`apply_zipf: true`). Reusing the identical formula at pooling time, over the pruned vocab's own
rank order, is what makes `pooling: "zipf"` a deterministic function of vocab position with no
separate frequency table shipped.

### 4. Vocabulary pruning (build-time only — determines what `vocab.json`/`vectors.bin` contain)

- `TOP_N_ENGLISH = 6500` — top-N most common tokens by the base model's own vocab rank, kept.
- Always kept: `[PAD]`, `[UNK]`, `[CLS]`, `[SEP]`, `[MASK]`; every `##`-continuation token; every
  single-character token (WordPiece fallback safety net).
- Every token appearing anywhere in `corpus/intents.yaml` is kept.
- `DOMAIN_RESOURCE_TERMS` (20 terms, kept regardless of frequency rank): `room, rooms, conference,
  huddle, studio, rooftop, lobby, projector, laptop, monitor, headset, headsets, equipment,
  whiteboard, catering, parking, wifi, vendor, training, recording, downstairs`.
- Quantization: int8, per-row scale `max(abs(row)) / 127` (guard: scale `0` → `1.0`).
- Budget: `vectors.bin` target **≤3 MB** (currently 2.92 MB at 11,949 tokens / 75 `none`
  prototypes) — raising `TOP_N_ENGLISH` or the resource-term list further requires pruning
  something back down.

### 5. Slot stripping — `strip_slots(text)` (query-time AND build-time prototype embedding — must
use the identical transform on both sides, never compare mismatched views)

Removes time/date phrases and resource/participant names, consuming an immediately preceding
preposition/determiner as part of the same match (`with marketing` disappears as one unit, not a
dangling `with`).

`_LEAD` (optional, consumed only as part of a match): `(?:(?:with|in|at|on|for|under)\s+)?(?:(?:a|an|the|my|our|your)\s+)?`

`TIME_PATTERNS` (11 alternatives, `_LEAD` + one of these, word-boundary wrapped):
```
\d{1,2}(:\d{2})?\s?(am|pm)          noon|midnight
(next|this|last)\s+(week|month|quarter|year|sprint|<weekday>)
<weekday-stem>day'?s?               today'?s?          tomorrow'?s?
tonight                             an?\s+hour(\s+later)?
a\s+day\b                           \d+\s+minutes?
morning|afternoon|evening
```
(weekday stems: `mon, tues?, wednes, thurs?, fri, satur, sun`)

`RESOURCE_NAMES` (29, longest-first): `conference room b, conference room, demo room, huddle room,
training room, recording studio, room, rooms, studio, rooftop, lobby, boardroom, projector,
laptop, monitor, headsets, headset, equipment, whiteboard, catering, parking, wifi, seating,
table, microphones, microphone, transportation, garage, venue, av setup, av equipment, av`

`PARTICIPANT_NAMES` (23): `sarah, alice, marketing, legal, team, client, vendor, pm, new hire,
support, design, candidate, dentist, recruiter, investors, investor, auditors, auditor, finance,
hr, qa, manager, intern, guest`

### 6. Verb-phrase extraction — `head_verb_phrase_lexicon(text)` (query-time AND build-time — same
matched-view rule as above)

1. Strip a leading politeness/pronoun wrapper if present (longest-match-first):
   `_LEADING_WRAPPERS`: `can you , can we , could you , would you , will you , do you mind ,
   please , i need , could i , can i , i'd , i'm , i , we'd , we ` (each includes its trailing
   space; sorted longest-first so e.g. `i need ` is tried before bare `i `).
2. Match the longest phrase from `INTENT_VERBS` anchored at the start (`^phrase\b`,
   case-insensitive), multi-word phrases tried before their bare first word.
3. Fallback: the first `\w+` token if nothing in the lexicon matches.

**`INTENT_VERBS`** (the closed lexicon — enumerable because the 5 intents are a closed set):
```
add_event:    schedule, book, set up, pencil in, put, arrange, add, create, plan, get, grab,
              reserve, hold, block off, block out, line up, throw in
delete_event: cancel, delete, remove, drop, scrap, call off, clear, take off, scratch
modify_event: move, reschedule, push, shift, change, update, bump, extend, shorten, swap,
              switch, set aside
get_details:  show, what, when, is, are, list, check, find, who, do i have, give me, how many
```
(`call off, scrap, list, find, plan, when, hold` are unreachable in the current corpus, retained
for real-user coverage — verified by `scripts/audit_lexicon.py`, 2026-07-22. Single-word additions
to this lexicon are behavior no-ops per Task 3's dual-vector architecture; only multi-word entries
change matching.)

### 7. Dual-vector scoring — `classify_vector_dual(query_full, query_verb, prototypes)`

Each prototype has `vec_full = embed(strip_slots(text))` and `vec_verb =
embed(head_verb_phrase_lexicon(text))`, computed once at build time. Per-prototype similarity:

```
sim = a * cos(query_full, p.vec_full) + b * cos(query_verb, p.vec_verb)
  where (a, b) = (NONE_ALPHA, NONE_BETA)  if p.intent == "none"
                 (ALPHA, BETA)             otherwise
```

Vote: **MAX similarity per intent** among the top `TOP_K` neighbours by raw `sim` (not sum —
summing double-counts an intent occupying several top-K slots). `confidence` = the winning
intent's score. **`margin`** = `confidence` minus the best score among the top-K's OTHER
intents, **excluding `none` from that search entirely** — even when `none` itself is the winning
intent, the margin looks past it to the next event intent. (Rationale: `none` and the event
intents are scored by different blends; a margin computed against a `none` runner-up sits on a
structurally different scale — see "margin redefined" below. `none` already has two dedicated
rejection mechanisms, Gate 2 and Gate 3, so margin doesn't need to carry that signal too.) No
other-event-intent found in the top-K → margin defaults to `confidence` (nothing to compare
against, maximally unambiguous by construction).

### 8. Gate / routing layer — `route_from_classification(result, text)`

Runs on **pre-strip raw text** (`strip_slots` removes exactly the signals these gates look for).
First matching gate wins, in this fixed order:

| # | gate | condition | route |
|---|---|---|---|
| — | `negation` | `has_negation(text)` | `CLARIFY` |
| 1 | `gate1_confidence` | `confidence < CONF_FLOOR` | `REJECT` |
| 2 | `gate2_nearest_none` | `intent == "none"` | `REJECT` |
| 3 | `gate3_no_anchor` | `not has_domain_anchor(text)` | `REJECT` |
| 3b | `gate3b_resource_only` | resource anchor, no time anchor, no event-noun anchor | `CLARIFY` |
| 4 | `gate4_margin` | `margin < MARGIN_FLOOR` | `CLARIFY` |
| 5 | `gate5_missing_slot` | intent ∈ {add_event, modify_event}, no time anchor | `CLARIFY` |
| — | *(none fired)* | — | `PROCEED` |

`has_domain_anchor` = time anchor OR resource anchor OR participant anchor OR event-noun anchor.
Time/resource/participant anchors reuse `strip_slots`'s own `_TIME_RE`/`RESOURCE_NAMES`/
`PARTICIPANT_NAMES` (same lists as section 5).

**`EVENT_NOUNS`** (27 entries — audited, see "Task 5 results" above: 26/27 fire on real corpus
content, 1 (`appointment`) is currently dead weight, 1 (`lunch`) is the known over-broad entry):
```
meeting, call, event, booking, appointment, sync, standup, review, 1:1, lunch, interview,
session, workshop, retro, kickoff, demo, onboarding, brainstorm, all-hands, training,
presentation, check-in, coffee chat, happy hour, town hall, recording, setup, planning
```

**`has_negation`**: `n't` (generic suffix) OR any `NO_APOSTROPHE_CONTRACTIONS` entry whose
expansion ends in `" not"` (derived from the same dict, not re-listed) OR bare `not`/`no
longer`/`no more`, all word-boundary matched.

### 9. Frozen constants — full table

| constant | value | file | justification |
|---|---|---|---|
| `SIF_COEFFICIENT` | `1e-4` | `build_embeddings.py` | mirrors model2vec's own distillation-time formula; never independently tuned |
| `TOP_N_ENGLISH` | `6500` | `build_embeddings.py` | vocab-size/coverage tradeoff; `vectors.bin` stays under the 3 MB budget |
| `MAX_WORD_CHARS` | `100` | `reference_embedder.py` | mirrors BERT's `WordpieceTokenizer` default |
| `TOP_K` | `5` | `reference_classifier.py` | kNN neighbourhood size; unchanged since Phase 1 |
| `ALPHA` / `BETA` | `0.2` / `0.8` | `reference_classifier.py` | `sweep_alpha_beta.py`, 21-point 0.05-step grid — 0.05–0.20 is a flat 87.67%-flat-acc / 4.11%-false-accept plateau; 0.20 chosen as the plateau's upper end for more margin from the lexicon's ~25% OOV rate |
| `NONE_ALPHA` / `NONE_BETA` | `1.0` / `0.0` | `reference_classifier.py` | Task 4.5 Option A — `none` is object-carried, scoring it on `vec_verb` creates near-guaranteed collisions with verb-sharing event examples |
| `CONF_FLOOR` | `0.45` | `metrics.py` | Task 6 full grid sweep (0.35–0.90) — flat from 0.35–0.80; every value that reduces false-accept trades 2–4× as many new false negatives; frozen at its pre-sweep value, nothing on the grid improves it |
| `MARGIN_FLOOR` | `0.10` | `metrics.py` | Task 6 sweep — inert across [0.05, 0.30] (the only sensitive rows sit below 0.05, where lowering further costs precision); already optimal |

## Exit criteria redefinition (Task 4)

### Why

Phase 1.7's original exit criteria (`PHASE_1.7.md`) were written against a plain classifier:
flat accuracy, domain accuracy, none precision, all measured on `classify()`'s raw output. Task 4
put a gate/routing layer (`gates.route_query`) in front of `classify()`, so a query no longer
just gets a predicted intent — it gets routed to `PROCEED` (commit to the intent), `CLARIFY` (ask
a chip question), or `REJECT` (treat as not a valid scheduling command). Once that layer exists,
"domain accuracy" and "none precision" measured on the *raw* classifier no longer describe what a
user experiences — a raw false-accept that gets caught and re-routed to `CLARIFY`/`REJECT` isn't
a product-facing failure anymore, and the raw metrics can't see that.

### What changed

Raw flat accuracy and raw domain accuracy (`classify()` alone, no gates) are **downgraded to
reported health metrics** — still measured and reported every run (via `eval.py`/`metrics.py`),
but no longer hard gates on shipping. They stay useful as a diagnostic of whether the underlying
embedding/dual-vector scoring is degrading, independent of whatever the gate layer is doing.

Three **routed** metrics replace them as the hard gates, computed by
`scripts/eval_gates.py::report_routed_exit_criteria`:

| metric | definition | target |
|---|---|---|
| **none recall** | (gold=`none` rows routed to `REJECT`) / (gold=`none` rows) | ≥95% |
| **REJECT precision** | (`REJECT` rows where gold=`none`) / (all `REJECT` rows) | ≥90% |
| **false-negative rate (genuine)** | (gold≠`none` rows routed to `REJECT`) / (gold≠`none` rows) | <2% |

`REJECT` is the operative "system said no" outcome; `CLARIFY` is deliberately excluded from all
three — asking a chip question is cheap and is not scored as either a hit or a miss here.
False-negative rate is scoped to *genuine* (non-`none`) utterances specifically, not all rows,
because the failure it measures — a real scheduling request silently told "that's not something
I can help with" — only exists for those rows; diluting the denominator with `none` rows would
hide it.

### Current measurement (Task 4 exit, dev.jsonl, 81 rows, `test.jsonl` untouched)

```
none recall                    93.75% (15/16)   target >=95%    FAIL
REJECT precision               83.33% (15/18)   target >=90%    FAIL
false-negative rate (genuine)   4.62% (3/65)    target <2%      FAIL
```

All three currently fail. The 3 false negatives (genuine utterances routed to `REJECT`):

| gold | gate | pred | conf | margin | text |
|---|---|---|---|---|---|
| modify_event | `gate2_nearest_none` | none | 0.939 | 0.012 | "update our av setup for the call" |
| add_event | `gate1_confidence` | delete_event | 0.282 | 0.026 | "set aside 30 minutes for the retro tomorrow" |
| add_event | `gate1_confidence` | add_event | 0.305 | 0.113 | "can we lock in a call with the auditors" |

**1 of 3 is `gate2_nearest_none` — a none-attractor collision, not a coverage gap.** At
`ALPHA=0.2`/`BETA=0.8`, `vec_verb` dominates similarity; every neighbour above lexicon-matches to
the same verb (`"update"`), so all five top candidates cluster within ~0.04 of each other and the
ranking comes down to the 20%-weighted `vec_full` residual — a coin flip. The winning neighbour
is a `none`-labelled prototype (`"update the parking pass for the client"`, a resource-catalogue
edit with no event context, correctly `none` per the taxonomy rule) that happens to sit
fractionally closer than the real `modify_event` neighbours on that residual (margin 0.0124).

**This is a direct risk for Task 5.** Task 5 triples the `none` class. Any new `none` example
that shares a common event verb (update/change/move/etc.) with no event context is another
verb-anchored near-collision candidate against genuine event utterances using that same verb —
more such examples means more chances for this exact failure, not fewer. Task 5 must report none
recall *and* false-negative rate (genuine) after the corpus grows, specifically watching whether
none recall improves while false-negative rate also rises — that combination means the `none`
corpus growth is buying recall by trading away precision on real requests, and is a signal to
stop and reconsider the sizing rather than treat the recall improvement alone as success.

The other 2 false negatives (`gate1_confidence`) are unrelated: `"set aside"` is a previously
flagged lexicon conflict (see `preprocess.py`'s `INTENT_VERBS`), and `"lock in"` is an
out-of-lexicon verb falling back to a weak single-token embedding — coverage gaps, not
`none`-class collisions.

## Task 4.5 — `none` scoring asymmetry (shipped: Option A)

**Finding: `none` is object-carried; the four event intents are verb-carried. One scoring
function cannot serve both.** Out-of-domain-ness lives in the *object* ("parking pass", "email
signature"), not the verb — the verb of an OOD utterance is frequently an ordinary scheduling
verb ("update", "order", "email"). Verb-anchored scoring (`ALPHA=0.2`/`BETA=0.8`) is correct for
the four event intents (+25 points over baseline) but actively wrong for `none`: any `none`
example sharing a lexicon verb with a real intent produces `cos(query_verb, proto_verb) == 1.0`
for both sides, making 80% of the similarity score a tie by construction and leaving the decision
to a ~0.01 residual — noise, not signal (the `"update our av setup for the call"` collision
above, margin 0.0124).

### What shipped

`reference_classifier.py`: `none`-intent prototypes are scored on a **separate, fixed blend**,
`NONE_ALPHA=1.0`/`NONE_BETA=0.0` (full-sentence cosine only, no verb term), while the four event
intents keep `ALPHA=0.2`/`BETA=0.8` completely unchanged. `classify_vector_dual` picks the blend
per-prototype by `intent == "none"`, not per-call — so this applies unconditionally, independent
of whatever `alpha`/`beta` a future re-sweep passes for the event intents. This is a **deliberate
asymmetry**: do not "tidy" it back to a single blend, and do not retune `ALPHA`/`BETA` above to
compensate for `none` behavior — they are separate parameters answering separate questions.

### Result: the collision is resolved

```
"update our av setup for the call"  (gold=modify_event)
  before: intent=none         conf=0.939  margin=0.0124  -> REJECT (gate2_nearest_none), false negative
  after:  intent=modify_event conf=0.927  margin=0.232   -> CLARIFY (gate5_missing_slot, "what time?")
```

### Full measurement, dev.jsonl (81 rows), before vs after

| metric | before (Task 4) | after (4.5a) | target |
|---|---|---|---|
| none recall | 93.75% (15/16) | 93.75% (15/16) | must not regress — **held** |
| REJECT precision | 83.33% (15/18) | **88.24% (15/17)** | ≥90% — improved, not yet met |
| false-negative rate (genuine) | 4.62% (3/65) | **3.08% (2/65)** | predicted →~2/65 — **met exactly** |
| PROCEED precision | 96.77% (30/31) | 96.88% (31/32) | must not regress — held (+slightly better) |
| PROCEED coverage | 38.3% (31/81) | 39.5% (32/81) | should rise slightly — matched |

Remaining 2 false negatives are both `gate1_confidence` (untuned `CONF_FLOOR=0.45` default) —
Task 6's job, not this one, exactly as anticipated.

### Correctness concerns checked (not assumed)

1. **Are `none` scores now systematically lower?** Yes, measurably: `none` is the runner-up
   intent in 12/81 rows before this change, 9/81 after. For OOD rows where `none` used to win
   outright via a shared verb (e.g. `"do you like pizza"`, `"what's the meaning of life"`), the
   nearest neighbour is now an event-intent prototype instead (typically `get_details`, since its
   lexicon verb `"what"`/`"what's"` still gets full credit) — `none` recall is **unchanged
   (15/16) only because Gate 3 (no domain anchor) catches these rows by a different mechanism**,
   not because `none`'s own kNN score recovered them. This is a real dependency, not a coincidence
   — none recall under this design now leans on two independent mechanisms (kNN nearest-neighbour
   AND Gate 3's anchor check) rather than one, and only rows *without* a domain-anchor word are
   safe under both.
2. **Does margin remain meaningful when the top-2 come from different scoring functions?**
   Margin distribution shifted upward: mean 0.579→0.643, median 0.622→0.744 (n=81, both). Several
   genuine rows' margins ballooned because their runner-up was `none` and `none`'s score dropped
   — e.g. `"what's coming up with the auditors"` 0.119→1.000, `"what's on my plate this
   week"` 0.029→0.856. A margin computed against a `none` runner-up is **not on the same scale**
   as a margin computed against an event-intent runner-up, since the two are produced by different
   blends. Checked for harm: no new false-accepts appeared (still 1/81, unchanged), and the rows
   whose margin crossed `MARGIN_FLOOR` as a side effect (e.g. `"what's on my plate this
   week"`, previously wrongly gated to CLARIFY by a spurious near-tie with `none`) flipped to a
   *correct* PROCEED, not a wrong one — so this round, the distortion is a net improvement, not a
   regression. **This is not cleared for good, though**: a per-intent or `none`-relative margin
   threshold is now a real consideration for Task 6, since `MARGIN_FLOOR=0.10` currently means
   different things depending on whether the runner-up is `none` or an event intent.

Neither concern was severe enough to require Option B (two-stage classification) — both are
flagged for Task 6, not blocking here.

### Residual gap, unchanged by this fix

The `"what's for lunch today"` false-accept (gold=`none`, predicted=`get_details`) is untouched —
different mechanism. `"lunch"` is an anchor word (`EVENT_NOUNS`), so Gate 3 doesn't fire, and this
utterance was never a `none`-vs-event-intent *kNN* near-tie (get_details already won outright
before this change too). **This also means Option A does not help — and cannot help — this
category**: a `none` example that both shares a verb with an event intent *and* contains a domain
anchor word must win on `vec_full` alone (its only remaining scoring term) against an event
prototype that gets the full `vec_verb` boost. That's a harder fight than before, not an easier
one. `none` near-misses that are anchor-free (e.g. "parking pass", "email signature" — no event
noun, no time, no resource-only pattern beyond what Gate 3b already handles) are safe to add.
`none` near-misses that also carry an anchor word are still an open gap this fix does not close.

### Task 5 clearance

**Task 5 may proceed**, with the guidance from `PHASE_1.7.md`/`TASK_4.5.md` refined rather than
reversed: anchor-free near-misses (verb-sharing but object-distinct, no event noun/time/resource)
are safe to add in volume now that the collision is fixed. Anchor-bearing near-misses (the
`"lunch"` pattern) remain a distinct, still-open risk — add sparingly and re-measure false-negative
rate and false-accept rate after each batch (superseded further below by the four pre-Task-5
checks, which quantify how narrow this risk actually is and separately fix margin's scale
inconsistency).

## Pre-Task-5 checks (four, before sizing the corpus growth)

### Check 1 — how many anchor-bearing near-misses actually exist today

Scanned every unique utterance across `intents.yaml` + `dev.jsonl` + `test.jsonl` +
`gold.FROZEN.jsonl` (295 unique, 46 `none` / 249 genuine). An anchor-bearing near-miss is a
`none` example that (a) contains an `EVENT_NOUNS` anchor word and (b) produces the identical
`head_verb_phrase_lexicon()` output as at least one genuine event-intent example (a literal
`vec_verb` collision candidate).

**Count: 1/46.** Only `"what's for lunch today"` (collides with `get_details` via the verb-phrase
`"what"`). Zero other `none` examples carry an `EVENT_NOUNS` anchor at all, collision or not — the
hypothetical candidates considered (`"call Bob"`, `"email the team about the meeting"`, `"book a
flight"`, `"book a table"`, `"where should we eat"`) are not present in the corpus under any label;
`"book a table"` would in any case be caught safely by `gate3b_resource_only` (`"table"` is a
resource anchor, not an event-noun anchor) if it existed. **Per the stated decision rule (1 →
ignore, 8 → needs its own treatment): this is ignored.** No dedicated fix beyond what Task 4.5
already shipped; Task 5 should still avoid manufacturing more of this exact shape (verb-sharing
*and* anchor-bearing) in bulk, but there is no backlog of hidden cases to clean up first.

### Check 2 — `EVENT_NOUNS` audit (same discipline as `audit_lexicon.py`)

Every entry checked against all 295 utterances, split genuine vs `none`:

- **27/28 entries fire on genuine content**, 0 false-broad beyond the one already-known case.
- **1/28 never fires anywhere: `"appointment"`** (dead weight, harmless — matches the
  `audit_lexicon.py` precedent of retaining unreachable-in-corpus entries for real-user coverage,
  not deleting them).
- **1/28 matches a `none` row: `"lunch"`** (1 hit — the same check-1 case, not a new one).

**Gate 3 is as solid as its recall number suggests.** 26 of 28 entries are both load-bearing
(fire on real utterances) and clean (never touch a `none` row); the one gap is already isolated,
measured, and accepted above.

### Check 3 — granularity ceiling for each routed criterion

| criterion | denominator | current | values either side |
|---|---|---|---|
| none recall | n=16 | 15/16 = 93.75% | 14/16=87.50% · **15/16=93.75%** · 16/16=100.00% |
| REJECT precision | n=17 | 15/17 = 88.24% | 14/17=82.35% · **15/17=88.24%** · 16/17=94.12% |
| false-negative rate | n=65 | 2/65 = 3.08% | 1/65=1.54% · **2/65=3.08%** · 3/65=4.62% |

**None recall and REJECT precision have a real granularity ceiling; false-negative rate does
not.** At n=16, 95% is mathematically unreachable short of a perfect 16/16 — the step size
(6.25 points) straddles the target. At n=17, 90% is unreachable at all as an exact value; the
nearest achievable points are 88.24% and 94.12%, a 5.88-point gap. Both of these denominators grow
directly with Task 5's `none` corpus size (REJECT's denominator especially, since correctly-
rejected `none` rows make up most of it), so **corpus growth is a prerequisite for these two gates
to be measurable at their stated precision, not just a way to improve the underlying rate.** For
context: at n≈40 none-gold rows, 95% recall tolerates 2 misses instead of 0; at n≈50-60 REJECT
rows, the step size shrinks to 1.7-2 points, making 90% expressible almost exactly. False-negative
rate's denominator (genuine dev rows, currently 65) is already fine-grained enough to express
values under the 2% target (0% and 1.54% both qualify) — its current failure is a real 2-error
gap, not a measurement-resolution problem, and doesn't require dev-set growth to fix.

### Check 4 — margin redefined to exclude `none`

`reference_classifier.py`: added `_vote_event_margin()`, used only by `classify_vector_dual`
(the production routed path). Confidence and best-intent selection are unchanged (MAX-per-intent
aggregation over the top-5, same as `_vote()`); margin now measures the gap to the nearest
*different event intent* only — `none` is skipped entirely when searching for the runner-up, even
when `none` itself is the top-ranked intent. `_vote()` itself is untouched and still used by
`classify_vector` (`scripts/ablate.py`'s single-vector diagnostic views), which never had a
`none`-scoring asymmetry to correct for.

**Distribution shift, isolated to this change alone** (i.e. none-inclusive margin *after* Option A
vs none-excluded margin, not conflated with Option A's own effect):

| | mean | median | min | max | stdev |
|---|---|---|---|---|---|
| none-included margin (post-Option-A) | 0.643 | 0.744 | 0.005 | 1.000 | 0.327 |
| none-excluded margin (this check) | 0.683 | 0.858 | 0.005 | 1.000 | 0.313 |

9/81 rows shifted by >0.05, all upward (mathematically guaranteed — removing a candidate from the
runner-up search can only raise or hold margin, never lower it). Largest shifts: `"update our av
setup for the call"` 0.232→0.927 (no other event intent appears in its top-5 at all once `none`
is excluded — the previous 0.232 was `none`'s residual presence deflating an otherwise-unambiguous
call), `"update the microphone reservation"` 0.362→0.950, `"how many calls do i have this
week"` 0.470→0.888.

**Routed criteria delta at the current `MARGIN_FLOOR=0.10`: zero.** None recall (93.75%), REJECT
precision (88.24%), false-negative rate (3.08%), PROCEED precision (96.88%), and every gate-firing
count are byte-identical before and after this redefinition — no row's margin crossed the 0.10
threshold as a side effect. This is the expected, low-risk outcome: this check fixes what margin
*means*, not any routing decision today. The payoff is for Task 6 — `MARGIN_FLOOR` will now be
swept over a single-scale distribution instead of one contaminated by an inconsistent `none`
comparison, which is what this needed to land before that sweep, not after.

## Task 5 results and a Gate 3 finding (before Task 6)

Task 5 grew `none` to the sizes above (`intents.yaml` 75, `dev.jsonl`/`gold.FROZEN.jsonl` 40/49,
`test.jsonl` untouched at 9) across three measured batches — see `TASK_5.md` for the full
per-batch reports. Batch 3 (the anchor-bearing experiment) surfaced two new false accepts and,
with them, a gap in Gate 3 itself that's worth recording before Task 6 sweeps thresholds over it.

### Gate 3 anchor-strength finding

Gate 3 (`has_domain_anchor`) treats a time anchor, a resource anchor, a participant anchor, and an
`EVENT_NOUNS` anchor as **equally sufficient** to pass a query through for scoring — any one of the
four is enough to conclude "this utterance has scheduling relevance." Batch 3 showed this is too
coarse: a **bare time anchor is much weaker evidence of scheduling intent** than the other three.
`"what's for breakfast tomorrow"` (gold=`none`) passes Gate 3 solely because `"tomorrow"` is a time
anchor — there is no event-noun, resource, or participant signal anywhere in the sentence — and
then wins outright against `get_details` prototypes at confidence 0.840, margin 0.840 (see below).
Time words are extremely common in ordinary non-scheduling speech ("is it raining tomorrow", "what
time is it", "see you tonight" — several already sit in the `none` corpus for exactly this reason),
so treating "contains a time word" as equivalent to "contains a resource/participant/event-noun" is
a real asymmetry, not a corner case.

**Complication — the obvious fixes both break existing behavior:**

1. *Require a second anchor alongside a time-only match* (i.e. time alone is never sufficient)
   breaks `"cancel my 3pm"`-style utterances, which are genuine, unambiguous, time-only scheduling
   commands in the existing corpus — there is no resource/participant/event-noun anywhere in
   `"cancel my 3pm"`, only a time. A rule that demands a second anchor would send these to Gate 3
   REJECT incorrectly.
2. *Discriminate via the verb lexicon instead* (e.g. only trust a time-only anchor if the
   sentence's `vec_verb` phrase looks event-like) doesn't separate the two cases either: `"what's my
   next meeting"` (genuine `get_details`, time-adjacent) and `"what's for breakfast"` (OOD)
   lexicon-match to the **identical** verb phrase, `"what"` — the verb lexicon carries no signal
   that distinguishes them. Whatever tells these apart has to come from the object, not the verb,
   which is a strip-slots/full-vector question, not a Gate 3 question.

**Recorded as a candidate `time_only_anchor` sub-gate for after Task 6, not patched now:** the
idea (not implemented) is a Gate 3 variant that treats "time anchor and nothing else" as weaker
evidence than the other three anchor types — e.g. routing time-only-anchored queries to a stricter
confidence/margin check, or to Gate 3b-style `CLARIFY` rather than straight-through Gate 3 pass,
while leaving `"cancel my 3pm"`-style genuine time-only commands unaffected via some
still-to-be-designed distinguishing signal. Left as a named future candidate rather than an
immediate fix because: (a) Task 6 hasn't swept thresholds yet, and threshold changes may shrink or
reframe this gap on their own before a new sub-gate is designed against a moving target; (b) no
design here has yet solved constraint 2 above (verb lexicon doesn't discriminate) — a real fix
needs a mechanism this document doesn't have yet, not a quick patch.

### The two Batch 3 false accepts — margin detail (checked before Task 6, not after)

Both requested by name: are these fixable by `CONF_FLOOR`/`MARGIN_FLOOR` alone, or is false-accept
now structurally out of threshold-sweep's reach?

| utterance | confidence | margin | competing event intent in top-5? |
|---|---|---|---|
| `"book a haircut appointment for saturday"` | 0.869 | **0.869** | none — no other intent appears at all |
| `"what's for breakfast tomorrow"` | 0.840 | **0.840** | none — no other intent appears at all |

**Margin equals confidence for both — the degenerate case.** Neither has a competing event intent
anywhere in its top-5 neighbours, so the none-excluded margin (this doc's earlier redefinition)
falls back to its no-competitor default and margin carries zero independent information beyond
confidence. `MARGIN_FLOOR` cannot discriminate these from a genuinely unambiguous correct answer —
by construction, a real correct high-confidence PROCEED with no competing intent looks numerically
identical on the margin axis.

**`CONF_FLOOR` alone is not equally blocked for both, though — checked empirically against the 31
correct genuine PROCEEDs in `dev.jsonl`, not assumed:**

- `"what's for breakfast tomorrow"` (0.840) sits **below every one of the 31** correct genuine
  PROCEEDs (lowest is 0.856). A `CONF_FLOOR` raised into the gap between them (e.g. ~0.85) would
  catch this false accept **at zero cost** to currently-correct genuine coverage.
- `"book a haircut appointment for saturday"` (0.869) sits above only 2 of the 31 (0.856, 0.858).
  A `CONF_FLOOR` raised enough to catch it (~0.87+) would cost those 2 correct genuine PROCEEDs
  (converting them to `CLARIFY`, not a false accept — a coverage cost, not a correctness cost).

**Conclusion for Task 6: false-accept is not structurally unfixable by `CONF_FLOOR`, but the two
cases have asymmetric cost.** The breakfast case is a clean, free fix. The haircut case is a real
trade (1 false-accept fixed for 2 coverage losses) that the sweep should evaluate against the
≥95% PROCEED-precision / ~65%-coverage targets rather than assume away. `MARGIN_FLOOR` is not a
useful lever for either specific row (margin==confidence, no signal to exploit), though the full
sweep may still find it useful elsewhere in the distribution.

## Task 6 — threshold sweep result: `CONF_FLOOR`/`MARGIN_FLOOR` frozen at 0.45/0.10

Full grid sweep (`scripts/sweep_thresholds.py`), `CONF_FLOOR` ∈ [0.35, 0.90] step 0.05,
`MARGIN_FLOOR` ∈ [0.05, 0.30] step 0.05, against the Task-5-grown `dev.jsonl` (105 rows, never
`test.jsonl`). Each row is classified once and cached; only the cheap gate comparison
(`gates.route_from_classification`) is re-run per grid point.

### `MARGIN_FLOOR` has no live range in [0.05, 0.30]

Every grid point in this range produces byte-identical routed metrics regardless of
`MARGIN_FLOOR`'s value. The only rows sensitive to it (three, at Gate 4: `"get a review meeting
scheduled with qa"` margin=0.047, `"can you get us microphones for the town hall"` margin=0.016,
`"get the boardroom booked for the review"` margin=0.030) all sit below 0.05, the grid's own
floor. Extending the check down to `MARGIN_FLOOR`∈[0.0, 0.04] shows *lowering* it past ~0.03 costs
one new false-accept for one genuine row that turns out to be a **wrong** low-margin guess —
strictly worse. `MARGIN_FLOOR=0.10` sits in a safe, already-optimal position; there is nothing to
tune here with the current corpus and dual-vector scoring.

### `CONF_FLOOR` is flat from 0.35–0.80, then trades false-accept for false-negative fast

| `CONF_FLOOR` | false-accept | false-negative (genuine) | PROCEED precision | REJECT precision | genuine coverage |
|---|---|---|---|---|---|
| 0.35–0.80 (identical) | 3 (2.86%) | 2 (3.08%) | 91.18% | 94.59% | 47.69% |
| 0.85 | 2 | 5 (7.69%) | 93.94% | 87.80% | 47.69% |
| **0.87 — considered, rejected** | **0** | **7 (10.77%)** | **100.00%** | 84.44% | 44.62% |
| 0.90 | 0 | 12 (18.46%) | 100.00% | 76.47% | 38.46% |

A naive "first grid point clearing PROCEED precision ≥95%" filter picks `CONF_FLOOR=0.90` — 0
false accepts, 100% precision, looks like a clean win. It isn't: false-negative rate explodes
6× (3.08%→18.46%). The mechanism: raising `CONF_FLOOR` doesn't only catch the two Batch-3 false
accepts — every genuine utterance currently sitting in `CLARIFY` with confidence below the new
floor gets intercepted *earlier*, by Gate 1, and silently becomes `REJECT` instead. That's a worse
outcome than the `CLARIFY` question it replaces, not a neutral one.

**`CONF_FLOOR=0.87` was checked and explicitly rejected as the least-bad "0 false-accept" point**
(lower false-negative cost than 0.90, still 100% PROCEED precision) — recorded here so it isn't
re-derived: 0 false accepts, but false-negative rate still triples (3.08%→10.77%, 2→7 genuine
utterances wrongly rejected) to buy it. **Rejected because a false accept in this product yields a
correctable confirmation card (the user sees the wrong action proposed and can decline/correct
it), while a false negative yields "I didn't understand" on a command the user got exactly
right — a strictly worse failure for a confirm-before-commit product, not a symmetric trade.**
Minimizing false-accept count first, as a literal reading of the stated priority order would do,
walks directly into this trap: every step that removes one false-accept costs 2–4× as many new
false negatives across this grid. No tested point improves the system without that
disproportionate cost.

**Decision: freeze `CONF_FLOOR=0.45`, `MARGIN_FLOOR=0.10` — no change from their Task 4 values.**
The honest conclusion from this sweep is "nothing to tune here yet," not a forced pick from a bad
menu.

### Structural conclusion — refined, not identical to the original framing

The three still-unmet criteria are false-accept (2.86%, 3/105), none recall (87.50%, 35/40), and
false-negative rate (3.08%, 2/65). Checking whether these are one root cause under three names,
not assuming it:

- **False-accept and none recall's shortfall substantially overlap.** All 3 false-accepts
  (`"what's for lunch today"`, `"book a haircut appointment for saturday"`, `"what's for
  breakfast tomorrow"`) are none-gold rows that also count against none recall's 5-row gap — the
  same anchor-plus-high-confidence-collision pattern Batch 3 was built to find (Gate 3's
  anchor-strength gap for `"breakfast"`/time anchors; the `book`+`appointment` verb-and-anchor
  double-hit for `"haircut"`; `EVENT_NOUNS`'s own `"lunch"` entry for the original case). None
  recall's other 2 non-`REJECT` rows (`"reserve a session at the pottery studio"` → Gate 5
  `CLARIFY`, `"my phone won't charge"` → negation-gate `CLARIFY`) are not false accepts and not
  part of this pattern — they're safely gated, just not counted as `REJECT`.
- **False-negative rate's 2 rows are a different root cause, not the same pattern under a third
  name.** `"set aside 30 minutes for the retro tomorrow"` and `"can we lock in a call with the
  auditors"` are genuine `add_event` utterances misrouted by `gate1_confidence` — traced back in
  Task 4.5 to the `"set aside"` lexicon-verb conflict (added to `modify_event`'s list while also
  being this corpus's own `add_event` example) and `"lock in"` being entirely out-of-lexicon
  (falls back to a weak single-token embedding of `"lock"`). Neither involves an anchor word,
  `none`, or the verb-anchoring collision mechanism at all — this is a lexicon-coverage gap from
  Task 1's `INTENT_VERBS` design, orthogonal to Batch 3's finding. Recording the correction
  explicitly rather than merging it into the anchor-bearing story it doesn't belong to.

**What does hold across all three: none of them is a thresholding problem.** `CONF_FLOOR`/
`MARGIN_FLOOR` cannot separate the false-accept/none-recall pattern from correct high-confidence
answers (documented above), and cannot fix the false-negative pair either — both sit at
confidence 0.28–0.35, already firmly below `CONF_FLOOR=0.45`; the fix there is lexicon coverage,
not a lower floor. **Thresholds are not the tool for any of the three remaining gaps.** Candidate
fixes are deliberately deferred as post-freeze work, not patched now:

- A `time_only_anchor` sub-gate for Gate 3 (recorded above) — addresses the `"breakfast"`-shaped
  half of the false-accept/none-recall pattern.
- Greater `vec_full` density in `none`'s prototype set around the `book`+`appointment`/`lunch`
  object-anchor collision shape — addresses the other half; likely a Task 5 follow-up batch rather
  than an architecture change.
- An `INTENT_VERBS`/lexicon audit pass targeted at `"set aside"` and `"lock in"` specifically —
  addresses the false-negative pair; unrelated to the other two and shouldn't be bundled with them.
