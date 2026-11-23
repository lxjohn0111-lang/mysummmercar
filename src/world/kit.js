import * as THREE from 'three';
import { canvasTexture, roundBox } from '../core/util.js';
import { tex } from '../core/assets.js';

// Modelling helpers shared by the detailed props and hand-held items.

export const V2 = (x, y) => new THREE.Vector2(x, y);
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
  o.castShadow = true; o.receiveShadow = true;
  return o;
}
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (r1, r2, h, s = 20, open = false) => new THREE.CylinderGeometry(r1, r2, h, s, 1, open);
export const rbox = (w, h, d, r = 0.01, seg = 2) => roundBox(w, h, d, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4), seg);
export const torus = (r, t, rs = 8, ts = 24, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);
export const sphere = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);

// lathe from [radius, height] pairs (bottom to top)
export function lathe(pts, seg = 24) {
  return new THREE.LatheGeometry(pts.map(([r, y]) => V2(Math.max(0, r), y)), seg);
}
// smooth tube through points
export function tube(pts, r, seg = 24, radial = 8, closed = false) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : V3(...p))), closed);
  return new THREE.TubeGeometry(c, seg, r, radial, closed);
}
// helix (coiled phone cord etc.)
export function helix(a, b, radius, turns, r, seg = 160) {
  const A = V3(...a), B = V3(...b), d = B.clone().sub(A), L = d.length();
  const dir = d.clone().normalize();
  const side = Math.abs(dir.y) < 0.9 ? V3(0, 1, 0) : V3(1, 0, 0);
  const u = side.clone().cross(dir).normalize(), v = dir.clone().cross(u);
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, a2 = t * turns * Math.PI * 2;
    pts.push(A.clone().addScaledVector(dir, t * L).addScaledVector(u, Math.cos(a2) * radius).addScaledVector(v, Math.sin(a2) * radius));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg * 2, r, 5, false);
}
// extrude a 2D outline (array of [x,y]) along +z, centred on z
export function extrude(outline, depth, bevel = 0, curveSeg = 8) {
  const s = new THREE.Shape(outline.map(([x, y]) => V2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-4, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: curveSeg });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  return g;
}
export function shapeExtrude(shape, depth, bevel = 0, curveSeg = 10) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1e-4, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: curveSeg });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  return g;
}
// pivot group at a hinge point; children positioned relative to the hinge
export function pivot(parent, x, y, z, name) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.name = name; p.userData.noBatch = true;
  parent.add(p); return p;
}

// ---------------------------------------------------------------- materials (cached)
const C = {};
const std = (k, o) => (C[k] ||= new THREE.MeshStandardMaterial(o));
const phys = (k, o) => (C[k] ||= new THREE.MeshPhysicalMaterial(o));
export const MAT = {
  enamel: (color = 0xf0ece2) => phys('enamel' + color, { color, roughness: 0.22, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
  paint: (color, rough = 0.45) => std('paint' + color + rough, { color, roughness: rough, metalness: 0.3, map: wearTex(), roughnessMap: wearTex() }),
  steel: () => std('steel', { color: 0xc4c8cc, roughness: 0.32, metalness: 0.95, map: wearTex() }),
  brushed: () => std('brushed', { color: 0xc8ccd0, roughness: 0.38, metalness: 0.9, map: brushedTex() }),
  chrome: () => std('chrome', { color: 0xf4f4f4, roughness: 0.06, metalness: 1 }),
  galv: () => std('galv', { color: 0xb8bec0, roughness: 0.45, metalness: 0.85, map: spangleTex() }),
  iron: () => std('iron', { color: 0x38383a, roughness: 0.6, metalness: 0.75, normalMap: tex('cast_n.jpg', { srgb: false }) }),
  rust: () => std('rust', { color: 0x8a5a3a, roughness: 0.85, metalness: 0.4, map: wearTex() }),
  plastic: (color = 0x1a1a1a, rough = 0.5) => std('plastic' + color + rough, { color, roughness: rough, metalness: 0 }),
  rubber: () => std('rubber', { color: 0x141414, roughness: 0.92 }),
  glass: (color = 0x9fb8c0, op = 0.28) => std('glass' + color + op, { color, roughness: 0.04, metalness: 0.1, transparent: true, opacity: op, depthWrite: false }),
  darkGlass: () => std('darkGlass', { color: 0x0a0e10, roughness: 0.05, metalness: 0.4 }),
  wood: (color = 0x9a7048) => std('wood' + color, { color, roughness: 0.75, map: tex('planks_raw.jpg') }),
  darkWood: () => std('darkWood', { color: 0x9a6a44, roughness: 0.5, map: tex('planks_raw.jpg') }),
  oldWood: () => std('oldWood', { color: 0xb0a690, roughness: 0.95, map: tex('planks_raw.jpg') }),
  fabric: (color) => std('fabric' + color, { color, roughness: 0.97, normalMap: tex('fabric_n.jpg', { srgb: false }) }),
  ceramic: () => phys('ceramic', { color: 0xf6f5f0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
  emissive: (color, i = 1) => std('em' + color + i, { color: 0x111111, emissive: color, emissiveIntensity: i }),
  basic: (color) => std('basic' + color, { color, roughness: 0.6 }),
};
export function texMat(t, o = {}) { return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, ...o }); }

// light wear/scratch mask used as albedo multiplier (mostly white)
function wearTex() {
  return (C.__wear ||= (() => { const t = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#f2f2f2'; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2500; i++) { const v = 210 + Math.random() * 45 | 0; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    c.strokeStyle = 'rgba(120,110,100,0.35)'; for (let i = 0; i < 40; i++) { c.lineWidth = Math.random() * 1.2; c.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; c.moveTo(x, y); c.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 10); c.stroke(); }
    for (let i = 0; i < 12; i++) { c.fillStyle = 'rgba(110,80,50,0.18)'; c.beginPath(); c.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 7, 0, 7); c.fill(); }
  }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })());
}
function spangleTex() {
  return (C.__spangle ||= (() => { const t = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) { const v = 200 + Math.random() * 55 | 0; c.fillStyle = `rgb(${v},${v},${v})`; c.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; c.moveTo(x, y); for (let k = 0; k < 6; k++) c.lineTo(x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 50); c.fill(); }
  }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })());
}
function brushedTex() {
  return (C.__brushed ||= canvasTexture(256, 256, (c) => {
    c.fillStyle = '#dadada'; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) { const v = 190 + Math.random() * 65 | 0; c.fillStyle = `rgba(${v},${v},${v},0.25)`; c.fillRect(0, Math.random() * 256, 256, 1); }
  }));
}

// text label helper with optional drawing callback
export function label(w, h, draw) { return canvasTexture(w, h, draw); }
export { canvasTexture, tex };
