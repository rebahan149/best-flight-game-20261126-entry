// Sunset Circuit's painter: a golden-hour sky, a patchwork valley rushing
// past in perspective, glowing rings, a vector-drawn propeller plane that
// banks and pitches with the flight model, and a lit instrument HUD. All
// canvas 2D, no images, no network — every pixel is drawn from the state.
import { PALETTE, RUN, VIEW, FONT, FONT_MONO } from './config.js';
import { fieldColorAt, groundKindAt, riverCenterAt } from './course.js';
import { cellHash } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Distance bands for the ground mesh, near to far, in metres. */
const BANDS = [];
for (let d = 6; d < 4200; d *= 1.16) BANDS.push(d);

/** Create the renderer bound to a canvas of the fixed logical size. */
export function createRenderer(canvas) {
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const ctx = canvas.getContext('2d');

  /**
   * Project a world point into screen space for the camera riding behind
   * the plane. Returns null when the point is behind the camera.
   */
  function project(state, wx, wy, wz) {
    const rx = wx - state.x, ry = wy - state.y, rz = wz - state.z;
    const sinH = Math.sin(state.heading), cosH = Math.cos(state.heading);
    const camX = rx * cosH - rz * sinH;
    const camZ = rx * sinH + rz * cosH;
    if (camZ < 4) return null;
    const sinP = Math.sin(state.pitch), cosP = Math.cos(state.pitch);
    const y2 = ry * cosP - camZ * sinP;
    const z2 = ry * sinP + camZ * cosP;
    if (z2 < 4) return null;
    const scale = VIEW.focal / z2;
    return { x: VIEW.width / 2 + camX * scale, y: VIEW.horizonY - y2 * scale, scale, z: z2 };
  }

  /** Paint the sky gradient, the sun and its glow, in screen space. */
  function drawSky(state) {
    const g = ctx.createLinearGradient(0, -240, 0, VIEW.horizonY + 130);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.52, PALETTE.skyMid);
    g.addColorStop(0.82, PALETTE.skyLow);
    g.addColorStop(1, PALETTE.horizonGlow);
    ctx.fillStyle = g;
    ctx.fillRect(-260, -260, VIEW.width + 520, VIEW.height + 520);
    // The sun rides ahead and to the left, low over the ridge.
    const sun = project(state, state.x + Math.sin(state.heading - 0.35) * 6000, state.y + 620, state.z + Math.cos(state.heading - 0.35) * 6000);
    if (sun) {
      const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 190);
      glow.addColorStop(0, 'rgba(255,243,196,0.95)');
      glow.addColorStop(0.25, 'rgba(255,205,120,0.55)');
      glow.addColorStop(1, 'rgba(255,180,90,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(sun.x, sun.y, 190, 0, TAU); ctx.fill();
      ctx.fillStyle = PALETTE.sun;
      ctx.beginPath(); ctx.arc(sun.x, sun.y, 34, 0, TAU); ctx.fill();
    }
  }

  /** Two mountain ridge silhouettes scrolled by the heading, along the horizon. */
  function drawRidges(state) {
    for (const layer of [0, 1]) {
      const base = VIEW.horizonY + (layer === 0 ? 2 : 16);
      const amp = layer === 0 ? 26 : 15;
      const freq = layer === 0 ? 0.9 : 1.7;
      const shift = state.heading * (layer === 0 ? 340 : 620);
      ctx.fillStyle = layer === 0 ? PALETTE.ridgeFar : PALETTE.ridgeNear;
      ctx.beginPath();
      ctx.moveTo(-280, base + 60);
      for (let x = -280; x <= VIEW.width + 280; x += 40) {
        const n = Math.sin((x + shift) * 0.011 * freq) + 0.6 * Math.sin((x + shift) * 0.023 * freq + 2.1);
        ctx.lineTo(x, base - Math.abs(n) * amp - (layer === 0 ? 6 : 0));
      }
      ctx.lineTo(VIEW.width + 280, base + 60);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Soft billboard clouds at fixed valley spots, lit warm from below. */
  function drawClouds(state, course) {
    for (let i = 0; i < 26; i += 1) {
      const cx = (cellHash(i, 77) - 0.5) * 9000;
      const cz = cellHash(i, 131) * 11000 - 600;
      const cy = 300 + cellHash(i, 57) * 130;
      const p = project(state, cx, cy, cz);
      if (!p || p.z > 5200) continue;
      const s = p.scale * 90 * (0.7 + cellHash(i, 91));
      ctx.fillStyle = PALETTE.cloudShade;
      ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.ellipse(p.x, p.y + s * 0.16, s * 1.5, s * 0.34, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = PALETTE.cloudLit;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(p.x - s * 0.4, p.y, s * 0.62, s * 0.3, 0, 0, TAU);
      ctx.ellipse(p.x + s * 0.25, p.y - s * 0.12, s * 0.8, s * 0.38, 0, 0, TAU);
      ctx.ellipse(p.x + s * 0.75, p.y + s * 0.02, s * 0.5, s * 0.24, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /** One ground band cell's colour, sampled at its world centre. */
  function groundColor(course, wx, wz, state) {
    const kind = groundKindAt(course, wx, wz);
    if (kind === 'water') {
      const glint = cellHash(Math.floor(wx / 60), Math.floor(wz / 60));
      return glint > 0.86 ? PALETTE.waterGlint : PALETTE.water;
    }
    if (kind === 'road') return PALETTE.road;
    if (kind === 'runway') {
      const dash = Math.abs(wx - course.runway.x) < 3 && ((wz % 60) + 60) % 60 < 30;
      return dash ? PALETTE.runwayMark : PALETTE.runway;
    }
    return fieldColorAt(wx, wz);
  }

  /**
   * The ground as a perspective mesh: bands of growing depth, each split
   * into lateral cells whose world centres pick the field, water, road or
   * runway colour — the patchwork quilt that rushes past below.
   */
  function drawGround(state, course) {
    const sinH = Math.sin(state.heading), cosH = Math.cos(state.heading);
    ctx.fillStyle = '#6d7a44';
    ctx.fillRect(-260, VIEW.horizonY, VIEW.width + 520, VIEW.height - VIEW.horizonY + 260);
    for (let b = BANDS.length - 2; b >= 0; b -= 1) {
      const d0 = BANDS[b], d1 = BANDS[b + 1];
      const half = d1 * 1.35 + 500;
      const cols = 30;
      const stepLat = (half * 2) / cols;
      let prevRow = null;
      for (let c = 0; c <= cols; c += 1) {
        const lat = -half + c * stepLat;
        const wx = state.x + sinH * d0 + cosH * lat;
        const wz = state.z + cosH * d0 - sinH * lat;
        const p = project(state, wx, 0, wz);
        if (!p) continue;
        if (prevRow && c > 0) {
          const wxm = state.x + sinH * ((d0 + d1) / 2) + cosH * (lat - stepLat / 2);
          const wzm = state.z + cosH * ((d0 + d1) / 2) - sinH * (lat - stepLat / 2);
          const far = project(state, state.x + sinH * d1 + cosH * (lat - stepLat), 0, state.z + cosH * d1 - sinH * (lat - stepLat));
          const far2 = project(state, state.x + sinH * d1 + cosH * lat, 0, state.z + cosH * d1 - sinH * lat);
          if (far && far2) {
            ctx.fillStyle = groundColor(course, wxm, wzm, state);
            ctx.beginPath();
            ctx.moveTo(prevRow.x, prevRow.y);
            ctx.lineTo(p.x, p.y);
            ctx.lineTo(far2.x, far2.y);
            ctx.lineTo(far.x, far.y);
            ctx.closePath();
            ctx.fill();
          }
        }
        prevRow = p;
      }
    }
    // Riverbanks catch the light: a pale edge where water meets field.
    ctx.strokeStyle = 'rgba(255,220,160,0.25)';
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      let started = false;
      for (let dz = 30; dz < 3800; dz += 90) {
        const wz = state.z + dz;
        const p = project(state, riverCenterAt(wz) + side * 95, 0, wz);
        if (!p) continue;
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  /** Village houses and trees as flat-shaded billboards, far ones first. */
  function drawDressing(state, course) {
    const items = [];
    for (const h of course.houses) items.push({ kind: 'house', x: h.x, z: h.z, h });
    for (const t of course.trees) items.push({ kind: 'tree', x: t.x, z: t.z, t });
    const visible = [];
    for (const it of items) {
      const p = project(state, it.x, 0, it.z);
      if (p && p.z < 2600) visible.push({ it, p });
    }
    visible.sort((a, b) => b.p.z - a.p.z);
    for (const { it, p } of visible) {
      if (it.kind === 'tree') {
        const s = p.scale * 16 * it.t.s;
        ctx.fillStyle = '#5a4632';
        ctx.fillRect(p.x - s * 0.08, p.y - s * 0.5, s * 0.16, s * 0.5);
        ctx.fillStyle = PALETTE.tree;
        ctx.beginPath();
        ctx.arc(p.x, p.y - s * 0.85, s * 0.52, 0, TAU);
        ctx.arc(p.x - s * 0.4, p.y - s * 0.55, s * 0.38, 0, TAU);
        ctx.arc(p.x + s * 0.4, p.y - s * 0.55, s * 0.38, 0, TAU);
        ctx.fill();
      } else {
        const h = it.h;
        const w = p.scale * h.w, d = p.scale * h.h;
        ctx.fillStyle = h.tone;
        ctx.fillRect(p.x - w / 2, p.y - d, w, d);
        ctx.fillStyle = PALETTE.roof;
        ctx.beginPath();
        ctx.moveTo(p.x - w * 0.62, p.y - d);
        ctx.lineTo(p.x, p.y - d - w * 0.34);
        ctx.lineTo(p.x + w * 0.62, p.y - d);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,190,90,0.9)';
        ctx.fillRect(p.x - w * 0.12, p.y - d * 0.62, w * 0.24, d * 0.3);
      }
    }
  }

  /** The rings: idle ones burn orange, the target pulses gold, passed fade green. */
  function drawRings(state, course) {
    const drawn = [];
    for (let i = 0; i < course.rings.length; i += 1) {
      const ring = course.rings[i];
      const p = project(state, ring.x, ring.y, ring.z);
      if (p && p.z < 4200) drawn.push({ ring, p, i });
    }
    drawn.sort((a, b) => b.p.z - a.p.z);
    for (const { ring, p, i } of drawn) {
      const r = RUN.ringRadius * p.scale;
      if (r < 2) continue;
      const isTarget = i === state.target;
      const colour = ring.state === 'passed' ? PALETTE.ringPassed : isTarget ? PALETTE.ringTarget : PALETTE.ringIdle;
      ctx.save();
      ctx.globalAlpha = ring.state === 'missed' ? 0.35 : ring.state === 'passed' ? 0.6 : 0.96;
      ctx.strokeStyle = colour;
      ctx.lineWidth = clamp(r * 0.16, 1.5, 15);
      ctx.shadowColor = colour;
      ctx.shadowBlur = isTarget ? 26 : 12;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = colour;
      for (let k = 0; k < 4; k += 1) {
        const a = (k / 4) * TAU + Math.PI / 4;
        ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, clamp(r * 0.07, 1, 6), 0, TAU); ctx.fill();
      }
      if (isTarget) {
        ctx.globalAlpha = 0.16 + 0.08 * Math.sin(state.elapsed * 5);
        ctx.fillStyle = colour;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  /** The plane's soft shadow on the ground, shrinking as it climbs. */
  function drawPlaneShadow(state) {
    const p = project(state, state.x, 0, state.z);
    if (!p) return;
    const w = clamp(3400 / (state.y + 60), 8, 46);
    ctx.fillStyle = 'rgba(20,16,10,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, w * 1.7, w * 0.42, 0, 0, TAU); ctx.fill();
  }

  /**
   * The aircraft from behind: tapered wings and tailplane, a rounded
   * fuselage with a cream cheatline, a glinting canopy, a blurred spinning
   * prop disc, red and green wingtip lights. The sprite rolls with the bank
   * and rides a little higher as the nose pitches up.
   */
  function drawPlane(state) {
    const cx = VIEW.width / 2;
    const cy = 486 + state.pitch * 120;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.bank * 0.82);
    const s = 1.55; // sprite scale
    ctx.scale(s, s);
    // Prop disc, behind the fuselage: a translucent blur with two streaks.
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#2b2b30';
    ctx.beginPath(); ctx.ellipse(0, -64, 10, 62, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#45454e';
    ctx.lineWidth = 3;
    const pa = state.elapsed * 40;
    ctx.beginPath();
    ctx.moveTo(Math.sin(pa) * 9, -64 - Math.cos(pa) * 58);
    ctx.lineTo(-Math.sin(pa) * 9, -64 + Math.cos(pa) * 58);
    ctx.stroke();
    ctx.restore();
    // Tailplane and fin.
    ctx.fillStyle = PALETTE.planeBody;
    ctx.beginPath();
    ctx.moveTo(-52, -96); ctx.lineTo(52, -96); ctx.lineTo(40, -82); ctx.lineTo(-40, -82);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -138); ctx.lineTo(13, -92); ctx.lineTo(-13, -92);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = PALETTE.planeCream;
    ctx.fillRect(-3.5, -132, 7, 34);
    // Main wings with a gentle dihedral, cream tips.
    ctx.fillStyle = PALETTE.planeBody;
    ctx.beginPath();
    ctx.moveTo(-148, -18); ctx.lineTo(-30, -34); ctx.lineTo(30, -34); ctx.lineTo(148, -18);
    ctx.lineTo(140, -4); ctx.lineTo(-140, -4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = PALETTE.planeCream;
    ctx.fillRect(-148, -18, 20, 14);
    ctx.fillRect(128, -18, 20, 14);
    // Fuselage: a rounded body tapering up to the tail.
    const body = ctx.createLinearGradient(-26, 0, 26, 0);
    body.addColorStop(0, PALETTE.planeDark);
    body.addColorStop(0.35, PALETTE.planeBody);
    body.addColorStop(0.62, '#e0573f');
    body.addColorStop(1, PALETTE.planeDark);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -128);
    ctx.bezierCurveTo(17, -110, 24, -70, 24, -30);
    ctx.bezierCurveTo(24, 6, 14, 26, 0, 26);
    ctx.bezierCurveTo(-14, 26, -24, 6, -24, -30);
    ctx.bezierCurveTo(-24, -70, -17, -110, 0, -128);
    ctx.fill();
    // Cream cheatline and the canopy with its sky glint.
    ctx.fillStyle = PALETTE.planeCream;
    ctx.fillRect(-23, -46, 46, 7);
    const glass = ctx.createLinearGradient(0, -118, 0, -70);
    glass.addColorStop(0, '#d8f2fb');
    glass.addColorStop(0.5, PALETTE.canopy);
    glass.addColorStop(1, '#5e93ad');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(0, -116);
    ctx.bezierCurveTo(13, -104, 15, -84, 12, -68);
    ctx.lineTo(-12, -68);
    ctx.bezierCurveTo(-15, -84, -13, -104, 0, -116);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(-5, -96, 3.4, 9, 0.3, 0, TAU); ctx.fill();
    // Spinner cone and exhaust stubs.
    ctx.fillStyle = PALETTE.planeCream;
    ctx.beginPath(); ctx.arc(0, -64, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a3a40';
    ctx.fillRect(-27, -18, 6, 12);
    ctx.fillRect(21, -18, 6, 12);
    // Wingtip navigation lights: red left, green right, warm tail light.
    ctx.fillStyle = '#ff4040';
    ctx.beginPath(); ctx.arc(-146, -11, 4.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3dff7a';
    ctx.beginPath(); ctx.arc(146, -11, 4.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath(); ctx.arc(0, -136, 3.4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /** A glass instrument panel with amber text. */
  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill(); ctx.stroke();
  }

  /** The heading tape across the top centre: ticks, cardinals, a caret. */
  function drawHeadingTape(state) {
    panel(440, 18, 400, 58);
    ctx.save();
    ctx.beginPath(); ctx.rect(448, 22, 384, 50); ctx.clip();
    const deg = ((state.heading * 180 / Math.PI) % 360 + 360) % 360;
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `600 17px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    for (let k = -8; k <= 8; k += 1) {
      const tickDeg = Math.round(deg / 15) * 15 + k * 15;
      const x = 640 + (tickDeg - deg) * 5.2;
      const norm = ((tickDeg % 360) + 360) % 360;
      if (norm % 30 === 0) {
        const label = norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W' : String(norm / 10).padStart(2, '0');
        ctx.fillText(label, x, 52);
      }
      ctx.fillRect(x - 1, 58, 2, 8);
    }
    ctx.restore();
    ctx.fillStyle = PALETTE.amber;
    ctx.beginPath();
    ctx.moveTo(640, 78); ctx.lineTo(632, 88); ctx.lineTo(648, 88);
    ctx.closePath(); ctx.fill();
    ctx.font = `700 19px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${String(Math.round(deg)).padStart(3, '0')}°`, 640, 108);
  }

  /** The artificial horizon, bottom left: it rolls and pitches with the plane. */
  function drawHorizon(state) {
    const cx = 108, cy = 596, r = 66;
    panel(cx - r - 14, cy - r - 14, (r + 14) * 2, (r + 14) * 2);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-state.bank);
    ctx.translate(0, state.pitch * 130);
    ctx.fillStyle = '#7fb0d9';
    ctx.fillRect(-r * 1.6, -r * 1.6, r * 3.2, r * 1.6);
    const gnd = ctx.createLinearGradient(0, 0, 0, r * 1.6);
    gnd.addColorStop(0, '#a9713f');
    gnd.addColorStop(1, '#6e4a26');
    ctx.fillStyle = gnd;
    ctx.fillRect(-r * 1.6, 0, r * 3.2, r * 1.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    for (const off of [-30, -15, 15, 30]) {
      ctx.beginPath(); ctx.moveTo(off % 30 === 0 ? -22 : -14, off * 1.4); ctx.lineTo(off % 30 === 0 ? 22 : 14, off * 1.4); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-r * 1.6, 0); ctx.lineTo(r * 1.6, 0); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = PALETTE.amber;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy); ctx.lineTo(cx - 12, cy); ctx.lineTo(cx, cy + 8); ctx.lineTo(cx + 12, cy); ctx.lineTo(cx + 34, cy);
    ctx.stroke();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('HORIZON', cx, cy + r + 26);
  }

  /** All of the HUD: score and combo, tape, clock, readouts, popups, warnings. */
  function drawHud(state, course, screen) {
    ctx.textBaseline = 'alphabetic';
    // Score block, top left.
    panel(18, 18, 252, 104);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('SCORE', 36, 44);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `700 34px ${FONT_MONO}`;
    ctx.fillText(String(Math.floor(state.score)).padStart(6, '0'), 36, 82);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText(`RINGS ${state.ringsHit}/${RUN.ringCount}`, 36, 108);
    if (state.combo > 1) {
      ctx.fillStyle = PALETTE.amber;
      ctx.font = `700 17px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(`COMBO x${state.combo}`, 252, 108);
      ctx.fillRect(150, 88, 102 * (state.combo / RUN.comboCap), 5);
    }
    drawHeadingTape(state);
    // Clock, top right.
    panel(1028, 18, 234, 76);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('TIME', 1046, 44);
    ctx.fillStyle = state.timeLeft <= 10 && state.status === 'flying' ? PALETTE.danger : PALETTE.cream;
    ctx.font = `700 32px ${FONT_MONO}`;
    ctx.fillText(`${Math.max(0, state.timeLeft).toFixed(1)}s`, 1046, 80);
    // Altitude and speed, bottom right.
    panel(1010, 540, 252, 128);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText('ALTITUDE', 1028, 568);
    ctx.fillText('AIRSPEED', 1028, 622);
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `700 30px ${FONT_MONO}`;
    ctx.fillText(`${Math.round(state.y * 3.281)} ft`, 1140, 570);
    ctx.fillText(`${Math.round(state.speed * 1.944)} kt`, 1140, 624);
    drawHorizon(state);
    // Next-ring guide, bottom centre.
    const ring = course.rings[state.target];
    if (ring && screen === SCREEN_PLAY) {
      const p = project(state, ring.x, ring.y, ring.z);
      const dist = Math.hypot(ring.x - state.x, ring.z - state.z);
      ctx.fillStyle = PALETTE.panel;
      ctx.beginPath(); ctx.roundRect(490, 656, 300, 40, 10); ctx.fill();
      ctx.fillStyle = PALETTE.ringTarget;
      ctx.font = `700 17px ${FONT}`;
      ctx.textAlign = 'center';
      const arrow = !p ? (ring.x - state.x) * Math.cos(state.heading) - (ring.z - state.z) * Math.sin(state.heading) < 0 ? '◀' : '▶' : p.x < 200 ? '◀' : p.x > 1080 ? '▶' : '◎';
      ctx.fillText(`${arrow}  NEXT RING ${Math.round(dist)} m`, 640, 683);
    }
    // Ring popups.
    if (state.popupT > 0 && state.popup) {
      ctx.globalAlpha = clamp(state.popupT, 0, 1);
      ctx.fillStyle = state.popupKind === 'good' ? PALETTE.good : state.popupKind === 'near' ? PALETTE.amber : PALETTE.danger;
      ctx.font = `800 40px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(state.popup, 640, 190);
      ctx.globalAlpha = 1;
    }
    // Ground warning.
    if (screen === SCREEN_PLAY && state.status === 'flying' && state.y < 34 && state.pitch < 0.05 && Math.floor(state.elapsed * 3) % 2 === 0) {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `800 30px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('⚠ PULL UP ⚠', 640, 250);
    }
  }

  /** The title screen: the game's name over the valley at rest. */
  function drawTitle(state, best) {
    const g = ctx.createLinearGradient(0, 300, 0, 720);
    g.addColorStop(0, 'rgba(10,10,20,0)');
    g.addColorStop(1, 'rgba(10,10,20,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 300, VIEW.width, 420);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.horizonGlow;
    ctx.font = `800 84px ${FONT}`;
    ctx.fillText('SUNSET CIRCUIT', 640, 168);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `600 25px ${FONT}`;
    ctx.fillText('A golden-hour ring racer — thread all 14 rings before the light (and the clock) runs out', 640, 208);
    panel(340, 540, 600, 118);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `600 19px ${FONT}`;
    ctx.fillText('◀ ▶ / A D  bank & turn      ▲ ▼ / W S  climb & dive', 640, 578);
    ctx.fillText('SHIFT throttle up · C throttle down · P pause', 640, 608);
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `700 21px ${FONT}`;
    ctx.fillText('Press SPACE or click to take off', 640, 640);
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 17px ${FONT}`;
      ctx.fillText(`Best score ${Math.floor(best)}`, 640, 700);
    }
  }

  /** The results card shown when a run ends, crashed or out of time. */
  function drawResults(state, best) {
    ctx.fillStyle = 'rgba(8,8,16,0.45)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    panel(360, 150, 560, 400);
    ctx.textAlign = 'center';
    ctx.fillStyle = state.status === 'crashed' ? PALETTE.danger : PALETTE.horizonGlow;
    ctx.font = `800 38px ${FONT}`;
    ctx.fillText(state.status === 'crashed' ? 'CRASHED' : 'FLIGHT COMPLETE', 640, 224);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `700 56px ${FONT_MONO}`;
    ctx.fillText(String(Math.floor(state.score)), 640, 300);
    ctx.font = `600 20px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    const rows = [
      `Rings threaded   ${state.ringsHit} / ${RUN.ringCount}`,
      `Best combo       x${Math.max(1, state.bestCombo)}`,
      `Distance flown   ${(state.distance / 1000).toFixed(2)} km`,
      `Flight time      ${state.elapsed.toFixed(1)} s`,
    ];
    rows.forEach((row, i) => ctx.fillText(row, 640, 356 + i * 36));
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `700 21px ${FONT}`;
    ctx.fillText(`Best score ${Math.floor(Math.max(best, state.score))} — SPACE to fly again`, 640, 524);
  }

  /** Paint one whole frame: world (rolled with the bank), plane, HUD, overlays. */
  function draw(state, course, screen, best) {
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    ctx.save();
    ctx.translate(VIEW.width / 2, 470);
    ctx.rotate(-state.bank * 0.38);
    ctx.translate(-VIEW.width / 2, -470);
    drawSky(state);
    drawRidges(state);
    drawClouds(state, course);
    drawGround(state, course);
    drawDressing(state, course);
    drawRings(state, course);
    ctx.restore();
    drawPlaneShadow(state);
    if (screen !== SCREEN_OVER || state.status === 'crashed') drawPlane(state);
    drawHud(state, course, screen);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    if (screen === SCREEN_OVER) drawResults(state, best);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8,8,16,0.4)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.fillStyle = PALETTE.cream;
      ctx.font = `800 44px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', 640, 360);
      ctx.font = `600 20px ${FONT}`;
      ctx.fillText('P or Esc to resume', 640, 398);
    }
  }

  return { draw };
}
