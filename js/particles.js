'use strict';
/* ====== NEON PARADOX — Partikel (Struct-of-Arrays, ohne Garbage) ====== */
const Particles = (() => {
  const MAX = 5000;
  const X = new Float32Array(MAX), Y = new Float32Array(MAX);
  const VX = new Float32Array(MAX), VY = new Float32Array(MAX);
  const L = new Float32Array(MAX), ML = new Float32Array(MAX);
  const CR = new Float32Array(MAX), CG = new Float32Array(MAX), CB = new Float32Array(MAX);
  const SZ = new Float32Array(MAX), DR = new Float32Array(MAX);
  let n = 0;

  function spawn(x, y, vx, vy, life, r, g, b, size, drag) {
    const i = n < MAX ? n++ : (Math.random() * MAX) | 0;
    X[i] = x; Y[i] = y; VX[i] = vx; VY[i] = vy;
    L[i] = life; ML[i] = life;
    CR[i] = r; CG[i] = g; CB[i] = b;
    SZ[i] = size; DR[i] = drag;
  }

  function burst(x, y, count, col, s0, s1, l0, l1, size, drag) {
    const sz = size || 2, dr = drag === undefined ? 2.6 : drag;
    for (let k = 0; k < count; k++) {
      const a = Math.random() * TAU, s = s0 + Math.random() * (s1 - s0);
      spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, l0 + Math.random() * (l1 - l0), col[0], col[1], col[2], sz, dr);
    }
  }

  function update(dt, w, h) {
    if (dt <= 0) return;
    let i = 0;
    while (i < n) {
      L[i] -= dt;
      if (L[i] <= 0) {
        n--;
        if (i !== n) {
          X[i] = X[n]; Y[i] = Y[n]; VX[i] = VX[n]; VY[i] = VY[n];
          L[i] = L[n]; ML[i] = ML[n]; CR[i] = CR[n]; CG[i] = CG[n]; CB[i] = CB[n];
          SZ[i] = SZ[n]; DR[i] = DR[n];
        }
        continue;
      }
      const k = Math.max(0, 1 - DR[i] * dt);
      VX[i] *= k; VY[i] *= k;
      X[i] += VX[i] * dt; Y[i] += VY[i] * dt;
      if (X[i] < 0) { X[i] = 0; VX[i] = -VX[i]; } else if (X[i] > w) { X[i] = w; VX[i] = -VX[i]; }
      if (Y[i] < 0) { Y[i] = 0; VY[i] = -VY[i]; } else if (Y[i] > h) { Y[i] = h; VY[i] = -VY[i]; }
      i++;
    }
  }

  function draw() {
    for (let i = 0; i < n; i++) {
      const vx = VX[i], vy = VY[i], sp = Math.sqrt(vx * vx + vy * vy);
      const len = Math.min(30, 2 + sp * 0.032);
      const a = Math.min(1, (L[i] / ML[i]) * 1.8) * 1.5;
      const ix = sp > 1 ? vx / sp : 1, iy = sp > 1 ? vy / sp : 0;
      R.line(X[i], Y[i], X[i] - ix * len, Y[i] - iy * len, SZ[i], CR[i], CG[i], CB[i], a);
    }
  }

  return { spawn, burst, update, draw, clear() { n = 0; }, get count() { return n; } };
})();
