'use strict';
/* ====== NEON PARADOX — Profil, Ränge, Schiffe, Werkstatt, Erfolge, Mutatoren, Modi, Kampagne ====== */
const SAVE_KEY = 'neonparadox.v2';

/** Dauerhaftes Spielerprofil (localStorage). */
const P = {
  xp: 0, cores: 0, ship: 'vektor',
  meta: {}, ach: {}, best: {}, bestLoop: 0, campaign: {},
  daily: { key: '', best: 0 },
  stats: { runs: 0, kills: 0, bosses: 0, loops: 0, time: 0 },
  muted: false, autoFire: true,
};

function saveProfile() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(P)); } catch (e) { /* privater Modus o. Ä. */ }
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      for (const k in P) {
        if (d[k] === undefined || d[k] === null) continue;
        if (typeof P[k] === 'object') Object.assign(P[k], d[k]); else P[k] = d[k];
      }
    } else {
      // Spielstand der ersten Version übernehmen
      const old = JSON.parse(localStorage.getItem('neonparadox.v1') || 'null');
      if (old) {
        if (old.best) P.best.paradox = old.best;
        P.bestLoop = old.bestLoop || 0;
        P.muted = !!old.muted;
        if (old.autoFire === false) P.autoFire = false;
      }
    }
  } catch (e) { /* defekter Spielstand: mit Standardwerten weiter */ }
  if (!SHIPS[P.ship]) P.ship = 'vektor';
}

const metaLv = (id) => P.meta[id] || 0;

// ---------------------------------------------------------------- Pilotenrang
const RANK_NAMES = ['REKRUT', 'PILOT', 'JÄGER', 'ASS', 'VETERAN', 'KOMMANDANT', 'ZEITWÄCHTER', 'PARADOX-MEISTER'];
const rankNeed = (r) => 250 + 150 * (r - 1);

function rankInfo(xp) {
  let r = 1, rest = xp;
  while (rest >= rankNeed(r)) { rest -= rankNeed(r); r++; }
  return { rank: r, cur: Math.floor(rest), need: rankNeed(r), name: RANK_NAMES[Math.min(RANK_NAMES.length - 1, Math.floor((r - 1) / 2))] };
}

const UNLOCKS = [
  { rank: 2, type: 'mode', id: 'swarm', label: 'Modus SCHWARM' },
  { rank: 3, type: 'ship', id: 'phantom', label: 'Schiff PHANTOM' },
  { rank: 4, type: 'mode', id: 'bossrush', label: 'Modus BOSS-RUSH' },
  { rank: 5, type: 'mode', id: 'daily', label: 'Modus TAGES-PARADOX' },
  { rank: 6, type: 'ship', id: 'bastion', label: 'Schiff BASTION' },
  { rank: 7, type: 'feature', id: 'mutators', label: 'Mutatoren für PARADOX und SCHWARM' },
  { rank: 9, type: 'ship', id: 'prisma', label: 'Schiff PRISMA' },
  { rank: 12, type: 'ship', id: 'chronos', label: 'Schiff CHRONOS' },
];
function unlockRank(type, id) {
  for (const u of UNLOCKS) if (u.type === type && u.id === id) return u.rank;
  return 1;
}
const isUnlocked = (type, id) => rankInfo(P.xp).rank >= unlockRank(type, id);

// ---------------------------------------------------------------- Schiffe
const shipDef = (o) => Object.assign({ hp: 0, speed: 1, dmg: 1, dashCd: 1, multi: 0, echoPow: 0, echoCap: 0, bounce: 0, shield: 0, dashDmg: 0, mirror: 0, hurtNova: 0 }, o);
const SHIPS = {
  vektor: shipDef({
    name: 'VEKTOR', tag: 'Ausgewogener Allrounder', shape: SHAPES.ship, col: [1.9, 1.85, 1.65], css: '#fff3d6',
    lines: ['Keine Schwächen, keine Extras', 'Der ideale Einstieg'],
  }),
  phantom: shipDef({
    name: 'PHANTOM', tag: 'Schnell und zerbrechlich', shape: SHAPES.shipPhantom, col: [0.9, 1.9, 1.9], css: '#7ff6ff',
    lines: ['+15 % Tempo, Dash lädt 30 % schneller', 'Der Dash zerschneidet Gegner auf seiner Bahn', '−1 Hülle'],
    hp: -1, speed: 1.15, dashCd: 0.7, dashDmg: 1,
  }),
  bastion: shipDef({
    name: 'BASTION', tag: 'Fliegende Festung', shape: SHAPES.shipBastion, col: [2.0, 1.4, 0.6], css: '#ffc266',
    lines: ['+2 Hülle, startet mit Phasenschild', 'Jeder Treffer löst eine Schockwelle aus', '−12 % Tempo'],
    hp: 2, speed: 0.88, shield: 1, hurtNova: 1,
  }),
  prisma: shipDef({
    name: 'PRISMA', tag: 'Dreifach-Fächer', shape: SHAPES.shipPrisma, col: [2.0, 0.9, 1.7], css: '#ff8ae0',
    lines: ['+2 Projektile pro Salve', 'Projektile prallen einmal von Wänden ab', '−30 % Schaden'],
    multi: 2, bounce: 1, dmg: 0.7,
  }),
  chronos: shipDef({
    name: 'CHRONOS', tag: 'Herr der Echos', shape: SHAPES.shipChronos, col: [1.4, 1.1, 2.1], css: '#b79cff',
    lines: ['+1 Echo, Echos sind 25 % stärker', 'Das neueste Echo bekommt einen Spiegelzwilling', '−15 % eigener Schaden'],
    echoCap: 1, echoPow: 0.25, mirror: 1, dmg: 0.85,
  }),
};
const SHIP_ORDER = ['vektor', 'phantom', 'bastion', 'prisma', 'chronos'];

function shipSvg(id) {
  const s = SHIPS[id].shape, pts = [];
  for (let i = 0; i < s.length; i += 2) pts.push(s[i + 1].toFixed(2) + ',' + (-s[i]).toFixed(2));   // Nase nach oben
  return `<svg viewBox="-1.7 -1.8 3.4 3.4" aria-hidden="true"><polygon points="${pts.join(' ')}" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="0.11" stroke-linejoin="round"/></svg>`;
}

// ---------------------------------------------------------------- Werkstatt (dauerhafte Verbesserungen)
const COST5 = [10, 20, 35, 55, 80];
const META = [
  { id: 'm_hull', name: 'Verstärkte Hülle', desc: '+1 Hülle zu Beginn jedes Laufs', max: 2, cost: [40, 120] },
  { id: 'm_dmg', name: 'Feinjustierung', desc: '+4 % Schaden je Stufe', max: 5, cost: COST5 },
  { id: 'm_nova', name: 'Nova-Speicher', desc: 'Startet mit 20 % Nova-Ladung je Stufe', max: 5, cost: COST5 },
  { id: 'm_magnet', name: 'Sammeldrohne', desc: '+12 % Sammelradius je Stufe', max: 5, cost: COST5 },
  { id: 'm_xp', name: 'Datenbank', desc: '+8 % Splitter-Energie je Stufe – Bonus-Aufwertungen kommen schneller', max: 5, cost: COST5 },
  { id: 'm_echo', name: 'Echo-Kern', desc: '+5 % Echo-Schaden je Stufe', max: 5, cost: COST5 },
  { id: 'm_reroll', name: 'Neuwürfler', desc: '+1 Neuwurf der Aufwertungen pro Lauf', max: 3, cost: [25, 60, 110] },
  { id: 'm_core', name: 'Kernfusion', desc: '+10 % Kerne je Stufe', max: 5, cost: COST5 },
];

function buyMeta(id) {
  const m = META.find((x) => x.id === id), lv = metaLv(id);
  if (!m || lv >= m.max || P.cores < m.cost[lv]) return false;
  P.cores -= m.cost[lv];
  P.meta[id] = lv + 1;
  saveProfile();
  return true;
}

// ---------------------------------------------------------------- Mutatoren
const MUTATORS = {
  pacifist: { name: 'Funkstille', desc: 'Du feuerst nicht. Nur deine Echos schießen – mit voller Kraft.', bonus: 0.5 },
  glass: { name: 'Glaskanone', desc: 'Nur 1 Hülle, dafür +150 % Schaden.', bonus: 0.6 },
  swarm: { name: 'Schwarm', desc: '+60 % Gegner, die etwas weniger aushalten.', bonus: 0.3 },
  fast: { name: 'Zeitraffer', desc: 'Gegner sind 30 % schneller.', bonus: 0.3 },
  dark: { name: 'Dunkelfeld', desc: 'Nur du und deine Echos erhellen die Arena.', bonus: 0.4 },
  shortloop: { name: 'Kurzschluss', desc: 'Loops dauern nur 15 Sekunden.', bonus: 0.2 },
  elite: { name: 'Elite', desc: 'Gegner haben +50 % Hülle, lassen aber doppelt Splitter fallen.', bonus: 0.3 },
  nodash: { name: 'Blockade', desc: 'Der Dash ist gesperrt.', bonus: 0.3 },
  unstable: { name: 'Instabil', desc: 'Jeder Gegner explodiert kurz nach seinem Tod.', bonus: 0.25 },
};
/** Frei wählbar in PARADOX und SCHWARM (ab Rang 7). */
const FREE_MUTATORS = ['swarm', 'fast', 'dark', 'elite', 'nodash', 'unstable', 'glass', 'shortloop'];

// ---------------------------------------------------------------- Modi
const MODES = {
  paradox: {
    name: 'PARADOX', tag: 'Der Klassiker', css: '#5ef2ff',
    desc: 'Endlose Zeitschleifen. Jede überstandene Runde wird zu einem Echo.',
    rules: ['Loops von 30 Sekunden', 'Jeder fünfte Loop ist ein Bosskampf', 'Nach jedem Loop wählst du Aufwertungen'],
  },
  campaign: {
    name: 'KAMPAGNE', tag: '15 Sektoren · 45 Sterne', css: '#ffd75e',
    desc: 'Handgebaute Missionen mit eigenen Gegnern, Regeln und Sonderbedingungen.',
    rules: ['Drei Akte mit je fünf Sektoren', 'Jeder Sektor hat ein festes Ziel', 'Bis zu drei Sterne pro Sektor'],
  },
  swarm: {
    name: 'SCHWARM', tag: 'Endlos-Überleben', css: '#ff3d9a',
    desc: 'Kein Zurückspulen, keine Pause. Der Schwarm wächst, bis du fällst.',
    rules: ['Start mit zwei Aufwertungen, alle 20 Sekunden ein neues Echo', 'Weitere Aufwertungen sofort bei jedem Stufenaufstieg', 'Gewertet wird die Überlebenszeit'],
  },
  bossrush: {
    name: 'BOSS-RUSH', tag: 'Nur die Großen', css: '#ff8a3d',
    desc: 'Ein Boss nach dem anderen – jeder stärker als der letzte.',
    rules: ['Du startest mit fünf Aufwertungen', 'Nach jedem Boss rüstest du dreimal auf', 'Gewertet wird die Zahl besiegter Bosse'],
  },
  daily: {
    name: 'TAGES-PARADOX', tag: 'Jeden Tag neu', css: '#9b6bff',
    desc: 'Der Klassiker mit täglich wechselnden Mutatoren und einem Startgeschenk.',
    rules: ['Zwei Mutatoren, für alle gleich', 'Eine zufällige Aufwertung zum Start', 'Ein Rekord pro Tag'],
  },
};
const MODE_ORDER = ['paradox', 'campaign', 'swarm', 'bossrush', 'daily'];

// ---------------------------------------------------------------- Kampagne
const CAMPAIGN = [
  { id: 'c1', act: 1, name: 'Erstkontakt', desc: 'Überstehe zwei Loops und lerne dein erstes Echo kennen.',
    loops: 2, eff: 1, pool: ['drifter'] },
  { id: 'c2', act: 1, name: 'Schwarmlogik', desc: 'Viele kleine Gegner. Lass deine Echos für dich arbeiten.',
    loops: 3, eff: 2, pool: ['drifter', 'weaver'], muts: ['swarm'], start: { dmg: 1 } },
  { id: 'c3', act: 1, name: 'Sturmangriff', desc: 'Stürmer rasen in geraden Linien heran. Bleib in Bewegung.',
    loops: 3, eff: 3, pool: ['dasher', 'drifter'], start: { rate: 1, dmg: 1, multi: 1 } },
  { id: 'c4', act: 1, name: 'Kettenreaktion', desc: 'Alles explodiert. Halte Abstand – und nutze es aus.',
    loops: 3, eff: 3, pool: ['bomber', 'drifter', 'splitter'], muts: ['unstable'], start: { explode: 1, dmg: 1, rate: 1 } },
  { id: 'c5', act: 1, name: 'Der Wächter', desc: 'Zwei Loops Vorbereitung – dann wartet der erste Boss.',
    loops: 2, eff: 3, boss: 1, start: { dmg: 2, rate: 1, multi: 1 } },

  { id: 'c6', act: 2, name: 'Funkstille', desc: 'Deine Waffen schweigen. Nur deine Vergangenheit kämpft.',
    loops: 4, eff: 2, step: 0.7, pool: ['drifter', 'weaver', 'splitter'], muts: ['pacifist'], start: { orbit: 1, echocap: 1 } },
  { id: 'c7', act: 2, name: 'Kreuzfeuer', desc: 'Schützen und Lanzen halten Abstand und decken dich ein.',
    loops: 3, eff: 5, pool: ['shooter', 'lancer', 'weaver', 'drifter'], start: { multi: 1, dmg: 2, rate: 2, pierce: 1 } },
  { id: 'c8', act: 2, name: 'Dunkelfeld', desc: 'Nur du und deine Echos geben Licht. Verteile sie klug.',
    loops: 4, eff: 4, step: 0.7, muts: ['dark'], start: { multi: 1, rate: 2, dmg: 2, echocap: 1 } },
  { id: 'c9', act: 2, name: 'Glaskanone', desc: 'Ein Treffer und es ist vorbei – aber du triffst wie ein Hammer.',
    loops: 3, eff: 5, muts: ['glass'], start: { multi: 1, rate: 1, shield: 1 } },
  { id: 'c10', act: 2, name: 'Der Architekt', desc: 'Der zweite Boss baut Kugelmuster wie ein Uhrwerk.',
    loops: 2, eff: 7, boss: 2, start: { multi: 2, dmg: 3, rate: 2, pierce: 1, echocap: 1 } },

  { id: 'c11', act: 3, name: 'Ereignishorizont', desc: 'Singularitäten verbiegen den Raum – und deine Geschosse.',
    loops: 3, eff: 8, pool: ['well', 'tank', 'drifter', 'weaver'], start: { multi: 2, dmg: 4, rate: 3, pierce: 1, chain: 1, hp: 1 } },
  { id: 'c12', act: 3, name: 'Kurzschluss', desc: 'Sechs kurze Loops. Dein Geschwader wächst rasend schnell.',
    loops: 6, eff: 6, step: 0.5, muts: ['shortloop'], start: { multi: 1, dmg: 2, rate: 2, echocap: 3 } },
  { id: 'c13', act: 3, name: 'Zeitraffer', desc: 'Schneller, mehr, überall.',
    loops: 4, eff: 8, step: 0.7, muts: ['fast', 'swarm'], start: { multi: 2, dmg: 4, rate: 3, chain: 1, pierce: 1, explode: 1 } },
  { id: 'c14', act: 3, name: 'Letzte Schicht', desc: 'Elite-Truppen. Und dein Dash ist gesperrt.',
    loops: 4, eff: 9, step: 0.7, muts: ['elite', 'nodash'], start: { multi: 2, dmg: 5, rate: 3, pierce: 2, chain: 1, shield: 1, hp: 1 } },
  { id: 'c15', act: 3, name: 'Das Paradoxon', desc: 'Drei Loops im Dunkeln – dann der letzte Boss.',
    loops: 3, eff: 10, step: 0.7, boss: 3, bossHp: 0.9, muts: ['dark'], start: { multi: 3, dmg: 5, rate: 4, pierce: 2, echocap: 2, chain: 1, homing: 1 } },
];
const campaignLoops = (lv) => lv.loops + (lv.boss ? 1 : 0);
const campaignUnlocked = (i) => i === 0 || (P.campaign[CAMPAIGN[i - 1].id] || 0) > 0;
function totalStars() {
  let s = 0;
  for (const lv of CAMPAIGN) s += P.campaign[lv.id] || 0;
  return s;
}
const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

// ---------------------------------------------------------------- Tages-Paradox
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function dailyInfo() {
  const d = new Date();
  const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const rng = mulberry32(hashStr('np' + key));
  const pool = ['swarm', 'fast', 'dark', 'shortloop', 'elite', 'nodash', 'unstable'];
  const a = pool.splice(Math.floor(rng() * pool.length), 1)[0];
  const b = pool.splice(Math.floor(rng() * pool.length), 1)[0];
  const gifts = ['multi', 'chain', 'orbit', 'homing', 'explode', 'bounce', 'pierce', 'echocap', 'crit'];
  const gift = gifts[Math.floor(rng() * gifts.length)];
  return { key, muts: [a, b], gift, start: { [gift]: 1 } };
}

// ---------------------------------------------------------------- Erfolge
const ACHIEVEMENTS = [
  { id: 'first_loop', name: 'Déjà-vu', desc: 'Schließe deinen ersten Loop ab.', cores: 5 },
  { id: 'boss1', name: 'Wächter-Bezwinger', desc: 'Besiege den Wächter.', cores: 10 },
  { id: 'boss2', name: 'Bauplan zerrissen', desc: 'Besiege den Architekten.', cores: 15 },
  { id: 'boss3', name: 'Paradox gelöst', desc: 'Besiege das Paradoxon.', cores: 30 },
  { id: 'loop10', name: 'Zehnfach gelebt', desc: 'Erreiche Loop 10 im Paradox-Modus.', cores: 15 },
  { id: 'million', name: 'Erste Million', desc: 'Erziele 1.000.000 Punkte in einem Lauf.', cores: 5 },
  { id: 'mult500', name: 'Kombo-Rausch', desc: 'Erreiche einen Multiplikator von ×500.', cores: 10 },
  { id: 'echo6', name: 'Armee aus mir', desc: 'Kämpfe mit 6 Echos gleichzeitig.', cores: 15 },
  { id: 'nova20', name: 'Supernova', desc: 'Vernichte 20 Gegner mit einer einzigen Nova.', cores: 10 },
  { id: 'nohit_boss', name: 'Unberührbar', desc: 'Besiege einen Boss, ohne im Bosskampf getroffen zu werden.', cores: 20 },
  { id: 'kills1k', name: 'Tausendsassa', desc: '1.000 Abschüsse insgesamt.', cores: 10 },
  { id: 'kills10k', name: 'Schrottpresse', desc: '10.000 Abschüsse insgesamt.', cores: 30 },
  { id: 'act1', name: 'Akt I', desc: 'Schließe die ersten fünf Sektoren ab.', cores: 15 },
  { id: 'act2', name: 'Akt II', desc: 'Schließe Sektor 10 ab.', cores: 25 },
  { id: 'act3', name: 'Akt III', desc: 'Schließe die Kampagne ab.', cores: 40 },
  { id: 'stars30', name: 'Sternensammler', desc: 'Sammle 30 Sterne in der Kampagne.', cores: 30 },
  { id: 'pacifist', name: 'Weiße Weste', desc: 'Schließe den Sektor „Funkstille“ ab.', cores: 10 },
  { id: 'swarm5', name: 'Überlebenskünstler', desc: 'Überlebe 5 Minuten im Schwarm-Modus.', cores: 20 },
  { id: 'rush3', name: 'Riesentöter', desc: 'Besiege 3 Bosse in einem Boss-Rush.', cores: 20 },
  { id: 'daily5', name: 'Tagesform', desc: 'Erreiche Loop 5 im Tages-Paradox.', cores: 10 },
];
const ACH_BY_ID = {};
for (const a of ACHIEVEMENTS) ACH_BY_ID[a.id] = a;

/** Vergibt einen Erfolg (einmalig). Darf beliebig oft aufgerufen werden. */
function award(id) {
  if (G.demo || P.ach[id]) return;
  const a = ACH_BY_ID[id];
  if (!a) return;
  P.ach[id] = true;
  P.cores += a.cores;
  if (G.newAch) G.newAch.push(id);
  saveProfile();
  if (typeof toast === 'function') toast('ERFOLG · ' + a.name.toUpperCase());
  Sfx.levelUp();
}
