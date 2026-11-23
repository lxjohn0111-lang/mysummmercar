import * as THREE from 'three';
import { audio } from '../core/audio.js';

// ------------------------------------------------------------------------------------------------
// Guided tutorial: one clear goal at a time, a big arrow in the world, chevrons on the ground,
// a compass card at the top and a short instruction when the player arrives.
// Text tokens like {E} become key chips on desktop and button names on phones.
// ------------------------------------------------------------------------------------------------

const near = (a, b, r) => a && b && a.distanceTo(b) < r;

// A "fit a part" step: pick it up -> bring it to the ghost -> tighten it
function fitPart(type, slots, label) {
  const slotOf = (g) => slots.find((s) => g.car.slots[s] && g.car.slots[s].def.type === type);
  return {
    phase(g) {
      const car = g.car, held = g.interact.held;
      const s = slotOf(g);
      if (s) {
        const inst = car.slots[s];
        if (car.tightFrac(inst) >= 0.999) return { done: true };
        const tb = Math.floor(inst.tight / 8), nb = inst.def.bolts;
        return { target: inst.mesh.getWorldPosition(new THREE.Vector3()), radius: 3.5, always: true,
          text: `Tighten the bolts: press {F} for the wrench, aim at the ${label} and use {WHEEL}. (${tb}/${nb} bolts)` };
      }
      if (held && held.part && held.part.def.type === type) {
        const free = slots.find((sl) => car.slotAvailable(sl, held.part)) || slots[0];
        const p = car.slotWorld(free) || car.pos;
        return { target: p.clone(), radius: 2.6, text: 'Hold it under the arrow on the car. When a green ghost part appears, press {E} to fit it.', farText: 'Carry it to the arrow on the car.' };
      }
      // find the nearest loose part of this type
      let best = null, bd = 1e9;
      for (const inst of car.parts.values()) {
        if (inst.slot || inst.def.type !== type || !inst.ent || !inst.ent.body) continue;
        const d = inst.mesh.position.distanceTo(g.player.pos);
        if (d < bd) { bd = d; best = inst; }
      }
      if (!best) return { target: g.spots.partsClerk, radius: 5, text: `You have no ${label}. Buy one at Rautalan Varaosa.` };
      return { target: best.mesh.position.clone(), radius: 2.4, text: `Look at the ${label} under the arrow and press {LMB} to pick it up.`, farText: `Walk to the arrow. The ${label} is there.` };
    },
  };
}

function hasGoodPart(g, type, n = 1) {
  let c = 0;
  for (const inst of g.car.parts.values()) if (inst.def.type === type && inst.cond > 0.5) c++;
  const d = g.state.deliveryPending;
  if (d) for (const it of d.list) if ((it.id === type || it.id.startsWith(type)) && !it.id.startsWith('panel')) c += it.n;
  return c >= n;
}

const STEPS = [
  { id: 'welcome', title: 'Welcome to Kurkijärvi!', always: true, text: 'Your uncle left you a house, a van and a car in pieces. Follow the yellow arrows!', auto: 5, reward: 0 },
  { id: 'mailbox', title: 'Check the mailbox', target: (g) => g.spots.mailbox, radius: 3.5, text: 'Press {E} to open the mailbox.', done: (g) => (g.state.mail || []).length === 0, reward: 20 },
  {
    id: 'letter', title: 'Read the letter',
    target: (g) => g.items.list.find((e) => e.defId === 'mail')?.mesh.position.clone() || g.spots.mailbox, radius: 4.5,
    text: 'Look at the letter on the ground and press {E} to read it. Take the money!',
    done: (g) => g.state.tutFlags?.letter || !g.items.list.some((e) => e.defId === 'mail'), reward: 0,
  },
  { id: 'garage', title: 'Go to the garage', target: (g) => g.spots.garage.clone().add(new THREE.Vector3(0, 0, 3)), radius: 5, text: 'This is your Ruska 1300. It is in pieces. You will build it, part by part!', autoArrive: 4, reward: 25 },
  { id: 'list', title: 'Open the car list', always: true, text: 'Press {TAB} to open the car list. It shows every part the car still needs. Press {TAB} again to close it.', done: (g) => g.tutSheetSeen, reward: 15 },
  { id: 'strut', title: 'Fit your first part', fit: fitPart('strut', ['strutFL', 'strutFR'], 'front strut (the spring)'), reward: 40 },
  { id: 'disc', title: 'Fit a brake disc', fit: fitPart('disc', ['discFL', 'discFR'], 'brake disc'), reward: 40 },
  { id: 'wheel', title: 'Put a wheel on', fit: fitPart('wheel', ['wheelFL', 'wheelFR'], 'wheel'), reward: 60 },
  {
    id: 'lunch', title: 'Time for lunch',
    dyn(g) {
      const held = g.interact.held;
      if (held && held.defId === 'sausageCooked') return { always: true, text: 'Press {E} to eat it. Keep an eye on hunger and thirst in the corner!' };
      if (held && held.defId === 'sausage') return { target: g.spots.stove, radius: 2.5, text: 'Press {E} at the stove to cook the sausage.' };
      const s = g.items.list.find((e) => e.defId === 'sausage' || e.defId === 'sausageCooked');
      if (!s) return { target: g.spots.shopFront, radius: 6, text: 'No food at home. Buy some at the village shop.' };
      return { target: s.mesh.position.clone(), radius: 2.2, text: 'Pick up the sausage with {LMB}.' };
    },
    done: (g) => (g.stats.meals || 0) > 0, reward: 30,
  },
  {
    id: 'van', title: 'Take the van',
    dyn(g) {
      if (g.player.inVehicle === g.van) return { always: true, text: 'Hold {I} to start the engine. {W} gas, {S} brake, {AD} steer.' };
      return { target: g.van.pos.clone(), radius: 4, text: 'Press {E} to get into the van.' };
    },
    done: (g) => g.player.inVehicle === g.van && g.van.engineOn, reward: 30,
  },
  {
    id: 'village', title: 'Drive to the village shop', target: (g) => g.spots.shopFront, radius: 14, drive: true,
    text: 'Park here. Press {E} to get out and walk into the shop.', farText: 'Follow the arrows to Kurkimäki village. {M} opens the map.',
    done: (g) => !g.player.inVehicle && g.player.pos.distanceTo(g.spots.shopkeeper) < 9, reward: 40,
  },
  {
    id: 'tarja', title: 'Ask for work', jobOk: true, target: (g) => g.spots.shopkeeper, radius: 3.8,
    text: 'Talk to Tarja ({E}). Choose "Any work?"', farText: 'Find Tarja behind the counter.',
    done: (g) => g.jobs.active?.type === 'paper' || (g.stats.jobs || 0) > 0, reward: 20,
  },
  {
    id: 'paper', title: 'Deliver the newspapers', jobOk: true,
    dyn(g) {
      const m = g.jobs.active?.type === 'paper' ? g.jobs.markers().find((k) => k.icon === '📰') : null;
      if (!m) return { always: true, text: 'Finish the job to get paid.' };
      return { target: m.pos, radius: 6, drive: true, text: 'Stop next to the mailbox and press {E}.', farText: 'Drive to the next mailbox. Follow the arrows.' };
    },
    done: (g) => (g.stats.jobs || 0) > 0, reward: 60,
  },
  {
    id: 'parts', title: 'Buy the missing parts', target: (g) => g.spots.partsClerk, radius: 4.5, drive: true,
    text: 'Talk to Jussi ({E}). Buy 4 spark plugs, a fan belt and an oil filter.', farText: 'Drive to the parts store in Rautala. {M} opens the map. (Or order by phone at home.)',
    done: (g) => hasGoodPart(g, 'plug', 4) && hasGoodPart(g, 'belt') && hasGoodPart(g, 'oilfilter'), reward: 50,
  },
  {
    id: 'build', title: 'Finish the Ruska',
    dyn(g) {
      const c = g.car.completion();
      const probs = g.car.startProblems();
      const next = probs[0] ? `Next: ${probs[0]}.` : 'Hold {I} in the car to start it.';
      return { target: g.car.onStands ? g.spots.garage.clone() : g.car.pos.clone(), radius: 6, always: true, progress: c.pct, text: `Fit and tighten every part (${Math.round(c.pct * 100)}%). {TAB} shows what is missing. ${next}` };
    },
    done: (g) => !!g.state.carStartedOnce, reward: 200,
  },
  {
    id: 'inspect', title: 'Pass the inspection', target: (g) => g.spots.inspectionBay, radius: 8, drive: true,
    text: 'Park the Ruska inside the hall and talk to Inspector Mattila ({E}).', farText: 'Drive the Ruska to the inspection hall in Rautala.',
    done: (g) => g.car.registered, reward: 150,
  },
  {
    id: 'rally', title: 'Drive a rally stage', target: (g) => g.spots.rallyDesk, radius: 5, drive: true,
    text: 'Talk to Jari ({E}). Practice is free any day; the real race is Saturday 12–18.', farText: 'Drive to the rally office in the north-west forest.',
    done: (g) => !!g.achievements.rally1, reward: 100,
  },
];

// Needs that interrupt the tutorial with their own arrow
const NEEDS = [
  { id: 'tired', when: (g) => g.player.n.fatigue > 78, title: 'You are very tired', target: (g) => g.spots.bed, radius: 2.5, text: 'Press {E} at your bed to sleep. Sleeping also saves the game.', done: (g) => g.player.n.fatigue < 30 },
  { id: 'thirsty', when: (g) => g.player.n.thirst > 80, title: 'You are thirsty', target: (g) => g.spots.tap, radius: 2.5, text: 'Press {E} at the kitchen tap to drink.', done: (g) => g.player.n.thirst < 40 },
  { id: 'hungry', when: (g) => g.player.n.hunger > 82, title: 'You are hungry', target: (g) => g.spots.shopFront, radius: 6, text: 'Buy food at the shop, or eat something from home.', done: (g) => g.player.n.hunger < 50 },
  { id: 'bladder', when: (g) => g.player.n.bladder > 85, title: 'You need the toilet', target: (g) => g.spots.toilet, radius: 2.5, text: 'Use the toilet ({E}), or just press {P} behind a tree.', done: (g) => g.player.n.bladder < 30 },
];

export class Tutorial {
  constructor(game) {
    this.game = game;
    this.t = 0; this.arriveT = 0; this.autoT = 0;
    this.buildMarkers(game.scene);
    this.lastStep = -1;
  }
  get state() { const s = this.game.state; return (s.tut ||= { i: 0, skipped: false }); }
  get active() { return !this.state.skipped && this.state.i < STEPS.length; }
  skip() { this.state.skipped = true; this.game.ui.toast('Tutorial skipped. Pause menu → "Restart tutorial" brings it back.', 4); this.hideMarkers(); }
  restart() { this.state.skipped = false; this.state.i = Math.min(this.state.i, STEPS.length - 1); }

  // ---------------------------------------------------------------- 3D guide markers
  buildMarkers(scene) {
    const yellow = new THREE.MeshBasicMaterial({ color: 0xffd23a, toneMapped: false });
    const rim = new THREE.MeshBasicMaterial({ color: 0x3a2400, side: THREE.BackSide, toneMapped: false });
    this.arrowMats = [yellow, rim];
    const arrow = new THREE.Group();
    const shaft = new THREE.CylinderGeometry(0.14, 0.14, 0.7, 14); shaft.translate(0, 0.75, 0);
    const head = new THREE.ConeGeometry(0.36, 0.55, 18); head.rotateX(Math.PI); head.translate(0, 0.27, 0);
    for (const g of [shaft, head]) { arrow.add(new THREE.Mesh(g, yellow)); const o = new THREE.Mesh(g, rim); o.scale.setScalar(1.12); arrow.add(o); }
    arrow.renderOrder = 10;
    this.arrow = arrow; scene.add(arrow);
    // light beam
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform float uT; void main(){ float a = (1.0 - vUv.y) * 0.42 * (0.8 + 0.2 * sin(uT * 3.0 + vUv.y * 20.0)); gl_FragColor = vec4(1.0, 0.82, 0.25, a); }',
    });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 80, 16, 1, true), beamMat);
    this.beam.geometry.translate(0, 40, 0);
    scene.add(this.beam);
    // pulsing ground ring
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 40), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.ring.rotation.x = -Math.PI / 2; scene.add(this.ring);
    // ground chevrons from the player toward the goal
    const sh = new THREE.Shape();
    sh.moveTo(-0.45, -0.2); sh.lineTo(0, 0.25); sh.lineTo(0.45, -0.2); sh.lineTo(0.45, -0.42); sh.lineTo(0, -0.02); sh.lineTo(-0.45, -0.42); sh.closePath();
    const cg = new THREE.ShapeGeometry(sh); cg.rotateX(-Math.PI / 2); cg.rotateY(Math.PI); // tip points along +z
    this.chev = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -6 }));
      m.renderOrder = 9; scene.add(m); this.chev.push(m);
    }
    this.hideMarkers();
  }
  hideMarkers() { this.arrow.visible = this.beam.visible = this.ring.visible = false; for (const c of this.chev) c.visible = false; }

  placeMarkers(target, arrived, dt, drive) {
    const g = this.game;
    const cam = g.camera.position;
    const t = this.t;
    const d = target.distanceTo(cam);
    // big from afar, small and see-through up close so it never hides the thing you need to look at
    const s = d < 6 ? 0.3 + d * 0.117 : Math.min(7, d / 14);
    const fade = d < 3.2 ? 0.35 + (d - 1) * 0.3 : 1;
    for (const m of this.arrowMats) { m.opacity = Math.max(0.3, Math.min(1, fade)); m.transparent = fade < 1; }
    this.arrow.visible = true;
    this.arrow.position.set(target.x, target.y + 0.35 + (s - 1) * 0.8 + (0.6 + Math.sin(t * 3.2)) * 0.12 * s, target.z);
    this.arrow.scale.setScalar(s);
    this.arrow.rotation.y = t * 1.5;
    this.beam.visible = d > 12;
    this.beam.position.set(target.x, target.y, target.z);
    this.beam.scale.set(Math.max(1, d / 60), 1, Math.max(1, d / 60));
    this.beam.material.uniforms.uT.value = t;
    const th = g.terrain.getHeight(target.x, target.z);
    let ry = th;
    if (!g.player.inVehicle) { const fy = g.player.feetY(); if (Math.abs(target.y - fy) < 2.5) ry = Math.max(th, fy); }
    this.ring.visible = d < 60;
    this.ring.position.set(target.x, ry + 0.06, target.z);
    const pulse = 1 + (t * 1.2 % 1) * 0.6;
    this.ring.scale.setScalar(pulse * (drive ? 3 : 1));
    this.ring.material.opacity = 0.9 * (1 - (t * 1.2 % 1));
    // chevrons
    const from = g.player.inVehicle ? g.player.inVehicle.pos.clone() : g.player.pos.clone();
    const dir = new THREE.Vector3(target.x - from.x, 0, target.z - from.z);
    const dist = dir.length();
    const showChev = !arrived && dist > 4;
    dir.normalize();
    const spacing = g.player.inVehicle ? 4.5 : 1.5, start = g.player.inVehicle ? 7 : 1.8;
    const baseFeet = g.player.inVehicle ? null : g.player.feetY();
    const baseTerr = g.terrain.getHeight(from.x, from.z);
    this.chev.forEach((c, i) => {
      const k = start + i * spacing;
      if (!showChev || k > dist - 1.5) { c.visible = false; return; }
      const x = from.x + dir.x * k, z = from.z + dir.z * k;
      const th = g.terrain.getHeight(x, z);
      const y = baseFeet !== null ? baseFeet + (th - baseTerr) + 0.06 : th + 0.12;
      c.visible = true;
      c.position.set(x, y, z);
      c.rotation.y = Math.atan2(dir.x, dir.z);
      const sc = g.player.inVehicle ? 2.4 : 1;
      c.scale.setScalar(sc);
      const wave = (t * 2.2 - i * 0.28) % 1;
      c.material.opacity = 0.25 + 0.7 * Math.max(0, 1 - Math.abs(wave - 0.5) * 2.2);
    });
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const g = this.game, ui = g.ui;
    this.t += dt;
    // a job, race or police chase takes over the card (the tutorial waits); urgent needs come first
    const jm = g.jobs.markers()[0];
    const busy = g.rally?.active || g.traffic?.pol?.state === 'pursuit';
    let cur = null, stepNo = 0;
    const need = busy ? null : NEEDS.find((n) => (this.need === n.id ? !n.done(g) : n.when(g)));
    if (need) { this.need = need.id; cur = { ...need, interrupt: true }; } else this.need = null;
    if (!cur && this.active) {
      stepNo = this.state.i;
      const st = STEPS[stepNo];
      if (!(ui.jobText || jm) || st.jobOk) {
        cur = st;
        if (stepNo !== this.lastStep) { this.lastStep = stepNo; this.arriveT = 0; this.autoT = 0; this.shownArrive = false; }
      }
    }
    if (!cur && (ui.jobText || jm)) {
      cur = { title: ui.jobText || jm.label, text: ui.jobSub || '', job: true, drive: true, radius: 6, always: true, target: jm ? () => jm.pos : null };
    }
    if (!cur) { this.hideMarkers(); ui.setGuide(null); return; }
    // resolve dynamic content
    let info = { title: cur.title, text: cur.text, farText: cur.farText, radius: cur.radius || 4, always: cur.always, drive: cur.drive, progress: null };
    let target = cur.target ? cur.target(g) : null;
    let doneNow = false;
    if (cur.fit) { const ph = cur.fit.phase(g); if (ph.done) doneNow = true; else { target = ph.target; info.text = ph.text; info.farText = ph.farText; info.radius = ph.radius; info.always = ph.always; } }
    if (cur.dyn) { const ph = cur.dyn(g); target = ph.target || null; info.text = ph.text; if (ph.farText) info.farText = ph.farText; info.radius = ph.radius || info.radius; info.always = ph.always; if (ph.drive !== undefined) info.drive = ph.drive; if (ph.progress !== undefined) info.progress = ph.progress; }
    const me = g.player.inVehicle ? g.player.inVehicle.pos : g.player.pos;
    const dist = target ? Math.hypot(target.x - me.x, target.z - me.z) : 0;
    const arrived = !target || dist < info.radius;
    if (arrived) this.arriveT += dt;
    if (target) this.placeMarkers(target, arrived && !info.drive, dt, info.drive && dist > info.radius);
    else this.hideMarkers();
    // instruction text: show when arrived (or always for "anywhere" steps); otherwise a short travel hint
    let text = '';
    if (info.always || arrived) text = info.text;
    else text = info.farText || 'Follow the yellow arrow.';
    if (arrived && !this.shownArrive && target && !cur.interrupt) { this.shownArrive = true; audio.play('notify'); }
    // compass angle relative to the camera
    let angle = null;
    if (target && !arrived) {
      const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(g.camera.quaternion); camDir.y = 0; camDir.normalize();
      const to = new THREE.Vector3(target.x - g.camera.position.x, 0, target.z - g.camera.position.z).normalize();
      angle = Math.atan2(camDir.x * to.z - camDir.z * to.x, camDir.x * to.x + camDir.z * to.z);
    }
    ui.setGuide({
      title: cur.title, text, dist: target && !arrived ? dist : null, angle, arrived,
      step: cur.interrupt || cur.job ? null : stepNo + 1, total: STEPS.length, progress: info.progress, interrupt: !!cur.interrupt, job: !!cur.job,
      target: target && !arrived ? target : null,
    });
    // completion
    if (cur.interrupt || cur.job) return;
    if (this.cool > 0) { this.cool -= dt; return; }
    if (!doneNow && cur.done) doneNow = cur.done(g);
    if (!doneNow && cur.auto) { this.autoT += dt; if (this.autoT > cur.auto) doneNow = true; }
    if (!doneNow && cur.autoArrive && arrived && this.arriveT > cur.autoArrive) doneNow = true;
    if (doneNow) this.complete(cur);
  }

  isDone(step) {
    const g = this.game;
    try { return step.fit ? !!step.fit.phase(g).done : step.done ? !!step.done(g) : false; } catch (e) { return false; }
  }
  // saves from before the tutorial existed: jump past everything already achieved, without rewards
  fastForward() {
    let last = -1;
    STEPS.forEach((st, i) => { if (this.isDone(st)) last = i; });
    this.state.i = last + 1;
  }

  complete(step) {
    const g = this.game;
    this.state.i++;
    this.cool = 1.6;
    if (step.reward) g.earn(step.reward, 'Tutorial');
    const next = STEPS[this.state.i];
    g.ui.celebrate(step.id === 'welcome' ? 'Let\'s go!' : 'Done!', next ? `Next: ${next.title}` : 'Tutorial complete! You know everything. Have a great summer!');
    audio.play('achievement');
    if (!next) { g.achieve('tutorial', 'Local Hero', 'Finished the tutorial'); this.hideMarkers(); }
    g.saveGame();
  }
}
export { STEPS };
