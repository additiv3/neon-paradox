'use strict';
/* ====== NEON PARADOX — Hilfsfunktionen ====== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
/** Framerate-unabhängiges Annähern an einen Zielwert. */
const damp = (cur, target, rate, dt) => target + (cur - target) * Math.exp(-rate * dt);
const angDiff = (from, to) => {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return d;
};
const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
const fmt = (n) => Math.floor(n).toLocaleString('de-DE');

function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

/** Regelmäßiges n-Eck als flaches [x0,y0,x1,y1,…]-Array. */
function ngon(n, rot = 0, r = 1) {
  const a = [];
  for (let i = 0; i < n; i++) {
    const t = rot + (i / n) * TAU;
    a.push(Math.cos(t) * r, Math.sin(t) * r);
  }
  return a;
}

/** Stern mit n Zacken (abwechselnd Radius r0 / r1). */
function star(n, r0, r1, rot = 0) {
  const a = [];
  for (let i = 0; i < n * 2; i++) {
    const t = rot + (i / (n * 2)) * TAU, r = i % 2 ? r1 : r0;
    a.push(Math.cos(t) * r, Math.sin(t) * r);
  }
  return a;
}

/** Entfernt alle Einträge mit .dead ohne neues Array anzulegen. */
function compact(arr) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) {
    const o = arr[i];
    if (!o.dead) arr[j++] = o;
  }
  arr.length = j;
}
