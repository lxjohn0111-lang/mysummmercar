import * as THREE from 'three';
import { mesh, box, cyl, rbox, torus, sphere, lathe, tube, helix, extrude, shapeExtrude, pivot, MAT, texMat, canvasTexture, tex, V2, V3 } from './kit.js';

// Detailed props with working moving parts. Every builder returns a Group with its origin on the
// floor; moving parts sit in named pivot groups (kept out of static batching) listed in userData.parts.

const G = () => new THREE.Group();
const named = (o, n) => { o.name = n; return o; };

// ================================================================ MAILBOX
// Rural tunnel mailbox on a timber post: drop-down front door, side flag that is up when mail waits.
export function mailbox(name = '', num = '') {
  const g = G();
  const paint = MAT.paint(0x3a78c0, 0.42), inner = MAT.galv(), wood = MAT.oldWood();
  const W = 0.26, h0 = 0.15, L = 0.46, t = 0.007, yb = 1.05;
  // post, brace and board
  g.add(mesh(rbox(0.095, 1.1, 0.095, 0.012), wood, 0, 0.5, -0.02));
  g.add(mesh(rbox(0.11, 0.025, 0.11, 0.008), wood, 0, 1.06, -0.02));
  g.add(mesh(rbox(0.05, 0.42, 0.05, 0.008), wood, 0, 0.82, 0.12, 0.62));
  g.add(mesh(rbox(0.32, 0.03, 0.54, 0.008), wood, 0, yb - 0.015, 0.02));
  g.add(mesh(rbox(0.18, 0.06, 0.18, 0.02), MAT.basic(0x5a5048), 0, 0.02, -0.02));
  // tunnel body: hollow arch profile extruded front-to-back
  const outer = (r) => { const s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h0); s.absarc(0, h0, r, 0, Math.PI, false); s.lineTo(-r, 0); return s; };
  const shell = outer(W / 2);
  const hole = new THREE.Path(); hole.moveTo(-W / 2 + t, t); hole.lineTo(W / 2 - t, t); hole.lineTo(W / 2 - t, h0); hole.absarc(0, h0, W / 2 - t, 0, Math.PI, false); hole.lineTo(-W / 2 + t, t);
  shell.holes.push(hole);
  const body = mesh(shapeExtrude(shell, L, 0.003, 24), paint, 0, yb, 0.02);
  g.add(body);
  // galvanised inside floor and back plate
  g.add(mesh(box(W - 2 * t, 0.002, L - 0.01), inner, 0, yb + t + 0.001, 0.02));
  g.add(mesh(shapeExtrude(outer(W / 2), 0.01, 0.002, 24), paint, 0, yb, 0.02 - L / 2 + 0.005));
  // stiffening ribs around the tunnel
  for (const z of [-0.14, 0.0, 0.14]) {
    const rib = new THREE.Shape(); rib.moveTo(-W / 2 - 0.004, 0); rib.lineTo(-W / 2 - 0.004, h0); rib.absarc(0, h0, W / 2 + 0.004, Math.PI, 0, true); rib.lineTo(W / 2 + 0.004, 0);
    rib.lineTo(W / 2, 0); rib.lineTo(W / 2, h0); rib.absarc(0, h0, W / 2, 0, Math.PI, false); rib.lineTo(-W / 2, 0);
    g.add(mesh(shapeExtrude(rib, 0.012, 0, 24), paint, 0, yb, 0.02 + z));
  }
  // front door, hinged at the bottom edge (opens downward)
  const door = pivot(g, 0, yb, 0.02 + L / 2 + 0.004, 'mbDoor');
  const dShape = outer(W / 2 + 0.006);
  door.add(mesh(shapeExtrude(dShape, 0.01, 0.003, 24), paint, 0, -0.003, 0.005));
  door.add(mesh(shapeExtrude(outer(W / 2 - 0.02), 0.004, 0.001, 20), MAT.paint(0x3470b4, 0.5), 0, 0.02, 0.011));
  door.add(mesh(cyl(0.012, 0.012, 0.03, 12), MAT.chrome(), 0, h0 + 0.09, 0.022, Math.PI / 2));
  door.add(mesh(box(0.05, 0.012, 0.012), MAT.chrome(), 0, h0 + 0.09, 0.037));
  if (num) {
    const nt = canvasTexture(128, 64, (c) => { c.fillStyle = '#e8e4d8'; c.fillRect(0, 0, 128, 64); c.fillStyle = '#1a1a1a'; c.font = 'bold 46px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(num, 64, 34); });
    door.add(mesh(new THREE.PlaneGeometry(0.09, 0.045), texMat(nt), 0, 0.09, 0.0115));
  }
  // hinge barrel
  g.add(mesh(cyl(0.006, 0.006, W - 0.02, 10), MAT.galv(), 0, yb + 0.004, 0.02 + L / 2 + 0.004, 0, 0, Math.PI / 2));
  // letters inside (shown when there is mail)
  const letters = named(G(), 'mbLetters'); letters.userData.noBatch = true;
  const env = canvasTexture(128, 80, (c) => { c.fillStyle = '#f2eee2'; c.fillRect(0, 0, 128, 80); c.strokeStyle = '#c8c0a8'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(64, 42); c.lineTo(128, 0); c.stroke(); c.fillStyle = '#b03020'; c.fillRect(100, 8, 20, 24); c.fillStyle = '#333'; for (let i = 0; i < 3; i++) c.fillRect(20, 50 + i * 8, 60 - i * 12, 3); });
  for (let i = 0; i < 2; i++) { const e = mesh(box(0.2, 0.003, 0.13), [MAT.basic(0xf0ecde), MAT.basic(0xf0ecde), texMat(env), MAT.basic(0xe8e2d0), MAT.basic(0xf0ecde), MAT.basic(0xf0ecde)], 0.01 - i * 0.02, yb + t + 0.004 + i * 0.004, 0.1 - i * 0.05, 0, 0.12 - i * 0.3, 0); letters.add(e); }
  g.add(letters);
  // flag on the right side; rotation.x = 0 is down (along the box), -PI/2 is up
  const flag = pivot(g, W / 2 + 0.012, yb + 0.12, -0.12, 'mbFlag');
  flag.add(mesh(box(0.006, 0.012, 0.2), MAT.chrome(), 0.004, 0, 0.1));
  flag.add(mesh(rbox(0.004, 0.06, 0.09, 0.002), MAT.paint(0xd02010, 0.4), 0.006, 0.03, 0.17));
  g.add(mesh(cyl(0.012, 0.012, 0.012, 12), MAT.chrome(), W / 2 + 0.006, yb + 0.12, -0.12, 0, 0, Math.PI / 2));
  // name plate on the left side + reflector on the post
  if (name) {
    const nt = canvasTexture(256, 64, (c) => { c.fillStyle = '#f4f2ea'; c.fillRect(0, 0, 256, 64); c.strokeStyle = '#222'; c.lineWidth = 4; c.strokeRect(4, 4, 248, 56); c.fillStyle = '#111'; c.font = 'bold 34px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, 128, 34); });
    g.add(mesh(box(0.004, 0.05, 0.2), [texMat(nt), MAT.basic(0xeeeeee), MAT.basic(0xeeeeee), MAT.basic(0xeeeeee), MAT.basic(0xeeeeee), MAT.basic(0xeeeeee)], -W / 2 - 0.006, yb + 0.08, 0.04).rotateY(Math.PI));
  }
  g.add(mesh(cyl(0.025, 0.025, 0.006, 16), MAT.emissive(0xff7a10, 0.15), 0, 0.95, 0.03, Math.PI / 2));
  g.userData.parts = { door, flag, letters };
  g.userData.boxY = yb + 0.15;
  return g;
}

// ================================================================ KITCHEN
// Electric range with four cast-iron hotplates (each can glow), knobs, oven door with window, drawer.
export function stove() {
  const g = G();
  const en = MAT.enamel(0xf2eee4), dark = MAT.plastic(0x242424, 0.4);
  g.add(mesh(rbox(0.6, 0.78, 0.58, 0.014), en, 0, 0.43, 0));
  g.add(mesh(box(0.54, 0.05, 0.5), dark, 0, 0.025, -0.02));
  // cooktop
  g.add(mesh(rbox(0.6, 0.018, 0.6, 0.006), MAT.brushed(), 0, 0.828, 0));
  const plates = [];
  const pos = [[-0.14, 0.14, 0.085], [0.14, 0.14, 0.072], [-0.14, -0.14, 0.072], [0.14, -0.14, 0.09]];
  pos.forEach(([x, z, r], i) => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x1e1e20, roughness: 0.7, metalness: 0.7, emissive: 0xff3008, emissiveIntensity: 0, map: tex('cast.jpg') });
    const p = named(mesh(lathe([[0, 0], [r, 0], [r, 0.012], [r - 0.004, 0.016], [0, 0.016]], 32), mat, x, 0.836, z), 'hotplate' + i);
    g.add(p); plates.push(p);
    for (const rr of [r * 0.35, r * 0.62, r * 0.85]) g.add(mesh(torus(rr, 0.0012, 4, 32), MAT.iron(), x, 0.853, z, Math.PI / 2));
    g.add(mesh(torus(r + 0.004, 0.0035, 6, 40), MAT.chrome(), x, 0.84, z, Math.PI / 2));
  });
  // control fascia with knobs and the "on" lamp
  g.add(mesh(rbox(0.58, 0.075, 0.02, 0.006), MAT.brushed(), 0, 0.775, 0.29));
  const fascia = canvasTexture(256, 32, (c) => { c.fillStyle = '#c8ccd0'; c.fillRect(0, 0, 256, 32); c.fillStyle = '#333'; c.font = '10px Arial'; for (let i = 0; i < 5; i++) { c.fillText('0', 18 + i * 50, 28); c.fillText('3', 36 + i * 50, 28); } c.font = 'bold 11px Arial'; c.fillText('UPO', 224, 14); });
  g.add(mesh(new THREE.PlaneGeometry(0.56, 0.065), texMat(fascia, { metalness: 0.6, roughness: 0.4 }), 0, 0.775, 0.3005));
  const knob = lathe([[0, 0], [0.019, 0], [0.019, 0.006], [0.015, 0.009], [0.014, 0.024], [0, 0.026]], 20);
  for (let i = 0; i < 5; i++) {
    const k = mesh(knob, dark, -0.23 + i * 0.1, 0.777, 0.3, Math.PI / 2, 0, 0); g.add(k);
    g.add(mesh(box(0.004, 0.022, 0.004), MAT.basic(0xf0f0f0), -0.23 + i * 0.1, 0.777, 0.327));
  }
  const lamp = named(mesh(sphere(0.007, 10, 8), new THREE.MeshStandardMaterial({ color: 0x401008, emissive: 0xff2010, emissiveIntensity: 0 }), 0.27, 0.79, 0.302), 'stoveLamp');
  g.add(lamp);
  // oven door: frame, window, handle bar
  g.add(mesh(rbox(0.56, 0.55, 0.025, 0.01), en, 0, 0.43, 0.29));
  g.add(mesh(rbox(0.4, 0.26, 0.006, 0.02), MAT.darkGlass(), 0, 0.45, 0.304));
  const hb = tube([[-0.22, 0, 0], [-0.21, 0, 0.035], [0.21, 0, 0.035], [0.22, 0, 0]], 0.009, 30, 10);
  g.add(mesh(hb, MAT.chrome(), 0, 0.67, 0.3));
  // drawer
  g.add(mesh(rbox(0.56, 0.1, 0.02, 0.008), en, 0, 0.1, 0.29));
  g.add(mesh(rbox(0.16, 0.014, 0.01, 0.004), MAT.chrome(), 0, 0.125, 0.303));
  // frying pan on the front-right plate
  const pan = G();
  pan.add(mesh(lathe([[0, 0], [0.11, 0.002], [0.122, 0.04], [0.118, 0.042], [0.105, 0.006], [0, 0.006]], 32), MAT.iron()));
  pan.add(mesh(rbox(0.19, 0.016, 0.03, 0.007), MAT.plastic(0x1a1a1a, 0.45), 0.2, 0.034, 0, 0, 0, 0.12));
  pan.position.set(0.14, 0.852, 0.14); g.add(pan);
  // back guard
  g.add(mesh(rbox(0.6, 0.08, 0.02, 0.006), en, 0, 0.87, -0.29));
  g.userData.parts = { plates, lamp };
  return g;
}

// Two-door fridge with a real interior: shelves, food, door bins and a light. The main door opens.
export function fridge() {
  const g = G();
  const en = MAT.enamel(0xeee8da), liner = MAT.plastic(0xeef0ee, 0.35), W = 0.6, H = 1.6, D = 0.62;
  // cabinet walls (hollow so the inside is visible when the door opens)
  g.add(mesh(box(W, H, 0.02), en, 0, H / 2, -D / 2 + 0.01));
  g.add(mesh(box(0.025, H, D - 0.02), en, -W / 2 + 0.0125, H / 2, 0.01));
  g.add(mesh(box(0.025, H, D - 0.02), en, W / 2 - 0.0125, H / 2, 0.01));
  g.add(mesh(box(W, 0.04, D - 0.02), en, 0, H - 0.02, 0.01));
  g.add(mesh(box(W, 0.08, D - 0.02), en, 0, 0.04, 0.01));
  g.add(mesh(box(W, 0.04, D - 0.02), en, 0, 1.12, 0.01));
  g.add(mesh(box(W - 0.05, 0.08, 0.02), MAT.plastic(0x2a2a2a), 0, 0.04, D / 2 - 0.02));
  // liner, shelves, crisper
  g.add(mesh(box(W - 0.06, 1.02, 0.01), liner, 0, 0.6, -D / 2 + 0.026));
  for (const x of [-1, 1]) g.add(mesh(box(0.005, 1.02, D - 0.06), liner, x * (W / 2 - 0.028), 0.6, 0.0));
  for (const y of [0.38, 0.62, 0.86]) g.add(mesh(box(W - 0.06, 0.006, D - 0.16), MAT.glass(0xcfe4ea, 0.45), 0, y, -0.05));
  g.add(mesh(rbox(W - 0.08, 0.2, D - 0.14, 0.01), MAT.glass(0xd8eef0, 0.35), 0, 0.2, -0.02));
  // food inside
  const food = G();
  const milkT = canvasTexture(64, 128, (c) => { c.fillStyle = '#2a64b0'; c.fillRect(0, 0, 64, 128); c.fillStyle = '#fff'; c.font = 'bold 16px Arial'; c.fillText('MAITO', 6, 70); c.fillRect(0, 90, 64, 6); });
  food.add(mesh(box(0.07, 0.2, 0.07), texMat(milkT), -0.18, 0.49, -0.1));
  for (let i = 0; i < 3; i++) food.add(mesh(lathe([[0, 0], [0.03, 0], [0.031, 0.08], [0.02, 0.1], [0.02, 0.11], [0, 0.11]], 14), MAT.glass(0x6a3a10, 0.8), 0.02 + i * 0.07, 0.385, -0.12));
  food.add(mesh(rbox(0.16, 0.06, 0.1, 0.01), MAT.plastic(0xd8c890, 0.5), 0.12, 0.65, -0.05));
  food.add(mesh(cyl(0.045, 0.045, 0.09, 16), MAT.plastic(0xc83020, 0.4), -0.15, 0.67, -0.08));
  food.add(mesh(rbox(0.2, 0.04, 0.12, 0.01), MAT.plastic(0xe0a080, 0.4), 0.05, 0.885, -0.05));
  food.add(mesh(sphere(0.035, 12, 8), MAT.basic(0x6aa030), -0.12, 0.13, 0.0));
  food.add(mesh(sphere(0.035, 12, 8), MAT.basic(0xc83020), -0.05, 0.13, 0.04));
  g.add(food);
  const fl = named(mesh(box(0.08, 0.02, 0.04), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d8, emissiveIntensity: 0 }), 0, 1.08, -0.15), 'fridgeLight');
  g.add(fl);
  // main door, hinged on the right
  const door = pivot(g, W / 2, 0, D / 2, 'fridgeDoor');
  const dz = 0.03;
  door.add(mesh(rbox(W, 1.04, 0.05, 0.02), en, -W / 2, 0.6, dz));
  door.add(mesh(rbox(W - 0.08, 0.94, 0.02, 0.01), liner, -W / 2, 0.6, 0.0));
  for (const y of [0.3, 0.62, 0.92]) {
    door.add(mesh(box(W - 0.12, 0.006, 0.08), liner, -W / 2, y, -0.045));
    door.add(mesh(box(W - 0.12, 0.05, 0.004), MAT.glass(0xdde8ea, 0.5), -W / 2, y + 0.025, -0.085));
  }
  for (let i = 0; i < 3; i++) door.add(mesh(lathe([[0, 0], [0.028, 0], [0.028, 0.14], [0.012, 0.19], [0.012, 0.21], [0, 0.21]], 14), MAT.glass(i ? 0x2a6a2a : 0xe8e0c8, 0.8), -0.12 - i * 0.12, 0.31, -0.045));
  door.add(mesh(rbox(0.03, 0.34, 0.035, 0.012), MAT.plastic(0xd8d4c8, 0.35), -W + 0.04, 0.86, dz + 0.04));
  const logo = canvasTexture(128, 32, (c) => { c.fillStyle = '#eee8da'; c.fillRect(0, 0, 128, 32); c.fillStyle = '#7a7a7a'; c.font = 'bold italic 22px Arial'; c.fillText('ARKTIS', 20, 24); });
  door.add(mesh(new THREE.PlaneGeometry(0.12, 0.03), texMat(logo), -W / 2 + 0.17, 1.04, dz + 0.0255));
  // freezer door (fixed)
  g.add(mesh(rbox(W, 0.45, 0.05, 0.02), en, 0, 1.37, D / 2 + dz));
  g.add(mesh(rbox(0.03, 0.18, 0.035, 0.012), MAT.plastic(0xd8d4c8, 0.35), -W / 2 + 0.04, 1.22, D / 2 + dz + 0.04));
  g.add(mesh(box(W, 0.01, 0.052), MAT.plastic(0x9a9a92), 0, 1.13, D / 2 + dz));
  // a few magnets and a note
  const note = canvasTexture(64, 80, (c) => { c.fillStyle = '#fff9c0'; c.fillRect(0, 0, 64, 80); c.fillStyle = '#334'; c.font = '9px Arial'; ['Osta:', '- makkaraa', '- olutta', '- ÖLJY!'].forEach((s, i) => c.fillText(s, 5, 16 + i * 14)); });
  door.add(mesh(new THREE.PlaneGeometry(0.08, 0.1), texMat(note), -0.2, 0.78, dz + 0.026, 0, 0, 0.06));
  door.add(mesh(cyl(0.012, 0.012, 0.008, 12), MAT.plastic(0xc02020), -0.2, 0.83, dz + 0.03, Math.PI / 2));
  g.userData.parts = { door, light: fl };
  return g;
}

// Kitchen counter: cabinet doors, laminate top, stainless sink with a lever mixer that runs water.
export function counter(w = 1.8, withSink = true) {
  const g = G();
  const carc = MAT.wood(0xd8c8a4), front = MAT.enamel(0xe8dcc0), top = laminate();
  // carcass stops below the sink bowl; side panels close the ends
  g.add(mesh(box(w, 0.6, 0.56), carc, 0, 0.38, -0.02));
  for (const sx2 of [-1, 1]) g.add(mesh(box(0.018, 0.78, 0.56), carc, sx2 * (w / 2 - 0.009), 0.47, -0.02));
  g.add(mesh(box(w, 0.018, 0.56), carc, 0, 0.62, -0.02));
  g.add(mesh(box(w - 0.02, 0.08, 0.5), MAT.plastic(0x3a3028), 0, 0.04, -0.05));
  const nd = Math.max(1, Math.round(w / 0.6)), dw = w / nd;
  for (let i = 0; i < nd; i++) {
    const x = -w / 2 + dw * (i + 0.5);
    g.add(mesh(rbox(dw - 0.008, 0.56, 0.02, 0.006), front, x, 0.37, 0.27));
    g.add(mesh(rbox(dw - 0.1, 0.44, 0.006, 0.004), MAT.enamel(0xe2d4b4), x, 0.37, 0.281));
    g.add(mesh(rbox(dw - 0.008, 0.13, 0.02, 0.006), front, x, 0.735, 0.27));
    g.add(mesh(rbox(0.1, 0.014, 0.014, 0.005), MAT.brushed(), x, 0.735, 0.287));
    g.add(mesh(cyl(0.008, 0.008, 0.018, 10), MAT.brushed(), x + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), 0.56, 0.287, Math.PI / 2));
  }
  // worktop (with a cut-out when there is a sink)
  const sx = w < 1.2 ? 0 : -w / 4, bw = Math.min(0.42, w - 0.2), bd = 0.34;
  const tshape = new THREE.Shape([V2(-w / 2 - 0.01, -0.31), V2(w / 2 + 0.01, -0.31), V2(w / 2 + 0.01, 0.31), V2(-w / 2 - 0.01, 0.31)]);
  if (withSink) tshape.holes.push(new THREE.Path([V2(sx - bw / 2, -bd / 2 + 0.02), V2(sx - bw / 2, bd / 2 + 0.02), V2(sx + bw / 2, bd / 2 + 0.02), V2(sx + bw / 2, -bd / 2 + 0.02)]));
  const tg = shapeExtrude(tshape, 0.036, 0.003); tg.rotateX(-Math.PI / 2);
  g.add(mesh(tg, top, 0, 0.855, 0));
  g.add(mesh(box(w + 0.02, 0.006, 0.006), MAT.brushed(), 0, 0.857, 0.313));
  // backsplash tiles
  g.add(mesh(box(w, 0.5, 0.012), tiles(w), 0, 1.13, -0.3));
  if (withSink) {
    const st = MAT.brushed(), bz = 0.02 * -1;
    const rim = new THREE.Shape([V2(sx - bw / 2 - 0.03, -bd / 2 - 0.01), V2(sx + bw / 2 + 0.03, -bd / 2 - 0.01), V2(sx + bw / 2 + 0.03, bd / 2 + 0.05), V2(sx - bw / 2 - 0.03, bd / 2 + 0.05)]);
    rim.holes.push(new THREE.Path([V2(sx - bw / 2, -bd / 2 + 0.02), V2(sx - bw / 2, bd / 2 + 0.02), V2(sx + bw / 2, bd / 2 + 0.02), V2(sx + bw / 2, -bd / 2 + 0.02)]));
    const rg = shapeExtrude(rim, 0.006, 0.0015); rg.rotateX(-Math.PI / 2);
    g.add(mesh(rg, st, 0, 0.876, 0));
    // basin (open box, seen from inside)
    const basin = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.17, bd), new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.3, metalness: 0.9, side: THREE.BackSide }));
    basin.position.set(sx, 0.79, bz - 0.0); basin.receiveShadow = true;
    // cut the top face off the basin box
    const bgeo = basin.geometry; const idx = bgeo.index.array; const keep = [];
    for (let f = 0; f < idx.length; f += 3) { const y = bgeo.attributes.position.getY(idx[f]) + bgeo.attributes.position.getY(idx[f + 1]) + bgeo.attributes.position.getY(idx[f + 2]); if (y < 0.25) keep.push(idx[f], idx[f + 1], idx[f + 2]); }
    bgeo.setIndex(keep); g.add(basin);
    g.add(mesh(torus(0.022, 0.004, 6, 20), MAT.chrome(), sx, 0.707, bz, Math.PI / 2));
    g.add(mesh(cyl(0.02, 0.02, 0.002, 16), MAT.plastic(0x222222), sx, 0.706, bz));
    // mixer tap: base, swan-neck spout, lever
    const tx = sx, tz = -0.21;
    g.add(mesh(lathe([[0, 0], [0.03, 0], [0.028, 0.012], [0.02, 0.03], [0.018, 0.11], [0.02, 0.13], [0, 0.135]], 20), MAT.chrome(), tx, 0.875, tz));
    g.add(mesh(tube([[0, 0.09, 0], [0, 0.2, 0.0], [0, 0.24, 0.06], [0, 0.22, 0.16], [0, 0.18, 0.19]], 0.011, 32, 10), MAT.chrome(), tx, 0.875, tz));
    const lever = pivot(g, tx, 0.875 + 0.135, tz, 'tapLever');
    lever.add(mesh(rbox(0.016, 0.012, 0.12, 0.005), MAT.chrome(), 0, 0.01, -0.06, 0.25));
    const water = named(mesh(cyl(0.006, 0.009, 0.35, 10, true), new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }), tx, 0.88, tz + 0.19), 'tapWater');
    water.visible = false; water.castShadow = false; g.add(water);
    // dish rack with a plate and a mug, soap bottle
    const rx = sx + bw / 2 + 0.22;
    if (rx < w / 2 - 0.12) {
      for (let i = 0; i < 6; i++) g.add(mesh(box(0.004, 0.08, 0.24), MAT.chrome(), rx - 0.08 + i * 0.032, 0.915, -0.02));
      g.add(mesh(box(0.2, 0.006, 0.26), MAT.chrome(), rx, 0.876, -0.02));
      g.add(mesh(cyl(0.11, 0.11, 0.012, 28), MAT.ceramic(), rx - 0.02, 0.96, -0.02, 0, 0, Math.PI / 2 - 0.15));
      const mug = mesh(lathe([[0, 0], [0.036, 0], [0.04, 0.09], [0.036, 0.09], [0.033, 0.006], [0, 0.006]], 18), MAT.enamel(0xc84a2a), rx + 0.05, 0.882, 0.06);
      g.add(mug); g.add(mesh(torus(0.022, 0.006, 6, 14, Math.PI), MAT.enamel(0xc84a2a), rx + 0.09, 0.927, 0.06, 0, 0, -Math.PI / 2));
    }
    g.add(mesh(lathe([[0, 0], [0.032, 0], [0.032, 0.15], [0.012, 0.18], [0.012, 0.2], [0, 0.2]], 14), MAT.plastic(0x3aa848, 0.25), sx - bw / 2 - 0.08, 0.876, -0.22));
    g.userData.parts = { lever, water };
  } else g.userData.parts = {};
  // wall cabinets with doors and handles
  g.add(mesh(box(w, 0.6, 0.32), carc, 0, 1.75, -0.13));
  for (let i = 0; i < nd; i++) {
    const x = -w / 2 + dw * (i + 0.5);
    g.add(mesh(rbox(dw - 0.008, 0.58, 0.02, 0.006), front, x, 1.75, 0.04));
    g.add(mesh(rbox(dw - 0.1, 0.46, 0.006, 0.004), MAT.enamel(0xe2d4b4), x, 1.75, 0.051));
    g.add(mesh(cyl(0.008, 0.008, 0.018, 10), MAT.brushed(), x + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), 1.5, 0.057, Math.PI / 2));
  }
  g.add(mesh(box(w * 0.7, 0.015, 0.04), MAT.emissive(0xfff0d0, 0.35), 0, 1.44, 0.0));
  return g;
}
let _lam, _tiles = {};
function laminate() {
  return (_lam ||= new THREE.MeshStandardMaterial({ roughness: 0.35, map: canvasTexture(256, 256, (c) => { c.fillStyle = '#d8d0bc'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 3000; i++) { const v = Math.random(); c.fillStyle = v < 0.5 ? 'rgba(120,110,90,0.25)' : 'rgba(255,255,250,0.35)'; c.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); } }) }));
}
function tiles(w) {
  const k = Math.round(w * 10);
  if (_tiles[k]) return _tiles[k];
  const t = canvasTexture(256, 128, (c) => { c.fillStyle = '#b8b0a0'; c.fillRect(0, 0, 256, 128); for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { c.fillStyle = (x + y) % 5 === 0 ? '#c88a4a' : '#ece6d8'; c.fillRect(x * 32 + 1.5, y * 32 + 1.5, 29, 29); } });
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(w / 0.8, 1);
  return (_tiles[k] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.25 }));
}

// ================================================================ LIVING ROOM / BEDROOM / WC
// CRT television on a cabinet with a VCR; screen shows a live picture when switched on.
export function tv() {
  const g = G();
  const cab = MAT.darkWood(), pl = MAT.plastic(0x2a2a2c, 0.45);
  g.add(mesh(rbox(0.8, 0.42, 0.42, 0.012), cab, 0, 0.21, 0));
  g.add(mesh(box(0.72, 0.012, 0.36), cab, 0, 0.18, 0.02));
  g.add(mesh(box(0.74, 0.3, 0.005), MAT.plastic(0x15100a), 0, 0.2, 0.207));
  const vcr = canvasTexture(256, 48, (c) => { c.fillStyle = '#1a1a1a'; c.fillRect(0, 0, 256, 48); c.fillStyle = '#0c0c0c'; c.fillRect(20, 12, 120, 20); c.fillStyle = '#30ff80'; c.font = 'bold 16px monospace'; c.fillText('12:00', 170, 30); c.fillStyle = '#888'; for (let i = 0; i < 5; i++) c.fillRect(150 + i * 18, 38, 12, 5); });
  g.add(mesh(box(0.5, 0.08, 0.32), [pl, pl, pl, pl, texMat(vcr), pl], 0, 0.235, 0.0));
  // CRT: bezel, curved screen, tapered back
  const by = 0.69;
  g.add(mesh(rbox(0.66, 0.5, 0.1, 0.03), pl, 0, by, 0.13));
  const back = new THREE.CylinderGeometry(0.17, 0.3, 0.34, 4, 1); back.rotateY(Math.PI / 4); back.rotateX(-Math.PI / 2); back.scale(1, 0.82, 1);
  g.add(mesh(back, pl, 0, by + 0.01, -0.07));
  const sg = new THREE.PlaneGeometry(0.47, 0.35, 12, 10); const p = sg.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, 0.018 - (p.getX(i) ** 2 + p.getY(i) ** 2) * 0.12);
  sg.computeVertexNormals();
  const screen = named(mesh(sg, new THREE.MeshStandardMaterial({ color: 0x0b1012, roughness: 0.12, metalness: 0.2, emissive: 0x000000 }), -0.05, by + 0.02, 0.18), 'screen');
  g.add(screen);
  g.add(mesh(rbox(0.5, 0.38, 0.012, 0.02), MAT.plastic(0x141414, 0.6), -0.05, by + 0.02, 0.178));
  // control column: buttons + speaker grille
  const grille = canvasTexture(64, 128, (c) => { c.fillStyle = '#2a2a2c'; c.fillRect(0, 0, 64, 128); c.fillStyle = '#111'; for (let y = 4; y < 80; y += 6) for (let x = 6; x < 60; x += 6) c.beginPath(), c.arc(x, y, 1.8, 0, 7), c.fill(); c.fillStyle = '#ccc'; c.font = 'bold 10px Arial'; c.fillText('SALORA', 10, 100); });
  g.add(mesh(new THREE.PlaneGeometry(0.09, 0.3), texMat(grille), 0.255, by + 0.02, 0.181));
  for (let i = 0; i < 4; i++) g.add(mesh(rbox(0.022, 0.012, 0.01, 0.003), MAT.plastic(0x9a9a9a, 0.4), 0.235 + (i % 2) * 0.035, by - 0.15 + Math.floor(i / 2) * 0.02, 0.183));
  g.add(mesh(sphere(0.004, 8, 6), MAT.emissive(0xff2020, 0.8), 0.28, by - 0.19, 0.182));
  // rabbit ears
  g.add(mesh(new THREE.SphereGeometry(0.05, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), pl, 0, by + 0.25, 0.0));
  for (const s of [-1, 1]) { g.add(mesh(cyl(0.0035, 0.0035, 0.45, 6), MAT.chrome(), s * 0.1, by + 0.46, 0, 0, 0, -s * 0.5)); g.add(mesh(sphere(0.008, 8, 6), MAT.chrome(), s * 0.208, by + 0.66, 0)); }
  g.userData.parts = { screen };
  return g;
}

// Rotary-dial telephone; the handset lifts off the cradle while you are calling.
export function phone() {
  const g = G();
  const red = MAT.enamel(0xa8241c);
  g.add(mesh(rbox(0.2, 0.035, 0.22, 0.012), red, 0, 0.0175, 0));
  const prof = [[-0.11, 0], [0.11, 0], [0.09, 0.075], [0.0, 0.088], [-0.08, 0.052]];
  const body = extrude(prof, 0.18, 0.012); body.rotateY(Math.PI / 2);
  g.add(mesh(body, red, 0, 0.02, 0));
  // dial with finger holes and a chrome stop
  const dial = canvasTexture(128, 128, (c) => {
    c.fillStyle = '#f2efe6'; c.beginPath(); c.arc(64, 64, 62, 0, 7); c.fill();
    c.fillStyle = '#222'; c.font = 'bold 13px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < 10; i++) { const a = -Math.PI * 0.35 + i * 0.5; const x = 64 + Math.cos(a) * 44, y = 64 + Math.sin(a) * 44; c.fillStyle = '#e8e2d6'; c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill(); c.strokeStyle = '#999'; c.stroke(); c.fillStyle = '#222'; c.fillText(String((i + 1) % 10), x, y); }
    c.fillStyle = '#c8c0b0'; c.beginPath(); c.arc(64, 64, 22, 0, 7); c.fill(); c.fillStyle = '#333'; c.font = '9px Arial'; c.fillText('KOTI 2716', 64, 64);
  });
  const dg = mesh(cyl(0.058, 0.058, 0.008, 32), [MAT.plastic(0xd8d0c0), texMat(dial), MAT.plastic(0xd8d0c0)], 0, 0.092, 0.042, 0.41, 0, 0);
  g.add(dg);
  g.add(mesh(box(0.008, 0.006, 0.025), MAT.chrome(), 0.045, 0.1, 0.06, 0.41, 0, 0.4));
  // cradle forks
  for (const s of [-1, 1]) g.add(mesh(rbox(0.03, 0.03, 0.04, 0.008), red, s * 0.075, 0.115, -0.01));
  // handset: curved grip + ear and mouth cups
  const hs = pivot(g, 0, 0.13, -0.01, 'handset');
  hs.add(mesh(tube([[-0.11, 0.0, 0], [-0.06, 0.025, 0], [0.06, 0.025, 0], [0.11, 0.0, 0]], 0.016, 24, 10), red));
  for (const s of [-1, 1]) {
    hs.add(mesh(lathe([[0, 0], [0.03, 0], [0.032, 0.02], [0.02, 0.035], [0, 0.036]], 18), red, s * 0.115, -0.022, 0));
    hs.add(mesh(cyl(0.022, 0.022, 0.002, 16), MAT.plastic(0x2a2a2a), s * 0.115, -0.0225, 0));
  }
  // coiled cord
  g.add(mesh(helix([-0.1, 0.06, -0.09], [-0.13, 0.11, 0.0], 0.008, 16, 0.0025, 200), MAT.plastic(0x8a1a12, 0.5)));
  g.userData.parts = { handset: hs };
  return g;
}

export function toilet() {
  const g = G();
  const c = MAT.ceramic();
  const bowl = lathe([[0.1, 0], [0.12, 0.01], [0.105, 0.05], [0.1, 0.16], [0.15, 0.3], [0.18, 0.38], [0.185, 0.4], [0.165, 0.405], [0.13, 0.33], [0.06, 0.24], [0.0, 0.22]], 32);
  bowl.scale(1, 1, 1.28);
  const bm = new THREE.MeshPhysicalMaterial({ color: 0xf6f5f0, roughness: 0.12, clearcoat: 1, side: THREE.DoubleSide });
  g.add(mesh(bowl, bm, 0, 0, 0.06));
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.085, 24), MAT.glass(0xa8d8e8, 0.55)); water.rotation.x = -Math.PI / 2; water.scale.set(1, 1.3, 1); water.position.set(0, 0.262, 0.07); g.add(water);
  // seat ring and hinged lid
  const ring = torus(0.15, 0.022, 8, 40); ring.scale(1, 1.3, 0.35);
  g.add(mesh(ring, MAT.plastic(0xf4f2ec, 0.3), 0, 0.415, 0.06, Math.PI / 2));
  const lid = pivot(g, 0, 0.42, -0.14, 'toiletLid');
  const lg = cyl(0.17, 0.17, 0.018, 32); lg.scale(1, 1, 1.25);
  lid.add(mesh(lg, MAT.plastic(0xf4f2ec, 0.3), 0, 0.012, 0.2));
  for (const s of [-1, 1]) g.add(mesh(cyl(0.012, 0.012, 0.03, 10), MAT.chrome(), s * 0.08, 0.425, -0.145, 0, 0, Math.PI / 2));
  // cistern with push button
  g.add(mesh(rbox(0.38, 0.36, 0.16, 0.02), c, 0, 0.6, -0.22));
  g.add(mesh(rbox(0.4, 0.03, 0.18, 0.01), c, 0, 0.795, -0.22));
  g.add(mesh(cyl(0.025, 0.025, 0.01, 20), MAT.chrome(), 0, 0.815, -0.21));
  g.add(mesh(box(0.002, 0.012, 0.05), MAT.plastic(0x9a9a9a), 0, 0.82, -0.21));
  g.add(mesh(rbox(0.1, 0.2, 0.08, 0.02), c, 0, 0.32, -0.17));
  // paper holder on the wall beside it
  g.add(mesh(rbox(0.04, 0.04, 0.03, 0.008), MAT.chrome(), 0.32, 0.7, -0.29));
  g.add(mesh(cyl(0.006, 0.006, 0.13, 8), MAT.chrome(), 0.32, 0.68, -0.22, Math.PI / 2));
  g.add(mesh(lathe([[0.022, 0], [0.055, 0], [0.055, 0.1], [0.022, 0.1]], 20), MAT.basic(0xf8f6f0), 0.32, 0.68, -0.27, Math.PI / 2));
  g.userData.parts = { lid };
  return g;
}

export function bed() {
  const g = G();
  const fr = MAT.darkWood();
  for (const x of [-0.5, 0.5]) g.add(mesh(rbox(0.05, 0.16, 2.02, 0.01), fr, x, 0.26, 0));
  for (const [x, z, h] of [[-0.5, -1.0, 1.0], [0.5, -1.0, 1.0], [-0.5, 1.0, 0.6], [0.5, 1.0, 0.6]]) { g.add(mesh(rbox(0.07, h, 0.07, 0.012), fr, x, h / 2, z)); g.add(mesh(sphere(0.042, 12, 8), fr, x, h + 0.02, z)); }
  g.add(mesh(rbox(0.94, 0.06, 0.04, 0.01), fr, 0, 0.92, -1.0));
  g.add(mesh(rbox(0.94, 0.06, 0.04, 0.01), fr, 0, 0.5, -1.0));
  for (let i = 0; i < 6; i++) g.add(mesh(rbox(0.05, 0.36, 0.02, 0.005), fr, -0.36 + i * 0.144, 0.71, -1.0));
  g.add(mesh(rbox(0.94, 0.22, 0.04, 0.01), fr, 0, 0.42, 1.0));
  g.add(mesh(box(0.94, 0.03, 1.96), MAT.wood(0x9a7a50), 0, 0.2, 0));
  // mattress, sheet, duvet with folded edge, pillow
  g.add(mesh(rbox(0.92, 0.17, 1.92, 0.05), MAT.fabric(0xe8e4d8), 0, 0.3, 0));
  const duvT = canvasTexture(256, 256, (c) => { c.fillStyle = '#5f7fa8'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#e8e0cc'; for (let i = 0; i < 8; i++) c.fillRect(0, i * 32 + 12, 256, 6); c.fillStyle = 'rgba(30,50,80,0.5)'; for (let i = 0; i < 8; i++) c.fillRect(i * 32 + 14, 0, 3, 256); });
  const duv = new THREE.MeshStandardMaterial({ map: duvT, roughness: 0.96, normalMap: tex('fabric_n.jpg', { srgb: false }) });
  const dg = new THREE.BoxGeometry(0.98, 0.09, 1.42, 10, 2, 14); const p = dg.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (y > 0) p.setY(i, y + Math.sin(x * 9 + z * 4) * 0.008 + Math.cos(z * 7) * 0.006); if (Math.abs(x) > 0.45) p.setY(i, p.getY(i) - 0.05 * (y > 0 ? 0.5 : 1.3)); }
  dg.computeVertexNormals();
  g.add(mesh(dg, duv, 0, 0.43, 0.26));
  g.add(mesh(rbox(0.98, 0.05, 0.22, 0.022), MAT.fabric(0xf2eee4), 0, 0.47, -0.42));
  const pg = new THREE.SphereGeometry(0.5, 20, 12); pg.scale(0.62, 0.13, 0.36);
  g.add(mesh(pg, MAT.fabric(0xf6f2ea), 0, 0.47, -0.74, 0.12));
  return g;
}

// ================================================================ SAUNA / YARD
export function kiuas() {
  const g = G();
  const body = MAT.paint(0x1c1c1e, 0.6), st = MAT.steel();
  g.add(mesh(rbox(0.46, 0.66, 0.46, 0.015), body, 0, 0.37, 0));
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { g.add(mesh(box(0.012, 0.6, 0.02), body, s * 0.235, 0.37, -0.18 + i * 0.072)); g.add(mesh(box(0.02, 0.6, 0.012), body, -0.18 + i * 0.072, 0.37, -s * 0.235)); }
  for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) g.add(mesh(cyl(0.018, 0.022, 0.05, 10), body, x, 0.025, z));
  // fire door with glass and the glow behind it
  const glow = named(mesh(box(0.2, 0.13, 0.01), new THREE.MeshStandardMaterial({ color: 0x110500, emissive: 0xff5010, emissiveIntensity: 0 }), 0, 0.28, 0.226), 'glow');
  g.add(glow);
  const fr = new THREE.Shape([V2(-0.13, -0.095), V2(0.13, -0.095), V2(0.13, 0.095), V2(-0.13, 0.095)]); fr.holes.push(new THREE.Path([V2(-0.09, -0.055), V2(-0.09, 0.055), V2(0.09, 0.055), V2(0.09, -0.055)]));
  g.add(mesh(shapeExtrude(fr, 0.016, 0.003), body, 0, 0.28, 0.238));
  g.add(mesh(box(0.18, 0.11, 0.003), MAT.glass(0x402010, 0.35), 0, 0.28, 0.248));
  g.add(mesh(cyl(0.008, 0.008, 0.08, 8), st, 0.15, 0.28, 0.255));
  g.add(mesh(cyl(0.016, 0.016, 0.04, 10), MAT.wood(0x6a4020), 0.15, 0.335, 0.255));
  g.add(mesh(rbox(0.3, 0.06, 0.012, 0.004), body, 0, 0.09, 0.236));
  g.add(mesh(box(0.08, 0.01, 0.012), st, 0, 0.09, 0.247));
  // stone basket and a heap of stones
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; g.add(mesh(cyl(0.005, 0.005, 0.3, 5), st, Math.cos(a) * 0.23, 0.82, Math.sin(a) * 0.23)); }
  g.add(mesh(torus(0.23, 0.007, 6, 40), st, 0, 0.96, 0, Math.PI / 2));
  const stoneG = new THREE.DodecahedronGeometry(1, 1); const sp = stoneG.attributes.position;
  for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i); const k = 0.85 + 0.18 * Math.sin(x * 7.3 + y * 11.1 + z * 5.7) + 0.08 * Math.sin(x * 17 - z * 13); sp.setXYZ(i, x * k, y * k * 0.8, z * k); }
  stoneG.computeVertexNormals();
  const N = 70, im = new THREE.InstancedMesh(stoneG, new THREE.MeshStandardMaterial({ color: 0x6a6662, roughness: 0.95, map: tex('rock.jpg'), normalMap: tex('rock_n.jpg', { srgb: false }) }), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < N; i++) {
    const r = Math.sqrt(Math.random()) * 0.2, a = Math.random() * Math.PI * 2, lvl = Math.floor(i / 25);
    const s = 0.035 + Math.random() * 0.03;
    const y = 0.72 + lvl * 0.07 + Math.random() * 0.04 + (0.2 - r) * 0.35 * (lvl === 2 ? 1 : 0.3);
    q.setFromEuler(e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3));
    m4.compose(V3(Math.cos(a) * r, y, Math.sin(a) * r), q, V3(s, s * (0.8 + Math.random() * 0.3), s * (0.9 + Math.random() * 0.3)));
    im.setMatrixAt(i, m4);
  }
  im.castShadow = true; im.receiveShadow = true; g.add(im);
  // flue pipe with collar
  g.add(mesh(cyl(0.065, 0.065, 1.5, 20), MAT.galv(), 0, 1.45, -0.16));
  g.add(mesh(cyl(0.08, 0.08, 0.05, 20), body, 0, 0.72, -0.16));
  g.userData.parts = { glow };
  return g;
}
export function bucket() {
  const g = G();
  const w = MAT.wood(0xb88a58);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const st = mesh(box(0.06, 0.22, 0.014), w, Math.cos(a) * 0.145, 0.11, Math.sin(a) * 0.145, 0, -a + Math.PI / 2, 0); st.rotation.x = 0; g.add(st); }
  g.add(mesh(cyl(0.14, 0.13, 0.015, 24), w, 0, 0.01, 0));
  for (const y of [0.04, 0.18]) g.add(mesh(torus(0.153, 0.006, 6, 32), MAT.brushed(), 0, y, 0, Math.PI / 2));
  g.add(mesh(cyl(0.135, 0.135, 0.004, 24), MAT.glass(0x5a8090, 0.7), 0, 0.17, 0));
  // ladle (kauha)
  g.add(mesh(lathe([[0, 0], [0.045, 0.005], [0.05, 0.04], [0.046, 0.042], [0.04, 0.008], [0, 0.006]], 16), w, 0.06, 0.15, 0.02));
  g.add(mesh(cyl(0.011, 0.013, 0.5, 8), w, 0.17, 0.34, 0.02, 0, 0, -0.55));
  return g;
}
export function choppingBlock() {
  const g = G();
  const end = canvasTexture(128, 128, (c) => { c.fillStyle = '#c09a68'; c.fillRect(0, 0, 128, 128); for (let r = 4; r < 64; r += 4 + Math.random() * 3) { c.strokeStyle = `rgba(110,70,30,${0.25 + Math.random() * 0.3})`; c.lineWidth = 1 + Math.random(); c.beginPath(); c.arc(64 + Math.random() * 2, 64, r, 0, 7); c.stroke(); } c.strokeStyle = 'rgba(70,40,15,0.6)'; c.lineWidth = 2; for (let i = 0; i < 9; i++) { c.beginPath(); const a = Math.random() * 7; c.moveTo(64 + Math.cos(a) * 10, 64 + Math.sin(a) * 10); c.lineTo(64 + Math.cos(a) * 55, 64 + Math.sin(a) * 55); c.stroke(); } });
  const bark = new THREE.MeshStandardMaterial({ map: tex('bark_pine.jpg'), normalMap: tex('bark_pine_n.jpg', { srgb: false }), roughness: 0.95 });
  const sg = new THREE.CylinderGeometry(0.3, 0.34, 0.5, 18, 3); const p = sg.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + Math.sin(a * 5) * 0.03 + Math.sin(a * 11) * 0.015; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  sg.computeVertexNormals();
  g.add(mesh(sg, [bark, texMat(end, { roughness: 0.9 }), texMat(end, { roughness: 0.9 })], 0, 0.25, 0));
  // axe cuts on top + some wood chips around
  for (let i = 0; i < 5; i++) g.add(mesh(box(0.16, 0.004, 0.006), MAT.basic(0x5a3a1a), (Math.random() - 0.5) * 0.25, 0.501, (Math.random() - 0.5) * 0.25, 0, Math.random() * 3, 0));
  for (let i = 0; i < 14; i++) { const a = Math.random() * 7, r = 0.4 + Math.random() * 0.5; g.add(mesh(box(0.05 + Math.random() * 0.05, 0.01, 0.025), MAT.basic(0xd0b080), Math.cos(a) * r, 0.006, Math.sin(a) * r, 0, Math.random() * 3, 0)); }
  // a log waiting on the block (shown by the chopping action)
  const log = named(G(), 'blockLog'); log.userData.noBatch = true;
  log.add(mesh(cyl(0.12, 0.12, 0.42, 14), [new THREE.MeshStandardMaterial({ map: tex('bark_birch.jpg'), roughness: 0.9 }), texMat(end), texMat(end)], 0, 0.71, 0));
  log.visible = false; g.add(log);
  g.userData.parts = { log };
  return g;
}

// ================================================================ GARAGE
export function batteryCharger() {
  const g = G();
  const o = MAT.paint(0xd06012, 0.45), pl = MAT.plastic(0x1a1a1a);
  g.add(mesh(rbox(0.3, 0.2, 0.2, 0.02), o, 0, 0.1, 0));
  for (let i = 0; i < 6; i++) g.add(mesh(box(0.004, 0.012, 0.15), pl, -0.152, 0.05 + i * 0.022, 0));
  g.add(mesh(rbox(0.26, 0.012, 0.03, 0.004), pl, 0, 0.21, 0));
  // ammeter
  const dial = canvasTexture(128, 96, (c) => { c.fillStyle = '#f4f0e0'; c.fillRect(0, 0, 128, 96); c.strokeStyle = '#222'; c.lineWidth = 2; c.beginPath(); c.arc(64, 90, 60, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); for (let i = 0; i <= 6; i++) { const a = Math.PI * (1.15 + i * 0.7 / 6); c.beginPath(); c.moveTo(64 + Math.cos(a) * 52, 90 + Math.sin(a) * 52); c.lineTo(64 + Math.cos(a) * 60, 90 + Math.sin(a) * 60); c.stroke(); } c.fillStyle = '#c02020'; c.font = 'bold 12px Arial'; c.fillText('AMP', 52, 70); });
  g.add(mesh(new THREE.PlaneGeometry(0.11, 0.08), texMat(dial), -0.05, 0.13, 0.1015));
  const needle = named(mesh(box(0.002, 0.05, 0.001), MAT.basic(0xc02020), -0.05, 0.095, 0.103), 'chargerNeedle');
  needle.geometry.translate(0, 0.025, 0); needle.rotation.z = 0.6; g.add(needle);
  g.add(mesh(cyl(0.016, 0.016, 0.02, 16), pl, 0.07, 0.14, 0.11, Math.PI / 2));
  const led = named(mesh(sphere(0.006, 8, 6), new THREE.MeshStandardMaterial({ color: 0x103010, emissive: 0x30ff40, emissiveIntensity: 0 }), 0.07, 0.07, 0.1), 'chargerLed');
  g.add(led);
  g.add(mesh(tube([[-0.1, 0.22, 0], [-0.05, 0.27, 0], [0.05, 0.27, 0], [0.1, 0.22, 0]], 0.008, 16, 8), pl));
  // cables with clamps
  for (const [col, s] of [[0xc02020, 1], [0x1a1a1a, -1]]) {
    const m = MAT.plastic(col, 0.5);
    g.add(mesh(tube([[s * 0.06, 0.05, 0.1], [s * 0.08, 0.0, 0.2], [s * 0.04, -0.06, 0.28], [s * 0.1, -0.1, 0.36]], 0.005, 20, 6), m));
    g.add(mesh(rbox(0.025, 0.02, 0.07, 0.006), m, s * 0.1, -0.1, 0.39));
  }
  g.userData.parts = { needle, led };
  return g;
}
export function jackStand() {
  const g = G();
  const r = MAT.paint(0xc03020, 0.45);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; g.add(mesh(rbox(0.035, 0.3, 0.02, 0.006), r, Math.cos(a) * 0.09, 0.14, Math.sin(a) * 0.09, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35)); g.add(mesh(rbox(0.05, 0.01, 0.05, 0.004), r, Math.cos(a) * 0.15, 0.005, Math.sin(a) * 0.15)); }
  g.add(mesh(cyl(0.035, 0.04, 0.06, 12), r, 0, 0.29, 0));
  g.add(mesh(cyl(0.022, 0.022, 0.2, 12), MAT.steel(), 0, 0.38, 0));
  for (let i = 0; i < 7; i++) g.add(mesh(torus(0.023, 0.002, 4, 16), MAT.steel(), 0, 0.33 + i * 0.02, 0, Math.PI / 2));
  g.add(mesh(extrude([[-0.05, 0], [0.05, 0], [0.05, 0.035], [0.03, 0.035], [0.02, 0.012], [-0.02, 0.012], [-0.03, 0.035], [-0.05, 0.035]], 0.06, 0.003), MAT.steel(), 0, 0.48, 0));
  g.add(mesh(rbox(0.08, 0.02, 0.03, 0.006), r, 0.04, 0.31, 0, 0, 0, 0.3));
  return g;
}
export function engineStand() {
  const g = G();
  const red = MAT.paint(0xb02018, 0.45), st = MAT.steel();
  const sq = (a, b, s = 0.05) => { const A = V3(...a), B = V3(...b), d = B.clone().sub(A), L = d.length(); const o = mesh(rbox(s, s, L, 0.006), red, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); o.lookAt(o.position.clone().add(d)); return o; };
  g.add(sq([0.3, 0.06, -0.45], [0.3, 0.06, 0.5])); g.add(sq([-0.3, 0.06, -0.45], [-0.3, 0.06, 0.5]));
  g.add(sq([-0.33, 0.06, -0.4], [0.33, 0.06, -0.4]));
  g.add(sq([0, 0.06, -0.4], [0, 0.78, -0.4], 0.07));
  g.add(sq([0.3, 0.06, -0.2], [0, 0.5, -0.4], 0.035)); g.add(sq([-0.3, 0.06, -0.2], [0, 0.5, -0.4], 0.035));
  g.add(sq([0, 0.78, -0.42], [0, 0.78, -0.12], 0.06));
  g.add(mesh(cyl(0.13, 0.13, 0.025, 24), red, 0, 0.78, -0.08, Math.PI / 2));
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.78; g.add(mesh(box(0.03, 0.03, 0.2), st, Math.cos(a) * 0.1, 0.78 + Math.sin(a) * 0.1, 0.02)); }
  g.add(mesh(cyl(0.008, 0.008, 0.28, 8), st, 0.0, 0.84, -0.3, 0, 0, Math.PI / 2));
  for (const [x, z] of [[0.3, 0.5], [-0.3, 0.5], [0.3, -0.42], [-0.3, -0.42]]) { g.add(mesh(box(0.05, 0.03, 0.05), st, x, 0.06, z)); g.add(mesh(cyl(0.035, 0.035, 0.025, 14), MAT.rubber(), x, 0.035, z + 0.02, 0, 0, Math.PI / 2)); }
  return g;
}
export function engineHoist() {
  const g = G();
  const y = MAT.paint(0xd8a010, 0.45), st = MAT.steel();
  const sq = (a, b, s = 0.07, mat = y, name) => { const A = V3(...a), B = V3(...b), d = B.clone().sub(A), L = d.length(); const o = mesh(rbox(s, s, L, 0.008), mat, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); o.lookAt(o.position.clone().add(d)); if (name) o.name = name; return o; };
  g.add(sq([0.35, 0.06, -0.5], [0.35, 0.06, 0.9])); g.add(sq([-0.35, 0.06, -0.5], [-0.35, 0.06, 0.9]));
  g.add(sq([-0.38, 0.06, -0.5], [0.38, 0.06, -0.5], 0.08));
  g.add(sq([0, 0.06, -0.5], [0, 1.7, -0.5], 0.09));
  g.add(sq([0.35, 0.06, -0.1], [0, 0.6, -0.5], 0.04)); g.add(sq([-0.35, 0.06, -0.1], [0, 0.6, -0.5], 0.04));
  const boom = sq([0, 1.62, -0.6], [0, 1.85, 0.85], 0.08, y, 'boom'); g.add(boom);
  // hydraulic ram with pump handle
  g.add(sq([0, 0.55, -0.45], [0, 1.45, 0.1], 0.06, MAT.paint(0x222222, 0.5)));
  g.add(mesh(cyl(0.022, 0.022, 0.5, 12), MAT.chrome(), 0, 1.3, 0.0, -0.55 + Math.PI / 2 - Math.PI / 2));
  g.add(sq([0.06, 0.65, -0.45], [0.3, 1.1, -0.75], 0.025, st));
  // chain and hook
  const chain = named(G(), 'chain'); chain.userData.noBatch = true;
  for (let i = 0; i < 8; i++) chain.add(mesh(torus(0.018, 0.005, 6, 12), st, 0, -i * 0.03, 0, 0, i % 2 ? Math.PI / 2 : 0, 0));
  chain.add(mesh(torus(0.04, 0.009, 8, 20, Math.PI * 1.5), st, 0.0, -0.28, 0, 0, 0, Math.PI));
  chain.position.set(0, 1.8, 0.82); g.add(chain);
  for (const [x, z] of [[0.35, 0.9], [-0.35, 0.9], [0.35, -0.5], [-0.35, -0.5]]) g.add(mesh(cyl(0.045, 0.045, 0.03, 16), MAT.rubber(), x, 0.04, z, 0, 0, Math.PI / 2));
  return g;
}
export function workbench() {
  const g = G();
  const top = new THREE.MeshStandardMaterial({ color: 0xb08858, roughness: 0.7, map: tex('planks_raw.jpg') });
  const frame = MAT.paint(0x2a4a7a, 0.5), st = MAT.steel();
  g.add(mesh(rbox(2.2, 0.06, 0.8, 0.01), top, 0, 0.9, 0));
  for (const [x, z] of [[1.05, 0.35], [-1.05, 0.35], [1.05, -0.35], [-1.05, -0.35]]) g.add(mesh(rbox(0.06, 0.88, 0.06, 0.008), frame, x, 0.44, z));
  g.add(mesh(box(2.1, 0.025, 0.7), MAT.wood(0x8a6a44), 0, 0.22, 0));
  // drawer block
  g.add(mesh(rbox(0.5, 0.45, 0.7, 0.008), frame, -0.75, 0.62, 0));
  for (let i = 0; i < 3; i++) { g.add(mesh(rbox(0.46, 0.13, 0.02, 0.005), frame, -0.75, 0.48 + i * 0.145, 0.355)); g.add(mesh(rbox(0.16, 0.02, 0.02, 0.006), st, -0.75, 0.52 + i * 0.145, 0.37)); }
  // bench vise
  const blue = MAT.paint(0x1e4a8a, 0.4);
  g.add(mesh(rbox(0.16, 0.06, 0.2, 0.01), blue, 0.85, 0.96, 0.28));
  g.add(mesh(rbox(0.16, 0.09, 0.05, 0.008), blue, 0.85, 1.0, 0.24));
  g.add(mesh(rbox(0.16, 0.09, 0.05, 0.008), blue, 0.85, 1.0, 0.38));
  g.add(mesh(cyl(0.012, 0.012, 0.3, 10), st, 0.85, 0.98, 0.46, Math.PI / 2));
  g.add(mesh(cyl(0.007, 0.007, 0.2, 8), st, 0.85, 0.98, 0.6, 0, 0, Math.PI / 2));
  // pegboard with real tools
  const pb = canvasTexture(256, 128, (c) => { c.fillStyle = '#b89a6a'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#6a5030'; for (let y = 5; y < 128; y += 9) for (let x = 5; x < 256; x += 9) c.fillRect(x, y, 2, 2); });
  g.add(mesh(box(2.2, 1.0, 0.02), texMat(pb, { roughness: 0.85 }), 0, 1.55, -0.38));
  const wr = (len, x, y) => { const w = G(); w.add(mesh(rbox(0.018, len, 0.006, 0.003), MAT.chrome(), 0, 0, 0)); w.add(mesh(torus(0.016, 0.005, 6, 14), MAT.chrome(), 0, len / 2 + 0.012, 0)); w.add(mesh(extrude([[-0.018, 0], [0.018, 0], [0.012, 0.03], [0.004, 0.012], [-0.004, 0.012], [-0.012, 0.03]], 0.006), MAT.chrome(), 0, -len / 2 - 0.004, 0, 0, 0, Math.PI)); w.position.set(x, y, -0.36); return w; };
  for (let i = 0; i < 8; i++) g.add(wr(0.14 + i * 0.018, -0.95 + i * 0.07, 1.55));
  for (let i = 0; i < 5; i++) { const s = G(); s.add(mesh(cyl(0.012, 0.014, 0.1, 10), MAT.plastic([0xc02020, 0xe8b818, 0x2050a0, 0xc02020, 0x20802a][i], 0.4), 0, 0.05, 0)); s.add(mesh(cyl(0.003, 0.003, 0.12, 6), MAT.chrome(), 0, -0.06, 0)); s.position.set(-0.2 + i * 0.06, 1.62, -0.35); g.add(s); }
  const ham = G(); ham.add(mesh(rbox(0.03, 0.28, 0.02, 0.008), MAT.wood(0xb07040), 0, 0, 0)); ham.add(mesh(rbox(0.11, 0.03, 0.03, 0.008), MAT.iron(), 0, 0.15, 0)); ham.position.set(0.3, 1.55, -0.35); g.add(ham);
  // toolbox and oil can on the bench
  const tb = G(); tb.add(mesh(rbox(0.42, 0.18, 0.2, 0.01), MAT.paint(0xc02018, 0.4), 0, 0.09, 0)); tb.add(mesh(tube([[-0.12, 0.18, 0], [-0.1, 0.24, 0], [0.1, 0.24, 0], [0.12, 0.18, 0]], 0.008, 12, 6), MAT.plastic(0x111111))); tb.add(mesh(box(0.42, 0.004, 0.2), MAT.paint(0x8a1010, 0.4), 0, 0.12, 0)); tb.position.set(-0.45, 0.93, -0.12); tb.rotation.y = 0.12; g.add(tb);
  g.add(mesh(lathe([[0, 0], [0.04, 0], [0.04, 0.08], [0.025, 0.1], [0.006, 0.16], [0, 0.16]], 16), MAT.paint(0xc8a020, 0.4), 0.45, 0.93, 0.1));
  // fluorescent lamp strip above
  g.add(mesh(box(1.2, 0.03, 0.06), MAT.emissive(0xf0f4ff, 0.6), 0, 2.08, -0.34));
  return g;
}
// Workbench radio: cabinet, speaker grille, tuning dial that lights up when on
export function radio() {
  const g = G();
  const cab = MAT.darkWood();
  g.add(mesh(rbox(0.34, 0.19, 0.13, 0.02), cab, 0, 0.095, 0));
  const gr = canvasTexture(128, 64, (c) => { c.fillStyle = '#c8b890'; c.fillRect(0, 0, 128, 64); c.strokeStyle = 'rgba(60,40,20,0.6)'; for (let x = 2; x < 128; x += 4) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 64); c.stroke(); } });
  g.add(mesh(new THREE.PlaneGeometry(0.15, 0.13), texMat(gr, { roughness: 0.9 }), -0.08, 0.1, 0.0655));
  const dialT = canvasTexture(128, 48, (c) => { c.fillStyle = '#f0e2b8'; c.fillRect(0, 0, 128, 48); c.fillStyle = '#333'; c.font = '9px Arial'; ['88', '92', '96', '100', '104', '108'].forEach((s, i) => c.fillText(s, 4 + i * 21, 14)); c.fillRect(0, 20, 128, 1); c.fillStyle = '#c02020'; c.fillRect(50, 18, 2, 20); c.fillStyle = '#333'; c.fillText('FM  UKW', 44, 44); });
  const dial = named(mesh(new THREE.PlaneGeometry(0.13, 0.05), new THREE.MeshStandardMaterial({ map: dialT, emissive: 0xffc070, emissiveMap: dialT, emissiveIntensity: 0 }), 0.085, 0.135, 0.0655), 'radioDial');
  g.add(dial);
  for (const x of [0.05, 0.12]) g.add(mesh(lathe([[0, 0], [0.018, 0], [0.018, 0.012], [0.014, 0.02], [0, 0.02]], 16), MAT.plastic(0x2a2018, 0.4), x, 0.06, 0.065, Math.PI / 2));
  g.add(mesh(cyl(0.003, 0.003, 0.5, 6), MAT.chrome(), 0.14, 0.42, -0.04, 0, 0, -0.3));
  g.add(mesh(tube([[-0.1, 0.19, 0], [-0.08, 0.23, 0], [0.08, 0.23, 0], [0.1, 0.19, 0]], 0.007, 12, 6), MAT.plastic(0x1a1a1a)));
  g.userData.parts = { dial };
  return g;
}

// ================================================================ VILLAGE
export function gasPump() {
  const g = G();
  const body = MAT.enamel(0xe8e2d4), green = MAT.paint(0x1a6a3a, 0.4), pl = MAT.plastic(0x1a1a1a);
  g.add(mesh(rbox(0.95, 0.22, 0.65, 0.03), MAT.basic(0x9a968c), 0, 0.11, 0));
  g.add(mesh(rbox(0.72, 1.55, 0.45, 0.03), body, 0, 0.99, 0));
  g.add(mesh(rbox(0.74, 0.22, 0.47, 0.02), green, 0, 1.62, 0));
  g.add(mesh(rbox(0.74, 0.06, 0.47, 0.01), green, 0, 0.3, 0));
  const face = canvasTexture(256, 256, (c) => { c.fillStyle = '#20231f'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#9a9a90'; c.font = 'bold 18px Arial'; c.fillText('MK', 18, 40); c.fillText('LITRAA', 18, 120); c.fillText('MK/L', 18, 200); c.fillStyle = '#ff9a30'; c.font = 'bold 40px monospace'; c.fillText('000.00', 60, 50); c.fillText('00.00', 84, 130); c.fillText('5.20', 108, 210); });
  g.add(mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshStandardMaterial({ map: face, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: 0.35 }), 0, 1.22, 0.2295));
  g.add(mesh(rbox(0.46, 0.46, 0.01, 0.01), MAT.brushed(), 0, 1.22, 0.222));
  const brand = canvasTexture(256, 64, (c) => { c.fillStyle = '#1a6a3a'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#fff'; c.font = 'bold 34px Arial'; c.textAlign = 'center'; c.fillText('95 E  ·  DIESEL', 128, 44); });
  g.add(mesh(new THREE.PlaneGeometry(0.66, 0.16), texMat(brand), 0, 1.62, 0.2365));
  // nozzle holster, nozzle and hose
  g.add(mesh(rbox(0.08, 0.16, 0.08, 0.01), pl, 0.29, 0.92, 0.25));
  const nz = G(); nz.add(mesh(rbox(0.035, 0.12, 0.05, 0.01), MAT.plastic(0x1a7a3a, 0.4), 0, 0, 0)); nz.add(mesh(cyl(0.01, 0.012, 0.16, 10), MAT.steel(), 0, -0.05, 0.08, 1.2)); nz.position.set(0.29, 0.98, 0.29); g.add(nz);
  g.add(mesh(tube([[0.29, 0.92, 0.26], [0.42, 0.75, 0.33], [0.45, 0.45, 0.32], [0.4, 0.4, 0.2], [0.36, 1.0, 0.05]], 0.016, 40, 8), pl));
  g.add(mesh(box(0.2, 0.12, 0.01), MAT.basic(0xf2d040), -0.22, 0.72, 0.2265));
  return g;
}
export function register() {
  const g = G();
  const pl = MAT.plastic(0xd0c8b8, 0.45);
  g.add(mesh(rbox(0.4, 0.12, 0.38, 0.015), pl, 0, 0.06, 0));
  g.add(mesh(extrude([[-0.19, 0], [0.19, 0], [0.19, 0.03], [-0.19, 0.09]], 0.3, 0.008).rotateY(Math.PI / 2), pl, 0, 0.12, 0.0));
  const keys = canvasTexture(128, 96, (c) => { c.fillStyle = '#3a3a3a'; c.fillRect(0, 0, 128, 96); for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) { c.fillStyle = x > 3 ? '#c84a2a' : '#e8e4d8'; c.fillRect(6 + x * 20, 6 + y * 22, 16, 16); } });
  g.add(mesh(new THREE.PlaneGeometry(0.26, 0.2), texMat(keys), 0, 0.17, 0.05, -Math.PI / 2 + 0.2));
  const disp = canvasTexture(128, 32, (c) => { c.fillStyle = '#0a1a0a'; c.fillRect(0, 0, 128, 32); c.fillStyle = '#40ff60'; c.font = 'bold 20px monospace'; c.fillText('  12.50', 10, 24); });
  g.add(mesh(rbox(0.16, 0.06, 0.04, 0.01), MAT.plastic(0x222222), 0, 0.27, -0.12));
  g.add(mesh(new THREE.PlaneGeometry(0.13, 0.035), new THREE.MeshStandardMaterial({ map: disp, emissive: 0xffffff, emissiveMap: disp, emissiveIntensity: 0.5 }), 0, 0.27, -0.0995));
  g.add(mesh(cyl(0.012, 0.012, 0.1, 8), MAT.plastic(0x222222), 0, 0.2, -0.12));
  return g;
}

// ================================================================ STORAGE & SHOP
// Slotted-angle steel shelving with perforated uprights and chipboard decks
export function metalShelf(w = 1.8, h = 2.0, d = 0.5) {
  const g = G();
  const up = MAT.paint(0x2a4a8a, 0.45), deck = MAT.wood(0xc8a878);
  const holes = canvasTexture(32, 256, (c) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, 32, 256); c.fillStyle = '#1a1a1a'; for (let y = 6; y < 256; y += 14) c.fillRect(12, y, 8, 6); });
  holes.wrapT = THREE.RepeatWrapping; holes.repeat.set(1, h * 3);
  const upM = new THREE.MeshStandardMaterial({ color: 0x2a4a8a, roughness: 0.45, metalness: 0.4, map: holes });
  for (const [x, z] of [[w / 2, d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]]) {
    g.add(mesh(box(0.04, h, 0.004), upM, x, h / 2, z + (z > 0 ? -0.018 : 0.018)));
    g.add(mesh(box(0.004, h, 0.04), upM, x + (x > 0 ? -0.018 : 0.018), h / 2, z));
    g.add(mesh(box(0.05, 0.01, 0.05), MAT.plastic(0x1a1a1a), x, 0.005, z));
  }
  for (let i = 0; i < 4; i++) {
    const y = 0.1 + i * 0.6;
    g.add(mesh(box(w, 0.018, d - 0.02), deck, 0, y, 0));
    for (const z of [-d / 2 + 0.01, d / 2 - 0.01]) g.add(mesh(box(w, 0.035, 0.006), up, 0, y - 0.01, z));
  }
  // diagonal braces at the back
  for (const s of [-1, 1]) { const b = mesh(box(0.025, Math.hypot(w, 0.6), 0.003), up, 0, 0.4, -d / 2 - 0.004); b.rotation.z = s * Math.atan2(w, 0.6); g.add(b); }
  return g;
}
export function oilDrum(color = 0x2a5a8a) {
  const g = G();
  const p = MAT.paint(color, 0.5);
  const prof = [[0, 0], [0.285, 0], [0.29, 0.012], [0.285, 0.02], [0.288, 0.29], [0.296, 0.3], [0.288, 0.31], [0.288, 0.58], [0.296, 0.59], [0.288, 0.6], [0.285, 0.86], [0.29, 0.868], [0.285, 0.88], [0.27, 0.875], [0, 0.875]];
  g.add(mesh(lathe(prof, 32), p));
  g.add(mesh(cyl(0.03, 0.03, 0.012, 14), MAT.steel(), 0.17, 0.881, 0.05));
  g.add(mesh(cyl(0.018, 0.018, 0.012, 12), MAT.steel(), -0.18, 0.881, -0.04));
  const l = canvasTexture(128, 128, (c) => { c.fillStyle = '#f0ead8'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#111'; c.font = 'bold 20px Arial'; c.textAlign = 'center'; c.fillText('MOOTTORI-', 64, 44); c.fillText('ÖLJY', 64, 70); c.font = '14px Arial'; c.fillText('200 L', 64, 100); });
  g.add(mesh(new THREE.CylinderGeometry(0.2915, 0.2915, 0.22, 20, 1, true, -0.5, 1.0), new THREE.MeshStandardMaterial({ map: l, roughness: 0.6 }), 0, 0.45, 0));
  return g;
}
function tyre(r = 0.28, wdt = 0.17) {
  const g = G();
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.88, normalMap: tex('tread_n.jpg', { srgb: false, repeat: [8, 1] }), map: tex('tread.jpg', { repeat: [8, 1] }) });
  const hw = wdt / 2;
  const prof = [[r * 0.62, -hw * 0.85], [r * 0.8, -hw], [r * 0.94, -hw * 0.95], [r, -hw * 0.7], [r, hw * 0.7], [r * 0.94, hw * 0.95], [r * 0.8, hw], [r * 0.62, hw * 0.85]];
  g.add(mesh(lathe(prof.map(([a, b]) => [a, b]), 40), rubber));
  g.add(mesh(cyl(r * 0.63, r * 0.63, wdt * 0.8, 28, true), MAT.paint(0x8a8a88, 0.4)));
  return g;
}
export function tireStack(n = 4) {
  const g = G();
  for (let i = 0; i < n; i++) { const t = tyre(); t.position.set((Math.random() - 0.5) * 0.05, 0.09 + i * 0.175, (Math.random() - 0.5) * 0.05); t.rotation.y = Math.random() * 3; g.add(t); }
  return g;
}
// supermarket shelf with real-looking packaging (canvas-printed fronts)
let _prod;
function productMats() {
  if (_prod) return _prod;
  const defs = [
    ['#c81e24', '#fff', 'MAKARONI'], ['#2a64b0', '#fff', 'MAITO'], ['#e8c020', '#5a1a08', 'SIPSI'], ['#20802a', '#fff', 'HERNEET'],
    ['#f4f0e4', '#c02020', 'KAHVI'], ['#7a3a12', '#ffe0a0', 'RUIS'], ['#e06a18', '#fff', 'MEHU'], ['#111111', '#fff', 'SALMIAKKI'],
    ['#f2d040', '#2a2a2a', 'MUROT'], ['#8a1a4a', '#fff', 'MARJA'], ['#e8e8e0', '#2a4a8a', 'JAUHO'], ['#2a2a2a', '#f2c040', 'PULLA'],
  ];
  _prod = defs.map(([bg, fg, t]) => {
    const tx = canvasTexture(128, 192, (c) => { c.fillStyle = bg; c.fillRect(0, 0, 128, 192); c.fillStyle = 'rgba(255,255,255,0.15)'; c.beginPath(); c.arc(64, 120, 40, 0, 7); c.fill(); c.fillStyle = fg; c.font = 'bold 22px Arial'; c.textAlign = 'center'; c.fillText(t, 64, 60); c.font = '13px Arial'; c.fillText('KURKI', 64, 172); c.fillRect(20, 76, 88, 3); });
    return new THREE.MeshStandardMaterial({ map: tx, roughness: 0.55 });
  });
  return _prod;
}
export function shopShelf(w = 2.4) {
  const g = G();
  const white = MAT.enamel(0xe6e6e0), pm = productMats();
  g.add(mesh(box(w, 1.9, 0.03), white, 0, 0.95, -0.22));
  for (const x of [-w / 2, w / 2]) g.add(mesh(rbox(0.04, 1.95, 0.46, 0.01), white, x, 0.975, 0));
  for (let i = 0; i < 5; i++) {
    const y = 0.1 + i * 0.4;
    g.add(mesh(box(w, 0.025, 0.45), white, 0, y, 0));
    g.add(mesh(box(w, 0.04, 0.008), MAT.plastic(0xf4e070, 0.5), 0, y - 0.01, 0.228));
  }
  // products: grouped by type so each material renders as one instanced batch
  const boxGeo = new THREE.BoxGeometry(0.09, 0.16, 0.06), jarGeo = lathe([[0, 0], [0.035, 0], [0.036, 0.1], [0.03, 0.11], [0.03, 0.125], [0, 0.125]], 12);
  jarGeo.translate(0, -0.0625, 0);
  const slots = [];
  for (let lv = 1; lv < 5; lv++) for (let x = -w / 2 + 0.08; x < w / 2 - 0.06; x += 0.105) slots.push([x, lv]);
  const per = new Map();
  slots.forEach(([x, lv], i) => { const k = (Math.floor((x + w) * 2.2) + lv * 5) % pm.length; if (!per.has(k)) per.set(k, []); per.get(k).push([x, lv]); });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (const [k, list] of per) {
    const jar = k % 4 === 3;
    const geo = jar ? jarGeo : boxGeo, h = jar ? 0.125 : 0.16;
    const im = new THREE.InstancedMesh(geo, jar ? MAT.glass(0x9a3a4a, 0.85) : pm[k], list.length * 2);
    let n = 0;
    for (const [x, lv] of list) for (const z of [0.12, 0.03]) { m4.compose(V3(x, 0.1 + (lv - 1) * 0.4 + 0.0125 + h / 2, z), q.setFromAxisAngle(V3(0, 1, 0), (Math.random() - 0.5) * 0.12), V3(1, 1, 1)); im.setMatrixAt(n++, m4); }
    im.castShadow = false; im.receiveShadow = true; g.add(im);
  }
  return g;
}
export function beerFridge() {
  const g = G();
  const body = MAT.paint(0xc02018, 0.35);
  g.add(mesh(box(0.9, 2.0, 0.04), body, 0, 1.0, -0.33));
  for (const x of [-0.43, 0.43]) g.add(mesh(box(0.04, 2.0, 0.7), body, x, 1.0, 0));
  g.add(mesh(box(0.9, 0.12, 0.7), body, 0, 0.06, 0));
  g.add(mesh(box(0.82, 1.6, 0.01), MAT.plastic(0xf0f0f0, 0.4), 0, 1.0, -0.31));
  for (let lv = 0; lv < 5; lv++) g.add(mesh(box(0.82, 0.01, 0.6), MAT.steel(), 0, 0.2 + lv * 0.36, 0));
  // drinks as instanced bottles and cans
  const bot = lathe([[0, 0], [0.03, 0], [0.031, 0.14], [0.02, 0.18], [0.013, 0.2], [0.013, 0.24], [0, 0.24]], 12);
  const can = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 14);
  can.translate(0, 0.06, 0);
  const groups = [[bot, MAT.glass(0x5a2e08, 0.9)], [can, new THREE.MeshStandardMaterial({ color: 0xd8b830, metalness: 0.7, roughness: 0.3 })], [can, new THREE.MeshStandardMaterial({ color: 0xd02a40, metalness: 0.6, roughness: 0.3 })], [bot, MAT.glass(0x2a6a2a, 0.9)]];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  groups.forEach(([geo, mat], gi) => {
    const lvls = [gi, gi + (gi < 1 ? 4 : 0)].filter((v, i, a) => a.indexOf(v) === i && v < 5);
    const im = new THREE.InstancedMesh(geo, mat, lvls.length * 20); let n = 0;
    for (const lv of lvls) for (let r = 0; r < 2; r++) for (let i = 0; i < 10; i++) { m4.compose(V3(-0.36 + i * 0.08, 0.205 + lv * 0.36, -0.15 + r * 0.12), q, V3(1, 1, 1)); im.setMatrixAt(n++, m4); }
    im.castShadow = false; g.add(im);
  });
  // glass door with handle and lit header
  g.add(mesh(box(0.86, 1.72, 0.012), MAT.glass(0xbfd8e0, 0.22), 0, 1.0, 0.35));
  g.add(mesh(rbox(0.04, 0.5, 0.04, 0.012), MAT.chrome(), 0.36, 1.05, 0.39));
  const hdr = canvasTexture(256, 64, (c) => { c.fillStyle = '#c02018'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#fff'; c.font = 'bold 40px Arial'; c.textAlign = 'center'; c.fillText('KYLMÄÄ', 128, 46); });
  g.add(mesh(box(0.9, 0.24, 0.7), [body, body, body, body, new THREE.MeshStandardMaterial({ map: hdr, emissive: 0xffffff, emissiveMap: hdr, emissiveIntensity: 0.5 }), body], 0, 1.98, 0));
  g.add(mesh(box(0.8, 0.02, 0.05), MAT.emissive(0xf0f8ff, 1.2), 0, 1.84, 0.25));
  return g;
}
export function slotMachine() {
  const g = G();
  const body = MAT.paint(0x1a2a6a, 0.35), chrome = MAT.chrome();
  g.add(mesh(rbox(0.6, 0.85, 0.5, 0.03), body, 0, 0.425, 0));
  g.add(mesh(rbox(0.58, 0.75, 0.32, 0.03), body, 0, 1.2, -0.08));
  g.add(mesh(rbox(0.6, 0.16, 0.42, 0.04), MAT.paint(0xc02018, 0.3), 0, 1.62, -0.04));
  const top = canvasTexture(256, 64, (c) => { const gr = c.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, '#f2c030'); gr.addColorStop(1, '#ff7020'); c.fillStyle = gr; c.fillRect(0, 0, 256, 64); c.fillStyle = '#fff'; c.font = 'bold 36px Arial'; c.textAlign = 'center'; c.fillText('ONNI-PELI', 128, 46); });
  g.add(mesh(new THREE.PlaneGeometry(0.52, 0.13), new THREE.MeshStandardMaterial({ map: top, emissive: 0xffffff, emissiveMap: top, emissiveIntensity: 0.8 }), 0, 1.62, 0.171));
  // reel window with three reels
  const reelT = canvasTexture(64, 256, (c) => { c.fillStyle = '#fafaf4'; c.fillRect(0, 0, 64, 256); const sy = ['7', '★', '🍒', 'BAR', '🍋', '7']; c.textAlign = 'center'; sy.forEach((s, i) => { c.fillStyle = ['#c02020', '#20a020', '#c02020', '#2040c0', '#d0a010', '#c02020'][i]; c.font = 'bold 30px Arial'; c.fillText(s, 32, 32 + i * 42); }); });
  reelT.wrapT = THREE.RepeatWrapping;
  g.add(mesh(box(0.44, 0.2, 0.02), MAT.plastic(0x0a0a0a), 0, 1.3, 0.085));
  for (let i = 0; i < 3; i++) g.add(mesh(cyl(0.12, 0.12, 0.12, 24), [new THREE.MeshStandardMaterial({ map: reelT, roughness: 0.4 }), MAT.plastic(0x333333), MAT.plastic(0x333333)], -0.14 + i * 0.14, 1.3, -0.04, 0, 0, Math.PI / 2));
  g.add(mesh(box(0.44, 0.2, 0.006), MAT.glass(0xffffff, 0.15), 0, 1.3, 0.1));
  const face = canvasTexture(256, 128, (c) => { c.fillStyle = '#10204a'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#ffd040'; c.font = 'bold 22px Arial'; c.textAlign = 'center'; c.fillText('5 MK / PELI', 128, 40); c.fillText('VOITTO x50', 128, 80); c.fillStyle = '#ff5030'; for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(12 + i * 21, 112, 5, 0, 7); c.fill(); } });
  g.add(mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshStandardMaterial({ map: face, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: 0.5 }), 0, 1.0, 0.081));
  // coin slot, buttons, tray
  g.add(mesh(rbox(0.06, 0.08, 0.02, 0.006), chrome, 0.2, 0.75, 0.255));
  for (let i = 0; i < 3; i++) g.add(mesh(cyl(0.025, 0.025, 0.02, 16), MAT.emissive([0xff3020, 0xffd020, 0x30ff40][i], 0.8), -0.15 + i * 0.1, 0.8, 0.255, Math.PI / 2));
  g.add(mesh(rbox(0.3, 0.06, 0.1, 0.01), chrome, 0, 0.2, 0.25));
  // pull lever
  g.add(mesh(cyl(0.03, 0.03, 0.06, 14), chrome, 0.33, 1.15, 0, 0, 0, Math.PI / 2));
  g.add(mesh(cyl(0.012, 0.012, 0.4, 10), chrome, 0.36, 1.33, 0));
  g.add(mesh(sphere(0.045, 16, 12), MAT.paint(0xd02010, 0.2), 0.36, 1.55, 0));
  return g;
}
