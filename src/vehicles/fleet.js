import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { partMats, PartBuilders } from './parts.js';
import { roundBox, canvasTexture } from '../core/util.js';
import { mats } from '../world/mats.js';
import { tex } from '../core/assets.js';

const mesh = (g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; return o; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function paint(color) { return new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.2 }); }
const glassMat = () => new THREE.MeshPhysicalMaterial({ color: 0x8aa0a8, roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });

function simpleWheel(r, w, rimColor = 0x2a2a2c, hub = true) {
  const P = partMats();
  const g = new THREE.Group(); const spin = new THREE.Group(); spin.name = 'spin';
  const tg = new THREE.CylinderGeometry(r, r, w, 28); tg.rotateZ(Math.PI / 2);
  spin.add(mesh(tg, P.tyre));
  spin.add(mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.01, 20).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.45, metalness: 0.6 })));
  if (hub) spin.add(mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, w + 0.03, 10).rotateZ(Math.PI / 2), P.chrome));
  g.add(spin); g.userData.spin = spin;
  return g;
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

// ------------------------------------------------------------------ Van "Kuormuri"
export class Van extends Vehicle {
  constructor(game) {
    super(game, {
      name: 'Kuormuri van', kind: 'van', mass: 1500, com: [0, 0.55, 0.1], inertiaHalf: [0.9, 0.9, 2.3],
      colliders: [{ half: [0.88, 0.5, 2.3], pos: [0, 0.95, 0] }, { half: [0.85, 0.35, 0.55], pos: [0, 1.75, 1.15] }, { half: [0.88, 0.4, 1.5], pos: [0, 1.85, -0.75] }],
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
    const P = partMats(), M = mats();
    const body = paint(0xd8d0b8);
    const stripe = paint(0x2a5a8a);
    const r = this.root;
    r.add(mesh(roundBox(1.8, 1.2, 4.7, 0.12), body, 0, 1.15, 0));
    r.add(mesh(roundBox(1.76, 0.9, 1.2, 0.18), body, 0, 1.95, 1.0));
    r.add(mesh(roundBox(1.8, 1.05, 3.2, 0.1), body, 0, 2.05, -0.75));
    r.add(mesh(box(1.82, 0.14, 4.6), stripe, 0, 1.15, 0));
    const gl = glassMat();
    r.add(mesh(box(1.5, 0.6, 0.04), gl, 0, 2.0, 1.58, -0.35));
    for (const s of [1, -1]) r.add(mesh(box(0.04, 0.5, 0.75), gl, s * 0.89, 2.0, 0.95));
    r.add(mesh(box(1.9, 0.18, 0.12), P.chrome, 0, 0.62, 2.35));
    r.add(mesh(box(1.9, 0.18, 0.12), P.chrome, 0, 0.62, -2.35));
    r.add(mesh(box(1.2, 0.3, 0.04), P.blackMatte, 0, 0.95, 2.36));
    this.lamps = [lamp(0xfff0d0, 0.62, 1.0, 2.37), lamp(0xfff0d0, -0.62, 1.0, 2.37)];
    this.lamps.forEach((l) => r.add(l));
    this.tail = [lamp(0xff1000, 0.75, 0.95, -2.37, 0.06), lamp(0xff1000, -0.75, 0.95, -2.37, 0.06)];
    this.tail.forEach((l) => { l.rotation.y = Math.PI; r.add(l); });
    // logo
    const logo = canvasTexture(512, 128, (c) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, 512, 128); c.fillStyle = '#2a5a8a'; c.font = 'bold 64px Arial'; c.fillText('KUORMURI', 40, 86); });
    for (const s of [1, -1]) { const l = mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshStandardMaterial({ map: logo, transparent: true }), s * 0.905, 1.65, -0.8, 0, s * Math.PI / 2, 0); r.add(l); }
    // interior: dash, seats, wheel
    r.add(mesh(box(1.6, 0.25, 0.4), M.vinyl, 0, 1.45, 1.45));
    for (const x of [0.45, -0.45]) { r.add(mesh(roundBox(0.5, 0.12, 0.5, 0.04), M.fabricBlue, x, 1.05, 0.9)); r.add(mesh(roundBox(0.5, 0.6, 0.12, 0.04), M.fabricBlue, x, 1.4, 0.62, -0.1)); }
    const sw = PartBuilders.swheel('stock'); sw.position.set(0.45, 1.55, 1.25); sw.rotation.x = -0.9; r.add(sw);
    r.add(mesh(box(1.7, 0.04, 3.1), M.darkPlanks, 0, 0.82, -0.75)); // cargo floor
    r.add(mesh(box(1.7, 1.1, 0.04), body, 0, 1.4, 0.35)); // bulkhead
    attachWheels(this, (w) => simpleWheel(0.33, 0.2, 0xc8c8c8));
  }
  updateVisualExtras() {
    for (const l of this.lamps) l.material.emissiveIntensity = this.lights ? 3 : 0;
    for (const l of this.tail) l.material.emissiveIntensity = this.brake > 0.1 ? 4 : this.lights ? 1.5 : 0;
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
    const P = partMats(), M = mats();
    const red = paint(0xc8401a);
    const r = this.root;
    r.add(mesh(roundBox(0.8, 0.7, 2.0, 0.1), red, 0, 1.2, 0.45)); // hood
    r.add(mesh(box(0.84, 0.08, 2.02), P.black, 0, 1.55, 0.45));
    for (let i = 0; i < 8; i++) r.add(mesh(box(0.02, 0.4, 0.25), P.black, 0.41, 1.15, 0.0 + i * 0.12));
    r.add(mesh(box(0.7, 0.5, 0.06), P.radiator, 0, 1.15, 1.47));
    r.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 10), P.exhaust, 0.25, 1.95, 0.9));
    r.add(mesh(roundBox(1.0, 0.25, 1.0, 0.05), P.black, 0, 0.95, -0.7)); // rear body
    for (const s of [1, -1]) r.add(mesh(roundBox(0.5, 0.06, 1.2, 0.03), red, s * 0.82, 1.5, -0.75)); // fenders
    // cab frame
    const frame = paint(0x1a1a1a);
    for (const [x, z] of [[0.6, -0.25], [-0.6, -0.25], [0.6, -1.2], [-0.6, -1.2]]) r.add(mesh(box(0.06, 1.5, 0.06), frame, x, 2.2, z));
    r.add(mesh(roundBox(1.35, 0.08, 1.1, 0.03), red, 0, 2.97, -0.72));
    r.add(mesh(box(1.2, 0.8, 0.03), glassMat(), 0, 2.4, -0.25));
    const seat = mesh(roundBox(0.45, 0.1, 0.45, 0.04), M.vinyl, 0, 1.7, -0.85); r.add(seat);
    r.add(mesh(roundBox(0.45, 0.45, 0.1, 0.04), M.vinyl, 0, 1.95, -1.08));
    const sw = PartBuilders.swheel('stock'); sw.position.set(0, 2.05, -0.35); sw.rotation.x = -1.2; r.add(sw);
    const logo = canvasTexture(256, 64, (c) => { c.fillStyle = '#c8401a'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#fff'; c.font = 'bold 40px Arial'; c.fillText('VUOKSI 35', 18, 46); });
    for (const s of [1, -1]) r.add(mesh(new THREE.PlaneGeometry(0.6, 0.15), new THREE.MeshStandardMaterial({ map: logo }), s * 0.405, 1.35, 0.7, 0, s * Math.PI / 2, 0));
    this.lamps = [lamp(0xfff0d0, 0.25, 1.35, 1.51, 0.07), lamp(0xfff0d0, -0.25, 1.35, 1.51, 0.07)];
    this.lamps.forEach((l) => r.add(l));
    // front bale spear (fork)
    this.fork = new THREE.Group();
    this.fork.add(mesh(box(1.2, 0.1, 0.1), P.black, 0, 0, 0));
    for (const s of [1, -1]) this.fork.add(mesh(box(0.08, 0.08, 1.0), P.black, s * 0.55, -0.0, -0.45));
    this.fork.add(mesh(new THREE.ConeGeometry(0.04, 0.9, 8).rotateX(Math.PI / 2), P.steel, 0, 0, 0.45));
    this.fork.position.set(0, 0.5, 1.95);
    r.add(this.fork);
    attachWheels(this, (w, i) => i < 2 ? simpleWheel(0.38, 0.22, 0xc8401a) : bigTractorWheel());
  }
  drive(dt, input) {
    super.drive(dt, input);
    if (input.down('KeyR')) this.forkHeight = Math.min(2.2, this.forkHeight + dt * 0.8);
    if (input.down('KeyF')) this.forkHeight = Math.max(0.15, this.forkHeight - dt * 0.8);
  }
  updateVisualExtras() {
    this.fork.position.y = this.forkHeight + 0.2;
    for (const l of this.lamps) l.material.emissiveIntensity = this.lights ? 3 : 0;
    this.headlightsActive = this.lights;
  }
  forkTipWorld(out = new THREE.Vector3()) { return this.toWorld(out.set(0, this.forkHeight + 0.2, 2.6)); }
}
function bigTractorWheel() {
  const P = partMats(), g = new THREE.Group(), spin = new THREE.Group(); spin.name = 'spin';
  spin.add(mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.38, 28).rotateZ(Math.PI / 2), P.tyre));
  for (let i = 0; i < 18; i++) { const lug = mesh(box(0.4, 0.06, 0.12), P.rubber, 0, Math.cos(i / 18 * Math.PI * 2) * 0.69, Math.sin(i / 18 * Math.PI * 2) * 0.69, i / 18 * Math.PI * 2, 0, (i % 2 ? 0.4 : -0.4)); spin.add(lug); }
  spin.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.4, 20).rotateZ(Math.PI / 2), paint(0xc8401a)));
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
    const P = partMats(), M = mats();
    const blue = paint(0x2a6aa8);
    this.lean = new THREE.Group(); this.root.add(this.lean);
    const L = this.lean;
    L.add(mesh(roundBox(0.3, 0.3, 0.9, 0.1), blue, 0, 0.6, -0.1));
    L.add(mesh(roundBox(0.3, 0.12, 0.6, 0.05), M.vinyl, 0, 0.85, -0.3));
    L.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 8), P.chrome, 0, 0.75, 0.55, 0.35));
    L.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.6, 8), P.chrome, 0, 1.1, 0.68, 0, 0, Math.PI / 2));
    L.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.6, 10), P.exhaust, 0.15, 0.4, -0.35, Math.PI / 2 - 0.1));
    L.add(mesh(roundBox(0.22, 0.2, 0.3, 0.05), blue, 0, 0.75, 0.35));
    this.lamps = [lamp(0xfff0d0, 0, 1.0, 0.78, 0.07)];
    L.add(this.lamps[0]);
    L.add(mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.06, 14).rotateX(Math.PI / 2), P.chrome, 0, 1.0, 0.75));
    const logo = canvasTexture(256, 64, (c) => { c.fillStyle = '#2a6aa8'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#fff'; c.font = 'italic bold 40px Georgia'; c.fillText('Pappa 50', 20, 46); });
    for (const s of [1, -1]) L.add(mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshStandardMaterial({ map: logo }), s * 0.155, 0.62, -0.05, 0, s * Math.PI / 2, 0));
    // two visual wheels only
    const fw = simpleWheel(0.25, 0.07, 0xc8c8c8), rw = simpleWheel(0.25, 0.08, 0xc8c8c8);
    this.fwheel = fw; this.rwheel = rw; L.add(fw); L.add(rw);
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
    this.lamps[0].material.emissiveIntensity = this.lights ? 3 : 0;
    this.headlightsActive = this.lights;
  }
}

// ------------------------------------------------------------------ AI traffic car body (visual only)
export function buildTrafficCar(kind = 'sedan', color = 0x3a5a7a) {
  const P = partMats();
  const g = new THREE.Group();
  const body = paint(color);
  const police = kind === 'police';
  if (police) body.color.setHex(0xf2f2f2);
  const L = kind === 'wagon' ? 4.6 : 4.4;
  g.add(mesh(roundBox(1.72, 0.62, L, 0.16), body, 0, 0.68, 0));
  if (kind === 'wagon') g.add(mesh(roundBox(1.56, 0.55, 2.7, 0.14), body, 0, 1.22, -0.45));
  else g.add(mesh(roundBox(1.52, 0.52, 2.1, 0.18), body, 0, 1.2, -0.25));
  const gl = new THREE.MeshPhysicalMaterial({ color: 0x1a2a30, roughness: 0.05, metalness: 0.4 });
  g.add(mesh(box(1.42, 0.38, 0.04), gl, 0, 1.22, kind === 'wagon' ? 0.92 : 0.82, -0.6));
  for (const s of [1, -1]) g.add(mesh(box(0.04, 0.34, kind === 'wagon' ? 2.4 : 1.8), gl, s * 0.77, 1.24, kind === 'wagon' ? -0.45 : -0.25));
  g.add(mesh(box(1.8, 0.14, 0.12), P.chrome, 0, 0.45, L / 2 + 0.02));
  g.add(mesh(box(1.8, 0.14, 0.12), P.chrome, 0, 0.45, -L / 2 - 0.02));
  const hl = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0d0, emissiveIntensity: 0 });
  const tl = new THREE.MeshStandardMaterial({ color: 0x600000, emissive: 0xff1000, emissiveIntensity: 0 });
  for (const s of [1, -1]) { g.add(mesh(box(0.3, 0.14, 0.04), hl, s * 0.6, 0.72, L / 2 + 0.01)); g.add(mesh(box(0.3, 0.12, 0.04), tl, s * 0.62, 0.78, -L / 2 - 0.01)); }
  g.userData.hl = hl; g.userData.tl = tl;
  if (police) {
    const blue = new THREE.MeshStandardMaterial({ color: 0x1a3a9a, roughness: 0.4 });
    for (const s of [1, -1]) g.add(mesh(box(0.02, 0.18, L * 0.9), blue, s * 0.87, 0.72, 0));
    const t = canvasTexture(512, 96, (c) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, 512, 96); c.fillStyle = '#1a3a9a'; c.font = 'bold 72px Arial'; c.fillText('POLIISI', 110, 74); });
    for (const s of [1, -1]) g.add(mesh(new THREE.PlaneGeometry(1.4, 0.26), new THREE.MeshStandardMaterial({ map: t, transparent: true }), s * 0.875, 0.95, -0.2, 0, s * Math.PI / 2, 0));
    const bar = new THREE.Group();
    bar.add(mesh(box(1.1, 0.1, 0.25), P.black));
    const b1 = new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 0 });
    const b2 = new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 0 });
    bar.add(mesh(box(0.4, 0.12, 0.22), b1, 0.32, 0.05, 0)); bar.add(mesh(box(0.4, 0.12, 0.22), b2, -0.32, 0.05, 0));
    bar.position.set(0, 1.52, -0.2); g.add(bar);
    g.userData.beacons = [b1, b2];
  }
  const wheels = [];
  for (const [x, z] of [[0.75, 1.35], [-0.75, 1.35], [0.75, -1.35], [-0.75, -1.35]]) {
    const w = simpleWheel(0.3, 0.18, police ? 0xcccccc : 0x2a2a2a); w.position.set(x, 0.3, z); if (x < 0) w.rotation.y = Math.PI; g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  // simple driver silhouette
  const head = mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8a888 }), 0.38, 1.25, -0.05);
  g.add(head);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
