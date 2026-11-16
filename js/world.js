'use strict';
/* ====== NEON PARADOX — Welt, Entities, Kampf ====== */
const ARENA_W = 2200, ARENA_H = 1320, CX = ARENA_W / 2, CY = ARENA_H / 2;
const MAX_R = 70, CELL = 64, MAX_ENEMIES = 340, REC_MAX = 3600, MAX_BULLETS = 1300;
const HC = Math.ceil(ARENA_W / CELL) + 1, HR = Math.ceil(ARENA_H / CELL) + 1;
const cellHead = new Int32Array(HC * HR), cellNext = new Int32Array(MAX_ENEMIES + 64);

const COL = {
  pbullet: [0.45, 0.92, 1.0],
  ebullet: [1.0, 0.28, 0.2],
  shard: [1.0, 0.84, 0.3],
  heal: [0.3, 1.0, 0.5],
  wall: [0.22, 0.5, 1.0],
  white: [1, 1, 1],
  nova: [0.55, 0.95, 1.0],
  magenta: [1.0, 0.35, 0.85],
  fire: [1.0, 0.55, 0.2],
  drone: [0.5, 1.0, 0.6],
  twin: [0.75, 0.55, 1.0],
  cryo: [0.5, 0.85, 1.6],
};

const SHAPES = {
  ship: [1.25, 0, -0.35, 0.9, -0.95, 0.6, -0.45, 0, -0.95, -0.6, -0.35, -0.9],
  shipPhantom: [1.5, 0, -0.7, 0.6, -0.3, 0, -0.7, -0.6],
  shipBastion: [1.05, 0, 0.5, 0.85, -0.85, 0.85, -0.5, 0, -0.85, -0.85, 0.5, -0.85],
  shipPrisma: [1.3, 0, -0.15, 0.4, -0.9, 1.05, -0.5, 0, -0.9, -1.05, -0.15, -0.4],
  shipChronos: [1.25, 0, 0.1, 0.8, -1.0, 0.4, -0.45, 0, -1.0, -0.4, 0.1, -0.8],
  shipNexus: [1.2, 0, 0.3, 0.45, 0.1, 1.05, -0.8, 0.55, -0.5, 0, -0.8, -0.55, 0.1, -1.05, 0.3, -0.45],
  phaser: star(3, 1.35, 0.45),
  hive: star(6, 1.15, 0.86, Math.PI / 6),
  lancer: [1.5, 0, 0.2, 0.5, -1.0, 0.7, -0.55, 0, -1.0, -0.7, 0.2, -0.5],
  diamond: [0, -1.2, 0.8, 0, 0, 1.2, -0.8, 0],
  pinwheel: star(4, 1.25, 0.45),
  arrow: [1.3, 0, -0.9, 0.95, -0.35, 0, -0.9, -0.95],
  square: ngon(4, Math.PI / 4, 1.2),
  octagon: ngon(8, Math.PI / 8),
  triangle: ngon(3, 0, 1.2),
  hexagon: ngon(6),
  ring: ngon(14),
  boss: star(8, 1.0, 0.76, Math.PI / 8),
  blade: [1.4, 0, -0.7, 0.6, -0.7, -0.6],
};

const ETYPES = {
  drifter:  { r: 15, hp: 18,   speed: 122, score: 50,   shards: 1,  cost: 1,   min: 1,  w: 5,   col: [1.0, 0.22, 0.62], shape: SHAPES.diamond },
  weaver:   { r: 14, hp: 14,   speed: 180, score: 75,   shards: 1,  cost: 1.5, min: 2,  w: 4,   col: [0.72, 0.38, 1.0], shape: SHAPES.pinwheel },
  dasher:   { r: 15, hp: 24,   speed: 85,  score: 100,  shards: 2,  cost: 2,   min: 2,  w: 3,   col: [1.0, 0.5, 0.12],  shape: SHAPES.arrow },
  splitter: { r: 21, hp: 46,   speed: 98,  score: 100,  shards: 2,  cost: 3,   min: 3,  w: 2.5, col: [0.3, 1.0, 0.42],  shape: SHAPES.square },
  mini:     { r: 10, hp: 8,    speed: 205, score: 25,   shards: 1,  cost: 0.5, min: 99, w: 0,   col: [0.45, 1.0, 0.5],  shape: SHAPES.square },
  bomber:   { r: 17, hp: 28,   speed: 150, score: 125,  shards: 2,  cost: 2.5, min: 3,  w: 2.5, col: [1.0, 0.86, 0.18], shape: SHAPES.octagon },
  shooter:  { r: 17, hp: 34,   speed: 118, score: 150,  shards: 3,  cost: 3,   min: 4,  w: 2.5, col: [1.0, 0.2, 0.22],  shape: SHAPES.triangle },
  lancer:   { r: 16, hp: 40,   speed: 80,  score: 200,  shards: 3,  cost: 4,   min: 5,  w: 1.6, col: [0.75, 1.0, 0.3],  shape: SHAPES.lancer },
  tank:     { r: 34, hp: 240,  speed: 60,  score: 400,  shards: 8,  cost: 8,   min: 6,  w: 1.2, col: [0.25, 0.5, 1.0],  shape: SHAPES.hexagon },
  well:     { r: 28, hp: 300,  speed: 16,  score: 500,  shards: 10, cost: 10,  min: 7,  w: 0.6, col: [0.85, 0.25, 1.0], shape: SHAPES.ring },
  phaser:   { r: 15, hp: 34,   speed: 140, score: 175,  shards: 2,  cost: 3,   min: 5,  w: 1.8, col: [0.35, 0.95, 1.0], shape: SHAPES.phaser },
  hive:     { r: 30, hp: 190,  speed: 42,  score: 350,  shards: 6,  cost: 7,   min: 7,  w: 0.9, col: [1.0, 0.62, 0.15], shape: SHAPES.hive },
  boss:     { r: 62, hp: 3000, speed: 78,  score: 5000, shards: 40, cost: 30,  min: 99, w: 0,   col: [1.0, 0.15, 0.55], shape: SHAPES.boss },
};
for (const k in ETYPES) ETYPES[k].name = k;
const BOSS_NAMES = ['WÄCHTER', 'ARCHITEKT', 'PARADOXON', 'SINGULARITÄT', 'OMEGA'];
const bossName = (L) => (L <= BOSS_NAMES.length ? BOSS_NAMES[Math.max(0, L - 1)] : 'OMEGA ' + (L - BOSS_NAMES.length + 1));
/** Jeder Boss hat eigene Farbe und Silhouette. */
const BOSS_LOOKS = [
  { col: [1.0, 0.15, 0.55], shape: star(8, 1.0, 0.76, Math.PI / 8) },
  { col: [1.0, 0.5, 0.1], shape: star(6, 1.05, 0.66) },
  { col: [0.7, 0.3, 1.0], shape: star(10, 1.0, 0.82) },
  { col: [0.2, 0.85, 1.0], shape: star(5, 1.12, 0.52, Math.PI / 10) },
  { col: [1.0, 0.88, 0.45], shape: star(12, 1.0, 0.86) },
];

/** Globaler Spielzustand. */
const G = {
  state: 'boot', demo: true, bot: false, autoFire: true, best: 0, bestLoop: 0,
  realT: 0, timeScale: 1, slowT: 0, slowScale: 1, hitstop: 0,
  trauma: 0, flash: 0, flashR: 0, aberr: 0, glitch: 0, zoomKick: 0, wave: null,
  camX: CX, camY: CY,
  run: null, eff: 1, pool: null, bossLv: 1, newAch: null,
};
const NO_MUTS = {};
/** Aus Aufwertungen, Schiff, Werkstatt und Mutatoren abgeleitete Werte. */
const S = {};
const Input = { up: false, down: false, left: false, right: false, fire: false, dashPressed: false, novaPressed: false, mx: 0, my: 0, wx: CX, wy: CY, ax: 0, ay: 0, analog: false };

function recomputeStats() {
  const u = (id) => G.up[id] || 0;
  const run = G.run, m = run ? run.muts : NO_MUTS, ship = SHIPS[run ? run.ship : 'vektor'] || SHIPS.vektor;
  const mv = G.demo ? () => 0 : metaLv;      // die Demo im Titelbild nutzt keine Werkstatt-Boni
  S.ship = ship;
  S.dmg = 10 * (1 + 0.25 * u('dmg')) * ship.dmg * (1 + 0.04 * mv('m_dmg')) * (m.glass ? 2.5 : 1);
  S.fireRate = 6.5 * (1 + 0.18 * u('rate'));
  S.speed = 340 * (1 + 0.1 * u('speed')) * ship.speed;
  S.maxHp = m.glass ? 1 : Math.max(1, 4 + u('hp') + ship.hp + mv('m_hull'));
  S.magnet = 130 * (1 + 0.6 * u('magnet')) * (1 + 0.12 * mv('m_magnet')) * (run && run.mode === 'swarm' ? 1.4 : 1);
  S.bulletSpeed = 900 * (1 + 0.2 * u('bspeed'));
  S.bulletLife = 0.95 * (1 + 0.12 * u('bspeed'));
  S.dashCd = 1.8 * Math.pow(0.8, u('dashcd')) * ship.dashCd;
  S.echoPow = 0.35 + 0.15 * u('echopow') + ship.echoPow + 0.05 * mv('m_echo') + (m.pacifist ? 0.65 : 0);
  S.multi = 1 + u('multi') + ship.multi;
  S.pierce = u('pierce');
  S.bounce = u('bounce') + ship.bounce;
  S.crit = 0.12 * u('crit');
  S.explode = u('explode');
  S.echoCap = 3 + u('echocap') + ship.echoCap;
  S.shield = u('shield') + ship.shield;
  S.dashDmg = u('dashdmg') + ship.dashDmg;
  S.mirror = u('mirror') + ship.mirror;
  S.hurtNova = ship.hurtNova;
  S.xpGain = 1 + 0.08 * mv('m_xp');
  S.noDash = !!m.nodash;
  S.pacifist = !!m.pacifist;
  S.novaRate = 1 + 0.35 * u('novacharge');
  S.resonance = u('resonance');
  S.ghost = u('ghostblade');
  S.chain = u('chain');
  S.homing = u('homing');
  S.echoNova = u('echonova');
  S.orbit = u('orbit') ? 1 + u('orbit') : 0;
  S.warp = u('timewarp');
  // Erweiterung
  S.dmg *= 1 + 0.08 * u('knock');
  S.knock = u('knock');
  S.regen = u('regen');
  S.novaPow = u('novapow');
  S.drones = u('drone') + ship.drone;
  S.droneRate = ship.droneRate;
  S.cryo = u('cryo');
  S.rear = u('rear');
  S.mine = u('mine');
  S.scatter = u('scatter');
  S.hole = u('hole');
  S.laser = u('laser');
  S.combo = u('combo');
  S.rewind = u('rewind');
  S.legion = u('legion');
  S.twin = u('twin');
  S.echoCap = Math.max(1, S.echoCap);
  if (G.anom === 'haste') { S.speed *= 1.2; S.fireRate *= 1.25; }
}

/** Kombo-Kern: Schadensbonus aus dem Multiplikator. */
const comboMul = () => (S.combo ? 1 + Math.min(0.6 * S.combo, Math.floor(G.mult / 10) * 0.01) : 1);

/** Kurze Vibration auf dem Handy (wenn erlaubt). */
function buzz(ms) {
  if (!G.touch || G.demo || !P.settings.haptic || !navigator.vibrate) return;
  try { navigator.vibrate(ms); } catch (e) { /* nicht unterstützt */ }
}

function newRun() {
  G.loop = 0; G.loopT = 0; G.loopDur = 30; G.bossLoop = false; G.runT = 0;
  G.score = 0; G.mult = 1; G.maxMult = 1; G.kills = 0;
  G.xp = 0; G.level = 0; G.xpNeed = 16; G.pendingPicks = 0; G.nova = 0;
  G.enemies = []; G.bullets = []; G.ebullets = []; G.pickups = [];
  G.rings = []; G.beams = []; G.popups = []; G.blasts = []; G.wells = [];
  G.echoes = []; G.recordings = []; G.recId = 0;
  G.rec = { data: new Float32Array(REC_MAX * 4), n: 0 };
  G.boss = null; G.bossSpawned = false; G.bossEndT = 0;
  G.up = {}; G.spawnAcc = 0; G.spawnRate = 0; G.packT = 0; G.hpMul = 1; G.spdMul = 1;
  G.slowT = 0; G.hitstop = 0; G.glitch = 0; G.wave = null;
  G.hitsTaken = 0; G.bossHits = 0; G.bossKills = 0; G.loopsDone = 0; G.rerolls = 0;
  G.newAch = []; G.settled = false; G.eff = 1; G.pool = null; G.bossLv = 1;
  G.holes = []; G.lasers = []; G.rewindUsed = false; G.anom = null; G.lastAnom = null; G.anomMul = 1; G.goalDone = false; G.bossBonus = false;
  Particles.clear();
  recomputeStats();
  G.player = {
    x: CX, y: CY, vx: 0, vy: 0, ang: -Math.PI / 2, hp: S.maxHp, alive: true,
    invuln: 0, hurtT: 0, dashT: 0, dashCd: 0, dashDx: 1, dashDy: 0, fireCd: 0.3,
    shieldUp: false, shieldT: 0, orbitA: 0, resonant: false, botAng: -Math.PI / 2,
    trail: [], trailAcc: 0, thrust: 0,
    droneA: 0, droneCd: [], regenT: 0, laserT: 1.2, portCd: 0,
  };
}

// ---------------------------------------------------------------- Räumlicher Hash
function rebuildHash() {
  cellHead.fill(-1);
  const es = G.enemies, n = Math.min(es.length, cellNext.length);
  for (let i = 0; i < n; i++) {
    const e = es[i];
    if (e.dead || e.spawnT > 0) continue;
    const c = clamp((e.y / CELL) | 0, 0, HR - 1) * HC + clamp((e.x / CELL) | 0, 0, HC - 1);
    cellNext[i] = cellHead[c];
    cellHead[c] = i;
  }
}

/** Ruft fn(e) für aktive Gegner rund um (x,y) auf. Gibt fn true zurück, wird abgebrochen. */
function forNear(x, y, r, fn) {
  const q = r + MAX_R, es = G.enemies;
  const x0 = clamp(((x - q) / CELL) | 0, 0, HC - 1), x1 = clamp(((x + q) / CELL) | 0, 0, HC - 1);
  const y0 = clamp(((y - q) / CELL) | 0, 0, HR - 1), y1 = clamp(((y + q) / CELL) | 0, 0, HR - 1);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      let i = cellHead[cy * HC + cx];
      while (i >= 0) {
        const e = es[i];
        i = cellNext[i];
        if (e && !e.dead && fn(e)) return;
      }
    }
  }
}

function nearestEnemy(x, y, r, ex) {
  let best = null, bd = r * r;
  forNear(x, y, r, (e) => {
    if (e === ex) return false;
    const dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = e; }
    return false;
  });
  return best;
}

// ---------------------------------------------------------------- Effekt-Helfer
function shake(t) { G.trauma = Math.min(1, G.trauma + t); }
function slowmo(scale, dur) { G.slowScale = scale; G.slowT = Math.max(G.slowT, dur); }
function ring(x, y, r0, r1, life, col, w) { if (G.rings.length < 120) G.rings.push({ x, y, r0, r1, life, max: life, col, w: w || 3, dead: false }); }
function wave(x, y, s) { G.wave = { x, y, t: 0, s }; }
function popup(x, y, val, col, size) {
  if (G.popups.length > 46) G.popups.shift();
  G.popups.push({ x, y, str: String(val), life: 0.8, col, size: size || 14, dead: false });
}
function pushTrail(o, dt, max) {
  o.trailAcc += dt;
  if (o.trailAcc >= 1 / 60) {
    o.trailAcc = 0;
    o.trail.push(o.x, o.y);
    if (o.trail.length > max) o.trail.splice(0, 2);
  }
}

// ---------------------------------------------------------------- Spieler
function fireVolley(x, y, ang, echo, col, mul) {
  const n = S.multi, sp = S.bulletSpeed, dmg = S.dmg * (mul !== undefined ? mul : echo ? S.echoPow : 1) * comboMul();
  for (let i = 0; i < n; i++) {
    const a = ang + (i - (n - 1) / 2) * 0.115 + rand(-0.012, 0.012), c = Math.cos(a), s = Math.sin(a);
    G.bullets.push({
      x: x + c * 16, y: y + s * 16, vx: c * sp, vy: s * sp, life: S.bulletLife, dmg,
      pierce: S.pierce, bounce: S.bounce, echo, col, last: null, tgt: null, seek: rand(0.12), dead: false,
    });
  }
  if (S.rear > 0) {                          // Heckgeschütz
    const m = S.rear >= 2 ? 3 : 1;
    for (let i = 0; i < m; i++) {
      const a = ang + Math.PI + (i - (m - 1) / 2) * 0.22, c = Math.cos(a), s = Math.sin(a);
      G.bullets.push({
        x: x + c * 12, y: y + s * 12, vx: c * sp, vy: s * sp, life: S.bulletLife * 0.8, dmg: dmg * 0.8,
        pierce: S.pierce, bounce: S.bounce, echo, col, last: null, tgt: null, seek: rand(0.12), dead: false,
      });
    }
  }
  if (!echo) Particles.burst(x + Math.cos(ang) * 18, y + Math.sin(ang) * 18, 2, COL.pbullet, 60, 220, 0.08, 0.18, 1.4);
}

function updatePlayer(dt) {
  const p = G.player, I = Input;
  let mx, my;
  if (I.analog) { mx = I.ax; my = I.ay; }      // Autopilot oder Touch-Stick
  else { mx = (I.right ? 1 : 0) - (I.left ? 1 : 0); my = (I.down ? 1 : 0) - (I.up ? 1 : 0); }
  const ml = Math.sqrt(mx * mx + my * my);
  if (ml > 1) { mx /= ml; my /= ml; }
  p.ang = Math.atan2(I.wy - p.y, I.wx - p.x);

  // Dash
  p.dashCd -= dt;
  if (I.dashPressed && S.noDash) Sfx.deny();
  if (I.dashPressed && !S.noDash && p.dashCd <= 0 && p.dashT <= 0) {
    if (ml > 0.1) { const l = Math.sqrt(mx * mx + my * my) || 1; p.dashDx = mx / l; p.dashDy = my / l; }
    else { p.dashDx = Math.cos(p.ang); p.dashDy = Math.sin(p.ang); }
    p.dashT = 0.17; p.dashCd = S.dashCd; p.invuln = Math.max(p.invuln, 0.32);
    Sfx.dash();
    if (S.mine > 0) {                          // Zeitmine am Startpunkt des Dashs
      G.blasts.push({ x: p.x, y: p.y, r: 95 + 15 * S.mine, dmg: S.dmg * (4 + 3 * S.mine), t: 0.7, max: 0.7, hurt: false, mine: true, col: COL.nova, dead: false });
    }
    ring(p.x, p.y, 10, 95, 0.3, COL.pbullet, 2.5);
    Particles.burst(p.x, p.y, 18, COL.pbullet, 80, 380, 0.2, 0.5, 2);
    Grid.blast(p.x, p.y, 9, 170);
  }
  I.dashPressed = false;

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDx * 1250; p.vy = p.dashDy * 1250;
    Particles.spawn(p.x, p.y, rand(-40, 40), rand(-40, 40), 0.28, 0.5, 0.95, 1, 2.4, 2);
    if (S.dashDmg > 0) {                       // Phasenriss: der Dash schneidet durch Gegner
      const dd = S.dmg * 26 * S.dashDmg * dt, px = p.x, py = p.y;
      forNear(px, py, 38, (e) => {
        const dx = e.x - px, dy = e.y - py, rr = e.r + 38;
        if (dx * dx + dy * dy < rr * rr) {
          hitEnemy(e, dd, e.x, e.y, false, true);
          if (Math.random() < 0.35) Particles.burst(e.x, e.y, 2, COL.magenta, 80, 300, 0.15, 0.35, 1.8);
        }
        return false;
      });
    }
  } else {
    const k = 1 - Math.exp(-dt * 13);
    p.vx += (mx * S.speed - p.vx) * k;
    p.vy += (my * S.speed - p.vy) * k;
  }
  p.x = clamp(p.x + p.vx * dt, 14, ARENA_W - 14);
  p.y = clamp(p.y + p.vy * dt, 14, ARENA_H - 14);
  if (G.map.obs.length) obsCollide(p, 13, false);
  updatePortals(dt);
  if (p.invuln > 0) p.invuln -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;

  // Nanoreparatur
  if (S.regen > 0 && p.hp < S.maxHp && !G.demo) {
    p.regenT += dt;
    if (p.regenT >= 50 - 10 * S.regen) {
      p.regenT = 0; p.hp++;
      ring(p.x, p.y, 10, 110, 0.45, COL.heal, 3); Sfx.heal(); toast('NANOREPARATUR');
    }
  } else p.regenT = 0;

  // Feuern (+ Resonanz in Echo-Nähe)
  let rate = S.fireRate;
  p.resonant = false;
  if (S.resonance > 0) {
    for (const e of G.echoes) {
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy < 120 * 120) { p.resonant = true; break; }
    }
    if (p.resonant) rate *= 1 + 0.35 * S.resonance;
  }
  p.fireCd -= dt;
  if (!S.pacifist && (G.autoFire || I.fire || I.analog) && p.fireCd <= 0) {
    p.fireCd = 1 / rate;
    fireVolley(p.x, p.y, p.ang, false, COL.pbullet);
    if (S.twin) fireVolley(ARENA_W - p.x, ARENA_H - p.y, p.ang + Math.PI, true, COL.twin, 0.6);
    Sfx.shoot();
  }

  // Kampfdrohnen
  if (S.drones > 0) {
    p.droneA += dt * 2.4;
    for (let k = 0; k < S.drones; k++) {
      p.droneCd[k] = (p.droneCd[k] === undefined ? 0.4 : p.droneCd[k]) - dt;
      if (p.droneCd[k] > 0 || S.pacifist) continue;
      const a = p.droneA + (k * TAU) / S.drones, x = p.x + Math.cos(a) * 48, y = p.y + Math.sin(a) * 48;
      const t = nearestEnemy(x, y, 560, null);
      if (!t) { p.droneCd[k] = 0.12; continue; }
      p.droneCd[k] = 0.62 / S.droneRate;
      const an = Math.atan2(t.y - y, t.x - x), sp = S.bulletSpeed * 1.05;
      if (G.bullets.length < MAX_BULLETS) {
        G.bullets.push({ x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, life: S.bulletLife, dmg: S.dmg * 0.6 * comboMul(),
          pierce: S.pierce, bounce: 0, echo: true, col: COL.drone, last: null, tgt: null, seek: rand(0.12), dead: false });
      }
      Sfx.eshoot();
    }
  }

  // Phasenlaser
  if (S.laser > 0 && !S.pacifist) {
    p.laserT -= dt;
    if (p.laserT <= 0 && G.enemies.length) {
      p.laserT = [2.5, 2.0, 1.6][Math.min(2, S.laser - 1)];
      fireLaser(p.x, p.y, p.ang, S.dmg * 9 * comboMul());
      if (S.twin) fireLaser(ARENA_W - p.x, ARENA_H - p.y, p.ang + Math.PI, S.dmg * 5 * comboMul());
    }
  }

  // Nova
  if (I.novaPressed) {
    if (G.nova >= 1) castNova(); else Sfx.deny();
  }
  I.novaPressed = false;

  // Schild lädt nach
  if (S.shield > 0 && !p.shieldUp) {
    p.shieldT -= dt;
    if (p.shieldT <= 0) { p.shieldUp = true; Sfx.shieldUp(); ring(p.x, p.y, 60, 26, 0.3, COL.pbullet, 2); }
  }

  // Orbitalklingen
  if (S.orbit > 0) {
    p.orbitA += dt * 3.6;
    const dps = S.dmg * 7 * dt;
    for (let k = 0; k < S.orbit; k++) {
      const a = p.orbitA + (k * TAU) / S.orbit, bx = p.x + Math.cos(a) * 84, by = p.y + Math.sin(a) * 84;
      forNear(bx, by, 16, (e) => {
        const dx = e.x - bx, dy = e.y - by, rr = e.r + 16;
        if (dx * dx + dy * dy < rr * rr) {
          hitEnemy(e, dps, bx, by, false, true);
          if (Math.random() < 0.2) Particles.burst(bx, by, 1, COL.magenta, 60, 220, 0.15, 0.3, 1.5);
        }
        return false;
      });
    }
  }

  // Triebwerk + Gitter-Kielwasser
  const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  p.thrust = damp(p.thrust, Math.min(1, spd / 300), 10, dt);
  if (spd > 60 && Math.random() < dt * 55) {
    const a = Math.atan2(-p.vy, -p.vx) + rand(-0.35, 0.35), s = rand(60, 180);
    Particles.spawn(p.x - (p.vx / spd) * 12, p.y - (p.vy / spd) * 12, Math.cos(a) * s, Math.sin(a) * s, rand(0.15, 0.4), 0.35, 0.8, 1, 1.7, 3);
  }
  Grid.push(p.x, p.y, p.vx * dt * 0.22, p.vy * dt * 0.22, 85);
  pushTrail(p, dt, 26);
}

function fireLaser(x, y, ang, dmg) {
  const c = Math.cos(ang), s = Math.sin(ang), len = rayLen(x, y, c, s, 1800);
  for (const e of G.enemies) {
    if (e.dead || e.spawnT > 0) continue;
    const px = e.x - x, py = e.y - y, along = px * c + py * s;
    if (along < -e.r || along > len + e.r) continue;
    if (Math.abs(px * s - py * c) < e.r + 14) hitEnemy(e, dmg, e.x, e.y, false, true);
  }
  if (G.lasers.length < 20) G.lasers.push({ x0: x, y0: y, x1: x + c * len, y1: y + s * len, life: 0.3, max: 0.3, dead: false });
  Particles.burst(x + c * len, y + s * len, 14, COL.nova, 80, 380, 0.2, 0.5, 2);
  Grid.blast(x + c * len, y + s * len, 10, 180);
  Sfx.laser(); shake(0.06);
}

/** Schwarze Löcher (Ereignishorizont): saugen Gegner an und zermalmen sie. */
function updateHoles(dt) {
  const hs = G.holes;
  for (const h of hs) {
    h.t -= dt;
    if (h.t <= 0) {
      h.dead = true;
      G.blasts.push({ x: h.x, y: h.y, r: 210, dmg: S.dmg * 10, t: 0, hurt: false, col: COL.magenta, dead: false });
      continue;
    }
    const dps = S.dmg * 3.2 * S.hole * dt;
    forNear(h.x, h.y, h.r, (e) => {
      const dx = h.x - e.x, dy = h.y - e.y, d = Math.sqrt(dx * dx + dy * dy) + 1;
      if (d > h.r + e.r) return false;
      if (e.type !== 'boss') { const f = 1500 * (1 - d / (h.r + e.r)) * dt; e.vx += (dx / d) * f; e.vy += (dy / d) * f; }
      if (d < 130) hitEnemy(e, dps, e.x, e.y, false, true);
      return false;
    });
    Grid.blast(h.x, h.y, -1.6 * Math.min(dt * 60, 2), 280);
    if (Math.random() < dt * 50) {
      const a = rand(TAU), rr = rand(150, 290), ca = Math.cos(a), sa = Math.sin(a);
      Particles.spawn(h.x + ca * rr, h.y + sa * rr, -ca * 260 - sa * 160, -sa * 260 + ca * 160, 0.6, 1, 0.35, 0.85, 1.8, 0.5);
    }
  }
  compact(hs);
}

/** Legendär "Zeitumkehr": rettet einmal vor dem Tod. */
function timeRewind() {
  const p = G.player;
  G.rewindUsed = true;
  p.hp = S.maxHp; p.invuln = 2.5; p.hurtT = 0;
  novaAt(p.x, p.y, 1.3);
  wave(p.x, p.y, 2); G.glitch = 1; slowmo(0.2, 1.2); G.flash = 0.3;
  for (let i = 0; i < 4; i++) ring(p.x, p.y, 20, 300 + i * 160, 0.6 + i * 0.12, i % 2 ? COL.magenta : COL.nova, 4);
  banner('ZEITUMKEHR', 'DIE ZEITLINIE WURDE GERETTET', 'cy');
  Sfx.loopEnd(); award('rewind');
}

function hurtPlayer() {
  const p = G.player;
  if (p.invuln > 0 || !p.alive || G.state !== 'playing' || G.demo) return;
  if (p.shieldUp) {
    p.shieldUp = false; p.shieldT = 18 / S.shield; p.invuln = 0.9;
    ring(p.x, p.y, 20, 280, 0.4, COL.pbullet, 4);
    Particles.burst(p.x, p.y, 40, COL.pbullet, 100, 520, 0.25, 0.7, 2.2);
    knockback(p.x, p.y, 280, 560); clearEBullets(p.x, p.y, 240);
    Grid.blast(p.x, p.y, 18, 320); shake(0.4); Sfx.shieldBreak();
    return;
  }
  p.hp--; p.invuln = 1.5; p.hurtT = 1.5;
  G.hitsTaken++; G.bossHits++;
  buzz(90);
  if (S.hurtNova > 0 && p.hp > 0) novaAt(p.x, p.y, 0.6);      // Bastion schlägt zurück
  G.mult = Math.max(1, Math.floor(G.mult * 0.5));
  shake(0.9); slowmo(0.25, 0.45); G.flashR = 0.5; G.hitstop = 0.06; G.aberr = 1;
  ring(p.x, p.y, 20, 320, 0.45, [1, 0.2, 0.2], 4);
  Particles.burst(p.x, p.y, 60, [1, 0.3, 0.2], 100, 620, 0.3, 0.9, 2.5);
  Grid.blast(p.x, p.y, 26, 400);
  knockback(p.x, p.y, 320, 640); clearEBullets(p.x, p.y, 270);
  Sfx.hurt();
  if (p.hp <= 0) {
    if (S.rewind > 0 && !G.rewindUsed) { timeRewind(); return; }
    playerDie();
  }
}

function knockback(x, y, r, force) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = e.x - x, dy = e.y - y, d = Math.sqrt(dx * dx + dy * dy) + 0.01;
    if (d > r + e.r) continue;
    const f = force * (1 - d / (r + e.r)) * (e.type === 'boss' ? 0.15 : 1);
    e.vx += (dx / d) * f; e.vy += (dy / d) * f;
    if (e.type === 'dasher') { e.state = 0; e.st = 1; }
  }
}

function clearEBullets(x, y, r) {
  for (const b of G.ebullets) {
    const dx = b.x - x, dy = b.y - y;
    if (dx * dx + dy * dy < r * r) { b.dead = true; Particles.burst(b.x, b.y, 3, COL.ebullet, 40, 160, 0.15, 0.4, 1.5); }
  }
}

function novaAt(x, y, scale) {
  const pw = 1 + 0.25 * (S.novaPow || 0);
  const rad = 470 * scale * pw, dmg = (S.dmg * 14 + 30 * G.eff) * (scale < 1 ? 0.6 : 1) * pw;
  ring(x, y, 20, rad, 0.55, COL.nova, 6);
  ring(x, y, 10, rad * 0.75, 0.45, COL.magenta, 4);
  ring(x, y, 5, rad * 0.5, 0.35, COL.white, 3);
  Particles.burst(x, y, (140 * scale) | 0, COL.nova, 200, 1100, 0.3, 1.0, 2.6, 2);
  Particles.burst(x, y, (60 * scale) | 0, COL.magenta, 100, 700, 0.4, 1.1, 2.2, 2);
  Grid.blast(x, y, 45 * scale, rad * 1.5);
  for (const e of G.enemies) {
    if (e.dead || e.spawnT > 0) continue;
    const dx = e.x - x, dy = e.y - y, d = Math.sqrt(dx * dx + dy * dy);
    if (d > rad + e.r) continue;
    if (e.type !== 'boss') {
      const f = 520 * (1 - d / (rad + e.r)) + 120;
      e.vx += (dx / (d + 1)) * f; e.vy += (dy / (d + 1)) * f;
      if (e.type === 'dasher') { e.state = 0; e.st = 1; }
    }
    hitEnemy(e, e.type === 'boss' ? dmg * 1.5 : dmg, e.x, e.y, false, true);
  }
  clearEBullets(x, y, rad);
}

function castNova() {
  const p = G.player, k0 = G.kills;
  G.nova = 0;
  novaAt(p.x, p.y, 1);
  if (S.echoNova > 0) for (const e of G.echoes) novaAt(e.x, e.y, 0.55);
  if (S.hole > 0 && G.holes.length < 4) G.holes.push({ x: p.x, y: p.y, r: 300, t: 2.4 + 0.8 * S.hole, dead: false });
  buzz(35);
  if (G.kills - k0 >= 20) award('nova20');
  shake(1); slowmo(0.3, 0.5); wave(p.x, p.y, 1.6);
  G.flash = 0.16; G.zoomKick = 0.06; G.hitstop = 0.05;
  p.invuln = Math.max(p.invuln, 0.5);
  Sfx.nova();
}

// ---------------------------------------------------------------- Echos (Zeitschleifen-Aufnahmen)
function recordSample() {
  const rec = G.rec, p = G.player;
  const target = Math.min(REC_MAX, Math.floor(G.loopT * 60) + 1);
  const firing = S.pacifist || G.autoFire || Input.fire || Input.analog ? 1 : 0;
  while (rec.n < target) {
    const i = rec.n * 4;
    rec.data[i] = p.x; rec.data[i + 1] = p.y; rec.data[i + 2] = p.ang; rec.data[i + 3] = firing;
    rec.n++;
  }
}

function echoColor(id) { return hsl((0.52 + (id % 8) * 0.065) % 1, 1, 0.62); }

function saveRecording() {
  const rec = G.rec;
  if (rec.n <= 30) return;
  G.recordings.push({ data: rec.data.slice(0, rec.n * 4), n: rec.n, id: G.recId++ });
  if (G.recordings.length > 12) G.recordings.shift();
}

function makeEcho(rec, mirror) {
  const id = rec.id + (mirror ? 4 : 0);
  return { data: rec.data, n: rec.n, id, mirror, col: echoColor(id), x: CX, y: CY, ang: 0, fireCd: rand(0.25, 0.45), lastIdx: 0, fade: 0, trail: [], trailAcc: 0 };
}

/** Baut die Echos für den nächsten Loop aus den jüngsten Aufnahmen (plus Spiegelzwillinge). */
function buildEchoes() {
  const recs = G.recordings.slice(-S.echoCap), list = recs.map((r) => makeEcho(r, false));
  const twins = Math.min(S.mirror, recs.length);
  for (let i = 0; i < twins; i++) list.push(makeEcho(recs[recs.length - 1 - i], true));
  G.echoes = list;
  if (list.length >= 6) award('echo6');
}

function updateEchoes(dt) {
  const tt = G.loopT * 60, fl = Math.floor(tt), fr = tt - fl;
  for (const e of G.echoes) {
    const n = e.n;
    if (n < 2) continue;
    const idx = fl % n, nx = idx + 1 < n ? idx + 1 : idx, d = e.data, a = idx * 4, b = nx * 4;
    const ox = e.x, oy = e.y;
    e.x = d[a] + (d[b] - d[a]) * fr;
    e.y = d[a + 1] + (d[b + 1] - d[a + 1]) * fr;
    e.ang = d[a + 2] + angDiff(d[a + 2], d[b + 2]) * fr;
    if (e.mirror) { e.x = ARENA_W - e.x; e.y = ARENA_H - e.y; e.ang += Math.PI; }   // Spiegelzwilling
    if (idx < e.lastIdx) {            // Aufnahme zu Ende -> Echo springt an den Anfang zurück
      Particles.burst(ox, oy, 14, e.col, 60, 320, 0.2, 0.6, 2);
      Particles.burst(e.x, e.y, 14, e.col, 60, 320, 0.2, 0.6, 2);
      ring(e.x, e.y, 60, 12, 0.3, e.col, 2);
      e.trail.length = 0;
    }
    e.lastIdx = idx;
    e.fade = Math.min(1, e.fade + dt * 1.6);
    e.fireCd -= dt;
    if (d[a + 3] > 0.5 && e.fireCd <= 0 && G.bullets.length < MAX_BULLETS) {
      e.fireCd = 1 / (S.fireRate * (S.legion ? 2 : 1));
      fireVolley(e.x, e.y, e.ang, true, e.col);
      Sfx.eshoot();
    }
    if (S.ghost > 0) {
      const dps = S.dmg * 4.5 * S.ghost * dt, ex = e.x, ey = e.y;
      forNear(ex, ey, 30, (en) => {
        const dx = en.x - ex, dy = en.y - ey, rr = en.r + 30;
        if (dx * dx + dy * dy < rr * rr) hitEnemy(en, dps, ex, ey, false, true);
        return false;
      });
    }
    pushTrail(e, dt, 22);
  }
}

// ---------------------------------------------------------------- Projektile
function updateBullets(dt) {
  const bs = G.bullets, wells = G.wells, hasObs = G.map.obs.length > 0;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    if (S.homing > 0) {
      b.seek -= dt;
      if (b.seek <= 0) { b.seek = 0.12; b.tgt = nearestEnemy(b.x, b.y, 250, b.last); }
      const t = b.tgt;
      if (t && !t.dead) {
        const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy), cur = Math.atan2(b.vy, b.vx);
        const lim = S.homing * 3.4 * dt, na = cur + clamp(angDiff(cur, Math.atan2(t.y - b.y, t.x - b.x)), -lim, lim);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
    }
    for (let k = 0; k < wells.length; k++) {      // Singularitäten krümmen die Flugbahn
      const w = wells[k], dx = w.x - b.x, dy = w.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 340 * 340 && d2 > 1) {
        const d = Math.sqrt(d2), f = 2300 * (1 - d / 340) * dt;
        b.vx += (dx / d) * f; b.vy += (dy / d) * f;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (hasObs && mapBlocked(b.x, b.y, 0)) {      // Hindernis: abprallen oder zerschellen
      if (b.bounce > 0) {
        obsResolve(b, 1);
        const nx = OBS_N[0], ny = OBS_N[1], vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; }
        b.bounce--; b.last = null;
        Particles.burst(b.x, b.y, 2, b.col, 40, 160, 0.1, 0.3, 1.4);
      } else {
        b.dead = true;
        Particles.burst(b.x, b.y, 3, b.col, 40, 200, 0.1, 0.35, 1.4);
        continue;
      }
    }
    if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) {
      if (b.bounce > 0) {
        b.bounce--; b.last = null;
        if (b.x < 0 || b.x > ARENA_W) { b.vx = -b.vx; b.x = clamp(b.x, 0, ARENA_W); }
        if (b.y < 0 || b.y > ARENA_H) { b.vy = -b.vy; b.y = clamp(b.y, 0, ARENA_H); }
        Particles.burst(b.x, b.y, 2, b.col, 40, 160, 0.1, 0.3, 1.4);
      } else {
        b.dead = true;
        Particles.burst(clamp(b.x, 0, ARENA_W), clamp(b.y, 0, ARENA_H), 3, b.col, 40, 200, 0.1, 0.35, 1.4);
        continue;
      }
    }
    Grid.push(b.x, b.y, b.vx * dt * 0.035, b.vy * dt * 0.035, 48);
    forNear(b.x, b.y, 5, (e) => {
      if (e === b.last) return false;
      const dx = e.x - b.x, dy = e.y - b.y, rr = e.r + 5;
      if (dx * dx + dy * dy < rr * rr) { bulletHit(b, e); return b.dead; }
      return false;
    });
  }
}

function bulletHit(b, e) {
  let dmg = b.dmg, crit = false;
  if (S.crit > 0 && Math.random() < S.crit) { dmg *= 2.5; crit = true; }
  hitEnemy(e, dmg, b.x, b.y, crit, false);
  if (S.cryo > 0 && Math.random() < 0.15 * S.cryo) e.chill = 2;
  if (S.knock > 0 && e.type !== 'boss' && !e.dead) {
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) + 1, f = 75 * S.knock * (15 / e.r);
    e.vx += (b.vx / sp) * f; e.vy += (b.vy / sp) * f;
  }
  if (S.explode > 0) {
    const rad = 45 + 18 * S.explode, bx = b.x, by = b.y, ed = dmg * (0.3 + 0.1 * S.explode);
    if (G.rings.length < 70) ring(bx, by, 6, rad, 0.2, COL.fire, 2);
    forNear(bx, by, rad, (o) => {
      if (o === e) return false;
      const dx = o.x - bx, dy = o.y - by, rr = rad + o.r;
      if (dx * dx + dy * dy < rr * rr) hitEnemy(o, ed, o.x, o.y, false, true);
      return false;
    });
  }
  if (S.chain > 0 && Math.random() < (b.echo ? 0.18 : 0.45)) chainFrom(e, dmg * 0.6, 1 + S.chain);
  if (b.pierce > 0) { b.pierce--; b.last = e; } else b.dead = true;
}

function chainFrom(src, dmg, count) {
  const cands = [];
  forNear(src.x, src.y, 210, (e) => {
    if (e !== src) {
      const dx = e.x - src.x, dy = e.y - src.y, d2 = dx * dx + dy * dy;
      if (d2 < 210 * 210) cands.push(e, d2);
    }
    return false;
  });
  let from = src, any = false;
  for (let k = 0; k < count; k++) {
    let bi = -1, bd = 1e12;
    for (let i = 0; i < cands.length; i += 2) if (cands[i] && cands[i + 1] < bd) { bd = cands[i + 1]; bi = i; }
    if (bi < 0) break;
    const t = cands[bi];
    cands[bi] = null;
    if (G.beams.length < 60) G.beams.push({ x0: from.x, y0: from.y, x1: t.x, y1: t.y, life: 0.14, max: 0.14, dead: false });
    hitEnemy(t, dmg, t.x, t.y, false, true);
    from = t; any = true;
  }
  if (any) Sfx.zap();
}

function spawnEBullet(x, y, ang, speed) {
  if (G.ebullets.length > 700) return;
  G.ebullets.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 10, dead: false });
}

function updateEBullets(dt) {
  const p = G.player, hasObs = G.map.obs.length > 0;
  for (const b of G.ebullets) {
    b.life -= dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.life <= 0 || b.x < -10 || b.x > ARENA_W + 10 || b.y < -10 || b.y > ARENA_H + 10) { b.dead = true; continue; }
    if (hasObs && mapBlocked(b.x, b.y, 0)) { b.dead = true; Particles.burst(b.x, b.y, 3, COL.ebullet, 40, 160, 0.15, 0.4, 1.5); continue; }
    if (p.alive && p.invuln <= 0) {
      const dx = p.x - b.x, dy = p.y - b.y;
      if (dx * dx + dy * dy < 13 * 13) { b.dead = true; hurtPlayer(); }
    }
  }
}

// ---------------------------------------------------------------- Gegner
function spawnEnemy(type, x, y) {
  if (G.enemies.length >= MAX_ENEMIES) return null;
  const T = ETYPES[type], hp = T.hp * G.hpMul;
  const e = {
    type, spec: T, col: T.col, r: T.r, hp, maxHp: hp,
    x: clamp(x, T.r + 6, ARENA_W - T.r - 6), y: clamp(y, T.r + 6, ARENA_H - T.r - 6), vx: 0, vy: 0,
    rot: rand(TAU), spin: rand(-2.2, 2.2), t: rand(10), phase: rand(TAU), dir: Math.random() < 0.5 ? 1 : -1,
    spawnT: 0.7, flash: 0, state: 0, st: rand(0.6, 1.6), cd: rand(1.2, 2.6), ax: 1, ay: 0,
    dieAt: 0, selfDet: false, dead: false,
  };
  G.enemies.push(e);
  return e;
}

function spawnBoss() {
  const L = Math.max(1, G.bossLv), rush = G.run && G.run.mode === 'bossrush', p = G.player;
  let [bx, by] = (G.map && G.map.bossAt) || [CX, 210];
  if ((p.x - bx) * (p.x - bx) + (p.y - by) * (p.y - by) < 380 * 380) { bx = ARENA_W - bx; by = ARENA_H - by; }
  const e = spawnEnemy('boss', bx, by);
  if (!e) return;
  e.lvl = L;
  const look = BOSS_LOOKS[(L - 1) % BOSS_LOOKS.length];
  e.shape = look.shape;
  // Kampagnen-Bosse kommen früher als im Paradox-Modus -> etwas weniger Hülle
  const camp = G.run && G.run.mode === 'campaign' ? (G.run.level.bossHp || 0.6) : 1;
  e.hp = e.maxHp = rush ? 2400 * Math.pow(L, 1.8) : ETYPES.boss.hp * Math.pow(L, 2) * camp;
  e.spawnT = 1.6; e.atk = 'idle'; e.st = 1.2; e.atkI = -1; e.spinA = 0; e.spinDir = 1; e.ph2 = false; e.cd = 0;
  e.bname = bossName(L);
  G.bossHits = 0;
  e.col = look.col.slice();
  G.boss = e; G.bossSpawned = true;
  ring(e.x, e.y, 600, 60, 1.4, e.col, 5);
  Grid.blast(e.x, e.y, -30, 700);
}

function steer(e, tx, ty, rate, dt) {
  const k = 1 - Math.exp(-rate * dt);
  e.vx += (tx - e.vx) * k;
  e.vy += (ty - e.vy) * k;
}

let _sepE = null, _sepDt = 0;
function sepFn(o) {
  const e = _sepE;
  if (o === e) return false;
  const dx = e.x - o.x, dy = e.y - o.y, rr = e.r + o.r, d2 = dx * dx + dy * dy;
  if (d2 < rr * rr && d2 > 0.01) {
    const d = Math.sqrt(d2), f = ((rr - d) / rr) * 1100 * _sepDt;
    e.vx += (dx / d) * f; e.vy += (dy / d) * f;
  }
  return false;
}

function wallHit(e) {
  if (e.type === 'boss') { shake(0.3); Grid.blast(e.x, e.y, 20, 320); Sfx.explosion(); Particles.burst(e.x, e.y, 30, e.col, 100, 500, 0.2, 0.6, 2.2); }
  else Particles.burst(e.x, e.y, 6, e.col, 60, 260, 0.15, 0.4, 1.6);
}

function updateEnemies(dt) {
  const p = G.player, es = G.enemies, n = es.length, gk = Math.min(dt * 60, 2), hasObs = G.map.obs.length > 0;
  G.wells.length = 0;
  _sepDt = dt;
  for (let i = 0; i < n; i++) {
    const e = es[i];
    if (e.dead) continue;
    e.t += dt;
    if (e.flash > 0) e.flash -= dt * 7;
    if (e.spawnT > 0) { e.spawnT -= dt; e.rot += e.spin * dt; continue; }
    let dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
    dx /= d; dy /= d;
    let slow = S.warp > 0 && d < 240 ? 1 - 0.25 * S.warp : 1;
    if (e.chill > 0) { e.chill -= dt; slow *= e.type === 'boss' ? 0.8 : 0.5; }
    const sp = e.spec.speed * G.spdMul;
    let bouncy = false, sep = true;

    switch (e.type) {
      case 'drifter':
        steer(e, dx * sp, dy * sp, 3.5, dt); e.rot += e.spin * dt;
        break;
      case 'weaver': {
        const w = Math.sin(e.t * 4.2 + e.phase) * 0.95, tx = dx - dy * w, ty = dy + dx * w, l = Math.sqrt(tx * tx + ty * ty);
        steer(e, (tx / l) * sp, (ty / l) * sp, 6, dt); e.rot += 5 * dt;
        break;
      }
      case 'mini': {
        const w = Math.sin(e.t * 7 + e.phase) * 1.3, tx = dx - dy * w, ty = dy + dx * w, l = Math.sqrt(tx * tx + ty * ty);
        steer(e, (tx / l) * sp, (ty / l) * sp, 5, dt); e.rot += 6 * dt;
        break;
      }
      case 'splitter':
        steer(e, dx * sp, dy * sp, 2.5, dt); e.rot += e.spin * 0.6 * dt;
        break;
      case 'dasher':
        if (e.state === 0) {
          steer(e, dx * sp, dy * sp, 3, dt);
          e.rot += angDiff(e.rot, Math.atan2(dy, dx)) * Math.min(1, dt * 8);
          e.st -= dt;
          if (e.st <= 0 && d < 680) { e.state = 1; e.st = 0.6; }
        } else if (e.state === 1) {
          steer(e, 0, 0, 9, dt);
          e.ax = dx; e.ay = dy; e.rot = Math.atan2(dy, dx);
          e.st -= dt;
          if (e.st <= 0) { e.state = 2; e.st = 0.55; e.vx = e.ax * 760 * G.spdMul; e.vy = e.ay * 760 * G.spdMul; Sfx.charge(); }
        } else {
          sep = false; bouncy = true;
          e.st -= dt;
          e.rot = Math.atan2(e.vy, e.vx);
          if (Math.random() < dt * 40) Particles.spawn(e.x, e.y, rand(-30, 30), rand(-30, 30), 0.3, e.col[0], e.col[1], e.col[2], 1.8, 2);
          if (e.st <= 0) { e.state = 0; e.st = rand(0.9, 1.7); }
        }
        break;
      case 'bomber':
        e.rot += e.spin * dt;
        if (e.state === 0) {
          steer(e, dx * sp, dy * sp, 4, dt);
          if (d < 125) { e.state = 1; e.st = 0.75; Sfx.fuse(); }
        } else {
          steer(e, 0, 0, 5, dt);
          e.st -= dt;
          e.flash = 0.5 + 0.5 * Math.sin(e.t * 40);
          if (e.st <= 0) { e.selfDet = true; killEnemy(e, true); }
        }
        break;
      case 'shooter': {
        let tx, ty;
        if (d > 470) { tx = dx; ty = dy; } else if (d < 320) { tx = -dx; ty = -dy; } else { tx = -dy * e.dir; ty = dx * e.dir; }
        steer(e, tx * sp, ty * sp, 3, dt);
        e.rot = Math.atan2(dy, dx);
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = rand(1.9, 2.7) / (1 + Math.min(0.5, G.eff * 0.03));
          const a = Math.atan2(dy, dx), nb = G.eff >= 9 ? 3 : 1;
          for (let k = 0; k < nb; k++) spawnEBullet(e.x + dx * 18, e.y + dy * 18, a + (k - (nb - 1) / 2) * 0.2, 240 * G.spdMul);
          Sfx.enemyShot(); e.flash = 0.7;
        }
        break;
      }
      case 'tank':
        steer(e, dx * sp, dy * sp, 2, dt); e.rot += 0.5 * dt;
        if (G.eff >= 8) {
          e.cd -= dt;
          if (e.cd <= 0) {
            e.cd = 4.2;
            const o = rand(TAU);
            for (let k = 0; k < 10; k++) spawnEBullet(e.x, e.y, o + (k / 10) * TAU, 165);
            Sfx.enemyShot(); e.flash = 0.7;
          }
        }
        break;
      case 'well':
        steer(e, dx * sp, dy * sp, 1, dt); e.rot += 1.6 * dt;
        G.wells.push(e);
        if (p.alive && d < 480 && p.dashT <= 0) {
          const f = 215 * (1 - d / 480);
          p.x -= dx * f * dt; p.y -= dy * f * dt;
        }
        Grid.blast(e.x, e.y, -1.5 * gk, 300);
        if (Math.random() < dt * 30) {
          const a = rand(TAU), rr = rand(120, 260), ca = Math.cos(a), sa = Math.sin(a);
          Particles.spawn(e.x + ca * rr, e.y + sa * rr, -ca * 180 - sa * 90, -sa * 180 + ca * 90, 0.6, e.col[0], e.col[1], e.col[2], 1.6, 0.5);
        }
        break;
      case 'lancer':
        if (e.state === 0) {                    // Abstand halten, dann anvisieren
          let tx, ty;
          if (d > 640) { tx = dx; ty = dy; } else if (d < 380) { tx = -dx; ty = -dy; } else { tx = -dy * e.dir * 0.6; ty = dx * e.dir * 0.6; }
          steer(e, tx * sp, ty * sp, 2.5, dt);
          e.rot += angDiff(e.rot, Math.atan2(dy, dx)) * Math.min(1, dt * 6);
          e.cd -= dt;
          if (e.cd <= 0) { e.state = 1; e.st = 0.95; Sfx.fuse(); }
        } else if (e.state === 1) {             // Zielen – die letzten 0,3 s steht die Richtung fest
          steer(e, 0, 0, 8, dt);
          if (e.st > 0.3) { e.ax = dx; e.ay = dy; e.rot = Math.atan2(dy, dx); }
          e.st -= dt;
          if (e.st <= 0) { e.state = 2; e.st = 0.28; e.len = rayLen(e.x, e.y, e.ax, e.ay, 1900); Sfx.laser(); shake(0.1); Grid.blast(e.x, e.y, 10, 200); }
        } else {                                // Strahl (Hindernisse blockieren ihn)
          steer(e, 0, 0, 8, dt);
          e.st -= dt;
          if (p.alive && p.invuln <= 0) {
            const px = p.x - e.x, py = p.y - e.y, along = px * e.ax + py * e.ay, perp = Math.abs(px * e.ay - py * e.ax);
            if (along > 0 && along < (e.len || 1900) && perp < 15) hurtPlayer();
          }
          if (e.st <= 0) { e.state = 0; e.cd = rand(3.4, 5.2); }
        }
        break;
      case 'phaser':                            // Phasengeist: springt mit Vorwarnung neben dich
        e.rot += 3 * dt;
        if (e.state === 0) {
          steer(e, dx * sp, dy * sp, 3, dt);
          e.cd -= dt;
          if (e.cd <= 0 && d < 950) {
            let tx = 0, ty = 0, g = 0;
            do {
              const a = rand(TAU), rr = rand(180, 250);
              tx = clamp(p.x + Math.cos(a) * rr, 40, ARENA_W - 40); ty = clamp(p.y + Math.sin(a) * rr, 40, ARENA_H - 40);
            } while (mapBlocked(tx, ty, e.r + 6) && g++ < 8);
            e.tx = tx; e.ty = ty; e.state = 1; e.st = 0.8; Sfx.fuse();
          }
        } else {
          steer(e, 0, 0, 8, dt);
          e.st -= dt;
          e.flash = 0.4 + 0.4 * Math.sin(e.t * 30);
          if (e.st <= 0) {
            Particles.burst(e.x, e.y, 16, e.col, 60, 300, 0.2, 0.5, 2);
            e.x = e.tx; e.y = e.ty; e.vx = 0; e.vy = 0;
            ring(e.x, e.y, 80, 10, 0.3, e.col, 2.5);
            Particles.burst(e.x, e.y, 16, e.col, 60, 300, 0.2, 0.5, 2);
            Sfx.zap();
            e.state = 0; e.cd = rand(2.6, 4.2);
            if (G.eff >= 8) for (let k = 0; k < 6; k++) spawnEBullet(e.x, e.y, e.rot + (k / 6) * TAU, 170 * G.spdMul);
          }
        }
        break;
      case 'hive':                              // Brutstock: speit ständig Mini-Gegner aus
        steer(e, dx * sp, dy * sp, 1.5, dt); e.rot += 0.4 * dt;
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = rand(2.8, 3.6);
          for (let k = 0; k < 2; k++) {
            const a = rand(TAU), m = spawnEnemy('mini', e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r);
            if (m) { m.spawnT = 0.25; m.vx = Math.cos(a) * 220; m.vy = Math.sin(a) * 220; }
          }
          e.flash = 0.8; ring(e.x, e.y, e.r, e.r * 2.4, 0.3, e.col, 2);
        }
        break;
      case 'boss':
        updateBoss(e, dt, dx, dy);
        sep = false; bouncy = e.atk === 'charge';
        break;
    }
    if (e.dead) continue;

    if (sep) { _sepE = e; forNear(e.x, e.y, e.r, sepFn); }
    e.x += e.vx * dt * slow; e.y += e.vy * dt * slow;
    const r = e.r;
    if (e.x < r) { e.x = r; if (e.vx < 0) { if (bouncy) { e.vx = -e.vx; wallHit(e); } else e.vx = 0; } }
    else if (e.x > ARENA_W - r) { e.x = ARENA_W - r; if (e.vx > 0) { if (bouncy) { e.vx = -e.vx; wallHit(e); } else e.vx = 0; } }
    if (e.y < r) { e.y = r; if (e.vy < 0) { if (bouncy) { e.vy = -e.vy; wallHit(e); } else e.vy = 0; } }
    else if (e.y > ARENA_H - r) { e.y = ARENA_H - r; if (e.vy > 0) { if (bouncy) { e.vy = -e.vy; wallHit(e); } else e.vy = 0; } }
    if (hasObs && obsCollide(e, r, bouncy) && bouncy) wallHit(e);

    if (p.alive && p.invuln <= 0) {
      const ax = p.x - e.x, ay = p.y - e.y, rr = e.r * 0.85 + 9;
      if (ax * ax + ay * ay < rr * rr) hurtPlayer();
    }
  }
}

function bossRest(e) { e.atk = 'idle'; e.st = e.ph2 ? 0.55 : 0.95; }

/** Angriffsfolge je Boss: höhere Bosse beherrschen mehr Muster. */
function bossSeq(L) {
  const s = ['spiral', 'rings'];
  if (L >= 3) s.push('sweep');
  s.push('aim');
  if (L >= 2) s.push('fan');
  s.push('summon');
  return s;
}

function bossNext(e) {
  const seq = bossSeq(e.lvl);
  e.atkI = (e.atkI + 1) % seq.length;
  const a = seq[e.atkI];
  if (a === 'spiral') { e.atk = a; e.st = 3.2; e.cd = 0; e.spinDir = Math.random() < 0.5 ? 1 : -1; }
  else if (a === 'rings') { e.atk = a; e.st = 2.7; e.cd = 0.25; }
  else if (a === 'aim') { e.atk = a; e.st = e.ph2 ? 0.65 : 0.85; Sfx.bossWarn(); }
  else if (a === 'fan') { e.atk = a; e.st = 1.7; e.cd = 0.25; }
  else if (a === 'sweep') {
    const p = G.player;
    e.atk = a; e.st = 3.8; e.swOn = false; e.swDir = Math.random() < 0.5 ? 1 : -1;
    e.sw = Math.atan2(p.y - e.y, p.x - e.x) - e.swDir * 1.1;
    Sfx.bossWarn();
  } else {
    const cnt = 5 + e.lvl * 2, kinds = e.lvl >= 4 ? ['weaver', 'phaser', 'drifter'] : ['drifter', 'weaver'];
    for (let k = 0; k < cnt; k++) {
      const an = (k / cnt) * TAU, m = spawnEnemy(kinds[k % kinds.length], e.x + Math.cos(an) * 130, e.y + Math.sin(an) * 130);
      if (m) m.spawnT = 0.5;
    }
    ring(e.x, e.y, 30, 210, 0.4, e.col, 3);
    e.atk = 'idle'; e.st = e.ph2 ? 1.0 : 1.4;
  }
}

function updateBoss(e, dt, dx, dy) {
  const L = e.lvl, sp = e.spec.speed;
  if (!e.ph2 && e.hp < e.maxHp * 0.5) {
    e.ph2 = true; e.col = [Math.min(1.4, e.col[0] + 0.35), e.col[1] * 0.6 + 0.1, e.col[2] * 0.5];
    ring(e.x, e.y, 40, 720, 0.7, e.col, 6);
    shake(0.7); Grid.blast(e.x, e.y, 32, 720); Sfx.bossWarn(); G.flashR = 0.25;
    banner('PHASE 2', e.bname + ' IST ENTFESSELT', 'warn');
  }
  const bs = e.ph2 ? 1.22 : 1;
  e.rot += dt * (e.ph2 ? 1.3 : 0.6);
  e.st -= dt;
  switch (e.atk) {
    case 'idle':
      steer(e, dx * sp * bs, dy * sp * bs, 2, dt);
      if (e.st <= 0) bossNext(e);
      break;
    case 'spiral': {
      const home = G.map.home || [CX, CY];
      steer(e, (home[0] - e.x) * 0.4, (home[1] - e.y) * 0.4, 2, dt);
      e.cd -= dt;
      while (e.cd <= 0) {
        e.cd += 0.09 / bs;
        const arms = Math.min(7, 2 + L + (e.ph2 ? 1 : 0));
        for (let k = 0; k < arms; k++) spawnEBullet(e.x, e.y, e.spinA + (k / arms) * TAU, 195 * bs);
        e.spinA += 0.2 * e.spinDir;
        Sfx.bossShot();
      }
      if (e.st <= 0) bossRest(e);
      break;
    }
    case 'fan':                                 // gezielte Fächer-Salven
      steer(e, dx * sp * 0.3, dy * sp * 0.3, 2, dt);
      e.cd -= dt;
      if (e.cd <= 0) {
        e.cd = 0.45 / bs;
        const nb = 5 + Math.min(4, L), a0 = Math.atan2(dy, dx);
        for (let k = 0; k < nb; k++) spawnEBullet(e.x, e.y, a0 + (k - (nb - 1) / 2) * 0.13, 255 * bs);
        e.flash = 0.6; Sfx.enemyShot();
      }
      if (e.st <= 0) bossRest(e);
      break;
    case 'sweep': {                             // rotierende Laserstrahlen
      steer(e, 0, 0, 5, dt);
      const on = e.st < 2.9;
      if (on && !e.swOn) { e.swOn = true; Sfx.laser(); shake(0.25); Grid.blast(e.x, e.y, 20, 400); }
      if (on) e.sw += dt * (e.ph2 ? 1.15 : 0.85) * e.swDir;
      const p = G.player, beams = L >= 4 ? 3 : 2;
      if (on && p.alive && p.invuln <= 0) {
        for (let k = 0; k < beams; k++) {
          const a = e.sw + (k * TAU) / beams, c = Math.cos(a), s = Math.sin(a);
          const px = p.x - e.x, py = p.y - e.y, along = px * c + py * s, perp = Math.abs(px * s - py * c);
          if (along > 0 && perp < 16 && along < rayLen(e.x, e.y, c, s, 1900)) { hurtPlayer(); break; }
        }
      }
      if (e.st <= 0) bossRest(e);
      break;
    }
    case 'rings':
      steer(e, dx * sp * 0.5, dy * sp * 0.5, 2, dt);
      e.cd -= dt;
      if (e.cd <= 0) {
        e.cd = 0.78 / bs;
        const cnt = 18 + 4 * L, gap = randInt(0, cnt - 1), o = rand(TAU);
        for (let k = 0; k < cnt; k++) {
          if ((k - gap + cnt) % cnt < 3) continue;
          spawnEBullet(e.x, e.y, o + (k / cnt) * TAU, 170 * bs);
        }
        ring(e.x, e.y, 20, 130, 0.25, e.col, 3); Sfx.enemyShot();
      }
      if (e.st <= 0) bossRest(e);
      break;
    case 'aim':
      steer(e, 0, 0, 6, dt);
      e.ax = dx; e.ay = dy;
      if (e.st <= 0) { e.atk = 'charge'; e.st = 0.8; e.cd = 0; e.vx = e.ax * 940; e.vy = e.ay * 940; Sfx.charge(); }
      break;
    case 'charge':
      if (Math.random() < dt * 90) Particles.spawn(e.x + rand(-40, 40), e.y + rand(-40, 40), rand(-60, 60), rand(-60, 60), 0.45, e.col[0], e.col[1], e.col[2], 2.4, 2);
      Grid.blast(e.x, e.y, 2.2 * Math.min(dt * 60, 2), 170);
      if (L >= 2) {
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = 0.075;
          const a = Math.atan2(e.vy, e.vx);
          spawnEBullet(e.x, e.y, a + Math.PI / 2, 120); spawnEBullet(e.x, e.y, a - Math.PI / 2, 120);
        }
      }
      if (e.st <= 0) bossRest(e);
      break;
  }
}

function hitEnemy(e, dmg, x, y, crit, silent) {
  if (e.dead) return;
  e.hp -= dmg;
  e.flash = 1;
  if (!silent) {
    Particles.burst(x, y, crit ? 6 : 2, e.col, 80, 260, 0.15, 0.35, 1.6);
    Sfx.hit();
    if (crit) popup(e.x, e.y - e.r - 22, Math.round(dmg), COL.shard, 12);
  }
  if (e.hp <= 0) killEnemy(e, false);
}

function dropShards(x, y, n, spread) {
  const life = G.run && G.run.mode === 'swarm' ? 24 : 11;     // im Schwarm gibt es kein Einsammeln am Loop-Ende
  for (let i = 0; i < n; i++) {
    if (G.pickups.length > 600) return;
    const a = rand(TAU), s = rand(40, spread || 170);
    G.pickups.push({ kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, rot: rand(TAU), att: 0, dead: false });
  }
}

function killEnemy(e, noReward) {
  if (e.dead) return;
  e.dead = true;
  const T = e.spec, c = e.col;
  const muts = G.run ? G.run.muts : NO_MUTS;
  if (!noReward) {
    const pts = T.score * G.mult * (G.run ? G.run.scoreMul : 1) * (e.elite ? 3 : 1) * G.anomMul;
    G.score += pts; G.kills++;
    if (G.score >= 1e6) award('million');
    const was = G.nova;
    G.nova = Math.min(1, G.nova + (0.008 + T.cost * 0.004) * S.novaRate);
    if (was < 1 && G.nova >= 1) { Sfx.novaReady(); toast('NOVA BEREIT'); }
    dropShards(e.x, e.y, T.shards * (muts.elite ? 2 : 1) * (e.elite ? 3 : 1) * (G.anom === 'gold' ? 2 : 1), e.type === 'boss' ? 520 : 170);
    if (S.scatter > 0 && e.type !== 'boss' && G.bullets.length < MAX_BULLETS - 40) {      // Splitterkern
      const nb = 2 + S.scatter, o = rand(TAU), sd = S.dmg * 0.45;
      for (let k = 0; k < nb; k++) {
        const a = o + (k / nb) * TAU;
        G.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 0.45, dmg: sd, pierce: 0, bounce: 0,
          echo: true, col: COL.shard, last: e, tgt: null, seek: 1, dead: false });
      }
    }
    popup(e.x, e.y - 8, Math.floor(pts), c, clamp(11 + Math.log10(pts + 1) * 2.2, 12, 26));
    if (muts.unstable && e.type !== 'boss' && e.type !== 'bomber' && G.blasts.length < 140) {
      G.blasts.push({ x: e.x, y: e.y, r: 80, dmg: 26 * G.hpMul, t: 0.4, max: 0.4, hurt: true, col: COL.fire, dead: false });
    }
  }
  Particles.burst(e.x, e.y, (10 + e.r * 0.9) | 0, c, 80, 300 + e.r * 8, 0.3, 0.9, 2.2);
  Particles.burst(e.x, e.y, 6, COL.white, 40, 220, 0.2, 0.5, 1.6);
  ring(e.x, e.y, e.r * 0.5, e.r * 3, 0.3, c, 2.5);
  Grid.blast(e.x, e.y, 3 + e.r * 0.25, 90 + e.r * 3);
  shake(0.012 + e.r * 0.0016);     // bewusst klein: im Schwarm summieren sich viele Abschüsse
  Sfx.kill(e.r);

  switch (e.type) {
    case 'splitter':
      for (let k = 0; k < 3; k++) {
        const a = e.rot + (k / 3) * TAU, m = spawnEnemy('mini', e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14);
        if (m) { m.spawnT = 0.12; m.vx = Math.cos(a) * 260; m.vy = Math.sin(a) * 260; }
      }
      break;
    case 'bomber':
      G.blasts.push({ x: e.x, y: e.y, r: 140, dmg: 70 * G.hpMul, t: e.selfDet ? 0 : 0.1, hurt: e.selfDet, col: c, dead: false });
      break;
    case 'well':
      G.blasts.push({ x: e.x, y: e.y, r: 270, dmg: 160 * G.hpMul, t: 0.05, hurt: false, col: c, dead: false });
      wave(e.x, e.y, 1); shake(0.5);
      break;
    case 'tank':
      shake(0.3); G.hitstop = Math.max(G.hitstop, 0.04);
      if (!noReward && Math.random() < 0.22) G.pickups.push({ kind: 1, x: e.x, y: e.y, vx: 0, vy: 0, life: 14, rot: 0, att: 0, dead: false });
      break;
    case 'boss':
      G.boss = null; G.bossEndT = 2.4;
      if (!noReward) {
        G.bossKills++;
        ['boss1', 'boss2', 'boss3', 'boss4', 'boss5'].forEach((id, i) => { if (e.lvl >= i + 1) award(id); });
        if (G.bossHits === 0) award('nohit_boss');
        if (G.run && G.run.mode === 'bossrush' && G.bossKills >= 3) award('rush3');
      }
      for (let k = 0; k < 9; k++) {
        G.blasts.push({ x: e.x + rand(-150, 150), y: e.y + rand(-150, 150), r: rand(120, 230), dmg: 0, t: 0.1 + k * 0.14, hurt: false, col: k % 2 ? COL.fire : c, dead: false });
      }
      ring(e.x, e.y, 40, 950, 0.9, COL.white, 8);
      Particles.burst(e.x, e.y, 300, c, 150, 1300, 0.5, 1.6, 3, 1.6);
      Grid.blast(e.x, e.y, 60, 1100); wave(e.x, e.y, 2); shake(1);
      slowmo(0.18, 1.3); G.hitstop = 0.12; G.flash = 0.35;
      for (const b of G.ebullets) b.dead = true;
      for (const o of G.enemies) if (!o.dead) killEnemy(o, false);
      G.pickups.push({ kind: 1, x: e.x, y: e.y, vx: 0, vy: 0, life: 20, rot: 0, att: 0, dead: false });
      Sfx.bossDie();
      break;
  }
}

/** Verzögerte Explosionen (Bomber, Singularitäten, Bosstod) – erlauben Kettenreaktionen. */
function updateBlasts(dt) {
  const bl = G.blasts;
  for (let i = 0; i < bl.length; i++) {
    const b = bl[i];
    if (b.dead) continue;
    b.t -= dt;
    if (b.t > 0) continue;
    b.dead = true;
    ring(b.x, b.y, 10, b.r, 0.35, b.col, 4);
    ring(b.x, b.y, 5, b.r * 0.6, 0.25, COL.white, 2);
    Particles.burst(b.x, b.y, 40, b.col, 100, 620, 0.25, 0.8, 2.4);
    Grid.blast(b.x, b.y, 16, b.r * 1.8);
    shake(0.22); Sfx.explosion();
    if (b.dmg > 0) {
      const bx = b.x, by = b.y, br = b.r, bd = b.dmg;
      forNear(bx, by, br, (e) => {
        const dx = e.x - bx, dy = e.y - by, rr = br + e.r;
        if (dx * dx + dy * dy < rr * rr) hitEnemy(e, bd, e.x, e.y, false, true);
        return false;
      });
    }
    if (b.hurt) {
      const p = G.player, dx = p.x - b.x, dy = p.y - b.y, rr = b.r - 8;
      if (dx * dx + dy * dy < rr * rr) hurtPlayer();
    }
  }
  compact(bl);
}

// ---------------------------------------------------------------- Aufsammelbares
function updatePickups(dt, magnetAll) {
  const p = G.player, mag = S.magnet * S.magnet;
  for (const k of G.pickups) {
    if (!magnetAll) { k.life -= dt; if (k.life <= 0) { k.dead = true; continue; } }
    k.rot += dt * 4;
    const dx = p.x - k.x, dy = p.y - k.y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2) + 0.01;
    if (p.alive && (magnetAll || d2 < mag || k.att > 0)) {
      k.att = Math.min(magnetAll ? 1500 : 950, k.att + 2600 * dt);
      k.vx = (dx / d) * k.att; k.vy = (dy / d) * k.att;
    } else {
      const f = Math.max(0, 1 - 3.2 * dt);
      k.vx *= f; k.vy *= f;
    }
    k.x = clamp(k.x + k.vx * dt, 8, ARENA_W - 8);
    k.y = clamp(k.y + k.vy * dt, 8, ARENA_H - 8);
    if (G.map.obs.length && !magnetAll) obsResolve(k, 6);
    if (p.alive && d < 24) { k.dead = true; collect(k); }
  }
}

function collect(k) {
  const p = G.player;
  if (k.kind === 1) {
    if (p.hp < S.maxHp) { p.hp++; toast('HÜLLE REPARIERT'); }
    else G.score += 500 * G.mult;
    ring(p.x, p.y, 10, 90, 0.4, COL.heal, 3);
    Particles.burst(p.x, p.y, 24, COL.heal, 60, 320, 0.3, 0.7, 2);
    Sfx.heal();
    return;
  }
  G.mult++; if (G.mult > G.maxMult) G.maxMult = G.mult;
  if (G.mult >= 500) award('mult500');
  G.xp += S.xpGain;
  G.nova = Math.min(1, G.nova + 0.0015 * S.novaRate);
  Sfx.shard();
  if (G.xp >= G.xpNeed) {
    const swarm = G.run && G.run.mode === 'swarm';
    G.xp -= G.xpNeed; G.level++; G.pendingPicks++;
    // Im Schwarm-Modus sind Stufenaufstiege die einzige Quelle für Aufwertungen -> etwas schneller
    G.xpNeed = swarm ? Math.round(10 + G.level * 7 + G.level * G.level * 0.6) : Math.round(16 + G.level * 12 + G.level * G.level * 1.5);
    ring(p.x, p.y, 20, 150, 0.5, COL.shard, 3);
    Particles.burst(p.x, p.y, 30, COL.shard, 80, 420, 0.3, 0.8, 2);
    Sfx.levelUp();
    if (!swarm) toast('BONUS-AUFWERTUNG GESICHERT');
  }
}

// ---------------------------------------------------------------- Spawn-Regie
function farPoint(minD) {
  const p = G.player;
  for (let k = 0; k < 14; k++) {
    const x = rand(60, ARENA_W - 60), y = rand(60, ARENA_H - 60), dx = x - p.x, dy = y - p.y;
    if (dx * dx + dy * dy > minD * minD && !mapBlocked(x, y, 50)) return [x, y];
  }
  return [p.x < CX ? ARENA_W - 120 : 120, p.y < CY ? ARENA_H - 120 : 120];
}

function spawnPack(budget) {
  const p = G.player, loop = Math.floor(G.eff), pool = G.pool;
  const counts = {};
  for (const e of G.enemies) if (!e.dead) counts[e.type] = (counts[e.type] || 0) + 1;
  const avail = [];
  let tw = 0;
  for (const k in ETYPES) {
    const T = ETYPES[k];
    if (T.w <= 0) continue;
    if (pool ? pool.indexOf(k) < 0 : T.min > loop) continue;      // Kampagnen-Sektoren geben die Gegner fest vor
    if (k === 'well' && (counts.well || 0) >= 2) continue;
    if (k === 'tank' && (counts.tank || 0) >= 5) continue;
    if (k === 'shooter' && (counts.shooter || 0) >= 10) continue;
    if (k === 'lancer' && (counts.lancer || 0) >= 4) continue;
    if (k === 'hive' && (counts.hive || 0) >= 3) continue;
    if (k === 'phaser' && (counts.phaser || 0) >= 6) continue;
    avail.push(T); tw += T.w;
  }
  if (!avail.length) { avail.push(ETYPES.drifter); tw = ETYPES.drifter.w; }
  const pickType = (maxCost) => {
    let r = Math.random() * tw;
    for (const T of avail) { r -= T.w; if (r <= 0) return T.cost <= maxCost ? T : ETYPES.drifter; }
    return ETYPES.drifter;
  };
  const main = pickType(budget);
  const list = [];
  let b = budget, guard = 0;
  while (b >= 1 && guard++ < 90 && G.enemies.length + list.length < MAX_ENEMIES) {
    const T = Math.random() < 0.75 && main.cost <= b ? main : pickType(b);
    list.push(T); b -= T.cost;
  }
  const n = list.length, pattern = pick(['scatter', 'ring', 'corner', 'edge', 'scatter']);
  const ang0 = rand(TAU), edge = randInt(0, 3);
  let ax = p.x < CX ? ARENA_W - 230 : 230;
  const ay = Math.random() < 0.5 ? 230 : ARENA_H - 230;
  if (Math.random() < 0.25) ax = ARENA_W - ax;
  for (let i = 0; i < n; i++) {
    let x, y;
    if (pattern === 'ring') {
      const a = ang0 + (i / n) * TAU, rr = 440 + (i % 2) * 55;
      x = p.x + Math.cos(a) * rr; y = p.y + Math.sin(a) * rr;
      if (x < 40 || x > ARENA_W - 40 || y < 40 || y > ARENA_H - 40) [x, y] = farPoint(340);
    } else if (pattern === 'corner') {
      x = ax + rand(-180, 180); y = ay + rand(-180, 180);
    } else if (pattern === 'edge') {
      const t = (i + 0.5) / n;
      if (edge === 0) { x = 60 + t * (ARENA_W - 120); y = 50; }
      else if (edge === 1) { x = 60 + t * (ARENA_W - 120); y = ARENA_H - 50; }
      else if (edge === 2) { x = 50; y = 60 + t * (ARENA_H - 120); }
      else { x = ARENA_W - 50; y = 60 + t * (ARENA_H - 120); }
    } else {
      [x, y] = farPoint(340);
    }
    const dx = x - p.x, dy = y - p.y;
    if (dx * dx + dy * dy < 300 * 300 || mapBlocked(x, y, list[i].r + 10)) [x, y] = farPoint(340);
    const e = spawnEnemy(list[i].name, x, y);
    if (!e) continue;
    e.spawnT = 0.7 + Math.min(0.6, i * 0.03);
    if (e.type === 'lancer' || e.type === 'phaser') e.cd = rand(2.2, 4);          // nicht sofort nach dem Erscheinen angreifen
    const eliteP = G.anom === 'elite' ? (G.eff >= 2 ? 0.22 : 0) : G.eff >= 5 ? 0.035 : 0;
    if (!G.demo && list[i].cost <= 3 && Math.random() < eliteP) {     // seltene Elite-Variante
      e.elite = true; e.r *= 1.35; e.hp = e.maxHp = e.hp * 4;
    }
  }
  G.spawnAcc = b;
}

function updateSpawner(dt) {
  if (G.loopT < 1.3) return;
  if (G.bossLoop) {
    if (!G.bossSpawned) { if (G.loopT > 2.3) spawnBoss(); return; }
    if (!G.boss) return;
  } else if (G.loopDur - G.loopT < 4) return;
  G.spawnAcc += G.spawnRate * dt;
  G.packT -= dt;
  if (G.packT <= 0 && G.spawnAcc >= 2) {
    spawnPack(G.spawnAcc);
    G.packT = rand(1.6, 2.8);
  }
}

/** Dreht die Zielrichtung weich auf den nächsten Gegner (Touch-Steuerung ohne Zielstick). */
function autoAim(dt) {
  const p = G.player;
  let near = null, nd = 1e9;
  for (const e of G.enemies) {
    if (e.dead || e.spawnT > 0) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.sqrt(dx * dx + dy * dy) - e.r, pri = e.type === 'boss' ? d * 0.45 : d;
    if (pri < nd) { nd = pri; near = e; }
  }
  if (near) {
    const lead = Math.min(0.35, Math.max(0, nd) / S.bulletSpeed);
    const want = Math.atan2(near.y + near.vy * lead - p.y, near.x + near.vx * lead - p.x);
    p.botAng += clamp(angDiff(p.botAng, want), -dt * 12, dt * 12);
  }
  return near;
}

// ---------------------------------------------------------------- Autopilot (Demo im Titelbild, ?bot zum Testen)
function botThink(dt) {
  const p = G.player;
  let ax = 0, ay = 0, near = null, nd = 1e9, cnt = 0;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx * dx + dy * dy) + 1;
    const pri = e.type === 'boss' ? (d - e.r) * 0.45 : d - e.r;      // Bosse bevorzugt aufs Korn nehmen
    if (e.spawnT <= 0 && pri < nd) { nd = pri; near = e; }
    const range = 250 + e.r * 3;
    if (d < range) { const f = (range - d) / range; ax += (dx / d) * f * f * 3.2; ay += (dy / d) * f * f * 3.2; cnt++; }
    if (e.type === 'lancer' && e.state > 0) {       // aus der Schusslinie einer Lanze gehen
      const along = dx * e.ax + dy * e.ay, side = dx * -e.ay + dy * e.ax;
      if (along > 0 && Math.abs(side) < 70) { const s = side >= 0 ? 1 : -1, f = (70 - Math.abs(side)) / 70 * 6; ax += -e.ay * s * f; ay += e.ax * s * f; }
    }
  }
  for (const b of G.ebullets) {
    const dx = p.x - b.x, dy = p.y - b.y, d = Math.sqrt(dx * dx + dy * dy) + 1;
    if (d < 170) { const f = (170 - d) / 170; ax += (dx / d) * f * 3; ay += (dy / d) * f * 3; }
  }
  for (const b of G.blasts) {
    if (!b.hurt) continue;
    const dx = p.x - b.x, dy = p.y - b.y, d = Math.sqrt(dx * dx + dy * dy) + 1, range = b.r + 70;
    if (d < range) { const f = (range - d) / range; ax += (dx / d) * f * 5; ay += (dy / d) * f * 5; }
  }
  for (const b of G.map.obs) {                    // Hindernissen ausweichen
    let qx, qy, rad = 0;
    if (b.k === 0) { qx = b.x; qy = b.y; rad = b.r; } else { qx = clamp(p.x, b.x0, b.x1); qy = clamp(p.y, b.y0, b.y1); }
    const dx = p.x - qx, dy = p.y - qy, l = Math.sqrt(dx * dx + dy * dy) + 0.01, d = l - rad;
    if (d < 110) { const f = ((110 - Math.max(d, 1)) / 110) * 4; ax += (dx / l) * f; ay += (dy / l) * f; }
  }
  if (p.x < 220) ax += ((220 - p.x) / 220) * 3; else if (p.x > ARENA_W - 220) ax -= ((p.x - (ARENA_W - 220)) / 220) * 3;
  if (p.y < 220) ay += ((220 - p.y) / 220) * 3; else if (p.y > ARENA_H - 220) ay -= ((p.y - (ARENA_H - 220)) / 220) * 3;
  const wx = CX + Math.cos(G.runT * 0.45) * 520, wy = CY + Math.sin(G.runT * 0.62) * 300;
  ax += (wx - p.x) * 0.0016; ay += (wy - p.y) * 0.0016;
  let bs = null, bd = 320 * 320;
  for (const k of G.pickups) { const dx = k.x - p.x, dy = k.y - p.y, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; bs = k; } }
  if (bs) { const d = Math.sqrt(bd) + 1; ax += ((bs.x - p.x) / d) * 0.7; ay += ((bs.y - p.y) / d) * 0.7; }
  const l = Math.sqrt(ax * ax + ay * ay);
  if (l > 0.05) { Input.ax = damp(Input.ax, ax / Math.max(l, 1), 12, dt); Input.ay = damp(Input.ay, ay / Math.max(l, 1), 12, dt); }
  else { Input.ax = damp(Input.ax, 0, 6, dt); Input.ay = damp(Input.ay, 0, 6, dt); }
  let want = p.botAng;
  if (near) {
    const lead = Math.min(0.35, nd / S.bulletSpeed);
    want = Math.atan2(near.y + near.vy * lead - p.y, near.x + near.vx * lead - p.x);
  } else want += dt * 0.8;
  p.botAng += clamp(angDiff(p.botAng, want), -dt * 11, dt * 11);
  Input.wx = p.x + Math.cos(p.botAng) * 220; Input.wy = p.y + Math.sin(p.botAng) * 220;
  if (nd < 60 && p.dashCd <= 0) Input.dashPressed = true;
  if (G.nova >= 1 && cnt >= 10) Input.novaPressed = true;
}

// ---------------------------------------------------------------- Zeichnen
function drawTrail(tr, c, alpha, w) {
  const n = tr.length;
  for (let i = 0; i + 3 < n; i += 2) {
    const k = i / n;
    R.line(tr[i], tr[i + 1], tr[i + 2], tr[i + 3], w * (0.35 + 0.65 * k), c[0], c[1], c[2], k * alpha);
  }
}

function drawEnemy(e) {
  const c = e.col, T = e.spec, s = e.r;
  if (e.spawnT > 0) {
    const k = clamp(e.spawnT / 0.7, 0, 1);
    R.poly(T.shape, e.x, e.y, e.rot, s * (1 + k * 1.8), 1.2, c[0], c[1], c[2], 0.15 + (1 - k) * 0.6);
    R.ring(e.x, e.y, s * (0.6 + k * 2.4), 1.1, c[0], c[1], c[2], 0.28, 14);
    return;
  }
  const f = e.flash > 0 ? Math.min(1, e.flash) : 0;
  const r = c[0] + (1.5 - c[0]) * f, g = c[1] + (1.5 - c[1]) * f, b = c[2] + (1.5 - c[2]) * f;

  if (e.type === 'boss') {
    const pulse = 1 + 0.06 * Math.sin(e.t * 6), shp = e.shape || T.shape;
    R.poly(shp, e.x, e.y, e.rot, s * pulse, 3.2, r * 2, g * 2, b * 2, 1);
    R.polyFill(shp, e.x, e.y, e.rot, s * pulse, r, g, b, 0.1 + f * 0.2);
    if (e.chill > 0) R.ring(e.x, e.y, s * 1.4, 1.6, COL.cryo[0], COL.cryo[1], COL.cryo[2], 0.6, 40);
    if (e.atk === 'sweep') {
      const on = e.st < 2.9, beams = e.lvl >= 4 ? 3 : 2;
      for (let k = 0; k < beams; k++) {
        const a = e.sw + (k * TAU) / beams, c = Math.cos(a), sn = Math.sin(a), len = rayLen(e.x, e.y, c, sn, 1900);
        if (on) {
          R.line(e.x, e.y, e.x + c * len, e.y + sn * len, 9, r * 2, g * 2, b * 2, 1);
          R.line(e.x, e.y, e.x + c * len, e.y + sn * len, 3, 2.2, 2.2, 2.0, 1);
        } else R.line(e.x, e.y, e.x + c * len, e.y + sn * len, 1.4, r, g, b, 0.25 + 0.4 * Math.abs(Math.sin(e.t * 24)));
      }
    }
    R.poly(SHAPES.hexagon, e.x, e.y, -e.rot * 1.7, s * 0.66, 2.4, r * 1.5, g * 1.5, b * 1.5, 0.9);
    R.poly(SHAPES.triangle, e.x, e.y, e.rot * 2.6, s * 0.36, 2.2, 1.8, 1.6, 1.4, 1);
    R.dot(e.x, e.y, s * 0.3, r, g, b, 0.9);
    R.ring(e.x, e.y, s * 1.25, 1.4, r, g, b, 0.3 + 0.2 * Math.sin(e.t * 3), 40);
    if (e.atk === 'aim') {
      const a = 0.25 + 0.35 * Math.abs(Math.sin(e.t * 22));
      R.line(e.x, e.y, e.x + e.ax * 1400, e.y + e.ay * 1400, 2.5, 1, 0.2, 0.15, a);
      R.line(e.x - e.ay * s, e.y + e.ax * s, e.x - e.ay * s + e.ax * 1400, e.y + e.ax * s + e.ay * 1400, 1.2, 1, 0.2, 0.15, a * 0.5);
      R.line(e.x + e.ay * s, e.y - e.ax * s, e.x + e.ay * s + e.ax * 1400, e.y - e.ax * s + e.ay * 1400, 1.2, 1, 0.2, 0.15, a * 0.5);
    }
    return;
  }

  R.poly(T.shape, e.x, e.y, e.rot, s, 2.0, r * 1.7, g * 1.7, b * 1.7, 1);
  R.poly(T.shape, e.x, e.y, e.rot, s * 0.52, 1.3, r, g, b, 0.6);
  R.polyFill(T.shape, e.x, e.y, e.rot, s, r, g, b, 0.09 + f * 0.25);
  if (e.elite) {
    R.poly(T.shape, e.x, e.y, e.rot, s * 1.3, 1.6, 1.8, 1.45, 0.4, 0.75 + 0.25 * Math.sin(e.t * 8));
    R.ring(e.x, e.y, s * 1.75, 1.1, 1.0, 0.8, 0.25, 0.45, 22);
  }
  if (e.chill > 0) R.ring(e.x, e.y, s * 1.4, 1.3, COL.cryo[0], COL.cryo[1], COL.cryo[2], 0.55, 16);

  switch (e.type) {
    case 'lancer':
      if (e.state === 1) {
        const k = 1 - e.st / 0.95, locked = e.st <= 0.3, L = rayLen(e.x, e.y, e.ax, e.ay, 1900);
        const a = locked ? 0.5 + 0.4 * Math.abs(Math.sin(e.t * 40)) : 0.12 + 0.3 * k;
        R.line(e.x, e.y, e.x + e.ax * L, e.y + e.ay * L, locked ? 1.8 : 1.1, locked ? 1.6 : c[0], locked ? 1.5 : c[1], locked ? 1.2 : c[2], a);
        R.dot(e.x + e.ax * s * 1.3, e.y + e.ay * s * 1.3, 4 + k * 9, 1.6, 1.8, 0.8, 1);
      } else if (e.state === 2) {
        const k = e.st / 0.28, L = e.len || 1900;
        R.line(e.x, e.y, e.x + e.ax * L, e.y + e.ay * L, 5 + 7 * k, c[0] * 2.2, c[1] * 2.2, c[2] * 2.2, 1);
        R.line(e.x, e.y, e.x + e.ax * L, e.y + e.ay * L, 2 + 3 * k, 2.2, 2.2, 2.0, 1);
      }
      break;
    case 'phaser':
      if (e.state === 1) {
        const k = 1 - e.st / 0.8;
        R.ring(e.tx, e.ty, e.r * (3 - 2 * k), 1.6, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, 0.3 + 0.6 * k, 16);
        R.poly(T.shape, e.tx, e.ty, -e.rot, s * 0.8, 1.1, c[0], c[1], c[2], 0.25 + 0.4 * k);
      }
      break;
    case 'hive':
      R.poly(SHAPES.hexagon, e.x, e.y, -e.rot * 2, s * 0.55, 1.4, r, g, b, 0.7);
      if (e.cd < 0.6) R.ring(e.x, e.y, s * (1.2 + (0.6 - e.cd)), 1.2, r, g, b, 0.5, 20);
      break;
    case 'dasher':
      if (e.state === 1) R.line(e.x, e.y, e.x + e.ax * 700, e.y + e.ay * 700, 1.3, c[0], c[1], c[2], 0.15 + 0.3 * Math.abs(Math.sin(e.t * 26)));
      break;
    case 'bomber':
      if (e.state === 1) {
        const k = 1 - e.st / 0.75;
        R.ring(e.x, e.y, 140, 1.6, 1, 0.35, 0.15, 0.25 + 0.5 * k, 44);
        R.ring(e.x, e.y, 140 * k, 1.2, 1, 0.8, 0.2, 0.5, 32);
      }
      break;
    case 'shooter':
      if (e.cd < 0.45) R.dot(e.x + Math.cos(e.rot) * s * 1.2, e.y + Math.sin(e.rot) * s * 1.2, 4 + (0.45 - e.cd) * 16, 1.6, 0.5, 0.4, 1);
      break;
    case 'tank':
      R.poly(SHAPES.hexagon, e.x, e.y, -e.rot * 1.5, s * 0.78, 1.5, r, g, b, 0.7);
      break;
    case 'well': {
      for (let k = 0; k < 3; k++) {
        const ph = 1 - ((e.t * 0.7 + k / 3) % 1);
        R.ring(e.x, e.y, s * (1 + ph * 3.2), 1.4, c[0], c[1], c[2], (1 - ph) * 0.55, 32);
      }
      R.dot(e.x, e.y, s * 0.6, 1.4, 0.8, 1.6, 1);
      break;
    }
  }
  if (e.maxHp > 150 && e.hp < e.maxHp) {
    const w = s * 1.4, k = clamp(e.hp / e.maxHp, 0, 1), y = e.y - s - 14;
    R.line(e.x - w, y, e.x + w, y, 1.6, 0.25, 0.25, 0.35, 0.8);
    R.line(e.x - w, y, e.x - w + 2 * w * k, y, 1.8, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, 1);
  }
}

function drawEnemies(x0, y0, x1, y1) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    const m = e.r * 4 + 40;
    if (e.x < x0 - m || e.x > x1 + m || e.y < y0 - m || e.y > y1 + m) {
      if (!(e.type === 'boss' || e.type === 'dasher' || e.type === 'lancer')) continue;
    }
    drawEnemy(e);
  }
}

function drawBullets() {
  for (const b of G.bullets) {
    const c = b.col, k = b.echo ? 1.05 : 2.0;
    R.line(b.x, b.y, b.x - b.vx * 0.02, b.y - b.vy * 0.02, b.echo ? 2.0 : 2.7, c[0] * k, c[1] * k, c[2] * k, 1);
  }
  const pu = 1 + 0.15 * Math.sin(G.realT * 18);
  for (const b of G.ebullets) {
    R.dot(b.x, b.y, 10 * pu, 1.0, 0.24, 0.16, 1);
    R.dot(b.x, b.y, 4.6, 1.7, 1.4, 1.1, 1);
  }
}

function drawPickups() {
  for (const k of G.pickups) {
    const blink = k.life < 2.5 && ((k.life * 8) | 0) % 2 ? 0.25 : 1;
    if (k.kind === 0) {
      const c = COL.shard;
      R.poly(SHAPES.diamond, k.x, k.y, k.rot, 5.5, 1.4, c[0] * 1.6, c[1] * 1.6, c[2] * 1.6, blink);
    } else {
      const c = COL.heal, s = 9 + Math.sin(G.realT * 6) * 1.5;
      R.line(k.x - s, k.y, k.x + s, k.y, 3, c[0] * 1.6, c[1] * 1.6, c[2] * 1.6, blink);
      R.line(k.x, k.y - s, k.x, k.y + s, 3, c[0] * 1.6, c[1] * 1.6, c[2] * 1.6, blink);
      R.ring(k.x, k.y, 17, 1.4, c[0], c[1], c[2], 0.7 * blink, 20);
    }
  }
}

function drawEchoes() {
  for (const e of G.echoes) {
    const c = e.col, f = e.fade;
    if (f <= 0.01) continue;
    drawTrail(e.trail, c, 0.55 * f, 2.4);
    for (let k = 1; k <= 12; k++) {             // angedeuteter künftiger Flugpfad
      const idx = e.lastIdx + k * 8;
      if (idx >= e.n) break;
      let fx = e.data[idx * 4], fy = e.data[idx * 4 + 1];
      if (e.mirror) { fx = ARENA_W - fx; fy = ARENA_H - fy; }
      R.dot(fx, fy, 2.2, c[0], c[1], c[2], (1 - k / 13) * 0.32 * f);
    }
    const fl = 0.75 + 0.25 * Math.sin(G.realT * 14 + e.id * 1.7), shape = S.ship.shape;
    R.poly(shape, e.x, e.y, e.ang, 14, 1.9, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, f * fl);
    R.polyFill(shape, e.x, e.y, e.ang, 14, c[0], c[1], c[2], 0.12 * f);
    R.dot(e.x, e.y, 10, c[0], c[1], c[2], 0.3 * f);
    if (S.ghost > 0) R.ring(e.x, e.y, 30, 1.2, c[0], c[1], c[2], (0.3 + 0.2 * Math.sin(G.realT * 9 + e.id)) * f, 18);
  }
}

function drawPlayer() {
  const p = G.player;
  if (!p.alive) return;
  const a = p.hurtT > 0 && ((G.realT * 18) | 0) % 2 ? 0.3 : 1;
  const ca = Math.cos(p.ang), sa = Math.sin(p.ang);
  drawTrail(p.trail, COL.pbullet, 0.6 * a, 3);
  const sc = S.ship.col;
  R.poly(S.ship.shape, p.x, p.y, p.ang, 15, 2.2, sc[0], sc[1], sc[2], a);
  R.polyFill(S.ship.shape, p.x, p.y, p.ang, 15, sc[0] * 0.5, sc[1] * 0.5, sc[2] * 0.5, 0.2 * a);
  if (p.dashT > 0 && S.dashDmg > 0) R.ring(p.x, p.y, 38, 2, 1, 0.35, 0.85, 0.8, 22);
  R.dot(p.x, p.y, 5, 1.2, 1.2, 1.2, a);
  R.dot(p.x - ca * 11, p.y - sa * 11, 6 + p.thrust * 6, 0.3, 0.8, 1.0, 0.75 * a);
  if (p.shieldUp) R.poly(SHAPES.hexagon, p.x, p.y, G.realT * 1.2, 28, 1.5, 0.3, 0.9, 1.0, 0.65 + 0.2 * Math.sin(G.realT * 5));
  if (p.resonant) R.ring(p.x, p.y, 38 + Math.sin(G.realT * 12) * 3, 1.2, 1, 0.85, 0.3, 0.6, 24);
  if (G.nova >= 1) R.ring(p.x, p.y, 46 + Math.sin(G.realT * 6) * 4, 1.3, 0.6, 0.9, 1.0, 0.35 + 0.2 * Math.sin(G.realT * 6), 28);
  if (S.drones > 0) {
    const dc = COL.drone;
    for (let k = 0; k < S.drones; k++) {
      const an = p.droneA + (k * TAU) / S.drones, bx = p.x + Math.cos(an) * 48, by = p.y + Math.sin(an) * 48;
      R.poly(SHAPES.diamond, bx, by, an, 6, 1.6, dc[0] * 1.6, dc[1] * 1.6, dc[2] * 1.6, a);
      R.dot(bx, by, 6, dc[0], dc[1], dc[2], 0.4 * a);
    }
  }
  if (S.twin) {
    const tx = ARENA_W - p.x, ty = ARENA_H - p.y, tc = COL.twin, fl = 0.7 + 0.3 * Math.sin(G.realT * 10);
    R.poly(S.ship.shape, tx, ty, p.ang + Math.PI, 15, 2, tc[0] * 1.7, tc[1] * 1.7, tc[2] * 1.7, fl);
    R.polyFill(S.ship.shape, tx, ty, p.ang + Math.PI, 15, tc[0], tc[1], tc[2], 0.15);
    R.ring(tx, ty, 24, 1.1, tc[0], tc[1], tc[2], 0.35, 18);
  }
  if (S.orbit > 0) {
    for (let k = 0; k < S.orbit; k++) {
      const an = p.orbitA + (k * TAU) / S.orbit, bx = p.x + Math.cos(an) * 84, by = p.y + Math.sin(an) * 84;
      R.poly(SHAPES.blade, bx, by, an + Math.PI / 2, 10, 1.8, 1.8, 0.7, 1.5, 1);
      R.dot(bx, by, 9, 1, 0.35, 0.85, 0.5);
      const a2 = an - 0.5;
      R.line(bx, by, p.x + Math.cos(a2) * 84, p.y + Math.sin(a2) * 84, 2, 1, 0.35, 0.85, 0.35);
    }
  }
}

function drawFx() {
  for (const r of G.rings) {
    const t = 1 - r.life / r.max, rad = r.r0 + (r.r1 - r.r0) * easeOut(t), c = r.col, a = (1 - t) * 1.4;
    R.ring(r.x, r.y, Math.max(1, rad), r.w, c[0], c[1], c[2], a);
  }
  for (const b of G.blasts) {                   // Vorwarnung für Explosionen, die dich verletzen
    if (b.dead || b.t <= 0 || !b.max) continue;
    const k = 1 - b.t / b.max;
    if (b.mine) {
      R.ring(b.x, b.y, 9, 2, 0.6, 1.4, 1.6, 0.9, 10);
      R.ring(b.x, b.y, Math.max(2, b.r * k), 1.1, 0.5, 0.9, 1.0, 0.45, 24);
      continue;
    }
    if (!b.hurt) continue;
    const c = b.zap ? b.col : [1.0, 0.3, 0.15];
    R.ring(b.x, b.y, b.r, 1.5, c[0], c[1], c[2], 0.3 + 0.5 * k, 30);
    R.ring(b.x, b.y, Math.max(2, b.r * k), 1.2, 1.0, 0.7, 0.2, 0.6, 24);
    if (b.zap && k > 0.75) R.line(b.x + rand(-30, 30), b.y - 900, b.x, b.y, 2, 1.2, 1.4, 2.2, (k - 0.75) * 3);
  }
  for (const h of G.holes) {
    const t = G.realT;
    for (let j = 0; j < 4; j++) {
      const ph = (t * 0.9 + j / 4) % 1;
      R.ring(h.x, h.y, h.r * (1 - ph) + 12, 1.4, 1.0, 0.3, 0.9, ph * 0.6, 36);
    }
    R.ring(h.x, h.y, 26 + 4 * Math.sin(t * 12), 3, 1.6, 0.6, 1.6, 1, 24);
    R.dot(h.x, h.y, 40, 0.5, 0.1, 0.6, 0.8);
  }
  for (const l of G.lasers) {
    const k = l.life / l.max;
    R.line(l.x0, l.y0, l.x1, l.y1, 3 + 12 * k, 0.6 * k + 0.3, 1.2 * k + 0.4, 1.8, 1);
    R.line(l.x0, l.y0, l.x1, l.y1, 1 + 3 * k, 2.2, 2.2, 2.2, k);
  }
  for (const b of G.beams) {
    const a = (b.life / b.max) * 1.6, segs = 5;
    let px = b.x0, py = b.y0;
    const dx = b.x1 - b.x0, dy = b.y1 - b.y0, l = Math.sqrt(dx * dx + dy * dy) + 0.01, nx = -dy / l, ny = dx / l;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs, o = i < segs ? rand(-12, 12) : 0, qx = b.x0 + dx * t + nx * o, qy = b.y0 + dy * t + ny * o;
      R.line(px, py, qx, qy, 2, 0.8, 0.9, 1.8, a);
      px = qx; py = qy;
    }
  }
  for (const p of G.popups) {
    const t = p.life / 0.8, c = p.col;
    R.num(p.x, p.y - (1 - t) * 34 - p.size, p.str, p.size, c[0] * 1.3 + 0.2, c[1] * 1.3 + 0.2, c[2] * 1.3 + 0.2, Math.min(1, t * 2.2));
  }
}

function updateFx(dt, rdt) {
  for (const r of G.rings) { r.life -= dt; if (r.life <= 0) r.dead = true; }
  for (const b of G.beams) { b.life -= dt; if (b.life <= 0) b.dead = true; }
  for (const l of G.lasers) { l.life -= dt; if (l.life <= 0) l.dead = true; }
  compact(G.lasers);
  for (const p of G.popups) { p.life -= dt; if (p.life <= 0) p.dead = true; }
  compact(G.rings); compact(G.beams); compact(G.popups);
  Particles.update(dt, ARENA_W, ARENA_H);
  Grid.update(dt);
  G.trauma = Math.max(0, G.trauma - rdt * 1.6);
  G.flash = damp(G.flash, 0, 7, rdt);
  G.flashR = damp(G.flashR, 0, 5, rdt);
  G.aberr = damp(G.aberr, 0, 4, rdt);
  G.zoomKick = damp(G.zoomKick, 0, 6, rdt);
  if (G.state !== 'loopend') G.glitch = damp(G.glitch, 0, 3.5, rdt);
  if (G.wave) { G.wave.t += rdt; if (G.wave.t > 0.8) G.wave = null; }
}
