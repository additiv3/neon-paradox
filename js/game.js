'use strict';
/* ====== NEON PARADOX — Spielablauf, Modi, HUD, Hauptschleife ====== */
const $ = (id) => document.getElementById(id);
const BOT_PARAM = new URLSearchParams(location.search).has('bot');
const el = {};
const hudCache = {};
const STARS = [];
const ui = { screen: 'screen-title' };
const post = {
  time: 0, aberr: 0, bloom: 0.2, glitch: 0, danger: 0, desat: 0, dark: 0,
  flash: [0, 0, 0], wave: [0, 0, 0, 0], camOff: [0, 0], lights: new Float32Array(30), lightN: 0,
};
let lastT = 0, upgradeLockT = 0, perfAcc = 0, perfN = 0, lastTick = -1;
/** Touch-Steuerung: linker Daumen bewegt, rechter zielt (optional – sonst zielt das Schiff selbst). */
const Pad = { move: null, aim: null };
const STICK_R = 54;

function save() {
  P.muted = Sfx.isMuted();
  P.autoFire = G.autoFire;
  saveProfile();
}

// ---------------------------------------------------------------- UI-Helfer
function show(id) {
  ui.screen = id;
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id);
}
function banner(main, sub, cls) {
  if (G.demo) return;
  el.banner.className = cls || '';
  el.banner.innerHTML = `<div class="b-main">${main}</div>${sub ? `<div class="b-sub">${sub}</div>` : ''}`;
  void el.banner.offsetWidth;
  el.banner.classList.add('show');
}
function toast(text) {
  if (G.demo) return;
  el.toast.textContent = text;
  el.toast.classList.remove('show');
  void el.toast.offsetWidth;
  el.toast.classList.add('show');
}
function clearOverlays() {
  el.banner.className = '';
  el.toast.classList.remove('show');
}
function setTxt(node, key, val) {
  if (hudCache[key] !== val) { hudCache[key] = val; node.textContent = val; }
}
function toggleCls(node, cls, on, key) {
  if (hudCache[key] !== on) { hudCache[key] = on; node.classList.toggle(cls, on); }
}
function blurActive() {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function updateSoundLabel() { el.btnSound.textContent = 'TON: ' + (Sfx.isMuted() ? 'AUS' : 'AN'); }
function toggleMute() {
  Sfx.setMuted(!Sfx.isMuted());
  updateSoundLabel(); save();
  toast(Sfx.isMuted() ? 'TON AUS' : 'TON AN');
}
const mmss = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

// ---------------------------------------------------------------- Lauf-Konfiguration je Modus
function buildRun(cfg) {
  const run = { mode: cfg.mode, ship: P.ship, level: null, levelIdx: -1, muts: {}, mutList: [], scoreMul: 1, start: null, dailyKey: null };
  let list = cfg.muts || [];
  if (cfg.mode === 'campaign') {
    run.levelIdx = cfg.level; run.level = CAMPAIGN[cfg.level];
    list = run.level.muts || []; run.start = run.level.start || null;
  } else if (cfg.mode === 'daily') {
    const d = dailyInfo();
    list = d.muts; run.start = d.start; run.dailyKey = d.key;
  }
  for (const id of list) {
    if (!MUTATORS[id] || run.muts[id]) continue;
    run.muts[id] = true; run.mutList.push(id); run.scoreMul *= 1 + MUTATORS[id].bonus;
  }
  return run;
}

function loopDurFor(n) {
  if (G.demo) return 14;
  const r = G.run;
  if (r.mode === 'swarm') return 20;
  if (r.muts.shortloop) return n === 1 ? 12 : 15;
  if (r.mode === 'campaign') return n === 1 ? 20 : 25;
  return n === 1 ? 22 : 30;
}
function isBossLoop(n) {
  if (G.demo) return false;
  const r = G.run;
  if (r.mode === 'bossrush') return true;
  if (r.mode === 'swarm') return false;
  if (r.mode === 'campaign') return !!r.level.boss && n === r.level.loops + 1;
  return n % 5 === 0;
}
function bossLevelFor(n) {
  const r = G.run;
  if (r.mode === 'bossrush') return n;
  if (r.mode === 'campaign') return r.level.boss || 1;
  if (r.mode === 'swarm') return Math.floor(n / 6);
  return Math.floor(n / 5);
}
function effFor(n) {
  if (G.demo) return Math.min(n, 6);
  const r = G.run;
  if (r.mode === 'campaign') return r.level.eff + (n - 1) * (r.level.step || 1);
  if (r.mode === 'swarm') return 1 + (n - 1) * 0.6;
  if (r.mode === 'bossrush') return 1 + n;
  return n;
}

/** Schwierigkeit, Spawn-Rate und Gegner-Auswahl für Loop n. */
function setLoopParams(n) {
  const run = G.run, m = run.muts, eff = effFor(n);
  G.loopDur = loopDurFor(n);
  G.bossLoop = isBossLoop(n);
  G.bossLv = Math.max(1, bossLevelFor(n));
  G.eff = eff;
  G.hpMul = (1 + 0.14 * (eff - 1) + 0.012 * (eff - 1) * (eff - 1)) * (m.swarm ? 0.8 : 1) * (m.elite ? 1.5 : 1);
  G.spdMul = (1 + Math.min(0.4, 0.025 * (eff - 1))) * (m.fast ? 1.3 : 1);
  const budget = (22 + 22 * eff + 4.2 * eff * eff) * (m.swarm ? 1.6 : 1);
  const firstLoop = n === 1 && !G.demo && run.mode !== 'swarm';
  G.budget = budget;
  G.spawnRate = G.bossLoop ? (budget * (run.mode === 'bossrush' ? 0.1 : 0.18)) / 24.6 : budget / (firstLoop ? 16.6 : 24.6);
  G.pool = run.level && run.level.pool ? run.level.pool : null;
}

function modeLine() {
  const r = G.run;
  let s = MODES[r.mode].name;
  if (r.mode === 'campaign') s = 'SEKTOR ' + (r.levelIdx + 1) + ' · ' + r.level.name.toUpperCase();
  const m = r.mutList.map((id) => MUTATORS[id].name.toUpperCase());
  return m.length ? s + '  ·  ' + m.join(' + ') : s;
}
function loopLabel() {
  const r = G.run, n = G.loop;
  if (r.mode === 'bossrush') return 'BOSS ' + Math.max(1, n);
  if (r.mode === 'swarm') return 'ZEITRISS ' + n;
  if (r.mode === 'campaign') return G.bossLoop ? 'BOSSKAMPF' : 'LOOP ' + n + '/' + r.level.loops;
  return (G.bossLoop ? 'BOSS · ' : '') + 'LOOP ' + n;
}

// ---------------------------------------------------------------- Ablauf
function startDemo(screen) {
  G.demo = true; G.bot = true;
  G.run = { mode: 'demo', ship: P.ship, level: null, levelIdx: -1, muts: {}, mutList: [], scoreMul: 1, start: null };
  Sfx.setQuiet(true); Sfx.music(0); Sfx.muffle(false);
  newRun();
  G.up = { multi: 1, rate: 2, dmg: 2, pierce: 1 };
  recomputeStats();
  G.player.hp = S.maxHp;
  G.demoPicks = 0;
  el.hud.classList.add('hidden');
  clearOverlays();
  document.body.classList.remove('playing');
  const ri = rankInfo(P.xp), best = P.best.paradox || 0;
  el.best.textContent = (P.xp > 0 || best > 0) ? `RANG ${ri.rank} · ${ri.name}` + (best > 0 ? `   ·   REKORD ${fmt(best)}` : '') : '';
  show(screen || 'screen-title');
  startLoop(3);
}

/** Startet einen Lauf. cfg = { mode, muts?: [...], level?: Index des Kampagnen-Sektors }. */
function startGame(cfg) {
  if (!cfg || !cfg.mode) cfg = G.lastCfg || { mode: 'paradox', muts: [] };
  G.lastCfg = cfg;
  Sfx.init();
  G.demo = false; G.bot = BOT_PARAM; G.victory = false;
  Sfx.setQuiet(false); Sfx.muffle(false);
  G.run = buildRun(cfg);
  newRun();
  const run = G.run, p = G.player;
  if (run.start) for (const id in run.start) G.up[id] = run.start[id];
  recomputeStats();
  p.hp = S.maxHp;
  p.shieldUp = S.shield > 0;
  G.nova = Math.min(1, 0.2 * metaLv('m_nova'));
  G.rerolls = 1 + metaLv('m_reroll');
  for (const k in hudCache) delete hudCache[k];
  el.mode.textContent = modeLine();
  clearOverlays();
  show(null);
  el.hud.classList.remove('hidden');
  document.body.classList.add('playing');
  blurActive();
  if (run.mode === 'bossrush') openUpgrades(5, 'BOSS-RUSH  ·  WÄHLE DEINE AUSRÜSTUNG');
  else if (run.mode === 'swarm') openUpgrades(2, 'SCHWARM  ·  WÄHLE DEINE AUSRÜSTUNG');
  else startLoop(1);
}

function startLoop(n) {
  const p = G.player, run = G.run;
  G.loop = n; G.loopT = 0; lastTick = -1;
  setLoopParams(n);
  G.spawnAcc = G.budget * 0.1; G.packT = 0.2;
  G.boss = null; G.bossSpawned = false; G.bossEndT = 0; G.bossHits = 0;
  G.enemies.length = 0; G.bullets.length = 0; G.ebullets.length = 0; G.blasts.length = 0; G.pickups.length = 0;
  p.x = CX; p.y = CY; p.vx = 0; p.vy = 0; p.invuln = 1.2; p.hurtT = 0; p.dashT = 0; p.fireCd = 0.5; p.trail.length = 0;
  Input.dashPressed = false; Input.novaPressed = false;
  G.rec = { data: new Float32Array(REC_MAX * 4), n: 0 };
  buildEchoes();
  G.glitch = 0.6;
  G.state = 'playing';

  ring(CX, CY, 20, 520, 0.7, COL.nova, 5);
  ring(CX, CY, 10, 300, 0.5, COL.magenta, 3);
  Grid.blast(CX, CY, 34, 800);
  Particles.burst(CX, CY, 60, COL.nova, 100, 700, 0.3, 0.9, 2.2);
  Sfx.loopStart();
  Sfx.music(G.demo ? 0 : G.bossLoop ? 3 : n >= 3 ? 2 : 1);
  if (G.demo) return;

  const k = G.echoes.length, echoTxt = k + (k === 1 ? ' ECHO' : ' ECHOS') + ' SYNCHRONISIERT';
  if (run.mode === 'paradox' && n >= 10) award('loop10');
  if (G.bossLoop) {
    banner('WARNUNG', bossName(G.bossLv) + ' NÄHERT SICH', 'warn');
    Sfx.bossWarn();
  } else if (run.mode === 'campaign') {
    if (n === 1) banner(run.level.name.toUpperCase(), 'SEKTOR ' + (run.levelIdx + 1) + '  ·  ' + campaignGoal(run.level).toUpperCase());
    else banner('LOOP ' + n + '/' + run.level.loops, echoTxt);
  } else if (run.mode === 'swarm') {
    banner('SCHWARM', 'ÜBERLEBE, SO LANGE DU KANNST');
  } else if (n === 1) banner('LOOP 1', S.pacifist ? 'WEICH AUS — DEINE ECHOS WERDEN FÜR DICH FEUERN' : G.touch ? 'LINKER DAUMEN BEWEGT — DEIN SCHIFF ZIELT VON SELBST' : 'ÜBERLEBE — DEIN FLUG WIRD AUFGEZEICHNET');
  else if (n === 2) banner('LOOP 2', 'DEIN ECHO KÄMPFT JETZT AN DEINER SEITE');
  else banner('LOOP ' + n, echoTxt);
}

/** Schwarm-Modus: neues Echo ohne Zurückspulen – die Gegner bleiben. */
function softLoop() {
  const p = G.player, n = G.loop + 1;
  saveRecording();
  G.loopsDone++;
  award('first_loop');
  G.loop = n; G.loopT = 0; lastTick = -1;
  setLoopParams(n);
  G.rec = { data: new Float32Array(REC_MAX * 4), n: 0 };
  buildEchoes();
  G.glitch = 0.45;
  ring(p.x, p.y, 20, 420, 0.6, COL.nova, 4);
  Grid.blast(p.x, p.y, 22, 600);
  Sfx.loopStart();
  if (G.runT >= 300) award('swarm5');
  if (n % 6 === 0) {
    spawnBoss();
    banner('WARNUNG', bossName(G.bossLv) + ' NÄHERT SICH', 'warn');
    Sfx.bossWarn();
  } else toast('ZEITRISS ' + n + '  ·  NEUES ECHO');
  Sfx.music(G.boss ? 3 : n >= 3 ? 2 : 1);
}

function endLoop() {
  if (G.state !== 'playing') return;
  G.state = 'loopend'; G.endT = 0;
  saveRecording();
  G.loopsDone++;
  award('first_loop');
  for (const e of G.enemies) e.dieAt = rand(0.05, 0.75);
  for (const b of G.ebullets) { b.dead = true; Particles.burst(b.x, b.y, 2, COL.ebullet, 40, 160, 0.15, 0.4, 1.5); }
  G.blasts.length = 0;
  Grid.blast(CX, CY, -24, 1500);
  wave(G.player.x, G.player.y, 1.3);
  G.glitch = 1; shake(0.45);
  Sfx.loopEnd();
  if (!G.demo) Sfx.muffle(true);
  banner(G.bossLoop ? 'BOSS VERNICHTET' : `LOOP ${G.loop} ÜBERSTANDEN`, 'ZEITLINIE WIRD ZURÜCKGESPULT', 'cy');
}

function demoUpgrade() {
  if (G.demoPicks >= 9) return;
  const u = UPGRADE_BY_ID[pick(['rate', 'dmg', 'multi', 'echocap', 'chain', 'orbit', 'bounce', 'homing', 'explode', 'echopow', 'mirror'])];
  if ((G.up[u.id] || 0) < Math.min(u.max, 2)) { applyUpgrade(u); G.demoPicks++; }
}

function afterLoopEnd() {
  G.enemies.length = 0; G.bullets.length = 0; G.ebullets.length = 0;
  if (G.demo) { demoUpgrade(); startLoop(G.loop + 1); return; }
  const run = G.run;
  if (run.mode === 'campaign' && G.loop >= campaignLoops(run.level)) { victory(); return; }
  let picks = 1 + G.pendingPicks;
  G.pendingPicks = 0;
  if (G.bossLoop) { picks++; G.player.hp = Math.min(S.maxHp, G.player.hp + 1); }
  if (run.mode === 'bossrush') picks++;
  openUpgrades(picks, (G.bossLoop ? 'BOSS VERNICHTET' : `LOOP ${G.loop} ÜBERSTANDEN`) + '  ·  ECHO AUFGEZEICHNET');
}

// ---------------------------------------------------------------- Aufwertungen
function openUpgrades(n, kicker, resume) {
  G.picksLeft = n;
  G.upResume = !!resume;
  G.state = 'upgrade';
  clearOverlays();
  document.body.classList.remove('playing');
  el.upKicker.textContent = kicker || '';
  if (resume) Sfx.muffle(true);
  show('screen-upgrade');
  rollCards();
}

function rollCards() {
  G.cards = rollUpgrades(3);
  if (!G.cards.length) { finishUpgrades(); return; }
  upgradeLockT = performance.now() + 450;
  el.upLeft.textContent = G.picksLeft > 1 ? `NOCH ${G.picksLeft} AUSWAHLEN` : '';
  el.btnReroll.classList.toggle('hidden', G.rerolls <= 0);
  el.btnReroll.textContent = `NEU WÜRFELN (${G.rerolls})`;
  el.cards.innerHTML = G.cards.map((u, i) => {
    const lv = G.up[u.id] || 0, rar = RARITY[u.rarity];
    const lvl = u.max >= 99 ? 'SOFORT' : `STUFE ${lv} → ${lv + 1}${lv + 1 >= u.max ? ' · MAX' : ''}`;
    return `<button class="card ${rar.cls}" data-i="${i}" style="animation-delay:${i * 70}ms">` +
      `<span class="card-key">${i + 1}</span><span class="card-icon">${upgradeIcon(u)}</span>` +
      `<span class="card-rarity">${rar.name}</span><span class="card-name">${u.name}</span>` +
      `<span class="card-desc">${u.desc}</span><span class="card-lvl">${lvl}</span></button>`;
  }).join('');
}

function rerollCards() {
  if (G.state !== 'upgrade' || G.rerolls <= 0 || performance.now() < upgradeLockT) return;
  G.rerolls--;
  Sfx.pick();
  rollCards();
}

function pickCard(i) {
  if (G.state !== 'upgrade' || performance.now() < upgradeLockT) return;
  const u = G.cards && G.cards[i];
  if (!u) return;
  applyUpgrade(u);
  Sfx.pick();
  G.picksLeft--;
  if (G.picksLeft > 0) rollCards(); else finishUpgrades();
}

function finishUpgrades() {
  show(null);
  document.body.classList.add('playing');
  blurActive();
  Sfx.muffle(false);
  if (G.upResume) {                     // Schwarm: mitten im Gefecht weiter
    G.upResume = false;
    G.state = 'playing';
    G.player.invuln = Math.max(G.player.invuln, 0.9);
    ring(G.player.x, G.player.y, 20, 260, 0.4, COL.shard, 3);
    knockback(G.player.x, G.player.y, 220, 380);
  } else startLoop(G.loop + 1);
}

// ---------------------------------------------------------------- Ende eines Laufs
function playerDie() {
  const p = G.player;
  p.alive = false;
  G.state = 'dead'; G.deadT = 0;
  ring(p.x, p.y, 20, 700, 0.9, COL.white, 7);
  ring(p.x, p.y, 10, 420, 0.7, [1, 0.3, 0.3], 5);
  Particles.burst(p.x, p.y, 220, [1, 0.5, 0.3], 100, 1200, 0.4, 1.6, 2.8, 1.6);
  Particles.burst(p.x, p.y, 120, COL.white, 80, 800, 0.4, 1.2, 2.2, 1.6);
  Grid.blast(p.x, p.y, 55, 900);
  wave(p.x, p.y, 2);
  shake(1); slowmo(0.14, 1.7); G.flash = 0.3;
  Sfx.die(); Sfx.music(0); Sfx.muffle(true);
  document.body.classList.remove('playing');
}

function victory() {
  const p = G.player;
  for (let i = 0; i < 6; i++) ring(p.x, p.y, 20, 250 + i * 130, 0.6 + i * 0.12, i % 2 ? COL.shard : COL.nova, 4);
  Particles.burst(p.x, p.y, 200, COL.shard, 100, 1000, 0.5, 1.6, 2.6, 1.4);
  Grid.blast(p.x, p.y, 40, 1200);
  Sfx.levelUp(); Sfx.music(0);
  document.body.classList.remove('playing');
  showResult(true);
}

/** Verbucht den Lauf im Profil (Bestwerte, Statistik, XP, Kerne, Erfolge). Nur einmal pro Lauf. */
function settleRun(won) {
  if (G.settled) return G.lastOut;
  G.settled = true;
  const run = G.run, score = Math.floor(G.score);
  const out = { won, score, record: false, stars: 0, newStars: 0, xp: 0, cores: 0, before: rankInfo(P.xp), after: null, unlocks: [], ach: [] };
  P.stats.runs++; P.stats.kills += G.kills; P.stats.bosses += G.bossKills; P.stats.loops += G.loopsDone; P.stats.time += Math.floor(G.runT);

  if (run.mode === 'paradox') {
    if (score > (P.best.paradox || 0)) { P.best.paradox = score; out.record = true; }
    if (G.loop > P.bestLoop) P.bestLoop = G.loop;
  } else if (run.mode === 'swarm') {
    const t = Math.floor(G.runT);
    if (t > (P.best.swarm || 0)) { P.best.swarm = t; out.record = t > 0; }
    if (G.runT >= 300) award('swarm5');
  } else if (run.mode === 'bossrush') {
    if (G.bossKills > (P.best.bossrush || 0)) { P.best.bossrush = G.bossKills; out.record = true; }
  } else if (run.mode === 'daily') {
    if (P.daily.key !== run.dailyKey) { P.daily.key = run.dailyKey; P.daily.best = 0; }
    if (score > P.daily.best) { P.daily.best = score; out.record = true; }
    if (G.loop >= 5) award('daily5');
  } else if (run.mode === 'campaign' && won) {
    const stars = G.hitsTaken === 0 ? 3 : G.hitsTaken <= 2 ? 2 : 1, old = P.campaign[run.level.id] || 0;
    out.stars = stars; out.newStars = Math.max(0, stars - old);
    if (stars > old) P.campaign[run.level.id] = stars;
    if (run.level.id === 'c6') award('pacifist');
    if (P.campaign.c5) award('act1');
    if (P.campaign.c10) award('act2');
    if (P.campaign.c15) award('act3');
    if (totalStars() >= 30) award('stars30');
  }
  if (score <= 0) out.record = out.record && run.mode !== 'paradox' && run.mode !== 'daily';
  if (P.stats.kills >= 1000) award('kills1k');
  if (P.stats.kills >= 10000) award('kills10k');

  out.xp = Math.round(G.loopsDone * 40 + G.kills * 0.8 + G.bossKills * 150 + out.newStars * 80 + (won ? 60 : 0));
  out.cores = Math.round((G.loopsDone * 3 + G.bossKills * 12 + G.kills / 40 + out.newStars * 6) * (1 + 0.1 * metaLv('m_core')));
  P.xp += out.xp; P.cores += out.cores;
  out.after = rankInfo(P.xp);
  out.unlocks = UNLOCKS.filter((u) => u.rank > out.before.rank && u.rank <= out.after.rank);
  out.ach = G.newAch.slice();
  G.lastOut = out;
  save();
  return out;
}

function showResult(won) {
  G.state = 'gameover'; G.victory = !!won;
  const out = settleRun(won), run = G.run, camp = run.mode === 'campaign';

  let kicker = 'ZEITLINIE KOLLABIERT', title = 'GAME OVER';
  if (camp) { kicker = 'SEKTOR ' + (run.levelIdx + 1) + '  ·  ' + run.level.name.toUpperCase(); title = won ? 'ABGESCHLOSSEN' : 'GESCHEITERT'; }
  else if (run.mode === 'swarm') kicker = 'DER SCHWARM HAT DICH EINGEHOLT';
  else if (run.mode === 'bossrush') kicker = 'BOSS-RUSH BEENDET';
  else if (run.mode === 'daily') kicker = 'TAGES-PARADOX  ·  ' + run.dailyKey;
  el.overKicker.textContent = kicker;
  el.overTitle.textContent = title;
  el.overTitle.classList.toggle('win', !!won);

  el.overStars.classList.toggle('hidden', !(camp && won));
  if (camp && won) {
    el.overStars.innerHTML = `<div class="stars big">${starText(out.stars)}</div>` +
      `<div class="star-hint">${G.hitsTaken === 0 ? 'Ohne einen einzigen Treffer!' : 'Treffer kassiert: ' + G.hitsTaken}  ·  ★★ höchstens 2 Treffer  ·  ★★★ kein Treffer</div>`;
  }
  el.overRecord.classList.toggle('hidden', !out.record);

  const rows = [];
  if (run.mode === 'swarm') rows.push(['ÜBERLEBT', mmss(G.runT)], ['ZEITRISSE', G.loop], ['PUNKTE', fmt(out.score)]);
  else if (run.mode === 'bossrush') rows.push(['BOSSE BESIEGT', G.bossKills], ['ZEIT', mmss(G.runT)], ['PUNKTE', fmt(out.score)]);
  else if (camp) rows.push(['PUNKTE', fmt(out.score)], ['LOOP', G.loop + '/' + campaignLoops(run.level)], ['ZEIT', mmss(G.runT)]);
  else rows.push(['PUNKTE', fmt(out.score)], ['ERREICHTER LOOP', G.loop], ['ZEIT', mmss(G.runT)]);
  rows.push(['ABSCHÜSSE', fmt(G.kills)], ['MAX. MULTIPLIKATOR', '×' + fmt(G.maxMult)], ['ECHOS', G.echoes.length]);
  el.overStats.innerHTML = rows.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');

  const a = out.after, up = a.rank > out.before.rank;
  let rw = `<div class="rw-line"><b>+${fmt(out.xp)} XP</b><i></i><b class="gold">+${fmt(out.cores)} KERNE</b></div>` +
    `<div class="rw-rank${up ? ' up' : ''}"><span>${up ? 'RANG AUFGESTIEGEN  ·  ' : ''}RANG ${a.rank} · ${a.name}</span>` +
    `<div class="rank-bar"><div style="transform:scaleX(${(a.cur / a.need).toFixed(3)})"></div></div><span>${fmt(a.cur)} / ${fmt(a.need)} XP</span></div>`;
  if (out.unlocks.length) rw += '<div class="rw-list">' + out.unlocks.map((u) => `<span class="rw-unlock">NEU  ·  ${u.label}</span>`).join('') + '</div>';
  if (out.ach.length) rw += '<div class="rw-list">' + out.ach.map((id) => `<span class="rw-ach">${ACH_BY_ID[id].name} <b>+${ACH_BY_ID[id].cores}</b></span>`).join('') + '</div>';
  el.overRewards.innerHTML = rw;

  const next = camp && won && run.levelIdx + 1 < CAMPAIGN.length;
  el.btnNext.classList.toggle('hidden', !next);
  el.btnRetry.classList.toggle('big', !next);
  el.overHint.innerHTML = `<kbd>ENTER</kbd> ${next ? 'für den nächsten Sektor' : 'für einen neuen Versuch'}`;
  el.hud.classList.add('hidden');
  clearOverlays();
  show('screen-over');
  Sfx.muffle(false);
}

function resultPrimary() {
  const run = G.run;
  if (run.mode === 'campaign' && G.victory && run.levelIdx + 1 < CAMPAIGN.length) startGame({ mode: 'campaign', level: run.levelIdx + 1 });
  else startGame(G.lastCfg);
}

/** Lauf aus der Pause heraus beenden – bisher Verdientes wird trotzdem gutgeschrieben. */
function abandonRun(restart) {
  const out = settleRun(false);
  if (restart) { startGame(G.lastCfg); return; }
  const camp = G.run.mode === 'campaign';
  if (camp) openCampaign(); else openHub();
  if (out.xp > 0) hubNote(`Lauf beendet  ·  +${fmt(out.xp)} XP  ·  +${fmt(out.cores)} Kerne`);
}

function renderBuild() {
  const ids = Object.keys(G.up).filter((id) => G.up[id] > 0 && id !== 'heal');
  el.build.innerHTML = ids.length
    ? ids.map((id) => {
        const u = UPGRADE_BY_ID[id];
        return `<div class="build-item ${RARITY[u.rarity].cls}" title="${u.desc}">${upgradeIcon(u)}<span>${u.name}</span><b>${G.up[id]}</b></div>`;
      }).join('')
    : '<div class="build-empty">Noch keine Aufwertungen gesammelt</div>';
}

function togglePause() {
  if (G.demo) return;
  if (G.state === 'playing') {
    G.state = 'paused';
    renderBuild(); updateSoundLabel();
    el.pauseMode.textContent = modeLine();
    show('screen-pause');
    document.body.classList.remove('playing');
    Sfx.muffle(true);
  } else if (G.state === 'paused') {
    G.state = 'playing';
    show(null);
    document.body.classList.add('playing');
    blurActive();
    Sfx.muffle(false);
  }
}

// ---------------------------------------------------------------- Update
function aimFromMouse() {
  const zoom = R.cam.zoom || 1;
  Input.wx = G.camX + (Input.mx - R.W / 2) / zoom;
  Input.wy = G.camY + (Input.my - R.H / 2) / zoom;
}

/** Touch: wandernde Sticks auswerten. Ohne Zielstick übernimmt die Zielautomatik. */
function stickVec(s) {
  let dx = s.x - s.ox, dy = s.y - s.oy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > STICK_R) {                 // der Stick-Mittelpunkt wandert mit dem Daumen mit
    const k = 1 - STICK_R / len;
    s.ox += dx * k; s.oy += dy * k;
    dx = s.x - s.ox; dy = s.y - s.oy;
  }
  s.dx = dx / STICK_R; s.dy = dy / STICK_R;
  return Math.min(1, len / STICK_R);
}

function touchThink(dt) {
  const p = G.player;
  if (Pad.move && stickVec(Pad.move) > 0.14) {
    Input.ax = clamp(Pad.move.dx * 1.3, -1, 1); Input.ay = clamp(Pad.move.dy * 1.3, -1, 1);
  } else { Input.ax = 0; Input.ay = 0; }
  if (Pad.aim && stickVec(Pad.aim) > 0.25) p.botAng = Math.atan2(Pad.aim.dy, Pad.aim.dx);
  else autoAim(dt);
  Input.wx = p.x + Math.cos(p.botAng) * 220;
  Input.wy = p.y + Math.sin(p.botAng) * 220;
}

function setTouchMode(on) {
  if (!!G.touch === on) return;
  G.touch = on;
  Pad.move = null; Pad.aim = null;
  document.body.classList.toggle('touch', on);
  if (on && R.quality > 0.75) R.setQuality(0.75);     // Handys: etwas geringere Auflösung für flüssige 60 fps
}

function updateCamera(rdt) {
  // Auf dem Handy näher heran, damit Schiff und Gegner groß genug bleiben
  const base = G.touch ? Math.min(R.W, R.H) / 620 : Math.max(R.H / 940, R.W / 2100);
  const zoom = base * (1 + G.zoomKick);
  const vw = R.W / zoom, vh = R.H / zoom, p = G.player, m = 90;
  let tx = p.x, ty = p.y;
  if (!G.bot && !G.touch) { tx += ((Input.mx - R.W / 2) / zoom) * 0.12; ty += ((Input.my - R.H / 2) / zoom) * 0.12; }
  tx = vw >= ARENA_W + 2 * m ? CX : clamp(tx, vw / 2 - m, ARENA_W - vw / 2 + m);
  ty = vh >= ARENA_H + 2 * m ? CY : clamp(ty, vh / 2 - m, ARENA_H - vh / 2 + m);
  G.camX = damp(G.camX, tx, 7, rdt);
  G.camY = damp(G.camY, ty, 7, rdt);
  const s = G.trauma * G.trauma * 18;
  R.cam.x = G.camX + (Math.random() * 2 - 1) * s;
  R.cam.y = G.camY + (Math.random() * 2 - 1) * s;
  R.cam.zoom = zoom;
}

function update(rdt) {
  G.realT += rdt;
  const st = G.state;
  if (st === 'paused' || st === 'boot') return;

  let target = 1;
  if (G.slowT > 0) { G.slowT -= rdt; target = G.slowScale; }
  G.timeScale = damp(G.timeScale, target, 14, rdt);
  let dt = rdt * G.timeScale;
  if (G.hitstop > 0) { G.hitstop -= rdt; dt = 0; }

  rebuildHash();

  if (st === 'playing') {
    const swarm = G.run.mode === 'swarm';
    Input.analog = G.bot || !!G.touch;
    if (G.bot) botThink(dt); else if (G.touch) touchThink(dt); else aimFromMouse();
    updatePlayer(dt);
    recordSample();
    updateEchoes(dt);
    updateSpawner(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateEBullets(dt);
    updateBlasts(dt);
    updatePickups(dt, false);
    G.loopT += dt; G.runT += dt;
    if (G.state === 'playing') {
      if (G.bossLoop) {
        if (G.bossEndT > 0) { G.bossEndT -= dt; if (G.bossEndT <= 0) endLoop(); }
      } else {
        const sec = Math.ceil(G.loopDur - G.loopT);
        if (!swarm && sec <= 3 && sec > 0 && sec !== lastTick) { lastTick = sec; Sfx.tick(); }
        if (G.loopT >= G.loopDur) { if (swarm) softLoop(); else endLoop(); }
      }
    }
    if (swarm && G.state === 'playing' && G.pendingPicks > 0) {      // Schwarm: Aufwertung sofort
      const n = G.pendingPicks;
      G.pendingPicks = 0;
      openUpgrades(n, 'STUFE ' + G.level + ' ERREICHT', true);
    }
  } else if (st === 'loopend') {
    const p = G.player;
    G.endT += rdt;
    for (const e of G.enemies) if (!e.dead && G.endT >= e.dieAt) killEnemy(e, true);
    updateBullets(dt);
    updatePickups(rdt, true);
    const f = Math.max(0, 1 - 6 * rdt);
    p.vx *= f; p.vy *= f;
    p.x = clamp(p.x + p.vx * rdt, 14, ARENA_W - 14);
    p.y = clamp(p.y + p.vy * rdt, 14, ARENA_H - 14);
    if (G.endT > 0.75) { p.x = damp(p.x, CX, 7, rdt); p.y = damp(p.y, CY, 7, rdt); }
    pushTrail(p, rdt, 26);
    for (const e of G.echoes) e.fade = Math.max(0, e.fade - rdt * 1.2);
    G.glitch = Math.max(G.glitch, 0.55);
    if (G.endT >= 1.7) afterLoopEnd();
  } else if (st === 'dead') {
    G.deadT += rdt;
    updateEnemies(dt);
    updateBullets(dt);
    updateEBullets(dt);
    if (G.deadT >= 2.1) showResult(false);
  } else if (st === 'upgrade') {
    if (G.bot && performance.now() > upgradeLockT + 250) pickCard(randInt(0, Math.max(0, G.cards.length - 1)));
  }

  updateFx(dt, rdt);
  compact(G.enemies); compact(G.bullets); compact(G.ebullets); compact(G.pickups);
  updateCamera(rdt);
}

// ---------------------------------------------------------------- Zeichnen
function drawStars() {
  const cx = R.cam.x - CX, cy = R.cam.y - CY, t = G.realT;
  for (const s of STARS) {
    const k = 1 - s.z, b = s.b * (0.7 + 0.3 * Math.sin(t * 1.5 + s.tw));
    R.dot(s.x + cx * k, s.y + cy * k, s.s, 0.6 * b, 0.75 * b, b, 1);
  }
}

function drawArena(beat) {
  const c = COL.wall, k = 1.2 + beat * 0.9, r = c[0] * k, g = c[1] * k, b = c[2] * k, w = 3, o = 14;
  R.line(0, 0, ARENA_W, 0, w, r, g, b, 1);
  R.line(ARENA_W, 0, ARENA_W, ARENA_H, w, r, g, b, 1);
  R.line(ARENA_W, ARENA_H, 0, ARENA_H, w, r, g, b, 1);
  R.line(0, ARENA_H, 0, 0, w, r, g, b, 1);
  R.line(-o, -o, ARENA_W + o, -o, 1.4, c[0], c[1], c[2], 0.35);
  R.line(ARENA_W + o, -o, ARENA_W + o, ARENA_H + o, 1.4, c[0], c[1], c[2], 0.35);
  R.line(ARENA_W + o, ARENA_H + o, -o, ARENA_H + o, 1.4, c[0], c[1], c[2], 0.35);
  R.line(-o, ARENA_H + o, -o, -o, 1.4, c[0], c[1], c[2], 0.35);
  const L = 80;
  for (let i = 0; i < 4; i++) {
    const x = i % 2 ? ARENA_W : 0, y = i < 2 ? 0 : ARENA_H, sx = i % 2 ? -1 : 1, sy = i < 2 ? 1 : -1;
    R.line(x, y, x + sx * L, y, 4, 1.0, 1.5, 2.0, 1);
    R.line(x, y, x, y + sy * L, 4, 1.0, 1.5, 2.0, 1);
  }
}

function drawReticle() {
  const x = Input.wx, y = Input.wy, r = 13, a = G.realT * 1.5;
  for (let k = 0; k < 4; k++) {
    const t = a + (k * Math.PI) / 2, c = Math.cos(t), s = Math.sin(t);
    R.line(x + c * r * 0.55, y + s * r * 0.55, x + c * r, y + s * r, 1.6, 1.4, 1.5, 1.6, 1);
  }
  R.dot(x, y, 2.6, 1.5, 1.5, 1.5, 1);
}

/** Lichtquellen für den Mutator "Dunkelfeld": Spieler, Echos und große Schockwellen. */
function collectLights(zoom) {
  const L = post.lights, W = R.W, H = R.H, cx = R.cam.x, cy = R.cam.y;
  let n = 0;
  const add = (wx, wy, wr) => {
    if (n >= 10 || wr <= 1) return;
    L[n * 3] = ((wx - cx) * zoom + W / 2) / W;
    L[n * 3 + 1] = 1 - ((wy - cy) * zoom + H / 2) / H;
    L[n * 3 + 2] = (wr * zoom) / H;
    n++;
  };
  const p = G.player;
  if (p.alive) add(p.x, p.y, 350);
  for (const r of G.rings) {
    if (r.r1 < 280 || n >= 4) continue;
    const t = 1 - r.life / r.max;
    add(r.x, r.y, (r.r0 + (r.r1 - r.r0) * easeOut(t)) * Math.sqrt(1 - t) * 1.25);
  }
  for (const e of G.echoes) add(e.x, e.y, 215 * e.fade);
  post.lightN = n;
}

function render() {
  const beat = Sfx.beat(), zoom = R.cam.zoom, hw = R.W / 2 / zoom, hh = R.H / 2 / zoom, st = G.state;
  R.begin();
  drawStars();
  Grid.draw(beat);
  drawArena(beat);
  drawPickups();
  drawEnemies(R.cam.x - hw, R.cam.y - hh, R.cam.x + hw, R.cam.y + hh);
  drawBullets();
  drawEchoes();
  drawPlayer();
  Particles.draw();
  drawFx();
  if (!G.demo && !G.bot && !G.touch && (st === 'playing' || st === 'loopend')) drawReticle();

  const p = G.player;
  const low = !G.demo && p.alive && p.hp === 1 && S.maxHp > 1 && st === 'playing';
  post.time = G.realT;
  post.aberr = 0.0016 + G.trauma * 0.012 + G.aberr * 0.012 + G.glitch * 0.006;
  post.bloom = 0.27 + beat * 0.03;
  post.glitch = G.glitch;
  post.danger = (low ? 0.35 + 0.25 * Math.sin(G.realT * 5) : 0) + G.flashR * 1.2;
  post.desat = G.desat || 0;
  post.dark = G.darkAmt || 0;
  if (post.dark > 0.001) collectLights(zoom); else post.lightN = 0;
  post.flash[0] = G.flash + G.flashR * 0.35; post.flash[1] = G.flash; post.flash[2] = G.flash * 1.1;
  if (G.wave) {
    const w = G.wave;
    post.wave[0] = ((w.x - R.cam.x) * zoom + R.W / 2) / R.W;
    post.wave[1] = 1 - ((w.y - R.cam.y) * zoom + R.H / 2) / R.H;
    post.wave[2] = w.t * 1.5;
    post.wave[3] = w.s * (1 - w.t / 0.8);
  } else post.wave[3] = 0;
  post.camOff[0] = R.cam.x * 0.0004; post.camOff[1] = -R.cam.y * 0.0004;
  R.end(post);
}

function updateHud() {
  if (G.demo) return;
  const p = G.player, run = G.run, swarm = run.mode === 'swarm';
  setTxt(el.score, 'score', fmt(G.score));
  setTxt(el.mult, 'mult', '×' + fmt(G.mult));
  setTxt(el.loop, 'loop', loopLabel());
  const rem = Math.max(0, G.loopDur - G.loopT);
  el.timer.style.transform = `scaleX(${(G.bossLoop ? 1 : clamp(rem / G.loopDur, 0, 1)).toFixed(4)})`;
  setTxt(el.time, 'time', swarm ? mmss(G.runT) : G.bossLoop ? '∞' : Math.ceil(rem) + ' s');
  toggleCls(el.timerWrap, 'ending', !swarm && !G.bossLoop && rem <= 3 && G.state === 'playing', 'ending');

  const hpKey = p.hp + '/' + S.maxHp + (S.shield > 0 ? (p.shieldUp ? 's' : 'x') : '');
  if (hudCache.hp !== hpKey) {
    hudCache.hp = hpKey;
    let h = '';
    for (let i = 0; i < S.maxHp; i++) h += `<i class="pip${i < p.hp ? ' on' : ''}"></i>`;
    if (S.shield > 0) h += `<i class="pip shield${p.shieldUp ? ' on' : ''}"></i>`;
    el.hp.innerHTML = h;
  }
  const en = G.echoes.length, cap = Math.max(S.echoCap, en), eKey = en + '/' + cap;
  if (hudCache.echo !== eKey) {
    hudCache.echo = eKey;
    let h = '<span>ECHOS</span>';
    for (let i = 0; i < cap; i++) h += `<i class="echo-pip${i < en ? ' on' : ''}"></i>`;
    el.echoes.innerHTML = h;
  }
  el.dash.style.transform = `scaleX(${S.noDash ? 0 : clamp(1 - p.dashCd / S.dashCd, 0, 1).toFixed(3)})`;
  toggleCls(el.dashM, 'ready', !S.noDash && p.dashCd <= 0, 'dashR');
  setTxt(el.dashLabel, 'dashL', S.noDash ? 'DASH GESPERRT' : 'DASH');
  el.nova.style.transform = `scaleX(${clamp(G.nova, 0, 1).toFixed(3)})`;
  toggleCls(el.novaM, 'ready', G.nova >= 1, 'novaR');
  el.xp.style.transform = `scaleX(${clamp(G.xp / G.xpNeed, 0, 1).toFixed(3)})`;
  setTxt(el.xpLabel, 'xpl', G.pendingPicks > 0 && !swarm ? `BONUS-AUFWERTUNG +${G.pendingPicks}` : 'STUFE ' + (G.level + 1));
  toggleCls(el.xpM, 'ready', G.pendingPicks > 0 && !swarm, 'xpR');

  const b = G.boss;
  toggleCls(el.bossbar, 'hidden', !b, 'bossH');
  if (b) {
    setTxt(el.bossName, 'bn', b.bname);
    el.bossFill.style.transform = `scaleX(${clamp(b.hp / b.maxHp, 0, 1).toFixed(4)})`;
  }

  if (G.touch) {                        // Touch-Tasten zeigen Abklingzeit und Nova-Ladung als Ring
    const dp = S.noDash ? 0 : clamp(1 - p.dashCd / S.dashCd, 0, 1);
    setProp(el.tDash, 'tdp', dp);
    setProp(el.tNova, 'tnp', clamp(G.nova, 0, 1));
    toggleCls(el.tDash, 'ready', dp >= 1, 'tdR');
    toggleCls(el.tNova, 'ready', G.nova >= 1, 'tnR');
    drawStick(el.stickL, Pad.move);
    drawStick(el.stickR, Pad.aim);
  }
}

function setProp(node, key, v) {
  const s = v.toFixed(2);
  if (hudCache[key] !== s) { hudCache[key] = s; node.style.setProperty('--p', s); }
}

function drawStick(base, s) {
  const on = !!s && G.state === 'playing';
  if (base._on !== on) { base._on = on; base.style.display = on ? 'block' : 'none'; }
  if (!on) return;
  base.style.transform = `translate(${s.ox.toFixed(1)}px, ${s.oy.toFixed(1)}px)`;
  base.firstElementChild.style.transform = `translate(${(s.x - s.ox).toFixed(1)}px, ${(s.y - s.oy).toFixed(1)}px)`;
}

// ---------------------------------------------------------------- Hauptschleife
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { lastT = now; return; }
  let raw = (now - lastT) / 1000;
  lastT = now;
  if (raw > 0.1 || raw < 0) raw = 0.016;
  const rdt = Math.min(raw, 0.034);

  update(rdt);
  const st = G.state;
  const dTarget = st === 'paused' ? 0.6 : st === 'dead' ? 0.75 : st === 'gameover' ? (G.victory ? 0.15 : 0.75) : st === 'upgrade' ? 0.3 : 0;
  G.desat = damp(G.desat || 0, dTarget, 8, rdt);
  const darkOn = !G.demo && G.run && G.run.muts.dark && st !== 'gameover' && st !== 'upgrade';
  G.darkAmt = damp(G.darkAmt || 0, darkOn ? 1 : 0, 4, rdt);
  render();
  updateHud();

  // Auflösung automatisch senken, falls der Rechner nicht hinterherkommt
  perfAcc += raw; perfN++;
  if (perfN >= 150) {
    if (perfAcc / perfN > 0.024 && R.quality > 0.5 && document.hasFocus()) R.setQuality(R.quality - 0.25);
    perfAcc = 0; perfN = 0;
  }
}

// ---------------------------------------------------------------- Eingabe
function firstGesture() {
  if (Sfx.state() !== 'running') Sfx.init();     // Audio darf erst nach einer Nutzergeste starten (wichtig auf iOS)
}

function bindTouch() {
  const cv = $('gl');
  cv.addEventListener('touchstart', (ev) => {
    setTouchMode(true);
    firstGesture();
    if (G.state !== 'playing' || G.demo) return;
    ev.preventDefault();
    for (const t of ev.changedTouches) {
      const s = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY, dx: 0, dy: 0 };
      const left = t.clientX < window.innerWidth * 0.5;
      if (left && !Pad.move) Pad.move = s;
      else if (!left && !Pad.aim) Pad.aim = s;
      else if (!Pad.move) Pad.move = s;
      else if (!Pad.aim) Pad.aim = s;
    }
  }, { passive: false });
  cv.addEventListener('touchmove', (ev) => {
    if (!Pad.move && !Pad.aim) return;
    ev.preventDefault();
    for (const t of ev.changedTouches) {
      const s = Pad.move && Pad.move.id === t.identifier ? Pad.move : Pad.aim && Pad.aim.id === t.identifier ? Pad.aim : null;
      if (s) { s.x = t.clientX; s.y = t.clientY; }
    }
  }, { passive: false });
  const end = (ev) => {
    for (const t of ev.changedTouches) {
      if (Pad.move && Pad.move.id === t.identifier) Pad.move = null;
      if (Pad.aim && Pad.aim.id === t.identifier) Pad.aim = null;
    }
  };
  cv.addEventListener('touchend', end);
  cv.addEventListener('touchcancel', end);

  const press = (node, fn) => node.addEventListener('pointerdown', (ev) => { ev.preventDefault(); firstGesture(); fn(); });
  press(el.tDash, () => { if (G.state === 'playing') Input.dashPressed = true; });
  press(el.tNova, () => { if (G.state === 'playing') Input.novaPressed = true; });
  press(el.tPause, togglePause);

  window.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'touch') setTouchMode(true); else if (ev.pointerType === 'mouse') setTouchMode(false);
  }, true);
  window.addEventListener('pointerup', firstGesture);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.state === 'playing' && !G.demo && !BOT_PARAM) togglePause();
  });
  el.btnFull.addEventListener('click', () => {
    const d = document;
    if (d.fullscreenElement) { d.exitFullscreen(); return; }
    const req = d.documentElement.requestFullscreen && d.documentElement.requestFullscreen();
    if (req && req.then) {
      req.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
    }
  });
  if (!document.fullscreenEnabled) el.btnFull.classList.add('hidden');
}

function bindInput() {
  window.addEventListener('keydown', (ev) => {
    const c = ev.code;
    if (c === 'Space' || c.startsWith('Arrow')) ev.preventDefault();
    firstGesture();
    if (G.touch && /^(Key[WASD]|Arrow)/.test(c)) setTouchMode(false);
    switch (c) {
      case 'KeyW': case 'ArrowUp': Input.up = true; break;
      case 'KeyS': case 'ArrowDown': Input.down = true; break;
      case 'KeyA': case 'ArrowLeft': Input.left = true; break;
      case 'KeyD': case 'ArrowRight': Input.right = true; break;
      case 'Space': case 'ShiftLeft': case 'ShiftRight': if (!ev.repeat && G.state === 'playing') Input.dashPressed = true; break;
      case 'KeyE': case 'KeyQ': if (!ev.repeat && G.state === 'playing') Input.novaPressed = true; break;
      case 'KeyR': if (!ev.repeat) rerollCards(); break;
      case 'Escape': case 'KeyP':
        if (ev.repeat) break;
        if (G.demo) { if (c === 'Escape') menuBack(); } else togglePause();
        break;
      case 'KeyM': if (!ev.repeat) toggleMute(); break;
      case 'KeyF':
        if (!ev.repeat && !G.demo) {
          G.autoFire = !G.autoFire; save();
          toast(G.autoFire ? 'AUTO-FEUER AN' : 'AUTO-FEUER AUS — LINKE MAUSTASTE HALTEN');
        }
        break;
      case 'Digit1': case 'Numpad1': pickCard(0); break;
      case 'Digit2': case 'Numpad2': pickCard(1); break;
      case 'Digit3': case 'Numpad3': pickCard(2); break;
      case 'Enter': case 'NumpadEnter':
        if (ev.repeat) break;
        ev.preventDefault();
        if (G.state === 'paused') togglePause();
        else if (ui.screen === 'screen-over') resultPrimary();
        else if (G.demo) menuEnter();
        break;
    }
  });
  window.addEventListener('keyup', (ev) => {
    switch (ev.code) {
      case 'KeyW': case 'ArrowUp': Input.up = false; break;
      case 'KeyS': case 'ArrowDown': Input.down = false; break;
      case 'KeyA': case 'ArrowLeft': Input.left = false; break;
      case 'KeyD': case 'ArrowRight': Input.right = false; break;
    }
  });
  window.addEventListener('mousemove', (ev) => { Input.mx = ev.clientX; Input.my = ev.clientY; });
  window.addEventListener('mousedown', (ev) => {
    firstGesture();
    Input.mx = ev.clientX; Input.my = ev.clientY;
    if (ev.button === 0) Input.fire = true;
    else if (ev.button === 2 && G.state === 'playing') Input.novaPressed = true;
  });
  window.addEventListener('mouseup', (ev) => { if (ev.button === 0) Input.fire = false; });
  window.addEventListener('contextmenu', (ev) => ev.preventDefault());
  window.addEventListener('blur', () => {
    Input.up = Input.down = Input.left = Input.right = Input.fire = false;
    if (G.state === 'playing' && !G.demo && !BOT_PARAM) togglePause();
  });
  window.addEventListener('resize', () => R.resize());

  el.btnRetry.addEventListener('click', () => startGame(G.lastCfg));
  el.btnNext.addEventListener('click', resultPrimary);
  el.btnMenu.addEventListener('click', () => { if (G.run.mode === 'campaign') openCampaign(); else openHub(); });
  el.btnResume.addEventListener('click', togglePause);
  el.btnRestart.addEventListener('click', () => abandonRun(true));
  el.btnQuit.addEventListener('click', () => abandonRun(false));
  el.btnSound.addEventListener('click', toggleMute);
  el.btnReroll.addEventListener('click', rerollCards);
  el.cards.addEventListener('click', (ev) => {
    const card = ev.target.closest('.card');
    if (card) pickCard(+card.dataset.i);
  });
  document.addEventListener('mouseover', (ev) => {
    const t = ev.target.closest && ev.target.closest('.btn, .card, .mode-item, .tile, .ship-card, .chip');
    if (t && t !== bindInput.lastHover) Sfx.hover();
    bindInput.lastHover = t;
  });
  bindTouch();
  bindMenus();
}

// ---------------------------------------------------------------- Start
function init() {
  const ids = {
    hud: 'hud', score: 'h-score', mult: 'h-mult', mode: 'h-mode', loop: 'h-loop', timer: 'h-timer', timerWrap: 'h-timer-wrap', time: 'h-time',
    echoes: 'h-echoes', hp: 'h-hp', dash: 'h-dash', dashM: 'm-dash', dashLabel: 'h-dash-label', nova: 'h-nova', novaM: 'm-nova',
    xp: 'h-xp', xpM: 'm-xp', xpLabel: 'h-xp-label', bossbar: 'bossbar', bossName: 'boss-name', bossFill: 'boss-fill',
    banner: 'banner', toast: 'toast', best: 'best', upKicker: 'up-kicker', upLeft: 'up-left', cards: 'cards', btnReroll: 'btn-reroll',
    build: 'pause-build', pauseMode: 'pause-mode', overKicker: 'over-kicker', overTitle: 'over-title', overStars: 'over-stars',
    overRecord: 'over-record', overStats: 'over-stats', overRewards: 'over-rewards', overHint: 'over-hint',
    btnRetry: 'btn-retry', btnNext: 'btn-next', btnMenu: 'btn-menu', btnResume: 'btn-resume',
    btnRestart: 'btn-restart', btnQuit: 'btn-quit', btnSound: 'btn-sound',
    tDash: 't-dash', tNova: 't-nova', tPause: 't-pause', stickL: 'stick-l', stickR: 'stick-r', btnFull: 'btn-full',
  };
  for (const k in ids) el[k] = $(ids[k]);

  let ok = false;
  try { ok = R.init($('gl')); } catch (e) { console.error(e); }
  if (!ok) { $('nogl').classList.add('show'); return; }

  Grid.init(ARENA_W, ARENA_H, 44);
  for (let i = 0; i < 240; i++) {
    STARS.push({ x: rand(-900, ARENA_W + 900), y: rand(-700, ARENA_H + 700), z: rand(0.25, 0.8), s: rand(0.8, 2), b: rand(0.25, 0.9), tw: rand(TAU) });
  }
  Input.mx = window.innerWidth / 2; Input.my = window.innerHeight / 2;
  loadProfile();
  if (P.muted) Sfx.setMuted(true);
  G.autoFire = P.autoFire !== false;
  updateSoundLabel();
  bindInput();
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) setTouchMode(true);
  startDemo();
  updateCamera(0.016);

  // Debug-/Test-Zugriff über die Konsole
  window.NP = {
    G, S, R, P, Input, Particles, Sfx, ui, CAMPAIGN, UPGRADE_BY_ID,
    step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) update(dt); render(); updateHud(); },
    startGame, startDemo, startLoop, endLoop, pickCard, togglePause, spawnEnemy, spawnBoss, applyUpgrade,
    settleRun, showResult, openHub, saveProfile,
  };

  // Offline-Unterstützung nur auf der veröffentlichten Seite (nicht beim lokalen Entwickeln)
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

  lastT = performance.now();
  requestAnimationFrame(frame);
}

window.addEventListener('DOMContentLoaded', init);
