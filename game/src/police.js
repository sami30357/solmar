// Solmar — the wanted system and the police response.
// Stars rise on crime and decay after 26 quiet seconds with no cop near.
// Cop cars follow the road graph toward the player's intersection when far
// and ram directly when close; foot cops run the on-foot player down and
// hold them 1.4 s to make the bust.

import { CAR, ROADS, WANTED } from "./config.js";
import { driveCar, driveToward, makeCar, normAngle } from "./vehicles.js";
import { chance, pick } from "./random.js";

export function createPolice(world, rng) {
  const police = {
    copCars: [],
    footCops: [],
    crimeTimer: 0,
    decayTimer: 0,
  };

  function spawnCopCarNear(px, py) {
    // On a road node a little away from the player, facing roughly at them.
    const node = world.nearestNode(px, py);
    const cands = world.neighbours(node);
    const spot = cands.length ? pick(rng, cands) : node;
    const car = makeCar(spot.x, spot.y, Math.atan2(py - spot.y, px - spot.x), {
      driver: "cop",
      type: "police",
      color: "#e8e8e8",
    });
    car.siren = true;
    car.speed = 200;
    police.copCars.push(car);
    return car;
  }

  function spawnFootCopNear(px, py) {
    const a = chance(rng, 0.5) ? 0 : Math.PI;
    const x = px + (chance(rng, 0.5) ? 260 : -260) * Math.cos(a);
    const y = py + (chance(rng, 0.5) ? 260 : -260) * Math.sin(a);
    const cop = {
      x: Math.max(20, Math.min(3580, x)),
      y: Math.max(20, Math.min(2580, y)),
      angle: 0,
      hold: 0,
      speed: WANTED.footCopSpeed,
    };
    police.footCops.push(cop);
    return cop;
  }

  // Keep the right number of units for the wanted level.
  function maintain(state) {
    const wantCars = Math.min(state.wanted + 1, WANTED.maxCopCars);
    while (police.copCars.length < wantCars && state.wanted > 0) {
      spawnCopCarNear(state.player.x, state.player.y);
    }
    while (police.copCars.length > wantCars) police.copCars.pop();
    const wantFoot = state.player.inCar ? 0 : Math.min(state.wanted, WANTED.maxFootCops);
    while (police.footCops.length < wantFoot && state.wanted > 0) {
      spawnFootCopNear(state.player.x, state.player.y);
    }
    while (police.footCops.length > wantFoot) police.footCops.pop();
  }

  function clearAll(state) {
    police.copCars.length = 0;
    police.footCops.length = 0;
    state.wanted = 0;
    state.wantedTimer = 0;
  }

  function step(state, dt) {
    const player = state.player;
    // Wanted decay: one star per 26 s with no crime and no cop within 500px.
    if (state.wanted > 0) {
      state.wantedTimer += dt;
      let copNear = false;
      for (const c of police.copCars) {
        if (Math.hypot(c.x - player.x, c.y - player.y) < WANTED.copNearDist) copNear = true;
      }
      for (const c of police.footCops) {
        if (Math.hypot(c.x - player.x, c.y - player.y) < WANTED.copNearDist) copNear = true;
      }
      if (!copNear && state.wantedTimer >= WANTED.decaySeconds) {
        state.wanted -= 1;
        state.wantedTimer = 0;
        if (state.wanted === 0) {
          police.copCars.length = 0;
          police.footCops.length = 0;
        }
      }
    } else {
      state.wantedTimer = 0;
    }

    maintain(state);

    // Cop cars: road graph when far, direct ram when close.
    const playerNode = world.nearestNode(player.x, player.y);
    for (const cop of police.copCars) {
      const dist = Math.hypot(player.x - cop.x, player.y - cop.y);
      if (dist > WANTED.ramDist) {
        // Drive toward the player's intersection on the graph.
        const copNode = world.nearestNode(cop.x, cop.y);
        let target = playerNode;
        if (copNode !== playerNode) {
          // Step one node closer along the avenue/street grid.
          const dx = playerNode.x - copNode.x;
          const dy = playerNode.y - copNode.y;
          let nx = copNode.x;
          let ny = copNode.y;
          if (Math.abs(dx) > Math.abs(dy)) nx += Math.sign(dx) * 400;
          else ny += Math.sign(dy) * 400;
          const stepped = world.nodeAt(nx, ny);
          if (stepped !== undefined) target = stepped;
        }
        const cmd = driveToward(cop, target.x, target.y);
        driveCar(cop, dt, cmd.throttle, cmd.steer, false, (x, y, m) => world.blocked(x, y, m));
      } else {
        const cmd = driveToward(cop, player.x, player.y);
        driveCar(cop, dt, 1, cmd.steer, false, (x, y, m) => world.blocked(x, y, m));
      }
      if (cop.speed > CAR.copSpeed) cop.speed = CAR.copSpeed;
    }

    // Foot cops: run at the on-foot player; hold 1.4 s to bust.
    let busted = false;
    for (const cop of police.footCops) {
      const dx = player.x - cop.x;
      const dy = player.y - cop.y;
      const d = Math.hypot(dx, dy);
      cop.angle = Math.atan2(dy, dx);
      if (d > 26) {
        const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
        const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
        if (!world.blocked(nx, cop.y, 6)) cop.x = nx;
        if (!world.blocked(cop.x, ny, 6)) cop.y = ny;
        cop.hold = 0;
      } else {
        cop.hold += dt;
        if (cop.hold >= WANTED.holdSeconds) busted = true;
      }
    }
    return { busted };
  }

  return { police, maintain, clearAll, step, spawnCopCarNear, spawnFootCopNear };
}

export function addWanted(state, n, reason) {
  state.wanted = Math.min(WANTED.maxStars, state.wanted + n);
  state.wantedTimer = 0;
  state.lastCrime = reason || "";
}

export function crimeText(reason) {
  const map = {
    steal: "Grand theft auto — the law is coming",
    ped: "Pedestrian down — the law is coming",
    shoot: "Shots fired — the law is coming",
    cop: "Officer down — the whole city is coming",
  };
  return map[reason] || "The law is coming";
}
