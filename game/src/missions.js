// Solmar — the story chain (6 missions, sequential) and the taxi side job.
// A mission is a list of stages; each stage is a goto, a fare run, a heat
// hold, or a steal. Timers run on delivery stages; running out fails the
// mission and the briefing comes back.

import { MISSIONS, TAXI } from "./config.js";
import { nearestFare, spawnFare } from "./pedestrians.js";

export function createMissions(world, rng) {
  const missions = {
    index: 0, // which mission is current; 6 = story complete
    active: false,
    stage: 0,
    timer: 0,
    heatHold: 0,
    faresDone: 0,
    fare: null, // the ped currently riding (taxi job or Night Shift)
    fareFrom: null,
    marker: null, // {x, y, label} drawn on the map and minimap
    objective: "",
    failed: false,
    done: false,
  };

  function currentDef() {
    return MISSIONS[missions.index] || null;
  }

  function setObjective(text) {
    missions.objective = text;
  }

  function setMarker(x, y, label) {
    missions.marker = { x, y, label };
  }

  function startStage(state) {
    const def = currentDef();
    if (!def) return;
    const stage = def.stages[missions.stage];
    if (!stage) return;
    if (stage.type === "goto" || stage.type === "steal") {
      setMarker(stage.x, stage.y, stage.label);
      setObjective(stage.label + (stage.timer ? " — " + stage.timer + "s" : ""));
      missions.timer = stage.timer || 0;
    } else if (stage.type === "fares") {
      missions.faresDone = 0;
      setObjective("Taxi fares: 0/" + stage.count);
      setMarker(null, null, null);
      missions.marker = null;
      spawnNextFare(state);
    } else if (stage.type === "heat") {
      setObjective("Reach " + stage.stars + " stars");
      missions.marker = null;
      missions.heatHold = 0;
    }
  }

  function spawnNextFare(state) {
    const ped = spawnFare(world, rng, state.peds);
    missions.fare = { ped, pickedUp: false, from: null };
    setMarker(ped.x, ped.y, "Fare — pick up");
    setObjective("Pick up the fare");
  }

  function begin(state, index) {
    missions.index = index;
    missions.stage = 0;
    missions.active = true;
    missions.failed = false;
    missions.done = false;
    missions.fare = null;
    const def = currentDef();
    if (def && def.wantedAtStart) {
      state.wanted = Math.max(state.wanted, def.wantedAtStart);
      state.wantedTimer = 0;
    }
    startStage(state);
    return def;
  }

  function fail(state) {
    missions.active = false;
    missions.failed = true;
    missions.fare = null;
    missions.marker = null;
    setObjective("");
    state.toast = "Mission failed — try it again";
  }

  function complete(state) {
    const def = currentDef();
    if (!def) return;
    state.cash += def.reward;
    state.toast = "Mission complete — +$" + def.reward;
    state.sfx = state.sfx || [];
    state.sfx.push("mission");
    missions.index += 1;
    missions.stage = 0;
    missions.active = false;
    missions.fare = null;
    missions.marker = null;
    if (missions.index >= MISSIONS.length) {
      missions.done = true;
      state.storyComplete = true;
    } else {
      begin(state, missions.index);
      state.showBriefing = true;
    }
  }

  function advanceStage(state) {
    missions.stage += 1;
    const def = currentDef();
    if (missions.stage >= def.stages.length) {
      complete(state);
    } else {
      startStage(state);
    }
  }

  // Taxi pickup: T beside a waving fare while in a car.
  function tryPickupFare(state) {
    if (!state.player.inCar) return false;
    const ped = nearestFare(state.peds, state.player.x, state.player.y, 70);
    if (!ped) return false;
    if (missions.active && missions.fare && missions.fare.ped === ped) {
      // Mission fare: handled by the mission step.
      return false;
    }
    // Free-roam side job fare.
    state.taxi = { ped, from: { x: ped.x, y: ped.y }, pickedUp: true };
    ped.fare = false;
    state.toast = "Fare aboard — take them to the marker";
    setMarker(ped.dest.x, ped.dest.y, "Drop-off");
    return true;
  }

  function step(state, dt) {
    if (!missions.active) return;
    const def = currentDef();
    if (!def) return;
    const stage = def.stages[missions.stage];
    const p = state.player;

    if (stage.type === "goto" || stage.type === "steal") {
      if (stage.timer) {
        missions.timer -= dt;
        const mins = Math.max(0, Math.ceil(missions.timer));
        setObjective(stage.label + " — " + mins + "s");
        if (missions.timer <= 0) {
          fail(state);
          return;
        }
      }
      const d = Math.hypot(p.x - stage.x, p.y - stage.y);
      if (d <= stage.r) {
        if (stage.type === "steal") {
          // The Comet GT must be entered, not just approached.
          if (p.inCar && p.car && p.car.type === "comet") advanceStage(state);
          else state.prompt = "E — Steal the Comet GT";
        } else {
          state.toast = stage.label + " reached";
          advanceStage(state);
        }
      }
    } else if (stage.type === "fares") {
      // Night Shift: run `count` fares with the shared taxi flow.
      const f = missions.fare;
      if (!f) return;
      if (!f.pickedUp) {
        const d = Math.hypot(p.x - f.ped.x, p.y - f.ped.y);
        if (d < 70 && p.inCar) {
          f.pickedUp = true;
          f.from = { x: f.ped.x, y: f.ped.y };
          f.ped.fare = false;
          setMarker(f.ped.dest.x, f.ped.dest.y, "Drop-off");
          setObjective("Drop the fare off");
          state.toast = "Fare aboard";
        } else if (d < 90) {
          state.prompt = "T — Pick up the fare";
        }
      } else {
        const d = Math.hypot(p.x - f.ped.dest.x, p.y - f.ped.dest.y);
        if (d < 80) {
          const distPx = Math.hypot(f.ped.dest.x - f.from.x, f.ped.dest.y - f.from.y);
          const pay = 45 + Math.round((distPx / TAXI.pxPerMetre) * TAXI.perMetre);
          state.cash += pay;
          state.toast = "Fare paid — +$" + pay;
          missions.faresDone += 1;
          if (missions.faresDone >= stage.count) {
            advanceStage(state);
          } else {
            setObjective("Taxi fares: " + missions.faresDone + "/" + stage.count);
            spawnNextFare(state);
          }
        }
      }
    } else if (stage.type === "heat") {
      if (state.wanted >= stage.stars) {
        missions.heatHold += dt;
        const left = Math.max(0, Math.ceil(stage.hold - missions.heatHold));
        setObjective("Stay free — " + left + "s");
        if (missions.heatHold >= stage.hold) advanceStage(state);
      } else {
        missions.heatHold = 0;
        setObjective("Reach " + stage.stars + " stars");
      }
    }
  }

  // Free-roam taxi drop-off (not a mission fare).
  function stepTaxi(state) {
    const taxi = state.taxi;
    if (!taxi || !taxi.pickedUp) return;
    const p = state.player;
    const d = Math.hypot(p.x - taxi.ped.dest.x, p.y - taxi.ped.dest.y);
    if (d < 80) {
      const distPx = Math.hypot(taxi.ped.dest.x - taxi.from.x, taxi.ped.dest.y - taxi.from.y);
      const pay = TAXI.baseFare + Math.round((distPx / TAXI.pxPerMetre) * TAXI.perMetre);
      state.cash += pay;
      state.toast = "Fare paid — +$" + pay;
      state.faresDone = (state.faresDone || 0) + 1;
      state.taxi = null;
      missions.marker = null;
    }
  }

  return {
    missions,
    currentDef,
    begin,
    fail,
    complete,
    step,
    stepTaxi,
    tryPickupFare,
    spawnNextFare,
  };
}
