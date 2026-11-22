import * as THREE from 'three';
import { mats } from '../world/mats.js';
import { roundBox, canvasTexture } from '../core/util.js';
import { tex } from '../core/assets.js';

// ---------------------------------------------------------------- shared part materials
let PM = null;
export function partMats() {
  if (PM) return PM;
  const M = mats();
  PM = {
    iron: new THREE.MeshStandardMaterial({ color: 0x4a4c50, map: tex('cast.jpg'), normalMap: tex('cast_n.jpg', { srgb: false }), roughness: 0.75, metalness: 0.55 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xb8bcc0, map: tex('cast.jpg'), normalMap: tex('cast_n.jpg', { srgb: false }), roughness: 0.45, metalness: 0.8 }),
    paintedBlue: new THREE.MeshStandardMaterial({ color: 0x2a4a7a, roughness: 0.35, metalness: 0.3 }),
    paintedRed: new THREE.MeshStandardMaterial({ color: 0xa82018, roughness: 0.3, metalness: 0.3 }),
    black: new THREE.MeshStandardMaterial({ color: 0x18191a, roughness: 0.55, metalness: 0.4 }),
    blackMatte: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85, metalness: 0.1 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8a8e92, roughness: 0.35, metalness: 0.9 }),
    rusty: new THREE.MeshStandardMaterial({ color: 0x6a4a3a, map: tex('grime.jpg'), roughness: 0.8, metalness: 0.5 }),
    chrome: M.chrome,
    rubber: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92, metalness: 0 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, map: tex('tread.jpg'), normalMap: tex('tread_n.jpg', { srgb: false }) }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb08a40, roughness: 0.35, metalness: 0.9 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xa8603a, roughness: 0.35, metalness: 0.9 }),
    exhaust: new THREE.MeshStandardMaterial({ color: 0x5a4a40, map: tex('grime.jpg'), roughness: 0.7, metalness: 0.7 }),
    radiator: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.6, map: radiatorTex() }),
    plasticWhite: new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.4 }),
    plasticRed: new THREE.MeshStandardMaterial({ color: 0xb01a10, roughness: 0.35, transparent: true, opacity: 0.85, emissive: 0x300000 }),
    plasticAmber: new THREE.MeshStandardMaterial({ color: 0xe08010, roughness: 0.3, transparent: true, opacity: 0.85 }),
    lens: new THREE.MeshStandardMaterial({ color: 0xf0f4ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.5 }),
    reflector: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 1, emissive: 0x000000 }),
    fabric: M.fabric, vinyl: M.vinyl,
    carpet: new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 1, map: tex('fabric.jpg') }),
    battery: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }),
    wire: new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.6 }),
    redWire: new THREE.MeshStandardMaterial({ color: 0xa01a10, roughness: 0.6 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.4, metalness: 0.2 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xd06010, roughness: 0.4, metalness: 0.2 }),
    gauge: new THREE.MeshStandardMaterial({ map: gaugeTex(), roughness: 0.3, emissive: 0xffffff, emissiveMap: gaugeTex(), emissiveIntensity: 0.0 }),
  };
  return PM;
}
function radiatorTex() {
  return canvasTexture(64, 64, (c) => { c.fillStyle = '#2a2a2a'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#4a4a4a'; for (let i = 0; i < 64; i += 3) c.fillRect(i, 0, 1, 64); c.fillStyle = '#1a1a1a'; for (let j = 0; j < 64; j += 8) c.fillRect(0, j, 64, 2); });
}
let _gt = null;
function gaugeTex() {
  if (_gt) return _gt;
  _gt = canvasTexture(256, 128, (c) => {
    c.fillStyle = '#0a0a0a'; c.fillRect(0, 0, 256, 128);
    for (const [cx, lab, max] of [[64, 'km/h', 180], [192, 'x1000 r/min', 8]]) {
      c.strokeStyle = '#ddd'; c.lineWidth = 2; c.beginPath(); c.arc(cx, 64, 56, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#eee'; c.font = '11px Arial'; c.textAlign = 'center';
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * 0.75 + i / 8 * Math.PI * 1.5;
        c.fillRect(cx + Math.cos(a) * 48 - 1, 64 + Math.sin(a) * 48 - 1, 3, 3);
        c.fillText(String(Math.round(i / 8 * max)), cx + Math.cos(a) * 38, 68 + Math.sin(a) * 38);
      }
      c.font = '9px Arial'; c.fillText(lab, cx, 100);
      if (max === 8) { c.strokeStyle = '#c02020'; c.lineWidth = 5; c.beginPath(); c.arc(cx, 64, 50, Math.PI * 0.75 + 6.5 / 8 * Math.PI * 1.5, Math.PI * 2.25); c.stroke(); }
    }
  });
  return _gt;
}

// ---------------------------------------------------------------- geometry helpers
const mesh = (g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; return o; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r1, r2, h, s = 16) => new THREE.CylinderGeometry(r1, r2, h, s);
const G = (...children) => { const g = new THREE.Group(); children.forEach((c) => g.add(c)); return g; };
function tube(points, r, m, seg = 24) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(curve, seg, r, 8, false), m);
}
function bolts(g, positions, size = 0.012) {
  const P = partMats();
  for (const p of positions) g.add(mesh(cyl(size, size, size * 0.9, 6), P.steel, p[0], p[1], p[2], p[3] || 0, 0, p[4] || 0));
  return g;
}
function spring(r, h, turns, wire, m) {
  const pts = [];
  for (let i = 0; i <= turns * 16; i++) { const a = i / 16 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, i / (turns * 16) * h - h / 2, Math.sin(a) * r)); }
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 16, wire, 6, false), m);
}

// ---------------------------------------------------------------- mesh builders
const B = {
  block: () => {
    const P = partMats(), g = new THREE.Group();
    g.add(mesh(roundBox(0.34, 0.3, 0.5, 0.02), P.iron, 0, 0, 0));
    g.add(mesh(box(0.3, 0.08, 0.44), P.iron, 0, -0.16, 0));
    for (let i = 0; i < 4; i++) g.add(mesh(box(0.36, 0.018, 0.03), P.iron, 0, 0.04, -0.18 + i * 0.12)); // ribs
    for (let i = 0; i < 4; i++) g.add(mesh(cyl(0.04, 0.04, 0.01, 16), P.blackMatte, 0, 0.151, -0.195 + i * 0.13)); // bores top
    g.add(mesh(box(0.06, 0.06, 0.06), P.iron, 0.19, -0.05, 0.12)); // mount
    g.add(mesh(box(0.06, 0.06, 0.06), P.iron, -0.19, -0.05, 0.12));
    const stamp = canvasTexture(128, 32, (c) => { c.fillStyle = '#4a4c50'; c.fillRect(0, 0, 128, 32); c.fillStyle = '#7a7c80'; c.font = 'bold 18px Arial'; c.fillText('R1300 •', 10, 22); });
    g.add(mesh(new THREE.PlaneGeometry(0.16, 0.04), new THREE.MeshStandardMaterial({ map: stamp, roughness: 0.8, metalness: 0.4 }), 0.171, 0.0, -0.05, 0, Math.PI / 2));
    return g;
  },
  crank: () => {
    const P = partMats(), g = new THREE.Group();
    g.add(mesh(cyl(0.025, 0.025, 0.56, 12), P.steel, 0, 0, 0, Math.PI / 2));
    for (let i = 0; i < 4; i++) { g.add(mesh(box(0.1, 0.05, 0.02), P.iron, 0, (i % 3 === 0 ? 1 : -1) * 0.025, -0.2 + i * 0.13)); g.add(mesh(box(0.1, 0.05, 0.02), P.iron, 0, (i % 3 === 0 ? 1 : -1) * 0.025, -0.16 + i * 0.13)); }
    return g;
  },
  piston: () => {
    const P = partMats(), g = new THREE.Group();
    g.add(mesh(cyl(0.037, 0.037, 0.06, 16), P.alu, 0, 0, 0));
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.TorusGeometry(0.0372, 0.002, 4, 16), P.steel, 0, 0.02 - i * 0.008, 0, Math.PI / 2));
    g.add(mesh(box(0.016, 0.12, 0.024), P.steel, 0, -0.09, 0));
    g.add(mesh(cyl(0.022, 0.022, 0.02, 12), P.steel, 0, -0.15, 0, 0, 0, Math.PI / 2));
    return g;
  },
  gasket: () => {
    const P = partMats(), g = new THREE.Group();
    const s = new THREE.Shape(); s.moveTo(-0.17, -0.25); s.lineTo(0.17, -0.25); s.lineTo(0.17, 0.25); s.lineTo(-0.17, 0.25); s.closePath();
    for (let i = 0; i < 4; i++) { const h = new THREE.Path(); h.absarc(0, -0.195 + i * 0.13, 0.04, 0, Math.PI * 2); s.holes.push(h); }
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: false }); geo.rotateX(Math.PI / 2);
    g.add(mesh(geo, new THREE.MeshStandardMaterial({ color: 0x9a9a8a, roughness: 0.3, metalness: 0.7 })));
    return g;
  },
  head: () => {
    const P = partMats(), g = new THREE.Group();
    g.add(mesh(roundBox(0.32, 0.12, 0.52, 0.015), P.alu));
    for (let i = 0; i < 5; i++) bolts(g, [[0.14, 0.06, -0.22 + i * 0.11], [-0.14, 0.06, -0.22 + i * 0.11]], 0.012);
    for (let i = 0; i < 4; i++) g.add(mesh(box(0.04, 0.05, 0.045), P.alu, -0.17, -0.01, -0.195 + i * 0.13)); // intake ports
    for (let i = 0; i < 4; i++) g.add(mesh(box(0.04, 0.05, 0.045), P.alu, 0.17, -0.01, -0.195 + i * 0.13)); // exhaust ports
    return g;
  },
  cam: () => {
    const P = partMats(), g = new THREE.Group();
    g.add(mesh(cyl(0.013, 0.013, 0.5, 10), P.steel, 0, 0, 0, Math.PI / 2));
    for (let i = 0; i < 8; i++) g.add(mesh(cyl(0.02, 0.02, 0.014, 3), P.steel, 0, 0, -0.21 + i * 0.06, Math.PI / 2));
    return g;
  },
  camGear: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.05, 0.05, 0.012, 24), P.steel, 0, 0, 0, Math.PI / 2)); g.add(mesh(new THREE.TorusGeometry(0.05, 0.004, 4, 24), P.steel, 0, 0, 0)); return g; },
  chain: () => { const P = partMats(); const g = new THREE.Group(); g.add(tube([[0, 0.2, 0], [0.05, 0.1, 0], [0.04, -0.15, 0], [0, -0.19, 0], [-0.04, -0.15, 0], [-0.05, 0.1, 0], [0, 0.2, 0]], 0.006, P.steel, 40)); return g; },
  tcover: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(roundBox(0.24, 0.42, 0.04, 0.015), P.alu)); bolts(g, [[0.1, 0.18, 0.02, Math.PI / 2], [-0.1, 0.18, 0.02, Math.PI / 2], [0.1, -0.18, 0.02, Math.PI / 2], [-0.1, -0.18, 0.02, Math.PI / 2]]); return g; },
  rockers: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.01, 0.01, 0.48, 8), P.steel, 0, 0, 0, Math.PI / 2)); for (let i = 0; i < 8; i++) g.add(mesh(box(0.07, 0.015, 0.015), P.steel, 0, 0.005, -0.21 + i * 0.06)); return g; },
  rcover: (v) => {
    const P = partMats(), g = new THREE.Group();
    const mat = v === 'race' ? P.paintedRed : P.paintedBlue;
    g.add(mesh(roundBox(0.28, 0.07, 0.5, 0.03), mat));
    for (let i = 0; i < 4; i++) g.add(mesh(box(0.2, 0.008, 0.02), mat, 0, 0.038, -0.15 + i * 0.1));
    g.add(mesh(cyl(0.025, 0.025, 0.025, 12), P.black, 0.06, 0.045, 0.15)); // oil cap
    const t = canvasTexture(128, 24, (c) => { c.fillStyle = v === 'race' ? '#a82018' : '#2a4a7a'; c.fillRect(0, 0, 128, 24); c.fillStyle = '#ddd'; c.font = 'bold 16px Arial'; c.fillText(v === 'race' ? 'RUSKA SPORT' : 'RUSKA 1300', 6, 18); });
    g.add(mesh(new THREE.PlaneGeometry(0.16, 0.03), new THREE.MeshStandardMaterial({ map: t }), -0.05, 0.0, 0, 0, Math.PI / 2 * 0, 0));
    return g;
  },
  oilPan: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(roundBox(0.3, 0.12, 0.46, 0.02), P.black)); g.add(mesh(box(0.2, 0.06, 0.2), P.black, 0, -0.07, -0.08)); g.add(mesh(cyl(0.012, 0.012, 0.015, 6), P.steel, 0, -0.105, -0.12)); return g; },
  oilFilter: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.04, 0.04, 0.1, 16), P.orange, 0, 0, 0, 0, 0, Math.PI / 2)); return g; },
  waterPump: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.05, 0.06, 0.06, 14), P.alu, 0, 0, 0, Math.PI / 2)); g.add(mesh(cyl(0.015, 0.015, 0.06, 8), P.alu, 0.06, 0.02, 0, 0, 0, Math.PI / 2)); return g; },
  pulley: (r = 0.055) => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(r, r, 0.025, 20), P.steel, 0, 0, 0, Math.PI / 2)); g.add(mesh(new THREE.TorusGeometry(r, 0.004, 4, 20), P.black, 0, 0, 0)); return g; },
  alternator: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.065, 0.065, 0.1, 16), P.alu, 0, 0, 0, Math.PI / 2)); for (let i = 0; i < 10; i++) g.add(mesh(box(0.005, 0.12, 0.08), P.alu, 0, 0, -0.04, 0, 0, i / 10 * Math.PI)); g.add(mesh(cyl(0.035, 0.035, 0.02, 14), P.steel, 0, 0, 0.065, Math.PI / 2)); return g; },
  belt: () => { const P = partMats(); const g = new THREE.Group(); g.add(tube([[0, 0.12, 0], [-0.16, 0.06, 0], [-0.07, -0.2, 0], [0.04, -0.2, 0], [0.06, 0.05, 0], [0, 0.12, 0]], 0.007, P.rubber, 40)); return g; },
  fan: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.03, 0.03, 0.03, 10), P.black, 0, 0, 0, Math.PI / 2)); for (let i = 0; i < 4; i++) { const b = mesh(box(0.05, 0.16, 0.006), P.black, 0, 0, 0, 0.3, 0, i / 4 * Math.PI * 2); b.geometry.translate(0, 0.09, 0); g.add(b); } return g; },
  flywheel: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.14, 0.14, 0.03, 28), P.steel, 0, 0, 0, Math.PI / 2)); g.add(mesh(new THREE.TorusGeometry(0.14, 0.008, 4, 40), P.steel, 0, 0, 0)); return g; },
  clutchDisc: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.11, 0.11, 0.012, 24), new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.9 }), 0, 0, 0, Math.PI / 2)); g.add(mesh(cyl(0.035, 0.035, 0.03, 12), P.steel, 0, 0, 0, Math.PI / 2)); return g; },
  clutchPlate: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.13, 0.13, 0.04, 24), P.steel, 0, 0, 0, Math.PI / 2)); for (let i = 0; i < 6; i++) g.add(mesh(box(0.02, 0.07, 0.01), P.steel, Math.cos(i) * 0.05, Math.sin(i) * 0.05, -0.025, 0, 0, i)); return g; },
  gearbox: (v) => {
    const P = partMats(), g = new THREE.Group();
    g.add(mesh(cyl(0.16, 0.09, 0.22, 18), P.alu, 0, 0, 0.12, Math.PI / 2));
    g.add(mesh(roundBox(0.16, 0.16, 0.34, 0.03), P.alu, 0, -0.02, -0.14));
    g.add(mesh(cyl(0.045, 0.04, 0.16, 12), P.alu, 0, -0.03, -0.38, Math.PI / 2));
    const lever = mesh(cyl(0.008, 0.008, 0.32, 6), P.steel, 0, 0.2, -0.05); g.add(lever);
    g.add(mesh(new THREE.SphereGeometry(0.025, 10, 8), v === 'sport' ? P.paintedRed : P.black, 0, 0.36, -0.05));
    return g;
  },
  starter: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.04, 0.04, 0.16, 14), P.black, 0, 0, 0, Math.PI / 2)); g.add(mesh(cyl(0.025, 0.025, 0.1, 10), P.steel, 0.04, 0.03, 0.02, Math.PI / 2)); return g; },
  distributor: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.025, 0.025, 0.12, 10), P.alu, 0, -0.04, 0)); g.add(mesh(cyl(0.045, 0.04, 0.05, 14), P.black, 0, 0.04, 0)); for (let i = 0; i < 5; i++) g.add(mesh(cyl(0.006, 0.006, 0.02, 6), P.black, Math.cos(i * 1.256) * 0.03, 0.07, Math.sin(i * 1.256) * 0.03)); return g; },
  plug: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.008, 0.008, 0.04, 8), P.plasticWhite, 0, 0.02, 0)); g.add(mesh(cyl(0.011, 0.011, 0.012, 6), P.steel, 0, -0.005, 0)); g.add(mesh(cyl(0.006, 0.006, 0.02, 6), P.steel, 0, -0.02, 0)); return g; },
  wires: () => { const P = partMats(); const g = new THREE.Group(); for (let i = 0; i < 4; i++) g.add(tube([[-0.1, 0.0, -0.18], [-0.05 + i * 0.01, 0.06, -0.15 + i * 0.05], [0.0, 0.02, -0.195 + i * 0.13]], 0.004, P.redWire, 12)); return g; },
  intake: () => { const P = partMats(); const g = new THREE.Group(); for (let i = 0; i < 4; i++) g.add(tube([[0.0, 0.0, -0.195 + i * 0.13], [-0.06, 0.03, -0.1 + i * 0.065], [-0.1, 0.06, 0]], 0.02, P.alu, 12)); g.add(mesh(box(0.08, 0.02, 0.08), P.alu, -0.1, 0.07, 0)); return g; },
  carb: (v) => {
    const P = partMats(), g = new THREE.Group();
    if (v === 'twin') { for (const z of [-0.06, 0.06]) { g.add(mesh(cyl(0.032, 0.035, 0.08, 14), P.alu, 0, 0, z)); g.add(mesh(cyl(0.012, 0.012, 0.05, 8), P.brass, 0.04, 0.0, z, 0, 0, Math.PI / 2)); } }
    else if (v === 'race') { g.add(mesh(box(0.11, 0.08, 0.13), P.alu, 0, 0, 0)); for (const z of [-0.03, 0.03]) g.add(mesh(cyl(0.025, 0.025, 0.04, 14), P.chrome, 0, 0.055, z)); }
    else { g.add(mesh(cyl(0.035, 0.04, 0.09, 14), P.alu, 0, 0, 0)); g.add(mesh(cyl(0.01, 0.01, 0.05, 8), P.brass, 0.045, 0, 0, 0, 0, Math.PI / 2)); }
    g.add(mesh(cyl(0.008, 0.008, 0.02, 6), P.brass, -0.04, -0.02, 0.03, 0, 0, Math.PI / 2)); // mixture screw
    return g;
  },
  airFilter: (v) => { const P = partMats(); const g = new THREE.Group(); if (v === 'sport') { g.add(mesh(cyl(0.06, 0.05, 0.08, 18), P.paintedRed)); g.add(mesh(cyl(0.062, 0.062, 0.005, 18), P.chrome, 0, 0.04, 0)); } else { g.add(mesh(cyl(0.12, 0.12, 0.06, 24), P.black)); g.add(mesh(cyl(0.02, 0.02, 0.01, 8), P.chrome, 0, 0.035, 0)); } return g; },
  header: (v) => {
    const P = partMats(), g = new THREE.Group();
    const m = v === 'race' ? P.steel : P.exhaust;
    if (v === 'turbo') {
      for (let i = 0; i < 4; i++) g.add(tube([[0, 0, -0.195 + i * 0.13], [0.06, -0.02, -0.12 + i * 0.07], [0.1, -0.06, 0]], 0.018, P.exhaust, 12));
      g.add(mesh(cyl(0.065, 0.065, 0.06, 20), P.steel, 0.14, -0.04, 0, Math.PI / 2));
      g.add(mesh(new THREE.TorusGeometry(0.065, 0.025, 8, 20, Math.PI * 1.5), P.alu, 0.14, -0.04, 0.05));
      return g;
    }
    for (let i = 0; i < 4; i++) g.add(tube([[0, 0, -0.195 + i * 0.13], [0.07, -0.04, -0.12 + i * 0.06], [0.1, -0.18, -0.02], [0.11, -0.32, -0.08]], v === 'race' ? 0.017 : 0.02, m, 14));
    return g;
  },
  fuelPump: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.035, 0.035, 0.05, 14), P.alu, 0, 0, 0, 0, 0, Math.PI / 2)); g.add(mesh(cyl(0.005, 0.005, 0.04, 6), P.brass, 0, 0.03, 0)); return g; },
  dipstick: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.003, 0.003, 0.3, 4), P.steel)); g.add(mesh(new THREE.TorusGeometry(0.015, 0.004, 4, 10), P.yellow, 0, 0.16, 0)); return g; },
  radiator: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(box(0.56, 0.36, 0.05), P.radiator)); g.add(mesh(box(0.6, 0.04, 0.07), P.black, 0, 0.2, 0)); g.add(mesh(box(0.6, 0.04, 0.07), P.black, 0, -0.2, 0)); g.add(mesh(cyl(0.02, 0.02, 0.03, 10), P.steel, 0.2, 0.23, 0)); g.add(mesh(cyl(0.018, 0.018, 0.06, 8), P.black, -0.26, 0.15, -0.04, Math.PI / 2)); return g; },
  hose: (v) => { const P = partMats(); const g = new THREE.Group(); g.add(tube(v === 'lower' ? [[0, 0, 0.2], [0.02, -0.05, 0.1], [0.0, -0.08, -0.05], [0.02, 0.0, -0.18]] : [[0, 0, 0.2], [0.03, 0.03, 0.05], [0.0, 0.02, -0.18]], 0.018, P.rubber, 16)); return g; },
  battery: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(roundBox(0.24, 0.18, 0.17, 0.01), P.battery)); g.add(mesh(cyl(0.012, 0.012, 0.025, 8), P.redWire, 0.08, 0.1, 0)); g.add(mesh(cyl(0.012, 0.012, 0.025, 8), P.black, -0.08, 0.1, 0)); const t = canvasTexture(128, 64, (c) => { c.fillStyle = '#e8b020'; c.fillRect(0, 0, 128, 64); c.fillStyle = '#111'; c.font = 'bold 22px Arial'; c.fillText('VOIMA', 20, 30); c.font = '14px Arial'; c.fillText('12V 45Ah', 30, 52); }); g.add(mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshStandardMaterial({ map: t }), 0, 0, 0.0851)); return g; },
  wiring: () => { const P = partMats(); const g = new THREE.Group(); g.add(tube([[-0.5, 0, 0], [-0.2, 0.05, 0.05], [0.2, 0.0, 0.02], [0.5, 0.05, 0.1]], 0.015, P.wire, 20)); g.add(tube([[-0.2, 0.05, 0.05], [-0.3, 0.1, 0.3], [-0.45, 0.0, 0.55]], 0.01, P.wire, 12)); g.add(tube([[0.2, 0.0, 0.02], [0.3, 0.05, 0.25]], 0.01, P.redWire, 8)); return g; },
  fuses: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(box(0.12, 0.04, 0.08), P.plasticWhite)); for (let i = 0; i < 6; i++) g.add(mesh(box(0.012, 0.02, 0.03), [P.redWire, P.yellow, P.paintedBlue][i % 3], -0.045 + i * 0.018, 0.03, 0)); return g; },
  coil: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.03, 0.03, 0.14, 14), P.black)); g.add(mesh(cyl(0.012, 0.012, 0.03, 8), P.plasticWhite, 0, 0.08, 0)); return g; },
  brakeMaster: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.025, 0.025, 0.14, 12), P.alu, 0, 0, 0, Math.PI / 2)); g.add(mesh(box(0.06, 0.05, 0.06), P.plasticWhite, 0, 0.045, 0.02)); g.add(mesh(cyl(0.022, 0.022, 0.015, 10), P.black, 0, 0.077, 0.02)); return g; },
  rack: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.025, 0.025, 1.0, 12), P.black, 0, 0, 0, 0, 0, Math.PI / 2)); g.add(mesh(cyl(0.04, 0.04, 0.12, 12), P.alu, 0.18, 0, 0, 0, 0, Math.PI / 2)); for (const s of [1, -1]) g.add(mesh(cyl(0.03, 0.02, 0.1, 8), P.rubber, s * 0.42, 0, 0, 0, 0, Math.PI / 2)); return g; },
  column: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.018, 0.018, 0.8, 10), P.steel, 0, 0, 0, 2.0)); g.add(mesh(cyl(0.035, 0.035, 0.22, 12), P.black, 0, 0.1, -0.2, 2.0)); return g; },
  swheel: (v) => {
    const P = partMats(), g = new THREE.Group();
    const r = v === 'rally' ? 0.165 : v === 'sport' ? 0.175 : 0.2;
    const rim = mesh(new THREE.TorusGeometry(r, v === 'stock' || !v ? 0.013 : 0.018, 10, 40), v === 'rally' ? new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.95 }) : P.black); g.add(rim);
    g.add(mesh(cyl(0.04, 0.04, 0.03, 16), v === 'sport' ? P.chrome : P.black, 0, 0, 0, Math.PI / 2));
    const n = v === 'rally' ? 3 : v === 'sport' ? 3 : 2;
    for (let i = 0; i < n; i++) { const s = mesh(box(0.018, r, 0.012), v === 'sport' ? P.alu : P.black, 0, 0, 0, 0, 0, i / n * Math.PI * 2 + (n === 2 ? Math.PI / 2 : Math.PI)); s.geometry.translate(0, r / 2, 0); g.add(s); }
    if (v === 'rally') g.add(mesh(box(0.012, 0.03, 0.02), P.yellow, 0, r, 0));
    return g;
  },
  dash: () => {
    const P = partMats(), g = new THREE.Group();
    g.add(mesh(roundBox(1.36, 0.22, 0.34, 0.06), P.vinyl, 0, 0, 0));
    g.add(mesh(roundBox(1.3, 0.12, 0.12, 0.04), P.vinyl, 0, 0.12, -0.08));
    g.add(mesh(box(0.42, 0.18, 0.08), P.blackMatte, 0.34, 0.06, -0.14)); // binnacle
    g.add(mesh(box(0.3, 0.06, 0.02), new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.4, map: tex('planks_dark.jpg') }), -0.25, 0.02, -0.17)); // wood trim
    g.add(mesh(box(0.25, 0.12, 0.02), P.blackMatte, -0.4, -0.05, -0.17)); // glovebox
    return g;
  },
  gauges: () => {
    const P = partMats(), g = new THREE.Group();
    const face = mesh(new THREE.PlaneGeometry(0.34, 0.17), P.gauge, 0, 0, 0, 0, Math.PI, 0);
    g.add(face);
    const nmat = new THREE.MeshStandardMaterial({ color: 0xff5010, emissive: 0xff3000, emissiveIntensity: 0.6 });
    const n1 = mesh(box(0.004, 0.06, 0.003), nmat, 0.085, 0, -0.004); n1.geometry.translate(0, 0.03, 0); n1.name = 'speedNeedle'; g.add(n1);
    const n2 = mesh(box(0.004, 0.06, 0.003), nmat, -0.085, 0, -0.004); n2.geometry.translate(0, 0.03, 0); n2.name = 'rpmNeedle'; g.add(n2);
    // small temp / fuel gauges
    const n3 = mesh(box(0.003, 0.025, 0.003), nmat, 0.0, 0.05, -0.004); n3.geometry.translate(0, 0.012, 0); n3.name = 'tempNeedle'; g.add(n3);
    const n4 = mesh(box(0.003, 0.025, 0.003), nmat, 0.0, -0.05, -0.004); n4.geometry.translate(0, 0.012, 0); n4.name = 'fuelNeedle'; g.add(n4);
    const lamp = mesh(new THREE.CircleGeometry(0.006, 8), new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff0000, emissiveIntensity: 0 }), 0.02, -0.07, -0.003, 0, Math.PI, 0); lamp.name = 'oilLamp'; g.add(lamp);
    const lamp2 = mesh(new THREE.CircleGeometry(0.006, 8), new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2000, emissiveIntensity: 0 }), -0.02, -0.07, -0.003, 0, Math.PI, 0); lamp2.name = 'battLamp'; g.add(lamp2);
    return g;
  },
  strut: (v) => {
    const P = partMats(), g = new THREE.Group();
    const col = v === 'sport' ? P.yellow : v === 'rally' ? P.paintedRed : P.black;
    g.add(mesh(cyl(0.025, 0.025, 0.42, 12), col, 0, -0.04, 0));
    g.add(mesh(cyl(0.012, 0.012, 0.2, 8), P.chrome, 0, 0.2, 0));
    g.add(spring(0.055, 0.24, 6, 0.008, v === 'sport' ? P.paintedBlue : v === 'rally' ? P.yellow : P.paintedRed));
    g.add(mesh(cyl(0.07, 0.07, 0.01, 16), P.steel, 0, 0.13, 0)); g.add(mesh(cyl(0.07, 0.07, 0.01, 16), P.steel, 0, -0.13, 0));
    g.add(mesh(box(0.05, 0.09, 0.06), P.steel, 0, -0.26, 0));
    g.add(mesh(box(0.28, 0.025, 0.06), P.black, v === 'R' ? -0.14 : 0.14, -0.3, 0)); // control arm
    return g;
  },
  disc: (v) => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.12, 0.12, 0.022, 28), v === 'sport' ? P.steel : P.rusty, 0, 0, 0, 0, 0, Math.PI / 2)); g.add(mesh(cyl(0.065, 0.065, 0.06, 18), P.steel, 0, 0, 0, 0, 0, Math.PI / 2)); for (let i = 0; i < 4; i++) g.add(mesh(cyl(0.006, 0.006, 0.05, 6), P.steel, 0.04, Math.cos(i * 1.57) * 0.045, Math.sin(i * 1.57) * 0.045, 0, 0, Math.PI / 2)); return g; },
  caliper: (v) => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(roundBox(0.06, 0.1, 0.08, 0.015), v === 'sport' ? P.paintedRed : P.iron)); return g; },
  axle: (v) => {
    const P = partMats(), g = new THREE.Group();
    g.add(mesh(cyl(0.035, 0.035, 1.26, 12), P.black, 0, 0, 0, 0, 0, Math.PI / 2));
    g.add(mesh(new THREE.SphereGeometry(0.13, 16, 12), v === 'rally' ? P.paintedRed : P.black, 0, 0, 0.02));
    g.add(mesh(cyl(0.05, 0.04, 0.12, 12), P.black, 0, 0, 0.16, Math.PI / 2));
    for (const s of [1, -1]) g.add(mesh(box(0.05, 0.03, 0.5), P.black, s * 0.48, 0.03, 0.18));
    return g;
  },
  shock: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.02, 0.02, 0.26, 10), P.black, 0, -0.04, 0)); g.add(mesh(cyl(0.01, 0.01, 0.16, 8), P.chrome, 0, 0.12, 0)); return g; },
  coilSpring: (v) => { const P = partMats(); const g = new THREE.Group(); g.add(spring(0.06, 0.24, 6, 0.01, v === 'sport' ? P.paintedBlue : v === 'rally' ? P.yellow : P.paintedRed)); return g; },
  drum: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.11, 0.11, 0.06, 24), P.rusty, 0, 0, 0, 0, 0, Math.PI / 2)); for (let i = 0; i < 4; i++) g.add(mesh(cyl(0.006, 0.006, 0.05, 6), P.steel, 0.04, Math.cos(i * 1.57) * 0.045, Math.sin(i * 1.57) * 0.045, 0, 0, Math.PI / 2)); return g; },
  wheel: (v) => {
    const P = partMats(), g = new THREE.Group();
    const R = v === 'rally' ? 0.305 : v === 'sport' ? 0.3 : 0.29, W = v === 'rally' ? 0.19 : v === 'sport' ? 0.2 : 0.165;
    const rimR = R - 0.085;
    // tyre via lathe profile (rounded)
    const prof = [];
    for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + i / 16 * Math.PI; prof.push(new THREE.Vector2(rimR + 0.01 + (R - rimR - 0.01) * (0.55 + 0.45 * Math.cos(a) ** 0.6), Math.sin(a) * W / 2)); }
    const tg = new THREE.LatheGeometry(prof, 36); tg.rotateZ(Math.PI / 2);
    const uv = tg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * 1, uv.getX(i) * 6);
    const spin = new THREE.Group(); spin.name = 'spin';
    spin.add(mesh(tg, P.tyre));
    // rim
    const rimMat = v === 'alloy' || v === 'sport' ? P.alu : v === 'rally' ? new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.4 }) : new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.45, metalness: 0.6 });
    spin.add(mesh(cyl(rimR, rimR, W * 0.9, 28, 1, true), rimMat, 0, 0, 0, 0, 0, Math.PI / 2));
    const face = mesh(cyl(rimR * 0.98, rimR * 0.98, 0.02, 28), rimMat, W * 0.25, 0, 0, 0, 0, Math.PI / 2); spin.add(face);
    if (v === 'alloy' || v === 'sport') for (let i = 0; i < 6; i++) spin.add(mesh(box(0.025, rimR * 0.9, 0.04), P.alu, W * 0.3, 0, 0, i / 6 * Math.PI, 0, 0));
    else if (v === 'rally') for (let i = 0; i < 8; i++) spin.add(mesh(cyl(0.022, 0.022, 0.03, 10), P.blackMatte, W * 0.27, Math.cos(i / 8 * Math.PI * 2) * rimR * 0.6, Math.sin(i / 8 * Math.PI * 2) * rimR * 0.6, 0, 0, Math.PI / 2));
    else { spin.add(mesh(cyl(rimR * 0.62, rimR * 0.66, 0.03, 24), P.chrome, W * 0.3, 0, 0, 0, 0, Math.PI / 2)); }
    spin.add(mesh(cyl(0.035, 0.035, 0.04, 12), P.chrome, W * 0.32, 0, 0, 0, 0, Math.PI / 2));
    for (let i = 0; i < 4; i++) spin.add(mesh(cyl(0.008, 0.008, 0.02, 6), P.steel, W * 0.35, Math.cos(i * 1.57 + 0.78) * 0.05, Math.sin(i * 1.57 + 0.78) * 0.05, 0, 0, Math.PI / 2));
    g.add(spin);
    g.userData.spin = spin;
    g.userData.radius = R;
    return g;
  },
  driveshaft: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.032, 0.032, 1.5, 12), P.black, 0, 0, 0, Math.PI / 2)); for (const z of [0.76, -0.76]) g.add(mesh(box(0.06, 0.06, 0.04), P.steel, 0, 0, z)); return g; },
  pipe: () => { const P = partMats(); const g = new THREE.Group(); g.add(tube([[0, 0, 0.75], [0.0, -0.02, 0.2], [0.02, -0.02, -0.5], [0.05, 0.0, -1.0]], 0.024, P.exhaust, 24)); return g; },
  muffler: (v) => { const P = partMats(); const g = new THREE.Group(); if (v === 'straight') { g.add(mesh(cyl(0.03, 0.03, 0.5, 12), P.steel, 0, 0, 0, Math.PI / 2)); } else { g.add(mesh(roundBox(v === 'sport' ? 0.2 : 0.28, 0.12, 0.5, 0.05), v === 'sport' ? P.chrome : P.exhaust)); } g.add(mesh(cyl(0.028, 0.032, 0.18, 12), v === 'sport' ? P.chrome : P.exhaust, 0.05, -0.01, -0.32, Math.PI / 2)); return g; },
  tank: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(roundBox(0.9, 0.24, 0.42, 0.06), P.black)); g.add(tube([[0.4, 0.1, 0.0], [0.6, 0.2, 0.05], [0.72, 0.38, 0.1]], 0.025, P.black, 12)); return g; },
  fuelLine: () => { const P = partMats(); const g = new THREE.Group(); g.add(tube([[0, 0, -1.7], [0.02, 0, -0.5], [0.0, 0.0, 0.6], [-0.05, 0.25, 1.0]], 0.006, P.steel, 30)); return g; },
  seat: (v) => {
    const P = partMats(), g = new THREE.Group();
    const mat = v === 'bucket' ? new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, map: tex('fabric.jpg') }) : P.fabric;
    g.add(mesh(roundBox(0.5, 0.12, 0.5, 0.05), mat, 0, 0.1, 0.04));
    const back = mesh(roundBox(0.48, 0.62, 0.12, 0.05), mat, 0, 0.45, -0.2, -0.12); g.add(back);
    if (v === 'bucket') { for (const s of [1, -1]) g.add(mesh(roundBox(0.08, 0.5, 0.2, 0.03), mat, s * 0.25, 0.4, -0.15, -0.12)); }
    else g.add(mesh(roundBox(0.32, 0.18, 0.1, 0.04), mat, 0, 0.84, -0.26, -0.12));
    g.add(mesh(box(0.42, 0.04, 0.42), partMats().black, 0, 0.02, 0.0));
    return g;
  },
  rearSeat: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(roundBox(1.2, 0.14, 0.48, 0.06), P.fabric, 0, 0.12, 0.05)); g.add(mesh(roundBox(1.2, 0.5, 0.12, 0.05), P.fabric, 0, 0.42, -0.2, -0.2)); return g; },
  bumper: (v) => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(roundBox(1.62, 0.1, 0.09, 0.04), P.chrome)); g.add(mesh(box(1.5, 0.03, 0.06), P.rubber, 0, 0, 0.02)); for (const s of [1, -1]) g.add(mesh(roundBox(0.08, 0.13, 0.1, 0.03), P.rubber, s * 0.42, 0, v === 'F' ? 0.04 : -0.04)); return g; },
  grille: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(box(0.9, 0.16, 0.03), P.blackMatte)); for (let i = 0; i < 9; i++) g.add(mesh(box(0.86, 0.008, 0.035), P.chrome, 0, -0.07 + i * 0.0175, 0)); g.add(mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 16), P.chrome, 0, 0, 0.02)); return g; },
  headlight: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.09, 0.085, 0.07, 24), P.chrome, 0, 0, 0, Math.PI / 2)); const r = mesh(new THREE.SphereGeometry(0.08, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), P.reflector, 0, 0, 0.01, -Math.PI / 2); r.name = 'reflector'; g.add(r); g.add(mesh(new THREE.SphereGeometry(0.085, 18, 8, 0, Math.PI * 2, 0, 0.5), P.lens, 0, 0, -0.04, Math.PI / 2)); return g; },
  taillight: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(roundBox(0.26, 0.1, 0.04, 0.015), P.chrome)); const r = mesh(box(0.16, 0.08, 0.02), P.plasticRed, 0.04, 0, -0.02); r.name = 'redLens'; g.add(r); g.add(mesh(box(0.07, 0.08, 0.02), P.plasticAmber, -0.085, 0, -0.02)); return g; },
  mirror: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(cyl(0.006, 0.006, 0.08, 6), P.chrome, 0, 0.04, 0, 0, 0, 0.5)); const h = mesh(cyl(0.06, 0.055, 0.04, 16), P.chrome, 0.03, 0.09, 0, Math.PI / 2); g.add(h); g.add(mesh(new THREE.CircleGeometry(0.052, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.02 }), 0.03, 0.09, -0.021, 0, Math.PI, 0)); return g; },
  plate: (text) => { const g = new THREE.Group(); const t = canvasTexture(256, 56, (c) => { c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, 256, 56); c.strokeStyle = '#111'; c.lineWidth = 4; c.strokeRect(3, 3, 250, 50); c.fillStyle = '#1a3a8a'; c.fillRect(6, 6, 24, 44); c.fillStyle = '#fff'; c.font = 'bold 14px Arial'; c.fillText('FIN', 7, 46); c.fillStyle = '#111'; c.font = 'bold 40px Arial'; c.fillText(text || 'RKA-713', 42, 44); }); g.add(mesh(new THREE.BoxGeometry(0.34, 0.075, 0.006), new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, metalness: 0.4 }))); return g; },
  radio: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(box(0.18, 0.05, 0.14), P.black)); const t = canvasTexture(128, 32, (c) => { c.fillStyle = '#111'; c.fillRect(0, 0, 128, 32); c.fillStyle = '#f0a030'; c.font = '14px monospace'; c.fillText('FM 94.5', 30, 20); c.fillStyle = '#888'; c.fillRect(6, 10, 12, 12); c.fillRect(110, 10, 12, 12); }); g.add(mesh(new THREE.PlaneGeometry(0.17, 0.04), new THREE.MeshStandardMaterial({ map: t, emissive: 0x332200, emissiveMap: t }), 0, 0, -0.071, 0, Math.PI, 0)); return g; },
  spoiler: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(roundBox(1.3, 0.025, 0.22, 0.01), P.blackMatte, 0, 0.12, 0)); for (const s of [1, -1]) g.add(mesh(box(0.03, 0.12, 0.12), P.blackMatte, s * 0.5, 0.06, 0)); return g; },
  rallyLights: () => { const P = partMats(); const g = new THREE.Group(); g.add(mesh(box(0.9, 0.03, 0.03), P.black, 0, -0.05, 0)); for (const x of [-0.33, -0.11, 0.11, 0.33]) { g.add(mesh(cyl(0.08, 0.07, 0.07, 20), P.blackMatte, x, 0.04, 0, Math.PI / 2)); const l = mesh(new THREE.CircleGeometry(0.07, 20), new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 0, roughness: 0.1 }), x, 0.04, 0.036); l.name = 'rallyLens'; g.add(l); } return g; },
  cage: () => { const P = partMats(); const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.4, metalness: 0.8 }); for (const s of [1, -1]) { g.add(tube([[s * 0.6, -0.4, 0.35], [s * 0.58, 0.18, 0.1], [s * 0.56, 0.2, -0.6], [s * 0.6, -0.4, -0.9]], 0.02, m, 20)); } g.add(tube([[0.58, 0.18, 0.1], [-0.58, 0.18, 0.1]], 0.02, m, 4)); g.add(tube([[0.56, 0.2, -0.6], [-0.56, 0.2, -0.6]], 0.02, m, 4)); g.add(tube([[0.56, 0.2, -0.6], [-0.6, -0.4, -0.9]], 0.02, m, 4)); return g; },
  mudflaps: () => { const P = partMats(); const g = new THREE.Group(); for (const [x, z] of [[0.66, 0.85], [-0.66, 0.85], [0.66, -1.6], [-0.66, -1.6]]) g.add(mesh(box(0.2, 0.22, 0.01), new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: 0.7 }), x, 0, z)); return g; },
  turbo: () => B.header('turbo'),
  boxPart: (w, h, d, m) => { const g = new THREE.Group(); g.add(mesh(roundBox(w, h, d, 0.01), m || partMats().black)); return g; },
};

// ---------------------------------------------------------------- slots
// pos/rot relative to parent part origin (or car root when parent === 'root', or stand when parent === 'stand')
const D2R = Math.PI / 180;
export const SLOTS = {
  engine: { parent: 'root', accepts: ['block'], pos: [0, 0.44, 1.28], name: 'Engine bay' },
  stand: { parent: 'stand', accepts: ['block'], pos: [0, 0.22, 0], name: 'Engine stand' },
  crank: { parent: 'engine*', accepts: ['crank'], pos: [0, -0.12, 0] },
  piston1: { parent: 'engine*', accepts: ['piston'], pos: [0, 0.08, 0.195], req: ['crank'] },
  piston2: { parent: 'engine*', accepts: ['piston'], pos: [0, 0.08, 0.065], req: ['crank'] },
  piston3: { parent: 'engine*', accepts: ['piston'], pos: [0, 0.08, -0.065], req: ['crank'] },
  piston4: { parent: 'engine*', accepts: ['piston'], pos: [0, 0.08, -0.195], req: ['crank'] },
  gasket: { parent: 'engine*', accepts: ['gasket'], pos: [0, 0.153, 0], req: ['piston1', 'piston2', 'piston3', 'piston4'] },
  head: { parent: 'engine*', accepts: ['head'], pos: [0, 0.215, 0], req: ['gasket'] },
  cam: { parent: 'head', accepts: ['cam'], pos: [0, 0.075, 0] },
  camgear: { parent: 'head', accepts: ['camgear'], pos: [0, 0.075, 0.27], req: ['cam'] },
  chain: { parent: 'engine*', accepts: ['chain'], pos: [0, 0.03, 0.265], req: ['camgear', 'crank'] },
  tcover: { parent: 'engine*', accepts: ['tcover'], pos: [0, 0.06, 0.285], req: ['chain'] },
  rockers: { parent: 'head', accepts: ['rockers'], pos: [0, 0.085, 0], req: ['cam'] },
  rcover: { parent: 'head', accepts: ['rcover'], pos: [0, 0.1, 0], req: ['rockers'] },
  oilpan: { parent: 'engine*', accepts: ['oilpan'], pos: [0, -0.21, 0], req: ['crank'] },
  oilfilter: { parent: 'engine*', accepts: ['oilfilter'], pos: [-0.21, -0.06, -0.05] },
  dipstick: { parent: 'engine*', accepts: ['dipstick'], pos: [0.18, 0.08, -0.12] },
  wpump: { parent: 'engine*', accepts: ['wpump'], pos: [0, 0.13, 0.33], req: ['tcover'] },
  wpulley: { parent: 'wpump', accepts: ['wpulley'], pos: [0, 0, 0.04] },
  fan: { parent: 'wpulley', accepts: ['fan'], pos: [0, 0, 0.04] },
  cpulley: { parent: 'engine*', accepts: ['cpulley'], pos: [0, -0.12, 0.33], req: ['tcover'] },
  alt: { parent: 'engine*', accepts: ['alt'], pos: [-0.2, 0.06, 0.24] },
  belt: { parent: 'engine*', accepts: ['belt'], pos: [0.0, 0.01, 0.36], req: ['alt', 'wpulley', 'cpulley'] },
  flywheel: { parent: 'engine*', accepts: ['flywheel'], pos: [0, -0.1, -0.28], req: ['crank'] },
  clutchdisc: { parent: 'engine*', accepts: ['clutchdisc'], pos: [0, -0.1, -0.305], req: ['flywheel'] },
  clutchplate: { parent: 'engine*', accepts: ['clutchplate'], pos: [0, -0.1, -0.335], req: ['clutchdisc'] },
  gearbox: { parent: 'engine*', accepts: ['gearbox'], pos: [0, -0.1, -0.6], req: ['clutchplate'] },
  starter: { parent: 'engine*', accepts: ['starter'], pos: [0.2, -0.1, -0.24] },
  dist: { parent: 'engine*', accepts: ['dist'], pos: [0.2, 0.12, -0.16] },
  plug1: { parent: 'head', accepts: ['plug'], pos: [0.1, 0.08, 0.195] },
  plug2: { parent: 'head', accepts: ['plug'], pos: [0.1, 0.08, 0.065] },
  plug3: { parent: 'head', accepts: ['plug'], pos: [0.1, 0.08, -0.065] },
  plug4: { parent: 'head', accepts: ['plug'], pos: [0.1, 0.08, -0.195] },
  wires: { parent: 'head', accepts: ['wires'], pos: [0.12, 0.09, 0], req: ['plug1', 'plug2', 'plug3', 'plug4'] },
  intake: { parent: 'head', accepts: ['intake'], pos: [-0.18, -0.02, 0] },
  carb: { parent: 'intake', accepts: ['carb'], pos: [-0.12, 0.05, 0] },
  airfilter: { parent: 'carb', accepts: ['airfilter'], pos: [0, 0.07, 0] },
  header: { parent: 'head', accepts: ['header'], pos: [0.18, -0.01, 0] },
  fpump: { parent: 'engine*', accepts: ['fpump'], pos: [-0.2, -0.05, -0.15] },
  // body
  radiator: { parent: 'root', accepts: ['radiator'], pos: [0, 0.54, 1.82] },
  hoseU: { parent: 'root', accepts: ['hoseU'], pos: [0.05, 0.66, 1.6], req: ['radiator'] },
  hoseL: { parent: 'root', accepts: ['hoseL'], pos: [-0.08, 0.4, 1.6], req: ['radiator'] },
  battery: { parent: 'root', accepts: ['battery'], pos: [-0.5, 0.56, 1.5] },
  wiring: { parent: 'root', accepts: ['wiring'], pos: [0, 0.78, 0.98] },
  fuses: { parent: 'root', accepts: ['fuses'], pos: [0.46, 0.8, 1.0] },
  coil: { parent: 'root', accepts: ['coil'], pos: [0.48, 0.68, 1.2] },
  brakemaster: { parent: 'root', accepts: ['brakemaster'], pos: [0.38, 0.78, 0.98] },
  rack: { parent: 'root', accepts: ['rack'], pos: [0, 0.3, 1.62] },
  column: { parent: 'root', accepts: ['column'], pos: [0.36, 0.72, 0.62], req: ['rack'] },
  swheel: { parent: 'root', accepts: ['swheel'], pos: [0.36, 0.93, 0.36], rot: [-25 * D2R, 0, 0], req: ['column'] },
  dash: { parent: 'root', accepts: ['dash'], pos: [0, 0.86, 0.58] },
  gauges: { parent: 'root', accepts: ['gauges'], pos: [0.34, 0.93, 0.47], rot: [15 * D2R, 0, 0], req: ['dash'] },
  radio: { parent: 'root', accepts: ['radio'], pos: [-0.02, 0.8, 0.55], req: ['dash'] },
  strutFL: { parent: 'root', accepts: ['strut'], pos: [0.6, 0.47, 1.22] },
  strutFR: { parent: 'root', accepts: ['strut'], pos: [-0.6, 0.47, 1.22], rot: [0, Math.PI, 0] },
  discFL: { parent: 'root', accepts: ['disc'], pos: [0.6, 0.29, 1.22], req: ['strutFL'] },
  discFR: { parent: 'root', accepts: ['disc'], pos: [-0.6, 0.29, 1.22], rot: [0, Math.PI, 0], req: ['strutFR'] },
  caliperFL: { parent: 'root', accepts: ['caliper'], pos: [0.58, 0.32, 1.12], req: ['discFL'] },
  caliperFR: { parent: 'root', accepts: ['caliper'], pos: [-0.58, 0.32, 1.12], req: ['discFR'] },
  axle: { parent: 'root', accepts: ['axle'], pos: [0, 0.29, -1.2] },
  shockRL: { parent: 'root', accepts: ['shock'], pos: [0.5, 0.48, -1.26], req: ['axle'] },
  shockRR: { parent: 'root', accepts: ['shock'], pos: [-0.5, 0.48, -1.26], req: ['axle'] },
  springRL: { parent: 'root', accepts: ['coilspring'], pos: [0.4, 0.46, -1.12], req: ['axle'] },
  springRR: { parent: 'root', accepts: ['coilspring'], pos: [-0.4, 0.46, -1.12], req: ['axle'] },
  drumRL: { parent: 'root', accepts: ['drum'], pos: [0.6, 0.29, -1.2], req: ['axle'] },
  drumRR: { parent: 'root', accepts: ['drum'], pos: [-0.6, 0.29, -1.2], rot: [0, Math.PI, 0], req: ['axle'] },
  wheelFL: { parent: 'root', accepts: ['wheel'], pos: [0.69, 0.29, 1.22], req: ['discFL'], wheel: 0 },
  wheelFR: { parent: 'root', accepts: ['wheel'], pos: [-0.69, 0.29, 1.22], rot: [0, Math.PI, 0], req: ['discFR'], wheel: 1 },
  wheelRL: { parent: 'root', accepts: ['wheel'], pos: [0.69, 0.29, -1.2], req: ['drumRL'], wheel: 2 },
  wheelRR: { parent: 'root', accepts: ['wheel'], pos: [-0.69, 0.29, -1.2], rot: [0, Math.PI, 0], req: ['drumRR'], wheel: 3 },
  driveshaft: { parent: 'root', accepts: ['driveshaft'], pos: [0, 0.3, -0.42], req: ['axle', 'gearbox'] },
  pipe: { parent: 'root', accepts: ['pipe'], pos: [0.22, 0.2, 0.2], req: ['header'] },
  muffler: { parent: 'root', accepts: ['muffler'], pos: [0.3, 0.22, -1.55], req: ['pipe'] },
  tank: { parent: 'root', accepts: ['tank'], pos: [0, 0.36, -1.62] },
  fuelline: { parent: 'root', accepts: ['fuelline'], pos: [-0.3, 0.26, 0.2], req: ['tank'] },
  seatL: { parent: 'root', accepts: ['seat'], pos: [0.36, 0.28, -0.1] },
  seatR: { parent: 'root', accepts: ['seat'], pos: [-0.36, 0.28, -0.1] },
  seatRear: { parent: 'root', accepts: ['rearseat'], pos: [0, 0.28, -0.95] },
  doorL: { parent: 'root', accepts: ['doorL'], pos: null, name: 'Left door' },
  doorR: { parent: 'root', accepts: ['doorR'], pos: null, name: 'Right door' },
  hood: { parent: 'root', accepts: ['hood'], pos: null },
  trunk: { parent: 'root', accepts: ['trunk'], pos: null },
  fenderL: { parent: 'root', accepts: ['fenderL'], pos: null },
  fenderR: { parent: 'root', accepts: ['fenderR'], pos: null },
  bumperF: { parent: 'root', accepts: ['bumperF'], pos: [0, 0.38, 2.09] },
  bumperR: { parent: 'root', accepts: ['bumperR'], pos: [0, 0.4, -2.1] },
  grille: { parent: 'root', accepts: ['grille'], pos: [0, 0.6, 2.05] },
  headlightL: { parent: 'root', accepts: ['headlight'], pos: [0.56, 0.62, 2.0] },
  headlightR: { parent: 'root', accepts: ['headlight'], pos: [-0.56, 0.62, 2.0] },
  taillightL: { parent: 'root', accepts: ['taillight'], pos: [0.55, 0.72, -2.04] },
  taillightR: { parent: 'root', accepts: ['taillight'], pos: [-0.55, 0.72, -2.04], rot: [0, 0, Math.PI] },
  mirrorL: { parent: 'root', accepts: ['mirror'], pos: [0.8, 0.9, 0.72] },
  mirrorR: { parent: 'root', accepts: ['mirror'], pos: [-0.8, 0.9, 0.72], rot: [0, Math.PI, 0] },
  plateF: { parent: 'root', accepts: ['plate'], pos: [0, 0.34, 2.14] },
  plateR: { parent: 'root', accepts: ['plate'], pos: [0, 0.55, -2.07], rot: [0, Math.PI, 0] },
  spoiler: { parent: 'root', accepts: ['spoiler'], pos: [0, 0.9, -1.85] },
  rallylights: { parent: 'root', accepts: ['rallylights'], pos: [0, 0.52, 2.15], req: ['bumperF'] },
  cage: { parent: 'root', accepts: ['cage'], pos: [0, 0.95, -0.25] },
  mudflaps: { parent: 'root', accepts: ['mudflaps'], pos: [0, 0.18, 0] },
};
export const ENGINE_SLOTS = Object.keys(SLOTS).filter((k) => SLOTS[k].parent !== 'root' && SLOTS[k].parent !== 'stand');

// ---------------------------------------------------------------- part catalogue
// half: collider half extents; bolts; stats used by engine model
const P_ = (type, name, price, mass, bolts, half, build, extra = {}) => ({ type, name, price, mass, bolts, half, build, ...extra });
export const PARTS = {
  block: P_('block', 'Engine block R1300', 1800, 60, 6, [0.18, 0.2, 0.26], () => B.block(), { cat: 'Engine' }),
  crank: P_('crank', 'Crankshaft', 420, 12, 5, [0.06, 0.04, 0.28], () => B.crank(), { cat: 'Engine' }),
  piston: P_('piston', 'Piston & rod', 95, 0.9, 2, [0.04, 0.09, 0.04], () => B.piston(), { cat: 'Engine' }),
  pistonHC: P_('piston', 'High-compression piston', 180, 0.9, 2, [0.04, 0.09, 0.04], () => B.piston(), { cat: 'Engine', stats: { power: 0.02, knock: 0.25 }, variant: 'hc' }),
  gasket: P_('gasket', 'Head gasket', 60, 0.3, 0, [0.17, 0.01, 0.25], () => B.gasket(), { cat: 'Engine' }),
  head: P_('head', 'Cylinder head', 650, 14, 10, [0.16, 0.07, 0.26], () => B.head(), { cat: 'Engine' }),
  cam: P_('cam', 'Camshaft (stock)', 260, 3, 4, [0.03, 0.03, 0.25], () => B.cam(), { cat: 'Engine', stats: { power: 0, peak: 0 } }),
  camFast: P_('cam', 'Fast-road camshaft', 690, 3, 4, [0.03, 0.03, 0.25], () => B.cam(), { cat: 'Performance', stats: { power: 0.06, peak: 400 }, variant: 'fast' }),
  camRace: P_('cam', 'Race camshaft', 1250, 3, 4, [0.03, 0.03, 0.25], () => B.cam(), { cat: 'Performance', stats: { power: 0.12, peak: 900, rough: 0.2 }, variant: 'race' }),
  camgear: P_('camgear', 'Cam gear', 70, 0.6, 1, [0.05, 0.05, 0.01], () => B.camGear(), { cat: 'Engine' }),
  chain: P_('chain', 'Timing chain', 85, 0.5, 0, [0.06, 0.2, 0.02], () => B.chain(), { cat: 'Engine' }),
  tcover: P_('tcover', 'Timing cover', 90, 1.5, 6, [0.12, 0.21, 0.02], () => B.tcover(), { cat: 'Engine' }),
  rockers: P_('rockers', 'Rocker shaft', 140, 2, 4, [0.04, 0.02, 0.24], () => B.rockers(), { cat: 'Engine' }),
  rcover: P_('rcover', 'Rocker cover', 120, 1.5, 4, [0.14, 0.04, 0.25], () => B.rcover('stock'), { cat: 'Engine' }),
  rcoverRace: P_('rcover', 'Rocker cover "SPORT"', 280, 1.2, 4, [0.14, 0.04, 0.25], () => B.rcover('race'), { cat: 'Cosmetic', variant: 'race' }),
  oilpan: P_('oilpan', 'Oil pan', 110, 3, 8, [0.15, 0.07, 0.23], () => B.oilPan(), { cat: 'Engine' }),
  oilfilter: P_('oilfilter', 'Oil filter', 25, 0.4, 1, [0.05, 0.04, 0.04], () => B.oilFilter(), { cat: 'Engine', consumable: true }),
  dipstick: P_('dipstick', 'Dipstick', 10, 0.1, 0, [0.02, 0.16, 0.02], () => B.dipstick(), { cat: 'Engine' }),
  wpump: P_('wpump', 'Water pump', 160, 2, 4, [0.06, 0.06, 0.04], () => B.waterPump(), { cat: 'Engine' }),
  wpulley: P_('wpulley', 'Water pump pulley', 40, 0.6, 3, [0.06, 0.06, 0.015], () => B.pulley(0.055), { cat: 'Engine' }),
  cpulley: P_('cpulley', 'Crankshaft pulley', 45, 0.8, 1, [0.065, 0.065, 0.015], () => B.pulley(0.065), { cat: 'Engine' }),
  fan: P_('fan', 'Cooling fan', 35, 0.5, 4, [0.18, 0.18, 0.03], () => B.fan(), { cat: 'Engine' }),
  alt: P_('alt', 'Alternator', 280, 5, 2, [0.07, 0.07, 0.07], () => B.alternator(), { cat: 'Engine' }),
  belt: P_('belt', 'Fan belt', 30, 0.2, 1, [0.1, 0.17, 0.01], () => B.belt(), { cat: 'Engine', consumable: true }),
  flywheel: P_('flywheel', 'Flywheel', 210, 8, 6, [0.14, 0.14, 0.02], () => B.flywheel(), { cat: 'Engine' }),
  clutchdisc: P_('clutchdisc', 'Clutch disc', 120, 1, 0, [0.11, 0.11, 0.02], () => B.clutchDisc(), { cat: 'Engine' }),
  clutchplate: P_('clutchplate', 'Clutch pressure plate', 170, 4, 6, [0.13, 0.13, 0.025], () => B.clutchPlate(), { cat: 'Engine' }),
  gearbox: P_('gearbox', 'Gearbox (4-speed)', 950, 24, 4, [0.12, 0.2, 0.28], () => B.gearbox('stock'), { cat: 'Drivetrain', stats: { gears: [3.6, 2.15, 1.38, 1.0], reverse: 3.65 } }),
  gearbox5: P_('gearbox', 'Close-ratio 5-speed gearbox', 2600, 26, 4, [0.12, 0.2, 0.28], () => B.gearbox('sport'), { cat: 'Performance', variant: 'sport', stats: { gears: [3.2, 2.15, 1.55, 1.2, 1.0], reverse: 3.4 } }),
  starter: P_('starter', 'Starter motor', 240, 4, 2, [0.05, 0.05, 0.09], () => B.starter(), { cat: 'Engine' }),
  dist: P_('dist', 'Distributor', 190, 1.2, 1, [0.05, 0.08, 0.05], () => B.distributor(), { cat: 'Ignition', tune: 'timing' }),
  plug: P_('plug', 'Spark plug', 12, 0.08, 1, [0.015, 0.03, 0.015], () => B.plug(), { cat: 'Ignition', consumable: true }),
  wires: P_('wires', 'Spark plug wires', 60, 0.4, 0, [0.07, 0.05, 0.12], () => B.wires(), { cat: 'Ignition' }),
  intake: P_('intake', 'Intake manifold', 210, 3, 4, [0.07, 0.05, 0.22], () => B.intake(), { cat: 'Engine' }),
  carb: P_('carb', 'Carburettor (single)', 340, 2.2, 4, [0.05, 0.05, 0.05], () => B.carb('stock'), { cat: 'Fuel', tune: 'afr', stats: { power: 0 } }),
  carbTwin: P_('carb', 'Twin carburettors', 1180, 3.5, 4, [0.05, 0.05, 0.1], () => B.carb('twin'), { cat: 'Performance', tune: 'afr', variant: 'twin', stats: { power: 0.1, peak: 300 } }),
  carbRace: P_('carb', 'Racing carburettor', 1450, 3, 4, [0.06, 0.05, 0.07], () => B.carb('race'), { cat: 'Performance', tune: 'afr', variant: 'race', stats: { power: 0.2, peak: 600, rough: 0.1 } }),
  airfilter: P_('airfilter', 'Air filter (stock)', 40, 0.6, 1, [0.12, 0.03, 0.12], () => B.airFilter('stock'), { cat: 'Fuel' }),
  airfilterSport: P_('airfilter', 'Sport air filter', 160, 0.3, 1, [0.06, 0.04, 0.06], () => B.airFilter('sport'), { cat: 'Performance', variant: 'sport', stats: { power: 0.02 } }),
  header: P_('header', 'Exhaust manifold', 260, 6, 4, [0.07, 0.17, 0.22], () => B.header('stock'), { cat: 'Exhaust' }),
  headerRace: P_('header', 'Racing header', 980, 4, 4, [0.07, 0.17, 0.22], () => B.header('race'), { cat: 'Performance', variant: 'race', stats: { power: 0.06, exhaust: 0.2 } }),
  turbo: P_('header', 'Turbo kit', 4200, 9, 4, [0.12, 0.08, 0.22], () => B.header('turbo'), { cat: 'Performance', variant: 'turbo', stats: { turbo: 0.45, exhaust: 0.15, heat: 0.4 } }),
  fpump: P_('fpump', 'Fuel pump', 130, 0.7, 2, [0.04, 0.04, 0.03], () => B.fuelPump(), { cat: 'Fuel' }),
  radiator: P_('radiator', 'Radiator', 420, 5, 4, [0.3, 0.2, 0.04], () => B.radiator(), { cat: 'Cooling' }),
  hoseU: P_('hoseU', 'Upper radiator hose', 30, 0.3, 2, [0.03, 0.04, 0.2], () => B.hose('upper'), { cat: 'Cooling' }),
  hoseL: P_('hoseL', 'Lower radiator hose', 30, 0.3, 2, [0.03, 0.06, 0.2], () => B.hose('lower'), { cat: 'Cooling' }),
  battery: P_('battery', 'Battery 12 V', 290, 14, 2, [0.12, 0.1, 0.09], () => B.battery(), { cat: 'Electrics' }),
  wiring: P_('wiring', 'Wiring harness', 380, 3, 3, [0.5, 0.06, 0.3], () => B.wiring(), { cat: 'Electrics' }),
  fuses: P_('fuses', 'Fuse box', 70, 0.4, 2, [0.06, 0.03, 0.04], () => B.fuses(), { cat: 'Electrics' }),
  coil: P_('coil', 'Ignition coil', 95, 0.8, 2, [0.03, 0.08, 0.03], () => B.coil(), { cat: 'Ignition' }),
  brakemaster: P_('brakemaster', 'Brake master cylinder', 230, 1.5, 2, [0.04, 0.05, 0.08], () => B.brakeMaster(), { cat: 'Brakes' }),
  rack: P_('rack', 'Steering rack', 520, 7, 4, [0.5, 0.04, 0.05], () => B.rack(), { cat: 'Steering' }),
  column: P_('column', 'Steering column', 190, 3, 3, [0.04, 0.2, 0.3], () => B.column(), { cat: 'Steering' }),
  swheel: P_('swheel', 'Steering wheel (stock)', 120, 1.5, 1, [0.2, 0.2, 0.03], () => B.swheel('stock'), { cat: 'Interior' }),
  swheelSport: P_('swheel', 'Sport steering wheel', 380, 1.1, 1, [0.18, 0.18, 0.03], () => B.swheel('sport'), { cat: 'Interior', variant: 'sport', stats: { steer: 1.1 } }),
  swheelRally: P_('swheel', 'Rally steering wheel', 520, 1, 1, [0.17, 0.17, 0.03], () => B.swheel('rally'), { cat: 'Interior', variant: 'rally', stats: { steer: 1.18 } }),
  dash: P_('dash', 'Dashboard', 340, 6, 4, [0.68, 0.12, 0.17], () => B.dash(), { cat: 'Interior' }),
  gauges: P_('gauges', 'Gauge cluster', 260, 1, 2, [0.17, 0.09, 0.03], () => B.gauges(), { cat: 'Interior' }),
  radio: P_('radio', 'Car radio', 240, 1.2, 2, [0.09, 0.03, 0.07], () => B.radio(), { cat: 'Interior' }),
  strut: P_('strut', 'Front strut (stock)', 260, 5, 3, [0.08, 0.3, 0.08], () => B.strut('stock'), { cat: 'Suspension', stats: { stiff: 1, height: 0 } }),
  strutSport: P_('strut', 'Sport coilover (front)', 780, 5, 3, [0.08, 0.3, 0.08], () => B.strut('sport'), { cat: 'Performance', variant: 'sport', stats: { stiff: 1.45, height: -0.03 } }),
  strutRally: P_('strut', 'Rally strut (front)', 980, 6, 3, [0.08, 0.3, 0.08], () => B.strut('rally'), { cat: 'Performance', variant: 'rally', stats: { stiff: 1.2, height: 0.04, travel: 1.35 } }),
  disc: P_('disc', 'Brake disc & hub', 170, 6, 2, [0.04, 0.12, 0.12], () => B.disc('stock'), { cat: 'Brakes' }),
  discSport: P_('disc', 'Sport brake disc', 360, 5, 2, [0.04, 0.12, 0.12], () => B.disc('sport'), { cat: 'Performance', variant: 'sport', stats: { brake: 0.15 } }),
  caliper: P_('caliper', 'Brake caliper', 140, 2, 2, [0.03, 0.05, 0.04], () => B.caliper('stock'), { cat: 'Brakes' }),
  caliperSport: P_('caliper', 'Sport caliper', 320, 1.8, 2, [0.03, 0.05, 0.04], () => B.caliper('sport'), { cat: 'Performance', variant: 'sport', stats: { brake: 0.15 } }),
  axle: P_('axle', 'Rear axle 4.11', 1100, 35, 4, [0.63, 0.13, 0.15], () => B.axle('stock'), { cat: 'Drivetrain', stats: { final: 4.11 } }),
  axleRally: P_('axle', 'Rally axle 4.63 LSD', 2900, 36, 4, [0.63, 0.13, 0.15], () => B.axle('rally'), { cat: 'Performance', variant: 'rally', stats: { final: 4.63, lsd: true } }),
  shock: P_('shock', 'Rear shock absorber', 120, 2, 2, [0.03, 0.15, 0.03], () => B.shock(), { cat: 'Suspension' }),
  coilspring: P_('coilspring', 'Rear coil spring', 60, 2, 1, [0.07, 0.13, 0.07], () => B.coilSpring('stock'), { cat: 'Suspension', stats: { stiff: 1, height: 0 } }),
  coilspringSport: P_('coilspring', 'Sport rear spring', 190, 2, 1, [0.07, 0.13, 0.07], () => B.coilSpring('sport'), { cat: 'Performance', variant: 'sport', stats: { stiff: 1.4, height: -0.03 } }),
  coilspringRally: P_('coilspring', 'Rally rear spring', 240, 2, 1, [0.07, 0.13, 0.07], () => B.coilSpring('rally'), { cat: 'Performance', variant: 'rally', stats: { stiff: 1.2, height: 0.04 } }),
  drum: P_('drum', 'Rear brake drum', 140, 5, 2, [0.04, 0.11, 0.11], () => B.drum(), { cat: 'Brakes' }),
  wheel: P_('wheel', 'Steel wheel 13" + tyre', 220, 12, 4, [0.09, 0.29, 0.29], () => B.wheel('steel'), { cat: 'Wheels', material: 'rubber', stats: { radius: 0.29, grip: 1.0, gravel: 1.0 } }),
  wheelAlloy: P_('wheel', 'Alloy wheel 13" + tyre', 540, 9, 4, [0.09, 0.29, 0.29], () => B.wheel('alloy'), { cat: 'Wheels', material: 'rubber', variant: 'alloy', stats: { radius: 0.29, grip: 1.05, gravel: 1.0 } }),
  wheelSport: P_('wheel', 'Sport 14" tarmac tyre', 780, 10, 4, [0.1, 0.3, 0.3], () => B.wheel('sport'), { cat: 'Wheels', material: 'rubber', variant: 'sport', stats: { radius: 0.3, grip: 1.18, gravel: 0.9 } }),
  wheelRally: P_('wheel', 'Rally 14" gravel tyre', 820, 11, 4, [0.1, 0.305, 0.305], () => B.wheel('rally'), { cat: 'Wheels', material: 'rubber', variant: 'rally', stats: { radius: 0.305, grip: 0.98, gravel: 1.3 } }),
  driveshaft: P_('driveshaft', 'Driveshaft', 280, 8, 4, [0.04, 0.04, 0.76], () => B.driveshaft(), { cat: 'Drivetrain' }),
  pipe: P_('pipe', 'Exhaust pipe', 160, 5, 2, [0.04, 0.04, 0.9], () => B.pipe(), { cat: 'Exhaust' }),
  muffler: P_('muffler', 'Muffler (stock)', 180, 6, 2, [0.14, 0.07, 0.3], () => B.muffler('stock'), { cat: 'Exhaust', stats: { exhaust: 0, power: 0 } }),
  mufflerSport: P_('muffler', 'Sport muffler', 420, 4, 2, [0.1, 0.07, 0.3], () => B.muffler('sport'), { cat: 'Performance', variant: 'sport', stats: { exhaust: 0.35, power: 0.03 } }),
  mufflerStraight: P_('muffler', 'Straight pipe', 90, 2, 2, [0.04, 0.04, 0.3], () => B.muffler('straight'), { cat: 'Performance', variant: 'straight', stats: { exhaust: 0.8, power: 0.05, loud: true } }),
  tank: P_('tank', 'Fuel tank 36 L', 320, 9, 4, [0.45, 0.13, 0.22], () => B.tank(), { cat: 'Fuel' }),
  fuelline: P_('fuelline', 'Fuel line', 50, 0.4, 2, [0.05, 0.05, 0.9], () => B.fuelLine(), { cat: 'Fuel' }),
  seat: P_('seat', 'Front seat', 260, 12, 4, [0.25, 0.45, 0.28], () => B.seat('stock'), { cat: 'Interior' }),
  seatBucket: P_('seat', 'Bucket seat', 690, 8, 4, [0.25, 0.45, 0.28], () => B.seat('bucket'), { cat: 'Interior', variant: 'bucket' }),
  rearseat: P_('rearseat', 'Rear bench', 220, 14, 2, [0.6, 0.3, 0.3], () => B.rearSeat(), { cat: 'Interior' }),
  bumperF: P_('bumperF', 'Front bumper', 240, 7, 4, [0.81, 0.07, 0.07], () => B.bumper('F'), { cat: 'Body' }),
  bumperR: P_('bumperR', 'Rear bumper', 240, 7, 4, [0.81, 0.07, 0.07], () => B.bumper('R'), { cat: 'Body' }),
  grille: P_('grille', 'Grille', 130, 1.5, 3, [0.45, 0.08, 0.03], () => B.grille(), { cat: 'Body' }),
  headlight: P_('headlight', 'Headlight', 110, 1.2, 2, [0.09, 0.09, 0.05], () => B.headlight(), { cat: 'Lights' }),
  taillight: P_('taillight', 'Tail light', 80, 0.6, 2, [0.13, 0.05, 0.03], () => B.taillight(), { cat: 'Lights' }),
  mirror: P_('mirror', 'Side mirror', 60, 0.4, 1, [0.05, 0.07, 0.04], () => B.mirror(), { cat: 'Body' }),
  plate: P_('plate', 'License plate', 0, 0.3, 2, [0.17, 0.04, 0.01], (inst) => B.plate(inst?.data?.text), { cat: 'Body' }),
  spoiler: P_('spoiler', 'Ducktail spoiler', 420, 3, 2, [0.65, 0.07, 0.12], () => B.spoiler(), { cat: 'Cosmetic', stats: { downforce: 0.05 } }),
  rallylights: P_('rallylights', 'Rally light bar', 560, 4, 2, [0.45, 0.08, 0.05], () => B.rallyLights(), { cat: 'Lights' }),
  cage: P_('cage', 'Roll cage', 1400, 30, 8, [0.62, 0.32, 0.65], () => B.cage(), { cat: 'Safety', stats: { safety: 0.6 } }),
  mudflaps: P_('mudflaps', 'Rally mudflaps', 140, 2, 4, [0.7, 0.12, 1.25], () => B.mudflaps(), { cat: 'Cosmetic' }),
};
// body panel defs are filled in by the car (geometry from the parametric body)
export const PANEL_TYPES = ['doorL', 'doorR', 'hood', 'trunk', 'fenderL', 'fenderR'];
export const PANEL_INFO = {
  doorL: { name: 'Left door', price: 650, mass: 18, bolts: 3 }, doorR: { name: 'Right door', price: 650, mass: 18, bolts: 3 },
  hood: { name: 'Hood', price: 480, mass: 12, bolts: 4 }, trunk: { name: 'Trunk lid', price: 420, mass: 10, bolts: 4 },
  fenderL: { name: 'Left fender', price: 320, mass: 6, bolts: 5 }, fenderR: { name: 'Right fender', price: 320, mass: 6, bolts: 5 },
};
export { B as PartBuilders };
