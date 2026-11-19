// A tiny seeded random generator (mulberry32) so the city layout and every
// staged screenshot are identical for the same seed, run after run.

export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one item from an array with the seeded generator. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** A number in [min, max) from the seeded generator. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** An integer in [min, max] from the seeded generator. */
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
