import * as THREE from 'three';
import { smooth, clamp, lerp } from '../core/util.js';

// Parametric body for the original "Ruska 1300" coupé.
// Local frame: +z forward, +y up (y=0 at ground), +x = left side (driver side).
const L0 = -2.05, L1 = 2.05; // rear, front z
const pts = (arr) => arr.map(([z, v]) => ({ z, v }));
function interp(table, z) {
  if (z <= table[0].z) return table[0].v;
  for (let i = 1; i < table.length; i++) if (z <= table[i].z) {
    const a = table[i - 1], b = table[i]; const t = (z - a.z) / (b.z - a.z);
    return lerp(a.v, b.v, smooth(t));
  }
  return table[table.length - 1].v;
}
// profiles (sorted by z ascending: rear -> front)
const TOP = pts([[-2.06, 0.62], [-2.02, 0.84], [-1.92, 0.9], [-1.4, 0.92], [-1.25, 0.95], [-0.62, 1.29], [-0.45, 1.315], [0.12, 1.32], [0.32, 1.27], [0.88, 0.88], [1.05, 0.84], [1.7, 0.79], [1.98, 0.75], [2.06, 0.55]]);
const BOT = pts([[-2.06, 0.38], [-1.85, 0.3], [-1.6, 0.24], [1.6, 0.24], [1.85, 0.32], [2.06, 0.38]]);
const BELT = pts([[-2.06, 0.6], [-1.92, 0.84], [-1.4, 0.86], [-1.25, 0.87], [0.88, 0.87], [1.05, 0.82], [1.98, 0.74], [2.06, 0.55]]);
const HW = pts([[-2.06, 0.66], [-1.9, 0.78], [-1.5, 0.81], [0, 0.82], [1.5, 0.8], [1.9, 0.76], [2.06, 0.66]]);
const GHW = pts([[-1.4, 0.74], [-0.6, 0.64], [0.1, 0.64], [0.9, 0.74]]); // greenhouse (roof) half width

export const WHEELS = { front: 1.22, rear: -1.2, track: 0.69, radius: 0.29 };
const ARCH_R = 0.37;

function inArch(z, y) {
  for (const wz of [WHEELS.front, WHEELS.rear]) {
    const d = Math.hypot(z - wz, (y - WHEELS.radius) * 1.0);
    if (d < ARCH_R && y < WHEELS.radius + ARCH_R) return true;
  }
  return false;
}

// cross-section point for parameter t in [0,1] (0 = bottom centre, 1 = top centre); returns [x, y, region]
function section(z, t) {
  const top = interp(TOP, z), bot = interp(BOT, z), belt = Math.min(interp(BELT, z), top - 0.005), hw = interp(HW, z);
  const hasGH = z > -1.42 && z < 0.9;
  const ghw = hasGH ? interp(GHW, z) : hw * 0.92;
  const rB = 0.06;
  // segment fractions
  if (t < 0.12) { // floor
    const k = t / 0.12; return [k * (hw - rB), bot, 'floor'];
  }
  if (t < 0.18) { // lower corner
    const k = (t - 0.12) / 0.06; const a = -Math.PI / 2 + k * Math.PI / 2;
    return [hw - rB + Math.cos(a) * rB, bot + rB + Math.sin(a) * rB, 'side'];
  }
  if (t < 0.58) { // side panel with slight barrel
    const k = (t - 0.18) / 0.4; const y = lerp(bot + rB, belt, k);
    const bulge = Math.sin(k * Math.PI) * 0.015 - k * k * 0.02;
    return [hw + bulge, y, 'side'];
  }
  if (t < 0.66) { // shoulder roll
    const k = (t - 0.58) / 0.08;
    const x0 = hw - 0.02, x1 = hasGH ? hw - 0.06 : hw - 0.1;
    const y1 = hasGH ? belt + 0.03 : Math.min(top, belt + 0.03);
    return [lerp(x0, x1, smooth(k)), lerp(belt, y1, Math.sin(k * Math.PI / 2)), 'shoulder'];
  }
  if (t < 0.88) { // greenhouse / hood sides
    const k = (t - 0.66) / 0.22;
    if (hasGH) {
      const yb = belt + 0.03;
      const x = lerp(hw - 0.06, ghw, k), y = lerp(yb, top - 0.05, k);
      return [x, y, 'glassSide'];
    }
    const x = lerp(hw - 0.1, ghw * 0.85, k), y = lerp(Math.min(top, belt + 0.03), top - 0.01 * (1 - k), k);
    return [x, y, 'deck'];
  }
  { // roof/hood crown
    const k = (t - 0.88) / 0.12;
    const x = lerp(hasGH ? ghw : ghw * 0.85, 0, k);
    const y = top - 0.05 * (1 - k) * (hasGH ? 1 : 0.3) + Math.sin(k * Math.PI / 2) * 0.015;
    return [x, y, 'top'];
  }
}

// Classify a face by its centroid (z, t, y)
function regionOf(z, t, y) {
  const side = t >= 0.12 && t < 0.62;
  const upperSide = t >= 0.62 && t < 0.88;
  const top = t >= 0.84;
  // windows
  if (upperSide && z > -1.3 && z < 0.82) {
    if (z > 0.74 || (z < -0.5 && z > -0.62) || z < -1.22) return 'pillar';
    return 'sideGlass';
  }
  if (t >= 0.66 && z >= 0.36 && z <= 0.86) return t > 0.7 ? 'windshield' : 'pillar';
  if (t >= 0.66 && z <= -0.66 && z >= -1.3) return t > 0.7 ? 'rearGlass' : 'pillar';
  if (top && z > 0.97 && z < 2.0) return 'hood';
  if (t >= 0.6 && z > 0.95 && z < 2.0 && t > 0.7) return 'hood';
  if (t >= 0.7 && z < -1.42 && z > -2.0) return 'trunk';
  if (side && z > -0.52 && z < 0.74 && y > 0.27) return 'door';
  if ((side || (t >= 0.58 && t < 0.7)) && z > 0.95 && y > 0.3) return 'fender';
  return 'body';
}

export function buildBodyGeometries() {
  const NU = 150, NT = 56;
  const verts = [];
  for (let i = 0; i <= NU; i++) {
    const z = lerp(L0, L1, i / NU);
    const row = [];
    for (let j = 0; j <= NT; j++) { const t = j / NT; const [x, y] = section(z, t); row.push([x, y, z]); }
    verts.push(row);
  }
  // per-region triangle lists for each side
  const regions = {};
  const add = (name, side, a, b, c) => {
    const key = (name === 'door' || name === 'fender' || name === 'sideGlass') ? `${name}${side > 0 ? 'L' : 'R'}` : name;
    (regions[key] ||= []).push(a, b, c);
  };
  for (const side of [1, -1]) {
    for (let i = 0; i < NU; i++) for (let j = 0; j < NT; j++) {
      const p00 = verts[i][j], p10 = verts[i + 1][j], p01 = verts[i][j + 1], p11 = verts[i + 1][j + 1];
      const cz = (p00[2] + p11[2]) / 2, cy = (p00[1] + p11[1] + p10[1] + p01[1]) / 4, ct = (j + 0.5) / NT;
      // wheel arches: skip side faces inside arch
      if (ct > 0.1 && ct < 0.62 && inArch(cz, cy)) continue;
      const reg = regionOf(cz, ct, cy);
      const P = (p) => [p[0] * side, p[1], p[2]];
      if (side > 0) { add(reg, side, P(p00), P(p01), P(p10)); add(reg, side, P(p10), P(p01), P(p11)); }
      else { add(reg, side, P(p00), P(p10), P(p01)); add(reg, side, P(p10), P(p11), P(p01)); }
    }
  }
  // end caps (front and rear panels) - fill nose and tail
  for (const [i, dir] of [[0, -1], [NU, 1]]) {
    const ring = verts[i];
    for (const side of [1, -1]) for (let j = 0; j < NT; j++) {
      const a = ring[j], b = ring[j + 1];
      const c = [0, (a[1] + b[1]) / 2 * 0 + (ring[0][1] + ring[NT][1]) / 2, a[2]];
      const P = (p) => [p[0] * side, p[1], p[2]];
      const reg = i === 0 ? 'tailPanel' : 'nosePanel';
      if ((side > 0) === (dir > 0)) add(reg, side, P(a), P(b), c); else add(reg, side, P(b), P(a), c);
    }
  }
  const out = {};
  for (const [name, arr] of Object.entries(regions)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr.flat(), 3));
    const n = arr.length;
    const uv = new Float32Array(n * 2);
    for (let k = 0; k < n; k++) { uv[k * 2] = arr[k][2] * 0.5; uv[k * 2 + 1] = arr[k][1] * 0.5; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const merged = mergeVerts(g);
    merged.computeVertexNormals();
    out[name] = merged;
  }
  return out;
}

function mergeVerts(g) {
  const p = g.attributes.position, uv = g.attributes.uv;
  const map = new Map(); const pos = [], uvs = [], idx = [];
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    let id = map.get(k);
    if (id === undefined) { id = pos.length / 3; map.set(k, id); pos.push(p.getX(i), p.getY(i), p.getZ(i)); uvs.push(uv.getX(i), uv.getY(i)); }
    idx.push(id);
  }
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  o.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  o.setIndex(idx);
  return o;
}

// Centre a geometry around its bbox centre; returns [geo, centre]
export function centreGeo(g) {
  g.computeBoundingBox();
  const c = new THREE.Vector3(); g.boundingBox.getCenter(c);
  const ng = g.clone(); ng.translate(-c.x, -c.y, -c.z);
  ng.computeBoundingBox();
  return [ng, c];
}

export function surfaceY(z) { return interp(TOP, z); }
export function beltY(z) { return interp(BELT, z); }
export function halfWidth(z) { return interp(HW, z); }
