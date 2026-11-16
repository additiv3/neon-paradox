'use strict';
/* ====== NEON PARADOX — Einstellungen: Tastenbelegung, Touch-Steuerung, Tasten-Layout, Ton & Grafik ====== */
const KEY_ACTIONS = [
  ['up', 'Hoch'], ['down', 'Runter'], ['left', 'Links'], ['right', 'Rechts'],
  ['dash', 'Dash'], ['nova', 'Nova'], ['pause', 'Pause'], ['autofire', 'Auto-Feuer an/aus'], ['mute', 'Ton an/aus'],
];
const DEFAULT_KEYS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  dash: ['Space', 'ShiftLeft'], nova: ['KeyE', 'KeyQ'], pause: ['KeyP', ''], autofire: ['KeyF', ''], mute: ['KeyM', ''],
};
/** Diese Tasten bleiben fest: Esc (Pause/Zurück), Enter (Bestätigen), Tab. */
const RESERVED_KEYS = ['Escape', 'Enter', 'NumpadEnter', 'Tab'];
const KEY_NAMES = {
  Space: 'LEERTASTE', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT R', ControlLeft: 'STRG', ControlRight: 'STRG R', AltLeft: 'ALT', AltRight: 'ALT GR',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backspace: '⌫', CapsLock: 'FESTSTELL', Backquote: '^', Minus: 'ß',
};
const keyMap = new Map();
const setUi = { tab: null, ret: 'screen-title', listen: null, drag: null };

function ensureKeys() {
  const st = P.settings;
  if (!st.keys || typeof st.keys !== 'object') st.keys = {};
  if (!st.keyNames || typeof st.keyNames !== 'object') st.keyNames = {};
  for (const [a] of KEY_ACTIONS) {
    const k = st.keys[a];
    if (!Array.isArray(k) || k.length !== 2) st.keys[a] = DEFAULT_KEYS[a].slice();
  }
  rebuildKeyMap();
}
function rebuildKeyMap() {
  keyMap.clear();
  for (const [a] of KEY_ACTIONS) for (const c of P.settings.keys[a]) if (c) keyMap.set(c, a);
}
const keyAction = (code) => keyMap.get(code) || null;

function keyLabel(c) {
  if (!c) return '—';
  const n = P.settings.keyNames && P.settings.keyNames[c];
  if (n) return n;
  if (KEY_NAMES[c]) return KEY_NAMES[c];
  if (c.startsWith('Key')) return c.slice(3);
  if (c.startsWith('Digit')) return c.slice(5);
  if (c.startsWith('Numpad')) return 'NUM ' + c.slice(6).toUpperCase();
  return c.toUpperCase();
}
const keyOf = (a) => P.settings.keys[a][0] || P.settings.keys[a][1];
const kbd = (a) => `<kbd>${keyLabel(keyOf(a))}</kbd>`;

/** Aktualisiert alle Tasten-Hinweise im Titel, im HUD und in der Pause. */
function updateKeyHints() {
  const n = $('ctl-keys');
  if (n) {
    n.innerHTML = `<div>${kbd('up')}${kbd('left')}${kbd('down')}${kbd('right')}<span>Bewegen</span></div>` +
      '<div><kbd>MAUS</kbd><span>Zielen · feuert automatisch</span></div>' +
      `<div>${kbd('dash')}<span>Dash (unverwundbar)</span></div>` +
      `<div>${kbd('nova')}<kbd>RECHTSKLICK</kbd><span>Nova</span></div>` +
      '<div><kbd>ESC</kbd><span>Pause</span></div>' +
      `<div>${kbd('mute')}<span>Ton</span></div>`;
  }
  const set = (id, a) => { const x = $(id); if (x) x.textContent = keyLabel(keyOf(a)); };
  set('kbd-dash', 'dash'); set('kbd-nova', 'nova'); set('kbd-fire', 'autofire');
}

// ---------------------------------------------------------------- Anwenden
function applySettings() {
  ensureKeys();
  const st = P.settings;
  Sfx.setVolume(st.music, st.sfx);
  applyQuality();
  applyTouchLayout();
  updateKeyHints();
}

function applyQuality() {
  const q = P.settings.quality;
  if (q === 'auto') R.setQuality(G.touch ? 0.75 : 1);
  else R.setQuality(q === 'high' ? 1 : q === 'mid' ? 0.75 : 0.5);
}

function safeInsets() {
  const s = getComputedStyle($('safe-probe'));
  return { l: parseFloat(s.paddingLeft) || 0, r: parseFloat(s.paddingRight) || 0, t: parseFloat(s.paddingTop) || 0, b: parseFloat(s.paddingBottom) || 0 };
}
const TBTN = { dash: 82, nova: 70, pause: 42 };
const tbtnSize = (id) => Math.round(id === 'pause' ? clamp(42 * P.settings.tSize, 38, 58) : TBTN[id] * P.settings.tSize);
const stickR = () => STICK_R * P.settings.tSize;

/** Mittelpunkt einer Touch-Taste (oder des festen Sticks) in Pixeln. */
function touchPos(id) {
  const st = P.settings, W = window.innerWidth, H = window.innerHeight, k = st.tSize, c = st.pos[id];
  if (c) return [clamp(c.x * W, 24, W - 24), clamp(c.y * H, 24, H - 24)];
  const si = safeInsets();
  let x, y;
  if (id === 'dash') { x = W - si.r - 20 - 41 * k; y = H - si.b - 22 - 41 * k; }
  else if (id === 'nova') { x = W - si.r - 26 - 35 * k; y = H - si.b - 36 - 117 * k; }
  else if (id === 'pause') { const s = tbtnSize('pause'); x = W - si.r - 12 - s / 2; y = si.t + 52 + s / 2; }
  else { x = si.l + 40 + 70 * k; y = H - si.b - 40 - 70 * k; }
  if (st.lefty) x = W - x;
  return [x, y];
}

function applyTouchLayout() {
  const st = P.settings, tu = $('touch-ui');
  if (!tu) return;
  tu.style.setProperty('--ta', st.tAlpha.toFixed(2));
  tu.style.setProperty('--ts', st.tSize.toFixed(2));
  for (const id of ['dash', 'nova', 'pause']) {
    const node = $('t-' + id), s = tbtnSize(id), [x, y] = touchPos(id);
    node.style.left = (x - s / 2).toFixed(1) + 'px';
    node.style.top = (y - s / 2).toFixed(1) + 'px';
    node.style.right = 'auto'; node.style.bottom = 'auto';
    node.style.width = s + 'px'; node.style.height = s + 'px';
  }
  const sl = $('stick-l');
  sl._on = undefined;
  if (document.body.classList.contains('layout-edit')) {
    const [x, y] = touchPos('stick');
    sl.style.display = st.stick === 'fixed' ? 'block' : 'none';
    sl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    sl.firstElementChild.style.transform = 'translate(0px, 0px)';
  }
}

// ---------------------------------------------------------------- Bildschirm
function openSettings(from) {
  setUi.ret = from || ui.screen;
  if (!setUi.tab) setUi.tab = G.touch ? 'touch' : 'keys';
  setUi.listen = null;
  show('screen-settings');
  renderSettings();
}
function closeSettings() {
  setUi.listen = null;
  saveProfile();
  const r = setUi.ret;
  if (r === 'screen-hub') openHub();
  else show(r === 'screen-pause' && G.state === 'paused' ? 'screen-pause' : r === 'screen-pause' ? null : r);
}

const pct = (v) => Math.round(v * 100) + ' %';
function rowSlider(id, label, hint, min, max, step, fmtFn) {
  const v = P.settings[id];
  return `<div class="set-row"><div class="set-lbl"><b>${label}</b>${hint ? `<span>${hint}</span>` : ''}</div>` +
    `<div class="set-ctl"><input type="range" data-set="${id}" min="${min}" max="${max}" step="${step}" value="${v}"><output data-out="${id}">${fmtFn(v)}</output></div></div>`;
}
function rowSeg(id, label, hint, opts, cur) {
  return `<div class="set-row"><div class="set-lbl"><b>${label}</b>${hint ? `<span>${hint}</span>` : ''}</div><div class="set-ctl seg">` +
    opts.map(([v, t]) => `<button class="seg-b${String(cur) === String(v) ? ' on' : ''}" data-seg="${id}" data-v="${v}">${t}</button>`).join('') + '</div></div>';
}
const rowToggle = (id, label, hint, on) => rowSeg(id, label, hint, [['1', 'AN'], ['0', 'AUS']], on ? '1' : '0');
const SLIDER_FMT = { tSize: pct, tAlpha: pct, sens: (v) => (+v).toFixed(1).replace('.', ',') + '×', dead: pct, shake: pct, music: pct, sfx: pct };

function renderSettings() {
  const st = P.settings, tab = setUi.tab;
  for (const b of document.querySelectorAll('#set-tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  let h = '';
  if (tab === 'touch') {
    h += '<div class="set-group">TASTEN</div>' +
      rowSlider('tSize', 'Tastengröße', 'Dash, Nova, Pause und Sticks', 0.7, 1.5, 0.05, pct) +
      rowSlider('tAlpha', 'Deckkraft', 'Wie stark die Tasten sichtbar sind', 0.3, 1, 0.05, pct) +
      rowToggle('lefty', 'Linkshänder', 'Stick rechts, Tasten links', st.lefty) +
      '<div class="set-row"><div class="set-lbl"><b>Tasten anordnen</b><span>Ziehe jede Taste frei an ihren Platz</span></div>' +
      '<div class="set-ctl"><button id="set-layout" class="btn small">ANORDNEN</button></div></div>' +
      '<div class="set-group">STEUERUNG</div>' +
      rowSeg('stick', 'Bewegungs-Stick', st.stick === 'fixed' ? 'Bleibt an einer festen Stelle' : 'Erscheint dort, wo dein Daumen landet', [['float', 'SCHWEBEND'], ['fixed', 'FEST']], st.stick) +
      rowSlider('sens', 'Empfindlichkeit', 'Wie schnell der Stick volles Tempo erreicht', 0.8, 2.2, 0.1, SLIDER_FMT.sens) +
      rowSlider('dead', 'Totzone', 'Kleine Bewegungen werden ignoriert', 0.05, 0.3, 0.01, pct) +
      rowToggle('autoAim', 'Zielhilfe', st.autoAim ? 'Das Schiff zielt selbst auf den nächsten Gegner' : 'Das Schiff schießt in Flugrichtung', st.autoAim) +
      rowToggle('haptic', 'Vibration', 'Bei Treffern (nur Android)', st.haptic);
  } else if (tab === 'keys') {
    h += '<div class="set-group">TASTENBELEGUNG <i>Klicke auf eine Taste und drücke die neue. Entf löscht, Esc bricht ab.</i></div>';
    for (const [a, name] of KEY_ACTIONS) {
      const ks = st.keys[a];
      h += `<div class="set-row key"><div class="set-lbl"><b>${name}</b></div><div class="set-ctl">` +
        [0, 1].map((i) => {
          const lis = setUi.listen && setUi.listen[0] === a && setUi.listen[1] === i;
          return `<button class="keycap${lis ? ' listen' : ''}${ks[i] ? '' : ' empty'}" data-act="${a}" data-slot="${i}">${lis ? 'TASTE DRÜCKEN …' : keyLabel(ks[i])}</button>`;
        }).join('') + '</div></div>';
    }
    h += '<div class="set-group">MAUS</div>' +
      rowToggle('autoFire', 'Auto-Feuer', G.autoFire ? 'Dein Schiff feuert von selbst' : 'Linke Maustaste halten zum Feuern', G.autoFire) +
      '<div class="set-row"><div class="set-lbl"><b>Rechtsklick</b><span>Zündet die Nova</span></div><div class="set-ctl"><kbd>FEST</kbd></div></div>';
  } else {
    h += '<div class="set-group">TON</div>' +
      rowToggle('sound', 'Ton', '', !Sfx.isMuted()) +
      rowSlider('music', 'Musik', '', 0, 1, 0.05, pct) +
      rowSlider('sfx', 'Effekte', '', 0, 1, 0.05, pct) +
      '<div class="set-group">BILD</div>' +
      rowSlider('shake', 'Bildschirmwackeln', 'Bei Explosionen und Treffern', 0, 1, 0.05, pct) +
      rowSeg('quality', 'Grafik', 'Niedriger = flüssiger auf schwachen Geräten', [['auto', 'AUTO'], ['high', 'HOCH'], ['mid', 'MITTEL'], ['low', 'NIEDRIG']], st.quality);
  }
  $('set-body').innerHTML = h;
}

function resetSettingsTab() {
  const st = P.settings, def = defaultSettings(), tab = setUi.tab;
  const ids = tab === 'touch' ? ['tSize', 'tAlpha', 'stick', 'sens', 'dead', 'autoAim', 'lefty', 'haptic', 'pos']
    : tab === 'keys' ? [] : ['shake', 'quality', 'music', 'sfx'];
  for (const id of ids) st[id] = def[id];
  if (tab === 'touch') st.pos = {};
  if (tab === 'keys') { st.keys = null; st.keyNames = {}; G.autoFire = true; P.autoFire = true; }
  applySettings();
  saveProfile();
  renderSettings();
  toast('STANDARD WIEDERHERGESTELLT');
}

function setSetting(id, v) {
  const st = P.settings;
  if (id === 'autoFire') { G.autoFire = v === '1'; save(); }
  else if (id === 'sound') { Sfx.setMuted(v !== '1'); updateSoundLabel(); save(); }
  else if (id === 'lefty' || id === 'autoAim' || id === 'haptic') st[id] = v === '1';
  else if (id === 'stick' || id === 'quality') st[id] = v;
  else st[id] = +v;
  if (id === 'music' || id === 'sfx') Sfx.setVolume(st.music, st.sfx);
  if (id === 'quality') applyQuality();
  if (id === 'tSize' || id === 'tAlpha' || id === 'lefty' || id === 'stick') applyTouchLayout();
}

/** Tastenaufnahme: fängt Tastendrücke ab, solange eine Belegung gesetzt wird. */
function settingsKeydown(ev) {
  if (ui.screen === 'screen-layout' && ev.code === 'Escape') { ev.preventDefault(); closeLayout(); return true; }
  if (!setUi.listen) return false;
  ev.preventDefault();
  const [a, slot] = setUi.listen, c = ev.code, st = P.settings;
  setUi.listen = null;
  if (c === 'Escape') { renderSettings(); return true; }
  if (c === 'Delete' || c === 'Backspace') { st.keys[a][slot] = ''; }
  else if (RESERVED_KEYS.indexOf(c) >= 0) { Sfx.deny(); toast(keyLabel(c) + ' IST FEST BELEGT'); renderSettings(); return true; }
  else {
    for (const [b] of KEY_ACTIONS) for (let i = 0; i < 2; i++) if (st.keys[b][i] === c) st.keys[b][i] = '';
    st.keys[a][slot] = c;
    if (ev.key && ev.key.length === 1 && ev.key !== ' ') st.keyNames[c] = ev.key.toUpperCase(); else delete st.keyNames[c];
    Sfx.pick();
  }
  rebuildKeyMap();
  updateKeyHints();
  saveProfile();
  renderSettings();
  return true;
}

// ---------------------------------------------------------------- Layout-Editor
function openLayout() {
  document.body.classList.add('layout-edit');
  $('lb-stick-hint').classList.toggle('hidden', P.settings.stick === 'fixed');
  $('lb-size').value = P.settings.tSize;
  show('screen-layout');
  applyTouchLayout();
}
function closeLayout() {
  document.body.classList.remove('layout-edit');
  setUi.drag = null;
  saveProfile();
  applyTouchLayout();
  show('screen-settings');
  renderSettings();
}

function bindSettings() {
  $('btn-settings').addEventListener('click', () => openSettings('screen-title'));
  $('btn-hub-settings').addEventListener('click', () => openSettings('screen-hub'));
  $('btn-pause-settings').addEventListener('click', () => openSettings('screen-pause'));
  $('btn-set-reset').addEventListener('click', resetSettingsTab);
  $('set-tabs').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    setUi.tab = b.dataset.tab; setUi.listen = null;
    Sfx.pick(); renderSettings();
  });
  const body = $('set-body');
  body.addEventListener('input', (ev) => {
    const r = ev.target.closest('input[type=range]');
    if (!r) return;
    setSetting(r.dataset.set, r.value);
    const o = body.querySelector(`[data-out="${r.dataset.set}"]`);
    if (o) o.textContent = (SLIDER_FMT[r.dataset.set] || pct)(+r.value);
  });
  body.addEventListener('change', () => saveProfile());
  body.addEventListener('click', (ev) => {
    if (ev.target.closest('#set-layout')) { Sfx.pick(); openLayout(); return; }
    const s = ev.target.closest('.seg-b');
    if (s) { setSetting(s.dataset.seg, s.dataset.v); saveProfile(); Sfx.pick(); renderSettings(); return; }
    const k = ev.target.closest('.keycap');
    if (k) { setUi.listen = [k.dataset.act, +k.dataset.slot]; Sfx.pick(); renderSettings(); }
  });

  // Layout-Editor: Tasten per Ziehen verschieben
  $('lb-done').addEventListener('click', closeLayout);
  $('lb-reset').addEventListener('click', () => { P.settings.pos = {}; applyTouchLayout(); Sfx.pick(); });
  $('lb-size').addEventListener('input', (ev) => { P.settings.tSize = +ev.target.value; applyTouchLayout(); });
  const tui = $('touch-ui');
  tui.addEventListener('pointerdown', (ev) => {
    if (!document.body.classList.contains('layout-edit')) return;
    const t = ev.target.closest('[data-drag]');
    if (!t) return;
    ev.preventDefault(); ev.stopPropagation();
    setUi.drag = { id: t.dataset.drag, pid: ev.pointerId };
    t.classList.add('dragging');
  }, true);
  window.addEventListener('pointermove', (ev) => {
    const d = setUi.drag;
    if (!d || d.pid !== ev.pointerId) return;
    P.settings.pos[d.id] = { x: ev.clientX / window.innerWidth, y: ev.clientY / window.innerHeight };
    applyTouchLayout();
  });
  const end = (ev) => {
    const d = setUi.drag;
    if (!d || d.pid !== ev.pointerId) return;
    setUi.drag = null;
    for (const n of document.querySelectorAll('.dragging')) n.classList.remove('dragging');
    saveProfile();
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  window.addEventListener('resize', () => applyTouchLayout());
}
