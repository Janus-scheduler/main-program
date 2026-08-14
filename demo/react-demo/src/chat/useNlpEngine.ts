/**
 * Loads the NLP artifacts in the BROWSER.
 *
 * ── Why the artifacts are fetched, never imported ─────────────────────────
 *
 * `vectors.bin` (3.06 MB) + `prototypes.json` (2.49 MB) + `vocab.json`
 * (487 kB) come to just over 6 MB. Writing `import vocab from
 * ".../vocab.json"` would inline every byte into the app bundle — the exact
 * thing `@janus-scheduler/nlp`'s pure entry point exists to prevent. The
 * `?url` suffix asks Vite for the emitted asset URL instead, so the files are
 * served and cached separately and the JS bundle stays at ~590 kB.
 *
 * 6 MB is still a lot to fetch, and `prototypes.json` is the bulk of it purely
 * because it stores float vectors as JSON text. Shrinking that (a packed
 * binary, like `vectors.bin` already uses) is a Step 7 concern, not a
 * correctness one.
 *
 * This is also the first real exercise of the package's browser contract:
 * `parseArtifacts({ vocab, vectors })` with no `fs` anywhere in sight. If the
 * pure entry had picked up a Node import, this module would not build.
 */

import { useEffect, useState } from "react";
import { parseArtifacts, parsePrototypes } from "@janus-scheduler/nlp";
import type { Artifacts, Prototype } from "@janus-scheduler/nlp";

import vocabUrl from "@janus-scheduler/nlp/artifacts/vocab.json?url";
import vectorsUrl from "@janus-scheduler/nlp/artifacts/vectors.bin?url";
import prototypesUrl from "@janus-scheduler/nlp/artifacts/prototypes.json?url";

export interface NlpEngine {
  artifacts: Artifacts;
  prototypes: Prototype[];
}

export type EngineState =
  | { status: "loading" }
  | { status: "ready"; engine: NlpEngine; ms: number; bytes: number }
  | { status: "error"; message: string };

/** Fetch and decode the artifacts once, for the lifetime of the page. */
export function useNlpEngine(): EngineState {
  const [state, setState] = useState<EngineState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();

    void (async () => {
      try {
        const fetchAsset = async (url: string, type: "text" | "buffer") => {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.statusText}`);
          const b = await r.blob();
          const bytes = b.size;
          const data = type === "text" ? await b.text() : await b.arrayBuffer();
          return { bytes, data };
        };

        const [vocabAsset, vectorsAsset, protosAsset] = await Promise.all([
          fetchAsset(vocabUrl, "text"),
          fetchAsset(vectorsUrl, "buffer"),
          fetchAsset(prototypesUrl, "text"),
        ]);
        if (cancelled) return;

        setState({
          status: "ready",
          engine: {
            artifacts: parseArtifacts({
              vocab: vocabAsset.data as string,
              vectors: vectorsAsset.data as ArrayBuffer,
            }),
            prototypes: parsePrototypes(protosAsset.data as string),
          },
          ms: Math.round(performance.now() - started),
          bytes: vocabAsset.bytes + vectorsAsset.bytes + protosAsset.bytes,
        });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
