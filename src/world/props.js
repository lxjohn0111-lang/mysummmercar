import * as THREE from 'three';
import { mats, boxUV } from './mats.js';
import { roundBox, canvasTexture, mergeGeos, xform } from '../core/util.js';
import { tex } from '../core/assets.js';

// Furniture & prop builders. All return THREE.Group with origin at the floor centre.
const G = () => new THREE.Group();
function m(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; return o;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r1, r2, h, s = 16) => new THREE.CylinderGeometry(r1, r2, h, s);

export function bed() {
  const M = mats(), g = G();
  g.add(m(box(1.0, 0.3, 2.0), M.darkWood, 0, 0.25, 0));
  g.add(m(roundBox(0.95, 0.2, 1.95, 0.06), new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.95 }), 0, 0.5, 0));
  g.add(m(roundBox(0.97, 0.12, 1.3, 0.05), new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.95, map: tex('fabric.jpg') }), 0, 0.62, 0.3));
  g.add(m(roundBox(0.6, 0.12, 0.35, 0.05), new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.95 }), 0, 0.65, -0.72));
  g.add(m(box(1.05, 0.9, 0.06), M.darkWood, 0, 0.45, -1.0));
  g.add(m(box(1.05, 0.5, 0.06), M.darkWood, 0, 0.25, 1.0));
  return g;
}
export function table(w = 1.2, d = 0.8, h = 0.75, mat) {
  const M = mats(), g = G(); mat = mat || M.wood;
  g.add(m(box(w, 0.05, d), mat, 0, h, 0));
  for (const [x, z] of [[w / 2 - 0.06, d / 2 - 0.06], [-w / 2 + 0.06, d / 2 - 0.06], [w / 2 - 0.06, -d / 2 + 0.06], [-w / 2 + 0.06, -d / 2 + 0.06]]) g.add(m(box(0.05, h, 0.05), mat, x, h / 2, z));
  return g;
}
export function chair(mat) {
  const M = mats(), g = G(); mat = mat || M.wood;
  g.add(m(box(0.42, 0.04, 0.42), mat, 0, 0.45, 0));
  for (const [x, z] of [[0.18, 0.18], [-0.18, 0.18], [0.18, -0.18], [-0.18, -0.18]]) g.add(m(box(0.035, 0.45, 0.035), mat, x, 0.225, z));
  g.add(m(box(0.42, 0.45, 0.03), mat, 0, 0.7, -0.2));
  return g;
}
export function sofa() {
  const M = mats(), g = G();
  const f = new THREE.MeshStandardMaterial({ color: 0x5a6a3a, roughness: 0.95, map: tex('fabric.jpg') });
  g.add(m(roundBox(1.9, 0.4, 0.8, 0.08), f, 0, 0.3, 0));
  g.add(m(roundBox(1.9, 0.55, 0.22, 0.08), f, 0, 0.65, -0.32));
  g.add(m(roundBox(0.2, 0.55, 0.8, 0.07), f, 0.9, 0.45, 0));
  g.add(m(roundBox(0.2, 0.55, 0.8, 0.07), f, -0.9, 0.45, 0));
  return g;
}
export function fridge() {
  const M = mats(), g = G();
  const w = new THREE.MeshStandardMaterial({ color: 0xece6d6, roughness: 0.35, metalness: 0.1 });
  g.add(m(roundBox(0.6, 1.6, 0.62, 0.04), w, 0, 0.8, 0));
  g.add(m(box(0.58, 0.01, 0.01), M.darkMetal, 0, 1.1, 0.315));
  g.add(m(box(0.03, 0.3, 0.04), M.chrome, 0.24, 1.3, 0.33));
  g.add(m(box(0.03, 0.3, 0.04), M.chrome, 0.24, 0.8, 0.33));
  const logo = canvasTexture(64, 16, (c) => { c.fillStyle = '#ece6d6'; c.fillRect(0, 0, 64, 16); c.fillStyle = '#888'; c.font = 'bold 12px Arial'; c.fillText('ARKTIS', 8, 12); });
  g.add(m(new THREE.PlaneGeometry(0.16, 0.04), new THREE.MeshStandardMaterial({ map: logo }), -0.15, 1.5, 0.316));
  return g;
}
export function stove() {
  const M = mats(), g = G();
  const w = new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.35 });
  g.add(m(box(0.6, 0.85, 0.6), w, 0, 0.425, 0));
  g.add(m(box(0.58, 0.02, 0.58), M.darkMetal, 0, 0.86, 0));
  for (const [x, z, r] of [[0.14, 0.14, 0.09], [-0.14, 0.14, 0.07], [0.14, -0.14, 0.07], [-0.14, -0.14, 0.09]]) g.add(m(cyl(r, r, 0.02, 20), M.darkMetal, x, 0.88, z));
  g.add(m(box(0.5, 0.4, 0.02), M.glassDark, 0, 0.42, 0.305));
  g.add(m(box(0.4, 0.025, 0.04), M.chrome, 0, 0.67, 0.32));
  for (let i = 0; i < 4; i++) g.add(m(cyl(0.02, 0.02, 0.03, 10), M.blackPlastic, -0.2 + i * 0.13, 0.78, 0.31, Math.PI / 2));
  // frying pan
  g.add(m(cyl(0.12, 0.1, 0.05, 20), M.darkMetal, 0.14, 0.91, 0.14));
  g.add(m(box(0.22, 0.02, 0.03), M.blackPlastic, 0.33, 0.92, 0.14));
  return g;
}
export function counter(w = 1.8, withSink = true) {
  const M = mats(), g = G();
  const cab = new THREE.MeshStandardMaterial({ color: 0xc8b890, roughness: 0.6, map: tex('planks_raw.jpg') });
  g.add(m(box(w, 0.85, 0.6), cab, 0, 0.425, 0));
  g.add(m(box(w + 0.02, 0.04, 0.62), new THREE.MeshStandardMaterial({ color: 0xb0a890, roughness: 0.4 }), 0, 0.87, 0));
  for (let i = 0; i < Math.floor(w / 0.6); i++) g.add(m(box(0.02, 0.6, 0.01), M.darkWood, -w / 2 + 0.6 * (i + 1), 0.45, 0.305));
  if (withSink) {
    g.add(m(box(0.5, 0.02, 0.4), M.metal, -w / 4, 0.89, 0));
    g.add(m(box(0.44, 0.15, 0.34), M.darkMetal, -w / 4, 0.82, 0));
    g.add(m(cyl(0.015, 0.015, 0.25, 8), M.chrome, -w / 4, 1.0, -0.22));
    g.add(m(box(0.03, 0.03, 0.15), M.chrome, -w / 4, 1.12, -0.16));
  }
  // upper cabinets
  g.add(m(box(w, 0.6, 0.35), cab, 0, 1.75, -0.12));
  return g;
}
export function tv() {
  const M = mats(), g = G();
  g.add(m(box(0.7, 0.45, 0.4), new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.6, map: tex('planks_dark.jpg') }), 0, 0.225, 0));
  g.add(m(roundBox(0.62, 0.48, 0.45, 0.04), M.blackPlastic, 0, 0.7, 0));
  const screen = m(new THREE.PlaneGeometry(0.46, 0.34), new THREE.MeshStandardMaterial({ color: 0x0a0f12, roughness: 0.1, emissive: 0x000000 }), -0.04, 0.72, 0.226);
  screen.name = 'screen'; g.add(screen);
  g.add(m(cyl(0.01, 0.01, 0.4, 4), M.metal, -0.1, 1.1, 0, 0, 0, 0.5));
  g.add(m(cyl(0.01, 0.01, 0.4, 4), M.metal, 0.1, 1.1, 0, 0, 0, -0.5));
  return g;
}
export function phone() {
  const M = mats(), g = G();
  const mat = new THREE.MeshStandardMaterial({ color: 0xa82a20, roughness: 0.4 });
  g.add(m(roundBox(0.2, 0.08, 0.22, 0.02), mat, 0, 0.04, 0));
  g.add(m(roundBox(0.22, 0.05, 0.06, 0.02), mat, 0, 0.11, 0));
  g.add(m(cyl(0.06, 0.06, 0.01, 16), M.white, 0, 0.081, 0.03));
  return g;
}
export function lamp(h = 1.5) {
  const M = mats(), g = G();
  g.add(m(cyl(0.15, 0.18, 0.04), M.darkMetal, 0, 0.02, 0));
  g.add(m(cyl(0.015, 0.015, h), M.chrome, 0, h / 2, 0));
  g.add(m(cyl(0.12, 0.22, 0.25, 16), new THREE.MeshStandardMaterial({ color: 0xe8d8a0, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x302010 }), 0, h, 0));
  return g;
}
export function rug(w = 2, d = 1.4, color = 0x8a3a2a) {
  const t = canvasTexture(128, 96, (c) => {
    c.fillStyle = '#' + color.toString(16).padStart(6, '0'); c.fillRect(0, 0, 128, 96);
    const cols = ['#d8c8a0', '#2a4a6a', '#e8e0d0', '#5a2a1a'];
    for (let i = 0; i < 12; i++) { c.fillStyle = cols[i % 4]; c.fillRect(0, i * 8 + 2, 128, 3); }
  });
  const g = G(); g.add(m(box(w, 0.012, d), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }), 0, 0.006, 0)); return g;
}
export function shelf(w = 1.2, h = 1.8, d = 0.4, levels = 4, mat) {
  const M = mats(), g = G(); mat = mat || M.wood;
  for (let i = 0; i <= levels; i++) g.add(m(box(w, 0.03, d), mat, 0, 0.05 + i * (h - 0.1) / levels, 0));
  g.add(m(box(0.03, h, d), mat, -w / 2, h / 2, 0)); g.add(m(box(0.03, h, d), mat, w / 2, h / 2, 0));
  g.add(m(box(w, h, 0.02), mat, 0, h / 2, -d / 2));
  return g;
}
export function metalShelf(w = 1.8, h = 2.0, d = 0.5) {
  const M = mats(), g = G();
  const blue = new THREE.MeshStandardMaterial({ color: 0x2a4a8a, roughness: 0.5, metalness: 0.6 });
  for (let i = 0; i < 4; i++) g.add(m(box(w, 0.03, d), M.metal, 0, 0.1 + i * 0.6, 0));
  for (const [x, z] of [[w / 2, d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]]) g.add(m(box(0.04, h, 0.04), blue, x, h / 2, z));
  return g;
}
export function workbench() {
  const M = mats(), g = G();
  g.add(m(box(2.2, 0.06, 0.8), M.darkPlanks || M.darkWood, 0, 0.9, 0));
  for (const [x, z] of [[1.05, 0.35], [-1.05, 0.35], [1.05, -0.35], [-1.05, -0.35]]) g.add(m(box(0.08, 0.9, 0.08), M.darkWood, x, 0.45, z));
  g.add(m(box(2.1, 0.03, 0.7), M.darkWood, 0, 0.25, 0));
  // vise
  g.add(m(box(0.18, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: 0x2a5a8a, metalness: 0.6, roughness: 0.4 }), 0.85, 0.99, 0.3));
  // pegboard with tools
  const pb = canvasTexture(256, 128, (c) => {
    c.fillStyle = '#b89a6a'; c.fillRect(0, 0, 256, 128);
    c.fillStyle = '#7a6040'; for (let y = 6; y < 128; y += 10) for (let x = 6; x < 256; x += 10) c.fillRect(x, y, 2, 2);
    c.strokeStyle = '#333'; c.lineWidth = 5;
    for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(20 + i * 18, 20); c.lineTo(20 + i * 18, 60 + i * 4); c.stroke(); }
    c.fillStyle = '#c03020'; c.fillRect(190, 20, 40, 14); c.fillStyle = '#333'; c.fillRect(200, 34, 8, 40);
    c.strokeStyle = '#2a5a9a'; c.beginPath(); c.arc(60, 100, 14, 0, Math.PI * 1.5); c.stroke();
  });
  g.add(m(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshStandardMaterial({ map: pb, roughness: 0.8 }), 0, 1.6, -0.39));
  return g;
}
export function oilDrum(color = 0x2a5a8a) {
  const M = mats(), g = G();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.5, map: tex('grime.jpg') });
  g.add(m(cyl(0.29, 0.29, 0.88, 20), mat, 0, 0.44, 0));
  for (const y of [0.29, 0.59]) g.add(m(new THREE.TorusGeometry(0.295, 0.012, 6, 24), mat, 0, y, 0, Math.PI / 2));
  return g;
}
export function tireStack(n = 4) {
  const M = mats(), g = G();
  for (let i = 0; i < n; i++) g.add(m(new THREE.TorusGeometry(0.26, 0.1, 10, 24), M.rubber, (Math.random() - 0.5) * 0.06, 0.1 + i * 0.2, 0, Math.PI / 2));
  return g;
}
export function engineStand() {
  const M = mats(), g = G();
  const red = new THREE.MeshStandardMaterial({ color: 0xb02018, roughness: 0.5, metalness: 0.5 });
  g.add(m(box(0.08, 0.06, 1.0), red, 0.3, 0.05, 0)); g.add(m(box(0.08, 0.06, 1.0), red, -0.3, 0.05, 0));
  g.add(m(box(0.7, 0.06, 0.08), red, 0, 0.05, -0.4));
  g.add(m(box(0.08, 0.75, 0.08), red, 0, 0.42, -0.4));
  g.add(m(box(0.08, 0.08, 0.4), red, 0, 0.78, -0.25));
  g.add(m(cyl(0.12, 0.12, 0.04, 12), red, 0, 0.78, -0.05, Math.PI / 2));
  for (const [x, z] of [[0.3, 0.5], [-0.3, 0.5], [0.3, -0.5], [-0.3, -0.5]]) g.add(m(cyl(0.04, 0.04, 0.03, 8), M.rubber, x, 0.04, z, 0, 0, Math.PI / 2));
  return g;
}
export function engineHoist() {
  const M = mats(), g = G();
  const y = new THREE.MeshStandardMaterial({ color: 0xd8a010, roughness: 0.5, metalness: 0.5 });
  g.add(m(box(0.1, 0.08, 1.4), y, 0.35, 0.06, 0.2)); g.add(m(box(0.1, 0.08, 1.4), y, -0.35, 0.06, 0.2));
  g.add(m(box(0.8, 0.08, 0.1), y, 0, 0.06, -0.5));
  g.add(m(box(0.1, 1.6, 0.1), y, 0, 0.85, -0.5));
  const boom = m(box(0.09, 0.09, 1.5), y, 0, 1.65, 0.15, -0.25); boom.name = 'boom'; g.add(boom);
  g.add(m(cyl(0.05, 0.05, 0.6, 8), M.darkMetal, 0, 1.15, -0.3, 0.6));
  const chain = m(cyl(0.01, 0.01, 0.6, 4), M.darkMetal, 0, 1.6, 0.82); chain.name = 'chain'; g.add(chain);
  return g;
}
export function jackStand() {
  const M = mats(), g = G();
  const r = new THREE.MeshStandardMaterial({ color: 0xc03020, roughness: 0.5, metalness: 0.5 });
  g.add(m(cyl(0.04, 0.16, 0.3, 4), r, 0, 0.15, 0, 0, Math.PI / 4));
  g.add(m(cyl(0.025, 0.025, 0.25, 8), M.metal, 0, 0.38, 0));
  g.add(m(box(0.1, 0.03, 0.06), M.metal, 0, 0.5, 0));
  return g;
}
export function kiuas() {
  const M = mats(), g = G();
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, metalness: 0.6 });
  g.add(m(box(0.5, 0.75, 0.5), black, 0, 0.375, 0));
  g.add(m(box(0.52, 0.04, 0.52), black, 0, 0.76, 0));
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a5856, roughness: 0.95, map: tex('rock.jpg') });
  for (let i = 0; i < 26; i++) {
    const s = 0.06 + Math.random() * 0.05;
    g.add(m(new THREE.DodecahedronGeometry(s, 0), stoneMat, (Math.random() - 0.5) * 0.38, 0.82 + Math.random() * 0.18 - Math.abs((Math.random() - 0.5)) * 0.1, (Math.random() - 0.5) * 0.38, Math.random() * 3, Math.random() * 3));
  }
  // fire door with glow
  const glow = m(box(0.22, 0.16, 0.02), new THREE.MeshStandardMaterial({ color: 0x110500, emissive: 0xff5010, emissiveIntensity: 0 }), 0, 0.25, 0.255);
  glow.name = 'glow'; g.add(glow);
  g.add(m(cyl(0.06, 0.06, 1.6, 10), black, 0, 1.6, -0.15));
  return g;
}
export function saunaBenches(w = 2.2) {
  const M = mats(), g = G();
  const wood = new THREE.MeshStandardMaterial({ color: 0xd8b888, roughness: 0.7, map: tex('planks_raw.jpg') });
  // lower step and upper bench (lauteet)
  for (let i = 0; i < 6; i++) g.add(m(box(w, 0.03, 0.09), wood, 0, 0.45, -0.25 + i * 0.1));
  for (let i = 0; i < 7; i++) g.add(m(box(w, 0.03, 0.09), wood, 0, 0.95, -0.95 + i * 0.1));
  g.add(m(box(w, 0.45, 0.04), wood, 0, 0.225, 0.3));
  g.add(m(box(w, 0.5, 0.04), wood, 0, 0.7, -0.33));
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) { g.add(m(box(0.05, 0.95, 0.05), wood, x, 0.475, -0.9)); g.add(m(box(0.05, 0.45, 0.05), wood, x, 0.225, 0.25)); }
  return g;
}
export function bucket() {
  const g = G();
  const wood = new THREE.MeshStandardMaterial({ color: 0xb88a58, roughness: 0.7, map: tex('planks_raw.jpg') });
  const b = m(cyl(0.16, 0.13, 0.22, 16), wood, 0, 0.11, 0); g.add(b);
  g.add(m(new THREE.TorusGeometry(0.16, 0.01, 6, 20), mats().chrome, 0, 0.19, 0, Math.PI / 2));
  g.add(m(cyl(0.145, 0.145, 0.005, 16), new THREE.MeshStandardMaterial({ color: 0x3a5a6a, roughness: 0.05, transparent: true, opacity: 0.8 }), 0, 0.18, 0));
  // ladle
  g.add(m(cyl(0.012, 0.012, 0.45, 6), wood, 0.12, 0.3, 0, 0, 0, 0.6));
  return g;
}
export function shopShelf(w = 2.4, colors) {
  const M = mats(), g = G();
  const white = new THREE.MeshStandardMaterial({ color: 0xe0e0dc, roughness: 0.5, metalness: 0.2 });
  for (let i = 0; i < 5; i++) g.add(m(box(w, 0.025, 0.45), white, 0, 0.1 + i * 0.4, 0));
  g.add(m(box(w, 1.9, 0.03), white, 0, 0.95, -0.22));
  g.add(m(box(0.03, 1.9, 0.45), white, -w / 2, 0.95, 0)); g.add(m(box(0.03, 1.9, 0.45), white, w / 2, 0.95, 0));
  const prods = colors || [0xc83020, 0x2050a0, 0xe0c020, 0x20802a, 0xf0f0f0, 0x804020, 0xe07020];
  const geos = [box(0.1, 0.2, 0.08), cyl(0.04, 0.04, 0.14, 10), box(0.16, 0.24, 0.06), box(0.08, 0.12, 0.08)];
  const matsP = prods.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
  for (let lv = 1; lv < 5; lv++) {
    let x = -w / 2 + 0.1;
    const gi = (lv * 7) % geos.length, mi = (lv * 3) % matsP.length;
    while (x < w / 2 - 0.1) {
      const gg = geos[(((gi + Math.floor(x * 3)) % geos.length) + geos.length) % geos.length];
      gg.computeBoundingBox();
      const hgt = gg.boundingBox.max.y - gg.boundingBox.min.y;
      const o = m(gg, matsP[(((mi + Math.floor(x * 2)) % matsP.length) + matsP.length) % matsP.length], x, 0.1 + lv * 0.4 - 0.4 + 0.0125 + hgt / 2, 0.05);
      o.castShadow = false; g.add(o);
      x += 0.12 + (gg.parameters.width || 0.08);
    }
  }
  return g;
}
export function beerFridge() {
  const M = mats(), g = G();
  const body = new THREE.MeshStandardMaterial({ color: 0xc02018, roughness: 0.4, metalness: 0.3 });
  g.add(m(box(0.9, 2.0, 0.7), body, 0, 1.0, 0));
  g.add(m(box(0.8, 1.6, 0.02), new THREE.MeshStandardMaterial({ color: 0xaaccdd, transparent: true, opacity: 0.3, roughness: 0.05 }), 0, 1.05, 0.355));
  const cans = new THREE.MeshStandardMaterial({ color: 0xd8b830, roughness: 0.3, metalness: 0.7 });
  const bottles = new THREE.MeshStandardMaterial({ color: 0x4a2a0a, roughness: 0.1, metalness: 0.1 });
  for (let lv = 0; lv < 4; lv++) for (let i = 0; i < 6; i++) g.add(m(cyl(0.035, 0.035, lv % 2 ? 0.12 : 0.24, 8), lv % 2 ? cans : bottles, -0.3 + i * 0.12, 0.45 + lv * 0.4, 0.15));
  g.add(m(box(0.9, 0.3, 0.72), new THREE.MeshStandardMaterial({ map: canvasTexture(256, 64, (c) => { c.fillStyle = '#c02018'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#fff'; c.font = 'bold 40px Arial'; c.textAlign = 'center'; c.fillText('KYLMÄÄ', 128, 46); }) }), 0, 1.95, 0));
  return g;
}
export function register() {
  const M = mats(), g = G();
  g.add(m(box(0.4, 0.15, 0.35), new THREE.MeshStandardMaterial({ color: 0xd0c8b8, roughness: 0.5 }), 0, 0.075, 0));
  g.add(m(box(0.3, 0.16, 0.05), M.blackPlastic, 0, 0.22, -0.1, -0.3));
  return g;
}
export function barStool() {
  const M = mats(), g = G();
  g.add(m(cyl(0.18, 0.18, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.5 }), 0, 0.75, 0));
  g.add(m(cyl(0.03, 0.03, 0.72, 8), M.chrome, 0, 0.36, 0));
  g.add(m(cyl(0.2, 0.2, 0.02, 16), M.chrome, 0, 0.01, 0));
  return g;
}
export function slotMachine() {
  const M = mats(), g = G();
  const body = new THREE.MeshStandardMaterial({ color: 0x1a2a6a, roughness: 0.4, metalness: 0.4 });
  g.add(m(roundBox(0.6, 1.6, 0.5, 0.05), body, 0, 0.8, 0));
  const face = canvasTexture(256, 384, (c) => {
    const gr = c.createLinearGradient(0, 0, 0, 384); gr.addColorStop(0, '#f2c030'); gr.addColorStop(1, '#c04010');
    c.fillStyle = gr; c.fillRect(0, 0, 256, 384);
    c.fillStyle = '#fff'; c.font = 'bold 34px Arial'; c.textAlign = 'center'; c.fillText('ONNI-PELI', 128, 50);
    c.fillStyle = '#111'; c.fillRect(30, 90, 196, 90);
    c.fillStyle = '#fff'; for (let i = 0; i < 3; i++) c.fillRect(38 + i * 64, 98, 56, 74);
    c.font = '44px Arial'; c.fillStyle = '#c02020'; c.fillText('7', 66, 150); c.fillStyle = '#20a020'; c.fillText('★', 130, 150); c.fillStyle = '#2040c0'; c.fillText('7', 194, 150);
    c.fillStyle = '#fff'; c.font = 'bold 22px Arial'; c.fillText('5 mk / PELI', 128, 240); c.fillText('VOITTO x50', 128, 280);
  });
  g.add(m(new THREE.PlaneGeometry(0.5, 0.75), new THREE.MeshStandardMaterial({ map: face, emissive: 0x332211, emissiveMap: face, emissiveIntensity: 0.6 }), 0, 1.05, 0.26));
  g.add(m(cyl(0.02, 0.02, 0.35, 8), M.chrome, 0.34, 1.05, 0, 0, 0, 0));
  g.add(m(new THREE.SphereGeometry(0.05, 10, 8), M.redPaint, 0.34, 1.25, 0));
  return g;
}
export function dartboard() {
  const g = G();
  const t = canvasTexture(128, 128, (c) => {
    const cols = ['#111', '#eee'];
    for (let r = 60; r > 0; r -= 6) for (let s = 0; s < 20; s++) {
      c.fillStyle = r < 12 ? (r < 6 ? '#c02020' : '#208020') : (s + Math.floor(r / 6)) % 2 ? (r % 18 === 0 ? '#c02020' : cols[0]) : (r % 18 === 0 ? '#208020' : cols[1]);
      c.beginPath(); c.moveTo(64, 64); c.arc(64, 64, r, s / 20 * Math.PI * 2, (s + 1) / 20 * Math.PI * 2); c.fill();
    }
  });
  g.add(m(cyl(0.23, 0.23, 0.04, 32), new THREE.MeshStandardMaterial({ color: 0x111111 }), 0, 0, 0, Math.PI / 2));
  g.add(m(new THREE.CircleGeometry(0.2, 32), new THREE.MeshStandardMaterial({ map: t }), 0, 0, 0.021));
  return g;
}
export function gasPump() {
  const M = mats(), g = G();
  const body = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.4, metalness: 0.2 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0x1a6a3a, roughness: 0.4 });
  g.add(m(box(0.9, 0.2, 0.6), M.concrete, 0, 0.1, 0));
  g.add(m(roundBox(0.7, 1.6, 0.45, 0.04), body, 0, 1.0, 0));
  g.add(m(box(0.72, 0.18, 0.47), stripe, 0, 1.5, 0));
  const face = canvasTexture(128, 128, (c) => {
    c.fillStyle = '#222'; c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#ff9030'; c.font = 'bold 20px monospace'; c.fillText('LITRAA', 14, 30); c.fillText('088.40', 14, 60); c.fillText('MK 5.20', 14, 100);
  });
  g.add(m(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshStandardMaterial({ map: face, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: 0.4 }), 0, 1.15, 0.226));
  g.add(m(box(0.1, 0.25, 0.08), M.blackPlastic, 0.3, 0.95, 0.27));
  g.add(m(new THREE.TorusGeometry(0.25, 0.015, 6, 16, Math.PI), M.blackPlastic, 0.38, 0.7, 0.2, 0, Math.PI / 2));
  return g;
}
export function mailbox(name = '') {
  const M = mats(), g = G();
  g.add(m(box(0.08, 1.1, 0.08), M.darkWood, 0, 0.55, 0));
  const mb = new THREE.MeshStandardMaterial({ color: 0x2a5aa0, roughness: 0.5, metalness: 0.4 });
  g.add(m(roundBox(0.32, 0.25, 0.42, 0.04), mb, 0, 1.2, 0));
  if (name) {
    const t = canvasTexture(128, 32, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 128, 32); c.fillStyle = '#111'; c.font = 'bold 20px Arial'; c.textAlign = 'center'; c.fillText(name, 64, 23); });
    g.add(m(new THREE.PlaneGeometry(0.26, 0.065), new THREE.MeshStandardMaterial({ map: t }), 0.161, 1.2, 0, 0, Math.PI / 2));
  }
  return g;
}
export function bench() {
  const M = mats(), g = G();
  for (let i = 0; i < 3; i++) g.add(m(box(1.6, 0.04, 0.12), M.wood, 0, 0.45, -0.15 + i * 0.14));
  for (let i = 0; i < 2; i++) g.add(m(box(1.6, 0.1, 0.03), M.wood, 0, 0.7 + i * 0.15, -0.24));
  for (const x of [-0.7, 0.7]) { g.add(m(box(0.06, 0.45, 0.4), M.darkMetal, x, 0.225, 0)); g.add(m(box(0.06, 0.5, 0.04), M.darkMetal, x, 0.7, -0.24)); }
  return g;
}
export function fence(len = 4, h = 1.1) {
  const M = mats(), g = G();
  const w = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.9, map: tex('planks_dark.jpg') });
  for (let i = 0; i <= Math.floor(len / 2); i++) g.add(m(box(0.1, h + 0.2, 0.1), w, -len / 2 + i * 2, (h + 0.2) / 2 - 0.1, 0));
  // diagonal "riukuaita"-like rails
  for (let k = 0; k < Math.floor(len / 0.5); k++) g.add(m(cyl(0.025, 0.025, h * 1.25, 5), w, -len / 2 + 0.25 + k * 0.5, h / 2, 0, 0, 0, 0.6));
  g.add(m(box(len, 0.06, 0.06), w, 0, h * 0.85, 0.06));
  return g;
}
export function hayBale() {
  const M = mats(), g = G();
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8c27a, roughness: 1, map: tex('grass.jpg') });
  const wrap = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.35 });
  g.add(m(cyl(0.65, 0.65, 1.2, 24), wrap, 0, 0.65, 0, 0, 0, Math.PI / 2));
  return g;
}
export function crate(w = 0.6, h = 0.4, d = 0.4, label = '') {
  const M = mats(), g = G();
  const mat = new THREE.MeshStandardMaterial({ color: 0xc8a06a, roughness: 0.85, map: tex('planks_raw.jpg') });
  g.add(m(box(w, h, d), mat, 0, h / 2, 0));
  return g;
}
export function firewoodStack(w = 2.4, h = 1.4, d = 0.5) {
  const g = G();
  const end = new THREE.MeshStandardMaterial({ color: 0xc89a60, roughness: 0.9 });
  const bark = new THREE.MeshStandardMaterial({ map: tex('bark_birch.jpg'), roughness: 0.9 });
  const geo = cyl(0.07, 0.07, d, 6);
  const rows = Math.floor(h / 0.13), cols = Math.floor(w / 0.15);
  const im = new THREE.InstancedMesh(geo, [bark, end, end], rows * cols);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    m4.compose(new THREE.Vector3(-w / 2 + 0.075 + c * 0.15 + (r % 2) * 0.05, 0.07 + r * 0.13, (Math.random() - 0.5) * 0.06), q, new THREE.Vector3(1, 1, 1));
    im.setMatrixAt(k++, m4);
  }
  im.castShadow = true; im.receiveShadow = true;
  g.add(im);
  return g;
}
export function choppingBlock() {
  const g = G();
  g.add(m(cyl(0.3, 0.32, 0.5, 14), [new THREE.MeshStandardMaterial({ map: tex('bark_pine.jpg'), roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0xb08a58, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0xb08a58 })], 0, 0.25, 0));
  return g;
}
export function streetLamp() {
  const M = mats(), g = G();
  g.add(m(cyl(0.06, 0.09, 6, 8), M.darkMetal, 0, 3, 0));
  g.add(m(box(0.08, 0.08, 1.4), M.darkMetal, 0, 5.95, 0.65));
  const head = m(box(0.3, 0.12, 0.5), M.darkMetal, 0, 5.9, 1.3); g.add(head);
  const bulb = m(box(0.25, 0.02, 0.4), M.lampOn, 0, 5.83, 1.3); bulb.name = 'bulb'; g.add(bulb);
  return g;
}
export function busShelter() {
  const M = mats(), g = G();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.9, map: tex('planks_dark.jpg') });
  g.add(m(box(3, 0.1, 1.6), M.concrete, 0, 0.05, 0));
  g.add(m(box(3, 2.2, 0.08), wood, 0, 1.2, -0.75));
  g.add(m(box(0.08, 2.2, 1.6), wood, -1.5, 1.2, 0)); g.add(m(box(0.08, 2.2, 1.6), wood, 1.5, 1.2, 0));
  g.add(m(box(3.3, 0.1, 1.9), M.roof, 0, 2.35, 0, 0.08));
  g.add(m(box(2.6, 0.05, 0.35), M.wood, 0, 0.5, -0.5));
  const sign = canvasTexture(64, 64, (c) => { c.fillStyle = '#1a4fa0'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#ffdd00'; c.fillRect(6, 6, 52, 52); c.fillStyle = '#111'; c.font = 'bold 34px Arial'; c.textAlign = 'center'; c.fillText('🚌', 32, 46); });
  g.add(m(cyl(0.03, 0.03, 2.6, 6), M.metal, 1.9, 1.3, 0.6));
  g.add(m(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshStandardMaterial({ map: sign, side: THREE.DoubleSide }), 1.9, 2.4, 0.6));
  return g;
}
export function flagpole() {
  const M = mats(), g = G();
  g.add(m(cyl(0.05, 0.07, 9, 8), M.white, 0, 4.5, 0));
  g.add(m(new THREE.SphereGeometry(0.09, 10, 8), M.chrome, 0, 9.05, 0));
  const t = canvasTexture(180, 110, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 180, 110); c.fillStyle = '#003580'; c.fillRect(50, 0, 30, 110); c.fillRect(0, 40, 180, 30); });
  const geo = new THREE.PlaneGeometry(1.8, 1.1, 12, 4);
  const flag = m(geo, new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.8 }), 0.9, 8.3, 0);
  flag.name = 'flag'; g.add(flag);
  g.userData.flag = flag;
  return g;
}
export function outhouse() {
  const M = mats(), g = G();
  return g;
}
export function wreck(color = 0x6a3a2a) {
  const M = mats(), g = G();
  const rust = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.4, map: tex('grime.jpg') });
  g.add(m(roundBox(1.6, 0.6, 4.0, 0.15), rust, 0, 0.5, 0, 0.03, 0, 0.05));
  g.add(m(roundBox(1.35, 0.5, 1.9, 0.15), rust, 0, 1.0, -0.2, 0, 0, 0.05));
  g.add(m(box(1.2, 0.4, 0.05), M.glassDark, 0, 1.0, 0.76, -0.5));
  for (const [x, z] of [[0.75, 1.3], [-0.75, -1.3]]) g.add(m(new THREE.TorusGeometry(0.25, 0.1, 8, 16), M.rubber, x, 0.25, z, 0, Math.PI / 2));
  return g;
}
export function toilet() {
  const M = mats(), g = G();
  const p = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.25 });
  g.add(m(cyl(0.18, 0.15, 0.4, 16), p, 0, 0.2, 0.05));
  g.add(m(cyl(0.2, 0.2, 0.04, 16), p, 0, 0.42, 0.05));
  g.add(m(box(0.4, 0.4, 0.18), p, 0, 0.6, -0.22));
  return g;
}
export function clock() {
  const g = G();
  const face = canvasTexture(128, 128, (c) => {
    c.fillStyle = '#f4efe2'; c.beginPath(); c.arc(64, 64, 62, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.fillRect(64 + Math.sin(a) * 50 - 2, 64 - Math.cos(a) * 50 - 5, 4, 10); }
  });
  g.add(m(cyl(0.16, 0.16, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0x5a3a1a }), 0, 0, 0, Math.PI / 2));
  g.add(m(new THREE.CircleGeometry(0.14, 24), new THREE.MeshStandardMaterial({ map: face }), 0, 0, 0.021));
  const hh = m(box(0.012, 0.08, 0.005), mats().blackPlastic, 0, 0, 0.025); hh.geometry.translate(0, 0.04, 0); hh.name = 'hour'; g.add(hh);
  const mh = m(box(0.008, 0.12, 0.005), mats().blackPlastic, 0, 0, 0.03); mh.geometry.translate(0, 0.06, 0); mh.name = 'min'; g.add(mh);
  g.userData.hands = { hh, mh };
  return g;
}
export function poster(text, w = 0.6, h = 0.8, bg = '#e8d8a0', fg = '#3a1a0a') {
  const t = canvasTexture(256, Math.round(256 * h / w), (c, W, H) => {
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.fillStyle = fg; c.textAlign = 'center';
    const lines = text.split('\n');
    lines.forEach((l, i) => { c.font = `bold ${i === 0 ? 34 : 22}px Arial`; c.fillText(l, W / 2, 60 + i * 40); });
  });
  const g = G(); g.add(m(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), 0, 0, 0)); return g;
}
export function signBoard(text, w = 3, h = 0.7, bg = '#1a3a6a', fg = '#ffffff', font = 'bold 80px Georgia') {
  const t = canvasTexture(1024, Math.round(1024 * h / w), (c, W, H) => {
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.strokeStyle = fg; c.lineWidth = 6; c.strokeRect(10, 10, W - 20, H - 20);
    c.fillStyle = fg; c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, W / 2, H / 2 + 4);
  });
  const g = G(); g.add(m(box(w, h, 0.06), [mats().darkWood, mats().darkWood, mats().darkWood, mats().darkWood, new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), mats().darkWood], 0, 0, 0)); return g;
}
export function carLift() {
  const M = mats(), g = G();
  return g;
}
export function batteryCharger() {
  const M = mats(), g = G();
  g.add(m(roundBox(0.3, 0.22, 0.2, 0.02), new THREE.MeshStandardMaterial({ color: 0xd06010, roughness: 0.5 }), 0, 0.11, 0));
  g.add(m(box(0.12, 0.06, 0.01), M.glassDark, 0, 0.16, 0.101));
  g.add(m(cyl(0.006, 0.006, 0.6, 4), new THREE.MeshStandardMaterial({ color: 0xc02020 }), 0.08, 0.05, 0.3, Math.PI / 2));
  g.add(m(cyl(0.006, 0.006, 0.6, 4), M.blackPlastic, -0.08, 0.05, 0.3, Math.PI / 2));
  return g;
}
export function tent(w = 4, d = 4, color = '#c02020') {
  const M = mats(), g = G();
  const t = canvasTexture(64, 64, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#fff' : color; c.fillRect(i * 8, 0, 8, 64); } });
  const fab = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, side: THREE.DoubleSide });
  for (const [x, z] of [[w / 2, d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]]) g.add(m(cyl(0.03, 0.03, 2.4, 6), M.metal, x, 1.2, z));
  const roof = new THREE.ConeGeometry(Math.hypot(w, d) / 2, 1.0, 4, 1, true); roof.rotateY(Math.PI / 4);
  g.add(m(roof, fab, 0, 2.9, 0));
  return g;
}
export function arch(text, w = 8) {
  const M = mats(), g = G();
  g.add(m(box(0.4, 4.5, 0.4), M.redPaint, -w / 2, 2.25, 0)); g.add(m(box(0.4, 4.5, 0.4), M.redPaint, w / 2, 2.25, 0));
  const t = canvasTexture(1024, 128, (c, W, H) => {
    c.fillStyle = '#111'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 32; i++) { c.fillStyle = i % 2 ? '#fff' : '#111'; c.fillRect(i * 32, 0, 32, 16); c.fillStyle = i % 2 ? '#111' : '#fff'; c.fillRect(i * 32, 112, 32, 16); }
    c.fillStyle = '#ffd020'; c.font = 'bold 70px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, W / 2, H / 2 + 3);
  });
  g.add(m(box(w + 0.4, 1, 0.2), [M.darkMetal, M.darkMetal, M.darkMetal, M.darkMetal, new THREE.MeshStandardMaterial({ map: t }), new THREE.MeshStandardMaterial({ map: t })], 0, 4.3, 0));
  return g;
}
