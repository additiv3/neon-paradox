'use strict';
/* ====== NEON PARADOX — Sound ======
   Komplett prozedural über die Web Audio API: Effekte und ein Synthwave-Sequencer,
   dessen Ebenen mit der Spielintensität zugeschaltet werden. Keine Audiodateien. */
const Sfx = (() => {
  let ctx = null, master, sfx, mfilter, musicOut, duck, delayIn, noiseBuf;
  let muted = false, quiet = false, volM = 1, volS = 1, intensity = 0, nextT = 0, step = 0;
  let shardN = 0, shardT = -9, beatA = -9, beatB = -9;
  const last = {};
  const BPM = 124, ST = 60 / BPM / 4;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Am – F – C – G, je zwei Takte
  const CH = [
    { r: 33, n: [57, 60, 64, 69] },
    { r: 29, n: [57, 60, 65, 69] },
    { r: 36, n: [55, 60, 64, 67] },
    { r: 31, n: [55, 59, 62, 67] },
  ];
  const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2];
  const LEAD = [
    [76, 0, 0, 0, 72, 0, 0, 69, 0, 0, 72, 0, 76, 0, 0, 0],
    [81, 0, 0, 0, 79, 0, 76, 0, 0, 0, 0, 0, 0, 0, 74, 76],
    [77, 0, 0, 0, 72, 0, 0, 69, 0, 0, 72, 0, 77, 0, 0, 0],
    [81, 0, 0, 0, 77, 0, 76, 0, 0, 0, 0, 0, 0, 0, 72, 74],
    [76, 0, 0, 0, 72, 0, 0, 67, 0, 0, 72, 0, 76, 0, 0, 0],
    [79, 0, 0, 0, 76, 0, 72, 0, 0, 0, 0, 0, 0, 0, 74, 76],
    [74, 0, 0, 0, 71, 0, 0, 67, 0, 0, 71, 0, 74, 0, 0, 0],
    [79, 0, 0, 0, 74, 0, 71, 0, 0, 0, 74, 0, 76, 0, 74, 71],
  ];

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 5;
    comp.attack.value = 0.004; comp.release.value = 0.18;
    master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.75 * volS; sfx.connect(master);
    musicOut = ctx.createGain(); musicOut.gain.value = 0.62 * volM; musicOut.connect(master);
    mfilter = ctx.createBiquadFilter(); mfilter.type = 'lowpass'; mfilter.frequency.value = 18000; mfilter.Q.value = 0.5;
    mfilter.connect(musicOut);
    duck = ctx.createGain(); duck.connect(mfilter);
    const dl = ctx.createDelay(1); dl.delayTime.value = ST * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const dOut = ctx.createGain(); dOut.gain.value = 0.5;
    delayIn = ctx.createGain();
    delayIn.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(dOut); dOut.connect(mfilter);
    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    setInterval(tick, 30);
  }

  function env(g, t, a, d, vol) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function osc(type, f0, f1, dur, vol, dest, t, attack) {
    if (t === undefined) t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, attack || 0.004, dur, vol);
    o.connect(g); g.connect(dest || sfx);
    o.start(t); o.stop(t + dur + 0.06);
    return g;
  }

  function nz(dur, vol, type, f0, f1, q, dest, t) {
    if (t === undefined) t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q || 0.7;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, 0.003, dur, vol);
    s.connect(f); f.connect(g); g.connect(dest || sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.06);
  }

  /** Prüft, ob ein Effekt gespielt werden darf (Audio aktiv, nicht stumm, Mindestabstand). */
  function gate(name, gap) {
    if (!ctx || quiet || ctx.state !== 'running') return false;
    const t = ctx.currentTime;
    if (t - (last[name] || -9) < gap) return false;
    last[name] = t;
    return true;
  }

  // ---------- Musik ----------
  function kick(t) {
    osc('sine', 155, 42, 0.16, 0.6, mfilter, t);
    nz(0.02, 0.1, 'highpass', 2500, 0, 0.7, mfilter, t);
    duck.gain.cancelScheduledValues(t);
    duck.gain.setValueAtTime(0.4, t);
    duck.gain.linearRampToValueAtTime(1, t + ST * 3.2);
    beatA = beatB; beatB = t;
  }
  function snare(t) {
    nz(0.16, 0.2, 'bandpass', 1900, 0, 0.8, mfilter, t);
    osc('triangle', 220, 120, 0.08, 0.12, mfilter, t);
  }
  function hat(t, vol, dur) { nz(dur || 0.035, vol, 'highpass', 8500, 0, 0.7, mfilter, t); }
  function bass(t, m) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = mtof(m);
    f.type = 'lowpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(1500, t);
    f.frequency.exponentialRampToValueAtTime(180, t + ST * 0.95);
    env(g, t, 0.005, ST * 0.95, 0.2);
    o.connect(f); f.connect(g); g.connect(duck);
    o.start(t); o.stop(t + ST + 0.06);
  }
  function pad(t, notes, dur, vol) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1050; f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.6);
    g.gain.setValueAtTime(vol, t + dur - 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.5);
    f.connect(g); g.connect(duck);
    for (let i = 0; i < 3; i++) {
      for (let k = -1; k <= 1; k += 2) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = mtof(notes[i]); o.detune.value = k * 7;
        o.connect(f); o.start(t); o.stop(t + dur + 0.6);
      }
    }
  }
  function arp(t, m, vol) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = mtof(m);
    f.type = 'lowpass'; f.frequency.value = 2600;
    env(g, t, 0.004, 0.13, vol);
    o.connect(f); f.connect(g); g.connect(mfilter); g.connect(delayIn);
    o.start(t); o.stop(t + 0.2);
  }
  function lead(t, m) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200; f.Q.value = 2;
    const g = ctx.createGain(); env(g, t, 0.01, ST * 2.6, 0.075);
    f.connect(g); g.connect(mfilter); g.connect(delayIn);
    for (let k = -1; k <= 1; k += 2) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = k * 9;
      o.connect(f); o.start(t); o.stop(t + ST * 3);
    }
  }

  function playStep(i, t) {
    const s = i & 15, bar = i >> 4, ch = CH[(bar >> 1) & 3], I = intensity;
    if (s === 0 && (bar & 1) === 0) pad(t, ch.n, ST * 32, I === 0 ? 0.03 : 0.02);
    if (I >= 1 && (s & 3) === 0) kick(t);
    if (I >= 2 && (s === 4 || s === 12)) snare(t);
    if (I >= 1 && (s & 3) === 2) hat(t, 0.05);
    if (I >= 2 && (s & 1) === 1) hat(t, 0.02);
    if (I >= 3 && s === 14) hat(t, 0.05, 0.12);
    if (I >= 1 && (s & 3) !== 0) bass(t, ch.r + 12 + ((s & 3) === 2 ? 12 : 0));
    if (I === 0) { if ((s & 1) === 0) arp(t, ch.n[ARP[s]] + 12, 0.028); }
    else if (I >= 2) arp(t, ch.n[ARP[s]] + 12, 0.034);
    else if ((s & 3) === 0) arp(t, ch.n[ARP[s]] + 12, 0.03);
    if (I >= 3) { const m = LEAD[bar & 7][s]; if (m) lead(t, m); }
  }

  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (nextT < now - 0.2) nextT = now + 0.06;
    while (nextT < now + 0.15) { playStep(step, nextT); nextT += ST; step++; }
  }

  /** 0..1-Impuls im Takt der Bassdrum (für pulsierende Grafik). */
  function beat() {
    if (ctx && ctx.state === 'running' && intensity >= 1) {
      const now = ctx.currentTime, t = now >= beatB ? beatB : beatA, d = now - t;
      return d >= 0 && d < 1 ? Math.exp(-d * 7) : 0;
    }
    const ph = (performance.now() / 1000 / (ST * 4)) % 1;
    return Math.exp(-ph * 6) * 0.5;
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  // ---------- Effekte ----------
  return {
    init, beat,
    music(level) { intensity = level; },
    muffle(on) { if (ctx) mfilter.frequency.setTargetAtTime(on ? 520 : 18000, ctx.currentTime, 0.12); },
    setQuiet(v) { quiet = v; },
    /** Lautstärke von Musik und Effekten (0 … 1). */
    setVolume(m, s) {
      volM = m; volS = s;
      if (ctx) { musicOut.gain.setTargetAtTime(0.62 * m, ctx.currentTime, 0.03); sfx.gain.setTargetAtTime(0.75 * s, ctx.currentTime, 0.03); }
    },
    setMuted(v) { muted = v; if (ctx) master.gain.setTargetAtTime(v ? 0 : 0.85, ctx.currentTime, 0.02); },
    isMuted() { return muted; },
    state() { return ctx ? ctx.state : 'none'; },

    shoot() { if (gate('shoot', 0.05)) osc('square', 860 + Math.random() * 140, 240, 0.07, 0.035); },
    eshoot() { if (gate('eshoot', 0.09)) osc('triangle', 1300, 520, 0.05, 0.016); },
    hit() { if (gate('hit', 0.045)) nz(0.04, 0.045, 'highpass', 3200); },
    kill(r) {
      if (!gate('kill', 0.035)) return;
      nz(0.22, 0.15, 'lowpass', 3200, 180, 1);
      osc('sine', Math.max(70, 200 - r * 2), 45, 0.16, 0.2);
    },
    explosion() {
      if (!gate('exp', 0.07)) return;
      nz(0.5, 0.3, 'lowpass', 1900, 80);
      osc('sine', 110, 30, 0.45, 0.35);
    },
    shard() {
      if (!gate('shard', 0.03)) return;
      const t = ctx.currentTime;
      if (t - shardT > 0.55) shardN = 0;
      shardT = t;
      const sc = [0, 2, 4, 7, 9], m = 72 + sc[shardN % 5] + 12 * (Math.floor(shardN / 5) % 3);
      shardN++;
      osc('sine', mtof(m), 0, 0.09, 0.07);
      osc('triangle', mtof(m + 12), 0, 0.06, 0.02);
    },
    dash() { if (!gate('dash', 0.05)) return; nz(0.2, 0.2, 'bandpass', 500, 3500, 2); osc('sawtooth', 200, 620, 0.12, 0.04); },
    hurt() { if (!gate('hurt', 0.1)) return; osc('sawtooth', 320, 50, 0.45, 0.25); nz(0.35, 0.3, 'lowpass', 2500, 150); },
    nova() {
      if (!gate('nova', 0.1)) return;
      osc('sine', 120, 28, 1.3, 0.6);
      nz(1.2, 0.4, 'lowpass', 6000, 100);
      osc('sawtooth', 60, 800, 0.25, 0.08);
    },
    novaReady() { if (gate('nready', 0.3)) { osc('sine', 660, 1320, 0.25, 0.08); osc('sine', 990, 1980, 0.25, 0.05, sfx, ctx.currentTime + 0.08); } },
    levelUp() {
      if (!gate('lvl', 0.2)) return;
      const t = ctx.currentTime, n = [0, 4, 7, 12];
      for (let i = 0; i < 4; i++) osc('triangle', mtof(72 + n[i]), 0, 0.14, 0.09, sfx, t + i * 0.06);
    },
    pick() {
      if (!gate('pick', 0.05)) return;
      osc('square', 520, 1040, 0.12, 0.06);
      osc('sine', 1040, 2080, 0.2, 0.05, sfx, ctx.currentTime + 0.05);
    },
    hover() { if (gate('hover', 0.04)) osc('sine', 880, 0, 0.03, 0.03); },
    loopEnd() {
      if (!gate('lend', 0.3)) return;
      const t = ctx.currentTime;
      osc('sawtooth', 80, 1800, 0.9, 0.12);
      nz(0.9, 0.15, 'bandpass', 300, 6000, 4);
      for (let i = 0; i < 8; i++) osc('square', 300 + i * 120, 0, 0.04, 0.05, sfx, t + i * 0.07);
    },
    loopStart() {
      if (!gate('lstart', 0.3)) return;
      const t = ctx.currentTime, n = [0, 7, 12];
      for (let i = 0; i < 3; i++) osc('triangle', mtof(57 + n[i]), 0, 0.3, 0.08, sfx, t + i * 0.07);
      osc('sine', 55, 0, 0.5, 0.25);
    },
    bossWarn() {
      if (!gate('bwarn', 0.3)) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 3; i++) { osc('sawtooth', 220, 0, 0.22, 0.09, sfx, t + i * 0.4); osc('sawtooth', 233, 0, 0.22, 0.09, sfx, t + i * 0.4); }
    },
    bossShot() { if (gate('bshot', 0.08)) osc('triangle', 300, 150, 0.06, 0.03); },
    bossDie() {
      if (!gate('bdie', 0.5)) return;
      osc('sine', 160, 24, 2.2, 0.7);
      nz(2.0, 0.5, 'lowpass', 7000, 60);
      osc('sawtooth', 900, 40, 1.4, 0.12);
    },
    enemyShot() { if (gate('eshot', 0.06)) osc('square', 420, 180, 0.12, 0.045); },
    charge() { if (gate('charge', 0.08)) { osc('sawtooth', 120, 520, 0.22, 0.07); nz(0.2, 0.08, 'bandpass', 800, 2400, 2); } },
    laser() { if (gate('laser', 0.06)) { osc('sawtooth', 1500, 180, 0.3, 0.08); nz(0.25, 0.1, 'highpass', 3000); osc('square', 90, 60, 0.25, 0.08); } },
    fuse() { if (gate('fuse', 0.1)) { const t = ctx.currentTime; for (let i = 0; i < 3; i++) osc('square', 1400, 0, 0.05, 0.045, sfx, t + i * 0.2); } },
    zap() { if (gate('zap', 0.06)) { nz(0.08, 0.07, 'bandpass', 4200, 1800, 3); osc('sawtooth', 1800, 400, 0.06, 0.025); } },
    shieldBreak() { if (!gate('sbreak', 0.1)) return; nz(0.3, 0.25, 'highpass', 2000, 6000); osc('sine', 1200, 300, 0.25, 0.1); },
    shieldUp() { if (gate('sup', 0.2)) osc('sine', 440, 880, 0.3, 0.07); },
    heal() { if (gate('heal', 0.1)) { osc('sine', 523, 1046, 0.25, 0.1); osc('sine', 784, 1568, 0.25, 0.06, sfx, ctx.currentTime + 0.08); } },
    die() { if (!gate('die', 0.5)) return; osc('sawtooth', 400, 20, 1.6, 0.4); nz(1.5, 0.5, 'lowpass', 4000, 60); },
    deny() { if (gate('deny', 0.15)) osc('square', 140, 100, 0.1, 0.05); },
    tick() { if (gate('tick', 0.2)) osc('square', 1000, 0, 0.04, 0.05); },
  };
})();
