import * as THREE from 'three';
import { clamp } from '../core/util.js';
import { audio } from '../core/audio.js';
import { SLOTS } from '../vehicles/parts.js';

// Aiming, carrying, using and wrenching.
export class Interact {
  constructor(game) {
    this.game = game;
    this.ray = new THREE.Raycaster();
    this.ray.far = 2.8;
    this.target = null; // { kind, ... }
    this.held = null;   // item entity
    this.holdDist = 1.1;
    this.tool = 'hands'; // hands | wrench | screwdriver
    this.ghost = null;
    this.ghostSlot = null;
    this.prompt = { main: '', sub: '', keys: [] };
    this.throwCharge = 0;
  }

  setTool(t) {
    this.tool = t;
    this.game.ui.setTool(t);
    audio.play('click');
  }

  update(dt) {
    const g = this.game, inp = g.input, P = g.player;
    this.prompt = { main: '', sub: '', keys: [] };
    if (P.dead || P.sleeping || P.inVehicle || g.uiBlocking) { if (this.held && P.inVehicle) this.drop(); this.clearGhost(); return; }
    const cam = g.camera;
    const origin = cam.position;
    const dir = _d.set(0, 0, -1).applyQuaternion(cam.quaternion);
    // tool switch
    if (g.dialog?.npc) { this.target = null; return; }
    if (inp.hit('KeyF')) this.setTool(this.tool === 'hands' ? 'wrench' : this.tool === 'wrench' ? 'screwdriver' : 'hands');
    if (inp.hit('Digit1')) this.setTool('hands');
    if (inp.hit('Digit2')) this.setTool('wrench');
    if (inp.hit('Digit3')) this.setTool('screwdriver');
    // --------------------------------------------------- holding an item
    if (this.held) { this.updateHeld(dt, origin, dir); return; }
    this.clearGhost();
    // --------------------------------------------------- find target
    const T = this.findTarget(origin, dir);
    this.target = T;
    if (!T) return;
    if (T.kind === 'part') this.handlePart(T, dt);
    else if (T.kind === 'item') this.handleItem(T);
    else if (T.kind === 'interact') this.handleInteract(T);
    else if (T.kind === 'vehicle') this.handleVehicle(T);
    else if (T.kind === 'npc') this.handleNpc(T);
  }

  findTarget(origin, dir) {
    const g = this.game;
    let best = null, bestD = 2.8;
    // physics ray (items, vehicles, walls)
    const hit = g.physics.ray(origin, dir, 2.8, { exclude: g.player.collider });
    let wallD = 2.8;
    if (hit) {
      wallD = hit.toi;
      const t = hit.tag;
      if (t?.item) { best = { kind: 'item', ent: t.item, dist: hit.toi }; bestD = hit.toi; }
      else if (t?.vehicle) { best = { kind: 'vehicle', vehicle: t.vehicle, dist: hit.toi, point: _p.copy(origin).addScaledVector(dir, hit.toi).clone() }; bestD = hit.toi; }
      else if (t?.npc) { best = { kind: 'npc', npc: t.npc, dist: hit.toi }; bestD = hit.toi; }
    }
    // mesh raycast: interactables + attached car parts
    this.ray.set(origin, dir); this.ray.far = 2.8;
    const cand = [];
    for (const it of g.interactables) {
      if (it.pos.distanceToSquared(origin) > 16) continue;
      if (it.enabled && !it.enabled()) continue;
      cand.push(it.mesh);
    }
    const car = g.car;
    const objs = [...cand];
    if (car.root.position.distanceToSquared(origin) < 64) objs.push(car.root);
    if (car.standRoot.children.length && g.spots.engineStand.distanceToSquared(origin) < 25) objs.push(car.standRoot);
    const hits = this.ray.intersectObjects(objs, true);
    for (const h of hits) {
      if (h.distance > Math.min(bestD, wallD + 0.12) + 0.02) break;
      const o = h.object;
      if (o.userData.interact) { best = { kind: 'interact', it: o.userData.interact, dist: h.distance }; break; }
      let p = o; while (p && !p.userData.partInst) p = p.parent;
      if (p) { best = { kind: 'part', inst: p.userData.partInst, dist: h.distance, point: h.point.clone() }; break; }
      // car body hit (not a part): treat as vehicle
      if (car.root === o || isChild(car.root, o)) { if (!best || h.distance < bestD) best = { kind: 'vehicle', vehicle: car, dist: h.distance, point: h.point.clone() }; break; }
    }
    return best;
  }

  // --------------------------------------------------- handlers
  handleItem(T) {
    const g = this.game, inp = g.input, e = T.ent;
    const def = e.def;
    this.prompt.main = def.name + (e.part ? partCond(e.part) : '') + fluidInfo(e);
    if (def.noCarry) { this.prompt.keys.push(['', 'Too heavy to carry']); return; }
    this.prompt.keys.push(['LMB', 'Pick up']);
    if (def.use) this.prompt.keys.push(['E', typeof def.useLabel === 'function' ? def.useLabel(e) : def.useLabel || 'Use']);
    if (inp.mouse.leftPressed) this.pickUp(e);
    else if (inp.hit('KeyE') && def.use) def.use(g, e);
  }

  handleInteract(T) {
    const g = this.game, it = T.it;
    const label = typeof it.label === 'function' ? it.label() : it.label;
    if (!label) return;
    this.prompt.main = label;
    this.prompt.keys.push(['E', 'Use']);
    if (it.alt) this.prompt.keys.push(['RMB', it.altLabel || 'Alt']);
    if (g.input.hit('KeyE')) it.use();
    else if (it.alt && g.input.mouse.rightPressed) it.alt();
  }

  handleNpc(T) {
    const g = this.game, n = T.npc;
    this.prompt.main = n.name + (n.mood ? ` — ${n.mood}` : '');
    this.prompt.keys.push(['E', 'Talk']);
    if (g.input.hit('KeyE')) g.npcs.talk(n);
  }

  handleVehicle(T) {
    const g = this.game, v = T.vehicle;
    const isCar = v === g.car;
    if (isCar && v.onStands) {
      this.prompt.main = `${v.name} (on jack stands)`;
      const wheels = ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'].every((k) => v.slots[k]);
      this.prompt.keys.push(['E', wheels ? 'Lower the car off the stands' : 'Needs 4 wheels before lowering']);
      if (g.input.hit('KeyE')) { if (wheels) { v.lowerFromStands(); g.ui.toast('The Ruska is on its own wheels now!'); g.achieve('wheels', 'Four Wheels', 'Lowered the Ruska off the jack stands'); } else g.ui.toast('Attach and bolt all four wheels first.'); }
      return;
    }
    // fuel filler / oil / etc pouring handled with held item
    this.prompt.main = v.name;
    this.prompt.keys.push(['E', 'Get in']);
    const up = v.root.up ? new THREE.Vector3(0, 1, 0).applyQuaternion(v.root.quaternion) : null;
    if (up && up.y < 0.4) { this.prompt.keys.length = 0; this.prompt.keys.push(['E', 'Push it back on its wheels']); if (g.input.hit('KeyE')) { v.flip(); audio.play('thud', v.pos); } return; }
    if (g.input.hit('KeyE')) g.actions.enterVehicle(v);
  }

  handlePart(T, dt) {
    const g = this.game, inp = g.input, inst = T.inst, car = g.car;
    const max = car.maxTight(inst);
    const bolts = inst.def.bolts;
    const tightBolts = Math.floor(inst.tight / 8);
    this.prompt.main = inst.def.name + partCond(inst);
    if (bolts > 0) this.prompt.sub = `Bolts ${tightBolts}/${bolts}` + (inst.tight > 0 && inst.tight < max ? ` (${Math.round(inst.tight / max * 100)}%)` : inst.tight >= max ? ' ✓ tight' : '');
    // fluid info for relevant parts
    if (inst.slot === 'rcover' || inst.def.type === 'block') this.prompt.sub += `  Oil ${car.oil.toFixed(1)}/3.5 L`;
    if (inst.slot === 'radiator') this.prompt.sub += `  Coolant ${car.coolant.toFixed(1)}/5 L`;
    if (inst.slot === 'brakemaster') this.prompt.sub += `  Brake fluid ${(car.brakeFluid * 1000).toFixed(0)}/500 ml`;
    if (inst.slot === 'tank') this.prompt.sub += `  Fuel ${car.fuel.toFixed(1)}/36 L`;
    if (inst.slot === 'battery') this.prompt.sub += `  Charge ${Math.round((inst.data.charge ?? 0) * 100)}%`;
    if (this.tool === 'wrench') {
      if (bolts > 0) {
        this.prompt.keys.push(['Wheel↑/LMB', 'Tighten'], ['Wheel↓/RMB', 'Loosen']);
        let dir = 0;
        if (inp.mouse.wheel < 0) dir = 1; else if (inp.mouse.wheel > 0) dir = -1;
        this.wrenchRepeat = (this.wrenchRepeat || 0) - dt;
        if (dir === 0 && (inp.mouse.left || inp.mouse.right) && this.wrenchRepeat <= 0) { dir = inp.mouse.left ? 1 : -1; this.wrenchRepeat = 0.07; }
        if (dir) car.wrench(inst, dir);
      }
    } else if (this.tool === 'screwdriver') {
      if (inst.def.tune === 'afr') {
        this.prompt.sub = g.state.afrGauge ? `Mixture AFR ${car.tuning.afr.toFixed(1)} (best power ~12.9, economy ~14.7)` : 'Mixture screw (buy a tuning gauge to read it)';
        this.prompt.keys.push(['Wheel', 'Adjust mixture']);
        if (inp.mouse.wheel) { car.tuning.afr = clamp(car.tuning.afr + (inp.mouse.wheel < 0 ? -0.1 : 0.1), 9, 19); car.dirty = true; audio.play('click', null); }
      } else if (inst.def.tune === 'timing') {
        this.prompt.sub = g.state.afrGauge ? `Ignition timing ${car.tuning.timing.toFixed(1)}° BTDC (stock 10°, max power ~12°)` : 'Rotate the distributor to set timing';
        this.prompt.keys.push(['Wheel', 'Rotate distributor']);
        if (inp.mouse.wheel) { car.tuning.timing = clamp(car.tuning.timing + (inp.mouse.wheel < 0 ? -0.5 : 0.5), -10, 35); car.dirty = true; audio.play('click', null); }
      } else this.prompt.keys.push(['', 'Nothing to adjust here']);
    } else {
      const cd = car.canDetach(inst);
      if (cd.ok) { this.prompt.keys.push(['E', 'Detach']); if (inp.hit('KeyE')) { car.detach(inst); this.pickUp(inst.ent); } }
      else { this.prompt.keys.push(['', cd.why || '']); if (bolts > 0) this.prompt.keys.push(['F', 'Wrench']); }
      if (inst.def.tune) this.prompt.keys.push(['3', 'Screwdriver to tune']);
    }
  }

  // --------------------------------------------------- carrying
  pickUp(e) {
    if (!e || !e.body || e.def.noCarry) return;
    this.held = e;
    e.body.setGravityScale(0, true);
    e.body.setAngularDamping(6);
    e.body.setLinearDamping(4);
    const m = e.def.mass || 1;
    this.holdDist = m > 20 ? 1.3 : m > 6 ? 1.1 : 0.85;
    this.heldRot = new THREE.Quaternion().copy(e.mesh.quaternion);
    audio.play('click');
  }
  drop(silent = false) {
    const e = this.held;
    this.held = null;
    this.clearGhost();
    if (e && e.body) { e.body.setGravityScale(1, true); e.body.setAngularDamping(0.3); e.body.setLinearDamping(0.1); }
  }
  throwHeld(dir) {
    const e = this.held; this.drop();
    if (!e?.body) return;
    const m = e.def.mass || 1;
    const sp = clamp(14 / Math.sqrt(m), 2, 12);
    e.body.setLinvel({ x: dir.x * sp, y: dir.y * sp + 1.5, z: dir.z * sp }, true);
    e.body.setAngvel({ x: Math.random() * 6 - 3, y: Math.random() * 6 - 3, z: Math.random() * 6 - 3 }, true);
    audio.play('swing', this.game.camera.position);
    this.game.actions.thrown?.(e);
  }

  updateHeld(dt, origin, dir) {
    const g = this.game, inp = g.input, e = this.held;
    if (!e.body) { this.held = null; return; }
    const m = e.def.mass || 1;
    // target position
    const tp = _t.copy(origin).addScaledVector(dir, this.holdDist);
    // don't push into walls
    const hit = g.physics.ray(origin, dir, this.holdDist + 0.2, { exclude: g.player.collider, predicate: (c) => g.physics.tagOf(c)?.item !== e });
    if (hit && hit.toi < this.holdDist) tp.copy(origin).addScaledVector(dir, Math.max(0.35, hit.toi - 0.15));
    const cur = e.body.translation();
    const strength = m > 30 ? 6 : 14;
    const vx = (tp.x - cur.x) * strength, vy = (tp.y - cur.y) * strength, vz = (tp.z - cur.z) * strength;
    e.body.setLinvel({ x: vx, y: vy, z: vz }, true);
    // keep upright-ish orientation relative to view for consumables
    const dist = Math.hypot(tp.x - cur.x, tp.y - cur.y, tp.z - cur.z);
    if (dist > 1.6) { this.drop(); return; }
    if (inp.down('KeyR')) {
      const r = e.body.rotation(); _q.set(r.x, r.y, r.z, r.w);
      _q.premultiply(_q2.setFromAxisAngle(_up, dt * 2.5));
      e.body.setRotation(_q, true); e.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    const def = e.def;
    this.prompt.main = `Holding: ${def.name}` + (e.part ? partCond(e.part) : '') + fluidInfo(e);
    this.prompt.keys.push(['LMB', 'Drop'], ['RMB', 'Throw'], ['R', 'Rotate']);
    if (def.use) this.prompt.keys.push(['E', typeof def.useLabel === 'function' ? def.useLabel(e) : def.useLabel || 'Use']);
    // part attach ghost
    if (e.part) {
      const slot = g.car.findSlot(e.part, e.mesh.position, 0.6);
      if (slot) {
        this.showGhost(e.part, slot);
        this.prompt.keys.unshift(['E', `Attach to ${SLOTS[slot].name || prettySlot(slot)}`]);
        if (inp.hit('KeyE')) { const inst = e.part; this.held = null; this.clearGhost(); g.car.attach(inst, slot); return; }
      } else this.clearGhost();
    }
    if (inp.mouse.leftPressed) { this.drop(); return; }
    if (inp.mouse.rightPressed) { this.throwHeld(dir); return; }
    if (inp.hit('KeyE') && def.use) def.use(g, e);
  }

  showGhost(inst, slot) {
    const g = this.game;
    if (this.ghostSlot !== slot || !this.ghost) {
      this.clearGhost();
      const ghost = inst.mesh.clone(true);
      ghost.traverse((o) => { if (o.isMesh) { o.material = GHOST_MAT; o.castShadow = false; o.userData = {}; } });
      ghost.userData = {};
      this.ghost = ghost; this.ghostSlot = slot;
      const parent = g.car.parentObj(slot);
      parent.add(ghost);
      ghost.position.set(...g.car.slotPos(slot));
      const r = SLOTS[slot].rot || [0, 0, 0]; ghost.rotation.set(r[0], r[1], r[2]);
    }
    GHOST_MAT.opacity = 0.25 + Math.sin(performance.now() / 150) * 0.1;
  }
  clearGhost() {
    if (this.ghost) { this.ghost.removeFromParent(); this.ghost = null; this.ghostSlot = null; }
  }
}

const GHOST_MAT = new THREE.MeshBasicMaterial({ color: 0x40ff80, transparent: true, opacity: 0.3, depthWrite: false });
function isChild(root, o) { while (o) { if (o === root) return true; o = o.parent; } return false; }
function partCond(inst) {
  const c = inst.cond;
  if (c > 0.85) return '';
  return c > 0.5 ? ' (worn)' : c > 0.2 ? ' (damaged)' : ' (broken)';
}
function fluidInfo(e) {
  if (e.def.fluid) return ` — ${(e.data.amount || 0).toFixed(1)} / ${e.def.capacity} L`;
  if (e.part?.defId === 'battery') return ` — charge ${Math.round((e.part.data.charge ?? 0) * 100)}%`;
  return '';
}
function prettySlot(s) {
  return s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).replace('F L', 'front left').replace('F R', 'front right').replace('R L', 'rear left').replace('R R', 'rear right');
}
const _d = new THREE.Vector3(), _p = new THREE.Vector3(), _t = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
