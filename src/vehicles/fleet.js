import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { partMats, PartBuilders } from './parts.js';
import { roundBox, canvasTexture } from '../core/util.js';
import { mats } from '../world/mats.js';
import { tex } from '../core/assets.js';
import { buildBody, SPECS, paintMaterial, bodyMats } from './bodygen.js';
import * as D from './details.js';
import { contactShadow } from './buildcar.js';
import { mergeLocal } from '../core/batch.js';

const mesh = (g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; return o; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function paint(color) { return new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.2 }); }
const glassMat = () => new THREE.MeshPhysicalMaterial({ color: 0x8aa0a8, roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });

function simpleWheel(r, w, rimColor = 0x2a2a2c, hub = true) {
  return D.wheel(rimColor === 0xc8401a ? 'trafficSteel' : 'trafficSteel', r, w);
}

function attachWheels(v, builder) {
  v.cfg.wheels.forEach((w, i) => {
    const wm = builder(w, i);
    if (w.pos[0] < 0) wm.rotation.y = Math.PI;
    const holder = new THREE.Group(); holder.add(wm); holder.userData.spin = wm.userData.spin;
    v.root.add(holder); v.wheelVis.push(holder);
  });
}

// headlight emissive helper
function lamp(color, x, y, z, r = 0.08) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 0, roughness: 0.1 });
  const o = mesh(new THREE.CircleGeometry(r, 16), m, x, y, z);
  return o;
}


// ------------------------------------------------------------------ shared detailed body assembly
const bodyCache = {};
function bodyFor(kind) { return (bodyCache[kind] ||= buildBody(SPECS[kind], { res: kind === 'van' ? 0.055 : 0.065, detail: kind === 'van' ? 0.8 : 0.55 })); }

// Builds a complete detailed vehicle exterior + visible interior for a generated body.
export function assembleBody(kind, color, { stripe = null, chromeBumpers = false, roundLamps = false, wheelStyle = 'trafficSteel', wheelR = 0.3, wheelW = 0.18, seatStyle = 'stock' } = {}) {
  const spec = SPECS[kind], b = bodyFor(kind), BM = bodyMats(), DM = D.detailMats(), gen = b.gen;
  const g = new THREE.Group();
  const paint = paintMaterial(color, { stripe, metal: 0.3, rough: 0.42 });
  const add = (geo, mat, shadow = true, order = 0) => { if (!geo) return null; const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; m.renderOrder = order; g.add(m); return m; };
  add(b.groups.paint, paint); add(b.capFront, paint); add(b.capRear, paint);
  add(b.groups.glass, BM.glass, false, 5);
  add(b.under, BM.under); for (const w of b.wells) add(w, BM.under);
  add(b.trims.chrome, BM.chrome); add(b.trims.black, BM.black); add(b.trims.amber, BM.amber);
  const zF = spec.zMax, zR = spec.zMin;
  const capMid = (z) => { const sill = gen.f.sill(z), top = gen.S(z, 1).y; return { sill, top, mid: (sill + top) / 2, hw: gen.f.hw(z) }; };
  const F = capMid(zF), R = capMid(zR);
  const fz = zF + 0.02, rz = zR - 0.02;
  // headlamps & grille
  const hl = [];
  const hy = F.mid + (F.top - F.mid) * 0.25;
  for (const s of [1, -1]) {
    const lamp = roundLamps ? D.headlampRound(0.09) : D.headlampRect(0.24, 0.13);
    lamp.position.set(s * (F.hw - 0.2), hy, fz + 0.004); g.add(lamp);
    const rf = lamp.getObjectByName('reflector'); if (rf) hl.push(rf.material);
  }
  const gw = (F.hw - 0.33) * 2 - 0.04;
  const gr = D.grilleFull(gw, roundLamps ? 0.2 : 0.13, roundLamps ? 'bars' : 'egg'); gr.position.set(0, hy, fz + 0.002); g.add(gr);
  // bumpers & plates
  const bf = D.bumper(F.hw * 2 + 0.04, { dir: 1, wrap: 0.12, chrome: chromeBumpers, h: 0.12, overriders: chromeBumpers }); bf.position.set(0, F.sill + 0.08, fz + 0.04); g.add(bf);
  const br = D.bumper(R.hw * 2 + 0.04, { dir: -1, wrap: 0.12, chrome: chromeBumpers, h: 0.12, overriders: chromeBumpers }); br.position.set(0, R.sill + 0.08, rz - 0.04); g.add(br);
  const plate = 'ABC-' + (100 + Math.floor(Math.random() * 899));
  const pf = D.plateMesh(plate); pf.position.set(0, F.sill + 0.2, fz + 0.012); g.add(pf);
  const pr = D.plateMesh(plate); pr.position.set(0, R.sill + 0.24, rz - 0.012); pr.rotation.y = Math.PI; g.add(pr);
  // tail lamps (per-vehicle red material so brake lights work independently)
  const red = DM.red.clone(); const tl = [red];
  const ty = R.mid + (R.top - R.mid) * (spec.rearGlass ? -0.25 : 0.2);
  for (const s of [1, -1]) {
    const t = D.tailLamp(kind === 'van' ? 0.14 : 0.32, kind === 'van' ? 0.3 : 0.12, { mirror: s < 0 });
    t.position.set(s * (R.hw - (kind === 'van' ? 0.1 : 0.2)), kind === 'van' ? R.sill + 0.42 : ty, rz - 0.004);
    t.traverse((o) => { if (o.name === 'redLens') o.material = red; });
    g.add(t);
  }
  // rear glass (estates/vans) with surround
  if (spec.rearGlass) {
    const rg = spec.rearGlass;
    const panes = rg.split ? [-1, 1] : [0];
    for (const p of panes) {
      const w = rg.split ? rg.w * 0.48 : rg.w * 2;
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, rg.y1 - rg.y0), BM.darkGlass); gl.position.set(p * rg.w * 0.5, (rg.y0 + rg.y1) / 2, rz - 0.006); gl.rotation.y = Math.PI; gl.renderOrder = 5; g.add(gl);
      const fr = new THREE.Mesh(new THREE.TorusGeometry(1, 0.01, 4, 4), BM.black); fr.scale.set(w * 0.71, (rg.y1 - rg.y0) * 0.71, 1); fr.rotation.z = Math.PI / 4; fr.position.copy(gl.position); fr.position.z -= 0.004; g.add(fr);
    }
    if (rg.split) { const seam = new THREE.Mesh(new THREE.BoxGeometry(0.008, R.top - R.sill - 0.1, 0.01), BM.black); seam.position.set(0, R.mid + 0.05, rz - 0.006); g.add(seam); }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.02), BM.chrome); handle.position.set(rg.split ? 0.12 : 0, rg.y0 - 0.12, rz - 0.012); g.add(handle);
  }
  // mirrors and wipers
  const w0 = spec.layout.windows[0];
  for (const s of [1, -1]) {
    const p = gen.S(w0.fb + 0.04, 0.585);
    const m = D.mirror(1); m.position.set(s * (p.x + 0.01), p.y - 0.02, p.z); if (s < 0) m.rotation.y = Math.PI; m.scale.setScalar(kind === 'van' ? 1.4 : 1); g.add(m);
  }
  const wsb = spec.layout.windshield[1];
  const wp = gen.S(wsb - 0.02, gen.tW + 0.06);
  for (const x of [0.38, -0.12]) { const w = D.wiper(kind === 'van' ? 0.55 : 0.48); w.position.set(x, wp.y + 0.005, wp.z - 0.01); w.rotation.set(-0.6, Math.PI, 0); g.add(w); }
  // visible interior
  const floorY = gen.f.sill(0) + 0.03;
  const seatZ = (spec.layout.windows[0].ft + spec.layout.windows[0].rt) / 2;
  for (const s of [1, -1]) { const st = D.seat(seatStyle); st.position.set(s * 0.37, floorY, seatZ - 0.05); g.add(st); }
  if (kind !== 'van') { const rs = D.seat(seatStyle); rs.scale.set(2.4, 0.9, 1); rs.position.set(0, floorY, seatZ - 0.95); g.add(rs); }
  const dash = new THREE.Mesh(new THREE.BoxGeometry(F.hw * 2 - 0.2, 0.22, 0.32), DM.dash); dash.position.set(0, floorY + (kind === 'van' ? 0.72 : 0.52), wsb - 0.25); g.add(dash);
  const sw = D.steeringWheel('stock'); sw.position.set(0.37, floorY + (kind === 'van' ? 0.82 : 0.62), wsb - 0.5); sw.rotation.x = kind === 'van' ? -0.9 : -0.42; g.add(sw);
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(F.hw * 2 - 0.2, 0.02, (spec.zMax - spec.zMin) * 0.6), DM.plastic); carpet.position.set(0, floorY - 0.01, seatZ - 0.5); g.add(carpet);
  // wheels
  const wheels = [];
  for (const a of spec.arches) for (const s of [1, -1]) {
    const w = D.wheel(wheelStyle, wheelR, wheelW, kind !== 'van');
    w.position.set(s * (gen.f.hw(a.z) - wheelW / 2 - 0.035), wheelR, a.z);
    if (s < 0) w.rotation.y = Math.PI;
    g.add(w); wheels.push(w);
  }
  g.add(contactShadow(F.hw * 2 + 0.3, spec.zMax - spec.zMin + 0.5));
  g.traverse((o) => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
  return { group: g, wheels, hl, tl, paint, merge: () => { const ws = new Set(wheels); mergeLocal(g, { keep: (o) => ws.has(o) }); } };
}

// ------------------------------------------------------------------ Van "Kuormuri"
export class Van extends Vehicle {
  constructor(game) {
    super(game, {
      name: 'Kuormuri van', kind: 'van', mass: 1500, com: [0, 0.55, 0.1], inertiaHalf: [0.9, 0.9, 2.3],
      colliders: [{ half: [0.88, 0.45, 2.33], pos: [0, 0.85, 0] }, { half: [0.86, 0.52, 1.95], pos: [0, 1.65, -0.38] }],
      wheels: [
        { pos: [0.75, 0.55, 1.5], radius: 0.33, steer: true, rest: 0.32, stiffness: 34, brakeBias: 1.1 },
        { pos: [-0.75, 0.55, 1.5], radius: 0.33, steer: true, rest: 0.32, stiffness: 34, brakeBias: 1.1 },
        { pos: [0.75, 0.55, -1.5], radius: 0.33, drive: true, handbrake: true, rest: 0.32, stiffness: 38, brakeBias: 0.85 },
        { pos: [-0.75, 0.55, -1.5], radius: 0.33, drive: true, handbrake: true, rest: 0.32, stiffness: 38, brakeBias: 0.85 },
      ],
      engine: { idle: 750, redline: 4800, torque: 165, peak: 2600, sound: { cylinders: 4, drive: 3.5, bodyFreq: 120 }, exhaust: 0.4 },
      gears: [4.0, 2.4, 1.5, 1.0], reverse: 4.0, final: 4.3, maxSteer: 0.55, brake: 40, fuelCap: 60, fuelUse: 1.5,
      seat: [0.45, 1.68, 1.05], exit: [1.7, 0.3, 1.0], camDist: 8, camHeight: 2.8, antiRoll: 0.5,
    });
    this.fuel = 22;
    this.build();
  }
  build() {
    const body = this.vanBody = assembleBody('van', 0xd8d0b8, { stripe: { y0: 0.98, y1: 1.1, color: 0x2a5a8a }, chromeBumpers: true, roundLamps: true, wheelStyle: 'van', wheelR: 0.33, wheelW: 0.2, seatStyle: 'vinyl' });
    this.root.add(body.group);
    this.hlMats = body.hl; this.tlMats = body.tl;
    // logo on the sides
    const logo = canvasTexture(512, 128, (c) => { c.clearRect(0, 0, 512, 128); c.fillStyle = '#2a5a8a'; c.font = 'italic bold 70px Arial'; c.fillText('KUORMURI', 28, 90); });
    const gen = bodyFor('van').gen;
    for (const s of [1, -1]) {
      const p = gen.S(-0.9, 0.38), n = gen.normal(-0.9, 0.38);
      const l = mesh(new THREE.PlaneGeometry(1.5, 0.38), new THREE.MeshStandardMaterial({ map: logo, transparent: true, roughness: 0.4 }), s * (p.x + n.x * 0.004), p.y, p.z, 0, s * Math.PI / 2, 0);
      l.castShadow = false; this.root.add(l);
    }
    // cargo floor inside
    this.root.add(mesh(new THREE.BoxGeometry(1.6, 0.04, 2.6), mats().darkPlanks, 0, 0.62, -0.95));
    // wheels: attach the body's wheel meshes to the physics wheel slots
    const order = [0, 1, 2, 3].map((i) => body.wheels[i]);
    this.cfg.wheels.forEach((w, i) => {
      const src = body.wheels.find((bw) => Math.sign(bw.position.x) === Math.sign(w.pos[0]) && Math.sign(bw.position.z) === Math.sign(w.pos[2]));
      src.removeFromParent();
      const holder = new THREE.Group(); src.position.set(0, 0, 0); holder.add(src); holder.userData.spin = src.userData.spin;
      this.root.add(holder); this.wheelVis.push(holder);
    });
    body.merge();
  }
  updateVisualExtras() {
    for (const m of this.hlMats) m.emissiveIntensity = this.lights ? 3 : 0;
    for (const m of this.tlMats) m.emissiveIntensity = this.brake > 0.1 ? 4 : this.lights ? 1.5 : 0.05;
    this.headlightsActive = this.lights;
  }
  get cargoArea() { return { local: new THREE.Vector3(0, 1.0, -1.0), half: new THREE.Vector3(0.75, 0.6, 1.4) }; }
}

// ------------------------------------------------------------------ Tractor "Vuoksi 35"
export class Tractor extends Vehicle {
  constructor(game) {
    super(game, {
      name: 'Vuoksi 35 tractor', kind: 'tractor', mass: 2300, com: [0, 0.6, -0.1], inertiaHalf: [0.9, 0.9, 1.6],
      colliders: [{ half: [0.45, 0.4, 1.5], pos: [0, 1.0, 0.1] }, { half: [0.6, 0.6, 0.5], pos: [0, 1.6, -0.75] }],
      wheels: [
        { pos: [0.72, 0.5, 1.2], radius: 0.38, steer: true, rest: 0.25, stiffness: 50, travel: 0.12, grip: 1.6 },
        { pos: [-0.72, 0.5, 1.2], radius: 0.38, steer: true, rest: 0.25, stiffness: 50, travel: 0.12, grip: 1.6 },
        { pos: [0.85, 0.75, -0.75], radius: 0.68, drive: true, rest: 0.2, stiffness: 60, travel: 0.1, grip: 2.4, handbrake: true },
        { pos: [-0.85, 0.75, -0.75], radius: 0.68, drive: true, rest: 0.2, stiffness: 60, travel: 0.1, grip: 2.4, handbrake: true },
      ],
      engine: { idle: 700, redline: 2600, torque: 320, peak: 1500, sound: { cylinders: 3, drive: 4, bodyFreq: 90 }, exhaust: 0.7, volume: 1.2 },
      gears: [12, 7, 4.2, 2.6], reverse: 10, final: 5.0, maxSteer: 0.65, brake: 55, fuelCap: 50, dragMul: 2.2, fuelUse: 1.2,
      seat: [0, 2.25, -0.75], exit: [1.4, 0.3, -0.5], camDist: 7, camHeight: 3, antiRoll: 0.55,
    });
    this.fuel = 35;
    this.forkHeight = 0.3;
    this.bale = null;
    this.build();
  }
  build() {
    const P = partMats(), M = mats(), DM = D.detailMats();
    const red = paint(0xc23a18), grey = new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.55, metalness: 0.5, map: tex('grime.jpg') });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c1d1e, roughness: 0.7, metalness: 0.3 });
    const r = this.root;
    const body = new THREE.Group(); r.add(body);
    const add = (g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = mesh(g, m, x, y, z, rx, ry, rz); body.add(o); return o; };
    // engine & transmission block
    add(roundBox(0.5, 0.42, 1.9, 0.06), grey, 0, 0.82, 0.35);
    add(roundBox(0.7, 0.55, 0.75, 0.08), grey, 0, 0.95, -0.72);
    for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.52, 0.02, 0.05), dark, 0, 0.66, -0.2 + i * 0.25);
    // hood: rounded profile extruded along z, tapering at the nose
    const hs = new THREE.Shape(); const hw = 0.36, hh = 0.5;
    hs.moveTo(-hw, 0); hs.lineTo(-hw, hh - 0.12); hs.quadraticCurveTo(-hw, hh, -hw + 0.12, hh); hs.lineTo(hw - 0.12, hh); hs.quadraticCurveTo(hw, hh, hw, hh - 0.12); hs.lineTo(hw, 0); hs.closePath();
    const hood = new THREE.ExtrudeGeometry(hs, { depth: 1.55, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3, curveSegments: 8 });
    const hp = hood.attributes.position; for (let i = 0; i < hp.count; i++) { const zz = hp.getZ(i) / 1.55; hp.setY(i, hp.getY(i) * (1 - Math.max(0, zz - 0.6) * 0.18)); }
    hood.computeVertexNormals();
    add(hood, red, 0, 1.02, -0.05);
    // louvres, grille, badge and lamps
    for (const sx of [1, -1]) for (let i = 0; i < 7; i++) add(new THREE.BoxGeometry(0.012, 0.035, 0.22), dark, sx * 0.4, 1.32 - i * 0.045, 0.35);
    add(new THREE.BoxGeometry(0.66, 0.48, 0.03), DM.grille, 0, 1.24, 1.53);
    for (let i = 0; i < 9; i++) add(new THREE.BoxGeometry(0.62, 0.012, 0.02), DM.chrome, 0, 1.04 + i * 0.05, 1.545);
    add(new THREE.TorusGeometry(0.33, 0.015, 6, 4), DM.chrome, 0, 1.24, 1.55, 0, 0, Math.PI / 4).scale.set(1, 0.75, 1);
    this.hlMats = [];
    for (const sx of [1, -1]) {
      const l = D.headlampRound(0.075); l.position.set(sx * 0.44, 1.42, 1.38); body.add(l);
      const bracket = add(new THREE.BoxGeometry(0.1, 0.03, 0.03), dark, sx * 0.39, 1.42, 1.33);
      this.hlMats.push(l.getObjectByName('reflector').material);
    }
    // exhaust stack with heat shield and air pre-cleaner
    add(new THREE.CylinderGeometry(0.045, 0.05, 1.0, 12), P.exhaust, 0.22, 1.95, 0.95);
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 12, 1, true), DM.chrome, 0.22, 1.85, 0.95);
    add(new THREE.TorusGeometry(0.08, 0.045, 8, 12, Math.PI / 2), P.exhaust, 0.3, 2.45, 0.95, 0, Math.PI / 2, Math.PI);
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.35, 14), dark, -0.22, 1.7, 1.05);
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 14), DM.chrome, -0.22, 1.9, 1.05);
    // front axle, weights
    add(new THREE.BoxGeometry(1.3, 0.12, 0.14), dark, 0, 0.42, 1.2);
    for (let i = 0; i < 5; i++) add(roundBox(0.7, 0.32, 0.06, 0.02), dark, 0, 0.72, 1.66 + i * 0.065);
    // rear fenders (curved shells) with lamps
    for (const sx of [1, -1]) {
      const f = new THREE.CylinderGeometry(0.8, 0.8, 0.52, 28, 1, true, -0.25 * Math.PI, 0.78 * Math.PI); f.rotateZ(Math.PI / 2);
      add(f, red, sx * 0.86, 0.75, -0.75, 0, 0, 0);
      add(new THREE.BoxGeometry(0.52, 0.03, 0.5), red, sx * 0.86, 1.48, -0.9);
      const tl = D.tailLamp(0.12, 0.08, { amber: false }); tl.position.set(sx * 0.86, 1.4, -1.38); body.add(tl);
    }
    // operator platform, steps and controls
    add(new THREE.BoxGeometry(1.2, 0.03, 0.75), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.6, map: tex('cast.jpg') }), 0, 1.25, -0.72);
    for (const sx of [1, -1]) add(new THREE.BoxGeometry(0.26, 0.025, 0.3), dark, sx * 0.62, 0.75, -0.2);
    const seat = D.seat('vinyl'); seat.position.set(0, 1.32, -0.92); seat.scale.set(0.95, 0.85, 0.85); body.add(seat);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), dark, 0, 1.3, -0.9);
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), dark, 0, 1.62, -0.28, -0.75);
    const sw = D.steeringWheel('stock'); sw.position.set(0, 1.95, -0.47); sw.rotation.x = -1.2; body.add(sw);
    add(roundBox(0.5, 0.2, 0.12, 0.03), dark, 0, 1.6, -0.15);
    for (const x of [-0.1, 0.1]) add(new THREE.CircleGeometry(0.045, 16), new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.3 }), x, 1.63, -0.215, 0, Math.PI, 0);
    for (const [x, c] of [[0.25, 0xc02010], [0.3, 0x111111]]) add(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6), dark, x, 1.45, -0.55, 0.3).add(mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshStandardMaterial({ color: c }), 0, 0.16, 0));
    // roll-over frame & canopy
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.6 });
    for (const sx of [1, -1]) {
      const pts = [new THREE.Vector3(sx * 0.62, 1.25, -1.2), new THREE.Vector3(sx * 0.62, 2.7, -1.2), new THREE.Vector3(sx * 0.6, 2.92, -1.05)];
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.035, 8), tubeMat);
      add(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 8), tubeMat, sx * 0.6, 2.08, -0.25);
    }
    add(new THREE.CylinderGeometry(0.03, 0.03, 1.24, 8), tubeMat, 0, 2.9, -1.12, 0, 0, Math.PI / 2);
    const can = new THREE.CylinderGeometry(2.2, 2.2, 1.36, 24, 1, false, -0.17, 0.34); can.rotateZ(Math.PI / 2); can.rotateY(Math.PI / 2);
    add(can, red, 0, 0.78, -0.7);
    add(new THREE.BoxGeometry(1.16, 0.8, 0.012), glassMat(), 0, 2.45, -0.24).renderOrder = 5;
    // three-point hitch & drawbar
    for (const sx of [1, -1]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), dark, sx * 0.28, 0.75, -1.35, 1.2);
    add(new THREE.BoxGeometry(0.12, 0.06, 0.5), dark, 0, 0.5, -1.3);
    // decals
    const logo = canvasTexture(256, 64, (c) => { c.clearRect(0, 0, 256, 64); c.fillStyle = '#ffffff'; c.font = 'bold 42px Arial'; c.fillText('VUOKSI', 8, 46); c.fillStyle = '#f2c030'; c.fillText('35', 170, 46); });
    for (const sx of [1, -1]) add(new THREE.PlaneGeometry(0.55, 0.14), new THREE.MeshStandardMaterial({ map: logo, transparent: true }), sx * 0.402, 1.38, 0.85, 0, sx * Math.PI / 2, 0);
    // front bale spear (fork)
    this.fork = new THREE.Group();
    this.fork.add(mesh(new THREE.BoxGeometry(1.25, 0.12, 0.08), red, 0, 0, 0));
    this.fork.add(mesh(new THREE.BoxGeometry(1.25, 0.05, 0.08), dark, 0, 0.35, 0));
    for (const sx of [1, -1]) { this.fork.add(mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), red, sx * 0.6, 0.18, 0)); this.fork.add(mesh(new THREE.BoxGeometry(0.08, 0.08, 1.0), dark, sx * 0.55, -0.0, -0.45)); }
    for (const x of [-0.3, 0, 0.3]) this.fork.add(mesh(new THREE.ConeGeometry(0.035, x === 0 ? 0.95 : 0.6, 8).rotateX(Math.PI / 2), DM.chrome, x, 0.05, x === 0 ? 0.47 : 0.3));
    this.fork.position.set(0, 0.5, 1.95);
    r.add(this.fork);
    attachWheels(this, (w, i) => i < 2 ? D.wheel('van', 0.38, 0.2) : bigTractorWheel());
    const keepSet = new Set(this.wheelVis);
    mergeLocal(body, { keep: (o) => keepSet.has(o) });
    r.add(contactShadow(2.2, 3.8));
  }
  drive(dt, input) {
    super.drive(dt, input);
    if (input.down('KeyR')) this.forkHeight = Math.min(2.2, this.forkHeight + dt * 0.8);
    if (input.down('KeyF')) this.forkHeight = Math.max(0.15, this.forkHeight - dt * 0.8);
  }
  updateVisualExtras() {
    this.fork.position.y = this.forkHeight + 0.2;
    for (const m of this.hlMats) m.emissiveIntensity = this.lights ? 3 : 0;
    this.headlightsActive = this.lights;
  }
  forkTipWorld(out = new THREE.Vector3()) { return this.toWorld(out.set(0, this.forkHeight + 0.2, 2.6)); }
}
const _btw = {};
function bigTractorWheel() {
  const P = partMats(), DM = D.detailMats();
  if (!_btw.tyre) {
    const tp = []; for (let i = 0; i <= 8; i++) { const k = i / 8; tp.push(new THREE.Vector2(0.62 + 0.04 * Math.sin(k * Math.PI), -0.2 + 0.4 * k)); }
    _btw.tyre = new THREE.LatheGeometry(tp, 36); _btw.tyre.rotateZ(Math.PI / 2);
    const lugs = [];
    for (let i = 0; i < 22; i++) for (const sd of [1, -1]) {
      const lg = new THREE.BoxGeometry(0.2, 0.055, 0.07); lg.translate(sd * 0.1, 0, 0); lg.rotateY(sd * 0.55);
      const a = (i + (sd > 0 ? 0 : 0.5)) / 22 * Math.PI * 2;
      lg.translate(0, 0.66, 0); lg.rotateX(a); lugs.push(lg);
    }
    _btw.lugs = D.mergeIdx(lugs);
    const rp = [new THREE.Vector2(0.43, -0.18), new THREE.Vector2(0.44, 0.0), new THREE.Vector2(0.43, 0.18), new THREE.Vector2(0.2, 0.12), new THREE.Vector2(0.12, 0.16), new THREE.Vector2(0.0, 0.16)];
    _btw.rim = new THREE.LatheGeometry(rp, 28); _btw.rim.rotateZ(-Math.PI / 2);
    _btw.hub = new THREE.CylinderGeometry(0.1, 0.1, 0.14, 12); _btw.hub.rotateZ(Math.PI / 2); _btw.hub.translate(0.2, 0, 0);
    _btw.side = new THREE.RingGeometry(0.43, 0.63, 36); _btw.side.rotateY(Math.PI / 2); _btw.side.translate(0.205, 0, 0);
  }
  const g = new THREE.Group(), spin = new THREE.Group(); spin.name = 'spin';
  spin.add(mesh(_btw.tyre, P.tyre)); spin.add(mesh(_btw.lugs, P.rubber)); spin.add(mesh(_btw.side, DM.sidewall));
  spin.add(mesh(_btw.rim, paint(0xc23a18))); spin.add(mesh(_btw.hub, DM.chrome));
  g.add(spin); g.userData.spin = spin; return g;
}

// ------------------------------------------------------------------ Moped "Pappa 50"
export class Moped extends Vehicle {
  constructor(game) {
    super(game, {
      name: 'Pappa 50 moped', kind: 'moped', mass: 140, com: [0, 0.35, 0], inertiaHalf: [0.3, 0.5, 0.8],
      colliders: [{ half: [0.18, 0.3, 0.75], pos: [0, 0.55, 0] }],
      wheels: [
        { pos: [0.12, 0.35, 0.62], radius: 0.25, steer: true, rest: 0.18, stiffness: 30, grip: 1.4 },
        { pos: [-0.12, 0.35, 0.62], radius: 0.25, steer: true, rest: 0.18, stiffness: 30, grip: 1.4 },
        { pos: [0.12, 0.35, -0.6], radius: 0.25, drive: true, rest: 0.18, stiffness: 32, grip: 1.5, handbrake: true },
        { pos: [-0.12, 0.35, -0.6], radius: 0.25, drive: true, rest: 0.18, stiffness: 32, grip: 1.5, handbrake: true },
      ],
      engine: { idle: 1600, redline: 8500, torque: 9.5, peak: 6000, sound: { cylinders: 1, drive: 4, bodyFreq: 300, harmonics: [[1, 0.5, 'sawtooth'], [2, 0.3, 'square'], [3, 0.15, 'sawtooth']] }, exhaust: 0.6, volume: 0.8 },
      gears: [3.2], reverse: 0.0001, final: 4.5, maxSteer: 0.5, brake: 6, fuelCap: 4, fuelUse: 0.3, dragMul: 0.35,
      seat: [0, 1.45, -0.25], exit: [0.9, 0.3, 0], camDist: 4, camHeight: 1.8, antiRoll: 0,
    });
    this.fuel = 3;
    this.autoGear = true;
    this.build();
  }
  build() {
    const P = partMats(), DM = D.detailMats();
    const blue = paint(0x2a6aa8);
    const blk = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6, metalness: 0.2 });
    const alu = DM.alloy;
    this.lean = new THREE.Group(); this.root.add(this.lean);
    const L = this.lean;
    const add = (g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = L) => { const o = mesh(g, m, x, y, z, rx, ry, rz); parent.add(o); return o; };
    const tube = (pts, r, m, parent = L) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 24, r, 8), m, 0, 0, 0, 0, 0, 0, parent);
    // step-through frame
    tube([[0, 0.86, 0.5], [0, 0.6, 0.38], [0, 0.32, 0.12], [0, 0.3, -0.1], [0, 0.5, -0.35], [0, 0.72, -0.62]], 0.032, blue);
    tube([[0, 0.3, -0.1], [0, 0.28, -0.4], [0, 0.22, -0.6]], 0.022, blue);
    // tank & side covers
    const tank = add(new THREE.SphereGeometry(0.16, 20, 14), blue, 0, 0.72, 0.28); tank.scale.set(0.75, 0.55, 1.25);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), DM.chrome, 0, 0.81, 0.3);
    for (const sx of [1, -1]) { const c = add(roundBox(0.02, 0.2, 0.32, 0.04), blue, sx * 0.1, 0.58, -0.22); }
    // engine: crankcase, finned cylinder, carb
    add(roundBox(0.18, 0.18, 0.26, 0.05), alu, 0, 0.27, 0.02);
    for (let i = 0; i < 7; i++) add(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 16), alu, 0, 0.38 + i * 0.022, 0.12, 0.4);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), blk, 0, 0.55, 0.06, 0.4);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 10), alu, -0.09, 0.4, 0.0, 0, 0, Math.PI / 2);
    // exhaust
    tube([[0.04, 0.4, 0.2], [0.09, 0.28, 0.25], [0.13, 0.2, 0.05], [0.14, 0.24, -0.3]], 0.018, DM.chrome);
    const muff = add(new THREE.CylinderGeometry(0.045, 0.035, 0.38, 14), DM.chrome, 0.14, 0.27, -0.45, Math.PI / 2 - 0.1);
    // seat, grab rail, rack, rear fender, tail lamp, plate
    const seat = add(roundBox(0.24, 0.1, 0.62, 0.05), new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.45, map: tex('vinyl.jpg') }), 0, 0.82, -0.3);
    tube([[0.12, 0.8, -0.08], [0.13, 0.82, -0.55], [0, 0.83, -0.68], [-0.13, 0.82, -0.55], [-0.12, 0.8, -0.08]], 0.01, DM.chrome);
    for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.24, 0.012, 0.012), DM.chrome, 0, 0.8, -0.6 - i * 0.06);
    const rf = new THREE.TorusGeometry(0.29, 0.05, 6, 20, Math.PI * 0.75); rf.rotateY(Math.PI / 2);
    add(rf, blue, 0, 0.2, -0.6, -0.25, 0, 0).scale.set(1, 1, 0.55);
    const tl = D.tailLamp(0.1, 0.06, { amber: false }); tl.position.set(0, 0.66, -0.86); L.add(tl);
    this.tlMat = tl.getObjectByName('redLens').material = DM.red.clone();
    const pl = D.plateMesh('PAP-17', 0.2, 0.1); pl.position.set(0, 0.52, -0.88); pl.rotation.set(-0.3, Math.PI, 0); L.add(pl);
    // pedals & kickstand
    for (const sx of [1, -1]) { add(new THREE.BoxGeometry(0.02, 0.16, 0.03), DM.chrome, sx * 0.14, 0.22, -0.02, 0.8); add(new THREE.BoxGeometry(0.1, 0.02, 0.05), blk, sx * 0.19, 0.16, 0.04); }
    add(new THREE.CylinderGeometry(0.01, 0.01, 0.28, 6), blk, 0.08, 0.14, -0.15, 0.5, 0, -0.4);
    // steering assembly: fork, fender, headlamp, handlebars, speedometer
    const st = new THREE.Group(); st.position.set(0, 0.86, 0.5); L.add(st); this.steerGroup = st;
    for (const sx of [1, -1]) add(new THREE.CylinderGeometry(0.018, 0.018, 0.72, 8), DM.chrome, sx * 0.06, -0.33, 0.07, 0.17, 0, 0, st);
    add(new THREE.BoxGeometry(0.16, 0.04, 0.06), blk, 0, 0.02, 0, 0, 0, 0, st);
    const ff = new THREE.TorusGeometry(0.29, 0.045, 6, 18, Math.PI * 0.6); ff.rotateY(Math.PI / 2);
    add(ff, blue, 0, -0.66, 0.12, 1.2, 0, 0, st).scale.set(1, 1, 0.5);
    tube([[0, 0.12, 0.02], [0.18, 0.2, -0.05], [0.3, 0.22, -0.1]], 0.012, DM.chrome, st);
    tube([[0, 0.12, 0.02], [-0.18, 0.2, -0.05], [-0.3, 0.22, -0.1]], 0.012, DM.chrome, st);
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8), blk, 0.0, 0.08, 0.0, 0, 0, 0, st);
    for (const sx of [1, -1]) { add(new THREE.CylinderGeometry(0.017, 0.017, 0.11, 10), blk, sx * 0.34, 0.22, -0.11, 0, 0, Math.PI / 2, st); add(new THREE.BoxGeometry(0.12, 0.008, 0.02), DM.chrome, sx * 0.24, 0.2, -0.06, 0, 0.3 * sx, 0, st); }
    const hl = D.headlampRound(0.075); hl.position.set(0, 0.05, 0.12); st.add(hl);
    this.hlMat = hl.getObjectByName('reflector').material;
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), blk, 0, 0.17, 0.05, -0.6, 0, 0, st);
    add(new THREE.CircleGeometry(0.042, 16), new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.3, emissive: 0x302810 }), 0, 0.19, 0.04, -0.6 - Math.PI / 2, 0, 0, st);
    const mir = D.mirror(1); mir.position.set(0.3, 0.24, -0.1); mir.scale.setScalar(0.8); st.add(mir);
    // logo
    const logo = canvasTexture(256, 64, (c) => { c.clearRect(0, 0, 256, 64); c.fillStyle = '#ffffff'; c.font = 'italic bold 40px Georgia'; c.fillText('Pappa 50', 20, 46); });
    for (const sx of [1, -1]) add(new THREE.PlaneGeometry(0.26, 0.065), new THREE.MeshStandardMaterial({ map: logo, transparent: true }), sx * 0.112, 0.6, -0.22, 0, sx * Math.PI / 2, 0);
    // spoked wheels
    const fw = spokedWheel(), rw = spokedWheel();
    this.fwheel = fw; this.rwheel = rw; L.add(fw); L.add(rw);
    mergeLocal(L, { keep: (o) => o === fw || o === rw || o === st || o === tl });
    mergeLocal(st);
    this.root.add(contactShadow(0.7, 1.8));
  }
  drive(dt, input) {
    super.drive(dt, input);
    // automatic: always in gear 1 when throttle, neutral when idle stop
    if (this.gear === 0 && input.down('KeyW')) this.gear = 1;
    if (this.gear < 0) this.gear = 0;
  }
  update(dt) {
    super.update(dt);
    const vc = this.controller;
    if (!vc) return;
    const sl = vc.wheelSuspensionLength(0) ?? 0.18, sr = vc.wheelSuspensionLength(2) ?? 0.18;
    this.fwheel.position.set(0, 0.35 - sl, 0.62); this.fwheel.rotation.y = this.steer;
    this.rwheel.position.set(0, 0.35 - sr, -0.6);
    this.fwheel.userData.spin.rotation.x = -(vc.wheelRotation(0) ?? 0);
    this.rwheel.userData.spin.rotation.x = -(vc.wheelRotation(2) ?? 0);
    const targetLean = -this.steer * Math.min(1, this.speedKmh / 25) * 0.9;
    this.lean.rotation.z += (targetLean - this.lean.rotation.z) * Math.min(1, dt * 5);
    if (this.steerGroup) this.steerGroup.rotation.y = this.steer;
    this.hlMat.emissiveIntensity = this.lights ? 3 : 0;
    this.tlMat.emissiveIntensity = this.brake > 0.1 ? 4 : this.lights ? 1.5 : 0.05;
    this.headlightsActive = this.lights;
  }
}

let _spoke = null;
function spokedWheel() {
  const P = partMats(), DM = D.detailMats();
  if (!_spoke) {
    const tyre = new THREE.TorusGeometry(0.215, 0.035, 10, 32); tyre.rotateY(Math.PI / 2);
    const rim = new THREE.TorusGeometry(0.18, 0.012, 6, 32); rim.rotateY(Math.PI / 2);
    const sp = [];
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2, side = i % 2 ? 1 : -1;
      const p0 = new THREE.Vector3(side * 0.035, Math.cos(a) * 0.03, Math.sin(a) * 0.03), p1 = new THREE.Vector3(0, Math.cos(a + 0.3) * 0.178, Math.sin(a + 0.3) * 0.178);
      const len = p0.distanceTo(p1);
      const c = new THREE.CylinderGeometry(0.0025, 0.0025, len, 3); c.translate(0, len / 2, 0);
      c.applyMatrix4(new THREE.Matrix4().lookAt(p0, p1, new THREE.Vector3(1, 0, 0)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
      c.translate(p0.x, p0.y, p0.z); sp.push(c);
    }
    const hub = new THREE.CylinderGeometry(0.05, 0.05, 0.09, 14); hub.rotateZ(Math.PI / 2);
    _spoke = { tyre, rim, spokes: D.mergeIdx(sp), hub };
  }
  const g = new THREE.Group(), spin = new THREE.Group(); spin.name = 'spin';
  spin.add(mesh(_spoke.tyre, P.tyre)); spin.add(mesh(_spoke.rim, DM.chrome)); spin.add(mesh(_spoke.spokes, DM.chrome)); spin.add(mesh(_spoke.hub, DM.alloy));
  g.add(spin); g.userData.spin = spin; return g;
}

// ------------------------------------------------------------------ AI traffic car body (visual only)
export function buildTrafficCar(kind = 'sedan', color = 0x3a5a7a) {
  const police = kind === 'police';
  const body = assembleBody(police ? 'sedan' : kind, police ? 0xf2f2f0 : color, {
    stripe: police ? { y0: 0.62, y1: 0.76, color: 0x1a3a9a } : null,
    chromeBumpers: kind === 'wagon' && color % 2 === 0, roundLamps: kind === 'wagon', wheelStyle: police ? 'alloy' : 'trafficSteel',
  });
  const g = body.group;
  // lamp materials driven by the AI (headlights at night, brake lights)
  const hl = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0d0, emissiveIntensity: 0 });
  body.hl.forEach((m) => (m.emissive = hl.emissive));
  g.userData.hl = { set emissiveIntensity(v) { body.hl.forEach((m) => (m.emissiveIntensity = v)); } };
  g.userData.tl = { set emissiveIntensity(v) { body.tl.forEach((m) => (m.emissiveIntensity = Math.max(0.05, v))); } };
  g.userData.wheels = body.wheels;
  if (police) {
    const gen = bodyFor('sedan').gen;
    const t = canvasTexture(512, 96, (c) => { c.clearRect(0, 0, 512, 96); c.fillStyle = '#1a3a9a'; c.font = 'bold 72px Arial'; c.fillText('POLIISI', 110, 74); });
    for (const s of [1, -1]) {
      const p = gen.S(-0.4, 0.33), n = gen.normal(-0.4, 0.33);
      g.add(mesh(new THREE.PlaneGeometry(1.3, 0.24), new THREE.MeshStandardMaterial({ map: t, transparent: true }), s * (p.x + n.x * 0.004), p.y, p.z, 0, s * Math.PI / 2, 0));
    }
    const bar = new THREE.Group();
    const P = partMats();
    bar.add(mesh(new THREE.BoxGeometry(1.1, 0.07, 0.26), P.black));
    const b1 = new THREE.MeshPhysicalMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 0, transparent: true, opacity: 0.85, roughness: 0.1 });
    const b2 = b1.clone();
    bar.add(mesh(new THREE.CapsuleGeometry(0.08, 0.3, 4, 10).rotateZ(Math.PI / 2), b1, 0.3, 0.06, 0));
    bar.add(mesh(new THREE.CapsuleGeometry(0.08, 0.3, 4, 10).rotateZ(Math.PI / 2), b2, -0.3, 0.06, 0));
    for (const s of [1, -1]) bar.add(mesh(new THREE.BoxGeometry(0.04, 0.06, 0.05), P.black, s * 0.5, -0.05, 0));
    const roofY = gen.S(-0.1, 1).y;
    bar.position.set(0, roofY + 0.05, -0.1); g.add(bar);
    g.userData.beacons = [b1, b2];
  }
  // driver
  const head = mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd8a888, roughness: 0.7 }), 0.37, 1.15, 0.0);
  const torso = mesh(new THREE.BoxGeometry(0.36, 0.42, 0.22), new THREE.MeshStandardMaterial({ color: [0x3a4a6a, 0x6a3a2a, 0x2a4a2a][Math.floor(Math.random() * 3)], roughness: 0.9 }), 0.37, 0.86, -0.05);
  if (police) torso.material.color.setHex(0x1a2a4a);
  g.add(head, torso);
  body.merge();
  return g;
}
