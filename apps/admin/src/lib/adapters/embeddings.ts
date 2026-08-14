import "server-only";
import { env } from "../env";
import { VoyageEmbedder } from "./voyage";

export interface Embedder {
  readonly name: string;
  readonly dim: number;
  embed(text: string): Promise<number[]>;
}

// Deterministic hashing vectorizer: token -> bucket, signed accumulation, L2-normalized.
// Near-duplicate text yields cosine ~1; unrelated text yields low cosine. No API/keys.
// A real "voyage" driver (voyage-3-lite) plugs in behind this same interface.
class LocalDeterministicEmbedder implements Embedder {
  readonly name = "local-hash-256";
  constructor(readonly dim: number) {}

  async embed(text: string): Promise<number[]> {
    const vec = new Array(this.dim).fill(0);
    const tokens = (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOP.has(t));
    // Unigrams (weight 1) capture topic; adjacent bigrams (weight 2) capture phrasing.
    // Templated text that only swaps nouns keeps unigrams but loses most bigrams, so
    // genuinely varied prose diverges sharply while exact duplicates still match ~1.0.
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]!;
      const sign = fnv1a("s:" + tok) & 1 ? 1 : -1;
      vec[fnv1a(tok) % this.dim] += sign;
      if (i > 0) {
        const bg = tokens[i - 1] + " " + tok;
        const bsign = fnv1a("s:" + bg) & 1 ? 1 : -1;
        vec[fnv1a("bg:" + bg) % this.dim] += bsign * 2;
      }
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}

// Down-weight ubiquitous function words so shared filler doesn't inflate similarity.
const STOP = new Set(
  "a an and the of to in for on with your you we our that is are be as at by it this from or your can will".split(" ")
);

function fnv1a(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function toVectorLiteral(v: number[]): string {
  return "[" + v.map((x) => x.toFixed(6)).join(",") + "]";
}

let _e: Embedder | null = null;
export function getEmbedder(): Embedder {
  if (_e) return _e;
  const local = new LocalDeterministicEmbedder(env.embeddingDim);
  if (env.embeddingsDriver === "voyage") {
    if (!env.voyageApiKey) {
      console.warn("EMBEDDINGS_DRIVER=voyage but VOYAGE_API_KEY is empty; using local embedder.");
      _e = local;
    } else {
      _e = new VoyageEmbedder(local);
    }
  } else {
    _e = local;
  }
  return _e;
}
