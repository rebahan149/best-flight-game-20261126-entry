// Sunset Circuit — every tuning number and colour in one place.
// The view is a fixed 1280x720 logical frame; the renderer scales it to the
// window, so no rule below depends on the screen a player happens to have.

export const VIEW = { width: 1280, height: 720, horizonY: 330, focal: 620 };

/** The simulation's fixed step, in seconds: 60 updates a second at any refresh rate. */
export const STEP = 1 / 60;

/** Flight model: speeds in metres/second, angles in radians, heights in metres. */
export const PLANE = {
  minSpeed: 26,
  cruiseSpeed: 44,
  maxSpeed: 78,
  throttleRate: 14, // m/s gained per second at full throttle change
  pitchRate: 0.85, // rad/s the nose moves at full stick
  maxPitch: 0.42, // steepest climb or dive the stick commands
  bankRate: 1.9, // rad/s the wings roll toward the stick
  maxBank: 1.05, // steepest bank, about 60 degrees
  turnPerBank: 0.9, // heading rad/s at max bank
  startAltitude: 120,
  ceiling: 420,
};

/** The run: how long the clock starts with, what a ring pays, how combo grows. */
export const RUN = {
  startSeconds: 80,
  ringCount: 14,
  ringRadius: 26, // metres; the hole you must thread
  ringPoints: 100,
  nearMissPoints: 25,
  nearMissSlack: 22, // metres beyond the rim that still count as a near miss
  ringSeconds: 4,
  distancePoints: 0.35, // score per metre flown
  comboCap: 8,
};

/** The valley: a square of farmland the course winds across, in metres. */
export const VALLEY = {
  size: 9000, // the course runs from z=0 to about z=size
  cell: 260, // one field cell
  riverHalfWidth: 90,
  villageZ: 4300, // where the village sits along the course
};

/** Golden-hour palette: sky, light and instruments. */
export const PALETTE = {
  skyTop: '#2e3a67',
  skyMid: '#b3546e',
  skyLow: '#f2a65a',
  horizonGlow: '#ffd9a0',
  sun: '#fff3c4',
  ridgeFar: '#6b4a63',
  ridgeNear: '#4a3350',
  cloudLit: '#ffd9b0',
  cloudShade: '#c97e7e',
  water: '#3f6d8e',
  waterGlint: '#7fb0c9',
  road: '#5d5648',
  runway: '#3c3a38',
  runwayMark: '#f5efe2',
  roof: '#8a4438',
  wall: '#d9c39a',
  tree: '#4c6b35',
  ringIdle: '#ff8c42',
  ringTarget: '#ffd23e',
  ringPassed: '#7dd87d',
  planeBody: '#c33e2e',
  planeCream: '#f3e5cf',
  planeDark: '#5e2015',
  canopy: '#9fd4e8',
  panel: 'rgba(16,18,28,0.72)',
  panelEdge: 'rgba(255,210,140,0.55)',
  amber: '#ffc857',
  cream: '#fdf6e3',
  muted: '#cbb9a0',
  danger: '#ff5a4e',
  good: '#8fe388',
};

export const FONT = '"Avenir Next", "Segoe UI", system-ui, sans-serif';
export const FONT_MONO = '"SF Mono", "Cascadia Mono", Consolas, monospace';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'sunset-circuit.best';
