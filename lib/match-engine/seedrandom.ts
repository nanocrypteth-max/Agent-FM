/**
 * Minimal seeded PRNG (mulberry32) — deterministic, fast, no external dependency.
 * Given the same seed string, always produces the same sequence of numbers in [0, 1).
 *
 * Used so that simulateMatch(input, fixtureId) is reproducible: re-running the
 * simulation with the same fixtureId + tactics always yields the same result,
 * which is useful for debugging and for "replay" features.
 */
export default function seedrandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }

  let a = h >>> 0;

  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
