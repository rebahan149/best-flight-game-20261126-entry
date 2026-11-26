// The flight model and the run it flies: position, heading, pitch, bank and
// speed stepped at a fixed rate; the ring line scored as the plane crosses
// each target ring's plane; the clock, the combo and the two ways a run
// ends (the clock, or the ground). An autopilot flies the same model for
// the screenshot scenes, steering at the target ring like a careful pilot.
import { PLANE, RUN } from './config.js';
import { createCourse } from './course.js';

export const EVENT_RING = 1;
export const EVENT_NEAR = 2;
export const EVENT_MISS = 4;
export const EVENT_CRASH = 8;
export const EVENT_FINISH = 16;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Create a flight over a fresh course drawn from the random stream. */
export function createFlight(next) {
  const course = createCourse(next);
  const state = {
    x: 0, y: PLANE.startAltitude, z: -350,
    heading: 0, pitch: 0, bank: 0, speed: PLANE.cruiseSpeed, throttle: 0,
    timeLeft: RUN.startSeconds, elapsed: 0, distance: 0,
    score: 0, combo: 0, bestCombo: 0, ringsHit: 0, target: 0,
    status: 'flying', // 'flying' | 'crashed' | 'finished'
    popup: '', popupT: 0, popupKind: '',
    prevForwardDist: null,
  };

  function reset() {
    state.x = 0; state.y = PLANE.startAltitude; state.z = -350;
    state.heading = 0; state.pitch = 0; state.bank = 0;
    state.speed = PLANE.cruiseSpeed; state.throttle = 0;
    state.timeLeft = RUN.startSeconds; state.elapsed = 0; state.distance = 0;
    state.score = 0; state.combo = 0; state.bestCombo = 0; state.ringsHit = 0;
    state.target = 0; state.status = 'flying';
    state.popup = ''; state.popupT = 0; state.popupKind = '';
    state.prevForwardDist = null;
    for (const ring of course.rings) ring.state = 'waiting';
  }

  /** The unit forward vector the nose points along. */
  function forward() {
    const cp = Math.cos(state.pitch);
    return { x: Math.sin(state.heading) * cp, y: Math.sin(state.pitch), z: Math.cos(state.heading) * cp };
  }

  /** Score crossing the target ring's plane; returns event bits. */
  function scoreRingCrossing() {
    const ring = course.rings[state.target];
    if (!ring) { state.prevForwardDist = null; return 0; }
    const f = forward();
    const rx = ring.x - state.x, ry = ring.y - state.y, rz = ring.z - state.z;
    const dist = rx * f.x + ry * f.y + rz * f.z;
    let events = 0;
    if (state.prevForwardDist !== null && state.prevForwardDist > 0 && dist <= 0) {
      const radial = Math.hypot(rx - f.x * dist, ry - f.y * dist, rz - f.z * dist);
      if (radial <= RUN.ringRadius) {
        state.combo = Math.min(state.combo + 1, RUN.comboCap);
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        const points = RUN.ringPoints * state.combo;
        state.score += points;
        state.timeLeft += RUN.ringSeconds;
        state.ringsHit += 1;
        ring.state = 'passed';
        state.popup = `RING +${points}${state.combo > 1 ? `  COMBO x${state.combo}` : ''}`;
        state.popupKind = 'good';
        events |= EVENT_RING;
      } else if (radial <= RUN.ringRadius + RUN.nearMissSlack) {
        state.score += RUN.nearMissPoints;
        state.combo = 0;
        ring.state = 'missed';
        state.popup = `NEAR MISS +${RUN.nearMissPoints}`;
        state.popupKind = 'near';
        events |= EVENT_NEAR;
      } else {
        state.combo = 0;
        ring.state = 'missed';
        state.popup = 'RING MISSED';
        state.popupKind = 'bad';
        events |= EVENT_MISS;
      }
      state.popupT = 1.6;
      state.target += 1;
      state.prevForwardDist = null;
      return events;
    }
    state.prevForwardDist = dist;
    return events;
  }

  /**
   * Advance one fixed step. `control` is { bank, pitch, throttle }, each in
   * [-1, 1]: bank rolls the wings (and so turns), pitch climbs or dives,
   * throttle works the engine. Returns the step's event bits.
   */
  function step(dt, control) {
    if (state.status !== 'flying') return 0;
    state.bank = clamp(state.bank + clamp(control.bank * PLANE.maxBank - state.bank, -PLANE.bankRate * dt, PLANE.bankRate * dt), -PLANE.maxBank, PLANE.maxBank);
    state.heading = wrapAngle(state.heading + Math.sin(state.bank) * PLANE.turnPerBank * dt / Math.max(0.35, Math.cos(state.bank * 0.4)));
    state.pitch = clamp(state.pitch + clamp(control.pitch * PLANE.maxPitch - state.pitch, -PLANE.pitchRate * dt, PLANE.pitchRate * dt), -PLANE.maxPitch, PLANE.maxPitch);
    state.throttle = clamp(control.throttle, -1, 1);
    state.speed += state.throttle * PLANE.throttleRate * dt;
    state.speed -= Math.sin(state.pitch) * 11 * dt; // climbing bleeds speed, diving gains it
    state.speed += (PLANE.cruiseSpeed - state.speed) * 0.12 * dt; // the engine settles toward cruise
    state.speed = clamp(state.speed, PLANE.minSpeed, PLANE.maxSpeed);

    const f = forward();
    state.x += f.x * state.speed * dt;
    state.y += f.y * state.speed * dt;
    state.z += f.z * state.speed * dt;
    state.distance += state.speed * dt;
    state.score += state.speed * dt * RUN.distancePoints;
    state.elapsed += dt;
    state.timeLeft -= dt;
    if (state.popupT > 0) state.popupT -= dt;

    let events = scoreRingCrossing();
    if (state.y >= PLANE.ceiling) { state.y = PLANE.ceiling; state.pitch = Math.min(state.pitch, 0); }
    if (state.y <= 0) {
      state.y = 0;
      state.status = 'crashed';
      events |= EVENT_CRASH;
    } else if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.status = 'finished';
      events |= EVENT_FINISH;
    }
    return events;
  }

  /**
   * The autopilot's control for this step: bank toward the target ring's
   * bearing, pitch toward its height, the way the screenshot scenes fly.
   * With no rings left it holds the heading and settles to cruise height.
   */
  function autopilot() {
    const ring = course.rings[state.target];
    if (!ring) return { bank: 0, pitch: clamp((130 - state.y) * 0.01, -0.5, 0.5), throttle: 0 };
    const dx = ring.x - state.x;
    const dz = ring.z - state.z;
    const wanted = Math.atan2(dx, dz);
    const error = wrapAngle(wanted - state.heading);
    const bank = clamp(error * 2.4, -1, 1);
    const ahead = Math.max(60, Math.hypot(dx, dz));
    const pitch = clamp((ring.y - state.y) / ahead * 3.4, -1, 1);
    const throttle = ahead > 350 ? 0.7 : 0.15; // hurry between rings, settle to thread them
    return { bank, pitch, throttle };
  }

  return { course, state, reset, step, autopilot, forward };
}
