// The valley Sunset Circuit flies over, built once from the seeded stream:
// a patchwork of fields, a winding river, one road, a village, tree clusters,
// the home runway, and the line of rings that makes the course. Everything
// here is a pure function of the seed, so every pilot — and every screenshot
// scene — flies the same valley.
import { RUN, VALLEY } from './config.js';
import { cellHash, intRange, pick, range } from './random.js';

/** Harvest colours a field cell can wear, weighted by the cell hash. */
const FIELD_TONES = [
  '#7d9b4e', '#8fae57', '#a9bd6a', // meadow greens
  '#c9a44e', '#d9b95c', '#e3cd7e', // ripe wheat golds
  '#96683c', '#7c5a36', // ploughed earth
  '#b7bf6d', '#679153', // pasture
  '#c98d5f', // cut stubble
];

/** The river's centre line: two slow sine swells added together, in metres east of the start. */
export function riverCenterAt(z) {
  return 1500 * Math.sin(z * 0.00032) + 650 * Math.sin(z * 0.0011 + 1.7);
}

/** The road's centre line: a gentler wander west of the runway. */
export function roadCenterAt(z) {
  return -620 + 260 * Math.sin(z * 0.00045 + 0.6);
}

/** The field colour of the cell holding world point (x, z), before river and road override it. */
export function fieldColorAt(x, z) {
  const cx = Math.floor(x / VALLEY.cell);
  const cz = Math.floor(z / VALLEY.cell);
  const tone = FIELD_TONES[Math.floor(cellHash(cx, cz) * FIELD_TONES.length) % FIELD_TONES.length];
  return tone;
}

/** What the ground is at a world point: 'field' | 'water' | 'road' | 'runway'. */
export function groundKindAt(course, x, z) {
  const r = course.runway;
  if (z >= r.z0 && z <= r.z1 && Math.abs(x - r.x) <= r.halfWidth) return 'runway';
  if (Math.abs(x - riverCenterAt(z)) <= VALLEY.riverHalfWidth) return 'water';
  if (Math.abs(x - roadCenterAt(z)) <= 26) return 'road';
  return 'field';
}

/**
 * Build the whole course from the random stream: the ring line first (its
 * wander is the course), then the village houses and the tree clusters.
 * Rings sit 480–640 m apart along z, stepping sideways up to 620 m and
 * between 70 and 235 m up, so the line climbs, dives and S-turns.
 */
export function createCourse(next) {
  const rings = [];
  let x = 0;
  let y = 130;
  let z = 720;
  for (let i = 0; i < RUN.ringCount; i += 1) {
    rings.push({ x, y, z, state: 'waiting' });
    x = Math.max(-1650, Math.min(1650, x + range(next, -620, 620)));
    y = Math.max(70, Math.min(235, y + range(next, -70, 70)));
    z += range(next, 400, 520);
  }

  const villageX = riverCenterAt(VALLEY.villageZ) + 700;
  const houses = [];
  for (let i = 0; i < 46; i += 1) {
    houses.push({
      x: villageX + range(next, -420, 420),
      z: VALLEY.villageZ + range(next, -380, 380),
      w: range(next, 26, 46),
      d: range(next, 22, 38),
      h: range(next, 12, 24),
      tone: pick(next, ['#d9c39a', '#cbb489', '#e2d3ac', '#bfa87e']),
    });
  }

  const trees = [];
  for (let i = 0; i < 300; i += 1) {
    const tx = range(next, -2600, 2600);
    const tz = range(next, -200, VALLEY.size);
    if (Math.abs(tx - riverCenterAt(tz)) < VALLEY.riverHalfWidth + 40) continue;
    trees.push({ x: tx, z: tz, s: range(next, 0.7, 1.5) });
  }

  return {
    rings,
    houses,
    trees,
    runway: { x: 0, z0: -700, z1: 260, halfWidth: 42 },
    villageX,
    endZ: z,
    intSeed: intRange(next, 1, 9),
  };
}
