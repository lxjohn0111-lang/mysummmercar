import * as THREE from 'three';

// ------------------------------------------------------------------------------------------------
// Procedural car body generator.
// A body is an analytic surface S(z, t): z runs along the car (+z = front), t runs around the
// half cross-section from the rocker (t=0) up the side, over the shoulder, the glass band and the
// roof edge to the centre line (t=1). Profiles are smooth monotone curves of z. The surface is cut
// into parameter-space patches (panels, glass, pillars) that are tessellated independently, so
// panel and window edges are exact and normals stay smooth across them.
// Local frame: +z forward, +y up (y=0 at the ground), +x = left side.
// ------------------------------------------------------------------------------------------------

export function mono(pts) {
  const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] > x) hi = mid; else lo = mid; }
    const h = xs[hi] - xs[lo], t = (x - xs[lo]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h * m[lo] + (-2 * t3 + 3 * t2) * ys[hi] + (t3 - t2) * h * m[hi];
  };
}

const T_ROCK = 0.07, T_BELT = 0.5;

export class BodyGen {
  constructor(spec) {
    this.spec = spec;
    this.f = {};
    for (const k of ['sill', 'belt', 'top', 'hw', 'ghw', 'crown']) this.f[k] = mono(spec[k]);
    this.tG0 = spec.tG0 ?? 0.6; this.tG1 = spec.tG1 ?? 0.8; this.tW = spec.tW ?? 0.835;
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._c = new THREE.Vector3(); this._d = new THREE.Vector3();
  }

  archY(z) {
    let y = -1;
    for (const a of this.spec.arches) { const dz = z - a.z; if (Math.abs(dz) < a.r) y = Math.max(y, a.y + Math.sqrt(a.r * a.r - dz * dz)); }
    return y;
  }

  // Surface point on the x >= 0 half.
  S(z, t, o = new THREE.Vector3()) {
    const sp = this.spec, f = this.f;
    const sill = f.sill(z), belt = f.belt(z), top = Math.max(f.top(z), belt + 0.006), hw = f.hw(z);
    const shW = sp.shoulder.w;
    const ghw = Math.min(f.ghw(z), hw - shW - 0.012);
    const rb = sp.rocker;
    const ay = this.archY(z);
    const inArch = ay > sill + rb;
    const sideBot = inArch ? ay : sill + rb;
    const hAvail = top - belt;
    const shH = Math.min(sp.shoulder.h, hAvail * 0.45);
    const rr = Math.max(0.004, Math.min(sp.roofR, (hAvail - shH) * 0.5, ghw * 0.3));
    const crown = f.crown(z);
    if (t < T_ROCK) {
      if (inArch) return o.set(hw, sideBot, z);
      const a = -Math.PI / 2 + (t / T_ROCK) * Math.PI / 2;
      return o.set(hw - rb + Math.cos(a) * rb, sill + rb + Math.sin(a) * rb, z);
    }
    const sideX = (y) => {
      const s = Math.min(1, Math.max(0, (y - sill) / Math.max(0.05, belt - sill)));
      const c = sp.crease ? sp.crease.amp * Math.exp(-(((s - sp.crease.s) / 0.035) ** 2)) : 0;
      return hw - sp.tumble.under * (1 - s) * (1 - s) - sp.tumble.top * s * s * s + c;
    };
    if (t < T_BELT) {
      const k = (t - T_ROCK) / (T_BELT - T_ROCK);
      const y = sideBot + (belt - sideBot) * k;
      return o.set(sideX(y), y, z);
    }
    const x1 = sideX(belt);
    if (t < this.tG0) {
      const k = (t - T_BELT) / (this.tG0 - T_BELT), a = k * Math.PI / 2;
      return o.set(x1 - shW * (1 - Math.cos(a)), belt + shH * Math.sin(a), z);
    }
    const x2 = x1 - shW, y2 = belt + shH;
    const tE = this.tG1 + (this.tW - this.tG1) * 0.5; // roof-edge arc starts mid drip band
    if (t < tE) {
      const k = (t - this.tG0) / (tE - this.tG0);
      const bow = (sp.glassBow ?? 0.012) * Math.sin(Math.PI * k) * Math.min(1, hAvail * 3);
      return o.set(x2 + (ghw - x2) * k + bow, y2 + (top - rr - y2) * k, z);
    }
    const tC = this.tW + 0.045;
    if (t < tC) {
      const k = (t - tE) / (tC - tE), a = k * Math.PI / 2;
      return o.set(ghw - rr + Math.cos(a) * rr, top - rr + Math.sin(a) * rr, z);
    }
    const xe = ghw - rr, k = (t - tC) / (1 - tC);
    return o.set(xe * (1 - k), top + crown * (1 - (1 - k) * (1 - k)), z);
  }

  normal(z, t, o = new THREE.Vector3()) {
    const a = this._a, b = this._b, c = this._c, d = this._d;
    const ez = 0.006;
    this.S(Math.min(this.spec.zMax, z + ez), t, a); this.S(Math.max(this.spec.zMin, z - ez), t, b);
    const dz = a.sub(b);
    let step = 0.003, dt = null;
    for (let i = 0; i < 40; i++) {
      this.S(z, Math.min(1, t + step), c); this.S(z, Math.max(0, t - step), d);
      if (c.distanceTo(d) > 0.004) { dt = c.sub(d); break; }
      step *= 1.6;
    }
    if (!dt) return o.set(0, 1, 0);
    o.crossVectors(dt, dz);
    if (o.lengthSq() < 1e-12) return o.set(0, 1, 0);
    return o.normalize();
  }
}

// ------------------------------------------------------------------------------------------------
// Patch tessellation
// ------------------------------------------------------------------------------------------------
class GeoAccum {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.seam = []; this.idx = []; }
  get count() { return this.pos.length / 3; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aBody', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aSeam', new THREE.Float32BufferAttribute(this.seam, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

function addPatch(gen, acc, quad, seams, res, side, offset = 0) {
  // quad: [[z,t] u0v0, u1v0, u1v1, u0v1]
  const P = (u, v) => {
    const z = (1 - u) * (1 - v) * quad[0][0] + u * (1 - v) * quad[1][0] + u * v * quad[2][0] + (1 - u) * v * quad[3][0];
    const t = (1 - u) * (1 - v) * quad[0][1] + u * (1 - v) * quad[1][1] + u * v * quad[2][1] + (1 - u) * v * quad[3][1];
    return [z, t];
  };
  // estimate edge lengths
  const len = (a, b) => { let L = 0, prev = gen.S(...P(...a)); for (let i = 1; i <= 8; i++) { const k = i / 8; const p = gen.S(...P(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k)); L += p.distanceTo(prev); prev = p; } return L; };
  const lu = Math.max(len([0, 0], [1, 0]), len([0, 1], [1, 1])), lv = Math.max(len([0, 0], [0, 1]), len([1, 0], [1, 1]));
  if (lu < 1e-4 && lv < 1e-4) return;
  const nu = Math.max(1, Math.min(160, Math.ceil(lu / res))), nv = Math.max(1, Math.min(80, Math.ceil(lv / res)));
  const base = acc.count;
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const [z, t] = P(i / nu, j / nv);
    gen.S(z, t, p); gen.normal(z, t, n);
    if (offset) p.addScaledVector(n, offset);
    acc.pos.push(p.x * side, p.y, p.z);
    acc.nor.push(n.x * side, n.y, n.z);
    acc.uv.push(z, p.y);
    // seam distance in metres (patch edges flagged as panel seams)
    let sd = 1;
    if (seams) {
      const du = i / nu * lu, dv = j / nv * lv;
      if (seams[0]) sd = Math.min(sd, dv); if (seams[2]) sd = Math.min(sd, lv - dv);
      if (seams[3]) sd = Math.min(sd, du); if (seams[1]) sd = Math.min(sd, lu - du);
    }
    acc.seam.push(sd);
  }
  // orientation check against the analytic normal, accumulated over the whole patch
  let vote = 0;
  const a0 = new THREE.Vector3(), a1 = new THREE.Vector3(), a2 = new THREE.Vector3(), an = new THREE.Vector3(), gn = new THREE.Vector3(), e1 = new THREE.Vector3();
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = base + j * (nu + 1) + i;
    a0.fromArray(acc.pos, a * 3); a1.fromArray(acc.pos, (a + 1) * 3); a2.fromArray(acc.pos, (a + nu + 1) * 3);
    gn.subVectors(a1, a0).cross(e1.subVectors(a2, a0));
    an.fromArray(acc.nor, a * 3);
    vote += gn.dot(an);
  }
  const flip = vote < 0;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    if (!flip) acc.idx.push(a, b, c, b, d, c); else acc.idx.push(a, c, b, b, c, d);
  }
}

// sample a param-space polyline, offset along the normal, return world points (x>=0 side)
export function trimPath(gen, pts, steps, offset, side = 1) {
  const out = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let s = 0; s < pts.length - 1; s++) {
    const [z0, t0] = pts[s], [z1, t1] = pts[s + 1];
    const k0 = s === 0 ? 0 : 1;
    for (let i = k0; i <= steps; i++) {
      const k = i / steps, z = z0 + (z1 - z0) * k, t = t0 + (t1 - t0) * k;
      gen.S(z, t, p); gen.normal(z, t, n);
      out.push(new THREE.Vector3(p.x * side + n.x * side * offset, p.y + n.y * offset, p.z + n.z * offset));
    }
  }
  return out;
}

let TUBE_Q = 1;
export function tubeGeo(points, r, radial = 6, closed = false) {
  if (points.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.TubeGeometry(curve, Math.max(4, Math.round(points.length * 1.5 * TUBE_Q)), r, TUBE_Q < 1 ? 4 : radial, closed);
}

// Flat-ish cap that closes the body at z = zEnd
function capGeo(gen, zEnd, dir, res, bulge = 0.02) {
  const pts = [];
  const p = new THREE.Vector3();
  const N = 60;
  for (let i = 0; i <= N; i++) { gen.S(zEnd, i / N, p); pts.push([p.x, p.y]); }
  // full ring: right side (x>=0) bottom->top, then mirrored top->bottom
  const ring = [...pts.map(([x, y]) => [x, y]), ...pts.slice(0, -1).reverse().map(([x, y]) => [-x, y])];
  ring.push(ring[0]);
  const sill = gen.f.sill(zEnd);
  const cy = (sill + pts[N][1]) / 2;
  const hw = gen.f.hw(zEnd);
  const pos = [], nor = [], uv = [], seam = [], idx = [];
  const rings = Math.max(4, Math.ceil(0.4 / res));
  for (let r = 0; r <= rings; r++) {
    const k = r / rings;
    for (const [x, y] of ring) {
      const px = x * k, py = cy + (y - cy) * k;
      const bz = bulge * (1 - (px / hw) ** 2) * (1 - k * k * 0.3);
      pos.push(px, py, zEnd + dir * bz); nor.push(0, 0, dir); uv.push(zEnd, py); seam.push(1);
    }
  }
  const R = ring.length;
  for (let r = 0; r < rings; r++) for (let i = 0; i < R - 1; i++) {
    const a = r * R + i, b = a + 1, c = a + R, d = c + 1;
    if (dir > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aBody', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aSeam', new THREE.Float32BufferAttribute(seam, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  // blend computed normals toward the cap direction for a crisp look
  const nn = g.attributes.normal;
  for (let i = 0; i < nn.count; i++) { const v = new THREE.Vector3(nn.getX(i), nn.getY(i), nn.getZ(i) + dir * 2).normalize(); nn.setXYZ(i, v.x, v.y, v.z); }
  return g;
}

// ------------------------------------------------------------------------------------------------
// Build all body geometry for a spec
// ------------------------------------------------------------------------------------------------
export function buildBody(spec, { res = 0.03, panels = false, detail = 1 } = {}) {
  const gen = new BodyGen(spec);
  const L = spec.layout;
  const tG0 = gen.tG0, tG1 = gen.tG1, tW = gen.tW;
  const groups = {}; // role -> GeoAccum
  const acc = (role) => (groups[role] ||= new GeoAccum());
  const pAcc = {}; // panel name -> GeoAccum (per side already named)
  const pnl = (name) => (pAcc[name] ||= new GeoAccum());
  const rect = (z0, z1, t0, t1) => [[z0, t0], [z1, t0], [z1, t1], [z0, t1]];
  const zMin = spec.zMin, zMax = spec.zMax;
  const S = (role, quad, seams, side, sideName) => {
    if (panels && sideName) addPatch(gen, pnl(sideName), quad, seams, res, side);
    else addPatch(gen, acc(role), quad, seams, res, side);
  };
  for (const side of [1, -1]) {
    const sfx = side > 0 ? 'L' : 'R';
    // ---- lower side (rocker + side panels), split by fender / doors / quarters
    const cuts = [zMin];
    if (L.fender) cuts.push(L.fender[0]);
    for (const d of L.doors) cuts.push(d[0], d[1]);
    cuts.push(zMax);
    const uniq = [...new Set(cuts)].sort((a, b) => a - b);
    // rocker strip under everything
    S('paint', rect(zMin, zMax, 0, T_ROCK), null, side);
    for (let i = 0; i < uniq.length - 1; i++) {
      const z0 = uniq[i], z1 = uniq[i + 1];
      if (z1 - z0 < 1e-4) continue;
      const di = L.doors.findIndex((d) => Math.abs(d[0] - z0) < 1e-4 && Math.abs(d[1] - z1) < 1e-4);
      const isFender = L.fender && Math.abs(L.fender[0] - z0) < 1e-4;
      const gap = 0.0;
      if (di >= 0) S('paint', rect(z0 + gap, z1 - gap, T_ROCK, tG0), [true, true, true, true], side, di === 0 && L.doorParts ? 'door' + sfx : null);
      else if (isFender) S('paint', rect(z0, z1, T_ROCK, tG0), [true, false, !!L.hood, true], side, L.fenderParts ? 'fender' + sfx : null);
      else {
        const nextIsDoor = L.doors.some((d) => Math.abs(d[0] - z1) < 1e-4), prevIsDoor = L.doors.some((d) => Math.abs(d[1] - z0) < 1e-4);
        S('paint', rect(z0, z1, T_ROCK, tG0), [false, nextIsDoor || (L.fender && Math.abs(L.fender[0] - z1) < 1e-4), false, prevIsDoor], side);
      }
    }
    // ---- glass band & pillars in the cabin zone
    const zCF = L.cabin[1], zCR = L.cabin[0];
    const wins = L.windows;
    let prevB = zCF, prevT = zCF;
    wins.forEach((w, i) => {
      S('paint', [[prevB, tG0], [w.fb, tG0], [w.ft, tG1], [prevT, tG1]], null, side);
      S('glass', [[w.fb, tG0], [w.rb, tG0], [w.rt, tG1], [w.ft, tG1]], null, side);
      prevB = w.rb; prevT = w.rt;
    });
    S('paint', [[prevB, tG0], [zCR, tG0], [zCR, tG1], [prevT, tG1]], null, side);
    // drip/roof-edge band
    S('paint', rect(zCR, zCF, tG1, tW), null, side);
    // ---- top: front of cabin (hood, cowl), windshield, roof, rear window, deck, trunk
    if (L.hood) {
      S('paint', rect(L.hood[0], L.hood[1], tG0, 1), [true, true, false, true], side, L.hoodPart ? 'hood' : null);
      if (L.hood[1] < zMax) S('paint', rect(L.hood[1], zMax, tG0, 1), null, side);
    } else if (zCF < zMax) S('paint', rect(zCF, zMax, tG0, 1), null, side);
    if (L.cowl) S('paint', rect(L.cowl[0], L.cowl[1], tG0, 1), null, side);
    const framed = (z0, z1) => {
      // glass with a painted frame around it (no paint underneath, so you can see into the cabin)
      S('paint', rect(z0, z1, tW, tW + 0.008), null, side);
      S('paint', rect(z0, z0 + 0.012, tW + 0.008, 1), null, side);
      S('paint', rect(z1 - 0.012, z1, tW + 0.008, 1), null, side);
      addPatch(gen, acc('glass'), rect(z0 + 0.012, z1 - 0.012, tW + 0.008, 1), null, res, side);
    };
    const ws = L.windshield;
    framed(ws[0], ws[1]);
    if (L.roof) S('paint', rect(L.roof[0], L.roof[1], tW, 1), null, side);
    if (L.rearWindow) framed(L.rearWindow[0], L.rearWindow[1]);
    if (L.deck) S('paint', rect(L.deck[0], L.deck[1], tW, 1), null, side);
    if (L.trunk) {
      S('paint', rect(L.trunk[0], L.trunk[1], tG0, 1), [true, true, false, true], side, L.trunkPart ? 'trunk' : null);
      if (L.trunk[0] > zMin) S('paint', rect(zMin, L.trunk[0], tG0, 1), null, side);
    } else if (!L.deck && zCR > zMin) S('paint', rect(zMin, zCR, tG0, 1), null, side);
  }
  // caps
  const out = { gen, groups: {}, panels: {}, trims: {}, extras: {} };
  out.capFront = capGeo(gen, zMax, 1, res * 1.5, spec.capBulge ?? 0.025);
  out.capRear = capGeo(gen, zMin, -1, res * 1.5, spec.capBulge ?? 0.02);
  for (const [k, a] of Object.entries(groups)) out.groups[k] = a.build();
  for (const [k, a] of Object.entries(pAcc)) out.panels[k] = a.build();
  // underbody & wheel wells
  out.under = underbody(gen);
  out.wells = wheelWells(gen);
  // trims
  TUBE_Q = detail;
  out.trims = buildTrims(gen, spec, detail);
  TUBE_Q = 1;
  return out;
}

function underbody(gen) {
  const sp = gen.spec;
  const pos = [], idx = [];
  const NZ = 40;
  for (let i = 0; i <= NZ; i++) {
    const z = sp.zMin + 0.05 + (sp.zMax - sp.zMin - 0.1) * i / NZ;
    const y = gen.f.sill(z) + 0.012;
    const w = Math.min(gen.f.hw(z) - sp.rocker * 0.6, 0.6);
    pos.push(-w, y, z, w, y, z);
  }
  for (let i = 0; i < NZ; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function wheelWells(gen) {
  const sp = gen.spec, pos = [], idx = [];
  const N = 28;
  for (const a of sp.arches) for (const side of [1, -1]) {
    const hw = gen.f.hw(a.z), r = a.r - 0.006;
    const xo = side * (hw - 0.006), xi = side * (hw - 0.25);
    const b = pos.length / 3;
    for (let i = 0; i <= N; i++) {
      const th = -0.12 * Math.PI + (1.24 * Math.PI) * i / N;
      const y = a.y + Math.sin(th) * r, z = a.z + Math.cos(th) * r;
      pos.push(xo, y, z, xi, y, z);
    }
    for (let i = 0; i < N; i++) { const k = b + i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    // inner closing wall (half disc)
    const c = pos.length / 3;
    pos.push(xi, a.y, a.z);
    for (let i = 0; i <= N; i++) { const th = -0.12 * Math.PI + (1.24 * Math.PI) * i / N; pos.push(xi, a.y + Math.sin(th) * r, a.z + Math.cos(th) * r); }
    for (let i = 0; i < N; i++) idx.push(c, c + 1 + i, c + 2 + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return [g];
}

function buildTrims(gen, spec, detail) {
  const L = spec.layout, tG0 = gen.tG0, tG1 = gen.tG1, tW = gen.tW;
  const chrome = [], rubber = [], black = [], amber = [];
  for (const side of [1, -1]) {
    // window surrounds
    for (const w of L.windows) {
      const pts = trimPath(gen, [[w.fb, tG0], [w.rb, tG0], [w.rt, tG1], [w.ft, tG1], [w.fb, tG0]], Math.round(16 * detail), 0.002, side);
      const g = tubeGeo(pts, L.windowTrim ?? 0.007, 6, false); if (g) (L.blackTrim ? black : chrome).push(g);
    }
    // windshield & rear window rubber/chrome surrounds
    const ws = L.windshield;
    const wsp = trimPath(gen, [[ws[0] + 0.012, tW + 0.008], [ws[1] - 0.012, tW + 0.008], [ws[1] - 0.012, 1]], 22, 0.002, side);
    const wsTop = trimPath(gen, [[ws[0] + 0.012, 1], [ws[0] + 0.012, tW + 0.008]], 10, 0.002, side);
    for (const pts of [wsp, wsTop]) { const g = tubeGeo(pts, 0.008, 6); if (g) chrome.push(g); }
    if (L.rearWindow) {
      const rw = L.rearWindow;
      const p1 = trimPath(gen, [[rw[0] + 0.012, 1], [rw[0] + 0.012, tW + 0.008], [rw[1] - 0.012, tW + 0.008], [rw[1] - 0.012, 1]], 16, 0.002, side);
      const g = tubeGeo(p1, 0.008, 6); if (g) chrome.push(g);
    }
    // drip rail along the roof edge
    const dz0 = L.windows[0].ft + 0.02, dz1 = L.windows[L.windows.length - 1].rt - 0.05;
    const drip = trimPath(gen, [[dz1, (tG1 + tW) / 2], [dz0, (tG1 + tW) / 2]], 30, 0.006, side);
    { const g = tubeGeo(drip, 0.006, 5); if (g) chrome.push(g); }
    // body side moulding
    if (L.moulding !== false) {
      const tm = L.mouldingT ?? 0.43;
      const pts = trimPath(gen, [[spec.zMin + 0.12, tm], [spec.zMax - 0.12, tm]], Math.round(50 * detail), 0.004, side);
      const g = tubeGeo(pts, 0.0075, 5); if (g) (L.blackMoulding ? black : chrome).push(g);
    }
    // arch lips
    for (const a of spec.arches) {
      const pts = [];
      for (let i = 0; i <= 26; i++) { const z = a.z - a.r * 0.995 + (a.r * 1.99) * i / 26; pts.push([z, T_ROCK + 0.004]); }
      const pp = trimPath(gen, pts, 1, 0.006, side);
      const g = tubeGeo(pp, 0.011, 5); if (g) black.push(g);
    }
    // door handles
    for (const d of L.doors.slice(0, L.handles ?? 1)) {
      const p = gen.S(d[0] + 0.14, 0.455), n = gen.normal(d[0] + 0.14, 0.455);
      const g = new THREE.CapsuleGeometry(0.011, 0.1, 3, 6); g.rotateX(Math.PI / 2);
      g.translate(p.x * side + n.x * side * 0.012, p.y + n.y * 0.012, p.z);
      chrome.push(g);
    }
    // side indicator on front fender
    if (L.fender) {
      const z = spec.zMax - 0.28, t = 0.32;
      const p = gen.S(z, t), n = gen.normal(z, t);
      const g = new THREE.SphereGeometry(0.035, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.55, 1.4); g.rotateZ(-side * Math.PI / 2);
      g.translate(p.x * side + n.x * side * 0.002, p.y, p.z);
      amber.push(g);
    }
  }
  const merge = (arr) => arr.length ? mergeSimple(arr) : null;
  return { chrome: merge(chrome), rubber: merge(rubber), black: merge(black), amber: merge(amber) };
}

export function mergeSimple(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of parts) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

// ------------------------------------------------------------------------------------------------
// Materials
// ------------------------------------------------------------------------------------------------
export function paintMaterial(color, { metal = 0.35, rough = 0.38, stripe = null } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color, metalness: metal, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide, envMapIntensity: 1.2 });
  setupPaint(m, stripe);
  return m;
}
export function setupPaint(m, stripe = null) {
  const u = { uStripe: { value: new THREE.Vector4(stripe ? stripe.y0 : -9, stripe ? stripe.y1 : -9, 0, 0) }, uStripeCol: { value: new THREE.Color(stripe ? stripe.color : 0) }, uDirt: { value: 0.35 } };
  m.userData.paintU = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSeam;\nattribute vec2 aBody;\nvarying float vSeam;\nvarying vec2 vBody;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeam = aSeam; vBody = aBody;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSeam;\nvarying vec2 vBody;\nuniform vec4 uStripe; uniform vec3 uStripeCol; uniform float uDirt;\nfloat bh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vBody.y > uStripe.x && vBody.y < uStripe.y) diffuseColor.rgb = uStripeCol;
        float seam = 1.0 - smoothstep(0.0012, 0.0032, vSeam);
        diffuseColor.rgb *= 1.0 - seam * 0.9;
        // road grime on the lower body
        float gr = smoothstep(0.62, 0.22, vBody.y) * uDirt;
        float nz = bh(floor(vec2(vBody.x * 40.0, vBody.y * 60.0)));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.27, 0.2) * (0.8 + 0.3 * nz), gr * 0.55);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.9, smoothstep(0.62, 0.22, vBody.y) * uDirt * 0.8 + (1.0 - smoothstep(0.0012, 0.0032, vSeam)));`)

  };
  m.customProgramCacheKey = () => 'carpaint';
  return m;
}

let _shared = null;
export function bodyMats() {
  if (_shared) return _shared;
  _shared = {
    glass: new THREE.MeshPhysicalMaterial({ color: 0x8fa8b0, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0 }),
    darkGlass: new THREE.MeshPhysicalMaterial({ color: 0x223036, metalness: 0.2, roughness: 0.04, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.5 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xf0f2f4, metalness: 1, roughness: 0.07, envMapIntensity: 1.4 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0e0f10, metalness: 0.1, roughness: 0.55 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0, roughness: 0.85 }),
    under: new THREE.MeshStandardMaterial({ color: 0x1a1814, metalness: 0.2, roughness: 0.95, side: THREE.DoubleSide }),
    amber: new THREE.MeshPhysicalMaterial({ color: 0xff8a10, emissive: 0x401800, roughness: 0.15, transparent: true, opacity: 0.9, clearcoat: 1 }),
  };
  return _shared;
}

// ------------------------------------------------------------------------------------------------
// Original vehicle designs (specs)
// ------------------------------------------------------------------------------------------------
export const SPECS = {
  // Ruska 1300: early-70s two-door fastback coupé
  ruska: {
    zMin: -2.07, zMax: 2.07,
    sill: [[-2.07, 0.4], [-1.95, 0.33], [-1.62, 0.262], [-0.9, 0.235], [0.9, 0.235], [1.62, 0.262], [1.95, 0.32], [2.07, 0.37]],
    belt: [[-2.07, 0.8], [-1.95, 0.855], [-1.5, 0.872], [-1.0, 0.868], [0, 0.855], [0.9, 0.84], [1.3, 0.802], [1.8, 0.767], [2.0, 0.748], [2.07, 0.725]],
    top: [[-2.07, 0.86], [-2.0, 0.905], [-1.7, 0.922], [-1.42, 0.93], [-1.3, 0.955], [-0.9, 1.13], [-0.55, 1.255], [-0.3, 1.282], [0.15, 1.282], [0.33, 1.255], [0.6, 1.08], [0.88, 0.877], [1.0, 0.862], [1.5, 0.832], [1.85, 0.801], [2.0, 0.778], [2.07, 0.752]],
    hw: [[-2.07, 0.72], [-1.95, 0.785], [-1.6, 0.815], [-1.2, 0.83], [-0.8, 0.822], [0, 0.82], [0.8, 0.818], [1.22, 0.822], [1.7, 0.8], [1.95, 0.765], [2.07, 0.72]],
    ghw: [[-2.07, 0.9], [-1.45, 0.9], [-1.3, 0.7], [-1.0, 0.635], [-0.55, 0.605], [0.33, 0.605], [0.75, 0.66], [0.95, 0.9], [2.07, 0.9]],
    crown: [[-2.07, 0.02], [-1.4, 0.025], [-0.55, 0.035], [0.33, 0.035], [0.9, 0.03], [2.07, 0.028]],
    arches: [{ z: 1.22, y: 0.31, r: 0.37 }, { z: -1.2, y: 0.31, r: 0.37 }],
    rocker: 0.045, shoulder: { w: 0.045, h: 0.03 }, roofR: 0.075, tumble: { under: 0.03, top: 0.012 }, crease: { s: 0.72, amp: 0.006 },
    layout: {
      cabin: [-1.38, 0.88], hood: [0.96, 2.05], cowl: [0.88, 0.96], windshield: [0.33, 0.88], roof: [-0.55, 0.33], rearWindow: [-1.3, -0.55], deck: [-1.38, -1.3], trunk: [-2.05, -1.38],
      windows: [{ fb: 0.8, ft: 0.36, rt: -0.45, rb: -1.0 }],
      doors: [[-0.49, 0.915]], fender: [0.935, 2.07],
      doorParts: true, fenderParts: true, hoodPart: true, trunkPart: true, mouldingT: 0.44,
    },
  },
  // 80s four-door saloon
  sedan: {
    zMin: -2.25, zMax: 2.25,
    sill: [[-2.25, 0.42], [-2.1, 0.34], [-1.7, 0.275], [1.7, 0.275], [2.1, 0.33], [2.25, 0.4]],
    belt: [[-2.25, 0.86], [-2.1, 0.9], [-1.0, 0.905], [0, 0.9], [0.9, 0.882], [1.4, 0.842], [2.1, 0.8], [2.25, 0.765]],
    top: [[-2.25, 0.93], [-2.15, 0.965], [-1.55, 0.975], [-1.36, 1.0], [-0.95, 1.36], [-0.62, 1.395], [0.5, 1.395], [0.76, 1.335], [1.25, 0.932], [1.4, 0.912], [2.0, 0.862], [2.25, 0.81]],
    hw: [[-2.25, 0.79], [-2.1, 0.845], [-1.5, 0.862], [0, 0.865], [1.5, 0.862], [2.1, 0.84], [2.25, 0.79]],
    ghw: [[-2.25, 0.95], [-1.5, 0.95], [-1.35, 0.73], [-0.95, 0.705], [0.5, 0.705], [1.2, 0.77], [1.35, 0.95], [2.25, 0.95]],
    crown: [[-2.25, 0.02], [-0.9, 0.028], [0.6, 0.028], [2.25, 0.022]],
    arches: [{ z: 1.38, y: 0.32, r: 0.365 }, { z: -1.22, y: 0.32, r: 0.365 }],
    rocker: 0.04, shoulder: { w: 0.03, h: 0.02 }, roofR: 0.06, tumble: { under: 0.02, top: 0.008 }, crease: { s: 0.68, amp: 0.005 },
    layout: {
      cabin: [-1.43, 1.25], hood: [1.32, 2.23], cowl: [1.25, 1.32], windshield: [0.76, 1.25], roof: [-0.95, 0.76], rearWindow: [-1.36, -0.95], deck: [-1.43, -1.36], trunk: [-2.23, -1.43],
      windows: [{ fb: 1.18, ft: 0.78, rt: 0.04, rb: 0.04 }, { fb: -0.04, ft: -0.04, rt: -0.84, rb: -0.86 }],
      doors: [[0.0, 1.26], [-0.86, -0.01]], fender: [1.28, 2.25], handles: 2, mouldingT: 0.4, blackMoulding: true, blackTrim: true, windowTrim: 0.009,
    },
  },
  wagon: {
    zMin: -2.33, zMax: 2.25,
    sill: [[-2.33, 0.42], [-2.15, 0.34], [-1.75, 0.275], [1.7, 0.275], [2.1, 0.33], [2.25, 0.4]],
    belt: [[-2.33, 0.88], [-2.2, 0.905], [-1.0, 0.905], [0, 0.9], [0.9, 0.882], [1.4, 0.842], [2.1, 0.8], [2.25, 0.765]],
    top: [[-2.33, 1.3], [-2.22, 1.37], [-1.6, 1.395], [0.5, 1.395], [0.76, 1.335], [1.25, 0.932], [1.4, 0.912], [2.0, 0.862], [2.25, 0.81]],
    hw: [[-2.33, 0.8], [-2.15, 0.85], [-1.5, 0.862], [0, 0.865], [1.5, 0.862], [2.1, 0.84], [2.25, 0.79]],
    ghw: [[-2.33, 0.74], [-1.5, 0.72], [0.5, 0.705], [1.2, 0.77], [1.35, 0.95], [2.25, 0.95]],
    crown: [[-2.33, 0.02], [0.6, 0.028], [2.25, 0.022]],
    arches: [{ z: 1.38, y: 0.32, r: 0.365 }, { z: -1.25, y: 0.32, r: 0.365 }],
    rocker: 0.04, shoulder: { w: 0.03, h: 0.02 }, roofR: 0.06, tumble: { under: 0.02, top: 0.008 }, crease: { s: 0.68, amp: 0.005 },
    rearGlass: { y0: 0.98, y1: 1.3, w: 0.64 },
    layout: {
      cabin: [-2.33, 1.25], hood: [1.32, 2.23], cowl: [1.25, 1.32], windshield: [0.76, 1.25], roof: [-2.33, 0.76],
      windows: [{ fb: 1.18, ft: 0.78, rt: 0.04, rb: 0.04 }, { fb: -0.04, ft: -0.04, rt: -0.84, rb: -0.86 }, { fb: -0.96, ft: -0.96, rt: -2.12, rb: -2.1 }],
      doors: [[0.0, 1.26], [-0.86, -0.01]], fender: [1.28, 2.25], handles: 2, mouldingT: 0.4, blackMoulding: true, blackTrim: true, windowTrim: 0.009,
    },
  },
  // Kuormuri: 70s panel van with a short bonnet
  van: {
    zMin: -2.35, zMax: 2.35,
    sill: [[-2.35, 0.47], [-2.2, 0.41], [-1.95, 0.35], [1.9, 0.35], [2.2, 0.43], [2.35, 0.5]],
    belt: [[-2.35, 1.0], [-2.2, 1.06], [0.5, 1.075], [1.3, 1.06], [1.85, 1.0], [2.35, 0.95]],
    top: [[-2.35, 2.04], [-2.25, 2.12], [-1.5, 2.145], [0.95, 2.145], [1.22, 2.02], [1.74, 1.24], [1.95, 1.12], [2.35, 1.03]],
    hw: [[-2.35, 0.86], [-2.2, 0.905], [2.1, 0.905], [2.35, 0.84]],
    ghw: [[-2.35, 0.8], [1.15, 0.8], [1.6, 0.86], [1.85, 1.0], [2.35, 1.0]],
    crown: [[-2.35, 0.03], [1.2, 0.03], [2.35, 0.03]],
    arches: [{ z: 1.5, y: 0.34, r: 0.405 }, { z: -1.5, y: 0.34, r: 0.405 }],
    rocker: 0.05, shoulder: { w: 0.025, h: 0.02 }, roofR: 0.13, tumble: { under: 0.025, top: 0.004 }, crease: { s: 0.5, amp: 0.006 }, glassBow: 0.004,
    rearGlass: { y0: 1.45, y1: 1.95, w: 0.7, split: true },
    layout: {
      cabin: [-2.35, 1.75], hood: [1.82, 2.33], cowl: [1.75, 1.82], windshield: [1.2, 1.75], roof: [-2.35, 1.2],
      windows: [{ fb: 1.7, ft: 1.22, rt: 0.62, rb: 0.62 }],
      doors: [[0.62, 1.72], [-0.75, 0.52]], fender: [1.74, 2.35], handles: 2, mouldingT: 0.36, windowTrim: 0.009,
    },
  },
};
