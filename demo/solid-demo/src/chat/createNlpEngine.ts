import { createSignal, onMount, onCleanup } from "solid-js";
import {
  parseArtifacts,
  parsePrototypes,
  type Artifacts,
  type Prototype,
} from "@janus-scheduler/nlp";

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

export function createNlpEngine() {
  const [state, setState] = createSignal<EngineState>({ status: "loading" });

  onMount(() => {
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

    onCleanup(() => {
      cancelled = true;
    });
  });

  return state;
}
