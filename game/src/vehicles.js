// Solmar — cars: arcade physics, traffic AI, carjacking.
// Physics: speed along the nose, velocity lerps to it (grip), and movement
// is axis-separated and validated, so cars slide along walls, never wedge.

import { CAR, ROADS, WORLD } from "./config.js";
import { chance, pick, range } from "./random.js";

export const CAR_COLORS = ["#d84a4a", "#4a7fd8", "#e8c84a", "#4ad87a", "#8a5ad8", "#e8e8e8", "#3a3a3a", "#d87a4a"];
export const TAXI_COLOR = "#f2c200";
export const SPORT_COLOR = "#e02030";
export const COP_COLOR = "#e8e8e8";

let nextCarId = 1;

export function makeCar(x, y, angle, opts) {
  const o = opts || {};
  return {
    id: nextCarId,
    x,
    y,
    angle,
    speed: 0,
    vx: 0,
    vy: 0,
    color: o.color || pickColor(),
    type: o.type || "sedan", // sedan | sport | taxi | police | comet
    driver: o.driver || "parked", // parked | traffic | cop | player
    maxSpeed: o.maxSpeed || CAR.maxSpeed,
    targetNode: null,
    stuck: 0,
    siren: false,
    fare: null,
    brakeLight: false,
  };
}

function pickColor() {
  return CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
}

export function maxSpeedFor(car) {
  if (car.type === "sport" || car.type === "comet") return CAR.maxSpeed * CAR.sportMult;
  if (car.type === "police") return CAR.maxSpeed * CAR.policeMult;
  return car.maxSpeed;
}

// One physics step. `throttle` -1..1, `steer` -1..1, `handbrake` boolean.
// `blockedAt` is the world's collision test: move x, then y, each validated.
export function driveCar(car, dt, throttle, steer, handbrake, blockedAt) {
  const max = maxSpeedFor(car);
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) car.speed += CAR.accel * throttle * dt * 0.9;
  if (car.speed > max) car.speed = max;
  if (car.speed < -CAR.reverseMax) car.speed = -CAR.reverseMax;
  // Rolling drag so a car coasts to a stop.
  if (throttle === 0) car.speed -= car.speed * 0.8 * dt;

  const speedFactor = Math.min(Math.abs(car.speed) / 200, 1);
  car.angle += steer * CAR.steer * dt * speedFactor * (car.speed >= 0 ? 1 : -1);
  car.angle = normAngle(car.angle);

  const grip = handbrake ? CAR.handbrakeGrip : CAR.grip;
  const wantVx = Math.cos(car.angle) * car.speed;
  const wantVy = Math.sin(car.angle) * car.speed;
  const k = Math.min(1, grip * dt);
  car.vx += (wantVx - car.vx) * k;
  car.vy += (wantVy - car.vy) * k;

  // Axis-separated movement: validate each axis against the building test
  // at the car's front and back points, so it slides along walls.
  const fx = Math.cos(car.angle) * (CAR.length / 2);
  const fy = Math.sin(car.angle) * (CAR.length / 2);
  const nx = car.x + car.vx * dt;
  if (!blockedAt(nx + fx, car.y + fy, 4) && !blockedAt(nx - fx, car.y - fy, 4)) {
    car.x = nx;
  } else {
    car.vx *= 0.4;
    car.speed *= 0.6;
  }
  const ny = car.y + car.vy * dt;
  if (!blockedAt(car.x + fx, ny + fy, 4) && !blockedAt(car.x - fx, ny - fy, 4)) {
    car.y = ny;
  } else {
    car.vy *= 0.4;
    car.speed *= 0.6;
  }
  car.x = Math.max(10, Math.min(WORLD.w - 10, car.x));
  car.y = Math.max(10, Math.min(WORLD.h - 10, car.y));
  car.brakeLight = throttle < 0 || handbrake;
}

export function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleDiff(a, b) {
  return normAngle(a - b);
}

// Steer a car toward a point. Slows for sharp turns so it never U-turns
// into a building at full speed. Returns { throttle, steer }.
export function driveToward(car, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(want, car.angle);
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const ad = Math.abs(diff);
  let throttle = 1;
  if (ad > 1.1) throttle = 0.15;
  else if (ad > 0.5) throttle = 0.5;
  else if (ad > 0.25) throttle = 0.8;
  return { throttle, steer };
}

// Traffic: follow the road graph to a random neighbour node, slow for the
// car ahead. `cars` is every car, for the ahead-check.
export function stepTraffic(car, dt, world, cars, rng) {
  if (!car.targetNode) {
    const node = world.nearestNode(car.x, car.y);
    const next = pick(rng, world.neighbours(node));
    car.targetNode = next;
  }
  const target = car.targetNode;
  const dist = Math.hypot(target.x - car.x, target.y - car.y);
  if (dist < 30) {
    const next = pick(rng, world.neighbours(target));
    car.targetNode = next;
    car.stuck = 0;
    return;
  }
  // Slow for the car ahead on the same heading.
  let throttle = 1;
  const ahead = carAhead(car, cars);
  if (ahead !== null && ahead < 70) throttle = 0.15;
  else if (ahead !== null && ahead < 120) throttle = 0.5;
  const cmd = driveToward(car, target.x, target.y);
  driveCar(car, dt, Math.min(throttle, cmd.throttle), cmd.steer, false, (x, y, m) => world.blocked(x, y, m));
  // Unstick: if barely moving for a while, pick a fresh target node.
  if (Math.abs(car.speed) < 20) {
    car.stuck += dt;
    if (car.stuck > 3) {
      car.targetNode = null;
      car.stuck = 0;
    }
  } else {
    car.stuck = 0;
  }
}

// Distance to the nearest car ahead of this one, in its nose direction.
export function carAhead(car, cars) {
  let best = null;
  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  for (const other of cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * nx + dy * ny;
    if (along < 0 || along > 260) continue;
    const side = Math.abs(-dx * ny + dy * nx);
    if (side > 30) continue;
    if (best === null || along < best) best = along;
  }
  return best;
}

// Positional separation only — never trade speeds, or a ramming cop glues
// itself to the player and pins them at 0 km/h.
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 40;
      if (d > 0 && d < min) {
        const push = (min - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }
    }
  }
}

// Spawn the ambient traffic: 16 cars on road points, random colours.
export function spawnTraffic(world, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const p = world.randomRoadPoint();
    const onAvenue = ROADS.avenues.includes(Math.round(p.x));
    const angle = onAvenue
      ? (chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2)
      : (chance(rng, 0.5) ? 0 : Math.PI);
    const type = chance(rng, 0.18) ? "sport" : "sedan";
    const car = makeCar(p.x, p.y, angle, { driver: "traffic", type, color: type === "sport" ? SPORT_COLOR : undefined });
    car.speed = range(rng, 120, 260);
    cars.push(car);
  }
  return cars;
}

// The nearest enterable car within reach of a point (on foot).
export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function isParked(car) {
  return car.driver === "parked";
}
