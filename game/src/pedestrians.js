// Solmar — pedestrians: walkers on the sidewalks, fleeing, taxi fares.
// Peds walk near roads, wander between sidewalk points, and run from
// gunshots and speeding cars. Fares wave with a yellow "!" bubble.

import { ROADS, WORLD } from "./config.js";
import { chance, pick, range } from "./random.js";

const PED_COLORS = ["#e86a8a", "#6aa8e8", "#e8c86a", "#8ae86a", "#c86ae8", "#e8e8e8", "#e89a6a"];
const PED_NAMES = ["Ana", "Luis", "Rosa", "Diego", "Carmen", "Pablo", "Lucia", "Marco", "Sofia", "Tomas"];

export function makePed(world, rng, x, y) {
  const px = x !== undefined ? x : range(rng, 100, WORLD.w - 100);
  const py = y !== undefined ? y : range(rng, 100, 2200);
  return {
    x: px,
    y: py,
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 40, 70),
    color: pick(rng, PED_COLORS),
    name: pick(rng, PED_NAMES),
    tx: px,
    ty: py,
    flee: 0,
    dead: false,
    fare: false,
    dest: null,
    wait: range(rng, 0, 4),
    bob: range(rng, 0, Math.PI * 2),
  };
}

export function spawnPeds(world, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    // Start near a road so they read as street life, not lost in blocks.
    const p = world.randomRoadPoint();
    peds.push(makePed(world, rng, p.x + range(rng, -70, 70), p.y + range(rng, -70, 70)));
  }
  return peds;
}

function pickWanderTarget(ped, world, rng) {
  const p = world.randomRoadPoint();
  ped.tx = p.x + range(rng, -70, 70);
  ped.ty = p.y + range(rng, -70, 70);
}

export function stepPeds(peds, dt, world, rng, danger) {
  for (const ped of peds) {
    if (ped.dead) continue;
    ped.bob += dt * 8;
    // Flee from a danger point (gunshot, fast car, punch).
    if (danger) {
      const d = Math.hypot(ped.x - danger.x, ped.y - danger.y);
      if (d < danger.r) {
        ped.flee = 2.5;
        ped.angle = Math.atan2(ped.y - danger.y, ped.x - danger.x);
      }
    }
    let speed = ped.speed;
    if (ped.flee > 0) {
      ped.flee -= dt;
      speed = 150;
    } else if (ped.fare) {
      speed = 0; // a waving fare waits where they stand.
    } else if (ped.wait > 0) {
      ped.wait -= dt;
      speed = 0;
    }
    if (speed > 0 && !ped.fare) {
      if (ped.flee <= 0) {
        const d = Math.hypot(ped.tx - ped.x, ped.ty - ped.y);
        if (d < 20) {
          ped.wait = range(rng, 1, 5);
          pickWanderTarget(ped, world, rng);
        } else {
          ped.angle = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
        }
      }
      const nx = ped.x + Math.cos(ped.angle) * speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * speed * dt;
      // Peds stay out of buildings and the sea.
      if (!world.blocked(nx, ped.y, 6)) ped.x = nx;
      if (!world.blocked(ped.x, ny, 6)) ped.y = ny;
    }
    ped.x = Math.max(12, Math.min(WORLD.w - 12, ped.x));
    ped.y = Math.max(12, Math.min(WORLD.h - 12, ped.y));
  }
}

// A waving fare: stands by a road, shows "!", waits for a cab.
export function spawnFare(world, rng, peds) {
  const p = world.randomRoadPoint();
  const ped = makePed(world, rng, p.x + range(rng, -60, 60), p.y + range(rng, -60, 60));
  ped.fare = true;
  const dest = world.randomRoadPoint();
  ped.dest = dest;
  peds.push(ped);
  return ped;
}

// The nearest waving fare to a point.
export function nearestFare(peds, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const ped of peds) {
    if (!ped.fare || ped.dead) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}

// A car hitting a ped at speed: the ped goes down (and the law notices).
export function carHitsPed(car, ped) {
  const d = Math.hypot(car.x - ped.x, car.y - ped.y);
  return Math.abs(car.speed) > 120 && d < 30;
}

export { PED_COLORS };
