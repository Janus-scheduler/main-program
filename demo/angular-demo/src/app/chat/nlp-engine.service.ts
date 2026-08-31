import { Injectable, signal, OnDestroy } from '@angular/core';
import {
  parseArtifacts,
  parsePrototypes,
  type Artifacts,
  type Prototype,
} from '@janus-scheduler/nlp';

const vocabUrl = 'assets/nlp/vocab.json';
const vectorsUrl = 'assets/nlp/vectors.bin';
const prototypesUrl = 'assets/nlp/prototypes.json';

export interface NlpEngine {
  artifacts: Artifacts;
  prototypes: Prototype[];
}

export type EngineState =
  | { status: 'loading' }
  | { status: 'ready'; engine: NlpEngine; ms: number; bytes: number }
  | { status: 'error'; message: string };

@Injectable({
  providedIn: 'root',
})
export class NlpEngineService implements OnDestroy {
  public state = signal<EngineState>({ status: 'loading' });
  private cancelled = false;

  constructor() {
    this.loadEngine();
  }

  private async loadEngine() {
    const started = performance.now();
    try {
      const fetchAsset = async (url: string, type: 'text' | 'buffer') => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.statusText}`);
        const b = await r.blob();
        const bytes = b.size;
        const data = type === 'text' ? await b.text() : await b.arrayBuffer();
        return { bytes, data };
      };

      const [vocabAsset, vectorsAsset, protosAsset] = await Promise.all([
        fetchAsset(vocabUrl, 'text'),
        fetchAsset(vectorsUrl, 'buffer'),
        fetchAsset(prototypesUrl, 'text'),
      ]);
      if (this.cancelled) return;

      this.state.set({
        status: 'ready',
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
      if (this.cancelled) return;
      this.state.set({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  ngOnDestroy() {
    this.cancelled = true;
  }
}
