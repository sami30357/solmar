// Solmar — drawing only: camera, city, cars, peds, HUD and minimap.
// The canvas is a fixed 1280x720 logical area scaled to the window.
// Health and armour are 0..1 fractions — the bars and the low-health
// vignette use them as fractions, never as 0..100.

import { BEACH, CAR, PALETTE, ROADS, WORLD } from "./config.js";

export const VIEW = { w: 1280, h: 720 };

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    canvas.width = w;
    canvas.height = h;
    view.scale = Math.min(w / VIEW.w, h / VIEW.h);
    view.x = (w - VIEW.w * view.scale) / 2;
    view.y = (h - VIEW.h * view.scale) / 2;
  }

  function font(size, bold) {
    const key = size + (bold ? "b" : "");
    if (!fonts.has(key)) fonts.set(key, (bold ? "bold " : "") + size + "px system-ui, sans-serif");
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align, bold) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align || "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(value, x, y);
  }

  function pill(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function isNight(clock) {
    return clock < 7 * 60 || clock >= 19 * 60;
  }
  function isDusk(clock) {
    return clock >= 17 * 60 && clock < 19 * 60;
  }

  function clockText(clock) {
    const h = Math.floor(clock / 60) % 24;
    const m = Math.floor(clock % 60);
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function drawWorld(S) {
    const world = S.world;
    const cam = S.camera;
    const x0 = cam.x - 40;
    const y0 = cam.y - 40;
    const x1 = cam.x + VIEW.w + 40;
    const y1 = cam.y + VIEW.h + 40;

    // Ground: grass, then sand, then sea.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, x1 - x0, Math.min(y1, BEACH.sandTop) - y0);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(x0, BEACH.sandTop, x1 - x0, BEACH.sandBottom - BEACH.sandTop);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(x0, BEACH.seaTop, x1 - x0, y1 - BEACH.seaTop);
    ctx.fillStyle = PALETTE.seaDeep;
    for (let wy = BEACH.seaTop + 40; wy < y1; wy += 120) {
      ctx.fillRect(x0, wy, x1 - x0, 6);
    }

    // Parks.
    for (const p of world.parks) {
      if (p.x > x1 || p.x + p.w < x0 || p.y > y1 || p.y + p.h < y0) continue;
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    // Roads: avenues then streets, with centre dashes.
    ctx.fillStyle = PALETTE.road;
    for (const ax of ROADS.avenues) ctx.fillRect(ax - ROADS.half, 0, ROADS.width, BEACH.sandTop);
    for (const sy of ROADS.streets) ctx.fillRect(0, sy - ROADS.half, WORLD.w, ROADS.width);
    ctx.fillStyle = PALETTE.sidewalk;
    for (const ax of ROADS.avenues) {
      ctx.fillRect(ax - ROADS.half - 10, 0, 10, BEACH.sandTop);
      ctx.fillRect(ax + ROADS.half, 0, 10, BEACH.sandTop);
    }
    ctx.fillStyle = PALETTE.roadLine;
    for (const ax of ROADS.avenues) {
      for (let y = 60; y < BEACH.sandTop; y += 80) {
        if (y < y0 || y > y1) continue;
        ctx.fillRect(ax - 2, y, 4, 34);
      }
    }
    for (const sy of ROADS.streets) {
      for (let x = 60; x < WORLD.w; x += 80) {
        if (x < x0 || x > x1) continue;
        ctx.fillRect(x, sy - 2, 34, 4);
      }
    }

    // Port containers.
    for (const c of world.containers) {
      if (c.x > x1 || c.x + c.w < x0 || c.y > y1 || c.y + c.h < y0) continue;
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(c.x, c.y, c.w, 8);
      ctx.fillRect(c.x, c.y + 36, c.w, 4);
      ctx.fillRect(c.x, c.y + 72, c.w, 4);
    }

    // Buildings: roof, edge, height shadow; neon edges downtown at night.
    const night = isNight(S.clock) || isDusk(S.clock);
    for (const b of world.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(b.x + b.height * 0.35, b.y + b.height * 0.35, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = PALETTE.buildingEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 8);
      if (b.neon && night) {
        ctx.strokeStyle = Math.floor(S.time * 2) % 2 ? PALETTE.neonPink : PALETTE.neonCyan;
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
      }
    }

    // Palms: trunk + fronds.
    for (const p of world.palms) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      ctx.strokeStyle = "#7a5230";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 3, p.y - 16);
      ctx.stroke();
      ctx.fillStyle = PALETTE.palm;
      for (let f = 0; f < 5; f += 1) {
        const a = (f / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(p.x + 3 + Math.cos(a) * 10, p.y - 16 + Math.sin(a) * 7, 12, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawMissionMarker(S, x0, y0, x1, y1);
  }

  function drawMissionMarker(S, x0, y0, x1, y1) {
    const m = S.missions.marker;
    if (!m) return;
    if (m.x < x0 || m.x > x1 || m.y < y0 || m.y > y1) return;
    const pulse = 1 + Math.sin(S.time * 5) * 0.15;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "#ffe14d";
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(18, 0);
    ctx.lineTo(0, 26);
    ctx.lineTo(-18, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#20242e";
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 16);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    text(m.label, m.x, m.y - 34, 15, "#ffe14d", "center", true);
  }

  function drawPed(S, ped) {
    const bob = Math.sin(ped.bob) * 2;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 10, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob * 0.3, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2c9a0";
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y - 8 + bob * 0.3, 5, 0, Math.PI * 2);
    ctx.fill();
    if (ped.fare) {
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath();
      ctx.arc(ped.x, ped.y - 30 + Math.sin(S.time * 6) * 3, 11, 0, Math.PI * 2);
      ctx.fill();
      text("!", ped.x, ped.y - 26 + Math.sin(S.time * 6) * 3, 15, "#20242e", "center", true);
    }
  }

  function drawCar(S, car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = "rgba(20,28,40,0.85)";
    ctx.beginPath();
    ctx.roundRect(-8, -CAR.width / 2 + 4, 18, CAR.width - 8, 4);
    ctx.fill();
    ctx.fillStyle = "#cfe8ff";
    ctx.fillRect(8, -CAR.width / 2 + 5, 4, CAR.width - 10);
    // Headlights.
    ctx.fillStyle = "#fff6c8";
    ctx.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 2, 3, 5);
    ctx.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 7, 3, 5);
    // Brake lights.
    if (car.brakeLight) {
      ctx.fillStyle = "#ff2a2a";
      ctx.fillRect(-CAR.length / 2, -CAR.width / 2 + 2, 3, 5);
      ctx.fillRect(-CAR.length / 2, CAR.width / 2 - 7, 3, 5);
    }
    if (car.type === "taxi") {
      ctx.fillStyle = "#20242e";
      ctx.fillRect(-4, -CAR.width / 2 + 2, 10, 6);
      text("TAXI", 0, -CAR.width / 2 - 4, 9, "#20242e", "center", true);
    }
    if (car.type === "police") {
      // Black-and-white cruiser: dark band across a white body, flashing light bar.
      ctx.fillStyle = "#20242e";
      ctx.fillRect(-CAR.length / 2 + 6, -4, CAR.length - 12, 8);
      const flash = Math.floor(S.time * 6) % 2 === 0;
      ctx.fillStyle = flash ? "#ff2a2a" : "#2a6aff";
      ctx.beginPath();
      ctx.arc(-4, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flash ? "#2a6aff" : "#ff2a2a";
      ctx.beginPath();
      ctx.arc(6, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (car.type === "comet") {
      ctx.fillStyle = "#ffd24d";
      ctx.fillRect(-CAR.length / 2 + 4, -3, 10, 6);
    }
    ctx.restore();
  }

  function drawPlayer(S) {
    const p = S.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (!p.inCar) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(0, 10, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(p.angle);
      // Mara: red jacket, dark jeans.
      ctx.fillStyle = "#c8283c";
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f2c9a0";
      ctx.beginPath();
      ctx.arc(6, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#20242e";
      ctx.fillRect(8, -3, 14, 6);
      ctx.restore();
      // Aim line.
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 34, p.y + Math.sin(p.angle) * 34);
      ctx.stroke();
    } else {
      ctx.restore();
    }
  }

  function drawCop(S, cop) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = "#20242e";
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a6fd8";
    ctx.beginPath();
    ctx.arc(5, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (cop.hold > 0) {
      ctx.fillStyle = "#ff4d4d";
      ctx.fillRect(cop.x - 16, cop.y - 26, 32 * (cop.hold / 1.4), 4);
    }
  }

  function drawBullets(S) {
    for (const b of S.bullets) {
      ctx.strokeStyle = "#ffe14d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - Math.cos(b.angle) * 12, b.y - Math.sin(b.angle) * 12);
      ctx.stroke();
    }
  }

  function drawHeadlights(S) {
    if (!isNight(S.clock) && !isDusk(S.clock)) return;
    const p = S.player;
    const cars = p.inCar && p.car ? [p.car] : S.police.copCars;
    for (const car of cars) {
      const cx = car.x + Math.cos(car.angle) * 60;
      const cy = car.y + Math.sin(car.angle) * 60;
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 190);
      grad.addColorStop(0, "rgba(255,244,180,0.20)");
      grad.addColorStop(1, "rgba(255,244,180,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 190, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawNightTint(S) {
    if (isNight(S.clock)) {
      ctx.fillStyle = "rgba(10,16,48,0.30)";
      ctx.fillRect(S.camera.x, S.camera.y, VIEW.w, VIEW.h);
    } else if (isDusk(S.clock)) {
      ctx.fillStyle = "rgba(255,120,40,0.12)";
      ctx.fillRect(S.camera.x, S.camera.y, VIEW.w, VIEW.h);
    }
  }

  function drawHud(S) {
    const cam = S.camera;
    ctx.save();
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Top-left: clock + radio.
    ctx.fillStyle = "rgba(16,18,26,0.72)";
    pill(14, 12, 210, 52, 10);
    ctx.fill();
    text(clockText(S.clock), 28, 36, 22, "#ffffff", "left", true);
    text(S.radioName, 28, 56, 13, "#9fb4d8", "left");

    // Top-centre: objective banner.
    if (S.missions.objective) {
      const label = (S.missionName ? S.missionName + " — " : "") + S.missions.objective;
      ctx.font = font(15, true);
      const w = Math.min(620, ctx.measureText(label).width + 36);
      ctx.fillStyle = "rgba(16,18,26,0.72)";
      pill(VIEW.w / 2 - w / 2, 12, w, 34, 10);
      ctx.fill();
      text(label, VIEW.w / 2, 35, 15, "#ffe14d", "center", true);
    }

    // Top-right: wanted stars + cash + district on a dark pill.
    const cashText = "$" + S.cash;
    const district = S.world.districtAt(S.player.x, S.player.y);
    ctx.font = font(15, true);
    const dw = ctx.measureText(district).width;
    const pillW = 150 + Math.max(0, dw - 60);
    ctx.fillStyle = "rgba(16,18,26,0.72)";
    pill(VIEW.w - 14 - pillW, 12, pillW, 52, 10);
    ctx.fill();
    // Wanted stars: filled gold for active stars, dim grey outlines for the rest.
    ctx.font = font(17, true);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    let starX = VIEW.w - 28 - pillW + 14;
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < S.wanted ? "#ffcf3d" : "#4a4f5e";
      ctx.fillText("★", starX, 34);
      starX += ctx.measureText("★").width + 2;
    }
    text(cashText, VIEW.w - 28, 34, 17, "#7dff8a", "right", true);
    text(district, VIEW.w - 28, 56, 13, "#9fb4d8", "right");

    // Bottom-left: circular minimap.
    drawMinimap(S);

    // Bottom-right: health/armour bars + speed or ammo.
    const bx = VIEW.w - 214;
    const by = VIEW.h - 74;
    ctx.fillStyle = "rgba(16,18,26,0.72)";
    pill(bx, by, 200, 60, 10);
    ctx.fill();
    text("HEALTH", bx + 12, by + 20, 11, "#9fb4d8", "left", true);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(bx + 70, by + 10, 118, 10);
    ctx.fillStyle = S.player.health < 0.35 ? "#ff4d4d" : "#4dd06a";
    ctx.fillRect(bx + 70, by + 10, 118 * Math.max(0, S.player.health), 10);
    text("ARMOUR", bx + 12, by + 40, 11, "#9fb4d8", "left", true);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(bx + 70, by + 30, 118, 10);
    ctx.fillStyle = "#6ab8ff";
    ctx.fillRect(bx + 70, by + 30, 118 * Math.max(0, S.player.armour), 10);
    if (S.player.inCar && S.player.car) {
      const kmh = Math.round(Math.abs(S.player.car.speed) * 0.36);
      text(kmh + " km/h", bx + 100, by + 58, 15, "#ffffff", "center", true);
    } else {
      text("Ammo " + S.player.ammo + " / 24", bx + 100, by + 58, 15, "#ffffff", "center", true);
    }

    // Bottom-centre: context prompt.
    if (S.prompt) {
      ctx.font = font(15, true);
      const w = ctx.measureText(S.prompt).width + 36;
      ctx.fillStyle = "rgba(16,18,26,0.78)";
      pill(VIEW.w / 2 - w / 2, VIEW.h - 44, w, 32, 10);
      ctx.fill();
      text(S.prompt, VIEW.w / 2, VIEW.h - 22, 15, "#ffffff", "center", true);
    }

    // Centre toast.
    if (S.toast && S.toastTimer > 0) {
      ctx.font = font(20, true);
      const w = ctx.measureText(S.toast).width + 40;
      ctx.fillStyle = "rgba(16,18,26,0.8)";
      pill(VIEW.w / 2 - w / 2, VIEW.h / 2 - 90, w, 40, 12);
      ctx.fill();
      text(S.toast, VIEW.w / 2, VIEW.h / 2 - 62, 20, "#ffe14d", "center", true);
    }

    // Red vignette when health is low (health is a 0..1 fraction).
    if (S.player.health < 0.35) {
      const a = (0.35 - S.player.health) * 1.4;
      const grad = ctx.createRadialGradient(VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.3, VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.75);
      grad.addColorStop(0, "rgba(255,0,0,0)");
      grad.addColorStop(1, "rgba(255,0,0," + Math.min(0.5, a).toFixed(2) + ")");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    }
    ctx.restore();
  }

  function drawMinimap(S) {
    const cx = 104;
    const cy = VIEW.h - 112;
    const r = 88;
    const scale = (r * 2) / WORLD.w;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(20,26,20,0.85)";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // Sea strip at the bottom of the map.
    ctx.fillStyle = "#2f7fb8";
    const seaY = cy - r + (BEACH.seaTop / WORLD.h) * r * 2;
    ctx.fillRect(cx - r, seaY, r * 2, r * 2);
    // Roads.
    ctx.strokeStyle = "#6a6a72";
    ctx.lineWidth = 3;
    for (const ax of ROADS.avenues) {
      const mx = cx - r + ax * scale;
      ctx.beginPath();
      ctx.moveTo(mx, cy - r);
      ctx.lineTo(mx, cy + r);
      ctx.stroke();
    }
    for (const sy of ROADS.streets) {
      const my = cy - r + sy * scale;
      ctx.beginPath();
      ctx.moveTo(cx - r, my);
      ctx.lineTo(cx + r, my);
      ctx.stroke();
    }
    function dot(x, y, color, size) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx - r + x * scale, cy - r + y * scale, size, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mission diamond.
    if (S.missions.marker) {
      const mx = cx - r + S.missions.marker.x * scale;
      const my = cy - r + S.missions.marker.y * scale;
      ctx.fillStyle = "#ffe14d";
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
    // Cop blips, flashing.
    if (Math.floor(S.time * 3) % 2 === 0) {
      for (const c of S.police.copCars) dot(c.x, c.y, "#ff4d4d", 3.5);
      for (const c of S.police.footCops) dot(c.x, c.y, "#ff4d4d", 3);
    }
    // Player arrow.
    const px = cx - r + S.player.x * scale;
    const py = cy - r + S.player.y * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(S.player.angle);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // Ring + district label underneath, inside the frame.
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    text(S.world.districtAt(S.player.x, S.player.y), cx, cy + r + 14, 12, "#ffffff", "center", true);
  }

  function draw(S) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0c0f16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const cam = S.camera;
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawWorld(S);
    for (const ped of S.peds) {
      if (!ped.dead) drawPed(S, ped);
    }
    for (const car of S.cars) drawCar(S, car);
    for (const cop of S.police.copCars) drawCar(S, cop);
    for (const cop of S.police.footCops) drawCop(S, cop);
    drawPlayer(S);
    drawBullets(S);
    drawHeadlights(S);
    drawNightTint(S);
    ctx.restore();
    if (S.screen === "playing" || S.screen === "paused") drawHud(S);
  }

  resize();
  window.addEventListener("resize", resize);
  return { draw, resize, view, clockText, isNight };
}
