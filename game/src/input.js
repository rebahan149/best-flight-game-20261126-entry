// Keyboard and mouse for Sunset Circuit. Held keys give the continuous
// control { bank, pitch, throttle } the flight model reads each step;
// presses give edge-triggered actions (confirm, pause, mute) the screen
// flow consumes once. Mouse drag steers too, for trackpad pilots.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const BANK_KEYS = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
const PITCH_KEYS = { ArrowUp: 1, KeyW: 1, ArrowDown: -1, KeyS: -1 };
const THROTTLE_KEYS = { ShiftLeft: 1, ShiftRight: 1, KeyC: -1, ControlLeft: -1 };

/** Create the input reader bound to the canvas (for mouse steering and clicks). */
export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let drag = null; // { x, y } while the mouse is held, relative to the press point
  let dragBank = 0;
  let dragPitch = 0;

  window.addEventListener('keydown', (event) => {
    if (event.code in BANK_KEYS || event.code in PITCH_KEYS || event.code === 'Space') event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointerdown', (event) => {
    drag = { x: event.clientX, y: event.clientY };
    actions |= ACTION_CONFIRM;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    dragBank = Math.max(-1, Math.min(1, (event.clientX - drag.x) / 130));
    dragPitch = Math.max(-1, Math.min(1, (drag.y - event.clientY) / 130));
  });
  const endDrag = () => { drag = null; dragBank = 0; dragPitch = 0; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /** The continuous control for this step: keys summed, mouse drag added. */
  function control() {
    let bank = dragBank;
    let pitch = dragPitch;
    let throttle = 0;
    for (const code of held) {
      if (code in BANK_KEYS) bank += BANK_KEYS[code];
      if (code in PITCH_KEYS) pitch += PITCH_KEYS[code];
      if (code in THROTTLE_KEYS) throttle += THROTTLE_KEYS[code];
    }
    return {
      bank: Math.max(-1, Math.min(1, bank)),
      pitch: Math.max(-1, Math.min(1, pitch)),
      throttle: Math.max(-1, Math.min(1, throttle)),
    };
  }

  /** Take the edge-triggered actions pressed since the last call. */
  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  return { control, takeActions };
}
