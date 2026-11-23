import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { centreGeo, WHEELS } from './carbody.js';
import { buildBody, SPECS, paintMaterial, bodyMats } from './bodygen.js';
import * as D from './details.js';
import { mergeLocal } from '../core/batch.js';
import { PARTS, SLOTS, PANEL_TYPES, PANEL_INFO, partMats } from './parts.js';
import { clamp, rand, lerp, damp, pick } from '../core/util.js';
import { audio } from '../core/audio.js';
import { tex } from '../core/assets.js';
import { mats } from '../world/mats.js';
import { tween } from '../core/tween.js';

// bolted-on hood, trunk lid and doors swing open on their hinges (unbolted ones can be removed)
const HINGED = { hood: -1.15, trunk: 1.2, doorL: -1.15, doorR: 1.15 };
const _hq = new THREE.Quaternion(), _hv = new THREE.Vector3();

const ENGINE_REQ = ['crank', 'piston1', 'piston2', 'piston3', 'piston4', 'gasket', 'head', 'cam', 'camgear', 'chain', 'rockers', 'flywheel', 'starter', 'dist', 'plug1', 'plug2', 'plug3', 'plug4', 'wires', 'intake', 'carb', 'fpump'];
const BODY_REQ = ['battery', 'wiring', 'fuses', 'coil', 'tank', 'fuelline'];
const FALLABLE = new Set(['Body', 'Lights', 'Wheels', 'Exhaust', 'Cosmetic']);
const NICE = {
  crank: 'crankshaft', piston1: 'piston #1', piston2: 'piston #2', piston3: 'piston #3', piston4: 'piston #4', gasket: 'head gasket', head: 'cylinder head', cam: 'camshaft', camgear: 'cam gear', chain: 'timing chain', rockers: 'rocker shaft', flywheel: 'flywheel', starter: 'starter motor', dist: 'distributor', plug1: 'spark plug #1', plug2: 'spark plug #2', plug3: 'spark plug #3', plug4: 'spark plug #4', wires: 'plug wires', intake: 'intake manifold', carb: 'carburettor', fpump: 'fuel pump',
  battery: 'battery', wiring: 'wiring harness', fuses: 'fuse box', coil: 'ignition coil', tank: 'fuel tank', fuelline: 'fuel line',
};

// The player's project car: "Ruska 1300" with a full parts assembly system.
export class BuildCar extends Vehicle {
  constructor(game) {
    const cfg = {
      name: 'Ruska 1300', kind: 'car', mass: 900, com: [0, 0.36, 0.1], inertiaHalf: [0.8, 0.45, 2.0],
      colliders: [{ half: [0.78, 0.2, 2.0], pos: [0, 0.46, 0] }, { half: [0.64, 0.2, 0.9], pos: [0, 1.02, -0.25] }, { half: [0.74, 0.08, 0.6], pos: [0, 0.76, 1.4] }],
      wheels: [
        { pos: [WHEELS.track, 0.5, WHEELS.front], radius: 0.29, steer: true, drive: false, rest: 0.3, brakeBias: 1.15 },
        { pos: [-WHEELS.track, 0.5, WHEELS.front], radius: 0.29, steer: true, drive: false, rest: 0.3, brakeBias: 1.15 },
        { pos: [WHEELS.track, 0.5, WHEELS.rear], radius: 0.29, steer: false, drive: true, handbrake: true, rest: 0.3, brakeBias: 0.8 },
        { pos: [-WHEELS.track, 0.5, WHEELS.rear], radius: 0.29, steer: false, drive: true, handbrake: true, rest: 0.3, brakeBias: 0.8 },
      ],
      engine: { idle: 850, redline: 6400, torque: 108, peak: 3600, sound: { cylinders: 4, drive: 2.6, bodyFreq: 170 } },
      gears: [3.6, 2.15, 1.38, 1.0], reverse: 3.65, final: 4.11, maxSteer: 0.6, brake: 30, fuelCap: 36,
      seat: [0.36, 1.12, -0.18], exit: [1.6, 0.3, 0.1], camDist: 6.2, camHeight: 2.0, antiRoll: 0.4,
    };
    super(game, cfg);
    this.isBuildCar = true;
    this.parts = new Map();   // uid -> inst
    this.slots = {};          // slotId -> inst
    this.uidSeq = 1;
    this.onStands = true;
    this.paint = 0x8a2a1a;
    this.tuning = { afr: 14.7, timing: 10 };
    this.plates = null;
    this.registered = false;
    this.statsCache = null;
    this.dirty = true;
    this.vib = 0;
    this.buildModel();
    this.standRoot = new THREE.Group();
    game.scene.add(this.standRoot);
  }

  // ---------------------------------------------------------------- body model
  buildModel() {
    const spec = { ...SPECS.ruska, layout: { ...SPECS.ruska.layout, handles: 0 } };
    const body = buildBody(spec, { res: 0.028, panels: true });
    this.bodyGen = body.gen;
    const BM = bodyMats();
    this.paintMat = paintMaterial(this.paint);
    this.paintPlain = new THREE.MeshPhysicalMaterial({ color: this.paint, metalness: 0.35, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide });
    this.bodyMeshes = [];
    const shell = new THREE.Group();
    const add = (geo, mat, { shadow = true, order = 0, dent = false } = {}) => {
      if (!geo) return null;
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = shadow; m.receiveShadow = true; m.renderOrder = order;
      shell.add(m);
      if (dent) this.bodyMeshes.push(m);
      return m;
    };
    add(body.groups.paint, this.paintMat, { dent: true });
    add(body.capFront, this.paintMat, { dent: true });
    add(body.capRear, this.paintMat, { dent: true });
    add(body.groups.glass, BM.glass, { shadow: false, order: 5 });
    add(body.under, BM.under);
    for (const w of body.wells) add(w, BM.under);
    add(body.trims.chrome, BM.chrome);
    add(body.trims.black, BM.black);
    this.root.add(shell);
    this.shell = shell;
    mergeLocal(shell);
    this.bodyMeshes = shell.children.filter((m) => m.material === this.paintMat);
    this.panelGeos = {};
    for (const t of PANEL_TYPES) {
      const [g, c] = centreGeo(body.panels[t]);
      this.panelGeos[t] = { geo: g, centre: c };
    }
    this.addStaticDetail();
  }

  addStaticDetail() {
    const P = partMats(), M = mats(), DM = D.detailMats(), gen = this.bodyGen;
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7, metalness: 0.3 });
    const detail = new THREE.Group(); this.root.add(detail);
    const add = (g, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; detail.add(o); return o; };
    // engine bay: firewall, inner fenders, strut towers, radiator support, cowl vent
    add(new THREE.BoxGeometry(1.42, 0.5, 0.03), this.paintPlain, 0, 0.56, 0.92);
    for (const s of [1, -1]) {
      add(new THREE.BoxGeometry(0.03, 0.36, 1.05), this.paintPlain, s * 0.67, 0.56, 1.46);
      add(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 14), this.paintPlain, s * 0.6, 0.6, 1.22);
    }
    add(new THREE.BoxGeometry(1.3, 0.06, 0.05), this.paintPlain, 0, 0.76, 1.97);
    add(new THREE.BoxGeometry(1.3, 0.06, 0.05), this.paintPlain, 0, 0.36, 1.97);
    const vent = add(new THREE.BoxGeometry(1.1, 0.012, 0.05), DM.black, 0, 0.875, 0.915);
    for (let i = 0; i < 18; i++) add(new THREE.BoxGeometry(0.008, 0.014, 0.05), DM.chrome, -0.52 + i * 0.061, 0.878, 0.915);
    // wipers lying at the base of the windshield
    for (const x of [0.42, -0.08]) { const w = D.wiper(0.46); w.position.set(x, 0.885, 0.875); w.rotation.set(-0.55, Math.PI, 0); detail.add(w); }
    // interior: carpet, tunnel, headliner, pedals, handbrake, sun visors, rear-view mirror, door sills
    add(new THREE.BoxGeometry(1.44, 0.02, 2.3), P.carpet, 0, 0.255, -0.25);
    add(new THREE.BoxGeometry(0.26, 0.16, 1.8), P.carpet, 0, 0.33, -0.1);
    add(new THREE.BoxGeometry(1.12, 0.012, 0.92), new THREE.MeshStandardMaterial({ color: 0xd8d0bc, roughness: 1 }), 0, 1.272, -0.1);
    for (const [x, h, w] of [[0.5, 0.0, 0.07], [0.38, 0.02, 0.07], [0.26, 0.0, 0.1]]) { add(new THREE.BoxGeometry(w, 0.1, 0.02), DM.rubber, x, 0.4 + h, 0.68, 0.5); add(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6), DM.chrome, x, 0.5 + h, 0.72, 0.4); }
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 6), dark, 0.1, 0.45, -0.18, -1.1);
    add(new THREE.BoxGeometry(0.035, 0.03, 0.07), DM.plastic, 0.1, 0.56, -0.12, -1.1);
    for (const x of [0.34, -0.34]) { const v = add(new THREE.BoxGeometry(0.3, 0.012, 0.12), new THREE.MeshStandardMaterial({ color: 0xc8c0b0, roughness: 1 }), x, 1.258, 0.29, 0.08); }
    add(new THREE.BoxGeometry(0.2, 0.055, 0.02), DM.plastic, 0, 1.215, 0.31);
    add(new THREE.BoxGeometry(0.18, 0.042, 0.004), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.02 }), 0, 1.215, 0.298);
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), DM.chrome, 0, 1.24, 0.3);
    // gear lever boot
    add(new THREE.ConeGeometry(0.06, 0.08, 12), DM.rubber, 0, 0.44, 0.18);
    // trunk floor & spare wheel
    add(new THREE.BoxGeometry(1.3, 0.02, 0.62), P.carpet, 0, 0.5, -1.7);
    const spare = D.wheel('hubcap', 0.29, 0.168); spare.rotation.z = Math.PI / 2; spare.position.set(0.25, 0.62, -1.7); spare.scale.setScalar(0.92); detail.add(spare);
    // badges and script on the rear panel
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.06), new THREE.MeshStandardMaterial({ map: badgeTex(), transparent: true, metalness: 0.9, roughness: 0.2 }));
    badge.position.set(-0.3, 0.83, -2.088); badge.rotation.y = Math.PI; detail.add(badge);
    const gt = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.04), new THREE.MeshStandardMaterial({ map: scriptTex('1300 GT'), transparent: true, metalness: 0.9, roughness: 0.2 }));
    const fp = gen.S(1.62, 0.36), fn = gen.normal(1.62, 0.36);
    gt.position.set(fp.x + fn.x * 0.003, fp.y, fp.z); gt.rotation.y = Math.PI / 2; this.fenderBadgeL = gt;
    // antenna
    add(new THREE.CylinderGeometry(0.003, 0.004, 0.75, 5), DM.chrome, -0.7, 1.15, 1.55);
    // exhaust tip
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 14, 1, true), DM.chrome, 0.38, 0.27, -2.08, Math.PI / 2);
    // fuel filler cap (left rear quarter)
    const cp = gen.S(-1.58, 0.42), cn = gen.normal(-1.58, 0.42);
    const cap = add(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 20), DM.chrome, cp.x + cn.x * 0.004, cp.y, cp.z, 0, 0, Math.PI / 2);
    mergeLocal(detail);
    // contact shadow
    this.root.add(contactShadow(1.9, 4.5));
  }

  setPaint(color) {
    this.paint = color;
    this.paintMat.color.setHex(color);
    this.paintPlain.color.setHex(color);
    for (const inst of this.parts.values()) if (inst.panel && inst.mesh.userData.paintMat) inst.mesh.userData.paintMat.color.setHex(color);
  }

  // ---------------------------------------------------------------- part instances
  defOf(defId) {
    if (defId.startsWith('panel:')) {
      const t = defId.slice(6), info = PANEL_INFO[t];
      const bb = this.panelGeos[t].geo.boundingBox;
      const half = [Math.max(0.02, (bb.max.x - bb.min.x) / 2), Math.max(0.02, (bb.max.y - bb.min.y) / 2), Math.max(0.02, (bb.max.z - bb.min.z) / 2)];
      return { type: t, name: info.name, price: info.price, mass: info.mass, bolts: info.bolts, half, cat: 'Body', build: () => this.buildPanel(t), panel: true };
    }
    return PARTS[defId];
  }
  buildPanel(t) {
    const g = new THREE.Group();
    const mat = paintMaterial(this.paint);
    const m = new THREE.Mesh(this.panelGeos[t].geo, mat); m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    g.userData.paintMat = mat;
    const c = this.panelGeos[t].centre, gen = this.bodyGen, DM = D.detailMats();
    const at = (z, tt, side, off = 0) => { const p = gen.S(z, tt), n = gen.normal(z, tt); return new THREE.Vector3(p.x * side + n.x * side * off, p.y + n.y * off, p.z + n.z * off).sub(c); };
    if (t.startsWith('door')) {
      const s = t === 'doorL' ? 1 : -1;
      // inner door card with armrest and window winder
      const card = new THREE.Mesh(roundBoxGeo(0.03, 0.44, 1.2), partMats().vinyl);
      card.position.copy(at(0.2, 0.3, s, -0.06)); g.add(card);
      const arm = new THREE.Mesh(roundBoxGeo(0.07, 0.05, 0.36), DM.plastic); arm.position.copy(at(0.05, 0.35, s, -0.1)); g.add(arm);
      const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 14), DM.chrome); crank.rotation.z = Math.PI / 2; crank.position.copy(at(0.1, 0.26, s, -0.09)); g.add(crank);
      // exterior pull handle and key lock near the rear edge
      const hg = new THREE.CapsuleGeometry(0.012, 0.11, 3, 8); hg.rotateX(Math.PI / 2);
      const h = new THREE.Mesh(hg, DM.chrome); h.position.copy(at(-0.33, 0.455, s, 0.012)); g.add(h);
      const key = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.01, 10), DM.chrome); key.rotation.z = Math.PI / 2; key.position.copy(at(-0.2, 0.455, s, 0.006)); g.add(key);
    }
    if (t === 'fenderL' && this.fenderBadgeL) { const b = this.fenderBadgeL.clone(); b.position.sub(c); g.add(b); }
    if (t.startsWith('fender')) {
      const s = t === 'fenderL' ? 1 : -1;
      const ind = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), DM.amber);
      ind.scale.set(1, 0.5, 1.5); ind.rotation.z = -s * Math.PI / 2; ind.position.copy(at(1.82, 0.32, s, 0.001)); g.add(ind);
    }
    if (t === 'trunk') {
      const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 14), DM.chrome); lock.rotation.x = Math.PI / 2; lock.position.copy(at(-2.05, 0.995, 1, 0.004)); g.add(lock);
    }
    if (t === 'hood') {
      const orn = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.07), DM.chrome); orn.position.copy(at(1.98, 1.0, 1, 0.005)); g.add(orn);
    }
    return g;
  }

  createPart(defId, { cond = 1, data = {}, uid = null } = {}) {
    const def = this.defOf(defId);
    if (!def) { console.warn('no part', defId); return null; }
    const inst = { uid: uid ?? this.uidSeq++, defId, def, slot: null, cond, tight: 0, data: { ...data }, panel: !!def.panel };
    if (uid) this.uidSeq = Math.max(this.uidSeq, uid + 1);
    inst.mesh = def.build(inst);
    mergeLocal(inst.mesh);
    inst.mesh.userData.partInst = inst;
    inst.mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.partInst = inst; } });
    if (defId.startsWith('panel:') && this.paint !== undefined && inst.mesh.userData.paintMat) inst.mesh.userData.paintMat.color.setHex(data.color ?? this.paint);
    this.parts.set(inst.uid, inst);
    this.applyCondVisual(inst);
    return inst;
  }
  maxTight(inst) { return Math.max(1, inst.def.bolts * 8); }
  tightFrac(inst) { return inst.def.bolts === 0 ? 1 : inst.tight / this.maxTight(inst); }

  // spawn a part loose in the world
  spawnLoose(inst, pos, rot = null, vel = null) {
    this.game.scene.add(inst.mesh);
    inst.mesh.position.copy(pos);
    if (rot) inst.mesh.quaternion.copy(rot);
    inst.ent = this.game.items.spawn(null, pos, { part: inst, rot: rot ? { x: rot.x, y: rot.y, z: rot.z, w: rot.w } : null, vel });
    return inst;
  }

  // ---------------------------------------------------------------- slots
  slotPos(slotId) {
    const s = SLOTS[slotId];
    if (!s.pos) { const t = slotId; return this.panelGeos[t].centre.toArray(); }
    return s.pos;
  }
  parentInst(slotId) {
    const s = SLOTS[slotId];
    if (s.parent === 'root' || s.parent === 'stand') return null;
    if (s.parent === 'engine*') return this.slots.engine || this.slots.stand || null;
    return this.slots[s.parent] || null;
  }
  parentObj(slotId) {
    const s = SLOTS[slotId];
    if (s.parent === 'root') return this.root;
    if (s.parent === 'stand') return this.standRoot;
    const p = this.parentInst(slotId);
    return p ? p.mesh : null;
  }
  blockInCar() { return !!this.slots.engine; }
  slotAvailable(slotId, inst) {
    const s = SLOTS[slotId];
    if (this.slots[slotId]) return false;
    if (!s.accepts.includes(inst.def.type)) return false;
    if (s.parent !== 'root' && s.parent !== 'stand' && !this.parentInst(slotId)) return false;
    if (s.req) for (const r of s.req) {
      if (!this.slots[r]) return false;
      // engine-dependent body slots need the engine in the car
      if ((r === 'gearbox' || r === 'header') && !this.blockInCar()) return false;
    }
    if (slotId === 'stand' && this.slots.stand) return false;
    if (slotId === 'stand' || slotId === 'engine') return false; // block moved only with the hoist
    return true;
  }
  slotWorld(slotId, out = new THREE.Vector3()) {
    const obj = this.parentObj(slotId);
    if (!obj) return null;
    obj.updateMatrixWorld(true);
    return out.set(...this.slotPos(slotId)).applyMatrix4(obj.matrixWorld);
  }
  // slot for a held part: either the part is close to it, or the player is looking right at it
  findSlotView(inst, origin, dir, heldPos) {
    let best = null, bs = 1e9;
    for (const sid of Object.keys(SLOTS)) {
      if (!this.slotAvailable(sid, inst)) continue;
      const w = this.slotWorld(sid, _v);
      if (!w) continue;
      let score = 1e9;
      const dh = w.distanceTo(heldPos);
      if (dh < 0.6) score = dh;
      _v2.copy(w).sub(origin);
      const along = _v2.dot(dir);
      if (along > 0.15 && along < 2.6) { const perp = _v2.addScaledVector(dir, -along).length(); if (perp < 0.3) score = Math.min(score, 0.05 + perp * 1.5); }
      if (score < bs) { bs = score; best = sid; }
    }
    return best;
  }
  // find best slot for a held part near position
  findSlot(inst, worldPos, maxDist = 0.55) {
    let best = null, bd = maxDist;
    for (const sid of Object.keys(SLOTS)) {
      if (!this.slotAvailable(sid, inst)) continue;
      const w = this.slotWorld(sid, _v);
      if (!w) continue;
      const d = w.distanceTo(worldPos);
      if (d < bd) { bd = d; best = sid; }
    }
    return best;
  }

  attach(inst, slotId, { silent = false, tight = 0 } = {}) {
    if (inst.ent) { this.game.items.detachPhysics(inst.ent); inst.ent = null; }
    const parent = this.parentObj(slotId);
    parent.add(inst.mesh);
    inst.mesh.position.set(...this.slotPos(slotId));
    const r = SLOTS[slotId].rot || [0, 0, 0];
    inst.mesh.rotation.set(r[0], r[1], r[2]);
    inst.mesh.scale.set(1, 1, 1);
    inst.slot = slotId; inst.tight = tight; inst.hingeA = 0; inst.hingeOpen = false; inst._hingeMoved = false;
    this.slots[slotId] = inst;
    this.dirty = true;
    if (!silent) { audio.play('clunk', this.slotWorld(slotId, _v), 0.6); this.game.stats.partsAttached = (this.game.stats.partsAttached || 0) + 1; }
    this.applyCondVisual(inst);
    this.game.actions?.partAttached?.(inst, slotId);
  }

  childrenOf(slotId) {
    const out = [];
    for (const [sid, s] of Object.entries(SLOTS)) {
      if (!this.slots[sid]) continue;
      let parentSlot = s.parent;
      if (parentSlot === 'engine*') parentSlot = this.slots.engine ? 'engine' : 'stand';
      if (parentSlot === slotId || (s.req && s.req.includes(slotId))) out.push(sid);
    }
    return out;
  }

  canDetach(inst) {
    if (!inst.slot) return { ok: false };
    if (inst.slot === 'engine' || inst.slot === 'stand') return { ok: false, why: 'Use the engine hoist to move the engine.' };
    if (this.tightFrac(inst) > 0 && inst.def.bolts > 0) return { ok: false, why: 'Loosen all the bolts first.' };
    const ch = this.childrenOf(inst.slot);
    if (ch.length) return { ok: false, why: `Remove ${this.slots[ch[0]].def.name} first.` };
    return { ok: true };
  }

  detach(inst, { vel = null, spawn = true } = {}) {
    const slotId = inst.slot;
    const obj = inst.mesh;
    obj.updateMatrixWorld(true);
    const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
    obj.getWorldPosition(wp); obj.getWorldQuaternion(wq);
    obj.removeFromParent();
    this.slots[slotId] = null;
    inst.slot = null; inst.tight = 0;
    this.dirty = true;
    if (spawn) this.spawnLoose(inst, wp, wq, vel);
    audio.play('metal', wp, 0.5);
    this.game.actions?.partDetached?.(inst, slotId);
    return inst;
  }

  // wrench: dir +1 tighten / -1 loosen
  wrench(inst, dir) {
    if (!inst.slot || inst.def.bolts === 0) return false;
    const max = this.maxTight(inst);
    const step = this.game.state.ratchet ? 2 : 1;
    const before = inst.tight;
    inst.tight = clamp(inst.tight + dir * step, 0, max);
    if (inst.tight === before) return false;
    const p = inst.mesh.getWorldPosition(_v);
    if (Math.floor(inst.tight / 8) !== Math.floor(before / 8) && dir > 0) audio.play('boltTight', p);
    else audio.play('ratchet', p);
    if (inst.tight === max && dir > 0) this.game.actions?.partBolted?.(inst);
    this.dirty = true;
    this.game.player.n.dirt = Math.min(100, this.game.player.n.dirt + 0.02);
    return true;
  }

  applyCondVisual(inst) {
    // dents/darken with low condition
    const c = inst.cond;
    if (c < 0.6 && !inst._dented) {
      inst._dented = true;
      inst.mesh.traverse((o) => {
        if (!o.isMesh || !o.material || o.userData.dentMat) return;
        o.material = o.material.clone(); o.userData.dentMat = true;
        if (o.material.color) o.material.color.multiplyScalar(0.55 + c * 0.6);
        if (o.material.roughness !== undefined) o.material.roughness = Math.min(1, o.material.roughness + 0.3);
      });
      if (c < 0.35) inst.mesh.rotation.z += rand(-0.08, 0.08);
    }
  }

  // ---------------------------------------------------------------- fluids & electrics
  get fuel() { return this.slots?.tank ? (this.slots.tank.data.fuel ?? 0) : 0; }
  set fuel(v) { if (this.slots?.tank) this.slots.tank.data.fuel = v; }
  get oil() { const b = this.slots?.engine || this.slots?.stand; return b ? (b.data.oil ?? 0) : 0; }
  set oil(v) { const b = this.slots.engine || this.slots.stand; if (b) b.data.oil = v; }
  get coolant() { return this.slots?.radiator ? (this.slots.radiator.data.coolant ?? 0) : 0; }
  set coolant(v) { if (this.slots.radiator) this.slots.radiator.data.coolant = v; }
  get brakeFluid() { return this.slots?.brakemaster ? (this.slots.brakemaster.data.fluid ?? 0) : 0; }
  set brakeFluid(v) { if (this.slots.brakemaster) this.slots.brakemaster.data.fluid = v; }
  batteryLevel() { const b = this.slots.battery; return b ? (b.data.charge ?? 0) : 0; }
  batteryOk() { return this.electricsOk() && this.batteryLevel() > 0.18; }
  drainBattery(dt) { const b = this.slots.battery; if (b) b.data.charge = Math.max(0, (b.data.charge ?? 0) - dt * 0.012); }
  electricsOk() { return !!(this.slots.battery && this.slots.wiring && this.slots.fuses && this.tightFrac(this.slots.wiring) > 0.5); }

  // ---------------------------------------------------------------- stats
  engineStats() {
    if (!this.dirty && this.statsCache) return this.statsCache;
    this.dirty = false;
    const s = { torque: 108, peak: 3600, redline: 6400, idle: 850, gears: [3.6, 2.15, 1.38, 1.0], reverse: 3.65, final: 4.11, brake: 6, misfire: 0, exhaust: 0.3, turbo: 0, heat: 0, rough: 0, grip: 1, gravel: 1, steer: 1, safety: 0 };
    const sl = this.slots;
    let power = 1;
    for (const inst of this.parts.values()) {
      if (!inst.slot || !inst.def.stats) continue;
      const st = inst.def.stats;
      if (st.power) power += st.power;
      if (st.peak) s.peak += st.peak;
      if (st.turbo) s.turbo += st.turbo;
      if (st.heat) s.heat += st.heat;
      if (st.rough) s.rough += st.rough;
      if (st.safety) s.safety += st.safety;
    }
    if (sl.gearbox?.def.stats) { s.gears = sl.gearbox.def.stats.gears; s.reverse = sl.gearbox.def.stats.reverse; }
    if (sl.axle?.def.stats) s.final = sl.axle.def.stats.final;
    // exhaust loudness
    s.exhaust = !sl.header ? 1.0 : !sl.pipe ? 0.95 : !sl.muffler ? 0.85 : (sl.muffler.def.stats?.exhaust ?? 0) + 0.25;
    if (sl.header?.def.stats?.exhaust) s.exhaust += sl.header.def.stats.exhaust;
    // tuning
    const afr = this.tuning.afr, tim = this.tuning.timing;
    power *= 1 - Math.min(0.6, ((afr - 12.9) ** 2) * 0.035);
    power *= 1 - Math.min(0.5, ((tim - 12) / 12) ** 2 * 0.35);
    // condition of internals
    const cond = ['crank', 'piston1', 'piston2', 'piston3', 'piston4', 'head', 'gasket', 'cam'].map((k) => sl[k]?.cond ?? 0);
    const avg = cond.reduce((a, b) => a + b, 0) / cond.length;
    power *= 0.35 + 0.65 * avg;
    // misfire from plugs / loose parts
    let mis = 0;
    for (const k of ['plug1', 'plug2', 'plug3', 'plug4']) { const p = sl[k]; if (!p) mis += 0.25; else mis += (1 - p.cond) * 0.12 + (1 - this.tightFrac(p)) * 0.15; }
    if (sl.carb) mis += (1 - this.tightFrac(sl.carb)) * 0.2;
    if (sl.head) mis += (1 - this.tightFrac(sl.head)) * 0.25;
    if (sl.gasket && sl.gasket.cond < 0.3) mis += 0.2;
    if (afr > 16.5 || afr < 11) mis += 0.15;
    if (sl.carb?.def.variant === 'race' && !sl.airfilter) mis += 0.02;
    s.misfire = clamp(mis + s.rough * 0.3, 0, 0.8);
    s.torque = 108 * power * (1 - s.misfire * 0.6);
    s.redline = 6400 + Math.max(0, s.peak - 3600) * 0.6;
    if (s.turbo) s.redline = Math.min(s.redline, 6800);
    // brakes
    let brake = 0;
    const fluidOk = sl.brakemaster && this.brakeFluid > 0.08;
    if (fluidOk) {
      const fr = (sl.caliperFL ? 1 : 0) + (sl.caliperFR ? 1 : 0), rr = (sl.drumRL ? 1 : 0) + (sl.drumRR ? 1 : 0);
      brake = 34 * (fr * 0.3 + rr * 0.2);
      let sport = 0; for (const k of ['discFL', 'discFR', 'caliperFL', 'caliperFR']) sport += sl[k]?.def.stats?.brake || 0;
      brake *= 1 + sport;
    }
    s.brake = Math.max(3, brake);
    // wheels / tyres
    let grip = 0, gravel = 0, nw = 0;
    for (const k of ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR']) { const w = sl[k]; if (w) { grip += w.def.stats.grip; gravel += w.def.stats.gravel; nw++; } }
    s.grip = nw ? grip / nw : 1; s.gravel = nw ? gravel / nw : 1;
    s.steer = sl.swheel?.def.stats?.steer || 1;
    this.statsCache = s;
    this.updatePhysicsFromParts();
    return s;
  }

  updatePhysicsFromParts() {
    if (!this.controller) return;
    const sl = this.slots;
    // mass
    let m = 520;
    for (const inst of this.parts.values()) if (inst.slot && inst.slot !== 'stand' && !this.isOnStandSubtree(inst)) m += inst.def.mass || 0;
    if (Math.abs(m - this.mass) > 3) this.setMass(m);
    // suspension
    const vc = this.controller;
    for (let i = 0; i < 4; i++) {
      const front = i < 2, side = i % 2 === 0 ? 'L' : 'R';
      const spr = front ? sl[`strutF${side}`] : sl[`springR${side}`];
      const damper = front ? sl[`strutF${side}`] : sl[`shockR${side}`];
      const st = spr?.def.stats || {};
      const stiff = (spr ? 30 : 8) * (st.stiff || 1);
      vc.setWheelSuspensionStiffness(i, stiff);
      vc.setWheelSuspensionCompression(i, damper ? 2.6 * (st.stiff || 1) : 0.6);
      vc.setWheelSuspensionRelaxation(i, damper ? 3.4 * (st.stiff || 1) : 0.8);
      vc.setWheelMaxSuspensionTravel(i, 0.2 * (st.travel || 1));
      const rest = 0.3 + (st.height || 0);
      vc.setWheelSuspensionRestLength(i, rest);
      this.cfg.wheels[i].rest = rest;
      const w = sl[['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'][i]];
      this.cfg.wheels[i].radius = w ? w.def.stats.radius : 0.29;
    }
  }
  isOnStandSubtree(inst) {
    if (!this.slots.stand) return false;
    let o = inst.mesh;
    while (o) { if (o === this.standRoot) return true; o = o.parent; }
    return false;
  }

  gripMul(i, surf) {
    const s = this.statsCache || this.engineStats();
    const w = this.slots[['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'][i]];
    let g = surf === 'gravel' || surf === 'terrain' ? s.gravel : s.grip;
    if (w) g *= 0.5 + 0.5 * w.cond;
    return g;
  }
  wheelOk(i) {
    const k = ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'][i];
    const hub = ['discFL', 'discFR', 'drumRL', 'drumRR'][i];
    const sup = ['strutFL', 'strutFR', 'axle', 'axle'][i];
    return !!(this.slots[k] && this.slots[hub] && this.slots[sup]);
  }
  get drivable() { return !this.onStands; }

  // reasons the engine won't start
  startProblems() {
    const p = [];
    const sl = this.slots;
    if (!sl.engine) return ['no engine in the car'];
    for (const k of ENGINE_REQ) if (!sl[k]) p.push(`missing ${NICE[k] || k}`);
    for (const k of BODY_REQ) if (!sl[k]) p.push(`missing ${NICE[k] || k}`);
    if (sl.engine && this.tightFrac(sl.engine) < 0.5) p.push('engine mounts are loose');
    if (this.fuel <= 0.05) p.push('no fuel');
    if (sl.crank && sl.crank.cond < 0.05) p.push('engine seized');
    if (sl.piston1 && [1, 2, 3, 4].some((i) => (sl[`piston${i}`]?.cond ?? 1) < 0.05)) p.push('broken piston');
    if (sl.head && this.tightFrac(sl.head) < 0.4) p.push('no compression (loose head)');
    if (sl.plug1 && [1, 2, 3, 4].filter((i) => (sl[`plug${i}`]?.cond ?? 0) > 0.15).length < 2) p.push('spark plugs worn out');
    if (this.tuning.afr > 18 || this.tuning.afr < 9.5) p.push('carburettor mixture way off');
    if (this.tuning.timing < -5 || this.tuning.timing > 30) p.push('ignition timing way off');
    return p;
  }
  startTime() {
    let t = 0.6 + rand(0, 0.5);
    if (this.engineTemp < 40 && !this.choke) t += 1.6 + rand(0, 1.5);
    const s = this.engineStats(); t += s.misfire * 3;
    return t;
  }
  onStart() {
    this.game.actions?.carStarted?.(this);
    if (this.statsCache?.misfire > 0.2) audio.play('backfire', this.pos);
  }

  // ---------------------------------------------------------------- simulation
  physicsStep(dt) {
    if (this.onStands) return;
    // steering & drive availability
    const sl = this.slots;
    const steerOk = sl.rack && sl.column && sl.swheel;
    if (!steerOk) this.steer = Math.sin(performance.now() / 300) * 0.05;
    const driveOk = sl.gearbox && sl.driveshaft && sl.axle && this.blockInCar() && sl.clutchplate;
    const savedGear = this.gear;
    if (!driveOk) this.gear = 0;
    super.physicsStep(dt);
    this.gear = savedGear;
  }

  hingeOf(inst) {
    const t = inst?.def?.type;
    if (!inst?.def?.panel || HINGED[t] === undefined || inst.slot !== t) return null;
    const bb = this.panelGeos[t].geo.boundingBox;
    if (t === 'hood') return { axis: new THREE.Vector3(1, 0, 0), H: new THREE.Vector3(0, bb.max.y, bb.min.z), open: HINGED[t] };
    if (t === 'trunk') return { axis: new THREE.Vector3(1, 0, 0), H: new THREE.Vector3(0, bb.max.y, bb.max.z), open: HINGED[t] };
    return { axis: new THREE.Vector3(0, 1, 0), H: new THREE.Vector3(t === 'doorL' ? bb.max.x : bb.min.x, 0, bb.max.z), open: HINGED[t] };
  }
  toggleHinge(inst) {
    const h = this.hingeOf(inst); if (!h) return;
    inst.hingeOpen = !inst.hingeOpen; inst.hingeA = inst.hingeA || 0;
    tween(inst, 'hingeA', inst.hingeOpen ? h.open : 0, 0.7);
    audio.play(inst.hingeOpen ? 'creak' : 'door', this.slotWorld(inst.slot, _hv), 0.7);
  }
  updateHinges() {
    for (const t in HINGED) {
      const inst = this.slots[t];
      if (!inst || (!inst.hingeA && !inst._hingeMoved)) continue;
      const h = this.hingeOf(inst); if (!h) continue;
      const c = this.panelGeos[t].centre;
      _hq.setFromAxisAngle(h.axis, inst.hingeA || 0);
      _hv.copy(h.H).applyQuaternion(_hq);
      inst.mesh.position.copy(c).add(h.H).sub(_hv);
      inst.mesh.quaternion.copy(_hq);
      inst._hingeMoved = !!inst.hingeA;
    }
  }
  update(dt) {
    this.updateHinges();
    if (this.onStands && this.body) {
      // keep fixed body visuals in place
    }
    super.update(dt);
    if (!this.body) return;
    const sl = this.slots;
    const s = this.engineStats();
    const P = this.game.player;
    // wheels visuals: use part meshes
    // engine temperature
    if (this.engineOn) {
      const coolOk = sl.radiator && this.coolant > 0.5 && sl.hoseU && sl.hoseL && sl.wpump && sl.belt;
      const fan = sl.fan ? 1 : 0.6;
      const heat = 0.9 + this.throttle * 1.4 * (1 + s.turbo + s.heat) + (this.tuning.afr > 15.5 ? 0.5 : 0);
      const cool = coolOk ? (0.5 + 0.5 * this.coolant / 5) * (0.6 + 0.4 * fan + Math.min(0.4, this.speedKmh / 150)) * 2.2 : 0.08;
      this.engineTemp += (heat - cool * Math.max(0, this.engineTemp - 20) / 60) * dt * 1.6;
      // leaks
      if (sl.radiator && (!sl.hoseU || !sl.hoseL)) this.coolant = Math.max(0, this.coolant - dt * 0.4);
      if (!sl.oilpan) this.oil = 0;
      else if (this.tightFrac(sl.oilpan) < 0.6) this.oil = Math.max(0, this.oil - dt * 0.01);
      if (!sl.rcover && this.rpm > 1500) { this.oil = Math.max(0, this.oil - dt * 0.03); this.oilSpray = true; }
      this.oil = Math.max(0, this.oil - dt * 0.00002 * this.rpm / 1000);
      // damage models
      const wear = (k, amt) => { const p = sl[k]; if (p) p.cond = Math.max(0, p.cond - amt); };
      if (this.oil < 0.6) { const a = dt * 0.004 * (this.rpm / 2000) * (0.6 - this.oil) * 4; for (const k of ['crank', 'piston1', 'piston2', 'piston3', 'piston4', 'cam']) wear(k, a); }
      if (this.engineTemp > 115) { wear('gasket', dt * 0.01 * (this.engineTemp - 115) / 10); this.overheat = true; }
      else this.overheat = false;
      if (this.engineTemp > 135) for (const k of ['piston1', 'piston2', 'piston3', 'piston4', 'head']) wear(k, dt * 0.004);
      if (this.tuning.afr > 15.8 && this.throttle > 0.6) for (const k of ['piston1', 'piston2', 'piston3', 'piston4']) wear(k, dt * 0.002);
      const hc = [1, 2, 3, 4].some((i) => sl[`piston${i}`]?.def.variant === 'hc');
      if (hc && this.tuning.timing > 16 && this.throttle > 0.5) { for (const k of ['piston1', 'piston2', 'piston3', 'piston4']) wear(k, dt * 0.003); if (Math.random() < dt * 2) audio.play('click', this.pos); }
      for (const k of ['plug1', 'plug2', 'plug3', 'plug4']) wear(k, dt * 0.00003 * (this.tuning.afr < 12 ? 6 : 1));
      if (s.turbo) wear('head', dt * 0.00005 * this.throttle);
      if (sl.crank && sl.crank.cond < 0.05) { this.engineOn = false; this.game.ui.toast('*CLUNK* The engine seized. No oil!'); this.game.achieve('seized', 'Dry Run', 'Seized an engine by forgetting the oil'); }
      if ([1, 2, 3, 4].some((i) => (sl[`piston${i}`]?.cond ?? 1) < 0.05)) { this.engineOn = false; this.game.ui.toast('BANG! A piston let go.'); }
      // charging
      if (sl.battery && sl.alt && sl.belt) sl.battery.data.charge = Math.min(1, (sl.battery.data.charge ?? 0) + dt * 0.004);
      this.dirty = this.dirty || Math.random() < dt; // refresh stats sometimes (wear)
      // engine vibration on the block
      this.vib += dt * this.rpm / 60 * 6.28;
      const blk = sl.engine?.mesh;
      if (blk) { const a = (0.0015 + s.misfire * 0.004) * (this.rpm < 1100 ? 1.5 : 1); blk.position.y = SLOTS.engine.pos[1] + Math.sin(this.vib) * a; blk.rotation.z = Math.sin(this.vib * 0.5) * a * 2; }
      // backfire pops
      if (s.misfire > 0.25 && Math.random() < dt * s.misfire * 2) audio.play('backfire', this.pos);
      // turbo blowoff
      if (s.turbo && this._lastThrottle > 0.7 && this.throttle < 0.2 && (this.boost || 0) > 0.15) audio.play('blowoff', this.pos);
      // smoke
      const ex = this.toWorld(_v.set(0.33, 0.2, -2.15));
      if (Math.random() < dt * (4 + this.throttle * 20)) {
        let col = 0x777777, a = 0.08;
        if (this.engineTemp < 45) { col = 0xdddddd; a = 0.15; }
        if (this.tuning.afr < 12.2) { col = 0x111111; a = 0.25 * this.throttle + 0.05; }
        if (this.overheat || (sl.gasket && sl.gasket.cond < 0.3)) { col = 0xeeeeee; a = 0.35; }
        const worn = 1 - (sl.piston1?.cond ?? 1);
        if (worn > 0.5) { col = 0x7088a0; a = 0.25; }
        this.game.particles.emit(ex, { color: col, alpha: a, size: 0.25, grow: 1.6, life: 2, vel: _v2.set(rand(-0.3, 0.3), 0.4, rand(-0.6, -0.2)).applyQuaternion(this.quat) });
      }
      if (this.overheat || this.oilSpray) {
        if (Math.random() < dt * 8) this.game.particles.emit(this.toWorld(_v.set(0, 0.95, 1.4)), { color: 0xffffff, alpha: 0.3, size: 0.3, grow: 2, life: 1.5, vel: _v2.set(0, 1.2, 0) });
      }
      this.oilSpray = false;
    } else {
      this.engineTemp = Math.max(this.game.sky.daylight > 0.5 ? 18 : 12, this.engineTemp - dt * 0.15);
      if (this.lights && sl.battery) sl.battery.data.charge = Math.max(0, (sl.battery.data.charge ?? 0) - dt * 0.0015);
    }
    this._lastThrottle = this.throttle;
    // loose parts fall off / wobble
    if (!this.onStands && this.speedKmh > 5) this.vibrateLooseParts(dt);
    // wheel visuals follow suspension (attached wheel meshes are children of root at slot pos)
    this.updateWheelMeshes();
    this.updateGauges();
    this.updateLights();
    // dust from tyres on gravel
    if (this.speedKmh > 25 && this.surfaces.some((x) => x === 'gravel' || x === 'terrain') && Math.random() < dt * this.speedKmh / 8) {
      const back = this.toWorld(_v.set(rand(-0.7, 0.7), 0.1, -1.9));
      this.game.particles.emit(back, { color: 0xb8a888, alpha: 0.18, size: 0.6, grow: 3, life: 2.2, vel: _v2.set(rand(-0.5, 0.5), 0.6, rand(-0.5, 0.5)) });
    }
  }

  vibrateLooseParts(dt) {
    const shake = this.speedKmh / 80 + (this.surfaces.some((s) => s === 'gravel' || s === 'terrain') ? 0.4 : 0);
    for (const inst of this.parts.values()) {
      if (!inst.slot || inst.slot === 'stand' || inst.def.bolts === 0) continue;
      const f = this.tightFrac(inst);
      if (f >= 0.999) continue;
      const fallable = FALLABLE.has(inst.def.cat) || inst.slot.startsWith('wheel') || inst.slot === 'battery' || inst.slot === 'airfilter' || inst.slot === 'radiator';
      // wobble visual
      inst.mesh.position.y = this.slotPos(inst.slot)[1] + Math.sin(performance.now() / 40 + inst.uid) * 0.004 * (1 - f) * shake;
      if (fallable && this.childrenOf(inst.slot).length === 0) {
        const p = (1 - f) ** 2 * shake * dt * 0.12;
        if (Math.random() < p) {
          const v = this.body.linvel();
          this.detach(inst, { vel: { x: v.x * 0.9, y: v.y + 1, z: v.z * 0.9 } });
          this.game.ui.toast(`Something fell off... (${inst.def.name})`);
          this.game.stats.partsLost = (this.game.stats.partsLost || 0) + 1;
          if (inst.def.type === 'wheel') this.game.achieve('wheeloff', 'Unicycle Mode', 'Lost a wheel while driving');
        }
      }
      if (inst.def.type === 'wheel' && f < 0.9) this.steer += Math.sin(performance.now() / 60) * 0.02 * (1 - f) * shake;
    }
  }

  updateWheelMeshes() {
    const vc = this.controller;
    ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'].forEach((k, i) => {
      const inst = this.slots[k];
      const hubKey = ['discFL', 'discFR', 'drumRL', 'drumRR'][i];
      const sl = this.onStands ? 0.3 : (vc.wheelSuspensionLength(i) ?? 0.3);
      const w = this.cfg.wheels[i];
      const y = w.pos[1] - sl;
      const steer = w.steer ? this.steer : 0;
      const base = SLOTS[k].rot ? SLOTS[k].rot[1] : 0;
      for (const [key, ex] of [[k, 0], [hubKey, 0], [i < 2 ? `caliperF${k.endsWith('L') ? 'L' : 'R'}` : null, 0]]) {
        if (!key) continue;
        const pi = this.slots[key];
        if (!pi) continue;
        const sp = this.slotPos(key);
        pi.mesh.position.y = sp[1] + (y - 0.29) + (this.onStands ? 0.0 : 0);
        pi.mesh.rotation.y = base + steer * (SLOTS[key].rot ? -1 : 1) * 1;
      }
      if (inst && inst.mesh.userData.spin) inst.mesh.userData.spin.rotation.x = this.onStands ? 0 : -(vc.wheelRotation(i) ?? 0) * (SLOTS[k].rot ? -1 : 1);
    });
  }

  updateGauges() {
    const g = this.slots.gauges?.mesh;
    if (!g) return;
    const on = this.ignition && this.electricsOk();
    const a = (v) => Math.PI * 0.75 + clamp(v, 0, 1) * Math.PI * 1.5 + Math.PI / 2;
    const sn = g.getObjectByName('speedNeedle'), rn = g.getObjectByName('rpmNeedle'), tn = g.getObjectByName('tempNeedle'), fn = g.getObjectByName('fuelNeedle');
    if (sn) sn.rotation.z = a(this.speedKmh / 180);
    if (rn) rn.rotation.z = a(on ? this.rpm / 8000 : 0);
    if (tn) tn.rotation.z = -0.8 + clamp((this.engineTemp - 40) / 90, 0, 1) * 1.6;
    if (fn) fn.rotation.z = -0.8 + (on ? clamp(this.fuel / 36, 0, 1) : 0) * 1.6;
    const ol = g.getObjectByName('oilLamp'), bl = g.getObjectByName('battLamp');
    if (ol) ol.material.emissiveIntensity = on && (this.oil < 0.8 || !this.engineOn) ? 3 : 0;
    if (bl) bl.material.emissiveIntensity = on && !this.engineOn ? 3 : 0;
    partMats().gauge.emissiveIntensity = on && this.lights ? 0.5 : 0.0;
  }

  updateLights() {
    const on = this.lights && this.electricsOk() && this.batteryLevel() > 0.05;
    for (const k of ['headlightL', 'headlightR']) {
      const r = this.slots[k]?.mesh.getObjectByName('reflector');
      if (r) { r.material = r.userData.on || (r.userData.on = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0d0, emissiveIntensity: 3 })); if (!on) r.material = partMats().reflector; }
    }
    const braking = this.brake > 0.1 && this.electricsOk();
    for (const k of ['taillightL', 'taillightR']) {
      const r = this.slots[k]?.mesh.getObjectByName('redLens');
      if (r) { r.material = (on || braking) ? (r.userData.on ||= new THREE.MeshStandardMaterial({ color: 0xff2010, emissive: 0xff1000, emissiveIntensity: braking ? 4 : 1.5 })) : partMats().plasticRed; if (r.userData.on) r.userData.on.emissiveIntensity = braking ? 4 : 1.5; }
    }
    const rl = this.slots.rallylights?.mesh;
    if (rl) rl.traverse((o) => { if (o.name === 'rallyLens') o.material.emissiveIntensity = on ? 3 : 0; });
    this.headlightsActive = on && (this.slots.headlightL || this.slots.headlightR);
    this.rallyLightsActive = on && !!this.slots.rallylights;
  }

  // ---------------------------------------------------------------- crash damage
  onImpact(impact, localDir) {
    super.onImpact(impact, localDir);
    const sev = clamp((impact - 4.5) / 10, 0, 1.5);
    const zones = [];
    if (localDir.z > 0.4) zones.push('bumperF', 'grille', 'headlightL', 'headlightR', 'hood', 'radiator', 'fenderL', 'fenderR', 'rallylights', 'plateF', 'hoseU', 'fan');
    if (localDir.z < -0.4) zones.push('bumperR', 'taillightL', 'taillightR', 'trunk', 'muffler', 'tank', 'plateR', 'spoiler');
    if (localDir.x > 0.4) zones.push('doorL', 'mirrorL', 'fenderL', 'wheelFL', 'wheelRL', 'strutFL');
    if (localDir.x < -0.4) zones.push('doorR', 'mirrorR', 'fenderR', 'wheelFR', 'wheelRR', 'strutFR');
    if (localDir.y < -0.5) zones.push('oilpan', 'pipe', 'muffler', 'tank');
    for (const k of zones) {
      const inst = this.slots[k];
      if (!inst) continue;
      const d = sev * rand(0.2, 0.7);
      inst.cond = Math.max(0, inst.cond - d);
      inst.tight = Math.max(0, inst.tight - Math.floor(d * 20));
      this.applyCondVisual(inst);
      if ((inst.cond < 0.12 || (sev > 0.8 && Math.random() < 0.3)) && FALLABLE.has(inst.def.cat) && this.childrenOf(k).length === 0) {
        const v = this.body.linvel();
        this.detach(inst, { vel: { x: v.x * 0.6 + rand(-2, 2), y: 2 + rand(0, 2), z: v.z * 0.6 + rand(-2, 2) } });
      }
    }
    if (zones.includes('radiator') && this.slots.radiator && sev > 0.5) this.coolant = Math.max(0, this.coolant - sev * 2);
    // dent the shell
    this.dent(localDir, sev);
    this.dirty = true;
  }
  dent(localDir, sev) {
    if (sev < 0.15) return;
    const c = new THREE.Vector3(localDir.x > 0.4 ? 0.8 : localDir.x < -0.4 ? -0.8 : rand(-0.4, 0.4), 0.6, localDir.z > 0.4 ? 2.0 : localDir.z < -0.4 ? -2.0 : rand(-1, 1));
    const push = localDir.clone().normalize().multiplyScalar(-0.06 * sev);
    const targets = [...this.bodyMeshes];
    for (const t of ['hood', 'trunk', 'doorL', 'doorR', 'fenderL', 'fenderR']) if (this.slots[t]) targets.push(...this.slots[t].mesh.children.filter((m) => m.isMesh));
    for (const m of targets) {
      const pos = m.geometry.attributes.position;
      if (!m.userData.ownGeo) { m.geometry = m.geometry.clone(); m.userData.ownGeo = true; }
      const p = m.geometry.attributes.position;
      m.updateMatrix();
      const inv = new THREE.Matrix4().copy(m.matrix).invert();
      const lc = c.clone().applyMatrix4(inv);
      let changed = false;
      for (let i = 0; i < p.count; i++) {
        const dx = p.getX(i) - lc.x, dy = p.getY(i) - lc.y, dz = p.getZ(i) - lc.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 0.55) { const k = (1 - d / 0.55) ** 2 * (0.7 + Math.random() * 0.6); p.setXYZ(i, p.getX(i) + push.x * k, p.getY(i) + push.y * k, p.getZ(i) + push.z * k); changed = true; }
      }
      if (changed) { p.needsUpdate = true; m.geometry.computeVertexNormals(); }
    }
  }

  // ---------------------------------------------------------------- stands
  placeOnStands(pos, ry) {
    if (!this.body) this.createBody(pos, ry, true);
    this.onStands = true;
    this.body.setBodyType(this.game.physics.R.RigidBodyType.Fixed, true);
    this.setPose(pos.clone().add(_v.set(0, 0.28, 0)), ry);
  }
  lowerFromStands() {
    this.onStands = false;
    this.body.setBodyType(this.game.physics.R.RigidBodyType.Dynamic, true);
    const p = this.pos.clone(); p.y += 0.05;
    this.body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
    this.dirty = true;
    audio.play('clunk', p, 1);
  }

  completion() {
    const keys = Object.keys(SLOTS).filter((k) => !['stand', 'plateF', 'plateR', 'spoiler', 'rallylights', 'cage', 'mudflaps', 'radio'].includes(k));
    let have = 0, bolted = 0;
    for (const k of keys) {
      const inst = this.slots[k] || (k === 'engine' ? null : null);
      if (inst) { have++; if (this.tightFrac(inst) >= 0.999) bolted++; }
    }
    return { total: keys.length, have, bolted, pct: (have + bolted) / (keys.length * 2) };
  }

  // serialise
  save() {
    const parts = [];
    for (const inst of this.parts.values()) {
      const e = { uid: inst.uid, defId: inst.defId, slot: inst.slot, cond: +inst.cond.toFixed(3), tight: inst.tight, data: inst.data };
      if (!inst.slot && inst.ent?.body) {
        const t = inst.ent.body.translation(), r = inst.ent.body.rotation();
        e.pos = [+t.x.toFixed(3), +t.y.toFixed(3), +t.z.toFixed(3)]; e.rot = [r.x, r.y, r.z, r.w];
      }
      if (inst.panel && inst.mesh.userData.paintMat) e.data = { ...e.data, color: inst.mesh.userData.paintMat.color.getHex() };
      parts.push(e);
    }
    const t = this.body.translation(), r = this.body.rotation();
    return { parts, onStands: this.onStands, pos: [t.x, t.y, t.z], rot: [r.x, r.y, r.z, r.w], tuning: this.tuning, paint: this.paint, registered: this.registered, plates: this.plates, odometer: this.odometer, engineTemp: this.engineTemp };
  }
}

function roundBoxGeo(w, h, d) { return new THREE.BoxGeometry(w, h, d, 2, 2, 2); }
function scriptTex(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72;
  const g = c.getContext('2d');
  g.fillStyle = '#e0e0e0'; g.font = 'italic bold 44px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 38);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function contactShadow(w, l) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 64, 4, 32, 64, 60);
  grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.45)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.scale(1, 1); g.fillStyle = grd; g.fillRect(0, 0, 64, 128); g.restore();
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.renderOrder = 1; m.name = 'contactShadow';
  return m;
}
function badgeTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#d8d8d8'; g.font = 'italic bold 44px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('Ruska 1300', 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
