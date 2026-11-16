'use strict';
/* ====== NEON PARADOX — Erweiterung: Spielgefühl, Champions, Missionen, Sterne-Ziele, Kodex,
   Schiffs-Meisterschaft, Tutorial, Barrierefreiheit und Update-Hinweis ====== */
const VERSION = '3.0';
const NEWS = [
  ['Evolutionen', 'Zwei passende Aufwertungen verschmelzen zu einer von zehn Evolutionen.'],
  ['Neue Gegner', 'Schildträger, Heiler, Minenleger und Spiegel – plus Champions mitten im Loop.'],
  ['Bosse', 'Jeder Boss bekommt einen Auftritt und eine dritte Phase. Neuer Endgegner: das ZEITHERZ.'],
  ['Kampagne', 'Akt VI, fünf geheime Bonus-Sektoren und neue Missionen: Kern verteidigen, Splitter sammeln, schrumpfende Zone.'],
  ['Arenen', 'ZAHNWERK und SCHLEUSEN – mit Hindernissen, die sich bewegen.'],
  ['Mehr Kontrolle', 'Karten halten und verbannen, neue Forschung in der Werkstatt, Schiffs-Meisterschaft mit Lackierungen.'],
  ['Und mehr', 'Kodex, Tutorial, Serien-Ansagen, dynamische Musik je Arena, Farbenblind-Modus und weniger Blitze auf Wunsch.'],
];

// ---------------------------------------------------------------- Kodex
const ENEMY_INFO = {
  drifter: 'Treibt stur auf dich zu. Harmlos allein, gefährlich in Massen.',
  weaver: 'Schlängelt sich im Zickzack heran und ist schwer zu treffen.',
  dasher: 'Lädt kurz auf und schießt dann geradlinig auf dich zu.',
  splitter: 'Zerfällt beim Tod in drei flinke Minis.',
  mini: 'Klein, schnell und zahlreich – Nachwuchs von Teilern und Brutstöcken.',
  bomber: 'Zündet in deiner Nähe und reißt alles in der Umgebung mit.',
  shooter: 'Hält Abstand und feuert gezielte Schüsse.',
  lancer: 'Visiert dich an und feuert einen Laserstrahl. Kurz vor dem Schuss steht die Richtung fest.',
  tank: 'Schwer gepanzert. In späten Loops feuert er Kugelringe.',
  well: 'Eine Singularität: zieht dich und deine Geschosse an.',
  phaser: 'Teleportiert sich mit kurzer Vorwarnung neben dich.',
  hive: 'Speit unablässig Minis aus. Zuerst zerstören!',
  guard: 'Ein Frontschild blockt Geschosse. Greif von der Seite an – Echos, Laser und Explosionen umgehen ihn.',
  mender: 'Hält Abstand und repariert Gegner in seiner Nähe. Zuerst ausschalten!',
  layer: 'Umkreist dich und legt Minen, die zünden, wenn du ihnen zu nahe kommst.',
  emine: 'Zündet nach kurzer Warnung, wenn du zu nah bist. Abschießen entschärft sie.',
  reflector: 'Jeder vierte Treffer wird als Dreifach-Salve zu dir zurückgeworfen.',
};
const CODEX_ENEMIES = ['drifter', 'weaver', 'dasher', 'splitter', 'mini', 'bomber', 'shooter', 'lancer', 'tank', 'well', 'phaser', 'hive', 'guard', 'mender', 'layer', 'emine', 'reflector'];

function codexMark(kind, id) {
  if (G.demo || !P.codex) return;
  const c = P.codex[kind] || (P.codex[kind] = {});
  if (c[id]) return;
  c[id] = 1;
  if (kind === 'e' && G.state === 'playing') toast('NEU IM KODEX · ' + (ENEMY_NAMES[id] || id).toUpperCase());
  if (kind === 'e' && CODEX_ENEMIES.every((k) => P.codex.e[k])) award('codex');
}

/** SVG einer Vektorform (Nase zeigt nach oben). */
function shapeSvg(s, sc) {
  const pts = [], k = sc || 1;
  for (let i = 0; i < s.length; i += 2) pts.push((s[i + 1] * k).toFixed(2) + ',' + (-s[i] * k).toFixed(2));
  return `<svg viewBox="-1.8 -1.8 3.6 3.6" aria-hidden="true"><polygon points="${pts.join(' ')}" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="0.1" stroke-linejoin="round"/></svg>`;
}
const cssCol = (c) => `rgb(${c.map((v) => Math.round(Math.min(1, v * 0.85) * 255)).join(',')})`;

// ---------------------------------------------------------------- Ansagen und Serien
let calloutT = 0;
function callout(main, sub, cls) {
  if (G.demo) return;
  const n = $('callout');
  n.className = 'callout' + (cls ? ' ' + cls : '');
  n.innerHTML = `<b>${main}</b>${sub ? `<span>${sub}</span>` : ''}`;
  void n.offsetWidth;
  n.classList.add('show');
  clearTimeout(calloutT);
  calloutT = setTimeout(() => n.classList.remove('show'), 1700);
}

const STREAKS = [[15, 'SERIE'], [30, 'MASSAKER'], [60, 'ZEITSTURM'], [100, 'PARADOX-SERIE'], [160, 'UNAUFHALTSAM'], [250, 'LEGENDÄR']];
const MULT_MARKS = [50, 100, 250, 500, 1000, 2000];

/** Wird bei jedem Abschuss mit Belohnung aufgerufen. */
function onKillFx(e) {
  if (G.demo) return;
  G.streak++; G.streakT = 1.5;
  if (G.streak > G.streakBest) G.streakBest = G.streak;
  for (const [n, name] of STREAKS) {
    if (G.streak !== n) continue;
    const bonus = n * 40 * G.mult;
    G.score += bonus;
    callout(name, `${n} IN FOLGE  ·  +${fmt(bonus)}`, 'streak');
    Sfx.levelUp(); G.zoomKick = 0.03;
    if (n >= 60) award('streak');
  }
  if (e.champ) champKilled(e);
  else if (e.elite) G.hitstop = Math.max(G.hitstop, 0.03);
}

// ---------------------------------------------------------------- Champions (Mini-Bosse mitten im Loop)
const CHAMP_TYPES = ['tank', 'hive', 'shooter', 'lancer', 'guard', 'phaser', 'reflector', 'mender'];
function champEligible() {
  const r = G.run;
  if (G.demo || G.bossLoop || G.goalDone) return false;
  if (r.mode === 'campaign') return !!r.level.champ;
  if (r.mode === 'swarm') return G.loop % 3 === 2;
  if (r.mode === 'paradox' || r.mode === 'daily') return G.loop >= 4;
  return false;
}
function spawnChampion() {
  let pool = CHAMP_TYPES.filter((k) => !G.pool || G.pool.indexOf(k) >= 0);
  if (!pool.length) pool = ['tank', 'shooter'];
  const type = pick(pool), [x, y] = farPoint(420), e = spawnEnemy(type, x, y);
  if (!e) return;
  e.champ = true; e.elite = false; e.ct = false;
  e.r *= 1.7; e.hp = e.maxHp = (e.spec.hp < 100 ? e.spec.hp * 2.5 : e.spec.hp) * G.hpMul * (3 + G.eff * 0.3); e.spawnT = 1.4; e.ccd = 3;
  ring(x, y, 400, 30, 1.2, [2, 1.6, 0.4], 5);
  Grid.blast(x, y, -24, 520);
  callout('CHAMPION', (ENEMY_NAMES[type] || type).toUpperCase() + ' IST ERSCHIENEN', 'warn');
  Sfx.bossWarn();
}
function champUpdate(e, dt) {
  e.ccd -= dt;
  if (e.ccd > 0) return;
  e.ccd = rand(2.6, 3.4);
  const o = rand(TAU), n = 12 + Math.min(8, Math.floor(G.eff / 2));
  for (let k = 0; k < n; k++) spawnEBullet(e.x, e.y, o + (k / n) * TAU, 175 * G.spdMul);
  ring(e.x, e.y, e.r, e.r * 3, 0.3, [2, 1.6, 0.4], 3);
  e.flash = 0.8; Sfx.enemyShot();
}
function champKilled(e) {
  G.champKills++;
  P.stats.champs = (P.stats.champs || 0) + 1;
  if (P.stats.champs >= 10) award('champ');
  const lv = metaLv('m_champ');
  dropShards(e.x, e.y, Math.round(14 * (1 + 0.5 * lv)), 300);
  G.pickups.push({ kind: 1, x: e.x, y: e.y, vx: 0, vy: 0, life: 16, rot: 0, att: 0, dead: false });
  G.score += e.spec.score * 20 * G.mult;
  G.bossBonus = true;
  G.hitstop = Math.max(G.hitstop, 0.09); slowmo(0.3, 0.5); shake(0.6);
  for (let k = 0; k < 3; k++) ring(e.x, e.y, 20, 260 + k * 120, 0.5 + k * 0.1, k % 2 ? COL.shard : [2, 1.6, 0.4], 4);
  callout('CHAMPION BESIEGT', 'NÄCHSTE AUFWERTUNG: MINDESTENS EPISCH', 'cy');
}

// ---------------------------------------------------------------- Missionen: Kern verteidigen, schrumpfende Zone, Splitter sammeln
function missionLoopStart(n) {
  const lv = G.run.level, p = G.player;
  G.core = null; G.zone = null; G.champDone = false;
  G.musLv = G.bossLoop ? 3 : n >= 3 ? 2 : 1;
  if (!lv || G.bossLoop) return;
  if (lv.goal === 'defend') {
    const max = lv.coreHp || 30;
    if (n === 1 || !G.coreHp) G.coreHp = max; else G.coreHp = Math.min(max, G.coreHp + max * 0.2);
    G.core = { x: CX, y: CY, r: 46, hp: G.coreHp, max, hurtT: 0 };
    p.x = CX; p.y = CY + 200;
  } else if (lv.goal === 'shrink') {
    G.zone = { r: 1250, r1: lv.zoneMin || 250, hurtT: 0 };
  }
}
function coreTouch(e) {
  const c = G.core, dx = e.x - c.x, dy = e.y - c.y, rr = c.r + e.r;
  if (dx * dx + dy * dy > rr * rr) return false;
  coreDamage(e.type === 'boss' ? 6 : e.spec.cost >= 3 ? 2 : 1);
  killEnemy(e, true);
  return true;
}
function coreDamage(n) {
  const c = G.core;
  if (!c || G.state !== 'playing') return;
  c.hp -= n; G.coreHp = c.hp; c.hurtT = 0.4;
  ring(c.x, c.y, c.r, c.r * 3, 0.35, [1, 0.3, 0.3], 3);
  Grid.blast(c.x, c.y, 10, 240); shake(0.15);
  if (c.hp <= 0) {
    G.core = null; G.coreHp = 0;
    for (let k = 0; k < 5; k++) ring(c.x, c.y, 20, 300 + k * 150, 0.6 + k * 0.1, k % 2 ? COL.fire : COL.white, 5);
    Particles.burst(c.x, c.y, 260, COL.fire, 100, 1100, 0.4, 1.4, 2.8, 1.5);
    G.failMsg = 'DER KERN WURDE ZERSTÖRT';
    playerDie();
  } else if (c.hp <= c.max * 0.3 && !c.warned) { c.warned = true; callout('KERN KRITISCH', 'VERTEIDIGE IHN!', 'warn'); }
}

// ---------------------------------------------------------------- Sterne-Ziele der Kampagne
function starGoal(lv) { return lv.s3 || { t: 'nohit' }; }
function starGoalText(g) {
  switch (g.t) {
    case 'time': return 'in unter ' + mmss(g.v);
    case 'mult': return 'Multiplikator ×' + g.v + ' erreichen';
    case 'nodash': return 'ohne Dash';
    case 'nonova': return 'ohne Nova';
    case 'novas': return g.v + '× die Nova zünden';
    case 'streak': return 'eine Serie von ' + g.v + ' Abschüssen';
    case 'core': return 'Kern über ' + g.v + ' % halten';
    default: return 'kein Treffer';
  }
}
function starGoalMet(g) {
  switch (g.t) {
    case 'time': return G.runT <= g.v;
    case 'mult': return G.maxMult >= g.v;
    case 'nodash': return G.dashes === 0;
    case 'nonova': return G.novas === 0;
    case 'novas': return G.novas >= g.v;
    case 'streak': return G.streakBest >= g.v;
    case 'core': return (G.coreHp || 0) / ((G.run.level.coreHp) || 30) * 100 > g.v;
    default: return G.hitsTaken === 0;
  }
}
function campaignStars() {
  return 1 + (G.hitsTaken <= 2 ? 1 : 0) + (starGoalMet(starGoal(G.run.level)) ? 1 : 0);
}
const starRule = (lv) => `★ abschließen  ·  ★ höchstens 2 Treffer  ·  ★ ${starGoalText(starGoal(lv))}`;

// ---------------------------------------------------------------- Schiffs-Meisterschaft
const MASTERY_XP = [0, 300, 800, 1500, 2400, 3500, 4800, 6300, 8000, 10000];
const PAINTS = [
  null,
  { name: 'EIS', col: [0.8, 1.9, 2.1], css: '#9cf6ff', lv: 2 },
  { name: 'NEON', col: [2.1, 0.75, 1.8], css: '#ff86e6', lv: 4 },
  { name: 'GOLD', col: [2.2, 1.6, 0.45], css: '#ffd36b', lv: 8 },
];
const MASTER_BONUS = {
  vektor: ['Nova lädt 20 % schneller', (s) => { s.novaRate *= 1.2; }],
  phantom: ['Dash lädt weitere 15 % schneller', (s) => { s.dashCd *= 0.85; }],
  bastion: ['+1 Phasenschild', (s) => { s.shield += 1; }],
  prisma: ['+1 Abpraller', (s) => { s.bounce += 1; }],
  chronos: ['+1 Echo gleichzeitig', (s) => { s.echoCap += 1; }],
  nexus: ['+1 Kampfdrohne', (s) => { s.drones += 1; }],
};
function masteryLv(ship) {
  const x = (P.mastery && P.mastery[ship]) || 0;
  let l = 1;
  while (l < 10 && x >= MASTERY_XP[l]) l++;
  return l;
}
function masteryRewards(ship) {
  return [
    [2, 'Lackierung EIS'], [3, 'Funkenspur'], [4, 'Lackierung NEON'], [5, '+1 Neuwurf pro Lauf'],
    [6, 'Meister-Bonus: ' + MASTER_BONUS[ship][0]], [8, 'Lackierung GOLD'], [10, '+8 % Schaden'],
  ];
}
function applyMastery(s, ship) {
  const lv = masteryLv(ship);
  if (lv >= 6 && MASTER_BONUS[ship]) MASTER_BONUS[ship][1](s);
  if (lv >= 10) s.dmg *= 1.08;
  s.trailFx = lv >= 3;
  const pi = (P.paint && P.paint[ship]) || 0, pt = PAINTS[pi];
  if (pt && lv >= pt.lv) s.shipCol = pt.col;
}

// ---------------------------------------------------------------- Boss-Auftritt
function bossIntro(e) {
  const L = e.lvl, n = $('bosscard');
  codexMark('b', String(Math.min(L, BOSS_NAMES.length)));
  n.style.setProperty('--c', cssCol(e.col));
  n.innerHTML = `<i>${G.run.mode === 'campaign' && G.run.level.boss ? 'ENDGEGNER' : 'BOSS'}  ·  STUFE ${L}</i><b>${e.bname}</b><span>${BOSS_TITLES[Math.min(L, BOSS_TITLES.length) - 1]}</span>`;
  n.classList.remove('show'); void n.offsetWidth; n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 2600);
  slowmo(0.45, 1.1);
}

// ---------------------------------------------------------------- Tutorial
const TUT = [
  { t: 'BEWEGE DICH', s: () => G.touch ? 'Ziehe mit dem linken Daumen irgendwo auf der linken Bildschirmhälfte.' : 'Steuere mit ' + keyLabel(keyOf('up')) + ' ' + keyLabel(keyOf('left')) + ' ' + keyLabel(keyOf('down')) + ' ' + keyLabel(keyOf('right')) + ' oder den Pfeiltasten.',
    done: () => G.tutMoved > 1100 },
  { t: 'FEUER FREI', s: () => G.touch ? 'Dein Schiff zielt und feuert von selbst. Zerstöre 8 Gegner.' : 'Du feuerst automatisch, gezielt wird mit der Maus. Zerstöre 8 Gegner.',
    foes: 3, done: () => G.kills >= 8 },
  { t: 'SPLITTER', s: () => 'Gegner lassen goldene Splitter fallen. Sammle sie – jeder erhöht deinen Punkte-Multiplikator.',
    foes: 4, done: () => G.mult >= 16 },
  { t: 'DASH', s: () => (G.touch ? 'Tippe auf DASH' : 'Drücke ' + keyLabel(keyOf('dash'))) + ' – für einen Moment bist du unverwundbar. Zweimal dashen.',
    foes: 2, done: () => G.dashes - G.tutD0 >= 2 },
  { t: 'NOVA', s: () => 'Deine Nova ist geladen. ' + (G.touch ? 'Tippe auf NOVA' : 'Drücke ' + keyLabel(keyOf('nova')) + ' oder die rechte Maustaste') + ', wenn dich viele Gegner umzingeln.',
    enter: () => { G.nova = 1; for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, p = G.player, e = spawnEnemy('drifter', p.x + Math.cos(a) * 330, p.y + Math.sin(a) * 330); if (e) e.spawnT = 0.5; } },
    done: () => G.novas >= 1 },
  { t: 'ZEITSCHLEIFE', s: () => 'Gleich endet der Loop. Dein Flug wurde aufgezeichnet und kämpft ab jetzt als Echo an deiner Seite.',
    enter: () => { G.loopDur = G.loopT + 5; }, done: () => false },
];
function tutShow() {
  const n = $('tut'), st = TUT[G.tutStep];
  if (!st || G.run.mode !== 'tutorial' || G.loop !== 1) { n.classList.add('hidden'); return; }
  n.classList.remove('hidden');
  n.innerHTML = `<i>SCHRITT ${G.tutStep + 1} / ${TUT.length}</i><b>${st.t}</b><span>${st.s()}</span>`;
}
function tutUpdate(dt) {
  const p = G.player, st = TUT[G.tutStep];
  if (!st) return;
  p.invuln = Math.max(p.invuln, 0.15);
  G.tutMoved += Math.sqrt(p.vx * p.vx + p.vy * p.vy) * dt;
  if (st.foes) {
    G.tutSpawnT -= dt;
    let n = 0;
    for (const e of G.enemies) if (!e.dead) n++;
    if (n < st.foes && G.tutSpawnT <= 0) {
      G.tutSpawnT = 0.8;
      const [x, y] = farPoint(380), e = spawnEnemy('drifter', x, y);
      if (e) e.spawnT = 0.6;
    }
  }
  if (st.done()) {
    G.tutStep++; G.tutD0 = G.dashes;
    Sfx.levelUp();
    ring(p.x, p.y, 20, 220, 0.5, COL.heal, 3);
    const nx = TUT[G.tutStep];
    if (nx && nx.enter) nx.enter();
    tutShow();
  }
}

// ---------------------------------------------------------------- Pro Frame (nur im laufenden Spiel)
function updateExtras(dt) {
  if (G.demo) return;
  const run = G.run, lv = run.level, p = G.player;
  if (G.streakT > 0) { G.streakT -= dt; if (G.streakT <= 0) G.streak = 0; }
  while (G.multMark < MULT_MARKS.length && G.mult >= MULT_MARKS[G.multMark]) {
    callout('×' + MULT_MARKS[G.multMark], 'MULTIPLIKATOR', 'gold');
    G.multMark++;
  }
  if (run.mode === 'tutorial' && G.loop === 1) tutUpdate(dt);
  if (!G.champDone && champEligible() && (run.mode === 'swarm' ? G.loopT > 8 : G.loopT > G.loopDur * 0.22)) {
    G.champDone = true;
    spawnChampion();
  }
  if (G.core) {                                  // Kern verteidigen: Feindgeschosse treffen ihn auch
    const c = G.core;
    if (c.hurtT > 0) c.hurtT -= dt;
    c.pulseT = (c.pulseT || 0) + dt;
    if (c.pulseT >= 4.5) {                       // Der Kern wehrt sich mit einer Schockwelle
      c.pulseT = 0;
      ring(c.x, c.y, c.r, 190, 0.45, COL.nova, 4); Grid.blast(c.x, c.y, 14, 300);
      knockback(c.x, c.y, 190, 520);
      forNear(c.x, c.y, 190, (e) => { const dx = e.x - c.x, dy = e.y - c.y; if (dx * dx + dy * dy < 190 * 190) hitEnemy(e, S.dmg * 5 + 15 * G.eff, e.x, e.y, false, true); return false; });
    }
    for (const b of G.ebullets) {
      if (b.dead) continue;
      const dx = b.x - c.x, dy = b.y - c.y;
      if (dx * dx + dy * dy < c.r * c.r) { b.dead = true; coreDamage(0.5); if (!G.core) break; }
    }
  }
  if (G.zone) {                                  // schrumpfende Zone
    const z = G.zone;
    z.r = 1250 + (z.r1 - 1250) * clamp(G.loopT / (G.loopDur * 0.8), 0, 1);
    const dx = p.x - CX, dy = p.y - CY;
    if (dx * dx + dy * dy > z.r * z.r && p.alive) {
      z.hurtT += dt;
      if (z.hurtT >= 0.9) { z.hurtT = 0; hurtPlayer(); }
    } else z.hurtT = 0;
  }
  if (lv && lv.collect && G.shardsGot >= lv.collect && G.state === 'playing') { G.goalDone = true; endLoop(); return; }
  // dynamische Musik: volle Arena oder lange Serie -> volle Besetzung
  if (!G.bossLoop && run.mode !== 'tutorial') {
    const base = G.loop >= 3 ? 2 : 1, want = G.enemies.length > 70 || G.streak >= 30 ? 3 : base;
    if (want !== G.musLv) { G.musLv = want; Sfx.music(want); }
  }
  // Funkenspur (Meisterschaft)
  if (S.trailFx && p.alive && Math.random() < dt * 40) {
    const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (sp > 80) { const c = S.shipCol; Particles.spawn(p.x, p.y, rand(-30, 30), rand(-30, 30), 0.5, c[0] * 0.6, c[1] * 0.6, c[2] * 0.6, 1.6, 1); }
  }
}

/** Autopilot: in der schrumpfenden Zone zur Mitte steuern. */
function zoneBot() {
  const z = G.zone, p = G.player;
  if (!z) return;
  const dx = CX - p.x, dy = CY - p.y, d = Math.sqrt(dx * dx + dy * dy) + 0.01, lim = z.r - 160;
  if (d < lim) return;
  const k = clamp((d - lim) / 120, 0, 1);
  Input.ax = Input.ax * (1 - k) + (dx / d) * k; Input.ay = Input.ay * (1 - k) + (dy / d) * k;
}

/** Zusätzliche Zeichnungen: Kern, Zone, Champions. */
function drawExtras() {
  const t = G.realT;
  if (G.core) {
    const c = G.core, k = clamp(c.hp / c.max, 0, 1), hr = c.hurtT > 0 ? 1 : 0;
    const col = [0.4 + 1.2 * (1 - k) + hr, 1.2 * k + 0.2, 1.4 * k + 0.2];
    R.ring(c.x, c.y, c.r, 3, col[0], col[1], col[2], 1, 40);
    R.ring(c.x, c.y, c.r * (0.55 + 0.1 * Math.sin(t * 4)), 2, col[0], col[1], col[2], 0.8, 24);
    R.dot(c.x, c.y, c.r * 0.9, col[0] * 0.3, col[1] * 0.3, col[2] * 0.3, 0.9);
    for (let i = 0; i < 24; i++) {
      if (i / 24 > k) break;
      const a0 = -Math.PI / 2 + (i / 24) * TAU, a1 = a0 + TAU / 24 - 0.05, rr = c.r + 14;
      R.line(c.x + Math.cos(a0) * rr, c.y + Math.sin(a0) * rr, c.x + Math.cos(a1) * rr, c.y + Math.sin(a1) * rr, 3, col[0], col[1], col[2], 0.95);
    }
  }
  if (G.zone) {
    const z = G.zone, a = 0.6 + 0.3 * Math.sin(t * 6);
    R.ring(CX, CY, z.r, 3, 1.6, 0.25, 0.3, a, 120);
    R.ring(CX, CY, z.r + 14, 1.2, 1.2, 0.2, 0.25, a * 0.5, 120);
  }
  for (const e of G.enemies) {
    if (!e.champ || e.dead || e.spawnT > 0) continue;
    const s = e.r;
    R.ring(e.x, e.y, s * 1.55, 2, 2.0, 1.55, 0.4, 0.7 + 0.3 * Math.sin(t * 7), 30);
    R.poly(SHAPES.diamond, e.x, e.y, t * 1.4, s * 1.9, 1.3, 2.0, 1.55, 0.4, 0.55);
    R.poly(SHAPES.diamond, e.x, e.y, -t * 1.1, s * 1.9, 1.3, 2.0, 1.55, 0.4, 0.4);
  }
}

// ---------------------------------------------------------------- Barrierefreiheit
function applyA11y() {
  COL.ebullet = P.settings.cb ? [1.0, 0.85, 0.1] : [1.0, 0.28, 0.2];
}
/** Weniger Blitze: dämpft Lichtblitze, Glitch und Wellen im Nachbearbeitungs-Shader. */
function a11yPost(post) {
  if (!P.settings.calm) return;
  post.flash[0] *= 0.25; post.flash[1] *= 0.25; post.flash[2] *= 0.25;
  post.glitch *= 0.25; post.aberr = Math.min(post.aberr, 0.004); post.danger *= 0.5; post.wave[3] *= 0.3;
}

// ---------------------------------------------------------------- Neuigkeiten und Update-Hinweis
function checkNews() {
  const isNew = P.ver !== VERSION, veteran = !!P.ver || P.stats.runs > 0;
  P.ver = VERSION;
  saveProfile();
  if (isNew && veteran) showNews();
}
function showNews() {
  const n = $('news');
  n.innerHTML = `<div class="news-box"><div class="kicker">NEU IN VERSION ${VERSION}</div><h2>WAS IST NEU?</h2><ul>` +
    NEWS.map(([a, b]) => `<li><b>${a}</b><span>${b}</span></li>`).join('') +
    '</ul><button class="btn big" id="news-ok">LOS GEHT\'S</button></div>';
  n.classList.add('show');
  $('news-ok').addEventListener('click', () => { n.classList.remove('show'); Sfx.pick(); });
}
function checkUpdate() {
  if (location.protocol !== 'https:') return;
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
    .then((r) => r.json())
    .then((v) => { if (v && v.version && v.version !== VERSION) $('update').classList.add('show'); })
    .catch(() => {});
}
function bindExtras() {
  $('update').addEventListener('click', () => location.reload());
  document.addEventListener('click', (ev) => { if (ev.target.closest && ev.target.closest('#btn-news')) showNews(); });
  setInterval(checkUpdate, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
  setTimeout(checkUpdate, 4000);
  checkNews();
}

// ---------------------------------------------------------------- Balance-Test (Konsole: NP.simSector(16))
/** Lässt den Autopiloten einen Sektor spielen und meldet das Ergebnis (nur zum Testen). */
function simSector(i, maxSec) {
  startGame({ mode: 'campaign', level: i });
  G.bot = true;
  const lim = (maxSec || 400) * 60;
  for (let f = 0; f < lim; f++) {
    update(1 / 60);
    if (G.state === 'upgrade') { upgradeLockT = 0; pickCard(0); }
    if (G.state === 'gameover') break;
  }
  const r = { sector: CAMPAIGN[i].id, won: G.victory, loop: G.loop, time: Math.round(G.runT), hits: G.hitsTaken, mult: G.maxMult,
    stars: G.victory ? campaignStars() : 0, champs: G.champKills, kills: G.kills };
  G.bot = false;
  return r;
}
