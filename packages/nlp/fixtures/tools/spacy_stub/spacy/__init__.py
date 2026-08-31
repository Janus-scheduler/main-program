"""Inert stand-in for spaCy, used ONLY to generate routing_fixtures.json.

`scripts/preprocess.py` does `import spacy` at module top, but the only things
that touch it are `head_verb_phrase()` and `content_words()`, both of which go
through the lazy `_get_nlp()`. The routing path never reaches either:

    gates.route_query
      -> reference_classifier.classify
           -> preprocess.strip_slots               (pure regex)
           -> preprocess.head_verb_phrase_lexicon  (pure regex)
           -> reference_embedder.embed_text        (numpy only)
      -> gates.route_from_classification           (pure regex + comparisons)

So this stub exists purely to satisfy the import statement. It deliberately
RAISES on any actual use rather than returning a plausible-looking dummy — if
the real spaCy were ever needed, the generation run must fail loudly instead of
silently producing fixtures from degraded behaviour.
"""

__version__ = "0.0.0-inert-stub"


def load(*args, **kwargs):  # noqa: D103
    raise RuntimeError(
        "spaCy stub was actually invoked — the routing path is supposed to never "
        "reach _get_nlp(). Re-generate with the real spaCy installed and "
        "investigate; the fixtures produced by this run are NOT trustworthy."
    )


def __getattr__(name):
    raise RuntimeError(
        f"spaCy stub attribute {name!r} was accessed — see the note in "
        "spacy_stub/spacy/__init__.py. Fixtures from this run are NOT trustworthy."
    )
