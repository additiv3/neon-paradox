'use strict';
/* ====== NEON PARADOX — Aufwertungen ====== */
const RARITY = [
  { name: 'GEWÖHNLICH', cls: 'r0', weight: 100 },
  { name: 'SELTEN', cls: 'r1', weight: 44 },
  { name: 'EPISCH', cls: 'r2', weight: 12 },
];

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
];

const UPGRADE_BY_ID = {};
for (const u of UPGRADES) UPGRADE_BY_ID[u.id] = u;

function upgradeIcon(u) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${u.icon}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Zieht bis zu n verschiedene, noch nicht ausgereizte Aufwertungen (nach Seltenheit gewichtet). */
function rollUpgrades(n) {
  const pool = UPGRADES.filter((u) => (G.up[u.id] || 0) < u.max && (!u.cond || u.cond()));
  const out = [];
  while (out.length < n && pool.length) {
    let total = 0;
    const w = pool.map((u) => {
      const x = RARITY[u.rarity].weight + (u.rarity > 0 ? G.loop * 2.2 : 0);
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
  recomputeStats();
  const p = G.player;
  if (u.id === 'hp') p.hp = Math.min(S.maxHp, p.hp + 1);
  else if (u.id === 'heal') p.hp = Math.min(S.maxHp, p.hp + 2);
  else if (u.id === 'shield') { p.shieldUp = true; p.shieldT = 0; }
}
