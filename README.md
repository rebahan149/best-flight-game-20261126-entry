[![make.fun bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/rebahan149/best-flight-game-20261126-entry/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/rebahan149/best-flight-game-20261126-entry/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# Sunset Circuit

A golden-hour ring racer, built for the make.fun bounty
[Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057).

You fly a red-and-cream propeller plane from behind, over a patchwork
valley of harvest fields, a winding river, a road and a village, at sunset.
Fourteen glowing rings wind across the valley; thread each one before the
80-second clock runs out. Every ring banks points and four more seconds,
chained rings build a combo multiplier, a near miss still pays — and the
ground ends the run.

## Play it

```sh
node serve.ts          # then open http://localhost:8080
```

- **◀ ▶ / A D** bank and turn · **▲ ▼ / W S** climb and dive
- **Shift** throttle up · **C** throttle down · **P** pause · **M** mute
- Mouse: hold and drag to steer. Space or click to take off and restart.

## How it is built

Plain static files under `game/` — an `index.html` and ES modules, no
library, no network request, everything drawn with canvas 2D:

- `game/src/config.js` — view, flight tuning, course size, palette.
- `game/src/random.js` — the seeded stream the whole valley is built from.
- `game/src/course.js` — fields, river, road, village, runway, ring line.
- `game/src/flight.js` — the flight model, ring scoring, combo, autopilot.
- `game/src/render.js` — sky, terrain mesh, rings, the plane, the HUD.
- `game/src/input.js` — keyboard and mouse.
- `game/src/shots.js` — the deterministic screenshot scenes.
- `game/src/main.js` — boot and the fixed-step loop.

`main.ts` hands the game in: it copies `game/` and `screenshots/` to the
output directory and writes `dossier.json` with the vendored
`vendor/makefun-game.ts` library.

MIT licensed — see `LICENSE`.
