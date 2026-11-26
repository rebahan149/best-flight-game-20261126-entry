// Sunset Circuit — boot and the one loop: input is read every frame, the
// flight advances in fixed 1/60 s steps (several in a slow frame, none in a
// fast one), and the renderer paints what is there. The game moves between
// four screens: title, play, paused and results.
//
// ?seed=N fixes the valley. ?shot=start|rings|play|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createFlight, EVENT_CRASH, EVENT_FINISH, EVENT_RING } from './flight.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const flight = createFlight(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

/** A soft two-note chime on a ring, a low thud on a crash — WebAudio, no assets. */
let audio = null;
let muted = false;
function beep(freq, when, dur, type = 'sine', gain = 0.05) {
  if (muted) return;
  try {
    audio = audio ?? new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, audio.currentTime + when);
    amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + when + dur);
    osc.connect(amp).connect(audio.destination);
    osc.start(audio.currentTime + when);
    osc.stop(audio.currentTime + when + dur);
  } catch {
    // No audio device or a blocked context: the game plays silent.
  }
}

function runShot(name) {
  const scene = stageShot(name, flight);
  let painted = 0;
  function paint() {
    renderer.draw(flight.state, flight.course, scene.screen, Math.floor(flight.state.score));
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startRun() {
    flight.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Flying. ${flight.state.timeLeft} seconds, ${flight.course.rings.length} rings.`);
  }

  function endRun() {
    screen = SCREEN_OVER;
    if (flight.state.score > best) {
      best = flight.state.score;
      saveBest(best);
    }
    announce(flight.state.status === 'crashed'
      ? `Crashed. Score ${Math.floor(flight.state.score)}.`
      : `Flight complete. Score ${Math.floor(flight.state.score)}. Best ${Math.floor(best)}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) muted = !muted;
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startRun();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function stepOnce() {
    if (screen === SCREEN_TITLE) {
      // The title idles over the valley on autopilot, a living backdrop.
      flight.step(STEP, flight.autopilot());
      if (flight.state.status !== 'flying') flight.reset();
      return;
    }
    const events = flight.step(STEP, input.control());
    if (events & EVENT_RING) { beep(880, 0, 0.12); beep(1318, 0.09, 0.16); }
    if (events & EVENT_CRASH) beep(90, 0, 0.5, 'sawtooth', 0.09);
    if (events & (EVENT_CRASH | EVENT_FINISH)) endRun();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        stepOnce();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(flight.state, flight.course, screen, best);
  }

  // Leaving the tab pauses a running flight rather than flying it unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Sunset Circuit. Press Space or click to take off.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
