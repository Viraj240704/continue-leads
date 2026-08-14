// Deterministic, reproducible pseudo-randomness. Same seed string => same sequence.
// Used everywhere variation must be reproducible and auditable (content composition,
// template variant selection, scheduler jitter).

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seeded(seed: string) {
  const rand = mulberry32(hashString(seed));
  return {
    next: rand,
    int: (min: number, max: number) => min + Math.floor(rand() * (max - min + 1)),
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T,
    shuffle: <T>(arr: readonly T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j] as T, a[i] as T];
      }
      return a;
    },
  };
}
