'use strict';
/* ====== NEON PARADOX — Aufwertungen ====== */
const RARITY = [
  { name: 'GEWÖHNLICH', cls: 'r0', weight: 100 },
  { name: 'SELTEN', cls: 'r1', weight: 44 },
  { name: 'EPISCH', cls: 'r2', weight: 12 },
  { name: 'LEGENDÄR', cls: 'r3', weight: 3 },
];
const noPacifist = () => !G.run.muts.pacifist;
/** Legendäres gibt es erst ab Loop 4, im Boss-Rush sofort, im Schwarm ab Stufe 6. */
const legendOK = () => G.loop >= 4 || G.run.mode === 'bossrush' || (G.run.mode === 'swarm' && G.level >= 6);

const UPGRADES = [
  // ---- gewöhnlich ----
  { id: 'dmg', rarity: 0, max: 12, name: 'Überladene Spulen', desc: '+25 % Schaden für dich und deine Echos.',
    icon: 'M12 2 L14 9 L21 7 L16 12 L21 17 L14 15 L12 22 L10 15 L3 17 L8 12 L3 7 L10 9 Z' },
  { id: 'rate', rarity: 0, max: 10, name: 'Schnellfeuer', desc: '+18 % Feuerrate.',
    icon: 'M4 6 L10 12 L4 18 M10 6 L16 12 L10 18 M16 6 L22 12 L16 18' },
  { id: 'speed', rarity: 0, max: 5, name: 'Schubdüsen', desc: '+10 % Bewegungstempo.',
    icon: 'M3 12 H15 M15 6 L21 12 L15 18 M3 7 H9 M3 17 H9' },
  { id: 'hp', rarity: 0, max: 4, name: 'Hüllenpanzerung', desc: '+1 maximale Hülle, sofort 1 Punkt repariert.',
    icon: 'M12 2 L21 7 V17 L12 22 L3 17 V7 Z M12 8 V16 M8 12 H16', cond: () => !G.run.muts.glass },
  { id: 'heal', rarity: 0, max: 99, name: 'Notreparatur', desc: 'Repariert sofort 2 Hüllenpunkte.',
    icon: 'M12 4 V20 M4 12 H20', cond: () => G.player.hp < S.maxHp && !G.run.muts.glass },
  { id: 'magnet', rarity: 0, max: 4, name: 'Magnetfeld', desc: '+60 % Sammelradius für Splitter.',
    icon: 'M6 3 V13 A6 6 0 0 0 18 13 V3 M3 7 H9 M15 7 H21' },
  { id: 'bspeed', rarity: 0, max: 4, name: 'Railgun-Läufe', desc: '+20 % Projektiltempo und Reichweite.',
    icon: 'M3 12 H21 M15 6 L21 12 L15 18' },
  { id: 'dashcd', rarity: 0, max: 4, name: 'Phasenkühler', desc: 'Dash lädt 20 % schneller.',
    icon: 'M5 5 L12 12 L5 19 M12 5 L19 12 L12 19', cond: () => !G.run.muts.nodash },
  { id: 'echopow', rarity: 0, max: 6, name: 'Echo-Verstärker', desc: 'Echos verursachen +15 % deines Schadens.',
    icon: 'M4 18 L10 4 L16 18 Z M10 18 L15 8 L20 18' },
  { id: 'knock', rarity: 0, max: 3, name: 'Wuchtgeschosse', desc: '+8 % Schaden, Treffer stoßen Gegner zurück.',
    icon: 'M3 12 H13 M9 7 L14 12 L9 17 M17 5 V19 M21 8 V16' },
  { id: 'regen', rarity: 0, max: 3, name: 'Nanoreparatur', desc: 'Repariert alle 40 s einen Hüllenpunkt (je Stufe 10 s schneller).',
    icon: 'M12 3 V21 M3 12 H21 M6 6 L18 18 M18 6 L6 18', cond: () => !G.run.muts.glass },
  { id: 'novapow', rarity: 0, max: 3, name: 'Nova-Fokus', desc: 'Die Nova wird 25 % größer und stärker.',
    icon: 'M12 2 V6 M12 18 V22 M2 12 H6 M18 12 H22 M12 8 A4 4 0 1 0 12 16 A4 4 0 1 0 12 8' },
  // ---- selten ----
  { id: 'multi', rarity: 1, max: 4, name: 'Mehrfachschuss', desc: '+1 Projektil pro Salve – auch für alle Echos.',
    icon: 'M4 12 L20 4 M4 12 H20 M4 12 L20 20' },
  { id: 'pierce', rarity: 1, max: 4, name: 'Durchschlag', desc: 'Projektile durchdringen +1 Gegner.',
    icon: 'M2 12 H22 M16 7 L22 12 L16 17 M10 4 V20' },
  { id: 'bounce', rarity: 1, max: 3, name: 'Abpraller', desc: 'Projektile prallen +1× von den Wänden ab.',
    icon: 'M2 18 L8 6 L14 18 L20 6' },
  { id: 'crit', rarity: 1, max: 5, name: 'Schwachstellen-Scanner', desc: '+12 % Chance auf kritische Treffer (×2,5).',
    icon: 'M12 2 V8 M12 16 V22 M2 12 H8 M16 12 H22 M12 9 A3 3 0 1 0 12 15 A3 3 0 1 0 12 9' },
  { id: 'explode', rarity: 1, max: 3, name: 'Splittergeschosse', desc: 'Treffer explodieren und verletzen Gegner in der Nähe.',
    icon: 'M12 8 A4 4 0 1 0 12 16 A4 4 0 1 0 12 8 M12 1 V4 M12 20 V23 M1 12 H4 M20 12 H23 M4 4 L6 6 M18 18 L20 20 M4 20 L6 18 M18 6 L20 4' },
  { id: 'echocap', rarity: 1, max: 5, name: 'Zeitanker', desc: '+1 Echo kann gleichzeitig existieren.',
    icon: 'M12 3 L17 10 H7 Z M12 10 L17 17 H7 Z M5 21 H19' },
  { id: 'shield', rarity: 1, max: 3, name: 'Phasenschild', desc: 'Fängt einen Treffer ab und lädt sich wieder auf.',
    icon: 'M12 2 L20 5 V12 C20 17 16 20 12 22 C8 20 4 17 4 12 V5 Z' },
  { id: 'novacharge', rarity: 1, max: 3, name: 'Nova-Kondensator', desc: 'Die Nova lädt 35 % schneller.',
    icon: 'M12 5 A7 7 0 1 0 12 19 A7 7 0 1 0 12 5 M12 9 A3 3 0 1 0 12 15 A3 3 0 1 0 12 9' },
  { id: 'resonance', rarity: 1, max: 3, name: 'Resonanz', desc: 'In der Nähe eines Echos: +35 % Feuerrate.',
    icon: 'M3 9 Q6 3 9 9 T15 9 T21 9 M3 16 Q6 10 9 16 T15 16 T21 16' },
  { id: 'ghostblade', rarity: 1, max: 3, name: 'Geisterklingen', desc: 'Echos zerschneiden Gegner, die sie berühren.',
    icon: 'M4 20 L20 4 M14 4 H20 V10 M4 14 L10 20' },
  { id: 'dashdmg', rarity: 1, max: 3, name: 'Phasenriss', desc: 'Dein Dash schneidet durch Gegner und richtet schweren Schaden an.',
    icon: 'M2 12 H9 M15 12 H22 M9 5 L15 12 L9 19 M13 3 L11 21', cond: () => !G.run.muts.nodash },
  { id: 'drone', rarity: 1, max: 3, name: 'Kampfdrohne', desc: '+1 Drohne umkreist dich und feuert selbstständig auf den nächsten Gegner.',
    icon: 'M12 9 L15 12 L12 15 L9 12 Z M4 4 L9 9 M20 4 L15 9 M4 20 L9 15 M20 20 L15 15', cond: noPacifist },
  { id: 'cryo', rarity: 1, max: 3, name: 'Kryo-Munition', desc: '15 % Chance, getroffene Gegner 2 s lang stark zu verlangsamen.',
    icon: 'M12 2 V22 M3 7 L21 17 M3 17 L21 7 M9 3 L12 6 L15 3 M9 21 L12 18 L15 21' },
  { id: 'rear', rarity: 1, max: 2, name: 'Heckgeschütz', desc: 'Jede Salve feuert auch nach hinten (Stufe 2: Dreifach-Fächer).',
    icon: 'M12 4 V20 M7 9 L12 4 L17 9 M7 15 L12 20 L17 15' },
  { id: 'mine', rarity: 1, max: 3, name: 'Zeitminen', desc: 'Dein Dash hinterlässt eine Mine, die kurz darauf explodiert.',
    icon: 'M12 7 A5 5 0 1 0 12 17 A5 5 0 1 0 12 7 M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22', cond: () => !G.run.muts.nodash },
  { id: 'scatter', rarity: 1, max: 3, name: 'Splitterkern', desc: 'Besiegte Gegner zerplatzen in 3 Projektile (+1 je Stufe).',
    icon: 'M12 12 L4 4 M12 12 L20 4 M12 12 L4 20 M12 12 L20 20 M12 12 L12 2 M12 12 L12 22' },
  // ---- episch ----
  { id: 'chain', rarity: 2, max: 3, name: 'Kettenblitz', desc: 'Treffer springen als Blitz auf weitere Gegner über.',
    icon: 'M13 2 L5 13 H11 L9 22 L19 10 H13 Z' },
  { id: 'homing', rarity: 2, max: 2, name: 'Suchkopf', desc: 'Projektile lenken auf Gegner ein.',
    icon: 'M3 18 C3 8 12 6 18 8 M14 4 L19 8 L14 12' },
  { id: 'echonova', rarity: 2, max: 1, name: 'Paradoxon', desc: 'Zündest du die Nova, zünden alle Echos mit.',
    icon: 'M12 3 A9 9 0 1 0 12 21 A9 9 0 1 0 12 3 M12 10 A2 2 0 1 0 12 14 A2 2 0 1 0 12 10 M5 5 L7 7 M19 5 L17 7 M5 19 L7 17 M19 19 L17 17' },
  { id: 'orbit', rarity: 2, max: 3, name: 'Orbitalklingen', desc: 'Klingen kreisen um dein Schiff und zerlegen alles in Reichweite.',
    icon: 'M12 9 A3 3 0 1 0 12 15 A3 3 0 1 0 12 9 M3 12 A9 4 0 1 0 21 12 A9 4 0 1 0 3 12' },
  { id: 'timewarp', rarity: 2, max: 2, name: 'Zeitdilatation', desc: 'Gegner in deiner Nähe werden 25 % langsamer.',
    icon: 'M6 3 H18 M6 21 H18 M7 3 C7 9 17 15 17 21 M17 3 C17 9 7 15 7 21' },
  { id: 'mirror', rarity: 2, max: 2, name: 'Spiegelung', desc: 'Dein neuestes Echo bekommt einen Spiegelzwilling auf der anderen Seite der Arena.',
    icon: 'M12 2 V22 M9 6 L3 12 L9 18 Z M15 6 L21 12 L15 18 Z' },
  { id: 'hole', rarity: 2, max: 2, name: 'Ereignishorizont', desc: 'Die Nova hinterlässt ein Schwarzes Loch, das Gegner einsaugt und zermalmt.',
    icon: 'M12 9 A3 3 0 1 0 12 15 A3 3 0 1 0 12 9 M12 3 C18 3 21 8 19 12 M12 21 C6 21 3 16 5 12 M3 9 C4 5 8 3 12 3 M21 15 C20 19 16 21 12 21' },
  { id: 'laser', rarity: 2, max: 3, name: 'Phasenlaser', desc: 'Alle 2,5 s feuert dein Schiff einen Strahl, der alles in Zielrichtung durchschlägt.',
    icon: 'M2 12 H22 M2 9 H8 M2 15 H8 M18 6 L22 12 L18 18', cond: noPacifist },
  { id: 'combo', rarity: 2, max: 2, name: 'Kombo-Kern', desc: '+1 % Schaden je 10er-Multiplikator (bis +60 % je Stufe).',
    icon: 'M4 20 L4 14 M9 20 L9 10 M14 20 L14 6 M19 20 L19 3' },
  // ---- legendär ----
  { id: 'rewind', rarity: 3, max: 1, name: 'Zeitumkehr', desc: 'Einmal pro Lauf: Ein tödlicher Treffer spult die Zeit zurück – volle Hülle, Gegner ringsum vergehen.',
    icon: 'M4 12 A8 8 0 1 0 7 6 M4 3 V8 H9 M12 8 V12 L15 14', cond: legendOK },
  { id: 'legion', rarity: 3, max: 1, name: 'Legion', desc: 'Deine Echos feuern doppelt so schnell.',
    icon: 'M3 18 L7 8 L11 18 M9 18 L13 6 L17 18 M15 18 L19 10 L22 18', cond: legendOK },
  { id: 'twin', rarity: 3, max: 1, name: 'Chronoklon', desc: 'Ein lebender Klon fliegt dir gespiegelt gegenüber und feuert jede deiner Salven mit.',
    icon: 'M6 4 L10 12 L6 20 M18 4 L14 12 L18 20 M12 2 V22', cond: () => legendOK() && noPacifist() },
];

const UPGRADE_BY_ID = {};
for (const u of UPGRADES) UPGRADE_BY_ID[u.id] = u;

function upgradeIcon(u) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${u.icon}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Zieht bis zu n verschiedene, noch nicht ausgereizte Aufwertungen (nach Seltenheit gewichtet).
    rare = true: die erste Karte ist mindestens episch (Belohnung nach Bossen). */
function rollUpgrades(n, rare) {
  const pool = UPGRADES.filter((u) => (G.up[u.id] || 0) < u.max && (!u.cond || u.cond()));
  const out = [];
  while (out.length < n && pool.length) {
    const force = rare && out.length === 0 && pool.some((u) => u.rarity >= 2);
    let total = 0;
    const w = pool.map((u) => {
      let x = RARITY[u.rarity].weight + (u.rarity === 3 ? G.loop * 0.6 : u.rarity > 0 ? G.loop * 2.2 : 0);
      if (force && u.rarity < 2) x = 0;
      total += x;
      return x;
    });
    let r = Math.random() * total, i = 0;
    for (; i < pool.length - 1; i++) { r -= w[i]; if (r <= 0) break; }
    out.push(pool[i]);
    pool.splice(i, 1);
  }
  return out;
}

function applyUpgrade(u) {
  G.up[u.id] = (G.up[u.id] || 0) + 1;
  if (u.rarity === 3) award('legend');
  recomputeStats();
  const p = G.player;
  if (u.id === 'hp') p.hp = Math.min(S.maxHp, p.hp + 1);
  else if (u.id === 'heal') p.hp = Math.min(S.maxHp, p.hp + 2);
  else if (u.id === 'shield') { p.shieldUp = true; p.shieldT = 0; }
}
