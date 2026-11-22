// Deterministic noise utilities shared by the runtime and the build-time texture generator.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

export function hash3(x, y, z, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + z * 1440662683 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

// Gradient noise in 2D, optionally periodic (period in lattice units) for tileable textures.
function grad(ix, iy, seed, x, y) {
  const a = hash2(ix, iy, seed) * Math.PI * 2;
  return Math.cos(a) * x + Math.sin(a) * y;
}

export function perlin2(x, y, seed = 0, period = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  let ix0 = x0, iy0 = y0, ix1 = x0 + 1, iy1 = y0 + 1;
  if (period > 0) {
    ix0 = ((ix0 % period) + period) % period; ix1 = ((ix1 % period) + period) % period;
    iy0 = ((iy0 % period) + period) % period; iy1 = ((iy1 % period) + period) % period;
  }
  const n00 = grad(ix0, iy0, seed, fx, fy);
  const n10 = grad(ix1, iy0, seed, fx - 1, fy);
  const n01 = grad(ix0, iy1, seed, fx, fy - 1);
  const n11 = grad(ix1, iy1, seed, fx - 1, fy - 1);
  const u = fade(fx), v = fade(fy);
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 1.4142;
}

export function fbm2(x, y, octaves = 5, seed = 0, period = 0, lac = 2, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * perlin2(x * freq, y * freq, seed + i * 17, period ? period * freq : 0);
    norm += amp; amp *= gain; freq *= lac;
  }
  return sum / norm;
}

export function ridged2(x, y, octaves = 5, seed = 0, period = 0) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(perlin2(x * freq, y * freq, seed + i * 31, period ? period * freq : 0));
    sum += amp * n * n; norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

// Cellular noise; returns [F1, F2, cellHash] (periodic when period > 0)
export function worley2(x, y, seed = 0, period = 0, jitter = 1) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 1e9, f2 = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      let cx = xi + i, cy = yi + j;
      let hx = cx, hy = cy;
      if (period > 0) { hx = ((cx % period) + period) % period; hy = ((cy % period) + period) % period; }
      const px = cx + 0.5 + (hash2(hx, hy, seed) - 0.5) * jitter;
      const py = cy + 0.5 + (hash2(hx, hy, seed + 101) - 0.5) * jitter;
      const dx = px - x, dy = py - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; id = hash2(hx, hy, seed + 7); }
      else if (d < f2) f2 = d;
    }
  }
  return [f1, f2, id];
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
