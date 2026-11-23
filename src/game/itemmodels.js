import * as THREE from 'three';
import { mesh, box, cyl, rbox, torus, sphere, lathe, tube, extrude, shapeExtrude, MAT, texMat, canvasTexture, tex, V2, V3 } from '../world/kit.js';

// Detailed meshes for everything the player can pick up. All are centred on the item's collider.
const G = () => new THREE.Group();
const T = {};
const ct = (key, w, h, draw) => (T[key] ||= canvasTexture(w, h, draw));

// ---------------------------------------------------------------- printed artwork
function brandLabel(name, sub, bg, fg, accent) {
  return ct('lbl' + name + sub + bg, 256, 128, (c) => {
    c.fillStyle = bg; c.fillRect(0, 0, 256, 128);
    c.fillStyle = accent; c.fillRect(0, 10, 256, 6); c.fillRect(0, 112, 256, 6);
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 40px Georgia'; c.fillText(name, 128, 54);
    c.font = 'bold 15px Arial'; c.fillText(sub, 128, 90);
    // little crane emblem
    c.strokeStyle = fg; c.lineWidth = 3; c.beginPath(); c.moveTo(20, 80); c.quadraticCurveTo(30, 40, 46, 30); c.lineTo(54, 36); c.stroke();
    c.beginPath(); c.moveTo(236, 80); c.quadraticCurveTo(226, 40, 210, 30); c.lineTo(202, 36); c.stroke();
  });
}
function canArt(name, bg, fg) {
  return ct('can' + name + bg, 256, 128, (c) => {
    const gr = c.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, bg); gr.addColorStop(1, shade(bg, -40)); c.fillStyle = gr; c.fillRect(0, 0, 256, 128);
    c.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(40 + i * 40, 100 - (i % 2) * 20, 14 + (i % 3) * 6, 0, 7); c.fill(); }
    c.fillStyle = fg; c.font = 'bold 34px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.save(); c.translate(64, 64); c.rotate(-Math.PI / 2); c.fillText(name, 0, 0); c.restore();
    c.save(); c.translate(192, 64); c.rotate(-Math.PI / 2); c.fillText(name, 0, 0); c.restore();
    c.font = 'bold 12px Arial'; c.fillText('0,33 l', 128, 112);
  });
}
function shade(hex, d) { const n = parseInt(hex.slice(1), 16); const r = Math.max(0, Math.min(255, (n >> 16) + d)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + d)), b = Math.max(0, Math.min(255, (n & 255) + d)); return `rgb(${r},${g},${b})`; }
function printBox(key, w, h, bg, lines, fg = '#fff', extra) {
  return ct(key, w, h, (c) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    if (extra) extra(c, w, h);
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach(([t, size, y]) => { c.font = `bold ${size}px Arial`; c.fillText(t, w / 2, y * h); });
  });
}
const cardboard = () => (T.cb ||= new THREE.MeshStandardMaterial({ color: 0xc8a070, roughness: 0.9, map: ct('cbt', 128, 128, (c) => { c.fillStyle = '#d0aa78'; c.fillRect(0, 0, 128, 128); for (let i = 0; i < 600; i++) { c.fillStyle = `rgba(120,80,40,${Math.random() * 0.15})`; c.fillRect(Math.random() * 128, Math.random() * 128, 2, 1); } }) }));

// ---------------------------------------------------------------- drinks
export function bottle(color = 0x5a2e08, lbl = 'KURKI', empty = false) {
  const g = G();
  const prof = [[0, 0], [0.028, 0.0], [0.031, 0.004], [0.031, 0.14], [0.029, 0.158], [0.02, 0.18], [0.0135, 0.205], [0.0125, 0.232], [0.0145, 0.236], [0.0145, 0.243], [0.012, 0.246], [0, 0.246]];
  const glass = new THREE.MeshPhysicalMaterial({ color, roughness: 0.06, metalness: 0, clearcoat: 1, transparent: true, opacity: empty ? 0.5 : 0.78 });
  const b = mesh(lathe(prof, 20), glass); b.position.y = -0.123; g.add(b);
  if (!empty) {
    const beer = mesh(lathe([[0, 0.004], [0.028, 0.006], [0.028, 0.14], [0.026, 0.156], [0.017, 0.18], [0.011, 0.2], [0, 0.2]], 16), new THREE.MeshStandardMaterial({ color: 0xc87a10, roughness: 0.3, transparent: true, opacity: 0.85 }));
    beer.position.y = -0.123; beer.scale.setScalar(0.97); g.add(beer);
    const cap = mesh(cyl(0.0155, 0.0155, 0.008, 21), MAT.paint(0xc8a020, 0.3)); cap.position.y = 0.124; g.add(cap);
  }
  const l = mesh(cyl(0.0315, 0.0315, 0.075, 20, true), new THREE.MeshStandardMaterial({ map: brandLabel(lbl, 'OLUT · 4,6 %', '#efe4c4', '#7a1a10', '#c8a020'), roughness: 0.55, side: THREE.DoubleSide }), 0, -0.06, 0);
  g.add(l);
  const nl = mesh(cyl(0.0145, 0.0185, 0.02, 16, true), MAT.paint(0x7a1a10, 0.4), 0, 0.075, 0); g.add(nl);
  return g;
}
export function can(bg, fg, name) {
  const g = G();
  const body = mesh(cyl(0.033, 0.033, 0.1, 24, true), new THREE.MeshStandardMaterial({ map: canArt(name, bg, fg), roughness: 0.28, metalness: 0.65 }), 0, 0, 0); g.add(body);
  const al = MAT.brushed();
  g.add(mesh(lathe([[0.033, 0.05], [0.029, 0.056], [0.0275, 0.059], [0.028, 0.061], [0.024, 0.058], [0, 0.057]], 24), al));
  g.add(mesh(lathe([[0, -0.06], [0.026, -0.06], [0.03, -0.056], [0.033, -0.05]], 24), al));
  g.add(mesh(rbox(0.012, 0.0015, 0.02, 0.0007), al, 0, 0.0585, 0.006));
  return g;
}
export function milkCarton() {
  const g = G();
  const art = printBox('milk', 256, 256, '#f4f4f0', [['MAITO', 48, 0.3], ['kevyt · 1 l', 18, 0.45]], '#1d5aa8', (c) => { c.fillStyle = '#2a6ab8'; c.fillRect(0, 150, 256, 106); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(128, 200, 60, 26, 0, 0, 7); c.fill(); c.fillStyle = '#2a6ab8'; c.font = 'bold 18px Arial'; c.textAlign = 'center'; c.fillText('KURKIJÄRVEN', 128, 206); });
  const m = new THREE.MeshStandardMaterial({ map: art, roughness: 0.5 });
  g.add(mesh(rbox(0.088, 0.165, 0.088, 0.004), m, 0, -0.0175, 0));
  const top = extrude([[-0.044, 0], [0.044, 0], [0, 0.03]], 0.088, 0.001); top.rotateY(Math.PI / 2);
  g.add(mesh(top, m, 0, 0.065, 0));
  g.add(mesh(box(0.004, 0.012, 0.09), m, 0, 0.1, 0));
  g.add(mesh(cyl(0.012, 0.012, 0.012, 14), MAT.plastic(0x2a6ab8, 0.4), 0.02, 0.085, 0.02, 0.55, 0, 0));
  return g;
}
export function beerCase() {
  const g = G();
  const side = brandLabel('KURKI OLUT', '24 x 0,33 l  ·  IV A', '#d8a420', '#5a1608', '#7a1a10');
  const end = printBox('caseEnd', 128, 128, '#d8a420', [['KURKI', 30, 0.4], ['24', 40, 0.72]], '#5a1608');
  const top = printBox('caseTop', 256, 128, '#c8941a', [['KURKI OLUT', 30, 0.5]], '#5a1608', (c) => { c.fillStyle = '#3a1406'; c.fillRect(30, 50, 40, 14); c.fillRect(186, 50, 40, 14); });
  const mats = [texMat(end), texMat(end), texMat(top), texMat(top), texMat(side), texMat(side)];
  g.add(mesh(box(0.4, 0.28, 0.28), mats));
  g.add(mesh(box(0.402, 0.004, 0.282), MAT.basic(0x6a4010), 0, 0.12, 0));
  return g;
}
export function thermos() {
  const g = G();
  g.add(mesh(lathe([[0, -0.14], [0.044, -0.14], [0.046, -0.13], [0.046, 0.06], [0.04, 0.08], [0.04, 0.1], [0, 0.1]], 24), MAT.paint(0xb02a1a, 0.3)));
  g.add(mesh(lathe([[0, 0.1], [0.042, 0.1], [0.046, 0.135], [0.044, 0.14], [0, 0.14]], 24), MAT.plastic(0x1a1a1a, 0.4)));
  g.add(mesh(torus(0.05, 0.006, 6, 24, Math.PI), MAT.steel(), 0, -0.02, 0, 0, 0, Math.PI / 2).rotateY(Math.PI / 2));
  for (const y of [-0.12, 0.045]) g.add(mesh(torus(0.0465, 0.003, 4, 24), MAT.chrome(), 0, y, 0, Math.PI / 2));
  return g;
}

// ---------------------------------------------------------------- food
function sausageGeo(len, r) {
  const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(V3((t - 0.5) * len, 0, Math.sin(t * Math.PI) * len * 0.12 - len * 0.06)); }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 12, false);
  return geo;
}
export function sausage(cooked) {
  const g = G();
  const len = cooked ? 0.2 : 0.19, r = 0.026;
  const skin = cooked
    ? new THREE.MeshStandardMaterial({ roughness: 0.45, map: ct('grill', 128, 32, (c) => { c.fillStyle = '#8a4220'; c.fillRect(0, 0, 128, 32); for (let x = 6; x < 128; x += 16) { c.fillStyle = '#2a1208'; c.fillRect(x, 0, 4, 32); } for (let i = 0; i < 80; i++) { c.fillStyle = 'rgba(255,200,120,0.15)'; c.fillRect(Math.random() * 128, Math.random() * 32, 2, 1); } }) })
    : new THREE.MeshPhysicalMaterial({ color: 0xd89a84, roughness: 0.35, clearcoat: 0.5 });
  const s = mesh(sausageGeo(len, r), skin); g.add(s);
  for (const k of [-1, 1]) { const e = mesh(sphere(r, 12, 8), skin, k * len / 2, 0, -len * 0.06); g.add(e); g.add(mesh(cyl(0.004, 0.006, 0.012, 6), MAT.basic(cooked ? 0x3a1808 : 0xb07060), k * (len / 2 + r + 0.003), 0, -len * 0.06, 0, 0, Math.PI / 2)); }
  if (!cooked) {
    g.add(mesh(rbox(0.235, 0.012, 0.095, 0.004), MAT.plastic(0xf0f0ec, 0.6), 0, -0.03, 0));
    g.add(mesh(rbox(0.24, 0.062, 0.1, 0.012), MAT.glass(0xffffff, 0.22), 0, 0.0, 0));
    const l = printBox('makkara', 256, 96, '#c81e24', [['GRILLIMAKKARA', 30, 0.38], ['400 g · KURKI-LIHA', 16, 0.75]], '#fff');
    g.add(mesh(new THREE.PlaneGeometry(0.12, 0.045), texMat(l), 0.04, 0.0315, 0.0, -Math.PI / 2));
  }
  return g;
}
export function ryeBread() {
  const g = G();
  const crust = new THREE.MeshStandardMaterial({ roughness: 0.95, map: ct('rye', 128, 128, (c) => { c.fillStyle = '#4a2812'; c.fillRect(0, 0, 128, 128); for (let i = 0; i < 500; i++) { c.fillStyle = Math.random() < 0.6 ? 'rgba(200,170,130,0.35)' : 'rgba(30,15,5,0.4)'; c.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } }) });
  const t = new THREE.TorusGeometry(0.068, 0.034, 12, 28); t.scale(1, 1, 0.72); t.rotateX(Math.PI / 2);
  g.add(mesh(t, crust));
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; g.add(mesh(sphere(0.004, 6, 4), MAT.basic(0x2a1408), Math.cos(a) * 0.068, 0.024, Math.sin(a) * 0.068)); }
  return g;
}
export function pizzaBox() {
  const g = G();
  const top = printBox('pizzaTop', 256, 256, '#b81818', [['PIZZA', 54, 0.2], ['ITALIANO · PAKASTE', 16, 0.88]], '#fff', (c) => { c.fillStyle = '#e8b04a'; c.beginPath(); c.arc(128, 135, 78, 0, 7); c.fill(); c.fillStyle = '#d84a20'; c.beginPath(); c.arc(128, 135, 66, 0, 7); c.fill(); c.fillStyle = '#f0d890'; for (let i = 0; i < 30; i++) { c.beginPath(); c.arc(70 + Math.random() * 116, 80 + Math.random() * 110, 6, 0, 7); c.fill(); } c.fillStyle = '#8a1a10'; for (let i = 0; i < 10; i++) { c.beginPath(); c.arc(80 + Math.random() * 96, 90 + Math.random() * 90, 9, 0, 7); c.fill(); } });
  const sideM = MAT.paint(0xb81818, 0.5);
  g.add(mesh(box(0.28, 0.04, 0.28), [sideM, sideM, texMat(top), sideM, sideM, sideM]));
  return g;
}
export function pizzaHot() {
  const g = G();
  const top = ct('pizzaHot', 256, 256, (c) => { c.fillStyle = '#d8402a'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#f4d47a'; for (let i = 0; i < 60; i++) { c.beginPath(); c.arc(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 10, 0, 7); c.fill(); } c.fillStyle = '#9a1a12'; for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(40 + Math.random() * 176, 40 + Math.random() * 176, 13, 0, 7); c.fill(); } c.fillStyle = '#3a7a2a'; for (let i = 0; i < 20; i++) c.fillRect(Math.random() * 256, Math.random() * 256, 6, 3); });
  g.add(mesh(cyl(0.118, 0.118, 0.012, 32), [MAT.basic(0xd8a050), texMat(top, { roughness: 0.5 }), MAT.basic(0xc89040)]));
  g.add(mesh(torus(0.118, 0.012, 8, 40), MAT.basic(0xd89a48), 0, 0.004, 0, Math.PI / 2));
  return g;
}
export function chipsBag() {
  const g = G();
  const art = printBox('chips', 256, 256, '#e89a18', [['SIPSI', 64, 0.3], ['suolattu', 20, 0.46]], '#7a1808', (c) => { c.fillStyle = '#f8d040'; for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(60 + (i % 3) * 70, 170 + Math.floor(i / 3) * 45, 30, 18, i, 0, 7); c.fill(); } });
  const geo = new THREE.BoxGeometry(0.2, 0.25, 0.07, 8, 10, 4); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = Math.cos((y / 0.125) * Math.PI / 2) * Math.cos((x / 0.1) * Math.PI / 2 * 0.6); p.setZ(i, z * (0.25 + 0.95 * Math.max(0, k))); }
  geo.computeVertexNormals();
  g.add(mesh(geo, new THREE.MeshStandardMaterial({ map: art, roughness: 0.3, metalness: 0.35 })));
  for (const y of [-0.122, 0.122]) g.add(mesh(box(0.2, 0.012, 0.006), MAT.plastic(0xc87810, 0.4), 0, y, 0));
  return g;
}
export function salmiakki() {
  const g = G();
  const art = printBox('salmiakki', 128, 160, '#111', [['SALMIAKKI', 18, 0.2]], '#fff', (c) => { c.fillStyle = '#e8e8e8'; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { c.save(); c.translate(32 + x * 32, 70 + y * 30); c.rotate(Math.PI / 4); c.fillRect(-9, -9, 18, 18); c.restore(); } });
  const blk = MAT.plastic(0x111111, 0.4);
  g.add(mesh(box(0.12, 0.16, 0.04), [blk, blk, blk, blk, texMat(art), texMat(art)]));
  return g;
}
export function fish(kind = 'perch', cooked = false) {
  const g = G();
  const len = kind === 'pike' ? 0.5 : 0.26;
  const skin = cooked ? MAT.basic(0xb07a30) : new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.8, map: ct('fish' + kind, 256, 64, (c) => {
    const top = kind === 'pike' ? '#3a4a22' : '#4a5a22', mid = kind === 'pike' ? '#7a8a4a' : '#9a9a3a', bel = '#e8e4d0';
    const gr = c.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, bel); c.fillStyle = gr; c.fillRect(0, 0, 256, 64);
    c.fillStyle = kind === 'pike' ? 'rgba(220,220,160,0.6)' : 'rgba(20,30,10,0.6)';
    if (kind === 'pike') for (let i = 0; i < 40; i++) { c.beginPath(); c.ellipse(Math.random() * 256, 10 + Math.random() * 30, 4, 2, 0, 0, 7); c.fill(); }
    else for (let i = 0; i < 7; i++) c.fillRect(30 + i * 30, 0, 10, 36);
  }) });
  const body = lathe([[0, 0], [0.12, 0.08], [0.17, 0.25], [0.18, 0.45], [0.14, 0.7], [0.07, 0.88], [0.04, 0.95], [0, 1]], 18);
  body.scale(len * 0.6, len, len * 0.24); body.rotateZ(Math.PI / 2); body.translate(len * 0.5, 0, 0);
  g.add(mesh(body, skin));
  const fin = cooked ? MAT.basic(0x8a5a20) : new THREE.MeshStandardMaterial({ color: kind === 'pike' ? 0x8a6a3a : 0xd05a2a, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const tail = extrude([[0, 0], [-0.5, 0.45], [-0.38, 0], [-0.5, -0.45]], 0.004); tail.scale(len * 0.35, len * 0.35, 1);
  g.add(mesh(tail, fin, -len * 0.47, 0, 0));
  const dors = extrude([[0, 0], [0.3, 0], [0.12, 0.18]], 0.003); dors.scale(len, len, 1);
  g.add(mesh(dors, fin, -len * 0.05, len * 0.09, 0));
  for (const s of [-1, 1]) { g.add(mesh(sphere(len * 0.03, 8, 6), MAT.basic(0xe8d060), len * 0.38, len * 0.03, s * len * 0.05)); g.add(mesh(sphere(len * 0.016, 6, 4), MAT.plastic(0x050505, 0.1), len * 0.39, len * 0.03, s * len * 0.06)); }
  return g;
}

// ---------------------------------------------------------------- fluids, tools
export function jug(color, title, sub, size = 1) {
  const g = G();
  const pl = MAT.plastic(color, 0.45);
  const W = 0.17 * size, H = 0.22 * size, D = 0.095 * size;
  g.add(mesh(rbox(W, H, D, 0.02 * size), pl, 0, -0.02 * size, 0));
  g.add(mesh(rbox(W * 0.55, 0.05 * size, D * 0.7, 0.015 * size), pl, -W * 0.18, H / 2 - 0.005 * size, 0));
  g.add(mesh(tube([[W * 0.08, H / 2 - 0.03 * size, 0], [W * 0.2, H / 2 + 0.03 * size, 0], [W * 0.42, H / 2 + 0.02 * size, 0], [W * 0.47, H / 2 - 0.06 * size, 0]], 0.012 * size, 16, 8), pl));
  g.add(mesh(cyl(0.02 * size, 0.022 * size, 0.035 * size, 16), pl, -W * 0.3, H / 2 + 0.03 * size, 0));
  g.add(mesh(cyl(0.024 * size, 0.024 * size, 0.022 * size, 18), MAT.plastic(0x1a1a1a, 0.4), -W * 0.3, H / 2 + 0.055 * size, 0));
  const art = printBox('jug' + title, 256, 256, '#f4f2ea', [[title.split('\n')[0], 34, 0.32], [title.split('\n')[1] || '', 34, 0.48], [sub, 22, 0.72]], '#1a1a1a', (c) => { c.fillStyle = '#' + color.toString(16).padStart(6, '0'); c.fillRect(0, 0, 256, 40); c.fillRect(0, 216, 256, 40); });
  g.add(mesh(new THREE.PlaneGeometry(W * 0.8, H * 0.6), texMat(art), 0, -0.03 * size, D / 2 + 0.001));
  g.add(mesh(new THREE.PlaneGeometry(W * 0.8, H * 0.6), texMat(art), 0, -0.03 * size, -D / 2 - 0.001, 0, Math.PI, 0));
  return g;
}
export function jerryCan() {
  const g = G();
  const p = MAT.paint(0x2e6a2a, 0.45);
  g.add(mesh(rbox(0.34, 0.4, 0.16, 0.025), p, 0, -0.02, 0));
  // pressed X ribs on both faces
  for (const s of [-1, 1]) for (const d of [-1, 1]) g.add(mesh(rbox(0.36, 0.022, 0.012, 0.006), p, 0, -0.02, s * 0.082, 0, 0, d * 0.83));
  // triple handle
  for (const x of [-0.11, 0, 0.11]) g.add(mesh(rbox(0.025, 0.06, 0.03, 0.008), p, x, 0.205, 0));
  g.add(mesh(rbox(0.26, 0.022, 0.03, 0.009), p, 0, 0.24, 0));
  // spout with lever cap
  g.add(mesh(cyl(0.025, 0.028, 0.04, 16), MAT.steel(), 0.13, 0.195, 0, 0, 0, -0.5));
  g.add(mesh(rbox(0.06, 0.012, 0.04, 0.005), MAT.steel(), 0.14, 0.222, 0, 0, 0, -0.5));
  const lbl = printBox('jerry', 128, 64, '#e8d040', [['BENSIINI', 22, 0.5]], '#111');
  g.add(mesh(new THREE.PlaneGeometry(0.1, 0.05), texMat(lbl), -0.1, 0.12, 0.081));
  return g;
}
export function sprayCan(color = 0xb02018) {
  const g = G();
  const c = new THREE.Color(color);
  g.add(mesh(cyl(0.03, 0.03, 0.15, 20), new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.6 }), 0, -0.02, 0));
  g.add(mesh(lathe([[0.03, 0.055], [0.026, 0.07], [0.012, 0.078], [0.01, 0.08], [0, 0.08]], 20), MAT.chrome()));
  g.add(mesh(lathe([[0, -0.1], [0.028, -0.1], [0.03, -0.095]], 20), MAT.chrome()));
  g.add(mesh(cyl(0.008, 0.008, 0.016, 10), MAT.plastic(0xf0f0f0), 0, 0.09, 0));
  g.add(mesh(box(0.006, 0.006, 0.008), MAT.plastic(0x222222), 0, 0.094, 0.006));
  g.add(mesh(cyl(0.0305, 0.0305, 0.04, 20, true), MAT.plastic(0xf0f0ea, 0.5), 0, -0.04, 0));
  return g;
}
export function axe() {
  const g = G();
  const wood = new THREE.MeshStandardMaterial({ color: 0xc08a50, roughness: 0.6, map: tex('planks_raw.jpg') });
  const handle = lathe([[0, -0.4], [0.02, -0.4], [0.024, -0.37], [0.016, -0.3], [0.015, 0.1], [0.017, 0.3], [0.016, 0.38], [0, 0.38]], 10);
  handle.scale(1, 1, 0.75);
  g.add(mesh(handle, wood));
  // Finnish-style axe head: extruded profile with a bright ground edge
  const head = extrude([[-0.025, 0.035], [0.02, 0.035], [0.13, 0.065], [0.15, 0.0], [0.13, -0.07], [0.02, -0.03], [-0.025, -0.03]], 0.026, 0.003);
  head.rotateY(-Math.PI / 2);
  g.add(mesh(head, MAT.paint(0x2a2a2e, 0.5), 0, 0.33, 0));
  const edge = extrude([[0.11, 0.06], [0.15, 0.0], [0.11, -0.065], [0.125, 0.0]], 0.02, 0.001); edge.rotateY(-Math.PI / 2);
  g.add(mesh(edge, MAT.chrome(), 0, 0.33, 0));
  return g;
}
const endGrain = () => (T.endg ||= texMat(ct('endgrain', 128, 128, (c) => { c.fillStyle = '#e0c49a'; c.fillRect(0, 0, 128, 128); for (let r = 3; r < 64; r += 3 + Math.random() * 3) { c.strokeStyle = `rgba(150,100,50,${0.2 + Math.random() * 0.3})`; c.lineWidth = 1; c.beginPath(); c.arc(64, 64, r, 0, 7); c.stroke(); } c.strokeStyle = 'rgba(90,50,20,0.5)'; c.beginPath(); c.moveTo(64, 64); c.lineTo(120, 80); c.stroke(); }), { roughness: 0.9 }));
const birchBark = () => (T.bark ||= new THREE.MeshStandardMaterial({ map: tex('bark_birch.jpg'), normalMap: tex('bark_birch_n.jpg', { srgb: false }), roughness: 0.85 }));
export function log() {
  const g = G();
  const geo = new THREE.CylinderGeometry(0.125, 0.13, 0.5, 16, 2); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + Math.sin(a * 3 + 1) * 0.04 + Math.sin(a * 7) * 0.02; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  geo.computeVertexNormals();
  g.add(mesh(geo, [birchBark(), endGrain(), endGrain()]));
  return g;
}
export function firewood() {
  const g = G();
  const r = 0.085, L = 0.44;
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(r, 0); s.absarc(0, 0, r, 0, Math.PI / 2.2, false); s.lineTo(0, 0);
  const wedge = shapeExtrude(s, L, 0, 10);
  const split = new THREE.MeshStandardMaterial({ color: 0xe8cfa4, roughness: 0.95, map: tex('planks_raw.jpg') });
  const m1 = mesh(wedge, [endGrain(), split], -0.03, -0.03, 0); g.add(m1);
  const shell = new THREE.CylinderGeometry(r + 0.004, r + 0.004, L, 10, 1, true, Math.PI / 2, Math.PI / 2.2);
  shell.rotateX(Math.PI / 2);
  g.add(mesh(shell, birchBark(), -0.03, -0.03, 0));
  return g;
}
export function fishingRod() {
  const g = G();
  g.add(mesh(lathe([[0, -0.8], [0.013, -0.8], [0.013, -0.55], [0.009, -0.5], [0.006, 0.0], [0.002, 0.8], [0, 0.8]], 8), MAT.plastic(0x1a2a3a, 0.25)).rotateX(Math.PI / 2));
  g.add(mesh(cyl(0.017, 0.016, 0.25, 12), new THREE.MeshStandardMaterial({ color: 0xc8a070, roughness: 0.95, map: tex('noise.jpg') }), 0, 0, -0.66, Math.PI / 2));
  for (let i = 0; i < 6; i++) g.add(mesh(torus(0.008 - i * 0.0008, 0.0012, 4, 10), MAT.chrome(), 0, 0.012, -0.35 + i * 0.22));
  const reel = G();
  reel.add(mesh(cyl(0.032, 0.032, 0.03, 18), MAT.paint(0x8a8a8a, 0.3), 0, 0, 0, 0, 0, Math.PI / 2));
  reel.add(mesh(cyl(0.022, 0.022, 0.032, 18), MAT.plastic(0xe0e0c0, 0.4), 0, 0, 0, 0, 0, Math.PI / 2));
  reel.add(mesh(rbox(0.006, 0.05, 0.01, 0.002), MAT.plastic(0x111111), 0.02, 0.02, 0));
  reel.position.set(0, -0.04, -0.52); g.add(reel);
  g.add(mesh(box(0.006, 0.03, 0.01), MAT.steel(), 0, -0.02, -0.52));
  return g;
}
export function newspaper() {
  const g = G();
  const front = ct('paper', 256, 192, (c) => { c.fillStyle = '#eeeae0'; c.fillRect(0, 0, 256, 192); c.fillStyle = '#111'; c.font = 'bold 26px Georgia'; c.textAlign = 'center'; c.fillText('KURKI-SANOMAT', 128, 30); c.fillRect(10, 38, 236, 2); c.font = 'bold 15px Arial'; c.textAlign = 'left'; c.fillText('HELLE JATKUU — HIRVI', 10, 60); c.fillText('NÄHTIIN KAUPALLA', 10, 78); c.fillStyle = '#777'; c.fillRect(150, 50, 96, 70); c.fillStyle = '#555'; for (let y = 90; y < 186; y += 7) { c.fillRect(10, y, 130, 3); if (y > 126) c.fillRect(150, y, 96, 3); } });
  const pm = MAT.basic(0xe8e4da);
  g.add(mesh(box(0.24, 0.03, 0.16), [pm, pm, texMat(front, { roughness: 0.9 }), pm, pm, pm]));
  const band = mesh(box(0.012, 0.032, 0.162), MAT.plastic(0xc83020, 0.5), 0.07, 0, 0); g.add(band);
  return g;
}
export function deliveryBox(dest = '') {
  const g = G();
  const lbl = ct('dlb' + dest, 128, 96, (c) => { c.fillStyle = '#f4f2ea'; c.fillRect(0, 0, 128, 96); c.fillStyle = '#111'; c.font = 'bold 13px Arial'; c.fillText('KUORMURI OY', 8, 18); c.font = '12px Arial'; c.fillText('→ ' + (dest || 'VASTAANOTTAJA'), 8, 42); c.fillStyle = '#111'; for (let x = 8; x < 120; x += 3) c.fillRect(x, 60, Math.random() < 0.5 ? 1 : 2, 26); });
  g.add(mesh(rbox(0.5, 0.4, 0.4, 0.004), cardboard()));
  g.add(mesh(box(0.502, 0.004, 0.06), MAT.plastic(0xc8b890, 0.3), 0, 0.2, 0));
  g.add(mesh(box(0.06, 0.402, 0.004), MAT.plastic(0xc8b890, 0.3), 0, 0, 0.2));
  g.add(mesh(new THREE.PlaneGeometry(0.16, 0.12), texMat(lbl), 0.12, 0.05, 0.2015));
  const fr = printBox('fragile', 128, 64, '#d02020', [['SÄRKYVÄÄ', 22, 0.5]], '#fff');
  g.add(mesh(new THREE.PlaneGeometry(0.14, 0.07), texMat(fr), 0.251, 0.08, 0, 0, Math.PI / 2, 0));
  return g;
}
export function hayBale() {
  const g = G();
  const wrap = new THREE.MeshPhysicalMaterial({ color: 0xf2f2ec, roughness: 0.35, clearcoat: 0.6, map: ct('wrap', 256, 64, (c) => { c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, 256, 64); for (let i = 0; i < 40; i++) { c.strokeStyle = `rgba(150,150,140,${0.2 + Math.random() * 0.2})`; c.beginPath(); const x = Math.random() * 256; c.moveTo(x, 0); c.quadraticCurveTo(x + 20, 32, x - 10, 64); c.stroke(); } c.fillStyle = 'rgba(80,140,60,0.25)'; c.fillRect(0, 28, 256, 6); }) });
  const geo = new THREE.CylinderGeometry(0.62, 0.62, 1.2, 28, 1); geo.rotateZ(Math.PI / 2);
  g.add(mesh(geo, wrap));
  for (const s of [-1, 1]) g.add(mesh(torus(0.58, 0.04, 8, 32), wrap, s * 0.6, 0, 0, 0, Math.PI / 2, 0));
  return g;
}
export function letter(title = 'POSTI') {
  const g = G();
  const env = ct('env' + title, 256, 160, (c) => { c.fillStyle = '#f4f0e4'; c.fillRect(0, 0, 256, 160); c.fillStyle = '#b02a20'; c.fillRect(200, 12, 42, 50); c.fillStyle = '#fff'; c.fillRect(204, 16, 34, 42); c.fillStyle = '#2a5a9a'; c.fillRect(208, 20, 26, 34); c.strokeStyle = '#333'; c.beginPath(); c.arc(190, 40, 18, 0, 7); c.stroke(); c.fillStyle = '#222'; c.font = '16px Georgia'; c.fillText('Veikko Kurki', 60, 96); c.fillText('Kurkijärventie 12', 60, 116); c.fillText('KURKIJÄRVI', 60, 136); });
  const pm = MAT.basic(0xefeadc);
  g.add(mesh(box(0.2, 0.006, 0.12), [pm, pm, texMat(env), pm, pm, pm]));
  return g;
}
export function trophy() {
  const g = G();
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xe8b830, metalness: 1, roughness: 0.18, clearcoat: 0.5 });
  g.add(mesh(rbox(0.12, 0.06, 0.12, 0.008), MAT.darkWood(), 0, -0.12, 0));
  g.add(mesh(lathe([[0, -0.09], [0.035, -0.09], [0.012, -0.07], [0.01, -0.02], [0.02, -0.01], [0.06, 0.04], [0.07, 0.11], [0.066, 0.115], [0.055, 0.05], [0, 0.03]], 24), gold));
  for (const s of [-1, 1]) g.add(mesh(torus(0.028, 0.005, 6, 16, Math.PI * 1.2), gold, s * 0.068, 0.07, 0, 0, 0, s > 0 ? -Math.PI * 0.6 : Math.PI * 0.4));
  const pl = printBox('plaque', 128, 48, '#d8c070', [['KURKI-SPRINT', 16, 0.35], ['1997', 16, 0.75]], '#3a2a08');
  g.add(mesh(new THREE.PlaneGeometry(0.09, 0.034), texMat(pl, { metalness: 0.6, roughness: 0.3 }), 0, -0.12, 0.0605));
  return g;
}
export function antler() {
  const g = G();
  const m = new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 0.75 });
  const s = new THREE.Shape(); s.moveTo(-0.05, -0.02); s.quadraticCurveTo(0.05, 0.06, 0.2, 0.08);
  for (let i = 0; i < 5; i++) { const x = 0.2 - i * 0.06; s.lineTo(x + 0.01, 0.17 + (i % 2) * 0.03); s.lineTo(x - 0.03, 0.09); }
  s.lineTo(-0.08, 0.05); s.lineTo(-0.1, 0.0); s.lineTo(-0.05, -0.02);
  const geo = shapeExtrude(s, 0.03, 0.008, 6); geo.rotateX(-Math.PI / 2); geo.translate(-0.05, 0, 0.1);
  g.add(mesh(geo, m));
  g.add(mesh(cyl(0.025, 0.03, 0.08, 10), m, -0.12, 0, 0.1, 0, 0, Math.PI / 2));
  return g;
}
export function toolCase(color, title) {
  const g = G();
  const p = MAT.paint(color, 0.35);
  g.add(mesh(rbox(0.3, 0.08, 0.16, 0.012), p));
  g.add(mesh(box(0.302, 0.004, 0.162), MAT.plastic(0x1a1a1a), 0, 0.005, 0));
  for (const x of [-0.08, 0.08]) g.add(mesh(rbox(0.03, 0.03, 0.01, 0.003), MAT.chrome(), x, 0.005, 0.083));
  g.add(mesh(tube([[-0.05, 0.0, 0.08], [-0.04, 0.0, 0.1], [0.04, 0.0, 0.1], [0.05, 0.0, 0.08]], 0.006, 10, 6), MAT.plastic(0x111111)));
  const l = printBox('tc' + title, 256, 64, '#111', [[title, 26, 0.55]], '#fff');
  g.add(mesh(new THREE.PlaneGeometry(0.2, 0.05), texMat(l), 0, 0.0405, 0, -Math.PI / 2));
  return g;
}
export function gauge() {
  const g = G();
  g.add(mesh(rbox(0.16, 0.12, 0.07, 0.012), MAT.plastic(0x1e1e1e, 0.4)));
  const face = ct('afr', 128, 96, (c) => { c.fillStyle = '#0a1a10'; c.fillRect(0, 0, 128, 96); c.fillStyle = '#30ff60'; c.font = 'bold 30px monospace'; c.fillText('13.2', 22, 44); c.font = '12px monospace'; c.fillText('AFR   10°BTDC', 10, 76); });
  g.add(mesh(new THREE.PlaneGeometry(0.12, 0.08), new THREE.MeshStandardMaterial({ map: face, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: 0.6 }), 0, 0.005, 0.0355));
  g.add(mesh(tube([[0.06, -0.04, -0.02], [0.1, -0.06, -0.04], [0.12, -0.1, 0.0]], 0.005, 10, 6), MAT.plastic(0x111111)));
  return g;
}
export function firstAid() {
  const g = G();
  const w = MAT.plastic(0xf2f2ee, 0.35);
  g.add(mesh(rbox(0.24, 0.1, 0.16, 0.015), w));
  const art = printBox('fa', 128, 96, '#f2f2ee', [], '#fff', (c) => { c.fillStyle = '#d02020'; c.fillRect(50, 18, 28, 60); c.fillRect(34, 34, 60, 28); });
  g.add(mesh(new THREE.PlaneGeometry(0.14, 0.1), texMat(art), 0, 0.0505, 0, -Math.PI / 2));
  g.add(mesh(box(0.242, 0.012, 0.162), MAT.plastic(0xd02020, 0.4), 0, 0, 0));
  g.add(mesh(tube([[-0.04, 0.0, 0.08], [-0.03, 0.0, 0.1], [0.03, 0.0, 0.1], [0.04, 0.0, 0.08]], 0.006, 10, 6), MAT.plastic(0x2a2a2a)));
  return g;
}
export function shoppingBag() {
  const g = G();
  const art = printBox('bag', 256, 256, '#fafaf6', [['KURKIMÄEN', 30, 0.42], ['KAUPPA', 40, 0.58]], '#b02018', (c) => { c.fillStyle = '#b02018'; c.fillRect(0, 0, 256, 16); });
  const geo = new THREE.BoxGeometry(0.3, 0.3, 0.18, 6, 6, 4); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) * (1 - Math.max(0, y) * 1.6) + Math.sin(p.getX(i) * 40) * 0.004); p.setX(i, p.getX(i) * (1 + Math.sin(y * 9) * 0.03)); }
  geo.computeVertexNormals();
  g.add(mesh(geo, new THREE.MeshStandardMaterial({ map: art, roughness: 0.55, side: THREE.DoubleSide }), 0, -0.02, 0));
  for (const s of [-1, 1]) g.add(mesh(torus(0.045, 0.005, 5, 14, Math.PI), MAT.plastic(0xf4f4f0, 0.5), s * 0.07, 0.13, 0));
  g.add(mesh(cyl(0.022, 0.022, 0.12, 10), MAT.basic(0xd8a850), -0.06, 0.16, 0.02, 0.3, 0, 0.2));
  return g;
}
