'use strict';
/* ====== NEON PARADOX — Profil, Ränge, Schiffe, Werkstatt, Erfolge, Mutatoren, Modi, Kampagne ====== */
const SAVE_KEY = 'neonparadox.v2';

/** Dauerhaftes Spielerprofil (localStorage). */
const P = {
  xp: 0, cores: 0, ship: 'vektor',
  meta: {}, ach: {}, best: {}, bestLoop: 0, campaign: {}, mapLoops: {}, lastMaps: {},
  daily: { key: '', best: 0 },
  stats: { runs: 0, kills: 0, bosses: 0, loops: 0, time: 0, anoms: 0 },
  muted: false, autoFire: true,
  settings: defaultSettings(),
  codex: { e: {}, u: {}, b: {} }, mastery: {}, paint: {}, tutDone: false, ver: '',
};

/** Standard-Einstellungen (siehe settings.js). */
function defaultSettings() {
  return {
    keys: null, tSize: 1, tAlpha: 0.8, stick: 'float', sens: 1.3, dead: 0.14, autoAim: true, lefty: false, pos: {},
    haptic: true, shake: 1, quality: 'auto', music: 0.8, sfx: 1, calm: false, cb: false,
  };
}

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
  const def = defaultSettings();
  for (const k in def) if (P.settings[k] === undefined) P.settings[k] = def[k];
  if (!P.settings.pos || typeof P.settings.pos !== 'object') P.settings.pos = {};
  for (const k of ['e', 'u', 'b']) if (!P.codex[k] || typeof P.codex[k] !== 'object') P.codex[k] = {};
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
  { rank: 2, type: 'map', id: 'pillars', label: 'Arena SÄULENHALLE' },
  { rank: 3, type: 'ship', id: 'phantom', label: 'Schiff PHANTOM' },
  { rank: 3, type: 'map', id: 'cross', label: 'Arena KREUZUNG' },
  { rank: 4, type: 'mode', id: 'bossrush', label: 'Modus BOSS-RUSH' },
  { rank: 5, type: 'mode', id: 'daily', label: 'Modus TAGES-PARADOX' },
  { rank: 5, type: 'map', id: 'blocks', label: 'Arena KAMMERN' },
  { rank: 6, type: 'ship', id: 'bastion', label: 'Schiff BASTION' },
  { rank: 6, type: 'map', id: 'reactor', label: 'Arena REAKTOR' },
  { rank: 7, type: 'feature', id: 'mutators', label: 'Mutatoren für PARADOX und SCHWARM' },
  { rank: 8, type: 'map', id: 'rift', label: 'Arena RISS' },
  { rank: 9, type: 'ship', id: 'prisma', label: 'Schiff PRISMA' },
  { rank: 10, type: 'map', id: 'gears', label: 'Arena ZAHNWERK' },
  { rank: 11, type: 'map', id: 'gates', label: 'Arena SCHLEUSEN' },
  { rank: 12, type: 'ship', id: 'chronos', label: 'Schiff CHRONOS' },
  { camp: 'c20', type: 'ship', id: 'nexus', label: 'Schiff NEXUS' },
];
function unlockEntry(type, id) {
  for (const u of UNLOCKS) if (u.type === type && u.id === id) return u;
  return null;
}
function unlockRank(type, id) {
  const u = unlockEntry(type, id);
  return u && u.rank ? u.rank : 1;
}
/** Beschriftung für Gesperrtes: "AB RANG 6" oder "NACH SEKTOR 20". */
function unlockText(type, id) {
  const u = unlockEntry(type, id);
  if (u && u.camp) return 'NACH SEKTOR ' + u.camp.slice(1);
  return 'AB RANG ' + unlockRank(type, id);
}
function isUnlocked(type, id) {
  const u = unlockEntry(type, id);
  if (u && u.camp) return (P.campaign[u.camp] || 0) > 0;
  return rankInfo(P.xp).rank >= unlockRank(type, id);
}

// ---------------------------------------------------------------- Schiffe
const shipDef = (o) => Object.assign({ hp: 0, speed: 1, dmg: 1, dashCd: 1, multi: 0, echoPow: 0, echoCap: 0, bounce: 0, shield: 0, dashDmg: 0, mirror: 0, hurtNova: 0, drone: 0, droneRate: 1 }, o);
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
  nexus: shipDef({
    name: 'NEXUS', tag: 'Drohnenträger', shape: SHAPES.shipNexus, col: [1.0, 1.9, 1.2], css: '#8dffb0',
    lines: ['Startet mit 2 Kampfdrohnen', 'Drohnen feuern 30 % schneller', '−1 Echo'],
    drone: 2, droneRate: 1.3, echoCap: -1,
  }),
};
const SHIP_ORDER = ['vektor', 'phantom', 'bastion', 'prisma', 'chronos', 'nexus'];

function shipSvg(id) {
  const s = SHIPS[id].shape, pts = [];
  for (let i = 0; i < s.length; i += 2) pts.push(s[i + 1].toFixed(2) + ',' + (-s[i]).toFixed(2));   // Nase nach oben
  return `<svg viewBox="-1.7 -1.8 3.4 3.4" aria-hidden="true"><polygon points="${pts.join(' ')}" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="0.11" stroke-linejoin="round"/></svg>`;
}

// ---------------------------------------------------------------- Werkstatt (dauerhafte Verbesserungen)
const COST5 = [10, 20, 35, 55, 80];
const META_TIERS = [
  { name: 'STUFE I  ·  GRUNDLAGEN', rank: 1 },
  { name: 'STUFE II  ·  TAKTIK', rank: 4 },
  { name: 'STUFE III  ·  EXPERIMENTE', rank: 7 },
];
const META = [
  { id: 'm_hull', name: 'Verstärkte Hülle', desc: '+1 Hülle zu Beginn jedes Laufs', max: 2, cost: [40, 120] },
  { id: 'm_dmg', name: 'Feinjustierung', desc: '+4 % Schaden je Stufe', max: 5, cost: COST5 },
  { id: 'm_nova', name: 'Nova-Speicher', desc: 'Startet mit 20 % Nova-Ladung je Stufe', max: 5, cost: COST5 },
  { id: 'm_magnet', name: 'Sammeldrohne', desc: '+12 % Sammelradius je Stufe', max: 5, cost: COST5 },
  { id: 'm_xp', name: 'Datenbank', desc: '+8 % Splitter-Energie je Stufe – Bonus-Aufwertungen kommen schneller', max: 5, cost: COST5 },
  { id: 'm_echo', name: 'Echo-Kern', desc: '+5 % Echo-Schaden je Stufe', max: 5, cost: COST5 },
  { id: 'm_reroll', name: 'Neuwürfler', desc: '+1 Neuwurf der Aufwertungen pro Lauf', max: 3, cost: [25, 60, 110] },
  { id: 'm_core', name: 'Kernfusion', desc: '+10 % Kerne je Stufe', max: 5, cost: COST5 },
  { id: 'm_banish', tier: 1, name: 'Verbannung', desc: '+1 Verbannung pro Lauf – entfernt eine Karte für den Rest des Laufs', max: 2, cost: [40, 90] },
  { id: 'm_luck', tier: 1, name: 'Glücksalgorithmus', desc: '+12 % Chance auf seltene, epische und legendäre Karten je Stufe', max: 3, cost: [50, 100, 160] },
  { id: 'm_champ', tier: 1, name: 'Trophäenjäger', desc: 'Champions geben +50 % Kerne und Splitter je Stufe', max: 2, cost: [60, 120] },
  { id: 'm_evo', tier: 2, name: 'Evolutionslabor', desc: 'Evolutionen erscheinen 20 % häufiger je Stufe', max: 2, cost: [80, 160] },
  { id: 'm_start', tier: 2, name: 'Vorrat', desc: 'Paradox, Schwarm, Boss-Rush und Tages-Paradox beginnen mit einer zufälligen gewöhnlichen Aufwertung', max: 1, cost: [150] },
];
const metaTier = (m) => m.tier || 0;
const metaOpen = (m) => rankInfo(P.xp).rank >= META_TIERS[metaTier(m)].rank;

function buyMeta(id) {
  const m = META.find((x) => x.id === id), lv = metaLv(id);
  if (!m || lv >= m.max || P.cores < m.cost[lv] || !metaOpen(m)) return false;
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
  tutorial: {
    name: 'TUTORIAL', tag: 'Die Grundlagen', css: '#7dffb2',
    desc: 'Lerne in zwei Minuten alles Wichtige: Bewegen, Feuern, Splitter, Dash, Nova und Echos.',
    rules: ['Schritt für Schritt, ohne Druck', 'Im ersten Loop kannst du nicht sterben', 'Danach kämpft dein erstes Echo mit dir'],
  },
  paradox: {
    name: 'PARADOX', tag: 'Der Klassiker', css: '#5ef2ff',
    desc: 'Endlose Zeitschleifen. Jede überstandene Runde wird zu einem Echo.',
    rules: ['Loops von 30 Sekunden, jeder fünfte ist ein Bosskampf', 'Ab Loop 3 können Anomalien die Regeln ändern', 'Nach Bossen winkt eine epische oder legendäre Aufwertung'],
  },
  campaign: {
    name: 'KAMPAGNE', tag: '30 Sektoren · 5 Geheimakten', css: '#ffd75e',
    desc: 'Handgebaute Missionen mit eigenen Arenen, Gegnern, Regeln und Sonderbedingungen.',
    rules: ['Sechs Akte mit je einem Endgegner', 'Überleben, Jagd, Kern verteidigen, Splitter sammeln, schrumpfende Zone', 'Jeder Sektor hat sein eigenes Drei-Sterne-Ziel', 'Zwei Sterne in allen Sektoren eines Akts öffnen eine Geheimakte'],
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
    rules: ['Zwei Mutatoren und eine Arena, für alle gleich', 'Eine zufällige Aufwertung zum Start', 'Ein Rekord pro Tag'],
  },
};
const MODE_ORDER = ['paradox', 'campaign', 'swarm', 'bossrush', 'daily', 'tutorial'];

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
  { id: 'c7', act: 2, name: 'Kreuzfeuer', desc: 'Schützen und Lanzen halten Abstand und decken dich ein. Die Säulen geben Deckung.',
    map: 'pillars', loops: 3, eff: 5, pool: ['shooter', 'lancer', 'weaver', 'drifter'], start: { multi: 1, dmg: 2, rate: 2, pierce: 1 } },
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

  { id: 'c16', act: 4, name: 'Säulenhalle', desc: 'Hinter den Energiesäulen lauern Schützen und Lanzen. Nutze die Deckung besser als sie.',
    map: 'pillars', loops: 3, eff: 8, pool: ['shooter', 'lancer', 'drifter', 'weaver'], start: { multi: 2, dmg: 4, rate: 3, pierce: 1, bounce: 1, crit: 1 } },
  { id: 'c17', act: 4, name: 'Phasengeister', desc: 'Phasengeister springen dir in den Rücken. Jage sie, bevor sie dich jagen.',
    loops: 99, kills: 500, eff: 7, step: 0.6, pool: ['phaser', 'drifter', 'weaver'], start: { multi: 2, dmg: 4, rate: 3, crit: 2, drone: 1 } },
  { id: 'c18', act: 4, name: 'Brutstätte', desc: 'Brutstöcke speien ohne Pause Nachwuchs aus. Zerstöre sie zuerst – zwischen den Kammern.',
    map: 'blocks', loops: 3, eff: 8, pool: ['hive', 'splitter', 'drifter', 'weaver'], start: { multi: 2, dmg: 5, rate: 3, explode: 1, pierce: 1, laser: 1 } },
  { id: 'c19', act: 4, name: 'Reaktorkern', desc: 'Plasmafelder zünden im Takt. Lies das Feld, bevor es dich liest.',
    map: 'reactor', loops: 4, eff: 8, step: 0.6, start: { multi: 2, dmg: 5, rate: 3, pierce: 1, chain: 1, shield: 1 } },
  { id: 'c20', act: 4, name: 'Die Singularität', desc: 'Der vierte Wächter krümmt den Raum um den Reaktor. Zwei Loops Vorbereitung.',
    map: 'reactor', loops: 2, eff: 9, boss: 4, bossHp: 0.42, start: { multi: 3, dmg: 6, rate: 4, pierce: 2, echocap: 1, chain: 1, homing: 1, hp: 1 } },

  { id: 'c21', act: 5, name: 'Wurmloch', desc: 'Wurmlöcher verbinden die Ecken. Stürmer und Lanzen sind schneller als du – nutze die Abkürzungen.',
    map: 'rift', loops: 3, eff: 6, step: 0.7, muts: ['fast'], pool: ['dasher', 'lancer', 'phaser', 'weaver'], start: { multi: 2, dmg: 5, rate: 4, pierce: 1, dashcd: 2, mine: 1, shield: 1, hp: 1 } },
  { id: 'c22', act: 5, name: 'Ionensturm', desc: 'Blitze schlagen überall ein – auch zwischen den Gegnern. Locke sie hinein.',
    map: 'cross', anom: 'storm', loops: 4, eff: 9, step: 0.6, start: { multi: 2, dmg: 5, rate: 4, pierce: 2, cryo: 2, chain: 1 } },
  { id: 'c23', act: 5, name: 'Treibjagd', desc: 'Ein endloser Schwarm. 900 Abschüsse, dann ist der Sektor gesichert.',
    map: 'pillars', loops: 99, kills: 900, eff: 8, step: 0.5, muts: ['swarm'], start: { multi: 3, dmg: 5, rate: 4, pierce: 2, explode: 1, scatter: 1 } },
  { id: 'c24', act: 5, name: 'Blindflug', desc: 'Dunkelheit, kein Dash, enge Korridore. Deine Drohnen sind deine Augen.',
    map: 'cross', loops: 4, eff: 9, step: 0.6, muts: ['dark', 'nodash'], start: { multi: 2, dmg: 5, rate: 4, pierce: 1, drone: 2, shield: 1, hp: 1, echocap: 1 } },
  { id: 'c25', act: 5, name: 'Omega', desc: 'Am Ende der Zeit wartet der letzte Wächter. Drei Loops – dann OMEGA.',
    map: 'rift', loops: 3, eff: 10, step: 0.6, boss: 5, bossHp: 0.3, start: { multi: 3, dmg: 6, rate: 4, pierce: 2, echocap: 2, chain: 1, homing: 1, laser: 1, hp: 1 } },

  { id: 'c26', act: 6, name: 'Zahnwerk', desc: 'Die Säulen kreisen um die Mitte. Schildträger und Heiler halten die Linie – greif von der Seite an.',
    map: 'gears', loops: 3, eff: 9, step: 0.6, champ: true, pool: ['guard', 'mender', 'drifter', 'weaver', 'dasher'], start: { multi: 2, dmg: 6, rate: 4, pierce: 2, bounce: 1, crit: 2, echocap: 1, shield: 1 } },
  { id: 'c27', act: 6, name: 'Letzte Bastion', desc: 'Ein Zeitkern in der Mitte hält die Schleife stabil. Fällt er, fällt alles. Viele Gegner wollen nur zu ihm – und alle vier Sekunden wehrt er sich mit einer Schockwelle.',
    goal: 'defend', coreHp: 50, loops: 3, eff: 7, step: 0.6, pool: ['drifter', 'weaver', 'dasher', 'splitter', 'guard'], start: { multi: 2, dmg: 5, rate: 4, pierce: 1, drone: 2, orbit: 1, echocap: 1 } },
  { id: 'c28', act: 6, name: 'Schleusenfall', desc: 'Die Zone zieht sich in jedem Loop zusammen, die Schleusen gleiten auf und zu. Bleib im Kreis.',
    map: 'gates', goal: 'shrink', zoneMin: 320, loops: 3, eff: 8, step: 0.6, pool: ['layer', 'drifter', 'weaver', 'shooter'], start: { multi: 2, dmg: 6, rate: 4, pierce: 2, chain: 1, shield: 1, hp: 1 } },
  { id: 'c29', act: 6, name: 'Splitterflut', desc: 'Sammle 3000 Splitter, bevor dich die Flut verschlingt – und ein Champion wartet in jedem Loop.',
    map: 'pillars', loops: 99, collect: 3000, eff: 9, step: 0.6, champ: true, start: { multi: 3, dmg: 6, rate: 4, pierce: 2, magnet: 2, explode: 1, crit: 2 } },
  { id: 'c30', act: 6, name: 'Das Zeitherz', desc: 'Der Ursprung aller Schleifen schlägt im Zahnwerk. Drei Loops – dann das ZEITHERZ.',
    map: 'gears', loops: 3, eff: 11, step: 0.6, boss: 6, bossHp: 0.3, start: { multi: 3, dmg: 7, rate: 4, pierce: 2, echocap: 2, chain: 2, crit: 2, e_storm: 1, homing: 1, laser: 1, hp: 1, shield: 1 } },

  // Geheimakten: öffnen sich mit zwei Sternen in allen fünf Sektoren eines Akts
  { id: 'b1', act: 1, bonus: true, name: 'Schwarmherz', desc: 'Sammle 600 Splitter in einem endlosen Schwarm aus Drohnen und Webern.',
    loops: 99, collect: 600, eff: 3, step: 0.7, muts: ['swarm'], pool: ['drifter', 'weaver', 'splitter'], start: { multi: 1, dmg: 2, rate: 2, magnet: 1 } },
  { id: 'b2', act: 2, bonus: true, name: 'Kernschmelze', desc: 'Verteidige den Zeitkern gegen Stürmer und Bomber – zwischen den Säulen.',
    map: 'pillars', goal: 'defend', coreHp: 45, loops: 3, eff: 4, step: 0.6, pool: ['drifter', 'dasher', 'bomber', 'weaver'], start: { multi: 1, dmg: 3, rate: 2, pierce: 1, drone: 1 } },
  { id: 'b3', act: 3, bonus: true, name: 'Spiegelkabinett', desc: 'Spiegel werfen deine Schüsse zurück, Schildträger blocken sie. Ein Champion bewacht die Kammern.',
    map: 'blocks', loops: 3, eff: 7, step: 0.6, champ: true, pool: ['reflector', 'guard', 'weaver', 'drifter'], start: { multi: 2, dmg: 4, rate: 3, bounce: 2, laser: 1, chain: 1 } },
  { id: 'b4', act: 4, bonus: true, name: 'Minenfeld', desc: 'Minenleger und Phasengeister in einer schrumpfenden Zone. Kein Platz zum Ausweichen.',
    map: 'cross', goal: 'shrink', zoneMin: 300, loops: 3, eff: 8, step: 0.6, pool: ['layer', 'phaser', 'drifter', 'mender'], start: { multi: 2, dmg: 5, rate: 4, pierce: 2, cryo: 2, shield: 1, hp: 1 } },
  { id: 'b5', act: 5, bonus: true, name: 'Nullzeit', desc: 'Kein Vorspiel: OMEGA wartet sofort. Glaskanone mit zwei Schildladungen – ein Treffer zu viel und es ist vorbei.',
    map: 'rift', loops: 0, eff: 9, boss: 5, bossHp: 0.42, muts: ['glass'], start: { multi: 3, dmg: 5, rate: 4, pierce: 2, echocap: 2, chain: 1, homing: 1, laser: 2, dashcd: 2, shield: 2 } },
];
// Drei-Sterne-Ziele je Sektor (★ abschließen · ★ höchstens 2 Treffer · ★ Sonderziel)
const STAR3 = {
  c1: { t: 'nohit' }, c2: { t: 'mult', v: 80 }, c3: { t: 'nodash' }, c4: { t: 'streak', v: 30 }, c5: { t: 'time', v: 110 },
  c6: { t: 'nohit' }, c7: { t: 'mult', v: 120 }, c8: { t: 'novas', v: 3 }, c9: { t: 'streak', v: 40 }, c10: { t: 'time', v: 120 },
  c11: { t: 'nohit' }, c12: { t: 'mult', v: 200 }, c13: { t: 'streak', v: 60 }, c14: { t: 'nonova' }, c15: { t: 'time', v: 150 },
  c16: { t: 'nohit' }, c17: { t: 'time', v: 160 }, c18: { t: 'streak', v: 50 }, c19: { t: 'nodash' }, c20: { t: 'time', v: 130 },
  c21: { t: 'mult', v: 150 }, c22: { t: 'nohit' }, c23: { t: 'time', v: 200 }, c24: { t: 'novas', v: 2 }, c25: { t: 'nohit' },
  c26: { t: 'nodash' }, c27: { t: 'core', v: 70 }, c28: { t: 'nohit' }, c29: { t: 'time', v: 150 }, c30: { t: 'nohit' },
  b1: { t: 'time', v: 80 }, b2: { t: 'core', v: 60 }, b3: { t: 'streak', v: 40 }, b4: { t: 'nodash' }, b5: { t: 'time', v: 60 },
};
for (const lv of CAMPAIGN) if (STAR3[lv.id]) lv.s3 = STAR3[lv.id];
for (const id of ['c13', 'c14', 'c18', 'c19', 'c22', 'c24']) CAMPAIGN.find((l) => l.id === id).champ = true;

const ACT_NAMES = ['ERSTKONTAKT', 'IM ECHO', 'DAS PARADOXON', 'RISSE IM RAUM', 'OMEGA', 'JENSEITS DER ZEIT'];
const campaignLoops = (lv) => lv.loops + (lv.boss ? 1 : 0);
/** Hauptsektoren öffnen sich nacheinander, Geheimakten mit 2 Sternen in allen Sektoren ihres Akts. */
function campaignUnlocked(i) {
  const lv = CAMPAIGN[i];
  if (lv.bonus) return CAMPAIGN.every((x) => x.bonus || x.act !== lv.act || (P.campaign[x.id] || 0) >= 2);
  return i === 0 || (P.campaign[CAMPAIGN[i - 1].id] || 0) > 0;
}
/** Anzeige-Nummer: 1 … 30 oder B1 … B5. */
const secLabel = (lv) => (lv.bonus ? 'B' + lv.id.slice(1) : String(CAMPAIGN.indexOf(lv) + 1));
/** Index des nächsten Hauptsektors (oder -1). */
function nextSector(i) {
  const lv = CAMPAIGN[i];
  if (lv.bonus) return -1;
  return i + 1 < CAMPAIGN.length && !CAMPAIGN[i + 1].bonus ? i + 1 : -1;
}
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
  const gifts = ['multi', 'chain', 'orbit', 'homing', 'explode', 'bounce', 'pierce', 'echocap', 'crit', 'drone', 'laser', 'cryo', 'mine'];
  const gift = gifts[Math.floor(rng() * gifts.length)];
  const map = MAP_ORDER[Math.floor(rng() * MAP_ORDER.length)];
  return { key, muts: [a, b], gift, map, start: { [gift]: 1 } };
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
  { id: 'boss4', name: 'Raumkrümmer', desc: 'Besiege die Singularität.', cores: 30 },
  { id: 'boss5', name: 'Omega-Punkt', desc: 'Besiege OMEGA.', cores: 50 },
  { id: 'act4', name: 'Akt IV', desc: 'Schließe Sektor 20 ab.', cores: 30 },
  { id: 'act5', name: 'Ende der Zeit', desc: 'Schließe Sektor 25 ab.', cores: 60 },
  { id: 'stars60', name: 'Sternenflotte', desc: 'Sammle 60 Sterne in der Kampagne.', cores: 50 },
  { id: 'rewind', name: 'Zweite Chance', desc: 'Überlebe einen tödlichen Treffer dank Zeitumkehr.', cores: 15 },
  { id: 'legend', name: 'Legende', desc: 'Wähle eine legendäre Aufwertung.', cores: 10 },
  { id: 'anom10', name: 'Sturmerprobt', desc: 'Überstehe 10 Loops mit Anomalie.', cores: 20 },
  { id: 'maps', name: 'Weltenbummler', desc: 'Überstehe einen Loop in jeder Arena.', cores: 25 },
  { id: 'tut', name: 'Grundausbildung', desc: 'Schließe das Tutorial ab.', cores: 5 },
  { id: 'evo', name: 'Evolution', desc: 'Wähle deine erste Evolution.', cores: 15 },
  { id: 'champ', name: 'Champion-Jäger', desc: 'Besiege insgesamt 10 Champions.', cores: 20 },
  { id: 'streak', name: 'Zeitsturm', desc: 'Erreiche eine Serie von 60 Abschüssen.', cores: 15 },
  { id: 'codex', name: 'Archivar', desc: 'Entdecke alle Gegnerarten im Kodex.', cores: 25 },
  { id: 'mastery', name: 'Meisterpilot', desc: 'Erreiche Meisterschaft 5 mit einem Schiff.', cores: 25 },
  { id: 'boss6', name: 'Herzstillstand', desc: 'Besiege das ZEITHERZ.', cores: 60 },
  { id: 'act6', name: 'Jenseits der Zeit', desc: 'Schließe Sektor 30 ab.', cores: 70 },
  { id: 'stars90', name: 'Sternenmeer', desc: 'Sammle 90 Sterne in der Kampagne.', cores: 70 },
  { id: 'bonus', name: 'Geheimdienst', desc: 'Schließe alle fünf Geheimakten ab.', cores: 60 },
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
