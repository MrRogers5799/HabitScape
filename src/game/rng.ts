/**
 * Seeded randomness (PLAT-007). The same trip id and chunk index always give the
 * same numbers, so a trip resolves identically however often it's recomputed.
 */

/** 32-bit FNV-1a hash of a string. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: a small, fast generator returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A generator for one chunk of one trip. */
export function chunkRng(tripId: string, chunk: number): () => number {
  return mulberry32(hashString(`${tripId}#${chunk}`));
}

/**
 * Rounds a fractional amount up or down at random, weighted by the fraction,
 * so long-run totals match the expected rate exactly (33.25 → 33 or 34, 34 a quarter of the time).
 */
export function stochasticRound(amount: number, rand: () => number): number {
  const whole = Math.floor(amount);
  return whole + (rand() < amount - whole ? 1 : 0);
}
