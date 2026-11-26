# Sunset Circuit — design spec

A golden-hour ring racer: a chase-view flight game for the make.fun
best-flight-game-20261126-0057 bounty, built from scratch for this entry.

## The fantasy

You are the pilot of a small red-and-cream propeller plane at golden hour.
Ahead of you a course of glowing rings winds over patchwork farmland, a
river and a village. Fly through every ring before the clock runs out;
each ring banks points and seconds, chained rings build a combo.

## What the screenshots must show (the bounty's first judge criterion)

- A chase view: the aircraft in frame, seen from behind and slightly above,
  banking as it turns, propeller spinning, navigation lights lit.
- Recognisable terrain below: patchwork fields in harvest colours, a
  winding river, roads, a village of little houses, tree clusters, and the
  runway you took off from behind the start.
- A target ring ahead, glowing, with the next-ring arrow and distance.
- Instruments lit: altitude, airspeed and heading readouts, a heading tape,
  an artificial horizon that rolls with the plane, score, combo and clock.

## The loop

- 80 seconds on the clock. 14 rings on a curving course.
- Through a ring: +100 x combo and +4 seconds. Combo grows per ring,
  resets when a ring is missed (you fly past its plane without passing
  through) — a near miss still pays +25.
- Distance flown ticks the score up slowly, so moving always pays.
- Fly into the ground and the run ends in a crash; run out of time and the
  run ends cleanly. Either way: a results card with rings, best combo,
  distance and score, and the best score kept between visits.

## Controls

- Left / Right arrows or A / D: bank and turn.
- Up / Down arrows or W / S: climb and descend.
- Shift: throttle up, Ctrl or C: throttle down (speed also trades with
  pitch: diving gains, climbing bleeds).
- Space or click: start / restart. P or Esc: pause. M: mute the chime.
- Mouse: hold and drag sideways to bank, up/down to pitch, for trackpads.

## Simulation rules

- Fixed 1/60 s steps, one seeded world: the course, fields, river and
  village come from a mulberry32 stream, so a seed always builds the same
  valley and the screenshot scenes are exact renders of real play.
- Heading turns with bank (rate grows with bank angle), altitude follows
  pitch and speed, the ground is at 0 and the valley floor is flat with
  soft hills painted on, never collided with except the floor itself.
- Ring pass test: crossing the ring's plane within its radius while the
  ring is the current target; passing the plane outside the radius is a
  miss. Only the target ring scores, so the course is a route, not a soup.

## Rendering (all canvas 2D, no assets, no network)

- Sky: golden-hour gradient, sun disc with glow, two cloud layers and a
  mountain ridge silhouette on the horizon.
- Ground: perspective bands from the horizon down, each band split into
  field cells coloured by the valley map (field colour by cell hash,
  river cells water, road cells grey, village cells roofs), so the quilt
  rushes past with real perspective.
- Rings: projected circles with a glow rim; the target pulses gold, the
  rest burn steady orange; passed rings turn green and fade.
- Plane: a vector-drawn rear view — fuselage, tapered wings, tailplane,
  fin, canopy with a sky glint, spinning prop disc, wingtip lights — the
  whole sprite rolls with the bank and pitches with the climb.
- HUD: glass panels, amber-on-dark instruments: ALT ft, SPD kt, HDG tape,
  artificial horizon, score, combo meter, clock, ring counter, popups.

## Files (game/src/, one job each)

- config.js — view size, flight tuning, course size, palette, fonts.
- random.js — the seeded mulberry32 stream.
- course.js — builds the valley: fields, river, road, village, rings, runway.
- flight.js — the flight model and the run's state machine + autopilot.
- render.js — sky, terrain, rings, plane and HUD painting.
- input.js — keyboard and mouse, edge-triggered actions.
- shots.js — the deterministic screenshot scenes (?shot=start|play|rings|end).
- main.js — boot, the fixed-step loop, screen flow, shot staging.
