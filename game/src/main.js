// Solmar — boot and the one loop: fixed 1/60 s steps, screens, the player
// on foot and in a car, combat, the spray shop, saving, and the staged
// screenshot mode (?shot=<name>&seed=7) that plays the real rules forward.

import { BEACH, CAR, MISSIONS, PLACES, PLAYER, START, TAXI, WANTED, WORLD } from "./config.js";
import { mulberry32 } from "./random.js";
import { createInput } from "./input.js";
import { createWorld } from "./world.js";
import { driveCar, makeCar, nearestCar, separateCars, spawnTraffic, stepTraffic } from "./vehicles.js";
import { carHitsPed, makePed, nearestFare, spawnFare, spawnPeds, stepPeds } from "./pedestrians.js";
import { addWanted, createPolice, crimeText } from "./police.js";
import { createMissions } from "./missions.js";
import { createAudio } from "./audio.js";
import { createRenderer, VIEW } from "./render.js";
import { createHud } from "./hud.js";
import { SHOT_NAMES, stageShot, stepShot } from "./shots.js";

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const SAVE_KEY = "solmar-save-v1";

const params = new URLSearchParams(window.location.search);
const shotName = params.get("shot");
const seedParam = Number.parseInt(params.get("seed") ?? "", 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");
const rng = mulberry32(seed);

const world = createWorld(seed);
const policeApi = createPolice(world, rng);
const missionApi = createMissions(world, rng);
const audio = createAudio();
const renderer = createRenderer(canvas);
const input = createInput(canvas);

function announce(message) {
  statusEl.textContent = message;
}

// --- The one shared state object -------------------------------------------
const S = {
  world,
  police: policeApi.police,
  missions: missionApi.missions,
  missionApi,
  time: 0,
  clock: START.clock,
  cash: START.cash,
  wanted: 0,
  wantedTimer: 0,
  lastCrime: "",
  player: {
    x: START.player.x,
    y: START.player.y,
    angle: START.player.angle,
    health: 1,
    armour: 0.25,
    ammo: PLAYER.pistolAmmo,
    inCar: false,
    car: null,
  },
  cars: [],
  peds: [],
  bullets: [],
  taxi: null,
  faresDone: 0,
  camera: { x: 360, y: 580 },
  screen: "title",
  missionName: "",
  radioName: "SOLMAR FM 112",
  toast: "",
  toastTimer: 0,
  prompt: "",
  sfx: [],
  showBriefing: false,
  storyComplete: false,
  shot: null,
  keepShotHud: null,
  fireCooldown: 0,
  fareTimer: 12,
  trafficTimer: 0,
  pedTimer: 0,
  danger: null,
};

S.driveCarStep = function (car, dt, throttle, steer, handbrake) {
  driveCar(car, dt, throttle, steer, handbrake, (x, y, m) => world.blocked(x, y, m));
};

function resetWorld() {
  S.cars.length = 0;
  S.peds.length = 0;
  S.bullets.length = 0;
  S.police.copCars.length = 0;
  S.police.footCops.length = 0;
  S.taxi = null;
  // The starter car: parked, on the avenue centre line facing the mission.
  const starter = makeCar(START.car.x, START.car.y, START.car.angle, { driver: "parked", type: "sedan", color: "#4a7fd8" });
  S.cars.push(starter);
  // The red Comet GT by the stadium, waiting for the big score.
  const comet = makeCar(PLACES.stadium.x, PLACES.stadium.y + 40, Math.PI / 2, { driver: "parked", type: "comet", color: "#e02030" });
  S.cars.push(comet);
  // A few more parked cars around town.
  const parkedSpots = [
    { x: 600, y: 560, a: 0 }, { x: 1800, y: 600, a: Math.PI / 2 }, { x: 2600, y: 1000, a: 0 },
    { x: 1400, y: 2200, a: Math.PI }, { x: 3000, y: 1400, a: -Math.PI / 2 }, { x: 2200, y: 1800, a: 0 },
    { x: 1000, y: 1400, a: Math.PI / 2 }, { x: 3400, y: 2200, a: -Math.PI / 2 },
  ];
  for (const spot of parkedSpots) {
    S.cars.push(makeCar(spot.x, spot.y, spot.a, { driver: "parked", type: "sedan" }));
  }
  // A yellow cab parked by Club Neon.
  S.cars.push(makeCar(2600, 1060, 0, { driver: "parked", type: "taxi", color: "#f2c200" }));
  for (const car of spawnTraffic(world, rng, 16)) S.cars.push(car);
  for (const ped of spawnPeds(world, rng, 24)) S.peds.push(ped);
}

function resetPlayer() {
  const p = S.player;
  p.x = START.player.x;
  p.y = START.player.y;
  p.angle = START.player.angle;
  p.health = 1;
  p.armour = 0.25;
  p.ammo = PLAYER.pistolAmmo;
  p.inCar = false;
  p.car = null;
}

function newGame() {
  resetWorld();
  resetPlayer();
  S.cash = START.cash;
  S.wanted = 0;
  S.wantedTimer = 0;
  S.clock = START.clock;
  S.faresDone = 0;
  S.storyComplete = false;
  S.camera.x = S.player.x - VIEW.w / 2;
  S.camera.y = S.player.y - VIEW.h / 2;
  missionApi.begin(S, 0);
  S.missionName = MISSIONS[0].name;
  S.screen = "briefing";
  hud.showBriefing(MISSIONS[0], true);
  saveGame();
  announce("Solmar. Mission 1: Welcome Back.");
}

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      mission: S.missions.index,
      cash: S.cash,
      fares: S.faresDone,
    }));
  } catch {
    // Storage off: progress lasts this visit only.
  }
}

function continueGame() {
  const save = loadSave();
  if (!save) {
    newGame();
    return;
  }
  resetWorld();
  resetPlayer();
  S.cash = save.cash;
  S.faresDone = save.fares || 0;
  S.wanted = 0;
  S.clock = START.clock;
  S.storyComplete = false;
  S.camera.x = S.player.x - VIEW.w / 2;
  S.camera.y = S.player.y - VIEW.h / 2;
  const idx = Math.min(save.mission, MISSIONS.length - 1);
  missionApi.begin(S, idx);
  S.missionName = MISSIONS[idx].name;
  S.screen = "briefing";
  hud.showBriefing(MISSIONS[idx], idx === 0);
  announce("Welcome back to Solmar.");
}

function respawnAfterArrest(fine, kind) {
  S.cash = Math.max(0, S.cash - fine);
  const p = S.player;
  if (p.inCar && p.car) {
    p.car.driver = "parked";
    p.car.speed = 0;
  }
  p.inCar = false;
  p.car = null;
  p.x = PLACES.hospital.x;
  p.y = PLACES.hospital.y;
  p.health = 1;
  p.armour = 0.5;
  p.ammo = PLAYER.pistolAmmo;
  S.wanted = 0;
  S.wantedTimer = 0;
  policeApi.clearAll(S);
  S.taxi = null;
  S.camera.x = p.x - VIEW.w / 2;
  S.camera.y = p.y - VIEW.h / 2;
  saveGame();
  if (kind === "busted") hud.showBusted(fine);
  else hud.showWasted(fine);
  S.screen = kind;
  audio.sfx("busted");
  announce(kind === "busted" ? "Busted." : "Wasted.");
}

function damagePlayer(amount) {
  const p = S.player;
  let left = amount;
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, left);
    p.armour -= absorbed;
    left -= absorbed;
  }
  p.health -= left;
  if (p.health <= 0) {
    p.health = 0;
    respawnAfterArrest(WANTED.wastedFine, "wasted");
  }
}

function shoot() {
  const p = S.player;
  if (p.ammo <= 0) {
    S.toast = "Out of ammo — find a new gun";
    S.toastTimer = 2;
    return;
  }
  p.ammo -= 1;
  S.fireCooldown = 0.28;
  const bx = p.x + Math.cos(p.angle) * 22;
  const by = p.y + Math.sin(p.angle) * 22;
  S.bullets.push({ x: bx, y: by, angle: p.angle, dist: 0 });
  addWanted(S, 1, "shoot");
  S.toast = crimeText("shoot");
  S.toastTimer = 2;
  S.danger = { x: p.x, y: p.y, r: 320 };
  audio.sfx("shoot");
}

function punch() {
  const p = S.player;
  S.fireCooldown = 0.35;
  let target = null;
  let bestD = PLAYER.punchRange;
  for (const ped of S.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d < bestD) {
      bestD = d;
      target = ped;
    }
  }
  for (const cop of S.police.footCops) {
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    if (d < bestD) {
      bestD = d;
      target = cop;
    }
  }
  if (target) {
    target.health = (target.health === undefined ? 1 : target.health) - PLAYER.punchDamage;
    target.x += Math.cos(p.angle) * 18;
    target.y += Math.sin(p.angle) * 18;
    audio.sfx("punch");
    if (target.health <= 0 && target.name) {
      target.dead = true;
      addWanted(S, 1, "ped");
      S.toast = crimeText("ped");
      S.toastTimer = 2;
    } else if (target.health <= 0) {
      // A cop went down.
      S.police.footCops = S.police.footCops.filter((c) => c !== target);
      addWanted(S, 1, "cop");
      S.toast = crimeText("cop");
      S.toastTimer = 2;
    }
  } else {
    audio.sfx("punch");
  }
}

function enterCar() {
  const p = S.player;
  if (p.inCar) {
    // Step out beside the car.
    const car = p.car;
    car.driver = "parked";
    car.speed *= 0.3;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    p.angle = car.angle;
    p.inCar = false;
    p.car = null;
    return;
  }
  const car = nearestCar(S.cars, p.x, p.y, 70);
  if (!car) return;
  if (car.driver !== "parked") {
    addWanted(S, 1, "steal");
    S.toast = crimeText("steal");
    S.toastTimer = 2.5;
  }
  car.driver = "player";
  p.inCar = true;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  audio.sfx("pickup");
}

function stepBullets(dt) {
  for (let i = S.bullets.length - 1; i >= 0; i -= 1) {
    const b = S.bullets[i];
    b.x += Math.cos(b.angle) * 900 * dt;
    b.y += Math.sin(b.angle) * 900 * dt;
    b.dist += 900 * dt;
    let hit = b.dist >= PLAYER.pistolRange || world.blocked(b.x, b.y, 0);
    if (!hit) {
      for (const ped of S.peds) {
        if (ped.dead) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 15) {
          ped.health = (ped.health === undefined ? 1 : ped.health) - PLAYER.pistolDamage;
          ped.flee = 3;
          if (ped.health <= 0) {
            ped.dead = true;
            addWanted(S, 1, "ped");
            S.toast = crimeText("ped");
            S.toastTimer = 2;
          }
          hit = true;
          break;
        }
      }
    }
    if (!hit) {
      for (const cop of S.police.footCops) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 15) {
          cop.health = (cop.health === undefined ? 1 : cop.health) - PLAYER.pistolDamage;
          if (cop.health <= 0) {
            S.police.footCops = S.police.footCops.filter((c) => c !== cop);
            addWanted(S, 1, "cop");
            S.toast = crimeText("cop");
            S.toastTimer = 2;
          }
          hit = true;
          break;
        }
      }
    }
    if (hit) S.bullets.splice(i, 1);
  }
}

function stepPlayer(dt) {
  const p = S.player;
  S.prompt = "";
  if (p.inCar && p.car) {
    const car = p.car;
    const throttle = (input.down("KeyW") || input.down("ArrowUp") ? 1 : 0) - (input.down("KeyS") || input.down("ArrowDown") ? 1 : 0);
    const steer = (input.down("KeyD") || input.down("ArrowRight") ? 1 : 0) - (input.down("KeyA") || input.down("ArrowLeft") ? 1 : 0);
    const handbrake = input.down("Space");
    S.driveCarStep(car, dt, throttle, steer, handbrake);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    // Cars hitting peds: the driver pays for it.
    for (const ped of S.peds) {
      if (!ped.dead && carHitsPed(car, ped)) {
        ped.dead = true;
        addWanted(S, 1, "ped");
        S.toast = crimeText("ped");
        S.toastTimer = 2;
        audio.sfx("crash");
      }
    }
    if (input.pressed("KeyE")) enterCar();
    if (input.pressed("KeyT")) missionApi.tryPickupFare(S);
    // Spray & Go: drive in with $100 and wanted > 0 to lose the heat.
    const sprayD = Math.hypot(p.x - PLACES.spray.x, p.y - PLACES.spray.y);
    if (sprayD < 90 && S.wanted > 0) {
      if (S.cash >= WANTED.sprayCost) {
        S.cash -= WANTED.sprayCost;
        policeApi.clearAll(S);
        S.toast = "Spray & Go — clean car, clean record (-$100)";
        S.toastTimer = 3;
        audio.sfx("cash");
      } else {
        S.prompt = "Spray & Go — need $100 to lose the heat";
      }
    }
  } else {
    // On foot: WASD, mouse aim, click shoot, F punch, E enter car.
    const mx = input.moveX();
    const my = input.moveY();
    const len = Math.hypot(mx, my) || 1;
    const sprint = input.down("ShiftLeft") || input.down("ShiftRight");
    const speed = sprint ? PLAYER.sprint : PLAYER.walk;
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    if (!world.blocked(nx, p.y, 8)) p.x = nx;
    if (!world.blocked(p.x, ny, 8)) p.y = ny;
    // Aim at the mouse (logical view coords via the renderer view).
    const dpr = window.devicePixelRatio || 1;
    const lx = (input.mouseX * dpr - renderer.view.x) / renderer.view.scale + S.camera.x;
    const ly = (input.mouseY * dpr - renderer.view.y) / renderer.view.scale + S.camera.y;
    p.angle = Math.atan2(ly - p.y, lx - p.x);
    S.fireCooldown -= dt;
    if (input.mouseDown && S.fireCooldown <= 0) shoot();
    if (input.pressed("KeyF")) punch();
    if (input.pressed("KeyE")) enterCar();
    const near = nearestCar(S.cars, p.x, p.y, 70);
    if (near) S.prompt = "E — " + (near.driver === "parked" ? "Take the car" : "Steal the car");
    else {
      const fare = nearestFare(S.peds, p.x, p.y, 70);
      if (fare) S.prompt = "A fare is waving — get a car and press T";
    }
  }
  // Slow regen when the heat is off.
  if (S.wanted === 0 && p.health < 1) {
    p.health = Math.min(1, p.health + PLAYER.regenPerSec * dt);
  }
}

function stepWorld(dt) {
  S.time += dt;
  S.clock = (S.clock + dt / 1.2) % 1440;
  if (S.toastTimer > 0) S.toastTimer -= dt;

  stepPlayer(dt);

  // Traffic and the police drive their own cars.
  for (const car of S.cars) {
    if (car.driver === "traffic") {
      // Traffic AI lives in vehicles.js; it needs the rng.
      trafficStep(car, dt);
    }
  }
  const result = policeApi.step(S, dt);
  if (result.busted) {
    respawnAfterArrest(WANTED.bustedFine, "busted");
    return;
  }

  // Cop cars and traffic hitting the on-foot player.
  const p = S.player;
  if (!p.inCar) {
    for (const car of S.cars) {
      if (Math.abs(car.speed) > 100 && Math.hypot(car.x - p.x, car.y - p.y) < 28) {
        damagePlayer(car.driver === "cop" ? 0.2 : 0.15);
        p.x += (p.x - car.x) * 0.4;
        p.y += (p.y - car.y) * 0.4;
        audio.sfx("crash");
        if (S.screen !== "playing") return;
      }
    }
  }

  separateCars(S.cars);
  stepBullets(dt);
  stepPeds(S.peds, dt, world, rng, S.danger);
  S.danger = null;

  // Missions and the taxi job.
  missionApi.step(S, dt);
  missionApi.stepTaxi(S);
  const def = missionApi.currentDef();
  S.missionName = def ? def.name : "";
  if (S.missions.failed) {
    S.missions.failed = false;
    missionApi.begin(S, S.missions.index);
    S.missionName = missionApi.currentDef().name;
    S.showBriefing = true;
  }
  if (S.missions.done || S.storyComplete) {
    if (S.screen === "playing") {
      S.screen = "complete";
      hud.showComplete(S.cash);
      saveGame();
    }
  }
  if (S.showBriefing && S.screen === "playing") {
    S.showBriefing = false;
    S.screen = "briefing";
    const d = missionApi.currentDef();
    if (d) hud.showBriefing(d, S.missions.index === 0);
  }

  // Free-roam fares while no mission is running.
  if (!S.missions.active && !S.taxi) {
    S.fareTimer -= dt;
    if (S.fareTimer <= 0) {
      S.fareTimer = 18;
      const waving = S.peds.some((ped) => ped.fare && !ped.dead);
      if (!waving) {
        spawnFare(world, rng, S.peds);
        S.toast = "A fare is waving somewhere in the city";
        S.toastTimer = 3;
      }
    }
  }

  // Keep the traffic topped up and the streets populated.
  S.trafficTimer -= dt;
  if (S.trafficTimer <= 0) {
    S.trafficTimer = 2;
    const traffic = S.cars.filter((c) => c.driver === "traffic").length;
    if (traffic < 16) {
      const p2 = world.randomRoadPoint();
      if (Math.hypot(p2.x - S.player.x, p2.y - S.player.y) > 500) {
        const car = makeCar(p2.x, p2.y, 0, { driver: "traffic", type: "sedan" });
        car.speed = 160;
        S.cars.push(car);
      }
    }
  }
  S.pedTimer -= dt;
  if (S.pedTimer <= 0) {
    S.pedTimer = 5;
    S.peds = S.peds.filter((ped) => !ped.dead);
    while (S.peds.length < 24) {
      const p2 = world.randomRoadPoint();
      S.peds.push(makePed(world, rng, p2.x, p2.y));
    }
  }

  // Camera follows the player.
  const tx = S.player.x - VIEW.w / 2;
  const ty = S.player.y - VIEW.h / 2;
  S.camera.x += (tx - S.camera.x) * Math.min(1, 6 * dt);
  S.camera.y += (ty - S.camera.y) * Math.min(1, 6 * dt);
  S.camera.x = Math.max(-40, Math.min(WORLD.w - VIEW.w + 40, S.camera.x));
  S.camera.y = Math.max(-40, Math.min(WORLD.h - VIEW.h + 40, S.camera.y));

  // Audio: engine by speed, siren when cops are out, radio sequencer.
  const speedFrac = S.player.inCar && S.player.car ? Math.abs(S.player.car.speed) / 700 : 0;
  audio.setEngine(speedFrac);
  audio.setSiren(S.police.copCars.length > 0);
  audio.tick();

  // Queued sound effects.
  for (const name of S.sfx) audio.sfx(name);
  S.sfx.length = 0;

  // Radio station switch.
  if (input.pressed("KeyR")) {
    S.radioName = audio.cycleStation();
    S.toast = "Radio: " + S.radioName;
    S.toastTimer = 2;
  }
  if (input.pressed("KeyP") || input.pressed("Escape")) {
    S.screen = "paused";
    hud.showPause();
    announce("Paused.");
  }
  input.clearPressed();
}

// Traffic AI lives in vehicles.js; this is the one-line call site.
function trafficStep(car, dt) {
  stepTraffic(car, dt, world, S.cars, rng);
}

// --- HUD wiring -------------------------------------------------------------
const hud = createHud({
  onNewGame: () => {
    hud.hide();
    audio.ensure();
    newGame();
  },
  onContinue: () => {
    hud.hide();
    audio.ensure();
    continueGame();
  },
  onBriefingDone: () => {
    hud.hide();
    audio.ensure();
    S.screen = "playing";
    announce("Playing. " + S.missions.objective);
  },
  onResume: () => {
    hud.hide();
    S.screen = "playing";
  },
  onQuitToTitle: () => {
    hud.hide();
    saveGame();
    S.screen = "title";
    hud.showTitle(!!loadSave());
  },
  onAfterArrest: () => {
    hud.hide();
    S.screen = "playing";
  },
  onRoam: () => {
    hud.hide();
    S.screen = "playing";
    S.missions.active = false;
    S.missions.marker = null;
    S.missions.objective = "Free roam — Solmar is yours";
    S.missionName = "";
  },
});

// --- Debug / test surface ---------------------------------------------------
window.__solmar = {
  get screen() { return S.screen; },
  get mission() { return S.missions.index; },
  get missionName() { return S.missionName; },
  get cash() { return S.cash; },
  get wanted() { return S.wanted; },
  get health() { return S.player.health; },
  get playerX() { return S.player.x; },
  get playerY() { return S.player.y; },
  get inCar() { return S.player.inCar; },
  get speed() { return S.player.car ? S.player.car.speed : 0; },
  get fares() { return S.faresDone; },
  get storyComplete() { return S.storyComplete; },
  get objective() { return S.missions.objective; },
  get cops() { return S.police.copCars.map((c) => [Math.round(c.x), Math.round(c.y), Math.round(c.speed)]); },
  get carCount() { return S.cars.length; },
  errors: [],
};
window.addEventListener("error", (e) => {
  window.__solmar.errors.push(String(e.message || e.error));
});

// --- Shot mode ---------------------------------------------------------------
function runShot(name) {
  resetWorld();
  resetPlayer();
  S.screen = "playing";
  S.player.health = 1;
  stageShot(name, S);
  let accumulator = 0;
  let last = performance.now();
  let ready = false;
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP && !ready) {
      ready = stepShot(S, STEP);
      accumulator -= STEP;
    }
    // Hold the staged HUD through the shot.
    if (S.keepShotHud) {
      S.missions.objective = S.keepShotHud.objective;
      S.missions.marker = S.keepShotHud.marker;
      S.missionName = S.keepShotHud.missionName;
    }
    renderer.draw(S);
    if (ready && !window.__shotReady) {
      window.__shotReady = true;
    }
  }
  announce("Solmar shot: " + name);
  requestAnimationFrame(frame);
}

// --- Normal game -------------------------------------------------------------
function runGame() {
  resetWorld();
  resetPlayer();
  hud.showTitle(!!loadSave());
  S.screen = "title";
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (S.screen === "title") {
      // Slow drift over the city behind the title screen.
      S.time += 1 / 60;
      S.camera.x = 1200 + Math.sin(S.time * 0.05) * 600;
      S.camera.y = 900 + Math.cos(S.time * 0.04) * 300;
      S.camera.x = Math.max(-40, Math.min(WORLD.w - VIEW.w + 40, S.camera.x));
      S.camera.y = Math.max(-40, Math.min(WORLD.h - VIEW.h + 40, S.camera.y));
      if (input.anyGesture) audio.ensure();
      input.clearPressed();
    } else if (S.screen === "playing") {
      while (accumulator >= STEP) {
        stepWorld(STEP);
        accumulator -= STEP;
        if (S.screen !== "playing") break;
      }
      if (S.screen !== "playing") accumulator = 0;
    } else {
      accumulator = 0;
      if (S.screen === "paused") {
        if (input.pressed("KeyP") || input.pressed("Escape")) {
          hud.hide();
          S.screen = "playing";
        }
        input.clearPressed();
      }
    }
    renderer.draw(S);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && S.screen === "playing") {
      S.screen = "paused";
      hud.showPause();
      announce("Paused.");
    }
  });

  announce("Solmar. Press Start.");
  requestAnimationFrame(frame);
}

if (shotName && SHOT_NAMES.includes(shotName)) runShot(shotName);
else runGame();
