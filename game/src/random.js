// A seeded random stream (mulberry32). The whole valley — fields, river,
// village, ring line — is drawn from one stream, so a seed always builds the
// same world and the screenshot scenes render identically on every machine.

/** Create a stream of uniform randoms in [0, 1) from a 32-bit seed. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random float in [min, max) from the stream. */
export function range(next, min, max) {
  return min + next() * (max - min);
}

/** A random integer in [min, max] (both ends included) from the stream. */
export function intRange(next, min, max) {
  return min + Math.floor(next() * (max - min + 1));
}

/** Pick one entry of a non-empty array with the stream. */
export function pick(next, choices) {
  return choices[Math.floor(next() * choices.length)];
}

/** A stable 0..1 hash of two integers, for per-cell colours that need no stream order. */
export function cellHash(a, b) {
  let h = (a * 374761393 + b * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
