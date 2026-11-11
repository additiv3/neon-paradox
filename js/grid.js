'use strict';
/* ====== NEON PARADOX — reaktives Feder-Gitter ======
   Jeder Gitterpunkt hängt an einer Feder zu seiner Ruheposition und ist mit seinen
   Nachbarn gekoppelt. Explosionen, Schüsse und Bewegungen schicken Wellen hindurch. */
const Grid = (() => {
  let cols = 0, rows = 0, n = 0, sp = 44;
  let dx, dy, vx, vy, cr, cg, cb;

  function init(w, h, spacing) {
    sp = spacing;
    cols = Math.round(w / sp) + 1;
    rows = Math.round(h / sp) + 1;
    n = cols * rows;
    dx = new Float32Array(n); dy = new Float32Array(n);
    vx = new Float32Array(n); vy = new Float32Array(n);
    cr = new Float32Array(n); cg = new Float32Array(n); cb = new Float32Array(n);
  }

  function update(dt) {
    const k = Math.min(dt * 60, 2);
    if (k <= 0) return;
    const stiff = 0.03 * k, coup = 0.24 * k, dmp = Math.pow(0.93, k);
    for (let r = 1; r < rows - 1; r++) {
      let i = r * cols + 1;
      for (let c = 1; c < cols - 1; c++, i++) {
        const lx = (dx[i - 1] + dx[i + 1] + dx[i - cols] + dx[i + cols]) * 0.25 - dx[i];
        const ly = (dy[i - 1] + dy[i + 1] + dy[i - cols] + dy[i + cols]) * 0.25 - dy[i];
        vx[i] = (vx[i] - dx[i] * stiff + lx * coup) * dmp;
        vy[i] = (vy[i] - dy[i] * stiff + ly * coup) * dmp;
      }
    }
    for (let r = 1; r < rows - 1; r++) {
      let i = r * cols + 1;
      for (let c = 1; c < cols - 1; c++, i++) {
        dx[i] += vx[i] * k;
        dy[i] += vy[i] * k;
      }
    }
  }

  /** Radialer Impuls. force > 0 drückt nach außen, < 0 saugt an. */
  function blast(x, y, force, radius) {
    const c0 = Math.max(1, Math.floor((x - radius) / sp)), c1 = Math.min(cols - 2, Math.ceil((x + radius) / sp));
    const r0 = Math.max(1, Math.floor((y - radius) / sp)), r1 = Math.min(rows - 2, Math.ceil((y + radius) / sp));
    const rr = radius * radius;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const ax = c * sp - x, ay = r * sp - y, d2 = ax * ax + ay * ay;
        if (d2 >= rr) continue;
        const d = Math.sqrt(d2) + 0.001, f = force * (1 - d / radius), i = r * cols + c;
        vx[i] += (ax / d) * f;
        vy[i] += (ay / d) * f;
      }
    }
  }

  /** Gerichteter Impuls (Projektile, Schiffe). */
  function push(x, y, fx, fy, radius) {
    const c0 = Math.max(1, Math.floor((x - radius) / sp)), c1 = Math.min(cols - 2, Math.ceil((x + radius) / sp));
    const r0 = Math.max(1, Math.floor((y - radius) / sp)), r1 = Math.min(rows - 2, Math.ceil((y + radius) / sp));
    const rr = radius * radius;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const ax = c * sp - x, ay = r * sp - y, d2 = ax * ax + ay * ay;
        if (d2 >= rr) continue;
        const f = 1 - Math.sqrt(d2) / radius, i = r * cols + c;
        vx[i] += fx * f;
        vy[i] += fy * f;
      }
    }
  }

  function draw(beat) {
    const base = 1 + beat * 0.45;
    for (let i = 0; i < n; i++) {
      const e = Math.min(1, (Math.abs(dx[i]) + Math.abs(dy[i])) * 0.035 + (Math.abs(vx[i]) + Math.abs(vy[i])) * 0.11);
      cr[i] = 0.045 * base + e * 0.50;
      cg[i] = 0.075 * base + e * 0.42;
      cb[i] = 0.270 * base + e * 0.85;
    }
    // waagerechte Linien
    for (let r = 0; r < rows; r++) {
      const major = r % 5 === 0, w = major ? 1.5 : 0.95, m = major ? 1.7 : 1;
      let i = r * cols;
      for (let c = 0; c < cols - 1; c++, i++) {
        const j = i + 1;
        R.line2(c * sp + dx[i], r * sp + dy[i], (c + 1) * sp + dx[j], r * sp + dy[j], w,
          cr[i] * m, cg[i] * m, cb[i] * m, cr[j] * m, cg[j] * m, cb[j] * m);
      }
    }
    // senkrechte Linien
    for (let c = 0; c < cols; c++) {
      const major = c % 5 === 0, w = major ? 1.5 : 0.95, m = major ? 1.7 : 1;
      for (let r = 0; r < rows - 1; r++) {
        const i = r * cols + c, j = i + cols;
        R.line2(c * sp + dx[i], r * sp + dy[i], c * sp + dx[j], (r + 1) * sp + dy[j], w,
          cr[i] * m, cg[i] * m, cb[i] * m, cr[j] * m, cg[j] * m, cb[j] * m);
      }
    }
  }

  return { init, update, blast, push, draw };
})();
