import * as THREE from 'three';
import { buildTrafficCar } from '../vehicles/fleet.js';
import { clamp, damp, rand, pick } from '../core/util.js';
import { audio } from '../core/audio.js';
import { IS_MOBILE } from '../core/device.js';

const UP = new THREE.Vector3(0, 1, 0);

// Kinematic AI traffic along the highway loop, plus the police patrol & pursuit logic.
class AICar {
  constructor(game, road, kind, color, s, dir) {
    this.game = game; this.road = road; this.kind = kind;
    this.obj = buildTrafficCar(kind, color);
    game.scene.add(this.obj);
    this.s = s; this.dir = dir;
    this.speed = 0; this.cruise = rand(18, 24);
    this.pos = new THREE.Vector3(); this.yaw = 0;
    const ph = game.physics, R = ph.R;
    this.body = ph.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
    const cd = R.ColliderDesc.cuboid(0.86, 0.6, 2.2).setTranslation(0, 0.85, 0); ph.setGroups(cd, 'vehicle');
    this.collider = ph.world.createCollider(cd, this.body);
    ph.tag(this.collider, { aicar: this, surface: 'metal' });
    this.mode = 'road';
    this.wheelRot = 0;
    this.honkT = 0;
  }
  sampleAt(s) {
    const S = this.road.samples, n = S.length;
    const L = this.road.length;
    const f = ((s % L) + L) % L / L * n;
    const i = Math.floor(f), t = f - i;
    const a = S[i % n], b = S[(i + 1) % n];
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, h: a.h + (b.h - a.h) * t, dx: a.dx + (b.dx - a.dx) * t, dz: a.dz + (b.dz - a.dz) * t };
  }
  roadPose(s, out) {
    const p = this.sampleAt(s);
    const fx = p.dx * this.dir, fz = p.dz * this.dir;
    const rx = -fz, rz = fx; // right of travel direction
    out.set(p.x + rx * 1.85, p.h, p.z + rz * 1.85);
    return Math.atan2(fx, fz);
  }
  update(dt, others) {
    const g = this.game;
    if (this.mode === 'road') {
      // look ahead for obstacles
      let target = this.cruise;
      const ahead = this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(12));
      for (const o of others) if (o !== this && o.pos.distanceTo(ahead) < 12) target = Math.min(target, o.speed * 0.8);
      const pv = g.player.inVehicle;
      const pp = pv ? pv.pos : g.player.pos;
      if (pp.distanceTo(ahead) < 9) { target = 0; this.honk(); }
      for (const veh of g.vehicles) if (veh.body && veh !== pv && veh.pos.distanceTo(ahead) < 8) target = 0;
      // pedestrians get hit if they stand in the way of a fast car
      if (!pv && !g.player.dead && this.speed > 6 && g.player.pos.distanceTo(this.pos) < 2.4) { g.player.hurt(this.speed * 5, 'got run over by a car'); g.player.vel.set(Math.sin(this.yaw) * 8, 5, Math.cos(this.yaw) * 8); audio.play('crash', this.pos, 0.6); }
      if (g.npcs.moose.pos.distanceTo(ahead) < 10) { target = 0; this.honk(); }
      this.speed = damp(this.speed, target, target < this.speed ? 3 : 0.8, dt);
      this.s += this.speed * this.dir * dt;
      const y = this.roadPose(this.s, this.pos);
      this.yaw = y;
      // pitch from slope
      const p2 = new THREE.Vector3(); this.roadPose(this.s + this.dir * 3, p2);
      this.pitch = Math.atan2(p2.y - this.pos.y, 3);
    }
    this.place(dt);
  }
  honk() { if (this.honkT <= 0) { audio.play('horn', this.pos, 0.6); this.honkT = 3; } }
  place(dt) {
    this.honkT -= dt;
    this.obj.visible = this.pos.distanceToSquared(this.game.camera.position) < 480 * 480;
    this.obj.position.copy(this.pos);
    this.obj.rotation.set(0, 0, 0);
    this.obj.rotation.order = 'YXZ';
    this.obj.rotation.y = this.yaw; this.obj.rotation.x = -(this.pitch || 0);
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
    const q = new THREE.Quaternion().setFromEuler(this.obj.rotation);
    this.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    this.wheelRot += this.speed * dt / 0.3;
    for (const w of this.obj.userData.wheels) w.userData.spin.rotation.x = this.wheelRot * (w.rotation.y ? -1 : 1);
    const night = this.game.sky.daylight < 0.6;
    this.obj.userData.hl.emissiveIntensity = night ? 2.5 : 0.2;
    this.obj.userData.tl.emissiveIntensity = night ? 1.2 : 0;
  }
}

export class Traffic {
  constructor(game) {
    this.game = game;
    this.road = game.terrain.roads.find((r) => r.id === 'highway');
    this.cars = [];
    const kinds = IS_MOBILE ? ['sedan', 'wagon', 'sedan'] : ['sedan', 'wagon', 'sedan', 'wagon', 'sedan', 'sedan'];
    const cols = [0x7a2a2a, 0x2a4a6a, 0xd8d0b0, 0x3a5a3a, 0x8a8a8a, 0x6a4a2a];
    for (let i = 0; i < kinds.length; i++) this.cars.push(new AICar(game, this.road, kinds[i], cols[i], (i / kinds.length) * this.road.length, i % 2 ? 1 : -1));
    // police
    this.police = new AICar(game, this.road, 'police', 0xffffff, this.road.length * 0.42, 1);
    this.police.cruise = 21;
    this.cars.push(this.police);
    this.pol = { state: 'patrol', timer: rand(120, 300), alertCooldown: 0, sirenSnd: null, stopTimer: 0, lostTimer: 0, reasons: [], chaseT: 0 };
    this.speedTrapSpots = [0.42, 0.55, 0.08].map((f) => f * this.road.length);
  }

  update(dt) {
    const g = this.game;
    for (const c of this.cars) if (c !== this.police || this.pol.state === 'patrol') c.update(dt, this.cars);
    this.updatePolice(dt);
  }

  // ---------------------------------------------------------------- police
  violations(v) {
    const g = this.game, r = [];
    if (!v) return r;
    const onPublic = v.surfaces.some((s) => s === 'asphalt');
    if (v.speedKmh > 105) r.push({ id: 'speed', text: `speeding (${Math.round(v.speedKmh)} km/h in an 80 zone)`, fine: Math.round(80 + (v.speedKmh - 80) * 6) });
    if (v.isBuildCar && !v.registered && onPublic) r.push({ id: 'plates', text: 'driving an unregistered vehicle', fine: 150 });
    if (v.kind === 'tractor' && v.speedKmh > 45) r.push({ id: 'tractor', text: 'tractor doing ' + Math.round(v.speedKmh) + ' km/h', fine: 150 });
    if (g.sky.daylight < 0.5 && !v.lights && v.speedKmh > 20) r.push({ id: 'lights', text: 'driving without headlights', fine: 120 });
    if (v.isBuildCar && v.engineStats().exhaust > 1.0) r.push({ id: 'noise', text: 'illegal exhaust noise', fine: 200 });
    return r;
  }

  updatePolice(dt) {
    const g = this.game, P = this.pol, pc = this.police;
    const pv = g.player.inVehicle;
    P.alertCooldown -= dt;
    const beacons = pc.obj.userData.beacons;
    if (P.state === 'patrol' || P.state === 'trap') {
      beacons.forEach((b) => (b.emissiveIntensity = 0));
      P.timer -= dt;
      if (P.state === 'patrol' && P.timer <= 0) {
        // park as a speed trap
        P.state = 'trap'; P.timer = rand(180, 400);
        pc.s = pick(this.speedTrapSpots); pc.speed = 0;
        const y = pc.roadPose(pc.s, pc.pos); pc.yaw = y;
        const right = new THREE.Vector3(Math.cos(y), 0, -Math.sin(y));
        pc.pos.addScaledVector(right, -4.5 * 0 + 0); pc.pos.x += Math.cos(y) * 3.5; pc.pos.z -= Math.sin(y) * 3.5;
        pc.pos.y = g.terrain.getHeight(pc.pos.x, pc.pos.z);
        pc.place(dt);
      } else if (P.state === 'trap') {
        pc.place(dt);
        if (P.timer <= 0) { P.state = 'patrol'; P.timer = rand(200, 400); }
      }
      // detection
      if (pv && P.alertCooldown <= 0 && pv.pos.distanceTo(pc.pos) < (P.state === 'trap' ? 38 : 22)) {
        const r = this.violations(pv);
        if (r.length) this.startPursuit(r);
      }
      return;
    }
    // pursuit
    P.chaseT += dt;
    beacons[0].emissiveIntensity = Math.sin(performance.now() / 120) > 0 ? 4 : 0;
    beacons[1].emissiveIntensity = Math.sin(performance.now() / 120) > 0 ? 0 : 4;
    if (!P.sirenSnd) { P.sirenSnd = audio.loop('siren', pc.pos); P.sirenSnd?.set(1); }
    audio.setPos(P.sirenSnd?.out, pc.pos);
    const target = pv ? pv.pos : g.player.pos;
    const to = new THREE.Vector3().subVectors(target, pc.pos); to.y = 0;
    const dist = to.length();
    // drive towards the player with smooth steering
    const wantYaw = Math.atan2(to.x, to.z);
    let dy = ((wantYaw - pc.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    pc.yaw += clamp(dy, -1.4 * dt, 1.4 * dt);
    const want = dist > 14 ? Math.min(42, (pv ? pv.speedKmh / 3.6 : 3) + dist * 0.4 + 6) : Math.max(0, (pv ? pv.speedKmh / 3.6 : 0) - 1);
    pc.speed = damp(pc.speed, want, 1.2, dt);
    pc.pos.x += Math.sin(pc.yaw) * pc.speed * dt; pc.pos.z += Math.cos(pc.yaw) * pc.speed * dt;
    pc.pos.y = g.terrain.getHeight(pc.pos.x, pc.pos.z);
    pc.pitch = 0;
    pc.place(dt);
    // pulled over?
    const pSpeed = pv ? pv.speedKmh : g.player.vel.length() * 3.6;
    if (dist < 22 && pSpeed < 4) {
      P.stopTimer += dt;
      if (P.stopTimer > 2.5) this.pullOver();
    } else P.stopTimer = Math.max(0, P.stopTimer - dt * 0.5);
    if (dist > 320) { P.lostTimer += dt; if (P.lostTimer > 15) this.losePursuit(); } else P.lostTimer = 0;
    if (P.chaseT > 150 && dist < 15) this.pullOver(true);
    if (!pv && dist < 4) this.pullOver(true);
  }

  startPursuit(reasons) {
    const g = this.game, P = this.pol;
    P.state = 'pursuit'; P.reasons = reasons; P.stopTimer = 0; P.lostTimer = 0; P.chaseT = 0;
    g.ui.toast('🚨 POLICE! Pull over and stop the vehicle.', 5);
    g.ui.objective('Police! 🚨', 'Stop next to the police car, or try to lose them.');
    g.stats.chases = (g.stats.chases || 0) + 1;
  }
  losePursuit() {
    const g = this.game, P = this.pol;
    this.endPursuit();
    g.ui.toast('You lost the police. For now...', 4);
    g.state.wanted = (g.state.wanted || 0) + 1;
    g.achieve('escape', 'Smokey Who?', 'Escaped a police pursuit');
  }
  endPursuit() {
    const P = this.pol;
    P.state = 'patrol'; P.timer = rand(200, 400); P.alertCooldown = 180;
    if (P.sirenSnd) { P.sirenSnd.stop(); P.sirenSnd = null; }
    this.game.ui.objective(null);
    // snap back to the road
    let best = 0, bd = 1e9; const S = this.road.samples;
    for (let i = 0; i < S.length; i += 10) { const d = Math.hypot(S[i].x - this.police.pos.x, S[i].z - this.police.pos.z); if (d < bd) { bd = d; best = i; } }
    this.police.s = best / S.length * this.road.length;
  }
  pullOver(forced = false) {
    const g = this.game, P = this.pol;
    const pv = g.player.inVehicle;
    const drunk = g.player.n.drunk;
    const reasons = P.reasons.slice();
    if (drunk > 0.45) reasons.push({ id: 'drunk', text: `drunk driving (breathalyser: ${(drunk * 1.6).toFixed(2)} ‰)`, fine: 900 });
    if (forced) reasons.push({ id: 'evade', text: 'evading the police', fine: 500 });
    this.endPursuit();
    const arrest = reasons.some((r) => r.id === 'drunk' || r.id === 'evade') || (g.state.wanted || 0) > 2;
    g.actions.policeStop(reasons, arrest);
  }
}
