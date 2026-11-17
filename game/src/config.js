// Solmar — tuning constants, palette, districts and named places.
// Every number here comes from the design spec in HANDOFF.md.

export const WORLD = { w: 3600, h: 2600 };

export const ROADS = {
  avenues: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400],
  streets: [200, 600, 1000, 1400, 1800, 2200],
  width: 96,
  half: 48,
};

export const BEACH = { sandTop: 2240, sandBottom: 2440, seaTop: 2440 };

export const PLAYER = {
  walk: 170,
  sprint: 265,
  radius: 14,
  pistolAmmo: 24,
  pistolRange: 420,
  pistolDamage: 0.34,
  punchDamage: 0.12,
  punchRange: 46,
  maxHealth: 1,
  maxArmour: 1,
  regenPerSec: 0.02,
};

export const CAR = {
  accel: 420,
  maxSpeed: 560,
  sportMult: 1.25,
  policeMult: 1.08,
  reverseMax: 180,
  steer: 2.6,
  grip: 6.5,
  handbrakeGrip: 2.2,
  length: 46,
  width: 22,
  copSpeed: 520,
};

export const WANTED = {
  decaySeconds: 26,
  maxStars: 5,
  maxCopCars: 6,
  maxFootCops: 3,
  footCopSpeed: 235,
  holdSeconds: 1.4,
  bustedFine: 200,
  wastedFine: 150,
  sprayCost: 100,
  copNearDist: 500,
  ramDist: 300,
};

export const MISSIONS = [
  {
    name: "Welcome Back",
    text: "Mara is back in Solmar. Rico is waiting at his bar — drive over and say hello.",
    objective: "Drive to Rico's Bar",
    stages: [{ type: "goto", x: 1000, y: 560, r: 90, label: "Rico's Bar" }],
    reward: 150,
  },
  {
    name: "The Errand",
    text: "Rico needs a parcel from Old Town Market delivered to Club Neon. Fast — the buyer does not wait.",
    objective: "Pick up the parcel, then deliver it to Club Neon",
    stages: [
      { type: "goto", x: 600, y: 1000, r: 80, label: "Old Town Market" },
      { type: "goto", x: 2600, y: 960, r: 90, label: "Club Neon", timer: 75 },
    ],
    reward: 300,
  },
  {
    name: "Night Shift",
    text: "The cab company is short a driver. Run three fares around the city and keep the meter honest.",
    objective: "Complete 3 taxi fares",
    stages: [{ type: "fares", count: 3, label: "Taxi fares" }],
    reward: 200,
  },
  {
    name: "Heat Check",
    text: "The crew wants proof Mara can handle heat. Get to 3 stars — then stay free for 25 seconds.",
    objective: "Reach 3 stars, then stay free for 25 seconds",
    stages: [{ type: "heat", stars: 3, hold: 25, label: "Stay free" }],
    reward: 400,
  },
  {
    name: "Beach Run",
    text: "A package is waiting on Palma Beach. Grab it, run it to Portside — and the cops already know.",
    objective: "Pick up at Palma Beach, deliver to Portside",
    stages: [
      { type: "goto", x: 1800, y: 2340, r: 80, label: "Palma Beach" },
      { type: "goto", x: 3350, y: 600, r: 90, label: "Portside", timer: 90 },
    ],
    reward: 500,
    wantedAtStart: 2,
  },
  {
    name: "The Big Score",
    text: "A red Comet GT is parked by the stadium, keys in it. Steal it, lose the heat, and bring it to Spray & Go.",
    objective: "Steal the Comet GT, deliver it to Spray & Go",
    stages: [
      { type: "steal", x: 1400, y: 1800, r: 80, label: "Stadium — Comet GT" },
      { type: "goto", x: 2600, y: 1440, r: 90, label: "Spray & Go", timer: 100 },
    ],
    reward: 900,
    wantedAtStart: 3,
  },
];

export const PLACES = {
  ricosBar: { x: 1000, y: 560, name: "Rico's Bar" },
  market: { x: 600, y: 1000, name: "Old Town Market" },
  clubNeon: { x: 2600, y: 960, name: "Club Neon" },
  palmaBeach: { x: 1800, y: 2340, name: "Palma Beach" },
  portside: { x: 3350, y: 600, name: "Portside" },
  stadium: { x: 1400, y: 1800, name: "Stadium" },
  spray: { x: 2600, y: 1440, name: "Spray & Go" },
  hospital: { x: 1800, y: 1000, name: "Solmar General" },
};

export const DISTRICTS = [
  { name: "Old Town", x0: 0, y0: 0, x1: 1400, y1: 1400 },
  { name: "Downtown", x0: 1400, y0: 600, x1: 2600, y1: 1400 },
  { name: "Northside", x0: 0, y0: 0, x1: 3600, y1: 600 },
  { name: "Portside", x0: 3000, y0: 0, x1: 3600, y1: 2240 },
  { name: "Beachside", x0: 0, y0: 1800, x1: 3600, y1: 2600 },
];

export const PALETTE = {
  grass: "#7fae62",
  grassDark: "#74a258",
  park: "#5d9b4a",
  sand: "#e8d29a",
  sea: "#2f7fb8",
  seaDeep: "#256a9e",
  road: "#3a3a40",
  roadLine: "#d8c95a",
  sidewalk: "#9a9a92",
  buildingRoof: ["#e8b4b8", "#b8c8e8", "#e8d8b0", "#c8e8d0", "#d8b8e8", "#f0c8a0"],
  buildingEdge: "#5a5a66",
  neonPink: "#ff4fd8",
  neonCyan: "#39e6ff",
  neonYellow: "#ffe14d",
  palm: "#3f8f3f",
  container: ["#c8553a", "#3a7fc8", "#c8a83a", "#4a9e5a", "#8a5ac8"],
};

export const TAXI = { baseFare: 45, perMetre: 0.35, pxPerMetre: 10 };

export const RADIO = [
  { name: "SOLMAR FM 112", bpm: 112, root: 55, wave: "sawtooth" },
  { name: "CALOR 128", bpm: 128, root: 65.41, wave: "square" },
  { name: "PALMA CHILL 84", bpm: 84, root: 49, wave: "triangle" },
];

export const START = {
  cash: 250,
  player: { x: 1000, y: 940, angle: -Math.PI / 2 },
  car: { x: 1000, y: 880, angle: -Math.PI / 2 },
  clock: 9 * 60 + 20,
};
