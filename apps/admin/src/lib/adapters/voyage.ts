import "server-only";
import { env } from "../env";
import type { Embedder } from "./embeddings";

// Real Voyage embeddings (voyage-3-lite). Voyage-3 embeddings are Matryoshka, so
// truncating to the pgvector column dimension (EMBEDDING_DIM) is valid and keeps
// the vectors compatible with the existing schema. Falls back to the local
// embedder on any API error so generation never hard-fails.
export class VoyageEmbedder implements Embedder {
  readonly name = `voyage:${env.voyageModel}`;
  readonly dim = env.embeddingDim;
  constructor(private fallback: Embedder) {}

  async embed(text: string): Promise<number[]> {
    try {
      const res = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.voyageApiKey}` },
        body: JSON.stringify({ input: [text.slice(0, 32000)], model: env.voyageModel, input_type: "document" }),
      });
      if (!res.ok) throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as { data?: { embedding: number[] }[] };
      const raw = json.data?.[0]?.embedding;
      if (!raw?.length) throw new Error("Voyage returned no embedding");
      return normalize(fit(raw, this.dim));
    } catch (e) {
      console.error("[voyage] embed failed, falling back to local:", (e as Error).message);
      return this.fallback.embed(text);
    }
  }
}

// Truncate (Matryoshka) or zero-pad to the target dimension.
function fit(v: number[], dim: number): number[] {
  if (v.length === dim) return v;
  if (v.length > dim) return v.slice(0, dim);
  return v.concat(new Array(dim - v.length).fill(0));
}
function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}
