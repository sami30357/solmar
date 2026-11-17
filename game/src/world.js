// Solmar — the city: generation, road graph, collision, districts.
// Avenues run north–south, streets east–west; blocks between them hold
// buildings or parks. The beach and sea close the south edge.

import { BEACH, DISTRICTS, PALETTE, PLACES, ROADS, WORLD } from "./config.js";
import { chance, int, mulberry32, pick, range } from "./random.js";

export function createWorld(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const parks = [];
  const palms = [];
  const containers = [];
  const nodes = [];
  const nodeIndex = new Map();

  // Intersection nodes, one per avenue × street crossing.
  for (const ax of ROADS.avenues) {
    for (const sy of ROADS.streets) {
      const id = nodes.length;
      nodes.push({ x: ax, y: sy, id });
      nodeIndex.set(ax + "," + sy, id);
    }
  }

  function nodeAt(x, y) {
    return nodeIndex.get(x + "," + y);
  }

  // Neighbours of a node along its avenue and street.
  function neighbours(node) {
    const out = [];
    const ai = ROADS.avenues.indexOf(node.x);
    const si = ROADS.streets.indexOf(node.y);
    if (ai > 0) out.push(nodeAt(ROADS.avenues[ai - 1], node.y));
    if (ai < ROADS.avenues.length - 1) out.push(nodeAt(ROADS.avenues[ai + 1], node.y));
    if (si > 0) out.push(nodeAt(node.x, ROADS.streets[si - 1]));
    if (si < ROADS.streets.length - 1) out.push(nodeAt(node.x, ROADS.streets[si + 1]));
    return out;
  }

  function nearestNode(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const n of nodes) {
      const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  // Buildings: walk the blocks between roads. A block runs from one road's
  // far edge to the next road's near edge, down to the beach line.
  const xEdges = [0, ...ROADS.avenues.flatMap((a) => [a - ROADS.half, a + ROADS.half]), WORLD.w];
  const yEdges = [0, ...ROADS.streets.flatMap((s) => [s - ROADS.half, s + ROADS.half]), BEACH.sandTop];
  for (let bx = 0; bx < xEdges.length - 1; bx += 2) {
    const x0 = xEdges[bx] + 14;
    const x1 = xEdges[bx + 1] - 14;
    if (x1 - x0 < 90) continue;
    for (let by = 0; by < yEdges.length - 1; by += 2) {
      const y0 = yEdges[by] + 14;
      const y1 = yEdges[by + 1] - 14;
      if (y1 - y0 < 90) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const downtown = cx > 1400 && cx < 2600 && cy > 600 && cy < 1400;
      // A few blocks are parks instead of buildings.
      if (chance(rng, downtown ? 0.08 : 0.16)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 5; t += 1) {
          palms.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), park: true });
        }
        continue;
      }
      // One or two pastel buildings per block; downtown blocks go taller.
      const count = chance(rng, 0.45) ? 2 : 1;
      for (let b = 0; b < count; b += 1) {
        const bw = count === 1 ? x1 - x0 : (x1 - x0) / 2 - 10;
        const bh = count === 1 ? y1 - y0 : y1 - y0;
        const bx0 = count === 1 ? x0 : x0 + b * ((x1 - x0) / 2 + 10);
        const by0 = y0;
        const h = downtown ? int(rng, 26, 60) : int(rng, 10, 26);
        buildings.push({
          x: bx0,
          y: by0,
          w: bw,
          h: bh,
          height: h,
          color: pick(rng, PALETTE.buildingRoof),
          neon: downtown && chance(rng, 0.5),
        });
      }
    }
  }

  // Port containers on the east edge, in rows.
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      if (chance(rng, 0.25)) continue;
      containers.push({
        x: 3240 + col * 56,
        y: 320 + row * 340 + range(rng, -20, 20),
        w: 48,
        h: 110,
        color: pick(rng, PALETTE.container),
      });
    }
  }

  // Palms along the beach and a few sidewalks.
  for (let x = 120; x < WORLD.w; x += 130) {
    palms.push({ x: x + range(rng, -20, 20), y: BEACH.sandTop + 40 + range(rng, 0, 60), park: false });
    if (chance(rng, 0.5)) palms.push({ x: x + 60, y: BEACH.sandTop + 130, park: false });
  }
  for (let i = 0; i < 40; i += 1) {
    palms.push({
      x: pick(rng, ROADS.avenues) + 62 + range(rng, -6, 6),
      y: range(rng, 260, 2100),
      park: false,
    });
  }

  // --- Collision and road tests -------------------------------------------
  function onRoad(x, y) {
    if (x < 0 || y < 0 || x > WORLD.w || y > WORLD.h) return false;
    for (const ax of ROADS.avenues) if (Math.abs(x - ax) <= ROADS.half) return true;
    for (const sy of ROADS.streets) if (Math.abs(y - sy) <= ROADS.half) return true;
    return false;
  }

  function inBuilding(x, y, margin) {
    for (const b of buildings) {
      if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) return true;
    }
    for (const c of containers) {
      if (x > c.x - margin && x < c.x + c.w + margin && y > c.y - margin && y < c.y + c.h + margin) return true;
    }
    return false;
  }

  function inSea(x, y) {
    return y >= BEACH.seaTop;
  }

  function blocked(x, y, margin) {
    if (x < 8 || y < 8 || x > WORLD.w - 8 || y > WORLD.h - 8) return true;
    if (inSea(x, y)) return true;
    return inBuilding(x, y, margin);
  }

  function onSand(x, y) {
    return y >= BEACH.sandTop && y < BEACH.seaTop;
  }

  function districtAt(x, y) {
    // Later entries win, so the small named districts override the big ones.
    let name = "Solmar";
    for (const d of DISTRICTS) {
      if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) name = d.name;
    }
    return name;
  }

  function placeNear(x, y, radius) {
    for (const key of Object.keys(PLACES)) {
      const p = PLACES[key];
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= radius) return p;
    }
    return null;
  }

  // A random road point (on an avenue or street centre line).
  function randomRoadPoint() {
    if (chance(rng, 0.5)) {
      return { x: pick(rng, ROADS.avenues), y: range(rng, 200, 2200) };
    }
    return { x: range(rng, 200, 3400), y: pick(rng, ROADS.streets) };
  }

  return {
    buildings,
    parks,
    palms,
    containers,
    nodes,
    nodeAt,
    neighbours,
    nearestNode,
    onRoad,
    inBuilding,
    inSea,
    blocked,
    onSand,
    districtAt,
    placeNear,
    randomRoadPoint,
  };
}
