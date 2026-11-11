'use strict';
/* ====== NEON PARADOX — WebGL2-Renderer ======
   Alles wird additiv als "Kapsel" gezeichnet (Linie mit runden Enden, per SDF im Shader
   geglättet). Danach Bloom über eine Downsample-/Upsample-Kette und ein Post-FX-Pass
   (chromatische Aberration, Schockwelle, Glitch, Nebel, Vignette). */
const R = (() => {
  const FL = 9;               // Floats pro Vertex: pos(2) farbe(3) lokal(4)
  const MAX_QUADS = 26000;
  const LEVELS = 5;
  const vdata = new Float32Array(MAX_QUADS * 4 * FL);
  const scratch = new Float32Array(128);
  let vi = 0, nq = 0;
  let canvas, gl, W = 1, H = 1, pw = 2, ph = 2, quality = 1, hdr = false;
  let pScene, pDown, pUp, pFinal, vao, vbo, fsVao, scene = null, levels = [];
  const cam = { x: 0, y: 0, zoom: 1 };

  const VS_SCENE = `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec3 aCol;
layout(location=2) in vec4 aLoc;
uniform vec4 uCam;
out vec3 vCol;
out vec4 vLoc;
void main(){
  vCol = aCol; vLoc = aLoc;
  vec2 p = (aPos - uCam.xy) * uCam.zw;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
}`;

  const FS_SCENE = `#version 300 es
precision highp float;
in vec3 vCol;
in vec4 vLoc;
out vec4 o;
void main(){
  float a = 1.0;
  if (vLoc.w > 0.0) {
    float d = length(vec2(max(abs(vLoc.x) - vLoc.z, 0.0), vLoc.y)) / vLoc.w;
    a = 1.0 - smoothstep(0.5, 1.0, d);
  }
  o = vec4(vCol * a, 1.0);
}`;

  const VS_FS = `#version 300 es
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const FS_DOWN = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform vec2 uTexel;
void main(){
  vec4 s = texture(uTex, vUv) * 4.0;
  s += texture(uTex, vUv + uTexel * vec2(-1.0, -1.0));
  s += texture(uTex, vUv + uTexel * vec2( 1.0, -1.0));
  s += texture(uTex, vUv + uTexel * vec2(-1.0,  1.0));
  s += texture(uTex, vUv + uTexel * vec2( 1.0,  1.0));
  o = s * 0.125;
}`;

  const FS_UP = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform vec2 uTexel;
void main(){
  vec2 t = uTexel;
  vec4 s = texture(uTex, vUv + vec2(-t.x * 2.0, 0.0));
  s += texture(uTex, vUv + vec2(-t.x, t.y)) * 2.0;
  s += texture(uTex, vUv + vec2(0.0, t.y * 2.0));
  s += texture(uTex, vUv + vec2(t.x, t.y)) * 2.0;
  s += texture(uTex, vUv + vec2(t.x * 2.0, 0.0));
  s += texture(uTex, vUv + vec2(t.x, -t.y)) * 2.0;
  s += texture(uTex, vUv + vec2(0.0, -t.y * 2.0));
  s += texture(uTex, vUv + vec2(-t.x, -t.y)) * 2.0;
  o = s / 12.0;
}`;

  const FS_FINAL = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uScene;
uniform sampler2D uBloomTex;
uniform vec2 uRes;
uniform vec2 uCamOff;
uniform vec4 uWave;
uniform vec3 uFlash;
uniform float uTime, uAberr, uBloomStr, uGlitch, uDanger, uDesat, uDark;
uniform vec3 uLights[10];
uniform int uLightN;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.0, 31.0); a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = vUv;
  float asp = uRes.x / uRes.y;

  // Schockwelle (Nova, Loop-Ende, Bosstod)
  if (uWave.w > 0.001) {
    vec2 d = uv - uWave.xy; d.x *= asp;
    float l = length(d) + 1e-5;
    float k = l - uWave.z;
    float amt = exp(-k * k * 240.0) * uWave.w;
    uv -= (d / l) * amt * 0.05 * vec2(1.0 / asp, 1.0);
  }
  // Zeit-Glitch
  if (uGlitch > 0.001) {
    float band = floor(uv.y * 38.0);
    float tt = floor(uTime * 24.0);
    float n = hash(vec2(band, tt));
    float on = step(1.0 - uGlitch * 0.42, hash(vec2(band * 1.7, tt + 3.0)));
    uv.x += (n - 0.5) * 0.09 * uGlitch * on;
  }

  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  vec2 off = c * (uAberr * (0.25 + r2 * 3.0));
  vec3 col = vec3(texture(uScene, uv + off).r, texture(uScene, uv).g, texture(uScene, uv - off).b);
  vec3 bl = vec3(texture(uBloomTex, uv + off).r, texture(uBloomTex, uv).g, texture(uBloomTex, uv - off).b);
  col += bl * uBloomStr;

  // Nebel im Hintergrund
  vec2 np = c * vec2(asp, 1.0) * 1.5 + uCamOff;
  float n1 = fbm(np * 1.3 + vec2(0.0, uTime * 0.010));
  float n2 = fbm(np * 2.1 - vec2(uTime * 0.008, 4.0));
  vec3 neb = vec3(0.11, 0.02, 0.24) * smoothstep(0.35, 0.85, n1)
           + vec3(0.00, 0.07, 0.17) * smoothstep(0.40, 0.90, n2);
  col += neb * 0.5 + vec3(0.006, 0.004, 0.016);

  col = 1.0 - exp(-col * 1.3);

  float g = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(g) * vec3(0.72, 0.88, 1.18), uDesat);

  // Dunkelfeld: nur Lichtkegel um Spieler und Echos bleiben sichtbar
  if (uDark > 0.001) {
    float lit = 0.0;
    for (int i = 0; i < 10; i++) {
      if (i >= uLightN) break;
      vec2 d = vUv - uLights[i].xy; d.x *= asp;
      float rr = uLights[i].z;
      lit = max(lit, 1.0 - smoothstep(rr * 0.5, rr, length(d)));
    }
    col *= mix(1.0, 0.035 + 0.965 * lit, uDark);
  }

  float vig = smoothstep(0.95, 0.28, sqrt(r2));
  col *= mix(0.42, 1.0, vig);
  col += vec3(0.60, 0.0, 0.07) * uDanger * (1.0 - vig);
  col += uFlash;

  col *= 0.975 + 0.025 * sin(gl_FragCoord.y * 1.5708);
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.022;
  o = vec4(col, 1.0);
}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s));
    return s;
  }

  function program(vs, fs, names) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
    const u = {};
    for (const n of names) u[n] = gl.getUniformLocation(p, n);
    return { p, u };
  }

  function makeTarget(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, w, h, ok };
  }

  function freeTarget(t) {
    if (!t) return;
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fbo);
  }

  function buildTargets() {
    freeTarget(scene);
    for (const l of levels) freeTarget(l);
    levels = [];
    scene = makeTarget(pw, ph);
    if (!scene.ok && hdr) {          // Float-Ziele nicht renderbar -> 8 Bit
      hdr = false;
      freeTarget(scene);
      scene = makeTarget(pw, ph);
    }
    let w = pw, h = ph;
    for (let i = 0; i < LEVELS; i++) {
      w = Math.max(2, w >> 1); h = Math.max(2, h >> 1);
      levels.push(makeTarget(w, h));
    }
  }

  function resize() {
    if (!gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * quality;
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    pw = Math.max(2, Math.round(W * dpr)); ph = Math.max(2, Math.round(H * dpr));
    canvas.width = pw; canvas.height = ph;
    buildTargets();
  }

  function init(cv) {
    canvas = cv;
    gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) return false;
    // Float-Ziele für HDR-Bloom; wenn sie nicht renderbar sind, fällt buildTargets() auf 8 Bit zurück
    const extF = gl.getExtension('EXT_color_buffer_float'), extH = gl.getExtension('EXT_color_buffer_half_float');
    hdr = !!(extF || extH);
    pScene = program(VS_SCENE, FS_SCENE, ['uCam']);
    pDown = program(VS_FS, FS_DOWN, ['uTex', 'uTexel']);
    pUp = program(VS_FS, FS_UP, ['uTex', 'uTexel']);
    pFinal = program(VS_FS, FS_FINAL, ['uScene', 'uBloomTex', 'uRes', 'uCamOff', 'uWave', 'uFlash', 'uTime', 'uAberr', 'uBloomStr', 'uGlitch', 'uDanger', 'uDesat', 'uDark', 'uLights', 'uLightN']);

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vdata.byteLength, gl.DYNAMIC_DRAW);
    const st = FL * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, st, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 20);
    const idx = new Uint32Array(MAX_QUADS * 6);
    for (let q = 0, v = 0, i = 0; q < MAX_QUADS; q++, v += 4) {
      idx[i++] = v; idx[i++] = v + 1; idx[i++] = v + 2;
      idx[i++] = v; idx[i++] = v + 2; idx[i++] = v + 3;
    }
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    fsVao = gl.createVertexArray();
    gl.bindVertexArray(null);
    resize();
    return true;
  }

  function flush() {
    if (!nq) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, vdata, 0, vi);
    gl.drawElements(gl.TRIANGLES, nq * 6, gl.UNSIGNED_INT, 0);
    vi = 0; nq = 0;
  }

  function begin() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
    gl.viewport(0, 0, pw, ph);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(pScene.p);
    gl.uniform4f(pScene.u.uCam, cam.x, cam.y, (2 * cam.zoom) / W, (2 * cam.zoom) / H);
    gl.bindVertexArray(vao);
    vi = 0; nq = 0;
  }

  function end(p) {
    flush();
    gl.bindVertexArray(fsVao);
    gl.activeTexture(gl.TEXTURE0);

    // Bloom: runter …
    gl.disable(gl.BLEND);
    gl.useProgram(pDown.p);
    gl.uniform1i(pDown.u.uTex, 0);
    let src = scene;
    for (let i = 0; i < LEVELS; i++) {
      const dst = levels[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform2f(pDown.u.uTexel, 1 / src.w, 1 / src.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = dst;
    }
    // … und additiv wieder hoch
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(pUp.p);
    gl.uniform1i(pUp.u.uTex, 0);
    for (let i = LEVELS - 1; i > 0; i--) {
      const s = levels[i], dst = levels[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.bindTexture(gl.TEXTURE_2D, s.tex);
      gl.uniform2f(pUp.u.uTexel, 1 / s.w, 1 / s.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);

    // Finale Komposition
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, pw, ph);
    const u = pFinal.u;
    gl.useProgram(pFinal.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, levels[0].tex);
    gl.uniform1i(u.uScene, 0);
    gl.uniform1i(u.uBloomTex, 1);
    gl.uniform2f(u.uRes, pw, ph);
    gl.uniform2f(u.uCamOff, p.camOff[0], p.camOff[1]);
    gl.uniform4f(u.uWave, p.wave[0], p.wave[1], p.wave[2], p.wave[3]);
    gl.uniform3f(u.uFlash, p.flash[0], p.flash[1], p.flash[2]);
    gl.uniform1f(u.uTime, p.time);
    gl.uniform1f(u.uAberr, p.aberr);
    gl.uniform1f(u.uBloomStr, p.bloom);
    gl.uniform1f(u.uGlitch, p.glitch);
    gl.uniform1f(u.uDanger, p.danger);
    gl.uniform1f(u.uDesat, p.desat);
    gl.uniform1f(u.uDark, p.dark);
    gl.uniform1i(u.uLightN, p.lightN);
    gl.uniform3fv(u.uLights, p.lights);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
  }

  function V(x, y, r, g, b, lx, ly, hl, w) {
    const d = vdata;
    d[vi++] = x; d[vi++] = y; d[vi++] = r; d[vi++] = g; d[vi++] = b;
    d[vi++] = lx; d[vi++] = ly; d[vi++] = hl; d[vi++] = w;
  }

  /** Linie mit runden Enden. w = halbe Breite inkl. weichem Rand. */
  function line(x0, y0, x1, y1, w, r, g, b, a) {
    if (nq >= MAX_QUADS) flush();
    if (a !== undefined) { r *= a; g *= a; b *= a; }
    let dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1e-6) { dx /= len; dy /= len; } else { dx = 1; dy = 0; }
    const hl = len * 0.5, ex = dx * w, ey = dy * w, nx = -dy * w, ny = dx * w, u = hl + w;
    V(x0 - ex + nx, y0 - ey + ny, r, g, b, -u, w, hl, w);
    V(x0 - ex - nx, y0 - ey - ny, r, g, b, -u, -w, hl, w);
    V(x1 + ex - nx, y1 + ey - ny, r, g, b, u, -w, hl, w);
    V(x1 + ex + nx, y1 + ey + ny, r, g, b, u, w, hl, w);
    nq++;
  }

  /** Linie mit Farbverlauf (für das Gitter). */
  function line2(x0, y0, x1, y1, w, r0, g0, b0, r1, g1, b1) {
    if (nq >= MAX_QUADS) flush();
    let dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1e-6) { dx /= len; dy /= len; } else { dx = 1; dy = 0; }
    const hl = len * 0.5, ex = dx * w, ey = dy * w, nx = -dy * w, ny = dx * w, u = hl + w;
    V(x0 - ex + nx, y0 - ey + ny, r0, g0, b0, -u, w, hl, w);
    V(x0 - ex - nx, y0 - ey - ny, r0, g0, b0, -u, -w, hl, w);
    V(x1 + ex - nx, y1 + ey - ny, r1, g1, b1, u, -w, hl, w);
    V(x1 + ex + nx, y1 + ey + ny, r1, g1, b1, u, w, hl, w);
    nq++;
  }

  /** Weicher Leuchtpunkt. */
  function dot(x, y, rad, r, g, b, a) {
    if (nq >= MAX_QUADS) flush();
    if (a !== undefined) { r *= a; g *= a; b *= a; }
    V(x - rad, y + rad, r, g, b, -rad, rad, 0, rad);
    V(x - rad, y - rad, r, g, b, -rad, -rad, 0, rad);
    V(x + rad, y - rad, r, g, b, rad, -rad, 0, rad);
    V(x + rad, y + rad, r, g, b, rad, rad, 0, rad);
    nq++;
  }

  /** Gefülltes Dreieck (ohne Kantenglättung). */
  function tri(x0, y0, x1, y1, x2, y2, r, g, b, a) {
    if (nq >= MAX_QUADS) flush();
    if (a !== undefined) { r *= a; g *= a; b *= a; }
    V(x0, y0, r, g, b, 0, 0, 0, 0);
    V(x1, y1, r, g, b, 0, 0, 0, 0);
    V(x2, y2, r, g, b, 0, 0, 0, 0);
    V(x2, y2, r, g, b, 0, 0, 0, 0);
    nq++;
  }

  function xform(shape, x, y, rot, s) {
    const c = Math.cos(rot) * s, sn = Math.sin(rot) * s, n = shape.length;
    for (let i = 0; i < n; i += 2) {
      const px = shape[i], py = shape[i + 1];
      scratch[i] = x + px * c - py * sn;
      scratch[i + 1] = y + px * sn + py * c;
    }
    return n;
  }

  /** Geschlossener Linienzug aus einer Einheitsform. */
  function poly(shape, x, y, rot, s, w, r, g, b, a) {
    const n = xform(shape, x, y, rot, s);
    for (let i = 0; i < n; i += 2) {
      const j = (i + 2) % n;
      line(scratch[i], scratch[i + 1], scratch[j], scratch[j + 1], w, r, g, b, a);
    }
  }

  function polyFill(shape, x, y, rot, s, r, g, b, a) {
    const n = xform(shape, x, y, rot, s);
    for (let i = 0; i < n; i += 2) {
      const j = (i + 2) % n;
      tri(x, y, scratch[i], scratch[i + 1], scratch[j], scratch[j + 1], r, g, b, a);
    }
  }

  function ring(x, y, rad, w, r, g, b, a, segs) {
    const n = segs || clamp(Math.round(rad * 0.3), 14, 72);
    let px = x + rad, py = y;
    for (let i = 1; i <= n; i++) {
      const t = (i / n) * TAU, qx = x + Math.cos(t) * rad, qy = y + Math.sin(t) * rad;
      line(px, py, qx, qy, w, r, g, b, a);
      px = qx; py = qy;
    }
  }

  // Sieben-Segment-Ziffern für leuchtende Punktzahlen in der Welt
  const SEG = { a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1] };
  const DIG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgecd', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };

  function num(x, y, str, size, r, g, b, a) {
    const cw = size * 0.5, gap = size * 0.3, lw = Math.max(1, size * 0.085);
    let cx = x - (str.length * cw + (str.length - 1) * gap) / 2;
    for (let k = 0; k < str.length; k++) {
      const ch = str[k], segs = DIG[ch];
      if (segs) {
        for (let s = 0; s < segs.length; s++) {
          const p = SEG[segs[s]];
          line(cx + p[0] * cw, y + p[1] * size * 0.5, cx + p[2] * cw, y + p[3] * size * 0.5, lw, r, g, b, a);
        }
      } else if (ch === 'x') {
        line(cx, y + size * 0.35, cx + cw, y + size, lw, r, g, b, a);
        line(cx + cw, y + size * 0.35, cx, y + size, lw, r, g, b, a);
      } else if (ch === '+') {
        line(cx, y + size * 0.5, cx + cw, y + size * 0.5, lw, r, g, b, a);
        line(cx + cw * 0.5, y + size * 0.2, cx + cw * 0.5, y + size * 0.8, lw, r, g, b, a);
      }
      cx += cw + gap;
    }
  }

  return {
    init, resize, begin, end, flush, line, line2, dot, tri, poly, polyFill, ring, num, cam,
    setQuality(q) { quality = q; resize(); },
    get quality() { return quality; },
    get W() { return W; },
    get H() { return H; },
    get hdr() { return hdr; },
  };
})();
