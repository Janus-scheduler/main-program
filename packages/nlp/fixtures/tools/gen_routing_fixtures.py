"""Generate routing_fixtures.json — the JS≡Python routing agreement fixture.

PROJECT.md §7 lists this as a "do this BEFORE migrating" TODO that was never
executed. It is executed here, once, and its output is committed. After this
run nothing in the Janus repo, its test suite, its CI, or the published npm
package needs Python again.

Calls the EXACT function PROJECT.md prescribes — `gates.route_query` — over:

    105 rows   corpus/dev.jsonl
     12 rows   scripts/typo_robustness_check.py TYPO_ROWS (imported, not copied)
    120 rows   src/artifacts/parity.json texts
    ---
    237 rows

Records per row: {text, source, intent, confidence, margin, route, gate}.

Run:
    python gen_routing_fixtures.py <output.json>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRATCH = Path(__file__).resolve().parent
NLP_DIR = Path(r"C:/Users/HP/Desktop/NLP-Learn/static-embedding/packages/nlp")
SCRIPTS_DIR = NLP_DIR / "scripts"
ARTIFACTS_DIR = NLP_DIR / "src" / "artifacts"

# The spaCy stub goes FIRST so it shadows any real install; `scripts/` next so
# the reference modules import each other by bare name as they expect.
sys.path.insert(0, str(SCRATCH / "spacy_stub"))
sys.path.insert(1, str(SCRIPTS_DIR))

import spacy  # noqa: E402

assert spacy.__version__ == "0.0.0-inert-stub", (
    "expected the inert stub, got a real spaCy — that is fine behaviourally, "
    "but update this assert if it was installed deliberately"
)

from gates import route_query  # noqa: E402
from reference_classifier import load_prototypes  # noqa: E402
from reference_embedder import Artifacts  # noqa: E402
from typo_robustness_check import TYPO_ROWS  # noqa: E402


def collect_inputs() -> list[tuple[str, str]]:
    """(text, source) pairs, in a stable order. Duplicates are KEPT: the row
    count is part of the stated acceptance criterion, and a text appearing in
    two sources is genuinely evaluated twice (identically)."""
    rows: list[tuple[str, str]] = []

    for line in (NLP_DIR / "corpus" / "dev.jsonl").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append((json.loads(line)["text"], "dev.jsonl"))

    for text, _gold in TYPO_ROWS:
        rows.append((text, "typo_robustness_check"))

    for fixture in json.loads((ARTIFACTS_DIR / "parity.json").read_text(encoding="utf-8")):
        rows.append((fixture["text"], "parity.json"))

    return rows


def main() -> None:
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else SCRATCH / "routing_fixtures.json"

    artifacts = Artifacts.load(ARTIFACTS_DIR)
    prototypes = load_prototypes(ARTIFACTS_DIR / "prototypes.json")
    inputs = collect_inputs()

    print(f"loaded {len(artifacts.tokens)} tokens, {len(prototypes)} prototypes")
    print(f"collected {len(inputs)} input rows")

    fixtures = []
    by_route: dict[str, int] = {}
    by_gate: dict[str, int] = {}

    for text, source in inputs:
        r = route_query(text, artifacts, prototypes)
        fixtures.append(
            {
                "text": text,
                "source": source,
                "intent": r["intent"],
                # float() unwraps numpy scalars so json can serialise them. The
                # stored value is the float64 widening of Python's float32
                # arithmetic — the TS side accumulates in float64 throughout, so
                # the test compares these numerically with a tolerance, and
                # compares intent/route/gate exactly.
                "confidence": float(r["confidence"]),
                "margin": float(r["margin"]),
                "route": r["route"],
                "gate": r["gate"],
            }
        )
        by_route[r["route"]] = by_route.get(r["route"], 0) + 1
        key = r["gate"] or "(none — PROCEED)"
        by_gate[key] = by_gate.get(key, 0) + 1

    out_path.write_text(
        json.dumps(fixtures, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    print(f"\nwrote {len(fixtures)} rows -> {out_path}")
    print("\nby source:")
    for src in ("dev.jsonl", "typo_robustness_check", "parity.json"):
        print(f"  {src:<24} {sum(1 for f in fixtures if f['source'] == src)}")
    print("\nby route:")
    for k in sorted(by_route):
        print(f"  {k:<24} {by_route[k]}")
    print("\nby gate:")
    for k in sorted(by_gate):
        print(f"  {k:<24} {by_gate[k]}")
    print(f"\nunique texts: {len({f['text'] for f in fixtures})} of {len(fixtures)}")


if __name__ == "__main__":
    main()
