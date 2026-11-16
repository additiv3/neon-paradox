'use strict';
/* ====== NEON PARADOX — Menüs: Zentrale, Kampagne, Hangar, Werkstatt, Erfolge ====== */
const menu = { mode: 'paradox', level: 0, muts: { paradox: [], swarm: [] }, map: { paradox: 'grid', swarm: 'grid', bossrush: 'grid' } };
const ENEMY_NAMES = {
  drifter: 'Drifter', weaver: 'Weber', dasher: 'Stürmer', splitter: 'Teiler', bomber: 'Bomber',
  shooter: 'Schütze', lancer: 'Lanze', tank: 'Koloss', well: 'Singularität', phaser: 'Phasengeist', hive: 'Brutstock',
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

function campaignGoal(lv) {
  if (lv.kills) return `Vernichte ${lv.kills} Gegner`;
  return lv.boss ? `Überstehe ${lv.loops} Loops und besiege ${bossName(lv.boss)}` : `Überstehe ${lv.loops} Loops`;
}
function mapChips(mode) {
  const sel = menu.map[mode] || 'grid';
  let h = '<div class="chips">';
  for (const id of MAP_ORDER) {
    const un = isUnlocked('map', id);
    h += `<button class="chip map${id === sel ? ' on' : ''}${un ? '' : ' locked'}" data-map="${id}" title="${un ? MAPS[id].desc : unlockText('map', id)}">` +
      `<b>${MAPS[id].name}</b>${un ? '' : `<i>${unlockText('map', id)}</i>`}</button>`;
  }
  h += `<button class="chip map${sel === 'random' ? ' on' : ''}" data-map="random"><b>ZUFALL</b></button></div>`;
  const d = sel === 'random' ? 'Jeder Lauf startet in einer zufälligen freigeschalteten Arena.' : MAPS[sel].desc;
  return h + `<div class="mut-descs"><div>${d}</div></div>`;
}

function mutChip(id, on, fixed) {
  const m = MUTATORS[id];
  return `<button class="chip${on ? ' on' : ''}${fixed ? ' fixed' : ''}" data-mut="${id}" title="${m.desc}"><b>${m.name}</b><i>+${Math.round(m.bonus * 100)} %</i></button>`;
}
function mutDescs(list) {
  return list.length ? '<div class="mut-descs">' + list.map((id) => `<div><b>${MUTATORS[id].name}:</b> ${MUTATORS[id].desc}</div>`).join('') + '</div>' : '';
}

function modeBest(id) {
  if (id === 'paradox') return P.best.paradox ? `REKORD ${fmt(P.best.paradox)}  ·  LOOP ${P.bestLoop}` : '';
  if (id === 'campaign') return `★ ${totalStars()} / ${CAMPAIGN.length * 3}`;
  if (id === 'swarm') return P.best.swarm ? `REKORD ${mmss(P.best.swarm)}` : '';
  if (id === 'bossrush') return P.best.bossrush ? `REKORD ${P.best.bossrush} ${P.best.bossrush === 1 ? 'BOSS' : 'BOSSE'}` : '';
  if (id === 'daily') return P.daily.key === dailyInfo().key && P.daily.best ? `HEUTE ${fmt(P.daily.best)}` : '';
  return '';
}

// ---------------------------------------------------------------- Zentrale
function openHub() {
  if (!G.demo) startDemo('screen-hub'); else show('screen-hub');
  $('hub-note').textContent = '';
  renderHub();
}
function hubNote(text) { $('hub-note').textContent = text; }

function renderHub() {
  const ri = rankInfo(P.xp);
  $('rank-num').textContent = ri.rank;
  $('rank-name').textContent = 'RANG ' + ri.rank + '  ·  ' + ri.name;
  $('rank-fill').style.transform = `scaleX(${(ri.cur / ri.need).toFixed(3)})`;
  $('rank-xp').textContent = `${fmt(ri.cur)} / ${fmt(ri.need)} XP`;
  $('cores-n').textContent = fmt(P.cores);
  $('btn-hangar').textContent = 'HANGAR  ·  ' + SHIPS[P.ship].name;
  const next = UNLOCKS.find((u) => u.rank > ri.rank);
  $('rank-next').textContent = next ? `Rang ${next.rank}: ${next.label}` : 'Alles freigeschaltet';
  $('mode-list').innerHTML = MODE_ORDER.map((id) => {
    const m = MODES[id], locked = !isUnlocked('mode', id);
    return `<button class="mode-item${id === menu.mode ? ' sel' : ''}${locked ? ' locked' : ''}" data-mode="${id}" style="--c:${m.css}">` +
      `<span class="mode-name">${m.name}</span><span class="mode-tag">${locked ? unlockText('mode', id) : m.tag}</span>` +
      `<span class="mode-best">${locked ? '' : modeBest(id)}</span></button>`;
  }).join('');
  renderModeDetail();
}

function renderModeDetail() {
  const id = menu.mode, m = MODES[id], locked = !isUnlocked('mode', id);
  let h = `<div class="kicker" style="color:${m.css}">${m.tag.toUpperCase()}</div><h2>${m.name}</h2>` +
    `<p class="md-desc">${m.desc}</p><ul class="md-rules">${m.rules.map((r) => `<li>${r}</li>`).join('')}</ul>`;
  if (id === 'daily') {
    const d = dailyInfo();
    h += `<div class="md-sub">HEUTE  ·  ${d.key}</div><div class="chips">${d.muts.map((x) => mutChip(x, true, true)).join('')}` +
      `<span class="chip gift"><b>Startgeschenk</b><i>${UPGRADE_BY_ID[d.gift].name}</i></span>` +
      `<span class="chip gift"><b>Arena</b><i>${MAPS[d.map].name}</i></span></div>${mutDescs(d.muts)}`;
  }
  if ((id === 'paradox' || id === 'swarm' || id === 'bossrush') && !locked) h += `<div class="md-sub">ARENA</div>${mapChips(id)}`;
  if (id === 'paradox' || id === 'swarm') {
    if (isUnlocked('feature', 'mutators')) {
      const sel = menu.muts[id];
      let mul = 1;
      for (const x of sel) mul *= 1 + MUTATORS[x].bonus;
      h += `<div class="md-sub">MUTATOREN  ·  PUNKTE ×${mul.toFixed(2).replace('.', ',')}</div>` +
        `<div class="chips">${FREE_MUTATORS.map((x) => mutChip(x, sel.indexOf(x) >= 0, false)).join('')}</div>${mutDescs(sel)}`;
    } else h += `<div class="md-sub dim">MUTATOREN AB RANG ${unlockRank('feature', 'mutators')}</div>`;
  }
  const best = locked ? '' : modeBest(id);
  if (best) h += `<div class="md-best">${best}</div>`;
  h += locked
    ? `<div class="md-lock">Wird freigeschaltet: ${unlockText('mode', id)}</div>`
    : `<button id="btn-mode-start" class="btn big">${id === 'campaign' ? 'SEKTORKARTE' : 'STARTEN'}</button>`;
  $('mode-detail').innerHTML = h;
}

function hubStart() {
  const id = menu.mode;
  if (!isUnlocked('mode', id)) return;
  if (id === 'campaign') { openCampaign(); return; }
  const free = (id === 'paradox' || id === 'swarm') && isUnlocked('feature', 'mutators');
  let map = menu.map[id] || 'grid';
  if (map !== 'random' && !isUnlocked('map', map)) map = 'grid';
  startGame({ mode: id, muts: free ? menu.muts[id].slice() : [], map });
}

// ---------------------------------------------------------------- Kampagne
function openCampaign() {
  if (!G.demo) startDemo('screen-campaign'); else show('screen-campaign');
  let pickLv = CAMPAIGN.length - 1;                 // erster offener, noch nicht geschaffter Sektor
  for (let i = 0; i < CAMPAIGN.length; i++) {
    if (campaignUnlocked(i) && !(P.campaign[CAMPAIGN[i].id] > 0)) { pickLv = i; break; }
  }
  menu.level = pickLv;
  renderCampaign();
}

function renderCampaign() {
  $('camp-stars').textContent = `★ ${totalStars()} / ${CAMPAIGN.length * 3}`;
  let h = '';
  const acts = CAMPAIGN[CAMPAIGN.length - 1].act;
  for (let act = 1; act <= acts; act++) {
    h += `<div class="act"><div class="act-name">AKT ${ROMAN[act - 1]}  ·  ${ACT_NAMES[act - 1]}</div><div class="act-row">`;
    CAMPAIGN.forEach((lv, i) => {
      if (lv.act !== act) return;
      const un = campaignUnlocked(i), st = P.campaign[lv.id] || 0;
      h += `<button class="tile${i === menu.level ? ' sel' : ''}${un ? '' : ' locked'}${lv.boss ? ' boss' : ''}${st ? ' done' : ''}" data-lv="${i}">` +
        `<span class="tile-n">${i + 1}</span><span class="tile-name">${lv.name}</span>` +
        `<span class="tile-stars">${un ? starText(st) : 'GESPERRT'}</span></button>`;
    });
    h += '</div></div>';
  }
  $('camp-grid').innerHTML = h;
  renderLevelDetail();
}

function renderLevelDetail() {
  const i = menu.level, lv = CAMPAIGN[i], un = campaignUnlocked(i), st = P.campaign[lv.id] || 0, muts = lv.muts || [];
  let h = `<div class="kicker">SEKTOR ${i + 1}  ·  AKT ${ROMAN[lv.act - 1]}</div><h2>${lv.name.toUpperCase()}</h2><p class="md-desc">${lv.desc}</p>`;
  h += `<ul class="md-rules"><li><b>Ziel:</b> ${campaignGoal(lv)}</li>`;
  h += `<li><b>Arena:</b> ${MAPS[lv.map || 'grid'].name}</li>`;
  if (lv.anom) h += `<li><b>Anomalie:</b> ${ANOMALIES[lv.anom].name} – ${ANOMALIES[lv.anom].desc.split(' · ')[0]}</li>`;
  if (lv.pool) h += `<li><b>Gegner:</b> ${lv.pool.map((k) => ENEMY_NAMES[k] || k).join(', ')}</li>`;
  const rw = UNLOCKS.find((u) => u.camp === lv.id);
  if (rw) h += `<li><b>Belohnung:</b> ${rw.label}</li>`;
  if (lv.start) {
    h += `<li><b>Startausrüstung:</b> ${Object.keys(lv.start).map((id) => UPGRADE_BY_ID[id].name + (lv.start[id] > 1 ? ' ×' + lv.start[id] : '')).join(', ')}</li>`;
  }
  h += '</ul>';
  if (muts.length) h += `<div class="chips">${muts.map((x) => mutChip(x, true, true)).join('')}</div>${mutDescs(muts)}`;
  h += `<div class="md-best"><span class="stars">${starText(st)}</span><span class="star-rule">★ abschließen  ·  ★★ höchstens 2 Treffer  ·  ★★★ kein Treffer</span></div>`;
  h += un ? '<button id="btn-level-start" class="btn big">STARTEN</button>' : `<div class="md-lock">Schließe zuerst Sektor ${i} ab</div>`;
  $('camp-detail').innerHTML = h;
}

function campaignStart() {
  if (campaignUnlocked(menu.level)) startGame({ mode: 'campaign', level: menu.level });
}

// ---------------------------------------------------------------- Hangar
function openHangar() { show('screen-hangar'); renderHangar(); }

function renderHangar() {
  $('hangar-grid').innerHTML = SHIP_ORDER.map((id) => {
    const s = SHIPS[id], un = isUnlocked('ship', id), sel = P.ship === id;
    return `<button class="ship-card${sel ? ' sel' : ''}${un ? '' : ' locked'}" data-ship="${id}" style="--c:${s.css}">` +
      `<span class="ship-art">${shipSvg(id)}</span><span class="ship-name">${s.name}</span><span class="ship-tag">${s.tag}</span>` +
      `<span class="ship-lines">${s.lines.map((l) => `<i>${l}</i>`).join('')}</span>` +
      `<span class="ship-state">${sel ? 'AUSGEWÄHLT' : un ? 'AUSWÄHLEN' : unlockText('ship', id)}</span></button>`;
  }).join('');
}

function selectShip(id) {
  if (!SHIPS[id] || !isUnlocked('ship', id)) { Sfx.deny(); return; }
  P.ship = id;
  saveProfile();
  if (G.demo && G.run) { G.run.ship = id; recomputeStats(); }     // die Demo im Hintergrund fliegt sofort das neue Schiff
  Sfx.pick();
  renderHangar();
}

// ---------------------------------------------------------------- Werkstatt
function openWorkshop() { show('screen-workshop'); renderWorkshop(); }

function renderWorkshop() {
  $('ws-cores').textContent = fmt(P.cores);
  $('ws-list').innerHTML = META.map((m) => {
    const lv = metaLv(m.id), max = lv >= m.max, cost = max ? 0 : m.cost[lv], can = !max && P.cores >= cost;
    let pips = '';
    for (let i = 0; i < m.max; i++) pips += `<i class="${i < lv ? 'on' : ''}"></i>`;
    return `<div class="ws-row${max ? ' max' : ''}"><div class="ws-info"><b>${m.name}</b><span>${m.desc}</span></div>` +
      `<div class="ws-pips">${pips}</div>` +
      `<button class="btn ws-buy" data-meta="${m.id}"${can ? '' : ' disabled'}>${max ? 'MAX' : cost + ' KERNE'}</button></div>`;
  }).join('');
}

// ---------------------------------------------------------------- Erfolge
function openAchievements() {
  show('screen-ach');
  const done = ACHIEVEMENTS.filter((a) => P.ach[a.id]).length, s = P.stats;
  $('ach-count').textContent = `${done} / ${ACHIEVEMENTS.length}`;
  const h = Math.floor(s.time / 3600), mi = Math.floor((s.time % 3600) / 60);
  $('ach-stats').textContent = `Läufe ${fmt(s.runs)}  ·  Abschüsse ${fmt(s.kills)}  ·  Bosse ${fmt(s.bosses)}  ·  Loops ${fmt(s.loops)}  ·  Spielzeit ${h} h ${mi} min`;
  $('ach-list').innerHTML = ACHIEVEMENTS.map((a) =>
    `<div class="ach${P.ach[a.id] ? ' done' : ''}"><b>${a.name}</b><span>${a.desc}</span><i>${P.ach[a.id] ? 'ERREICHT' : '+' + a.cores + ' Kerne'}</i></div>`).join('');
}

// ---------------------------------------------------------------- Navigation
function menuBack() {
  const s = ui.screen;
  if (s === 'screen-settings') closeSettings();
  else if (s === 'screen-hub') show('screen-title');
  else if (s === 'screen-campaign' || s === 'screen-hangar' || s === 'screen-workshop' || s === 'screen-ach') openHub();
}
function menuEnter() {
  const s = ui.screen;
  if (s === 'screen-title') openHub();
  else if (s === 'screen-hub') hubStart();
  else if (s === 'screen-campaign') campaignStart();
}

function bindMenus() {
  if (P.lastMaps && typeof P.lastMaps === 'object') Object.assign(menu.map, P.lastMaps);
  $('btn-start').addEventListener('click', openHub);
  $('btn-hub-back').addEventListener('click', menuBack);
  $('btn-hangar').addEventListener('click', openHangar);
  $('btn-workshop').addEventListener('click', openWorkshop);
  $('btn-ach').addEventListener('click', openAchievements);
  for (const b of document.querySelectorAll('.js-back')) b.addEventListener('click', menuBack);

  $('mode-list').addEventListener('click', (ev) => {
    const it = ev.target.closest('.mode-item');
    if (!it) return;
    menu.mode = it.dataset.mode;
    Sfx.pick();
    renderHub();
  });
  $('mode-detail').addEventListener('click', (ev) => {
    if (ev.target.closest('#btn-mode-start')) { hubStart(); return; }
    const mc = ev.target.closest('.chip.map');
    if (mc) {
      if (mc.classList.contains('locked')) { Sfx.deny(); return; }
      menu.map[menu.mode] = mc.dataset.map;
      P.lastMaps = Object.assign({}, menu.map); saveProfile();
      Sfx.pick(); renderModeDetail();
      return;
    }
    const chip = ev.target.closest('.chip');
    if (!chip || chip.classList.contains('fixed') || !chip.dataset.mut) return;
    const list = menu.muts[menu.mode], id = chip.dataset.mut, i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    Sfx.pick();
    renderModeDetail();
  });
  $('camp-grid').addEventListener('click', (ev) => {
    const t = ev.target.closest('.tile');
    if (!t) return;
    menu.level = +t.dataset.lv;
    Sfx.pick();
    renderCampaign();
  });
  $('camp-detail').addEventListener('click', (ev) => { if (ev.target.closest('#btn-level-start')) campaignStart(); });
  $('hangar-grid').addEventListener('click', (ev) => {
    const c = ev.target.closest('.ship-card');
    if (c) selectShip(c.dataset.ship);
  });
  $('ws-list').addEventListener('click', (ev) => {
    const b = ev.target.closest('.ws-buy');
    if (!b || b.disabled) return;
    if (buyMeta(b.dataset.meta)) { Sfx.levelUp(); renderWorkshop(); } else Sfx.deny();
  });
}
