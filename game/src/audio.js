// Solmar — WebAudio synth only: three radio stations (bass + arp step
// sequencer), engine hum by speed, a two-tone siren, and SFX. Nothing is
// loaded from anywhere; it all starts on the first gesture.

import { RADIO } from "./config.js";

export function createAudio() {
  const audio = {
    ctx: null,
    station: 0,
    stationOn: true,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenOn: false,
    step: 0,
    nextStepTime: 0,
    master: null,
    musicGain: null,
  };

  function ensure() {
    if (audio.ctx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.musicGain = audio.ctx.createGain();
      audio.musicGain.gain.value = 0.16;
      audio.musicGain.connect(audio.master);
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineGain.connect(audio.master);
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = "sawtooth";
      audio.engineOsc.frequency.value = 60;
      audio.engineOsc.connect(audio.engineGain);
      audio.engineOsc.start();
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenGain.connect(audio.master);
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = "sine";
      audio.sirenOsc.frequency.value = 700;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume();
  }

  // Minor-pentatonic steps per station, over the station root.
  const SCALES = [
    [0, 3, 5, 7, 10, 12, 15],
    [0, 2, 3, 5, 7, 8, 10, 12],
    [0, 3, 5, 7, 10, 12],
  ];
  const BASS_PATTERNS = [
    [0, -1, 0, -1, 7, -1, 5, -1],
    [0, 0, 7, 0, 5, 0, 3, 7],
    [0, -1, -1, 0, -1, 5, -1, -1],
  ];

  function note(freq, time, dur, type, gain, dest) {
    const osc = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g);
    g.connect(dest || audio.musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  function scheduleStep() {
    if (!audio.ctx || !audio.stationOn) return;
    const st = RADIO[audio.station];
    const stepDur = 60 / st.bpm / 2; // eighth notes
    while (audio.nextStepTime < audio.ctx.currentTime + 0.15) {
      const t = audio.nextStepTime;
      const s = audio.step % 8;
      const scale = SCALES[audio.station];
      const bassPat = BASS_PATTERNS[audio.station];
      const bassStep = bassPat[s];
      if (bassStep >= 0) {
        note(st.root * Math.pow(2, bassStep / 12), t, stepDur * 1.8, "sine", 0.5);
      }
      if (audio.step % 2 === 0) {
        const arp = scale[(audio.step * 3 + 2) % scale.length];
        note(st.root * 4 * Math.pow(2, arp / 12), t, stepDur * 0.9, st.wave, 0.12);
      }
      if (audio.step % 4 === 2) {
        // A soft hat tick: a very short high blip.
        note(6000, t, 0.03, "square", 0.03);
      }
      audio.step += 1;
      audio.nextStepTime += stepDur;
    }
  }

  function tick() {
    if (!audio.ctx) return;
    resume();
    scheduleStep();
  }

  function setEngine(speedFrac) {
    if (!audio.ctx) return;
    audio.engineGain.gain.setTargetAtTime(0.05 + speedFrac * 0.08, audio.ctx.currentTime, 0.1);
    audio.engineOsc.frequency.setTargetAtTime(55 + speedFrac * 160, audio.ctx.currentTime, 0.1);
  }

  function setSiren(on) {
    if (!audio.ctx) return;
    audio.sirenOn = on;
    audio.sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, audio.ctx.currentTime, 0.2);
    if (on) {
      const now = audio.ctx.currentTime;
      audio.sirenOsc.frequency.setValueAtTime(700, now);
      audio.sirenOsc.frequency.linearRampToValueAtTime(950, now + 0.4);
      audio.sirenOsc.frequency.linearRampToValueAtTime(700, now + 0.8);
    }
  }

  function sfx(name) {
    if (!ensure()) return;
    resume();
    const t0 = audio.ctx.currentTime;
    if (name === "shoot") {
      note(1800, t0, 0.08, "square", 0.2, audio.master);
      note(300, t0, 0.12, "sawtooth", 0.15, audio.master);
    } else if (name === "punch") {
      note(140, t0, 0.1, "sine", 0.3, audio.master);
    } else if (name === "crash") {
      note(90, t0, 0.25, "sawtooth", 0.3, audio.master);
      note(60, t0 + 0.05, 0.3, "sine", 0.25, audio.master);
    } else if (name === "pickup") {
      note(660, t0, 0.1, "sine", 0.2, audio.master);
      note(880, t0 + 0.09, 0.14, "sine", 0.2, audio.master);
    } else if (name === "cash") {
      note(990, t0, 0.08, "triangle", 0.2, audio.master);
      note(1320, t0 + 0.08, 0.16, "triangle", 0.2, audio.master);
    } else if (name === "busted") {
      note(440, t0, 0.2, "sawtooth", 0.2, audio.master);
      note(330, t0 + 0.2, 0.3, "sawtooth", 0.2, audio.master);
    } else if (name === "mission") {
      [523, 659, 784, 1047].forEach((f, i) => note(f, t0 + i * 0.11, 0.18, "triangle", 0.22, audio.master));
    }
  }

  function cycleStation() {
    audio.station = (audio.station + 1) % RADIO.length;
    audio.step = 0;
    if (audio.ctx) audio.nextStepTime = audio.ctx.currentTime + 0.05;
    return RADIO[audio.station].name;
  }

  function stationName() {
    return RADIO[audio.station].name;
  }

  return {
    audio,
    ensure,
    resume,
    tick,
    setEngine,
    setSiren,
    sfx,
    cycleStation,
    stationName,
  };
}
