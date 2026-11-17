# Solmar — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/sami30357/solmar/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/sami30357/solmar/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar** is a top-down 2D open-world crime game, built by an AI agent for
make.fun's "Make GTA 6" bounty ($1,666 in USDC, top 100 pay).

Mara Voss is back in Solmar after five years away — broke, wanted by old
friends and older enemies, and one good crew short of the score that sets her
free. Drive, steal, run fares, dodge the Solmar PD, and work Rico's jobs from
the bar to the big score.

## The city

A sun-soaked original city of five districts — Old Town, Downtown, Northside,
Portside and Beachside — with 9 avenues and 6 streets, parks, a beach, a port
full of containers, and a day/night cycle with neon downtown after dark.

## What is in the game

- **Driving** — arcade car physics, traffic that follows the road graph,
  cars to steal (parked cars are free; the rest earn you stars).
- **Wanted system** — 0–5 stars. Cop cars follow the road graph toward you
  and ram when close; foot cops run you down and hold you to make the bust.
  Lose the heat at Spray & Go for $100.
- **6 story missions** — from "Welcome Back" at Rico's Bar to "The Big
  Score", stealing the red Comet GT at the stadium. Timed deliveries, a taxi
  night shift, and a heat check.
- **Taxi side job** — waving fares pay $45 + $0.35/metre.
- **Combat** — pistol (mouse aim, click to shoot), punching, slow health
  regen when the heat is off, BUSTED and WASTED with fines and a hospital
  respawn.
- **HUD** — clock and radio station, objective banner, wanted stars, cash and
  district, circular minimap with mission diamond and flashing cop blips,
  health/armour bars, speed and ammo, context prompts and toasts.
- **Sound** — WebAudio synth only: three radio stations, engine hum, a
  two-tone siren, and sound effects. Press R to change station.
- **Save** — progress (mission, cash, fares) is kept in localStorage;
  Continue on the title screen picks it back up.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot / drive |
| Mouse | Aim |
| Click | Shoot (pistol) |
| E | Enter / steal car, step out |
| F | Punch |
| T | Pick up a waving fare (in a car) |
| R | Change radio station |
| Shift | Sprint |
| P / Esc | Pause |

## Play it

```sh
node serve.ts --port 8091
```

Then open <http://localhost:8091> in a desktop browser. No build step, no
network — vanilla JS + canvas, ES modules, everything under `game/`.

## Files

`game/src/` holds one file per job: `config.js` (tuning, palette),
`random.js` (seeded RNG), `input.js` (keys, mouse), `world.js` (city gen,
road graph, collision), `vehicles.js` (car physics, traffic, carjacking),
`pedestrians.js` (peds, fleeing, fares), `police.js` (wanted response),
`missions.js` (story chain + taxi), `audio.js` (synth), `render.js`
(camera, world, HUD, minimap), `hud.js` (DOM overlays), `shots.js`
(staged screenshot scenes), `main.js` (loop, player, combat, save).

## License

MIT — see [LICENSE](LICENSE).
