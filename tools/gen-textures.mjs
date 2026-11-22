// Build-time procedural texture generator. Writes tileable JPG/PNG textures to public/textures.
// Run: node tools/gen-textures.mjs
import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { perlin2, fbm2, ridged2, worley2, mulberry32, smoothstep, clamp } from '../src/core/noise.js';

const OUT = path.resolve('public/textures');
fs.mkdirSync(OUT, { recursive: true });

class Img {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.r = new Float32Array(w * h); this.g = new Float32Array(w * h); this.b = new Float32Array(w * h);
    this.a = new Float32Array(w * h); this.ht = new Float32Array(w * h);
  }
  each(fn) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x;
      const c = fn(x / this.w, y / this.h, x, y, i);
      if (c) { this.r[i] = c[0]; this.g[i] = c[1]; this.b[i] = c[2]; if (c.length > 3) this.ht[i] = c[3]; if (c.length > 4) this.a[i] = c[4]; }
    }
  }
  // Blend a soft line segment (in pixel coordinates), wrapping if tile=true.
  stroke(x0, y0, x1, y1, width, col, alpha, hgt = 0, tile = true, setAlpha = false) {
    const minx = Math.floor(Math.min(x0, x1) - width - 1), maxx = Math.ceil(Math.max(x0, x1) + width + 1);
    const miny = Math.floor(Math.min(y0, y1) - width - 1), maxy = Math.ceil(Math.max(y0, y1) + width + 1);
    const dx = x1 - x0, dy = y1 - y0; const len2 = dx * dx + dy * dy || 1;
    for (let py = miny; py <= maxy; py++) for (let px = minx; px <= maxx; px++) {
      let t = ((px - x0) * dx + (py - y0) * dy) / len2; t = clamp(t, 0, 1);
      const cx = x0 + dx * t, cy = y0 + dy * t;
      const d = Math.hypot(px - cx, py - cy);
      const w = width * (1 - 0.6 * t); // taper
      if (d > w + 0.8) continue;
      const cov = clamp(w + 0.8 - d, 0, 1) * alpha;
      let X = px, Y = py;
      if (tile) { X = ((X % this.w) + this.w) % this.w; Y = ((Y % this.h) + this.h) % this.h; }
      else if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue;
      const i = Y * this.w + X;
      this.r[i] += (col[0] - this.r[i]) * cov; this.g[i] += (col[1] - this.g[i]) * cov; this.b[i] += (col[2] - this.b[i]) * cov;
      this.ht[i] = Math.max(this.ht[i], hgt * (1 - d / (w + 0.8)) * (cov > 0 ? 1 : 0) + this.ht[i] * 0) ;
      if (setAlpha) this.a[i] = Math.max(this.a[i], cov / Math.max(alpha, 1e-3));
    }
  }
  disc(cx, cy, rad, col, alpha, hgt = 0, tile = true, setAlpha = false) {
    for (let py = Math.floor(cy - rad - 1); py <= Math.ceil(cy + rad + 1); py++)
      for (let px = Math.floor(cx - rad - 1); px <= Math.ceil(cx + rad + 1); px++) {
        const d = Math.hypot(px - cx, py - cy); if (d > rad + 0.8) continue;
        const cov = clamp(rad + 0.8 - d, 0, 1) * alpha;
        let X = px, Y = py;
        if (tile) { X = ((X % this.w) + this.w) % this.w; Y = ((Y % this.h) + this.h) % this.h; }
        else if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue;
        const i = Y * this.w + X;
        this.r[i] += (col[0] - this.r[i]) * cov; this.g[i] += (col[1] - this.g[i]) * cov; this.b[i] += (col[2] - this.b[i]) * cov;
        this.ht[i] = Math.max(this.ht[i], hgt * Math.sqrt(Math.max(0, 1 - (d / rad) ** 2)));
        if (setAlpha) this.a[i] = Math.max(this.a[i], cov / Math.max(alpha, 1e-3));
      }
  }
  saveJPG(name, q = 88) {
    const data = Buffer.alloc(this.w * this.h * 4);
    for (let i = 0; i < this.w * this.h; i++) {
      data[i * 4] = clamp(Math.round(this.r[i] * 255), 0, 255);
      data[i * 4 + 1] = clamp(Math.round(this.g[i] * 255), 0, 255);
      data[i * 4 + 2] = clamp(Math.round(this.b[i] * 255), 0, 255);
      data[i * 4 + 3] = 255;
    }
    fs.writeFileSync(path.join(OUT, name), jpeg.encode({ data, width: this.w, height: this.h }, q).data);
  }
  savePNG(name) {
    const png = new PNG({ width: this.w, height: this.h });
    for (let i = 0; i < this.w * this.h; i++) {
      png.data[i * 4] = clamp(Math.round(this.r[i] * 255), 0, 255);
      png.data[i * 4 + 1] = clamp(Math.round(this.g[i] * 255), 0, 255);
      png.data[i * 4 + 2] = clamp(Math.round(this.b[i] * 255), 0, 255);
      png.data[i * 4 + 3] = clamp(Math.round(this.a[i] * 255), 0, 255);
    }
    fs.writeFileSync(path.join(OUT, name), PNG.sync.write(png));
  }
  // Normal map from the height buffer (wrapping), saved as JPG.
  saveNormal(name, strength = 2, tile = true) {
    const n = new Img(this.w, this.h);
    const H = (x, y) => {
      if (tile) { x = (x + this.w) % this.w; y = (y + this.h) % this.h; }
      else { x = clamp(x, 0, this.w - 1); y = clamp(y, 0, this.h - 1); }
      return this.ht[y * this.w + x];
    };
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = y * this.w + x;
      n.r[i] = nx * 0.5 + 0.5; n.g[i] = ny * 0.5 + 0.5; n.b[i] = nz * 0.5 + 0.5;
    }
    n.saveJPG(name, 92);
  }
  blurHeight(passes = 1) {
    for (let p = 0; p < passes; p++) {
      const t = new Float32Array(this.ht.length);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        let s = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += this.ht[((y + j + this.h) % this.h) * this.w + ((x + i + this.w) % this.w)];
        t[y * this.w + x] = s / 9;
      }
      this.ht = t;
    }
  }
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const t0 = Date.now();
const log = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);

// ---------------------------------------------------------------- GRASS
function grass() {
  const S = 1024, im = new Img(S, S), rnd = mulberry32(11);
  const P = 8;
  im.each((u, v) => {
    const n = fbm2(u * P, v * P, 5, 3, P);
    const m = fbm2(u * 4, v * 4, 3, 9, 4);
    let c = mix(hex(0x3d5a1e), hex(0x5a7a2a), n * 0.5 + 0.5);
    c = mix(c, hex(0x7a7a3a), smoothstep(0.25, 0.6, m) * 0.45);
    return [...mul(c, 0.55), 0];
  });
  const cols = [hex(0x4a6e22), hex(0x5f8a2c), hex(0x3c5a1a), hex(0x6f8f34), hex(0x8a9446), hex(0x2f4a16), hex(0x78953a)];
  for (let k = 0; k < 90000; k++) {
    const x = rnd() * S, y = rnd() * S;
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.2;
    const L = 5 + rnd() * 14;
    let c = cols[Math.floor(rnd() * cols.length)];
    const dry = fbm2(x / S * 4, y / S * 4, 3, 9, 4);
    if (rnd() < 0.15 + smoothstep(0.2, 0.6, dry) * 0.3) c = mix(c, hex(0xa39a5a), 0.5 + rnd() * 0.4);
    c = mul(c, 0.75 + rnd() * 0.45);
    im.stroke(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 0.7 + rnd() * 0.8, c, 0.9, 0.4 + rnd() * 0.6);
  }
  // tiny flowers and clover
  for (let k = 0; k < 700; k++) {
    const x = rnd() * S, y = rnd() * S;
    const c = rnd() < 0.5 ? hex(0xeeeeee) : rnd() < 0.5 ? hex(0xe8d040) : hex(0x9a70c0);
    im.disc(x, y, 1 + rnd() * 1.2, c, 0.9, 0.8);
  }
  im.blurHeight(1);
  im.saveJPG('grass.jpg'); im.saveNormal('grass_n.jpg', 3);
  log('grass');
}

// ---------------------------------------------------------------- FOREST FLOOR
function forest() {
  const S = 1024, im = new Img(S, S), rnd = mulberry32(21);
  im.each((u, v) => {
    const n = fbm2(u * 6, v * 6, 5, 4, 6);
    const moss = smoothstep(0.0, 0.35, fbm2(u * 5, v * 5, 4, 44, 5));
    let c = mix(hex(0x3a2c1c), hex(0x5a4228), n * 0.5 + 0.5);
    c = mix(c, mix(hex(0x4a6420), hex(0x6a7c2c), n * 0.5 + 0.5), moss * 0.85);
    return [...c, moss * 0.6 + n * 0.2];
  });
  // needles
  for (let k = 0; k < 60000; k++) {
    const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI * 2, L = 4 + rnd() * 9;
    const c = mul(rnd() < 0.6 ? hex(0x7a5530) : rnd() < 0.5 ? hex(0x9a6a3a) : hex(0x4a3420), 0.8 + rnd() * 0.4);
    im.stroke(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 0.6, c, 0.85, 0.5);
  }
  // twigs, cones, leaves
  for (let k = 0; k < 300; k++) {
    const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI * 2, L = 20 + rnd() * 50;
    im.stroke(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 1.5 + rnd() * 1.5, mul(hex(0x4a3a2a), 0.7 + rnd() * 0.5), 1, 1.5);
  }
  for (let k = 0; k < 120; k++) {
    const x = rnd() * S, y = rnd() * S; const r = 4 + rnd() * 4;
    im.disc(x, y, r, mul(hex(0x6a4a2a), 0.8 + rnd() * 0.4), 1, 2.5);
  }
  for (let k = 0; k < 900; k++) {
    const x = rnd() * S, y = rnd() * S;
    im.disc(x, y, 2 + rnd() * 3, mul(rnd() < 0.5 ? hex(0x8a7a3a) : hex(0x6a4a24), 0.8 + rnd() * 0.3), 0.9, 0.6);
  }
  // lingonberry/blueberry dots
  for (let k = 0; k < 500; k++) {
    const x = rnd() * S, y = rnd() * S;
    im.disc(x, y, 1.2 + rnd(), rnd() < 0.5 ? hex(0x2a3a8a) : hex(0xa02020), 1, 1);
  }
  im.blurHeight(1);
  im.saveJPG('forest.jpg'); im.saveNormal('forest_n.jpg', 3);
  log('forest');
}

// ---------------------------------------------------------------- DIRT
function dirt() {
  const S = 1024, im = new Img(S, S), rnd = mulberry32(31);
  im.each((u, v) => {
    const n = fbm2(u * 8, v * 8, 6, 5, 8);
    const w = worley2(u * 40, v * 40, 3, 40);
    const peb = smoothstep(0.35, 0.1, w[0]) * (w[2] > 0.6 ? 1 : 0);
    let c = mix(hex(0x4a3828), hex(0x7a6048), n * 0.5 + 0.5);
    c = mix(c, mix(hex(0x8a8070), hex(0x5a5048), w[2]), peb);
    const crack = smoothstep(0.015, 0.0, Math.abs(perlin2(u * 12, v * 12, 77, 12)) ) * 0.15 * smoothstep(0.1,0.5,fbm2(u*3,v*3,2,78,3));
    c = mul(c, 1 - crack);
    return [...c, n * 0.4 + peb * 0.8 - crack];
  });
  for (let k = 0; k < 2500; k++) {
    const x = rnd() * S, y = rnd() * S;
    im.disc(x, y, 1 + rnd() * 2.5, mul(hex(0x6a5a48), 0.7 + rnd() * 0.6), 0.9, 1);
  }
  im.blurHeight(1);
  im.saveJPG('dirt.jpg'); im.saveNormal('dirt_n.jpg', 4);
  log('dirt');
}

// ---------------------------------------------------------------- GRAVEL ROAD
function gravel() {
  const S = 1024, im = new Img(S, S);
  const P1 = 64, P2 = 160;
  im.each((u, v) => {
    const n = fbm2(u * 6, v * 6, 4, 12, 6);
    let c = mix(hex(0x6a6258), hex(0x8a8070), n * 0.5 + 0.5);
    let h = 0;
    const a = worley2(u * P1, v * P1, 5, P1, 0.9);
    const s1 = smoothstep(0.42, 0.15, a[0]) * smoothstep(0.02, 0.12, a[1] - a[0]);
    const tone = a[2];
    const stone = mix(mix(hex(0x6e6a64), hex(0x9a9288), tone), hex(0x7a5a48), tone > 0.8 ? 0.5 : 0);
    c = mix(c, mul(stone, 0.85 + 0.3 * (1 - a[0])), s1);
    h = s1 * (1 - a[0]);
    const b = worley2(u * P2, v * P2, 9, P2, 0.9);
    const s2 = smoothstep(0.4, 0.1, b[0]) * 0.8;
    c = mix(c, mul(mix(hex(0x77726a), hex(0xa89f92), b[2]), 0.9), s2 * (1 - s1));
    h = Math.max(h, s2 * 0.5 * (1 - b[0]));
    const dust = smoothstep(0.1, 0.6, fbm2(u * 3, v * 3, 3, 99, 3));
    c = mix(c, hex(0x9a8e78), dust * 0.35);
    return [...c, h];
  });
  im.saveJPG('gravel.jpg'); im.saveNormal('gravel_n.jpg', 3);
  log('gravel');
}

// ---------------------------------------------------------------- ASPHALT
function asphalt() {
  const S = 1024, im = new Img(S, S), rnd = mulberry32(41);
  im.each((u, v) => {
    const n = fbm2(u * 16, v * 16, 4, 13, 16);
    const fine = perlin2(u * 400, v * 400, 3, 400);
    const st = fbm2(u * 3, v * 3, 3, 14, 3);
    let c = mul(hex(0x2c2c2e), 0.85 + n * 0.25 + fine * 0.12);
    c = mix(c, hex(0x3c3a36), smoothstep(0.1, 0.5, st) * 0.6);
    const crack = smoothstep(0.012, 0.0, Math.abs(ridged2(u * 5, v * 5, 3, 7, 5) - 0.85) * 0.05) * 0;
    return [...c, fine * 0.25 + n * 0.1 - crack];
  });
  for (let k = 0; k < 26000; k++) {
    const x = rnd() * S, y = rnd() * S;
    const g = 0.3 + rnd() * 0.35;
    im.disc(x, y, 0.6 + rnd() * 1.3, [g, g * 0.98, g * 0.95], 0.8, 0.7);
  }
  // cracks
  for (let k = 0; k < 14; k++) {
    let x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI * 2;
    for (let s = 0; s < 40; s++) {
      const nx = x + Math.cos(a) * 6, ny = y + Math.sin(a) * 6;
      im.stroke(x, y, nx, ny, 0.9, hex(0x151515), 0.9, -0.5);
      x = nx; y = ny; a += (rnd() - 0.5) * 0.9;
    }
  }
  im.saveJPG('asphalt.jpg'); im.saveNormal('asphalt_n.jpg', 2);
  log('asphalt');
}

// ---------------------------------------------------------------- ROCK (granite with lichen)
function rock() {
  const S = 1024, im = new Img(S, S);
  im.each((u, v) => {
    const n = fbm2(u * 4, v * 4, 6, 15, 4);
    const sp = perlin2(u * 180, v * 180, 5, 180);
    const sp2 = perlin2(u * 90, v * 90, 6, 90);
    let c = mix(hex(0x6a6260), hex(0x9a8c86), n * 0.5 + 0.5);
    if (sp > 0.45) c = mix(c, hex(0x2a2626), 0.7);
    if (sp2 > 0.5) c = mix(c, hex(0xa87868), 0.5);
    if (sp < -0.55) c = mix(c, hex(0xd8d0c8), 0.5);
    const w = worley2(u * 6, v * 6, 8, 6);
    const crack = smoothstep(0.05, 0.0, w[1] - w[0]);
    c = mul(c, 1 - crack * 0.25 * smoothstep(-0.1, 0.4, fbm2(u * 9, v * 9, 3, 69, 9)));
    const lich = smoothstep(0.15, 0.4, fbm2(u * 7, v * 7, 4, 66, 7));
    const lich2 = smoothstep(0.3, 0.5, fbm2(u * 11, v * 11, 3, 67, 11));
    c = mix(c, hex(0x9aa07a), lich * 0.55);
    c = mix(c, hex(0xc8b850), lich2 * 0.35);
    const moss = smoothstep(0.35, 0.6, fbm2(u * 3, v * 3, 4, 68, 3));
    c = mix(c, hex(0x3e5a1e), moss * 0.7);
    return [...c, n * 1.2 + (1 - crack) * 0.3 + lich * 0.08];
  });
  im.saveJPG('rock.jpg'); im.saveNormal('rock_n.jpg', 6);
  log('rock');
}

// ---------------------------------------------------------------- BARKS
function barkPine() {
  const W = 512, H = 1024, im = new Img(W, H);
  im.each((u, v) => {
    const w = worley2(u * 6, v * 5, 3, 0, 0.8);
    // wrap u manually via periodic worley is approximate; use periodic variant
    const wp = worley2(u * 10, v * 5, 3, 10, 0.9);
    const edge = smoothstep(0.0, 0.12, wp[1] - wp[0]);
    const n = fbm2(u * 8, v * 16, 4, 5, 8);
    let c = mix(hex(0x6a3a22), hex(0xa25e36), wp[2] * 0.6 + n * 0.3 + 0.2);
    c = mix(hex(0x2a1a12), c, edge);
    const flake = smoothstep(0.3, 0.6, perlin2(u * 30, v * 50, 9, 30));
    c = mix(c, hex(0xc08a5a), flake * 0.3 * edge);
    return [...c, edge * (0.6 + wp[2] * 0.4) + n * 0.2];
  });
  im.saveJPG('bark_pine.jpg'); im.saveNormal('bark_pine_n.jpg', 6);
  log('bark pine');
}
function barkSpruce() {
  const W = 512, H = 1024, im = new Img(W, H);
  im.each((u, v) => {
    const wp = worley2(u * 14, v * 22, 4, 14, 0.9);
    const edge = smoothstep(0.0, 0.15, wp[1] - wp[0]);
    const n = fbm2(u * 6, v * 10, 4, 6, 6);
    let c = mix(hex(0x3a3028), hex(0x6a5848), wp[2] * 0.5 + n * 0.4 + 0.2);
    c = mix(hex(0x1e1812), c, edge);
    const lich = smoothstep(0.35, 0.6, fbm2(u * 5, v * 8, 3, 61, 5));
    c = mix(c, hex(0x8a9a78), lich * 0.4);
    return [...c, edge * 0.7 + n * 0.3];
  });
  im.saveJPG('bark_spruce.jpg'); im.saveNormal('bark_spruce_n.jpg', 5);
  log('bark spruce');
}
function barkBirch() {
  const W = 512, H = 1024, im = new Img(W, H), rnd = mulberry32(51);
  im.each((u, v) => {
    const n = fbm2(u * 4, v * 8, 4, 7, 4);
    let c = mix(hex(0xd8d4c8), hex(0xf0ece2), n * 0.5 + 0.5);
    const pink = smoothstep(0.3, 0.6, fbm2(u * 3, v * 6, 3, 71, 3));
    c = mix(c, hex(0xc8b0a0), pink * 0.25);
    return [...c, n * 0.2];
  });
  // horizontal lenticels
  for (let k = 0; k < 900; k++) {
    const x = rnd() * W, y = rnd() * H, L = 6 + rnd() * 30;
    im.stroke(x, y, x + L, y + (rnd() - 0.5) * 2, 0.8 + rnd() * 1.4, hex(0x2a2622), 0.9, -0.6);
  }
  // black patches
  for (let k = 0; k < 60; k++) {
    const x = rnd() * W, y = rnd() * H, r = 6 + rnd() * 26;
    for (let j = 0; j < 8; j++) im.disc(x + (rnd() - 0.5) * r * 1.6, y + (rnd() - 0.5) * r * 0.7, r * (0.3 + rnd() * 0.4), hex(0x1a1816), 0.85, -1);
  }
  im.blurHeight(1);
  im.saveJPG('bark_birch.jpg'); im.saveNormal('bark_birch_n.jpg', 3);
  log('bark birch');
}

// ---------------------------------------------------------------- WOODEN BOARDS
function boards(name, base, dark, painted, vertical = true, seed = 1) {
  const S = 1024, im = new Img(S, S), rnd = mulberry32(seed);
  const N = 8; // boards per tile
  im.each((u, v) => {
    const a = vertical ? u : v, b = vertical ? v : u;
    const bi = Math.floor(a * N);
    const ba = a * N - bi;
    const off = (bi * 0.37) % 1;
    const grain = fbm2(bi * 3.1 + ba * 0.6, (b + off) * 30, 4, 20 + bi, 0) * 0.5 + 0.5;
    const ring = Math.sin(((b + off) * 60 + fbm2(ba * 2, b * 8 + bi, 3, 3) * 6) ) * 0.5 + 0.5;
    let c = mix(dark, base, grain * 0.6 + ring * 0.25 + 0.15);
    const tone = 0.88 + ((bi * 7919) % 13) / 13 * 0.2;
    c = mul(c, tone);
    const gap = smoothstep(0.035, 0.0, ba) + smoothstep(0.965, 1.0, ba);
    let h = 1 - gap;
    if (painted) {
      const peel = smoothstep(0.35, 0.55, fbm2(u * 10, v * 10, 4, seed + 9, 10));
      const streak = smoothstep(0.2, 0.7, fbm2(a * 30, b * 2, 3, seed + 3, 0)) * 0.25;
      c = mix(painted, mul(painted, 0.75), streak + grain * 0.15);
      c = mix(c, mix(hex(0x8a8070), hex(0x5a5048), grain), peel * 0.6);
      h += peel * -0.1 + grain * 0.05;
    } else h += grain * 0.12;
    c = mul(c, 1 - gap * 0.7);
    return [...c, h];
  });
  // knots
  for (let k = 0; k < 14; k++) {
    const x = rnd() * S, y = rnd() * S;
    im.disc(x, y, 4 + rnd() * 6, mul(dark, painted ? 0.9 : 0.6), painted ? 0.25 : 0.9, -0.3);
  }
  im.saveJPG(name + '.jpg'); im.saveNormal(name + '_n.jpg', 4);
  log(name);
}

// ---------------------------------------------------------------- CONCRETE
function concrete() {
  const S = 1024, im = new Img(S, S), rnd = mulberry32(61);
  im.each((u, v) => {
    const n = fbm2(u * 8, v * 8, 6, 23, 8);
    const st = fbm2(u * 2, v * 2, 4, 24, 2);
    let c = mix(hex(0x6e6c68), hex(0x9a9690), n * 0.5 + 0.5);
    c = mix(c, hex(0x4a4642), smoothstep(0.15, 0.6, st) * 0.4);
    const pore = perlin2(u * 300, v * 300, 3, 300);
    if (pore > 0.6) c = mul(c, 0.7);
    return [...c, n * 0.3 + (pore > 0.6 ? -0.2 : 0)];
  });
  for (let k = 0; k < 8; k++) {
    const x = rnd() * S, y = rnd() * S, r = 20 + rnd() * 60;
    for (let j = 0; j < 6; j++) im.disc(x + (rnd() - .5) * r, y + (rnd() - .5) * r, r * (0.3 + rnd() * 0.3), hex(0x2a2826), 0.25, 0);
  }
  for (let k = 0; k < 6; k++) {
    let x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI * 2;
    for (let s = 0; s < 60; s++) {
      const nx = x + Math.cos(a) * 5, ny = y + Math.sin(a) * 5;
      im.stroke(x, y, nx, ny, 0.7, hex(0x3a3836), 0.8, -0.4); x = nx; y = ny; a += (rnd() - .5) * 0.7;
    }
  }
  im.saveJPG('concrete.jpg'); im.saveNormal('concrete_n.jpg', 2);
  log('concrete');
}

// ---------------------------------------------------------------- CORRUGATED / ROOF
function roof() {
  const S = 512, im = new Img(S, S);
  im.each((u, v) => {
    const ridge = Math.sin(u * Math.PI * 2 * 8) * 0.5 + 0.5;
    const n = fbm2(u * 6, v * 6, 4, 33, 6);
    const rust = smoothstep(0.25, 0.55, fbm2(u * 5, v * 3, 4, 34, 5)) * smoothstep(0.2, 0.9, v + n * 0.3);
    let c = mix(hex(0x3a3c3e), hex(0x4e5052), n * 0.5 + 0.5);
    c = mix(c, hex(0x7a4424), rust * 0.6);
    return [...mul(c, 0.85 + ridge * 0.25), ridge];
  });
  im.saveJPG('roof.jpg'); im.saveNormal('roof_n.jpg', 10);
  log('roof');
}
function shingles() {
  const S = 512, im = new Img(S, S);
  im.each((u, v) => {
    const row = Math.floor(v * 8), rv = v * 8 - row;
    const off = row % 2 ? 0.5 : 0;
    const col = Math.floor(u * 6 + off), cu = u * 6 + off - col;
    const n = fbm2(u * 10, v * 10, 3, 35, 10);
    const tone = 0.8 + ((col * 31 + row * 17) % 7) / 7 * 0.3;
    let c = mul(mix(hex(0x2a2a2c), hex(0x3a3634), n * 0.5 + 0.5), tone);
    const edge = smoothstep(0.0, 0.08, cu) * smoothstep(1.0, 0.92, cu);
    c = mul(c, 0.6 + 0.4 * edge);
    c = mul(c, 0.7 + rv * 0.4);
    return [...c, rv * 0.6 + edge * 0.2];
  });
  im.saveJPG('shingles.jpg'); im.saveNormal('shingles_n.jpg', 4);
  log('shingles');
}

// ---------------------------------------------------------------- FOLIAGE (alpha PNGs)
function spruceBranch() {
  const W = 512, H = 512, im = new Img(W, H), rnd = mulberry32(81);
  im.each(() => [0.12, 0.2, 0.1, 0, 0]);
  // a branch spray seen from above: main twig along x with side twigs
  const drawTwig = (x0, y0, a, L, depth) => {
    const x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L;
    im.stroke(x0, y0, x1, y1, 1.6 * (depth + 1) * 0.6, hex(0x4a3420), 1, 1, false, true);
    const steps = Math.floor(L / 1.3);
    for (let s = 0; s < steps; s++) {
      const t = s / steps; const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
      for (const side of [-1, 1]) {
        const na = a + side * (0.9 + rnd() * 0.5);
        const nl = (11 + rnd() * 7) * (1 - t * 0.45) * (depth ? 1 : 0.85);
        const g = 0.6 + rnd() * 0.5;
        const c = mix(hex(0x1e3a16), hex(0x2f5420), rnd());
        im.stroke(px, py, px + Math.cos(na) * nl, py + Math.sin(na) * nl, 1.5, mul(c, g), 1, 0.8, false, true);
      }
    }
    if (depth > 0) {
      const n = 6 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const t = 0.15 + i / n * 0.75;
        const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
        const side = i % 2 ? 1 : -1;
        drawTwig(px, py, a + side * (0.5 + rnd() * 0.4), L * (0.55 - t * 0.25) , depth - 1);
      }
    }
  };
  drawTwig(10, H / 2, 0, W - 110, 2);
  // fresh light-green tips
  for (let k = 0; k < 60; k++) {
    const x = 80 + rnd() * (W - 100), y = H / 2 + (rnd() - 0.5) * H * 0.6;
    const i = Math.floor(y) * W + Math.floor(x);
    if (im.a[i] > 0.5) im.disc(x, y, 2 + rnd() * 2, hex(0x5a8a30), 0.6, 0, false, false);
  }
  im.savePNG('spruce_branch.png');
  log('spruce branch');
}
function pineTuft() {
  const S = 512, im = new Img(S, S), rnd = mulberry32(82);
  im.each(() => [0.15, 0.22, 0.1, 0, 0]);
  for (let c = 0; c < 9; c++) {
    const cx = 60 + rnd() * (S - 120), cy = 60 + rnd() * (S - 120);
    for (let k = 0; k < 140; k++) {
      const a = rnd() * Math.PI * 2, L = 30 + rnd() * 50;
      const col = mul(mix(hex(0x2a4a1e), hex(0x4a6a2a), rnd()), 0.7 + rnd() * 0.5);
      im.stroke(cx, cy, cx + Math.cos(a) * L, cy + Math.sin(a) * L, 1.0, col, 1, 1, false, true);
    }
    im.disc(cx, cy, 5, hex(0x5a4028), 1, 1, false, true);
  }
  im.savePNG('pine_tuft.png');
  log('pine tuft');
}
function birchLeaves() {
  const S = 512, im = new Img(S, S), rnd = mulberry32(83);
  im.each(() => [0.25, 0.35, 0.12, 0, 0]);
  // twigs
  for (let t = 0; t < 16; t++) {
    let x = S / 2 + (rnd() - 0.5) * 120, y = S - 10, a = -Math.PI / 2 + (rnd() - 0.5) * 1.6;
    for (let s = 0; s < 26; s++) {
      const nx = x + Math.cos(a) * 12, ny = y + Math.sin(a) * 12;
      im.stroke(x, y, nx, ny, 1.2, hex(0x5a3a2a), 1, 0.5, false, true);
      // leaves along the twig
      if (s > 3) for (let l = 0; l < 2; l++) {
        const la = a + (l ? 1 : -1) * (0.7 + rnd() * 0.5) + Math.PI / 2 * 0;
        const lx = nx + Math.cos(la) * 14, ly = ny + Math.sin(la) * 14;
        const col = mul(mix(hex(0x5a8a2a), hex(0x8aaa3a), rnd()), 0.65 + rnd() * 0.5);
        // ovate leaf via several discs
        for (let q = 0; q < 6; q++) {
          const tt = q / 5;
          im.disc(nx + (lx - nx) * (0.3 + tt * 0.9), ny + (ly - ny) * (0.3 + tt * 0.9), 8 * Math.sin(Math.PI * (0.15 + tt * 0.8)), col, 1, 0.8, false, true);
        }
      }
      x = nx; y = ny; a += (rnd() - 0.5) * 0.5;
      if (x < 20 || x > S - 20 || y < 20) break;
    }
  }
  im.savePNG('birch_leaves.png');
  log('birch leaves');
}
function grassCard() {
  const W = 256, H = 256, im = new Img(W, H), rnd = mulberry32(84);
  im.each(() => [0.2, 0.3, 0.1, 0, 0]);
  for (let k = 0; k < 70; k++) {
    const x = 10 + rnd() * (W - 20);
    const L = H * (0.45 + rnd() * 0.5);
    const bend = (rnd() - 0.5) * 50;
    const col = mul(mix(hex(0x4a7a24), hex(0x8a9a40), rnd() < 0.2 ? 0.8 : rnd() * 0.4), 0.7 + rnd() * 0.5);
    let px = x, py = H;
    const seg = 10;
    for (let s = 1; s <= seg; s++) {
      const t = s / seg; const nx = x + bend * t * t, ny = H - L * t;
      im.stroke(px, py, nx, ny, 2.2 * (1 - t * 0.85), mix(mul(col, 0.6), col, t), 1, 1, false, true);
      px = nx; py = ny;
    }
  }
  im.savePNG('grass_card.png');
  log('grass card');
}
function flowers() {
  // 4 cells: lupine purple, lupine pink, daisy, buttercup
  const S = 512, im = new Img(S, S), rnd = mulberry32(85);
  im.each(() => [0.2, 0.3, 0.1, 0, 0]);
  const cell = S / 2;
  const lupine = (ox, oy, col) => {
    for (let k = 0; k < 3; k++) {
      const x = ox + cell * (0.3 + k * 0.2) + (rnd() - 0.5) * 20;
      im.stroke(x, oy + cell, x + (rnd() - 0.5) * 10, oy + cell * 0.15, 2.5, hex(0x3a6a20), 1, 1, false, true);
      for (let s = 0; s < 40; s++) {
        const t = s / 40; const y = oy + cell * (0.15 + t * 0.45);
        const w = 4 + t * 10;
        for (const sd of [-1, 1]) im.disc(x + sd * w * (0.5 + rnd() * 0.5), y, 3 + t * 2, mul(col, 0.7 + rnd() * 0.5), 1, 1, false, true);
      }
      for (let l = 0; l < 3; l++) {
        const ly = oy + cell * (0.7 + l * 0.08);
        for (let f = 0; f < 7; f++) { const a = f / 7 * Math.PI - Math.PI; im.stroke(x, ly, x + Math.cos(a) * 22, ly + Math.sin(a) * 8 + 6, 2.5, hex(0x4a7a2a), 1, 1, false, true); }
      }
    }
  };
  lupine(0, 0, hex(0x6a4ac0));
  lupine(cell, 0, hex(0xd070b0));
  const daisy = (ox, oy, petal, center) => {
    for (let k = 0; k < 5; k++) {
      const x = ox + 30 + rnd() * (cell - 60), y = oy + 30 + rnd() * cell * 0.5;
      im.stroke(x, y, x + (rnd() - .5) * 16, oy + cell, 1.6, hex(0x4a7a2a), 1, 1, false, true);
      for (let p = 0; p < 14; p++) { const a = p / 14 * Math.PI * 2; im.stroke(x, y, x + Math.cos(a) * 13, y + Math.sin(a) * 13, 2.6, petal, 1, 1, false, true); }
      im.disc(x, y, 5, center, 1, 1, false, true);
    }
  };
  daisy(0, cell, hex(0xf6f6f0), hex(0xe8c020));
  daisy(cell, cell, hex(0xf0d020), hex(0xc89010));
  im.savePNG('flowers.png');
  log('flowers');
}

// ---------------------------------------------------------------- WATER NORMAL
function waterNormal() {
  const S = 512, im = new Img(S, S);
  im.each((u, v) => {
    const h = fbm2(u * 8, v * 8, 5, 91, 8) * 0.6 + perlin2(u * 24, v * 24, 92, 24) * 0.15 + fbm2(u * 3 + 0.3, v * 3, 3, 93, 3) * 0.4;
    return [0, 0, 0, h];
  });
  im.saveNormal('water_n.jpg', 30);
  log('water');
}

// ---------------------------------------------------------------- FABRIC (70s seat tweed)
function fabric() {
  const S = 256, im = new Img(S, S);
  im.each((u, v, x, y) => {
    const weave = ((x + y) % 4 < 2 ? 1 : 0.85) * ((x - y + 256) % 4 < 2 ? 1 : 0.9);
    const n = fbm2(u * 16, v * 16, 3, 3, 16);
    const check = (Math.floor(u * 8) + Math.floor(v * 8)) % 2;
    let c = check ? hex(0x5a3a26) : hex(0x6e4a30);
    const stripe = Math.floor(v * 32) % 4 === 0 ? 1 : 0;
    c = mix(c, hex(0xa87a3a), stripe * 0.4);
    c = mul(c, weave * (0.9 + n * 0.15));
    return [...c, weave];
  });
  im.saveJPG('fabric.jpg'); im.saveNormal('fabric_n.jpg', 2);
  log('fabric');
}
function vinyl() {
  const S = 256, im = new Img(S, S);
  im.each((u, v) => {
    const w = worley2(u * 40, v * 40, 5, 40);
    const g = 0.12 + w[0] * 0.05;
    return [g, g * 0.95, g * 0.9, w[0]];
  });
  im.saveJPG('vinyl.jpg'); im.saveNormal('vinyl_n.jpg', 2);
  log('vinyl');
}

// ---------------------------------------------------------------- TYRE TREAD (normal + albedo)
function tread() {
  const W = 128, H = 512, im = new Img(W, H);
  im.each((u, v) => {
    const blockV = (v * 24) % 1, blockU = u;
    const zig = Math.abs(((v * 24 + u * 2) % 1) - 0.5);
    let h = 1;
    if (Math.abs(blockU - 0.5) < 0.04) h = 0;
    if (Math.abs(blockU - 0.25) < 0.03 || Math.abs(blockU - 0.75) < 0.03) h = 0;
    if (zig < 0.06 && (blockU < 0.2 || blockU > 0.8)) h = 0;
    if (blockV < 0.08 && blockU > 0.3 && blockU < 0.7) h = 0;
    const g = 0.07 + h * 0.04;
    return [g, g, g, h];
  });
  im.saveJPG('tread.jpg'); im.saveNormal('tread_n.jpg', 3);
  log('tread');
}

// ---------------------------------------------------------------- GRIME / RUST mask for metals
function grime() {
  const S = 512, im = new Img(S, S);
  im.each((u, v) => {
    const n = fbm2(u * 6, v * 6, 6, 101, 6);
    const r = smoothstep(0.2, 0.6, fbm2(u * 4, v * 4, 5, 102, 4));
    const scratch = smoothstep(0.98, 1.0, ridged2(u * 9, v * 2, 3, 103, 9));
    // R = dirt amount, G = rust amount, B = scratches
    return [n * 0.5 + 0.5, r, scratch, n];
  });
  im.saveJPG('grime.jpg');
  log('grime');
}

// ---------------------------------------------------------------- CLOUD / GENERIC NOISE
function noiseTex() {
  const S = 256, im = new Img(S, S);
  im.each((u, v) => {
    const a = fbm2(u * 4, v * 4, 6, 111, 4) * 0.5 + 0.5;
    const b = fbm2(u * 8, v * 8, 5, 112, 8) * 0.5 + 0.5;
    const c = worley2(u * 8, v * 8, 113, 8)[0];
    return [a, b, c];
  });
  im.saveJPG('noise.jpg', 95);
  log('noise');
}

// ---------------------------------------------------------------- CAST METAL (engine block)
function castMetal() {
  const S = 512, im = new Img(S, S);
  im.each((u, v) => {
    const n = fbm2(u * 20, v * 20, 4, 121, 20);
    const pit = perlin2(u * 200, v * 200, 122, 200);
    const g = 0.5 + n * 0.08 + (pit > 0.5 ? -0.1 : 0);
    return [g, g, g * 1.02, n * 0.5 + pit * 0.3];
  });
  im.saveJPG('cast.jpg'); im.saveNormal('cast_n.jpg', 3);
  log('cast');
}

const jobs = { grass, forest, dirt, gravel, asphalt, rock, barkPine, barkSpruce, barkBirch,
  planksRed: () => boards('planks_red', hex(0x9a5a3a), hex(0x5a3020), hex(0x8a2a1e), true, 5),
  planksRaw: () => boards('planks_raw', hex(0xd8b888), hex(0x9a7a50), null, false, 6),
  planksDark: () => boards('planks_dark', hex(0x7a5a3a), hex(0x3a2a1a), null, true, 7),
  planksYellow: () => boards('planks_yellow', hex(0xc8a050), hex(0x806030), hex(0xd8b850), false, 8),
  concrete, roof, shingles, spruceBranch, pineTuft, birchLeaves, grassCard, flowers, waterNormal,
  fabric, vinyl, tread, grime, noiseTex, castMetal };

const only = process.argv.slice(2);
for (const [k, fn] of Object.entries(jobs)) if (!only.length || only.includes(k)) fn();
log('done');
