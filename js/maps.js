'use strict';
/* ====== NEON PARADOX — Arenen (Hindernisse, Gefahrenfelder, Wurmlöcher) und Anomalien ======
   Alle Arenen sind punktsymmetrisch zur Mitte, damit Spiegel-Echos und der Chronoklon
   nie in einem Hindernis landen. */
const circ = (x, y, r) => ({ k: 0, x, y, r });
const box = (x0, y0, x1, y1) => ({ k: 1, x0, y0, x1, y1 });

const MAPS = {
  grid: {
    name: 'RASTER', desc: 'Die klassische, offene Arena ohne Hindernisse.',
    grid: [0.045, 0.075, 0.27], wall: [0.22, 0.5, 1.0], obs: [],
  },
  pillars: {
    name: 'SÄULENHALLE', desc: 'Sechs Energiesäulen blockieren Schiffe und Geschosse. Perfekte Deckung – für beide Seiten.',
    grid: [0.13, 0.045, 0.2], wall: [0.9, 0.3, 0.95],
    obs: [circ(CX - 520, CY - 270, 64), circ(CX + 520, CY + 270, 64), circ(CX + 520, CY - 270, 64), circ(CX - 520, CY + 270, 64),
      circ(CX - 860, CY, 56), circ(CX + 860, CY, 56)],
  },
  cross: {
    name: 'KREUZUNG', desc: 'Vier Blöcke zerteilen die Arena in Korridore. Wer in der Mitte steht, wird von allen Seiten bedrängt.',
    grid: [0.03, 0.13, 0.16], wall: [0.25, 1.0, 0.75],
    obs: [box(CX - 640, CY - 430, CX - 210, CY - 175), box(CX + 210, CY - 430, CX + 640, CY - 175),
      box(CX - 640, CY + 175, CX - 210, CY + 430), box(CX + 210, CY + 175, CX + 640, CY + 430)],
  },
  blocks: {
    name: 'KAMMERN', desc: 'Sechs Würfel bilden enge Kammern. Ideal für Abpraller – gefährlich gegen Lanzen.',
    grid: [0.15, 0.1, 0.03], wall: [1.0, 0.72, 0.25],
    obs: [box(CX - 640, CY - 380, CX - 480, CY - 220), box(CX - 80, CY - 380, CX + 80, CY - 220), box(CX + 480, CY - 380, CX + 640, CY - 220),
      box(CX - 640, CY + 220, CX - 480, CY + 380), box(CX - 80, CY + 220, CX + 80, CY + 380), box(CX + 480, CY + 220, CX + 640, CY + 380)],
  },
  reactor: {
    name: 'REAKTOR', desc: 'Ein Kern in der Mitte – und Plasmafelder, die im Takt zünden. Sie treffen Gegner und dich.',
    grid: [0.17, 0.05, 0.04], wall: [1.0, 0.4, 0.2], hazards: true,
    spawn: [CX, CY + 340], home: [CX, CY - 360],
    obs: [circ(CX, CY, 150)],
  },
  rift: {
    name: 'RISS', desc: 'Zwei Wurmloch-Paare verbinden die Ecken. Fliegst du hinein, kommst du auf der anderen Seite heraus.',
    grid: [0.08, 0.04, 0.2], wall: [0.6, 0.45, 1.0],
    bossAt: [CX - 520, CY],
    obs: [box(CX - 90, 150, CX + 90, 420), box(CX - 90, ARENA_H - 420, CX + 90, ARENA_H - 150)],
    portals: [[330, 270, ARENA_W - 330, ARENA_H - 270], [ARENA_W - 330, 270, 330, ARENA_H - 270]],
  },
};
const MAP_ORDER = ['grid', 'pillars', 'cross', 'blocks', 'reactor', 'rift'];
for (const id in MAPS) MAPS[id].id = id;

/** Aktiviert eine Arena: Farben, Gitter-Maske, Startpunkt. */
function setMap(id) {
  const M = MAPS[id] || MAPS.grid;
  G.map = M;
  COL.wall = M.wall;
  Grid.setTheme(M.grid);
  Grid.setMask((x, y) => mapBlocked(x, y, -6));
  G.hazT = 4; G.stormT = 2;
}
const mapSpawn = () => G.map.spawn || [CX, CY];

/** Liegt der Kreis (x, y, r) in einem Hindernis? (r < 0 prüft nur das Innere) */
function mapBlocked(x, y, r) {
  const obs = G.map ? G.map.obs : null;
  if (!obs) return false;
  for (let i = 0; i < obs.length; i++) {
    const b = obs[i];
    if (b.k === 0) {
      const dx = x - b.x, dy = y - b.y, rr = b.r + r;
      if (rr > 0 && dx * dx + dy * dy < rr * rr) return true;
    } else if (x > b.x0 - r && x < b.x1 + r && y > b.y0 - r && y < b.y1 + r) return true;
  }
  return false;
}

/** Schiebt ein Objekt aus allen Hindernissen heraus. Gibt die Normale in OBS_N zurück. */
const OBS_N = [0, 0];
function obsResolve(o, r) {
  const obs = G.map.obs;
  let hit = false;
  for (let i = 0; i < obs.length; i++) {
    const b = obs[i];
    if (b.k === 0) {
      const dx = o.x - b.x, dy = o.y - b.y, rr = b.r + r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2), nx = d > 0.01 ? dx / d : 1, ny = d > 0.01 ? dy / d : 0;
      o.x = b.x + nx * rr; o.y = b.y + ny * rr; OBS_N[0] = nx; OBS_N[1] = ny; hit = true;
    } else {
      const cx = clamp(o.x, b.x0, b.x1), cy = clamp(o.y, b.y0, b.y1);
      let dx = o.x - cx, dy = o.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        o.x = cx + dx * r; o.y = cy + dy * r; OBS_N[0] = dx; OBS_N[1] = dy;
      } else {                           // Mittelpunkt im Block: auf kürzestem Weg hinaus
        const l = o.x - b.x0, rg = b.x1 - o.x, t = o.y - b.y0, bt = b.y1 - o.y, m = Math.min(l, rg, t, bt);
        if (m === l) { o.x = b.x0 - r; OBS_N[0] = -1; OBS_N[1] = 0; }
        else if (m === rg) { o.x = b.x1 + r; OBS_N[0] = 1; OBS_N[1] = 0; }
        else if (m === t) { o.y = b.y0 - r; OBS_N[0] = 0; OBS_N[1] = -1; }
        else { o.y = b.y1 + r; OBS_N[0] = 0; OBS_N[1] = 1; }
      }
      hit = true;
    }
  }
  return hit;
}

/** Hindernis-Kollision inkl. Geschwindigkeit: abprallen (bouncy) oder entlanggleiten. */
function obsCollide(o, r, bouncy) {
  if (!G.map.obs.length || !obsResolve(o, r)) return false;
  const nx = OBS_N[0], ny = OBS_N[1], vn = o.vx * nx + o.vy * ny;
  if (vn < 0) { const k = bouncy ? 2 : 1; o.vx -= k * vn * nx; o.vy -= k * vn * ny; }
  return true;
}

/** Strahl ab (x, y) in Richtung (dx, dy): Länge bis zum ersten Hindernis (höchstens max). */
function rayLen(x, y, dx, dy, max) {
  const obs = G.map ? G.map.obs : null;
  let best = max;
  if (!obs) return best;
  for (let i = 0; i < obs.length; i++) {
    const b = obs[i];
    if (b.k === 0) {
      const ox = x - b.x, oy = y - b.y, bq = ox * dx + oy * dy, c = ox * ox + oy * oy - b.r * b.r;
      if (c < 0) continue;
      const disc = bq * bq - c;
      if (disc < 0) continue;
      const t = -bq - Math.sqrt(disc);
      if (t > 0 && t < best) best = t;
    } else {
      let t0 = 0, t1 = best;
      if (Math.abs(dx) < 1e-6) { if (x < b.x0 || x > b.x1) continue; }
      else {
        let a = (b.x0 - x) / dx, c = (b.x1 - x) / dx;
        if (a > c) { const s = a; a = c; c = s; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, c);
        if (t0 > t1) continue;
      }
      if (Math.abs(dy) < 1e-6) { if (y < b.y0 || y > b.y1) continue; }
      else {
        let a = (b.y0 - y) / dy, c = (b.y1 - y) / dy;
        if (a > c) { const s = a; a = c; c = s; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, c);
        if (t0 > t1) continue;
      }
      if (t0 > 0 && t0 < best) best = t0;
    }
  }
  return best;
}

/** Wurmlöcher: der Spieler wird zum Partner-Portal versetzt. */
function updatePortals(dt) {
  const P2 = G.map.portals, p = G.player;
  if (!P2 || !p.alive) return;
  p.portCd = (p.portCd || 0) - dt;
  if (p.portCd > 0) return;
  for (const q of P2) {
    for (let s = 0; s < 2; s++) {
      const ax = s ? q[2] : q[0], ay = s ? q[3] : q[1], bx = s ? q[0] : q[2], by = s ? q[1] : q[3];
      const dx = p.x - ax, dy = p.y - ay;
      if (dx * dx + dy * dy > 40 * 40) continue;
      let vx = p.vx, vy = p.vy, l = Math.sqrt(vx * vx + vy * vy);
      if (l < 40) { vx = CX - bx; vy = CY - by; l = Math.sqrt(vx * vx + vy * vy); }
      ring(p.x, p.y, 10, 120, 0.35, COL.magenta, 3);
      Particles.burst(p.x, p.y, 26, COL.magenta, 80, 420, 0.2, 0.5, 2);
      p.x = bx + (vx / l) * 72; p.y = by + (vy / l) * 72;
      p.trail.length = 0; p.portCd = 0.6;
      ring(p.x, p.y, 120, 10, 0.35, COL.nova, 3);
      Particles.burst(p.x, p.y, 26, COL.nova, 80, 420, 0.2, 0.5, 2);
      Grid.blast(p.x, p.y, 14, 220);
      Sfx.zap();
      return;
    }
  }
}

/** Zeitgesteuerte Gefahren: Plasmafelder (Reaktor) und Ionensturm (Anomalie). */
function updateMapFx(dt) {
  if (G.demo || G.state !== 'playing' || G.loopT < 2) return;
  const p = G.player;
  if (G.map.hazards) {
    G.hazT -= dt;
    if (G.hazT <= 0) {
      G.hazT = rand(5.5, 7.5);
      const n = 2 + (G.eff >= 6 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        let x, y, g = 0;
        do {
          if (k === 0) { x = p.x + rand(-140, 140); y = p.y + rand(-140, 140); }
          else { x = rand(140, ARENA_W - 140); y = rand(140, ARENA_H - 140); }
        } while (mapBlocked(x, y, 40) && g++ < 12);
        G.blasts.push({ x, y, r: 125, dmg: 90 * G.hpMul, t: 1.5, max: 1.5, hurt: true, col: [1.0, 0.45, 0.15], dead: false });
      }
    }
  }
  if (G.anom === 'storm') {
    G.stormT -= dt;
    if (G.stormT <= 0) {
      G.stormT = rand(0.9, 1.6);
      const near = Math.random() < 0.45;
      const x = near ? p.x + rand(-170, 170) : rand(80, ARENA_W - 80), y = near ? p.y + rand(-170, 170) : rand(80, ARENA_H - 80);
      G.blasts.push({ x: clamp(x, 60, ARENA_W - 60), y: clamp(y, 60, ARENA_H - 60), r: 95, dmg: 70 * G.hpMul, t: 1.15, max: 1.15, hurt: true, col: [0.6, 0.8, 1.6], dead: false, zap: true });
    }
  }
}

function drawMap(beat) {
  const M = G.map;
  if (!M) return;
  const c = M.wall, k = 1.25 + beat * 0.7, t = G.realT;
  for (const b of M.obs) {
    if (b.k === 0) {
      R.ring(b.x, b.y, b.r, 3, c[0] * k, c[1] * k, c[2] * k, 1, 40);
      R.ring(b.x, b.y, b.r * 0.74, 1.4, c[0], c[1], c[2], 0.55, 32);
      R.ring(b.x, b.y, b.r * (0.3 + 0.12 * Math.sin(t * 2 + b.x)), 1.2, c[0], c[1], c[2], 0.45, 20);
      R.dot(b.x, b.y, b.r * 0.9, c[0] * 0.25, c[1] * 0.25, c[2] * 0.25, 0.8);
      if (M.hazards) R.ring(b.x, b.y, b.r + 18 + 8 * Math.sin(t * 3), 1.4, 1.0, 0.5, 0.2, 0.35 + 0.2 * Math.sin(t * 3), 44);
    } else {
      const { x0, y0, x1, y1 } = b;
      R.line(x0, y0, x1, y0, 3, c[0] * k, c[1] * k, c[2] * k, 1);
      R.line(x1, y0, x1, y1, 3, c[0] * k, c[1] * k, c[2] * k, 1);
      R.line(x1, y1, x0, y1, 3, c[0] * k, c[1] * k, c[2] * k, 1);
      R.line(x0, y1, x0, y0, 3, c[0] * k, c[1] * k, c[2] * k, 1);
      const i = 10;
      R.line(x0 + i, y0 + i, x1 - i, y0 + i, 1.2, c[0], c[1], c[2], 0.45);
      R.line(x1 - i, y0 + i, x1 - i, y1 - i, 1.2, c[0], c[1], c[2], 0.45);
      R.line(x1 - i, y1 - i, x0 + i, y1 - i, 1.2, c[0], c[1], c[2], 0.45);
      R.line(x0 + i, y1 - i, x0 + i, y0 + i, 1.2, c[0], c[1], c[2], 0.45);
      for (let y = y0 + 26; y < y1 - 14; y += 22) R.line(x0 + 18, y, x1 - 18, y, 1, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 0.5);
    }
  }
  if (M.portals) {
    for (const q of M.portals) {
      for (let s = 0; s < 2; s++) {
        const x = q[s * 2], y = q[s * 2 + 1], col = s ? COL.nova : COL.magenta;
        R.ring(x, y, 40, 2.4, col[0] * 1.6, col[1] * 1.6, col[2] * 1.6, 1, 32);
        for (let j = 0; j < 3; j++) {
          const a = t * (2.4 + j * 0.7) * (s ? -1 : 1) + j * 2.1;
          R.ring(x, y, 14 + j * 9, 1.2, col[0], col[1], col[2], 0.5, 6 + j * 2);
          R.dot(x + Math.cos(a) * 30, y + Math.sin(a) * 30, 4, col[0] * 1.5, col[1] * 1.5, col[2] * 1.5, 0.9);
        }
      }
    }
  }
}

// ---------------------------------------------------------------- Anomalien (Sonderregeln für einzelne Loops)
const ANOMALIES = {
  gold: { name: 'GOLDRAUSCH', desc: 'Doppelte Splitter · Punkte ×1,5', score: 1.5 },
  elite: { name: 'ELITE-WELLE', desc: 'Viele Elite-Gegner · Punkte ×1,5', score: 1.5 },
  rush: { name: 'ANSTURM', desc: '+45 % Gegner · Punkte ×1,4', score: 1.4 },
  storm: { name: 'IONENSTURM', desc: 'Blitze schlagen ein – auch neben dir · Punkte ×1,3', score: 1.3 },
  dark: { name: 'FINSTERNIS', desc: 'Nur du und deine Echos leuchten · Punkte ×1,4', score: 1.4 },
  supply: { name: 'NACHSCHUB', desc: 'Reparaturkits und halbe Nova-Ladung', score: 1 },
  haste: { name: 'ÜBERTAKTUNG', desc: 'Alles 20 % schneller, du feuerst 25 % schneller · Punkte ×1,3', score: 1.3 },
};
const ANOM_ORDER = ['gold', 'elite', 'rush', 'storm', 'dark', 'supply', 'haste'];

/** Wählt die Anomalie für Loop n (oder keine). */
function rollAnomaly(n) {
  if (G.demo || G.bossLoop) return null;
  const r = G.run;
  if (r.mode === 'campaign') return r.level.anom || null;
  if ((r.mode === 'paradox' || r.mode === 'daily') && n >= 3 && Math.random() < 0.6) {
    let a = pick(ANOM_ORDER);
    if (a === G.lastAnom) a = pick(ANOM_ORDER);
    return a;
  }
  return null;
}

G.map = MAPS.grid;
