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
export function barStool() {
  const M = mats(), g = G();
  g.add(m(cyl(0.18, 0.18, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.5 }), 0, 0.75, 0));
  g.add(m(cyl(0.03, 0.03, 0.72, 8), M.chrome, 0, 0.36, 0));
  g.add(m(cyl(0.2, 0.2, 0.02, 16), M.chrome, 0, 0.01, 0));
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
  // split birch: wedge-shaped pieces with bark on the outside and end grain on the cut ends
  const endT = canvasTexture(128, 128, (c) => { c.fillStyle = '#dcc094'; c.fillRect(0, 0, 128, 128); for (let r = 4; r < 128; r += 5 + Math.random() * 4) { c.strokeStyle = `rgba(140,95,50,${0.2 + Math.random() * 0.25})`; c.beginPath(); c.arc(0, 128, r, 0, 7); c.stroke(); } });
  const end = new THREE.MeshStandardMaterial({ map: endT, roughness: 0.9 });
  const bark = new THREE.MeshStandardMaterial({ map: tex('bark_birch.jpg', { repeat: [1, 0.6] }), normalMap: tex('bark_birch_n.jpg', { srgb: false }), roughness: 0.85 });
  const split = new THREE.MeshStandardMaterial({ color: 0xe0c494, roughness: 0.95 });
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.1, 0); sh.absarc(0, 0, 0.1, 0, Math.PI / 2, false); sh.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 5 }); geo.translate(-0.035, -0.035, -d / 2);
  const rows = Math.floor(h / 0.12), cols = Math.floor(w / 0.13);
  const n = rows * cols;
  const im = new THREE.InstancedMesh(geo, [end, split], n);
  const shell = new THREE.CylinderGeometry(0.103, 0.103, d, 6, 1, true, Math.PI / 2, Math.PI / 2); shell.rotateX(Math.PI / 2); shell.translate(-0.035, -0.035, 0);
  const imB = new THREE.InstancedMesh(shell, bark, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    e.set(0, 0, Math.random() * Math.PI * 2); q.setFromEuler(e);
    const s = 0.85 + Math.random() * 0.3;
    m4.compose(new THREE.Vector3(-w / 2 + 0.065 + c * 0.13 + (r % 2) * 0.04, 0.065 + r * 0.12, (Math.random() - 0.5) * 0.08), q, new THREE.Vector3(s, s, 1));
    im.setMatrixAt(k, m4); imB.setMatrixAt(k, m4); k++;
  }
  for (const o of [im, imB]) { o.castShadow = true; o.receiveShadow = true; g.add(o); }
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

// detailed versions with moving parts live in props2.js
export { metalShelf, oilDrum, tireStack, shopShelf, beerFridge, slotMachine, mailbox, stove, fridge, counter, tv, phone, toilet, bed, kiuas, bucket, choppingBlock, batteryCharger, jackStand, engineStand, engineHoist, workbench, gasPump, register, radio } from './props2.js';
