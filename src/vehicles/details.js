import * as THREE from 'three';
import { tex } from '../core/assets.js';
import { bodyMats } from './bodygen.js';

// Detailed, shared vehicle components: wheels, lamps, bumpers, grilles, plates, mirrors, seats.
// Geometry is cached per style so every instance shares GPU buffers.
const cache = new Map();
const cached = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
const mesh = (g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; return o; };

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- materials
let DM = null;
export function detailMats() {
  if (DM) return DM;
  const B = bodyMats();
  const sidewall = canvasTex(1024, 64, (c, w, h) => {
    c.fillStyle = '#141414'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    c.fillStyle = '#2a2a2a'; c.font = 'bold 26px Arial'; c.textAlign = 'center';
    for (const x of [256, 768]) { c.fillText('KURKI RADIAL', x - 60, 42); c.font = 'bold 16px Arial'; c.fillText('175/70 R13  82S', x + 130, 40); c.font = 'bold 26px Arial'; }
    c.fillStyle = '#1e1e1e'; c.fillRect(0, 0, w, 4); c.fillRect(0, h - 4, w, 4);
  });
  sidewall.wrapS = THREE.RepeatWrapping;
  const lensN = canvasTex(64, 64, (c, w, h) => {
    // fluted headlamp lens normal map (vertical prisms)
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const fx = Math.sin((x / w) * Math.PI * 2 * 6), fy = Math.sin((y / h) * Math.PI * 2 * 3) * 0.4;
      const o = (y * w + x) * 4;
      img.data[o] = 128 + fx * 90; img.data[o + 1] = 128 + fy * 60; img.data[o + 2] = 230; img.data[o + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }, false);
  lensN.wrapS = lensN.wrapT = THREE.RepeatWrapping;
  const treadN = tex('tread_n.jpg', { srgb: false });
  DM = {
    ...B,
    tread: new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.92, normalMap: treadN, normalScale: new THREE.Vector2(1.4, 1.4) }),
    sidewall: new THREE.MeshStandardMaterial({ map: sidewall, roughness: 0.85 }),
    steelRim: new THREE.MeshStandardMaterial({ color: 0x2c2d30, metalness: 0.6, roughness: 0.42 }),
    whiteRim: new THREE.MeshStandardMaterial({ color: 0xe8e8e6, metalness: 0.2, roughness: 0.35 }),
    alloy: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 0.85, roughness: 0.28 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x5a5550, metalness: 0.8, roughness: 0.55, map: tex('grime.jpg') }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35, normalMap: lensN, normalScale: new THREE.Vector2(0.6, 0.6), clearcoat: 1, depthWrite: false }),
    reflector: new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 1, roughness: 0.12, emissive: 0xfff0d0, emissiveIntensity: 0 }),
    red: new THREE.MeshPhysicalMaterial({ color: 0xa01008, roughness: 0.15, transparent: true, opacity: 0.92, emissive: 0xff1000, emissiveIntensity: 0.05, clearcoat: 1 }),
    redOn: new THREE.MeshPhysicalMaterial({ color: 0xff2010, roughness: 0.15, emissive: 0xff1000, emissiveIntensity: 3, clearcoat: 1 }),
    clear: new THREE.MeshPhysicalMaterial({ color: 0xf4f4f4, roughness: 0.1, transparent: true, opacity: 0.6, clearcoat: 1 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x161718, roughness: 0.6, metalness: 0.05 }),
    grille: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.5, metalness: 0.4 }),
    seatFabric: new THREE.MeshStandardMaterial({ map: tex('fabric.jpg'), normalMap: tex('fabric_n.jpg', { srgb: false }), roughness: 0.95 }),
    seatVinyl: new THREE.MeshStandardMaterial({ map: tex('vinyl.jpg'), normalMap: tex('vinyl_n.jpg', { srgb: false }), roughness: 0.5, color: 0x6a4a34 }),
    dash: new THREE.MeshStandardMaterial({ color: 0x4a3e34, roughness: 0.72, normalMap: tex('vinyl_n.jpg', { srgb: false }), normalScale: new THREE.Vector2(0.25, 0.25) }),
    woodTrim: new THREE.MeshStandardMaterial({ map: tex('planks_dark.jpg'), color: 0x8a5a30, roughness: 0.3, metalness: 0.1 }),
  };
  return DM;
}

// ---------------------------------------------------------------- wheels
// style: 'hubcap' | 'alloy' | 'rally' | 'sport' | 'van' | 'trafficSteel'
export function wheel(style = 'hubcap', R = 0.29, W = 0.165, lite = false) {
  const M = detailMats();
  const key = `${style}|${R.toFixed(3)}|${W.toFixed(3)}|${lite}`;
  const parts = cached('wheel:' + key, () => wheelGeos(style, R, W, lite ? 0.6 : 1));
  const g = new THREE.Group(); const spin = new THREE.Group(); spin.name = 'spin';
  spin.add(mesh(parts.tread, M.tread));
  spin.add(mesh(parts.side, M.sidewall));
  const rimMat = style === 'alloy' || style === 'sport' ? M.alloy : style === 'rally' ? M.whiteRim : M.steelRim;
  spin.add(mesh(parts.barrel, rimMat));
  spin.add(mesh(parts.face, rimMat));
  if (parts.cap) spin.add(mesh(parts.cap, M.chrome));
  if (parts.nuts) spin.add(mesh(parts.nuts, M.chrome));
  if (parts.disc) { const d = mesh(parts.disc, M.disc); g.add(d); }
  g.add(spin);
  g.userData.spin = spin; g.userData.radius = R;
  return g;
}

function wheelGeos(style, R, W, q = 1) {
  const SEG = Math.round(36 * q), CS = Math.max(6, Math.round(14 * q));
  const rimR = R - (style === 'van' ? 0.1 : 0.088);
  const hw = W / 2;
  // tread band: slightly crowned cylinder
  const tp = [];
  for (let i = 0; i <= 6; i++) { const k = i / 6; const x = -hw * 0.86 + k * hw * 1.72; tp.push(new THREE.Vector2(R - 0.006 * (2 * k - 1) ** 2, x)); }
  const tread = new THREE.LatheGeometry(tp, SEG);
  tread.rotateZ(Math.PI / 2);
  const uv = tread.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i) * 10);
  // sidewalls: rounded bulge from rim to tread on both faces
  const sp = [];
  for (let i = 0; i <= 6; i++) { const a = i / 6; const r = rimR + 0.012 + (R - 0.01 - rimR - 0.012) * a; const bul = Math.sin(a * Math.PI) * 0.018; sp.push(new THREE.Vector2(r, hw * 0.88 + bul - (a > 0.85 ? (a - 0.85) * 0.1 : 0))); }
  const sideA = new THREE.LatheGeometry(sp, SEG); sideA.rotateZ(-Math.PI / 2);
  const sideB = sideA.clone(); sideB.rotateY(Math.PI);
  const side = mergeIdx([sideA, sideB]);
  // map the sidewall texture around: lathe uv.x runs around
  // rim barrel
  const barrel = new THREE.CylinderGeometry(rimR, rimR, W * 0.86, SEG, 1, true); barrel.rotateZ(Math.PI / 2);
  let face, cap = null, nuts = null, disc = null;
  const fz = hw * 0.55;
  if (style === 'alloy' || style === 'sport') {
    const s = new THREE.Shape(); s.absarc(0, 0, rimR * 0.97, 0, Math.PI * 2, false);
    const n = style === 'sport' ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + 0.12, a1 = ((i + 1) / n) * Math.PI * 2 - 0.12;
      const h = new THREE.Path(); h.moveTo(Math.cos(a0) * rimR * 0.36, Math.sin(a0) * rimR * 0.36);
      h.absarc(0, 0, rimR * 0.84, a0 + 0.06, a1 - 0.06, false); h.lineTo(Math.cos(a1) * rimR * 0.36, Math.sin(a1) * rimR * 0.36); h.closePath();
      s.holes.push(h);
    }
    face = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 1, curveSegments: CS });
    face.rotateY(Math.PI / 2); face.translate(fz - 0.035, 0, 0);
    const cp = [new THREE.Vector2(0, 0.02), new THREE.Vector2(0.045, 0.018), new THREE.Vector2(0.05, 0.0)];
    cap = new THREE.LatheGeometry(cp, 16); cap.rotateZ(-Math.PI / 2); cap.translate(fz, 0, 0);
    disc = new THREE.CylinderGeometry(rimR * 0.85, rimR * 0.85, 0.02, SEG); disc.rotateZ(Math.PI / 2); disc.translate(-0.01, 0, 0);
  } else if (style === 'rally') {
    const s = new THREE.Shape(); s.absarc(0, 0, rimR * 0.97, 0, Math.PI * 2, false);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const h = new THREE.Path(); h.absarc(Math.cos(a) * rimR * 0.62, Math.sin(a) * rimR * 0.62, rimR * 0.16, 0, Math.PI * 2, true); s.holes.push(h); }
    const c = new THREE.Path(); c.absarc(0, 0, 0.035, 0, Math.PI * 2, true); s.holes.push(c);
    face = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: CS });
    face.rotateY(Math.PI / 2); face.translate(fz - 0.03, 0, 0);
    nuts = lugNuts(fz - 0.012, 0.05, 4);
    disc = new THREE.CylinderGeometry(rimR * 0.85, rimR * 0.85, 0.02, SEG); disc.rotateZ(Math.PI / 2); disc.translate(-0.02, 0, 0);
  } else {
    // pressed steel wheel with vent slots + chrome hubcap
    const s = new THREE.Shape(); s.absarc(0, 0, rimR * 0.97, 0, Math.PI * 2, false);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const h = new THREE.Path(); h.absellipse(Math.cos(a) * rimR * 0.72, Math.sin(a) * rimR * 0.72, rimR * 0.1, rimR * 0.06, 0, Math.PI * 2, true, a); s.holes.push(h); }
    face = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 1, curveSegments: CS });
    face.rotateY(Math.PI / 2); face.translate(fz - 0.035, 0, 0);
    if (style !== 'trafficSteel' && style !== 'van') {
      const cp = [];
      for (let i = 0; i <= 6; i++) { const a = i / 6; cp.push(new THREE.Vector2(rimR * 0.62 * (1 - a * a * 0.9) + 0.002, 0.004 + Math.sin(a * Math.PI / 2) * 0.035)); }
      cp.reverse();
      cap = new THREE.LatheGeometry(cp, Math.round(24 * q)); cap.rotateZ(-Math.PI / 2); cap.translate(fz - 0.02, 0, 0);
    } else nuts = lugNuts(fz - 0.012, 0.055, style === 'van' ? 6 : 4);
  }
  return { tread, side, barrel, face, cap, nuts, disc };
}
function lugNuts(x, r, n) {
  const gs = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.4; const g = new THREE.CylinderGeometry(0.009, 0.009, 0.018, 6); g.rotateZ(Math.PI / 2); g.translate(x, Math.cos(a) * r, Math.sin(a) * r); gs.push(g); }
  const h = new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12); h.rotateZ(Math.PI / 2); h.translate(x, 0, 0); gs.push(h);
  return mergeIdx(gs);
}
export function mergeIdx(geos) {
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

// ---------------------------------------------------------------- lamps
// round sealed-beam headlamp facing +z; origin at the lens centre
export function headlampRound(r = 0.085, { bezel = true } = {}) {
  const M = detailMats();
  const parts = cached('hl:' + r, () => {
    const bucket = new THREE.CylinderGeometry(r * 1.02, r * 0.9, 0.09, 28, 1, true); bucket.rotateX(Math.PI / 2); bucket.translate(0, 0, -0.045);
    const refl = new THREE.SphereGeometry(r * 0.98, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); refl.rotateX(-Math.PI / 2); refl.scale(1, 1, 0.75); refl.translate(0, 0, -0.005);
    const lp = []; for (let i = 0; i <= 8; i++) { const a = i / 8; lp.push(new THREE.Vector2(r * Math.sin(a * Math.PI / 2) * 0.99, 0.012 * Math.cos(a * Math.PI / 2))); }
    const lens = new THREE.LatheGeometry(lp, 32); lens.rotateX(Math.PI / 2);
    const ring = new THREE.TorusGeometry(r * 1.04, r * 0.11, 8, 32);
    const bulb = new THREE.SphereGeometry(r * 0.16, 10, 8); bulb.translate(0, 0, -0.02);
    return { bucket, refl, lens, ring, bulb };
  });
  const g = new THREE.Group();
  g.add(mesh(parts.bucket, M.chrome));
  const rf = mesh(parts.refl, M.reflector.clone()); rf.name = 'reflector'; g.add(rf);
  g.add(mesh(parts.bulb, M.chrome));
  const l = mesh(parts.lens, M.lens); l.renderOrder = 4; g.add(l);
  if (bezel) g.add(mesh(parts.ring, M.chrome, 0, 0, 0.004));
  return g;
}
export function headlampRect(w = 0.24, h = 0.13) {
  const M = detailMats();
  const parts = cached(`hlr:${w}:${h}`, () => {
    const housing = new THREE.BoxGeometry(w, h, 0.06); housing.translate(0, 0, -0.03);
    const refl = new THREE.PlaneGeometry(w * 0.92, h * 0.86); refl.translate(0, 0, -0.012);
    const lens = new THREE.BoxGeometry(w * 0.96, h * 0.92, 0.01); lens.translate(0, 0, 0.003);
    const frame = rectFrame(w, h, 0.012);
    return { housing, refl, lens, frame };
  });
  const g = new THREE.Group();
  g.add(mesh(parts.housing, M.plastic));
  const rf = mesh(parts.refl, M.reflector.clone()); rf.name = 'reflector'; g.add(rf);
  const l = mesh(parts.lens, M.lens); l.renderOrder = 4; g.add(l);
  g.add(mesh(parts.frame, M.chrome, 0, 0, 0.006));
  return g;
}
function rectFrame(w, h, t) {
  const s = new THREE.Shape(); s.moveTo(-w / 2 - t, -h / 2 - t); s.lineTo(w / 2 + t, -h / 2 - t); s.lineTo(w / 2 + t, h / 2 + t); s.lineTo(-w / 2 - t, h / 2 + t); s.closePath();
  const hole = new THREE.Path(); hole.moveTo(-w / 2, -h / 2); hole.lineTo(-w / 2, h / 2); hole.lineTo(w / 2, h / 2); hole.lineTo(w / 2, -h / 2); hole.closePath(); s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });
}
// tail lamp cluster facing -z: red / amber / reversing white sections in a chrome frame
export function tailLamp(w = 0.28, h = 0.11, { amber = true, mirror = false } = {}) {
  const M = detailMats();
  const g = new THREE.Group();
  g.add(mesh(cached(`tlf:${w}:${h}`, () => rectFrame(w, h, 0.01)), M.chrome, 0, 0, -0.002, 0, Math.PI));
  const secs = amber ? [[0.55, 'red'], [0.22, 'amber'], [0.23, 'clear']] : [[0.75, 'red'], [0.25, 'clear']];
  let x = -w / 2;
  if (mirror) secs.reverse();
  for (const [f, kind] of secs) {
    const sw = w * f;
    const lg = cached(`tl:${sw.toFixed(3)}:${h}`, () => { const b = new THREE.BoxGeometry(sw - 0.006, h - 0.006, 0.025); b.translate(0, 0, 0.0); return b; });
    const mat = kind === 'red' ? M.red : kind === 'amber' ? M.amber : M.clear;
    const m = mesh(lg, mat, x + sw / 2, 0, -0.012);
    if (kind === 'red') m.name = 'redLens';
    g.add(m);
    // ribbed texture lines
    x += sw;
  }
  const back = mesh(cached(`tlb:${w}:${h}`, () => new THREE.BoxGeometry(w, h, 0.04)), M.plastic, 0, 0, 0.02);
  g.add(back);
  return g;
}

// ---------------------------------------------------------------- bumpers & grilles
// chrome blade bumper following a plan-view curve; origin at its centre, facing +z (front) or -z (dir=-1)
export function bumper(width = 1.64, { dir = 1, wrap = 0.18, chrome = true, h = 0.11, overriders = true } = {}) {
  const M = detailMats();
  const key = `bmp:${width}:${dir}:${wrap}:${chrome}:${h}`;
  const parts = cached(key, () => {
    const hw = width / 2;
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const k = i / 24 * 2 - 1; const x = k * hw;
      const z = -wrap * Math.pow(Math.abs(k), 5);
      pts.push(new THREE.Vector3(x, 0, z));
    }
    // wrap-around ends
    pts.unshift(new THREE.Vector3(-hw + 0.02, 0, -wrap - 0.1)); pts.push(new THREE.Vector3(hw - 0.02, 0, -wrap - 0.1));
    const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const prof = new THREE.Shape();
    // C-shaped blade profile (in local frame: x = outward normal, y = up)
    prof.moveTo(-0.03, -h / 2); prof.quadraticCurveTo(0.02, -h / 2, 0.025, -h * 0.2); prof.lineTo(0.03, h * 0.25); prof.quadraticCurveTo(0.02, h / 2, -0.02, h / 2); prof.lineTo(-0.03, h * 0.45); prof.lineTo(-0.03, -h * 0.45); prof.closePath();
    const blade = new THREE.ExtrudeGeometry(prof, { steps: 60, bevelEnabled: false, extrudePath: path });
    const strip = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(3, -3).map((p) => p.clone().add(new THREE.Vector3(0, 0, 0.032))), false, 'centripetal'), 40, 0.012, 6);
    return { blade, strip };
  });
  const g = new THREE.Group();
  g.add(mesh(parts.blade, chrome ? M.chrome : M.plastic));
  g.add(mesh(parts.strip, M.rubber, 0, -0.01, 0));
  if (overriders) for (const s of [1, -1]) {
    const o = mesh(cached('ovr', () => { const c = new THREE.CapsuleGeometry(0.026, 0.07, 4, 8); return c; }), M.rubber, s * width * 0.27, 0, 0.04);
    g.add(o);
  }
  if (dir < 0) g.rotation.y = Math.PI;
  return g;
}
export function grilleFull(w = 0.9, h = 0.17, style = 'bars') {
  const M = detailMats();
  const g = new THREE.Group();
  g.add(mesh(cached(`gf:${w}:${h}`, () => rectFrame(w, h, 0.014)), M.chrome, 0, 0, 0.012));
  g.add(mesh(cached(`gb:${w}:${h}`, () => new THREE.BoxGeometry(w, h, 0.02)), M.grille, 0, 0, -0.01));
  if (style === 'bars') {
    const bars = cached(`gbar:${w}:${h}`, () => { const gs = []; for (let i = 1; i < 7; i++) { const b = new THREE.BoxGeometry(w - 0.01, 0.006, 0.012); b.translate(0, -h / 2 + h * i / 7, 0.006); gs.push(b); } for (let i = 1; i < 12; i++) { const b = new THREE.BoxGeometry(0.004, h - 0.01, 0.008); b.translate(-w / 2 + w * i / 12, 0, 0.002); gs.push(b); } return mergeIdx(gs); });
    g.add(mesh(bars, M.chrome));
  } else {
    const bars = cached(`gegg:${w}:${h}`, () => { const gs = []; for (let i = 1; i < 4; i++) { const b = new THREE.BoxGeometry(w - 0.01, 0.01, 0.02); b.translate(0, -h / 2 + h * i / 4, 0.004); gs.push(b); } for (let i = 1; i < 16; i++) { const b = new THREE.BoxGeometry(0.008, h - 0.01, 0.02); b.translate(-w / 2 + w * i / 16, 0, 0.004); gs.push(b); } return mergeIdx(gs); });
    g.add(mesh(bars, M.black));
  }
  return g;
}
export function plateMesh(text, w = 0.34, h = 0.075) {
  const t = canvasTex(256, 56, (c) => { c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, 256, 56); c.strokeStyle = '#111'; c.lineWidth = 4; c.strokeRect(3, 3, 250, 50); c.fillStyle = '#1a3a8a'; c.fillRect(6, 6, 24, 44); c.fillStyle = '#fff'; c.font = 'bold 14px Arial'; c.fillText('FIN', 7, 46); c.fillStyle = '#111'; c.font = 'bold 40px Arial'; c.fillText(text, 42, 44); });
  return mesh(new THREE.BoxGeometry(w, h, 0.006), [detailMats().steelRim, detailMats().steelRim, detailMats().steelRim, detailMats().steelRim, new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, metalness: 0.3 }), detailMats().steelRim]);
}
export function mirror(side = 1) {
  const M = detailMats();
  const g = new THREE.Group();
  g.add(mesh(cached('mstem', () => new THREE.CylinderGeometry(0.008, 0.012, 0.09, 8)), M.chrome, side * 0.02, 0.04, 0, 0, 0, -side * 0.6));
  const head = cached('mhead', () => { const p = []; for (let i = 0; i <= 10; i++) { const a = i / 10; p.push(new THREE.Vector2(0.06 * Math.sin(a * Math.PI * 0.55 + 0.1), -0.05 + a * 0.07)); } const l = new THREE.LatheGeometry(p, 20); l.rotateX(-Math.PI / 2); return l; });
  g.add(mesh(head, M.chrome, side * 0.055, 0.09, 0.02));
  g.add(mesh(cached('mglass', () => new THREE.CircleGeometry(0.052, 20)), new THREE.MeshStandardMaterial({ color: 0xdfe8f0, metalness: 1, roughness: 0.03 }), side * 0.055, 0.09, -0.031, 0, Math.PI, 0));
  return g;
}
export function wiper(len = 0.45) {
  const M = detailMats();
  const g = new THREE.Group();
  g.add(mesh(cached('wa' + len, () => { const b = new THREE.BoxGeometry(len, 0.008, 0.012); b.translate(len / 2, 0, 0); return b; }), M.black));
  g.add(mesh(cached('wb' + len, () => { const b = new THREE.BoxGeometry(len * 0.9, 0.014, 0.008); b.translate(len * 0.52, -0.006, 0.006); return b; }), M.rubber));
  return g;
}

// ---------------------------------------------------------------- interior
export function seat(style = 'stock') {
  const M = detailMats();
  const mat = style === 'bucket' ? new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.9, map: tex('fabric.jpg') }) : style === 'vinyl' ? M.seatVinyl : M.seatFabric;
  const g = new THREE.Group();
  const cushion = cached('seatc:' + style, () => pillow(0.5, 0.13, 0.5, 0.05, 0.02));
  const back = cached('seatb:' + style, () => pillow(0.48, style === 'bucket' ? 0.68 : 0.6, 0.13, 0.05, 0.02));
  g.add(mesh(cushion, mat, 0, 0.11, 0.04, -0.05));
  g.add(mesh(back, mat, 0, 0.45, -0.21, -0.14));
  if (style === 'bucket') { for (const s of [1, -1]) g.add(mesh(cached('bolster', () => pillow(0.08, 0.5, 0.18, 0.03, 0.01)), mat, s * 0.25, 0.42, -0.16, -0.14)); g.add(mesh(cached('bolsterc', () => pillow(0.07, 0.1, 0.45, 0.03, 0.01)), mat, 0.24, 0.16, 0.04)); g.add(mesh(cached('bolsterc', () => pillow(0.07, 0.1, 0.45, 0.03, 0.01)), mat, -0.24, 0.16, 0.04)); }
  else { const hr = mesh(cached('headrest', () => pillow(0.28, 0.17, 0.1, 0.04, 0.015)), mat, 0, 0.86, -0.27, -0.14); g.add(hr); for (const s of [1, -1]) g.add(mesh(cached('hrpost', () => new THREE.CylinderGeometry(0.007, 0.007, 0.12, 6)), M.chrome, s * 0.08, 0.76, -0.26, -0.14)); }
  // piping seams
  g.add(mesh(cached('seatrail', () => new THREE.BoxGeometry(0.44, 0.04, 0.44)), M.black, 0, 0.025, 0.0));
  for (const s of [1, -1]) g.add(mesh(cached('seatrunner', () => new THREE.BoxGeometry(0.03, 0.02, 0.5)), M.chrome, s * 0.18, 0.005, 0));
  return g;
}
// a soft, slightly bulged cushion
function pillow(w, h, d, r, bulge) {
  const g = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nx = x / (w / 2), ny = y / (h / 2), nz = z / (d / 2);
    // round the corners
    const k = 1 - r * 0.5 * (Math.abs(nx) ** 6 + Math.abs(ny) ** 6 + Math.abs(nz) ** 6) * 0.3;
    x *= k; y *= k; z *= k;
    // puff faces outward
    z += Math.sign(nz) * bulge * (1 - nx * nx) * (1 - ny * ny);
    y += Math.sign(ny) * bulge * 0.6 * (1 - nx * nx) * (1 - nz * nz);
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
export function steeringWheel(style = 'stock') {
  const M = detailMats();
  const g = new THREE.Group();
  const r = style === 'rally' ? 0.165 : style === 'sport' ? 0.175 : 0.195;
  const thick = style === 'stock' ? 0.014 : 0.019;
  const rimMat = style === 'rally' ? new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.98 }) : style === 'sport' ? new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.5, map: tex('planks_dark.jpg') }) : M.plastic;
  g.add(mesh(cached(`swr:${r}:${thick}`, () => new THREE.TorusGeometry(r, thick, 12, 48)), rimMat));
  g.add(mesh(cached('swhub' + style, () => { const p = [new THREE.Vector2(0, 0.03), new THREE.Vector2(0.05, 0.026), new THREE.Vector2(0.06, 0.0), new THREE.Vector2(0.045, -0.03)]; const l = new THREE.LatheGeometry(p, 20); l.rotateX(Math.PI / 2); return l; }), style === 'sport' ? M.chrome : M.plastic));
  const n = style === 'stock' ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const a = n === 2 ? (i ? Math.PI : 0) : Math.PI / 2 + i * Math.PI * 2 / 3 + Math.PI / 3 * 0;
    const sp = mesh(cached(`swsp:${r}:${style}`, () => { const b = new THREE.BoxGeometry(0.024, r - 0.05, 0.01); b.translate(0, (r - 0.05) / 2 + 0.05, 0); return b; }), style === 'sport' ? M.alloy : M.plastic);
    sp.rotation.z = a + (n === 2 ? Math.PI / 2 : Math.PI); g.add(sp);
  }
  if (style === 'rally') g.add(mesh(new THREE.BoxGeometry(0.014, 0.03, 0.04), new THREE.MeshStandardMaterial({ color: 0xe8c020 }), 0, r, 0));
  // badge
  g.add(mesh(cached('swbadge', () => new THREE.CircleGeometry(0.022, 16)), M.chrome, 0, 0, 0.032));
  return g;
}
