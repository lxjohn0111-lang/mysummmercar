import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/util.js';
import { audio } from '../core/audio.js';
import { WATER_LEVEL } from '../world/layout.js';

const UP = new THREE.Vector3(0, 1, 0);

// Generic raycast vehicle with engine/gearbox simulation. Local frame: +z forward, +y up, +x left.
export class Vehicle {
  constructor(game, cfg) {
    this.game = game;
    this.cfg = cfg;
    this.name = cfg.name;
    this.kind = cfg.kind || 'car';
    this.root = new THREE.Group();
    this.root.name = cfg.name;
    game.scene.add(this.root);
    this.wheelVis = [];
    this.rpm = 0; this.gear = 0; this.clutch = 1; this.throttle = 0; this.brake = 0; this.steer = 0; this.handbrake = 0;
    this.engineOn = false; this.ignition = false; this.cranking = 0; this.lights = false; this.choke = false;
    this.fuel = cfg.fuelCap ?? 30; this.fuelCap = cfg.fuelCap ?? 30;
    this.health = 100; this.engineTemp = 20;
    this.speed = 0; this.speedKmh = 0;
    this.driver = null;
    this.camMode = game.input?.mobile ? 1 : 0; // 0 first person, 1 chase (phones start in chase view)
    this.lookYaw = 0; this.lookPitch = -0.08;
    this.prevVel = new THREE.Vector3();
    this.lastImpact = 0;
    this.surfaces = [];
    this.skid = 0;
    this.sleepSteer = 0;
    this.horn = false;
    this.locked = false;
    this.autoClutch = true;
    this.odometer = 0;
    this.seatbelt = false;
    this.hornTimer = 0;
  }

  // ---------------------------------------------------------------- physics setup
  createBody(pos, ry = 0, fixed = false) {
    const g = this.game, ph = g.physics, R = ph.R, cfg = this.cfg;
    const q = new THREE.Quaternion().setFromAxisAngle(UP, ry);
    const bd = (fixed ? R.RigidBodyDesc.fixed() : R.RigidBodyDesc.dynamic()).setTranslation(pos.x, pos.y, pos.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setLinearDamping(0.05).setAngularDamping(0.6).setCcdEnabled(true);
    this.body = ph.world.createRigidBody(bd);
    this.colliders = [];
    for (const c of cfg.colliders) {
      const cd = R.ColliderDesc.cuboid(...c.half).setTranslation(...c.pos).setFriction(0.5).setRestitution(0.05).setDensity(0.0001);
      ph.setGroups(cd, 'vehicle');
      const col = ph.world.createCollider(cd, this.body);
      ph.tag(col, { vehicle: this, surface: 'metal' });
      this.colliders.push(col);
    }
    this.setMass(cfg.mass);
    this.controller = ph.world.createVehicleController(this.body);
    this.controller.indexUpAxis = 1;
    this.controller.setIndexForwardAxis = 2;
    for (const w of cfg.wheels) {
      this.controller.addWheel({ x: w.pos[0], y: w.pos[1], z: w.pos[2] }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, w.rest ?? 0.3, w.radius);
    }
    this.applyWheelParams();
    this.ph = ph;
  }

  setMass(mass) {
    const R = this.game.physics.R;
    const [hx, hy, hz] = this.cfg.inertiaHalf || [0.8, 0.5, 2];
    const com = this.cfg.com || [0, 0, 0];
    // put all mass on the first collider via explicit mass props
    const c0 = this.colliders[0];
    c0.setMassProperties(mass, { x: com[0], y: com[1], z: com[2] },
      { x: mass / 3 * (hy * hy + hz * hz), y: mass / 3 * (hx * hx + hz * hz), z: mass / 3 * (hx * hx + hy * hy) }, { x: 0, y: 0, z: 0, w: 1 });
    this.mass = mass;
  }

  applyWheelParams() {
    const vc = this.controller;
    this.cfg.wheels.forEach((w, i) => {
      vc.setWheelSuspensionStiffness(i, w.stiffness ?? 28);
      vc.setWheelSuspensionCompression(i, w.compression ?? 2.4);
      vc.setWheelSuspensionRelaxation(i, w.relaxation ?? 3.2);
      vc.setWheelMaxSuspensionTravel(i, w.travel ?? 0.22);
      vc.setWheelMaxSuspensionForce(i, 60000);
      vc.setWheelFrictionSlip(i, w.grip ?? 1.6);
      vc.setWheelSideFrictionStiffness(i, w.side ?? 1.0);
    });
  }

  get pos() { const t = this.body.translation(); return _p.set(t.x, t.y, t.z); }
  get quat() { const r = this.body.rotation(); return _q.set(r.x, r.y, r.z, r.w); }
  toWorld(local, out = new THREE.Vector3()) { return out.copy(local).applyQuaternion(this.quat).add(this.pos); }
  forwardVec(out = new THREE.Vector3()) { return out.set(0, 0, 1).applyQuaternion(this.quat); }

  // ---------------------------------------------------------------- overridable stats
  wheelOk(i) { return true; }
  canCrank() { return this.fuel > 0 ? { ok: true } : { ok: true }; }
  startProblems() { return this.fuel <= 0 ? ['no fuel'] : []; }
  engineStats() {
    const e = this.cfg.engine;
    return { torque: e.torque, peak: e.peak, redline: e.redline, idle: e.idle, gears: this.cfg.gears, final: this.cfg.final, reverse: this.cfg.reverse, brake: this.cfg.brake ?? 32, misfire: 0, exhaust: e.exhaust ?? 0.3, turbo: 0 };
  }
  get drivable() { return true; }

  // ---------------------------------------------------------------- per physics-step
  physicsStep(dt) {
    if (!this.body) return;
    if (this.body.isSleeping() && !this.driver && !this.engineOn) return;
    const vc = this.controller, cfg = this.cfg;
    const st = this.engineStats();
    const speed = vc.currentVehicleSpeed();
    this.speed = speed; this.speedKmh = Math.abs(speed) * 3.6;
    const wheelR = cfg.wheels.find((w) => w.drive)?.radius || 0.3;
    const gears = st.gears;
    // controls already set by update(): throttle, brake, steer, handbrake, gear, clutchPedal
    let ratio = 0;
    if (this.gear > 0) ratio = gears[this.gear - 1] * st.final;
    else if (this.gear < 0) ratio = -st.reverse * st.final;
    const wheelRpm = (speed / wheelR) * 60 / (2 * Math.PI);
    const coupledRpm = Math.abs(wheelRpm * ratio);
    // clutch engagement
    let c = 1 - (this.clutchPedal || 0);
    if (this.gear === 0) c = 0;
    const launch = st.idle + 250 + this.throttle * Math.min(2400, st.redline * 0.35);
    if (this.autoClutch && this.gear !== 0) {
      const auto = clamp((coupledRpm - st.idle * 0.8) / Math.max(200, launch - st.idle * 0.8), 0, 1);
      c = Math.min(c, Math.max(auto * auto * (3 - 2 * auto), this.throttle > 0.05 ? 0.3 + 0.45 * this.throttle : 0));
      if (this.throttle < 0.05 && coupledRpm < st.idle) c = 0;
      if (this.brake > 0.1 && coupledRpm < st.idle * 1.2) c = 0;
    }
    this.clutch = c;
    // engine torque
    let engineTorque = 0;
    if (this.engineOn) {
      const x = (this.rpm - st.peak) / (st.redline * 0.55);
      let curve = clamp(1 - x * x * 0.9, 0.25, 1);
      if (this.rpm < st.idle) curve *= 0.6;
      let thr = this.throttle;
      if (this.rpm > st.redline) thr = 0; // limiter
      // misfire
      if (st.misfire > 0 && Math.random() < st.misfire) thr *= 0.2;
      // turbo boost
      const boost = st.turbo > 0 ? st.turbo * clamp((this.rpm - 2600) / 1800, 0, 1) * thr : 0;
      this.boost = damp(this.boost || 0, boost, 2.2, dt);
      engineTorque = st.torque * curve * thr * (1 + this.boost) - (1 - thr) * st.torque * 0.18 * (this.rpm / st.redline);
      // idle governor
      if (this.rpm < st.idle && thr < 0.2) engineTorque += st.torque * 0.3 * clamp((st.idle - this.rpm) / 300, 0, 1);
    }
    // rpm integration
    if (!this.engineOn) {
      this.rpm = this.cranking > 0 ? 260 + Math.sin(performance.now() / 70) * 50 : Math.max(0, this.rpm - this.rpm * 4 * dt - 200 * dt);
    } else if (c <= 0.001) {
      // free revving
      this.rpm += (engineTorque / Math.max(20, st.torque)) * 9000 * dt - 900 * dt * (1 - this.throttle);
      if (this.rpm < st.idle) this.rpm = damp(this.rpm, st.idle, 8, dt);
    } else if (c >= 0.999) {
      this.rpm = damp(this.rpm, coupledRpm, 25, dt);
      if (this.rpm < 380 && !this.autoClutch) this.stall();
    } else {
      // slipping clutch: driver holds revs near the launch point
      this.rpm = damp(this.rpm, Math.max(coupledRpm, launch), 10, dt);
    }
    this.rpm = clamp(this.rpm, 0, st.redline * 1.06);
    // force to wheels
    let drive = 0;
    if (this.engineOn && this.gear !== 0 && c > 0) {
      const transmitted = engineTorque * (c >= 0.999 ? 1 : 0.45 + c * 0.55);
      drive = (transmitted * ratio * 0.88) / wheelR;
    }
    // fake drag
    const drag = -Math.sign(speed) * (0.42 * speed * speed + 9 * Math.abs(speed)) * (cfg.dragMul ?? 1);
    const driveWheels = cfg.wheels.map((w, i) => (w.drive && this.wheelOk(i) ? i : -1)).filter((i) => i >= 0);
    const nd = Math.max(1, driveWheels.length);
    // surfaces / grip
    const wet = this.game.sky.rain;
    cfg.wheels.forEach((w, i) => {
      const ok = this.wheelOk(i);
      const surf = this.surfaces[i] || 'terrain';
      let gmul = surf === 'asphalt' ? 1.0 : surf === 'gravel' ? 0.78 : surf === 'concrete' ? 0.95 : surf === 'wood' ? 0.85 : 0.68;
      gmul *= 1 - wet * 0.2;
      gmul *= this.gripMul ? this.gripMul(i, surf) : 1;
      let grip = (w.grip ?? 1.6) * gmul;
      if (w.handbrake && this.handbrake > 0.5) grip *= 0.55;
      vc.setWheelFrictionSlip(i, ok ? grip : 0.05);
      vc.setWheelEngineForce(i, ok && driveWheels.includes(i) ? (drive + drag) / nd : 0);
      let b = this.brake * (st.brake) * (w.brakeBias ?? 1);
      if (w.handbrake) b = Math.max(b, this.handbrake * (st.brake * 1.4));
      if (!this.engineOn && !this.driver && this.gear === 0 && Math.abs(speed) < 1) b = Math.max(b, 6); // parked
      if (this.parkBrake) b = Math.max(b, 12);
      vc.setWheelBrake(i, ok ? b : 2);
      vc.setWheelSteering(i, w.steer ? this.steer * (w.steerMul ?? 1) : 0);
      if (!ok) vc.setWheelRadius(i, 0.04); else vc.setWheelRadius(i, w.radius);
    });
    vc.updateVehicle(dt, undefined, this.game.physics.groups('vehicle') & ~(0x0008 | 0x0002 | 0x0010) | (0xffff << 16), (col) => {
      const t = this.game.physics.tagOf(col);
      return !(t && (t.item || t.player || t.vehicle === this));
    });
    for (let i = 0; i < cfg.wheels.length; i++) {
      const ground = vc.wheelGroundObject(i);
      this.surfaces[i] = ground ? (this.game.physics.tagOf(ground)?.surface || 'terrain') : null;
    }
    // stabilisation (anti-roll + moped balance)
    this.stabilise(dt);
    // crash detection
    const v = this.body.linvel();
    _v.set(v.x, v.y, v.z);
    const dv = _v2.copy(_v).sub(this.prevVel);
    dv.y += 9.81 * dt;
    const impact = dv.length();
    if (impact > 4.5 && performance.now() - this.lastImpact > 250) {
      this.lastImpact = performance.now();
      const localDir = _v3.copy(dv).negate().applyQuaternion(_q2.copy(this.quat).invert());
      this.onImpact(impact, localDir);
    }
    this.prevVel.copy(_v);
    // water
    const p = this.pos;
    if (p.y < WATER_LEVEL - 0.2 && this.game.terrain.getHeight(p.x, p.z) < WATER_LEVEL - 0.4) {
      const depth = WATER_LEVEL - p.y;
      this.body.applyImpulse({ x: -v.x * this.mass * 0.03, y: this.mass * 9.81 * dt * Math.min(0.85, depth * 0.6), z: -v.z * this.mass * 0.03 }, true);
      if (this.engineOn && depth > 0.3) { this.engineOn = false; this.drowned = true; this.game.ui?.toast(`${this.name}: water in the engine!`); }
      this.submerged = depth > 0.6;
    } else this.submerged = false;
  }

  stabilise(dt) {
    const q = this.quat;
    const up = _v.set(0, 1, 0).applyQuaternion(q);
    const fwd = _v2.set(0, 0, 1).applyQuaternion(q);
    const contact = this.cfg.wheels.some((w, i) => this.controller.wheelIsInContact(i));
    const k = this.cfg.antiRoll ?? 0.35;
    if (contact && up.y > 0.5) {
      // anti-roll: torque about forward axis to keep up vertical-ish
      const roll = new THREE.Vector3().crossVectors(up, UP);
      const rollAxis = roll.dot(fwd);
      const torque = fwd.clone().multiplyScalar(rollAxis * this.mass * k * 10 * dt);
      this.body.applyTorqueImpulse({ x: torque.x, y: torque.y, z: torque.z }, true);
    }
    if (this.kind === 'moped') {
      // keep upright like a balanced bike, lean is visual only
      const err = new THREE.Vector3().crossVectors(up, UP);
      const av = this.body.angvel();
      this.body.applyTorqueImpulse({ x: (err.x * 60 - av.x * 6) * this.mass * dt, y: 0, z: (err.z * 60 - av.z * 6) * this.mass * dt }, true);
    }
    // air control to land on wheels (gentle)
    if (!contact && up.y > 0.2) {
      const av = this.body.angvel();
      this.body.applyTorqueImpulse({ x: -av.x * this.mass * 0.4 * dt, y: 0, z: -av.z * this.mass * 0.4 * dt }, true);
    }
  }

  onImpact(impact, localDir) {
    const sev = clamp((impact - 4.5) / 12, 0, 1.5);
    audio.play('crash', this.pos, 0.3 + sev);
    this.health = Math.max(0, this.health - sev * 18);
    if (this.driver) {
      this.game.player.shake = Math.min(1.2, 0.3 + sev);
      this.game.fx.hurt = Math.min(1, this.game.fx.hurt + sev * 0.4);
      this.driverImpact(impact, sev, localDir);
    }
    this.game.actions.vehicleImpact?.(this, impact, localDir);
  }

  driverImpact(impact, sev, localDir) {
    const P = this.game.player;
    const protect = this.seatbelt ? 0.35 : 1;
    if (impact > 9) P.hurt(sev * 35 * protect, 'died in a car crash');
    if (impact > 16 && !this.seatbelt && this.kind !== 'tractor') this.game.actions.eject?.(this, impact);
  }

  stall() {
    if (!this.engineOn) return;
    this.engineOn = false;
    audio.play('click3', this.pos);
    this.game.ui?.toast('Stalled.');
  }

  // ---------------------------------------------------------------- driving input (called each frame)
  drive(dt, input) {
    const st = this.engineStats();
    const inp = input;
    let steerIn = inp.axis('KeyD', 'KeyA'); // + = left
    if (inp.analog && inp.analog.active) steerIn = -Math.sign(inp.analog.x) * Math.min(1, Math.abs(inp.analog.x) * 1.15);
    const speedF = clamp(this.speedKmh / 110, 0, 1);
    const maxSteer = (this.cfg.maxSteer ?? 0.6) * (1 - speedF * 0.55);
    let targetSteer = steerIn * maxSteer;
    if (this.sleepSteer > 0) { this.sleepSteer -= dt; targetSteer = Math.sin(performance.now() / 400) * 0.25; }
    if (this.grabSteer) targetSteer += this.grabSteer;
    const drunk = this.game.player.n.drunk;
    if (drunk > 0.4) targetSteer += Math.sin(performance.now() / 900) * drunk * 0.04;
    this.steer = damp(this.steer, targetSteer, steerIn === 0 ? 7 : 5 * (this.cfg.steerSpeed ?? 1), dt);
    let w = inp.down('KeyW') ? 1 : 0, s = inp.down('KeyS') ? 1 : 0;
    if (inp.analog && inp.analog.active) { if (inp.analog.y < -0.35) w = Math.max(w, Math.min(1, -inp.analog.y * 1.2)); if (inp.analog.y > 0.5) s = Math.max(s, 1); }
    // smart: S reverses when stopped in reverse gear
    this.throttle = damp(this.throttle, w, 10, dt);
    this.brake = s;
    if (this.gear < 0) { this.throttle = damp(this.throttle, w, 10, dt); }
    this.handbrake = inp.down('Space') ? 1 : 0;
    this.clutchPedal = inp.down('KeyC') ? 1 : 0;
    // gears
    const nG = st.gears.length;
    if (inp.hit('ShiftLeft') || inp.hit('KeyX') || inp.hit('ShiftRight')) { if (this.gear < nG) { this.gear = this.gear === -1 ? 0 : this.gear + 1; audio.play('click', this.pos); } }
    if (inp.hit('KeyQ') || inp.hit('KeyZ')) { if (this.gear > -1) { if (this.gear === 0 && this.speed > 2) { audio.play('metal', this.pos, 0.3); this.game.ui?.toast('Grrrind! Stop before reversing.'); } else { this.gear--; audio.play('click', this.pos); } } }
    // ignition: I toggles, holding I cranks
    if (inp.hit('KeyI')) {
      if (this.engineOn) { this.engineOn = false; this.ignition = false; this.game.ui?.toast('Engine off'); }
      else { this.ignition = true; this._crankT = 0; }
    }
    if (inp.down('KeyI') && !this.engineOn && this.ignition) {
      this._crankT = (this._crankT || 0) + dt;
      if (this._crankT > 0.25) this.crank(dt);
    } else if (this.cranking > 0) { this.cranking = 0; this.stopStarter(); }
    if (inp.hit('KeyL')) { this.lights = !this.lights; audio.play('click', this.pos); }
    if (inp.hit('KeyK')) { this.choke = !this.choke; this.game.ui?.toast(this.choke ? 'Choke pulled' : 'Choke pushed in'); audio.play('click', this.pos); }
    if (inp.hit('KeyB')) { this.seatbelt = !this.seatbelt; audio.play('click', this.pos); this.game.ui?.toast(this.seatbelt ? 'Seatbelt on' : 'Seatbelt off'); }
    if (inp.hit('KeyV')) this.camMode = (this.camMode + 1) % 2;
    this.horn = inp.down('KeyH');
  }

  crank(dt) {
    const prob = this.startProblems();
    const battery = this.batteryOk ? this.batteryOk() : true;
    if (!battery) {
      if (!this._clickT || performance.now() - this._clickT > 600) { this._clickT = performance.now(); audio.play('click3', this.pos); }
      return;
    }
    this.cranking += dt;
    if (!this.starterSnd) { this.starterSnd = audio.loop('starter', this.pos); }
    this.starterSnd?.set(1, this.batteryLevel ? this.batteryLevel() : 1);
    this.drainBattery?.(dt);
    const need = this.startTime ? this.startTime() : 0.7;
    if (prob.length === 0 && this.cranking > need) {
      this.engineOn = true; this.rpm = 1300; this.cranking = 0; this.drowned = false;
      this.stopStarter();
      this.onStart?.();
    }
  }
  stopStarter() { if (this.starterSnd) { this.starterSnd.stop(); this.starterSnd = null; } }

  // ---------------------------------------------------------------- frame update (visuals, audio)
  update(dt) {
    if (!this.body) return;
    const t = this.body.translation(), r = this.body.rotation();
    this.root.position.set(t.x, t.y, t.z);
    this.root.quaternion.set(r.x, r.y, r.z, r.w);
    // wheels
    const vc = this.controller;
    this.cfg.wheels.forEach((w, i) => {
      const vis = this.wheelVis[i];
      if (!vis) return;
      const sl = vc.wheelSuspensionLength(i) ?? w.rest ?? 0.3;
      vis.position.set(w.pos[0], w.pos[1] - sl, w.pos[2]);
      vis.rotation.set(0, 0, 0);
      vis.rotation.y = w.steer ? this.steer * (w.steerMul ?? 1) : 0;
      if (vis.userData.spin) vis.userData.spin.rotation.x = vc.wheelRotation(i) ?? 0;
    });
    // fuel
    if (this.engineOn) {
      const st = this.engineStats();
      const use = (0.00012 + this.throttle * (this.rpm / st.redline) * 0.0022) * (this.cfg.fuelUse ?? 1) * dt * 60 / 60;
      this.fuel = Math.max(0, this.fuel - use);
      if (this.fuel <= 0) { this.engineOn = false; this.game.ui?.toast(`${this.name}: out of fuel!`); }
    }
    this.odometer += Math.abs(this.speed) * dt;
    this.updateAudio(dt);
    this.updateVisualExtras?.(dt);
  }

  updateAudio(dt) {
    const st = this.engineStats();
    const p = this.pos;
    if (this.engineOn || this.rpm > 100) {
      if (!this.engineSnd) this.engineSnd = audio.engine(p, this.cfg.engine.sound || {});
      if (this.engineSnd) {
        this.engineSnd.setPos(p);
        const inside = this.driver && this.camMode === 0 ? 0.75 : 1;
        this.engineSnd.set(this.engineOn ? this.rpm : 0, this.throttle, this.clutch, inside * (this.cfg.engine.volume ?? 1), st.exhaust, this.boost || 0, st.misfire || 0);
      }
    } else if (this.engineSnd) { this.engineSnd.stop(); this.engineSnd = null; }
    // rolling / skid
    const moving = Math.abs(this.speed) > 0.5;
    if (moving && this.driver) {
      if (!this.rollSnd) this.rollSnd = audio.loop('rolling', p);
      const gravel = this.surfaces.some((s) => s === 'gravel' || s === 'terrain') ? 1 : 0;
      this.rollSnd?.set(Math.min(1, this.speedKmh / 80), gravel * Math.min(1, this.speedKmh / 40));
      audio.setPos(this.rollSnd?.out, p);
      // skid estimate from side slip
      const v = this.body.linvel();
      const right = _v.set(1, 0, 0).applyQuaternion(this.quat);
      const side = Math.abs(v.x * right.x + v.y * right.y + v.z * right.z);
      const sk = clamp((side - 2.5) / 6, 0, 1) + (this.handbrake && this.speedKmh > 15 ? 0.5 : 0) + (this.brake && this.speedKmh > 40 ? 0.3 : 0);
      this.skid = damp(this.skid, clamp(sk, 0, 1), 8, dt);
      if (this.skid > 0.05) {
        if (!this.skidSnd) this.skidSnd = audio.loop('skid', p);
        this.skidSnd?.set(this.skid, gravel); audio.setPos(this.skidSnd?.out, p);
      } else if (this.skidSnd) { this.skidSnd.stop(); this.skidSnd = null; }
    } else {
      if (this.rollSnd) { this.rollSnd.stop(); this.rollSnd = null; }
      if (this.skidSnd) { this.skidSnd.stop(); this.skidSnd = null; }
    }
    if (this.horn) { this.hornTimer -= dt; if (this.hornTimer <= 0) { audio.play('horn', p, 0.5); this.hornTimer = 0.25; this.game.actions.honk?.(this); } }
  }

  stopSounds() {
    for (const k of ['engineSnd', 'rollSnd', 'skidSnd', 'starterSnd']) if (this[k]) { this[k].stop(); this[k] = null; }
  }

  // ---------------------------------------------------------------- camera
  updateCamera(dt, cam, mouse) {
    const seat = this.cfg.seat;
    this.lookYaw = clamp(this.lookYaw - mouse.x, -2.4, 2.4);
    this.lookPitch = clamp(this.lookPitch - mouse.y, -1.2, 0.9);
    if (Math.abs(mouse.x) < 0.0001 && this.speedKmh > 20 && this.camMode === 1) this.lookYaw = damp(this.lookYaw, 0, 1.5, dt);
    const q = this.quat;
    if (this.camMode === 0) {
      const p = _v.set(seat[0], seat[1], seat[2]);
      // head movement from g-forces
      const v = this.body.linvel();
      const acc = _v2.set(v.x, v.y, v.z).sub(this._lastV || _v2.clone()).divideScalar(Math.max(dt, 1e-3));
      this._lastV = (this._lastV || new THREE.Vector3()).set(v.x, v.y, v.z);
      const la = acc.applyQuaternion(_q2.copy(q).invert());
      this._head = this._head || new THREE.Vector3();
      this._head.x = damp(this._head.x, clamp(-la.x * 0.006, -0.08, 0.08), 6, dt);
      this._head.z = damp(this._head.z, clamp(-la.z * 0.004, -0.06, 0.06), 6, dt);
      this._head.y = damp(this._head.y, clamp(-la.y * 0.002, -0.04, 0.04), 10, dt);
      p.add(this._head);
      cam.position.copy(p.applyQuaternion(q).add(this.pos));
      const lq = _q2.setFromEuler(_e.set(this.lookPitch, this.lookYaw, 0, 'YXZ'));
      // camera looks along +z in vehicle space: rotate 180 about y since camera looks -z
      cam.quaternion.copy(q).multiply(_q3.setFromAxisAngle(UP, Math.PI)).multiply(lq);
    } else {
      const dist = this.cfg.camDist ?? 6, height = this.cfg.camHeight ?? 2.2;
      const yaw = this.lookYaw;
      const fwd = _v.set(0, 0, 1).applyQuaternion(q); fwd.y = 0; fwd.normalize();
      const back = fwd.clone().applyAxisAngle(UP, yaw).multiplyScalar(-dist);
      const target = this.pos.clone().add(_v2.set(0, 1.0, 0));
      const want = target.clone().add(back).add(_v3.set(0, height + this.lookPitch * -3, 0));
      // keep above terrain
      const th = this.game.terrain.getHeight(want.x, want.z) + 0.5;
      if (want.y < th) want.y = th;
      if (!this._camPos) this._camPos = want.clone();
      this._camPos.lerp(want, 1 - Math.exp(-dt * 8));
      cam.position.copy(this._camPos);
      cam.lookAt(target);
    }
  }

  // ---------------------------------------------------------------- enter/exit helpers
  seatWorld() { return this.toWorld(_v.set(...this.cfg.seat)); }
  exitWorld() { return this.toWorld(_v.set(...this.cfg.exit)); }

  setPose(pos, ry) {
    const q = new THREE.Quaternion().setFromAxisAngle(UP, ry);
    this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.prevVel.set(0, 0, 0);
  }
  flip() {
    const p = this.pos.clone();
    const f = this.forwardVec(); const ry = Math.atan2(f.x, f.z);
    p.y = this.game.terrain.getHeight(p.x, p.z) + 1.2;
    this.setPose(p, ry);
  }
}
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _e = new THREE.Euler();
