// Solmar — staged screenshot scenes behind ?shot=<name>&seed=7.
// An autopilot drives the real rules forward (never teleporting the hero
// car onto a marker) and holds the banner/marker through a keepShotHud
// object, not by starting a mission (a mission completing mid-shot would
// pop a briefing card). Prefer straight runs: a waypoint exactly on a
// target makes the car U-turn into a building.

import { CAR, PLACES } from "./config.js";
import { driveToward, makeCar } from "./vehicles.js";

export const SHOT_NAMES = ["cover", "chase", "mission", "neon"];

const SHOT_DEFS = {
  cover: {
    clock: 10 * 60,
    seconds: 3.0,
    cash: 250,
    wanted: 0,
    hero: { x: 1000, y: 1900, angle: -Math.PI / 2, type: "sedan", color: "#4a7fd8" },
    driveTo: { x: 1000, y: 500 },
    marker: { x: 1000, y: 560, label: "Rico's Bar" },
    objective: "Drive to Rico's Bar",
    missionName: "Welcome Back",
    toast: null,
  },
  chase: {
    clock: 22 * 60,
    seconds: 4,
    cash: 400,
    wanted: 3,
    hero: { x: 600, y: 1000, angle: 0, type: "sport", color: "#e02030" },
    driveTo: { x: 3400, y: 1000 },
    marker: null,
    objective: "Lose the cops",
    missionName: "",
    toast: "The whole city is coming!",
    cops: 2,
  },
  mission: {
    clock: 17 * 60 + 30,
    seconds: 1.6,
    cash: 1050,
    wanted: 0,
    onFoot: { x: 1400, y: 2200 },
    walkTo: { x: 1800, y: 2340 },
    marker: { x: 1800, y: 2340, label: "The Big Score" },
    objective: "Pick up at Palma Beach",
    missionName: "Beach Run",
    toast: null,
    beachPeds: 2,
  },
  neon: {
    clock: 20 * 60,
    seconds: 3.0,
    cash: 700,
    wanted: 1,
    hero: { x: 2200, y: 1800, angle: -Math.PI / 2, type: "taxi", color: "#f2c200" },
    driveTo: { x: 2200, y: 200 },
    marker: { x: 2200, y: 600, label: "Drop-off" },
    objective: "Drop the fare off",
    missionName: "",
    toast: null,
    cops: 1,
    fareAboard: true,
  },
};

export function stageShot(name, S) {
  const def = SHOT_DEFS[name] || SHOT_DEFS.cover;
  S.clock = def.clock;
  S.cash = def.cash;
  S.wanted = def.wanted;
  S.wantedTimer = 0;
  S.shot = { def, elapsed: 0, done: false };

  // Keep the HUD banner/marker fixed for the whole shot.
  S.keepShotHud = {
    objective: def.objective,
    missionName: def.missionName,
    marker: def.marker,
  };
  if (def.toast) {
    S.toast = def.toast;
    S.toastTimer = 999;
  }

  if (def.onFoot) {
    S.player.x = def.onFoot.x;
    S.player.y = def.onFoot.y;
    S.player.inCar = false;
    S.player.car = null;
    S.player.angle = Math.atan2(def.walkTo.y - def.onFoot.y, def.walkTo.x - def.onFoot.x);
    S.cars.length = 0;
    if (def.beachPeds) {
      // A couple of peds on the beach for life in the frame.
      S.peds.length = 0;
      S.peds.push({ x: 1560, y: 2320, angle: 0, speed: 50, color: "#e86a8a", name: "Ana", tx: 1600, ty: 2330, flee: 0, dead: false, fare: false, dest: null, wait: 0, bob: 0 });
      S.peds.push({ x: 1980, y: 2300, angle: 2, speed: 50, color: "#6aa8e8", name: "Luis", tx: 2000, ty: 2310, flee: 0, dead: false, fare: false, dest: null, wait: 0, bob: 1 });
    }
  } else {
    const hero = makeCar(def.hero.x, def.hero.y, def.hero.angle, {
      driver: "player",
      type: def.hero.type,
      color: def.hero.color,
    });
    hero.speed = 200;
    S.cars.length = 0;
    S.cars.push(hero);
    S.player.car = hero;
    S.player.inCar = true;
    S.player.x = hero.x;
    S.player.y = hero.y;
    S.player.angle = hero.angle;
    if (def.fareAboard) {
      S.taxi = { ped: { x: def.hero.x, y: def.hero.y, dest: { x: 2200, y: 600 } }, from: { x: 2200, y: 1800 }, pickedUp: true };
    }
    if (def.cops) {
      for (let i = 0; i < def.cops; i += 1) {
        const behind = def.hero.angle === 0
          ? { x: def.hero.x - 90 - i * 70, y: def.hero.y }
          : { x: def.hero.x, y: def.hero.y + 90 + i * 70 };
        const cop = makeCar(behind.x, behind.y, def.hero.angle, { driver: "cop", type: "police", color: "#e8e8e8" });
        cop.siren = true;
        cop.speed = 260;
        S.police.copCars.push(cop);
      }
    }
  }
  S.camera.x = S.player.x - 640;
  S.camera.y = S.player.y - 360;
  return def;
}

// Advance the staged scene one fixed step. Returns true when the shot is
// ready to capture.
export function stepShot(S, dt) {
  const shot = S.shot;
  if (!shot || shot.done) return shot ? shot.done : false;
  const def = shot.def;
  shot.elapsed += dt;

  if (def.driveTo && S.player.inCar && S.player.car) {
    const cmd = driveToward(S.player.car, def.driveTo.x, def.driveTo.y);
    S.driveCarStep(S.player.car, dt, cmd.throttle, cmd.steer, false);
    // Keep the player (and the camera) on the hero car — the shot loop
    // does not run the normal player step that copies the car position.
    S.player.x = S.player.car.x;
    S.player.y = S.player.car.y;
    S.player.angle = S.player.car.angle;
    // The fare pays when the cab passes the marker (neon scene).
    if (S.taxi && S.taxi.pickedUp && def.marker) {
      const d = Math.hypot(S.player.x - def.marker.x, S.player.y - def.marker.y);
      if (d < 80) {
        S.cash += 68;
        S.toast = "Fare paid — +$68";
        S.toastTimer = 999;
        S.taxi = null;
      }
    }
  } else if (def.walkTo) {
    // Mara walks toward the parcel on the beach.
    const dx = def.walkTo.x - S.player.x;
    const dy = def.walkTo.y - S.player.y;
    const d = Math.hypot(dx, dy);
    if (d > 10) {
      const speed = 170;
      S.player.angle = Math.atan2(dy, dx);
      const nx = S.player.x + Math.cos(S.player.angle) * speed * dt;
      const ny = S.player.y + Math.sin(S.player.angle) * speed * dt;
      if (!S.world.blocked(nx, S.player.y, 6)) S.player.x = nx;
      if (!S.world.blocked(S.player.x, ny, 6)) S.player.y = ny;
    }
  }

  // Cop cars in the shot chase the hero on the same road.
  for (const cop of S.police.copCars) {
    const cmd = driveToward(cop, S.player.x, S.player.y);
    S.driveCarStep(cop, dt, Math.min(1, cmd.throttle + 0.2), cmd.steer, false);
  }

  // Camera follows the hero.
  S.camera.x = S.player.x - 640;
  S.camera.y = S.player.y - 360;
  S.camera.x = Math.max(-80, Math.min(3600 - 1280 + 80, S.camera.x));
  S.camera.y = Math.max(-80, Math.min(2600 - 720 + 80, S.camera.y));

  if (shot.elapsed >= def.seconds) {
    shot.done = true;
    return true;
  }
  return false;
}

export function shotDuration(name) {
  return (SHOT_DEFS[name] || SHOT_DEFS.cover).seconds;
}
