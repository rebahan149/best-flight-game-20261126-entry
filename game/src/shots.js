// The screenshot scenes behind ?shot=start|rings|play|end. Each one flies
// the real flight model forward from a fresh reset, steered by the model's
// own autopilot, until a staged moment arrives — a ring count, a popup
// still on screen — so a scene is a true frame of play and the same seed
// always renders the same frame.
import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const MAX_STEPS = Math.round(400 / STEP); // a hard stop so a scene can never loop forever

/** Fly the autopilot until `done(state)` holds or the run ends; returns steps flown. */
function flyUntil(flight, done) {
  let steps = 0;
  while (steps < MAX_STEPS && flight.state.status === 'flying' && !done(flight.state)) {
    flight.step(STEP, flight.autopilot());
    steps += 1;
  }
  return steps;
}

/**
 * Set `flight` to the named scene and return the screen to draw over it.
 * - start: four gentle seconds over the home runway, title screen up.
 * - rings: the moment just after the second ring threads — combo popup up,
 *   the third ring already gold ahead.
 * - play: five rings banked, mid-course, the village and river below.
 * - end: flown on autopilot until the run ends, results card up.
 */
export function stageShot(name, flight) {
  flight.reset();
  if (name === 'rings') {
    flyUntil(flight, (s) => s.ringsHit >= 2);
    // A few more steps so the frame sits inside the popup's life.
    for (let i = 0; i < Math.round(0.4 / STEP); i += 1) flight.step(STEP, flight.autopilot());
    return { screen: SCREEN_PLAY };
  }
  if (name === 'play') {
    flyUntil(flight, (s) => s.ringsHit >= 5);
    for (let i = 0; i < Math.round(1.2 / STEP); i += 1) flight.step(STEP, flight.autopilot());
    return { screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    flyUntil(flight, () => false);
    return { screen: SCREEN_OVER };
  }
  for (let i = 0; i < Math.round(4 / STEP); i += 1) flight.step(STEP, flight.autopilot());
  return { screen: SCREEN_TITLE };
}
