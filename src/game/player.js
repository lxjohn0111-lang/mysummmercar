import * as THREE from 'three';
import { clamp, damp, lerp, rand } from '../core/util.js';
import { audio } from '../core/audio.js';
import { WATER_LEVEL } from '../world/layout.js';

const EYE = 1.68, CROUCH_EYE = 1.05;

export class Player {
  constructor(game) {
    this.game = game;
    const ph = game.physics, R = ph.R;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.radius = 0.3; this.halfHeight = 0.6;
    this.body = ph.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 50, 0));
    const cd = R.ColliderDesc.capsule(this.halfHeight, this.radius);
    ph.setGroups(cd, 'player');
    this.collider = ph.world.createCollider(cd, this.body);
    ph.tag(this.collider, { player: true });
    this.cc = ph.world.createCharacterController(0.02);
    this.cc.setUp({ x: 0, y: 1, z: 0 });
    this.cc.enableAutostep(0.38, 0.2, false);
    this.cc.enableSnapToGround(0.35);
    this.cc.setMaxSlopeClimbAngle((52 * Math.PI) / 180);
    this.cc.setMinSlopeSlideAngle((60 * Math.PI) / 180);
    this.cc.setApplyImpulsesToDynamicBodies(true);
    this.grounded = false;
    this.crouch = 0;
    this.bob = 0; this.bobAmp = 0;
    this.stepDist = 0;
    this.fallVel = 0;
    this.swimming = false;
    this.underwater = false;
    this.inVehicle = null;
    this.sitting = null;
    this.sleeping = false;
    this.dead = false;
    this.frozen = false; // cutscenes, menus
    this.shake = 0;
    this.lookOffset = new THREE.Euler();
    // needs (0 good .. 100 bad) except health
    this.n = { hunger: 18, thirst: 22, fatigue: 12, stress: 15, bladder: 20, dirt: 25, drunk: 0, heat: 0, health: 100 };
    this.peeing = false;
    this.vomitTimer = 0;
    this.hiccup = 0;
    this.camera = game.camera;
  }

  get eye() { return lerp(EYE, CROUCH_EYE, this.crouch); }

  teleport(p, yaw = null) {
    this.pos.set(p.x, p.y + this.halfHeight + this.radius + 0.02, p.z);
    this.body.setTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z }, true);
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
    this.vel.set(0, 0, 0); this.fallVel = 0;
    if (yaw !== null) this.yaw = yaw;
  }
  setEnabled(on) {
    this.collider.setEnabled(on);
  }
  feetY() { return this.pos.y - this.halfHeight - this.radius; }

  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  update(dt, gameDt) {
    const g = this.game, inp = g.input;
    if (this.dead) return;
    this.updateNeeds(dt, gameDt);
    if (this.inVehicle || this.sleeping) return;
    // look
    const m = inp.consumeMouse();
    if (!this.frozen) {
      this.yaw -= m.x; this.pitch -= m.y;
      this.pitch = clamp(this.pitch, -1.5, 1.5);
    }
    if (this.sitting) { this.updateCamera(dt); return; }
    const fwd = this.forward(_f), right = _r.set(-fwd.z, 0, fwd.x);
    let mx = 0, mz = 0;
    if (!this.frozen && !g.uiBlocking) {
      mz = inp.axis('KeyS', 'KeyW'); mx = inp.axis('KeyA', 'KeyD');
      if (inp.analog && inp.analog.active) { mz = -inp.analog.y; mx = inp.analog.x; }
    }
    const crouching = !this.frozen && inp.down('KeyC');
    this.crouch = damp(this.crouch, crouching ? 1 : 0, 10, dt);
    const sprint = (inp.down('ShiftLeft') || (inp.analog?.active && Math.hypot(inp.analog.x, inp.analog.y) > 0.97 && inp.mobile)) && !crouching && this.n.fatigue < 95;
    let speed = crouching ? 1.6 : sprint ? 6.2 : 3.6;
    const drunk = this.n.drunk;
    if (this.n.fatigue > 85) speed *= 0.75;
    const wish = _w.set(0, 0, 0).addScaledVector(fwd, mz).addScaledVector(right, mx);
    if (wish.lengthSq() > 1) wish.normalize();
    // drunk wobble
    if (drunk > 0.3) {
      const t = performance.now() / 1000;
      wish.addScaledVector(right, Math.sin(t * 1.3) * drunk * 0.45 * (wish.lengthSq() > 0.01 ? 1 : 0.3));
      this.yaw += Math.sin(t * 0.7) * drunk * 0.0025;
    }
    // swimming?
    const feet = this.feetY();
    const terrainH = g.terrain.getHeight(this.pos.x, this.pos.z);
    const waterDepth = WATER_LEVEL - Math.max(terrainH, feet);
    this.swimming = terrainH < WATER_LEVEL - 1.25 && feet < WATER_LEVEL - 1.05;
    this.underwater = this.camera.position.y < WATER_LEVEL - 0.05 && terrainH < WATER_LEVEL;
    if (this.swimming) {
      speed = sprint ? 2.6 : 1.7;
      const accel = 3;
      this.vel.x = damp(this.vel.x, wish.x * speed, accel, dt);
      this.vel.z = damp(this.vel.z, wish.z * speed, accel, dt);
      // float with head above water
      const target = WATER_LEVEL - 1.15 - (inp.down('KeyC') ? 1.5 : 0);
      this.vel.y = damp(this.vel.y, (target - feet) * 2.5 + (inp.down('Space') ? 1.5 : 0), 4, dt);
      this.n.dirt = Math.max(0, this.n.dirt - gameDt * 1.5);
      this.n.heat = Math.max(0, this.n.heat - gameDt * 6);
      if (!this._swimSplash || performance.now() - this._swimSplash > 900) { if (wish.lengthSq() > 0.1) { audio.play('splash', this.pos, 0.4); this._swimSplash = performance.now(); } }
    } else {
      const accel = this.grounded ? 14 : 2.5;
      this.vel.x = damp(this.vel.x, wish.x * speed, accel, dt);
      this.vel.z = damp(this.vel.z, wish.z * speed, accel, dt);
      if (this.grounded) {
        this.vel.y = -2;
        if (!this.frozen && inp.hit('Space') && !crouching) { this.vel.y = 5.2; this.grounded = false; }
      } else {
        this.vel.y -= 18 * dt;
      }
      if (waterDepth > 0.3) { this.vel.x *= 0.96; this.vel.z *= 0.96; }
    }
    const desired = _d.copy(this.vel).multiplyScalar(dt);
    this.cc.computeColliderMovement(this.collider, desired, undefined, undefined, (c) => {
      const t = g.physics.tagOf(c);
      return !(t && (t.item || t.npcSoft));
    });
    const mv = this.cc.computedMovement();
    const wasGrounded = this.grounded;
    this.grounded = this.cc.computedGrounded();
    const prevY = this.pos.y;
    this.pos.x += mv.x; this.pos.y += mv.y; this.pos.z += mv.z;
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
    // landing damage
    if (!this.grounded && !this.swimming) this.fallVel = Math.min(this.fallVel, this.vel.y);
    if (this.grounded && !wasGrounded) {
      if (this.fallVel < -11) { const dmg = (-this.fallVel - 11) * 12; this.hurt(dmg, 'fell to death'); audio.play('thud', this.pos, 1); this.shake = 0.6; }
      else if (this.fallVel < -5) audio.play('step', this.pos, 3);
      this.fallVel = 0;
    }
    if (this.grounded && this.vel.y < 0) this.vel.y = -2;
    // head bob & footsteps
    const hs = Math.hypot(mv.x, mv.z) / Math.max(dt, 1e-4);
    if (this.grounded && hs > 0.5) {
      this.bob += dt * hs * 2.2;
      this.bobAmp = damp(this.bobAmp, Math.min(1, hs / 5), 8, dt);
      this.stepDist += hs * dt;
      if (this.stepDist > (sprint ? 0.9 : 0.75)) {
        this.stepDist = 0;
        const surf = this.surfaceUnder();
        audio.play('step', null, surf);
      }
    } else this.bobAmp = damp(this.bobAmp, 0, 6, dt);
    if (this.pos.y < -50) this.die('fell out of the world');
    this.updateCamera(dt);
  }

  surfaceUnder() {
    const g = this.game;
    const hit = g.physics.ray({ x: this.pos.x, y: this.pos.y, z: this.pos.z }, { x: 0, y: -1, z: 0 }, 2, { exclude: this.collider });
    const s = hit?.tag?.surface;
    if (s === 'wood') return 2;
    if (s === 'gravel' || s === 'rock' || s === 'concrete' || s === 'asphalt') return 4;
    return 3; // grass/terrain
  }

  updateCamera(dt) {
    const cam = this.camera;
    const drunk = this.n.drunk;
    if (this.sitting) {
      cam.position.copy(this.sitting.pos);
    } else {
      cam.position.set(this.pos.x, this.feetY() + this.eye, this.pos.z);
      cam.position.y += Math.sin(this.bob * 2) * 0.04 * this.bobAmp;
      cam.position.addScaledVector(_r.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), Math.cos(this.bob) * 0.025 * this.bobAmp);
    }
    this.shake = Math.max(0, this.shake - dt * 1.5);
    const t = performance.now() / 1000;
    const sh = this.shake * this.shake;
    let roll = Math.sin(t * 0.9) * drunk * 0.08 + (Math.random() - 0.5) * sh * 0.05;
    let pitch = this.pitch + Math.sin(t * 0.63) * drunk * 0.03 + (Math.random() - 0.5) * sh * 0.05;
    if (this.n.stress > 90) roll += (Math.random() - 0.5) * 0.004;
    cam.rotation.set(0, 0, 0);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(pitch, this.yaw, roll);
  }

  // ---------------------------------------------------------------- needs
  updateNeeds(dt, gameDt) {
    const n = this.n, g = this.game;
    if (this.sleeping) return;
    const m = gameDt; // game minutes elapsed
    const active = this.inVehicle ? 0.8 : 1;
    n.hunger = clamp(n.hunger + m * (100 / (16 * 60)) * active, 0, 100);
    n.thirst = clamp(n.thirst + m * (100 / (11 * 60)) * (1 + n.heat / 100), 0, 100);
    n.fatigue = clamp(n.fatigue + m * (100 / (19 * 60)) * (1 + n.drunk * 0.5), 0, 100);
    n.bladder = clamp(n.bladder + m * (100 / (14 * 60)), 0, 100);
    n.dirt = clamp(n.dirt + m * (100 / (40 * 60)), 0, 100);
    // alcohol burns off ~0.15 per game hour
    n.drunk = Math.max(0, n.drunk - m * (0.13 / 60));
    // stress dynamics
    let ds = 0;
    for (const k of ['hunger', 'thirst', 'fatigue', 'bladder', 'dirt']) if (n[k] > 70) ds += (n[k] - 70) / 30 * 0.08;
    ds -= n.drunk * 0.1;
    if (ds <= 0) ds = -0.02;
    n.stress = clamp(n.stress + ds * m, 0, 100);
    // health
    let dh = 0;
    if (n.hunger >= 100) dh -= 0.25; if (n.thirst >= 100) dh -= 0.45;
    if (n.heat > 85) dh -= (n.heat - 85) * 0.08;
    if (n.drunk > 1.25) dh -= (n.drunk - 1.25) * 3;
    if (dh === 0 && n.hunger < 80 && n.thirst < 80) dh = 0.05;
    n.health = clamp(n.health + dh * m, 0, 100);
    if (n.health <= 0) {
      const cause = n.thirst >= 100 ? 'died of thirst' : n.hunger >= 100 ? 'starved to death' : n.heat > 85 ? 'overheated in the sauna' : n.drunk > 1.25 ? 'drank yourself to death' : 'collapsed';
      this.die(cause);
    }
    // fatigue collapse
    if (n.fatigue >= 100 && !this.inVehicle) { g.actions.passOut('You collapsed from exhaustion.'); }
    if (n.fatigue >= 100 && this.inVehicle && this.inVehicle.speedKmh > 10 && Math.random() < dt * 0.2) { g.ui.toast('You fell asleep at the wheel!'); this.inVehicle.sleepSteer = 2.5; }
    // bladder accident
    if (n.bladder >= 100) { this.wetSelf(); }
    // drunk side effects
    if (n.drunk > 0.85) {
      this.vomitTimer -= dt;
      if (this.vomitTimer < 0) { this.vomitTimer = rand(25, 70) / n.drunk; if (Math.random() < 0.6) g.actions.vomit(); }
    }
    if (n.drunk > 1.0 && !this.inVehicle && Math.random() < dt * 0.02 * n.drunk) { g.actions.passOut('You blacked out. Too much kalja.'); }
    // peeing
    if (this.peeing) {
      n.bladder = Math.max(0, n.bladder - dt * 9);
      if (n.bladder <= 0) this.stopPee();
    }
    // sauna heat cools down outside
    if (!g.sauna || !g.sauna.playerInside) n.heat = Math.max(0, n.heat - m * 2.5);
  }

  hurt(amount, cause = 'injuries') {
    if (this.dead) return;
    this.n.health -= amount;
    this.game.fx.hurt = Math.min(1, this.game.fx.hurt + amount / 40);
    if (this.n.health <= 0) this.die(cause);
  }
  die(cause) {
    if (this.dead) return;
    this.dead = true;
    this.game.actions.death(cause);
  }

  startPee() {
    if (this.inVehicle || this.n.bladder < 5) return;
    this.peeing = true;
    this.peeSound = audio.loop('stream', this.pos);
    this.peeSound && this.peeSound.set(1);
    this.game.actions.peeStarted();
  }
  stopPee() {
    this.peeing = false;
    if (this.peeSound) { this.peeSound.stop(); this.peeSound = null; }
  }
  wetSelf() {
    this.n.bladder = 0; this.n.dirt = Math.min(100, this.n.dirt + 35); this.n.stress = Math.min(100, this.n.stress + 20);
    this.game.ui.toast('Oh no. You wet your pants. Perkele.');
    this.game.stats.wetPants = (this.game.stats.wetPants || 0) + 1;
    this.game.achieve('wet', 'Damp Situation', 'Didn\'t make it to the outhouse');
  }
}
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3();
