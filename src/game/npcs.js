import * as THREE from 'three';
import { canvasTexture, roundBox, clamp, rand, pick, damp } from '../core/util.js';
import { audio } from '../core/audio.js';
import { P } from '../world/layout.js';

// ---------------------------------------------------------------- procedural humans
function faceTex({ skin = '#e0b090', beard = null, mustache = false, glasses = false, eyes = '#3a5a8a', sleepy = false }) {
  return canvasTexture(128, 128, (c) => {
    c.fillStyle = skin; c.fillRect(0, 0, 128, 128);
    // eyes
    for (const x of [44, 84]) {
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, 58, 9, sleepy ? 3 : 6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = eyes; c.beginPath(); c.arc(x, 58, sleepy ? 2.5 : 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#111'; c.beginPath(); c.arc(x, 58, 2, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#4a3020'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 10, 46); c.lineTo(x + 10, 47); c.stroke();
    }
    c.fillStyle = 'rgba(160,80,60,0.35)'; c.beginPath(); c.ellipse(64, 74, 6, 10, 0, 0, Math.PI * 2); c.fill(); // nose
    c.strokeStyle = '#7a3a30'; c.lineWidth = 3; c.beginPath(); c.arc(64, 82, 12, 0.2, Math.PI - 0.2); c.stroke(); // mouth
    if (mustache) { c.fillStyle = beard || '#5a3a20'; c.fillRect(48, 82, 32, 7); }
    if (beard) { c.fillStyle = beard; c.beginPath(); c.ellipse(64, 104, 30, 22, 0, 0, Math.PI); c.fill(); c.fillRect(34, 84, 60, 20); }
    if (glasses) { c.strokeStyle = '#222'; c.lineWidth = 3; for (const x of [44, 84]) { c.strokeRect(x - 13, 49, 26, 18); } c.beginPath(); c.moveTo(57, 56); c.lineTo(71, 56); c.stroke(); }
    c.fillStyle = 'rgba(200,90,80,0.2)'; c.beginPath(); c.arc(36, 76, 8, 0, 7); c.arc(92, 76, 8, 0, 7); c.fill();
  });
}

export function buildHuman(o = {}) {
  const shirt = new THREE.MeshStandardMaterial({ color: o.shirt ?? 0x3a5a8a, roughness: 0.9, map: o.pattern ? patternTex(o.pattern, o.shirt) : null });
  const pants = new THREE.MeshStandardMaterial({ color: o.pants ?? 0x2a2a3a, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: o.skinHex ?? 0xe0b090, roughness: 0.7 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.7 });
  const hairM = new THREE.MeshStandardMaterial({ color: o.hair ?? 0x8a6a3a, roughness: 0.95 });
  const g = new THREE.Group();
  const fat = o.fat ?? 1;
  const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };
  const hips = new THREE.Group(); hips.position.y = 0.92; g.add(hips);
  const torso = mk(roundBox(0.42 * fat, 0.58, 0.26 * fat, 0.1), shirt, 0, 0.32, 0); hips.add(torso);
  if (o.overalls) { const ov = mk(roundBox(0.43 * fat, 0.36, 0.27 * fat, 0.08), pants, 0, 0.16, 0); hips.add(ov); }
  const head = new THREE.Group(); head.position.y = 0.76; hips.add(head);
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex(o.face || {}), roughness: 0.7 });
  const headMesh = mk(new THREE.SphereGeometry(0.13, 18, 14), [skin], 0, 0, 0);
  headMesh.material = skin; head.add(headMesh);
  const face = mk(new THREE.CircleGeometry(0.1, 20), faceMat, 0, -0.005, 0.118); head.add(face);
  face.scale.set(1, 1.15, 1);
  const neck = mk(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 10), skin, 0, -0.14, 0); head.add(neck);
  // hair / hats
  if (o.hat === 'cap') { const cap = mk(new THREE.SphereGeometry(0.135, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: o.hatColor ?? 0xc02020, roughness: 0.8 }), 0, 0.02, 0); head.add(cap); const bill = mk(new THREE.BoxGeometry(0.18, 0.015, 0.12), cap.material, 0, 0.03, 0.15); head.add(bill); }
  else if (o.hat === 'police') { const cap = mk(new THREE.CylinderGeometry(0.15, 0.13, 0.09, 16), new THREE.MeshStandardMaterial({ color: 0x1a2a4a }), 0, 0.1, 0); head.add(cap); head.add(mk(new THREE.BoxGeometry(0.2, 0.012, 0.1), new THREE.MeshStandardMaterial({ color: 0x111111 }), 0, 0.06, 0.13)); }
  else if (o.hat === 'beanie') head.add(mk(new THREE.SphereGeometry(0.138, 16, 8, 0, Math.PI * 2, 0, Math.PI / 1.8), new THREE.MeshStandardMaterial({ color: o.hatColor ?? 0x2a4a2a, roughness: 1 }), 0, 0.01, 0));
  else if (o.hat === 'scarf') head.add(mk(new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), new THREE.MeshStandardMaterial({ color: o.hatColor ?? 0x8a2a4a, roughness: 1 }), 0, 0.0, -0.01));
  else if (!o.bald) head.add(mk(new THREE.SphereGeometry(0.137, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), hairM, 0, 0.01, -0.01));
  // limbs (pivoted)
  const limb = (len, r, mat, x, y, parent) => {
    const piv = new THREE.Group(); piv.position.set(x, y, 0); parent.add(piv);
    const m = mk(new THREE.CapsuleGeometry(r, len, 4, 8), mat, 0, -len / 2 - r * 0.5, 0); piv.add(m);
    return piv;
  };
  const armL = limb(0.48, 0.055, shirt, 0.27 * fat, 0.56, hips), armR = limb(0.48, 0.055, shirt, -0.27 * fat, 0.56, hips);
  for (const a of [armL, armR]) { const hand = mk(new THREE.SphereGeometry(0.05, 8, 6), skin, 0, -0.6, 0); a.add(hand); }
  const legL = limb(0.7, 0.075, pants, 0.11, 0.02, hips), legR = limb(0.7, 0.075, pants, -0.11, 0.02, hips);
  for (const l of [legL, legR]) { const s = mk(new THREE.BoxGeometry(0.12, 0.08, 0.26), shoes, 0, -0.86, 0.05); l.add(s); }
  g.userData.rig = { hips, head, armL, armR, legL, legR, torso };
  return g;
}
function patternTex(kind, base) {
  const col = '#' + new THREE.Color(base ?? 0x3a5a8a).getHexString();
  return canvasTexture(64, 64, (c) => {
    c.fillStyle = col; c.fillRect(0, 0, 64, 64);
    if (kind === 'plaid') { c.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 64; i += 16) { c.fillRect(i, 0, 6, 64); c.fillRect(0, i, 64, 6); } c.fillStyle = 'rgba(255,255,255,0.15)'; for (let i = 8; i < 64; i += 16) { c.fillRect(i, 0, 2, 64); c.fillRect(0, i, 64, 2); } }
    if (kind === 'stripes') { c.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 64; i += 10) c.fillRect(0, i, 64, 4); }
  });
}

export function animateHuman(rig, t, speed, opts = {}) {
  const sw = Math.min(1, speed / 1.6);
  const ph = t * (4 + speed * 2);
  rig.legL.rotation.x = Math.sin(ph) * 0.6 * sw; rig.legR.rotation.x = -Math.sin(ph) * 0.6 * sw;
  rig.armL.rotation.x = -Math.sin(ph) * 0.5 * sw + (opts.wave ? -2.6 + Math.sin(t * 10) * 0.3 : 0); rig.armR.rotation.x = Math.sin(ph) * 0.5 * sw + (opts.talk ? -0.4 + Math.sin(t * 6) * 0.2 : 0);
  rig.armL.rotation.z = 0.08 + (opts.wave ? 0.3 : 0); rig.armR.rotation.z = -0.08;
  rig.hips.position.y = 0.92 + Math.abs(Math.sin(ph)) * 0.03 * sw + Math.sin(t * 2) * 0.004;
  const drunk = opts.drunk || 0;
  rig.hips.rotation.z = Math.sin(t * 1.3) * 0.1 * drunk;
  rig.hips.rotation.x = Math.sin(t * 0.9) * 0.06 * drunk;
  rig.head.rotation.z = Math.sin(t * 0.7) * 0.15 * drunk;
  if (opts.sit) { rig.legL.rotation.x = rig.legR.rotation.x = -1.45; rig.hips.position.y = 0.48; }
  if (opts.lying) { rig.hips.rotation.x = -1.5; rig.hips.position.y = 0.2; }
}

// ---------------------------------------------------------------- NPC definitions (original characters)
const NPC_DEFS = [
  { id: 'tarja', name: 'Tarja', role: 'Shopkeeper', spot: 'shopkeeper', look: { shirt: 0xd84a6a, pants: 0x2a2a4a, hair: 0xc8a050, face: { skin: '#f0c0a0', glasses: true }, fat: 1.05 }, faceYaw: Math.PI / 2, voice: 1.4 },
  { id: 'kaija', name: 'Kaija', role: 'Bartender', spot: 'bartender', look: { shirt: 0x1a1a1a, pants: 0x1a1a2a, hair: 0x3a1a0a, face: { skin: '#e8b898' } }, faceYaw: 0, voice: 1.3 },
  { id: 'jussi', name: 'Jussi', role: 'Parts clerk', spot: 'partsClerk', look: { shirt: 0x2a5a8a, pants: 0x2a3a5a, overalls: true, hat: 'cap', hatColor: 0xe8b020, face: { skin: '#e0b090', mustache: true, beard: '#6a4a2a' } }, faceYaw: null, voice: 0.9 },
  { id: 'mattila', name: 'Inspector Mattila', role: 'Vehicle inspector', spot: 'inspector', look: { shirt: 0xe8e8e8, pants: 0x3a3a3a, hair: 0x9a9a9a, face: { skin: '#e8c0a0', glasses: true } }, voice: 0.85 },
  { id: 'seppo', name: 'Seppo', role: 'Mechanic', spot: 'mechanic', look: { shirt: 0x1a3a6a, pants: 0x1a3a6a, overalls: true, hat: 'beanie', hatColor: 0x1a1a1a, face: { skin: '#d8a080', beard: '#3a2a1a' }, fat: 1.15 }, voice: 0.75 },
  { id: 'nieminen', name: 'Constable Nieminen', role: 'Police', spot: 'policeDesk', look: { shirt: 0x2a3a5a, pants: 0x1a2a3a, hat: 'police', face: { skin: '#e8c0a0', mustache: true, beard: '#4a3a2a' } }, voice: 0.8 },
  { id: 'aune', name: 'Aune Haapala', role: 'Farmer', spot: 'aune', look: { shirt: 0x6a8a4a, pants: 0x4a3a2a, hat: 'scarf', hatColor: 0xc04060, face: { skin: '#e8b8a0' }, pattern: 'plaid' }, voice: 1.5 },
  { id: 'raimo', name: 'Romu-Raimo', role: 'Junk dealer', spot: 'junkman', look: { shirt: 0x5a4a2a, pants: 0x3a3a2a, hat: 'cap', hatColor: 0x2a4a2a, face: { skin: '#c89070', beard: '#8a8a8a' }, fat: 1.2 }, voice: 0.7 },
  { id: 'jari', name: 'Jari', role: 'Rally organiser', spot: 'rallyDesk', look: { shirt: 0xd02020, pants: 0x1a1a1a, hat: 'cap', hatColor: 0x111111, face: { skin: '#e0b090', glasses: true } }, voice: 1.0 },
  { id: 'leena', name: 'Leena', role: 'Kiosk', spot: 'kiosk', look: { shirt: 0xe8b020, pants: 0x3a3a5a, hair: 0x6a2a1a, face: { skin: '#f0c8a8' } }, voice: 1.45 },
  { id: 'pertti', name: 'Pertti', role: 'Neighbour', spot: 'perttiBench', look: { shirt: 0x6a7a5a, pants: 0x3a4a6a, hat: 'cap', hatColor: 0x2a4a8a, pattern: 'stripes', face: { skin: '#e8a890', mustache: true, beard: '#7a5a3a', sleepy: true }, fat: 1.12 }, voice: 0.8, wanderer: true },
];

const LINES = {
  tarja: ['Päivää! Need anything?', 'Sausages are on offer today.', 'Bring your bottles back, we pay the deposit.', 'Pertti was here again, asking for credit...', 'You look tired. Coffee is on the shelf.'],
  kaija: ['What will it be?', 'No fighting in here, understood?', 'The slot machine paid out last week. Once.', 'Pertti owes me 400 marks.'],
  jussi: ['Parts for the Ruska? We have everything. Almost.', 'Racing carburettor is in stock. Pricey though.', 'Remember to tighten your wheel nuts. Seriously.', 'Order by phone and we deliver to your garage next morning.'],
  mattila: ['Inspection costs 280 marks. Bring the car into the bay.', 'Brakes, lights, exhaust, emissions. I check everything.', 'No plates, no driving. That is the law.'],
  seppo: ['Engine making funny noises? Probably the timing.', 'I can fix your rust bucket. For a price.', 'Never drive without oil. I have seen things.'],
  nieminen: ['Drive carefully. And sober.', 'We have radar on the highway near Rautala.', 'Have you paid your fines?'],
  aune: ['Oh, it is you! Would you help an old lady with the hay?', 'Coffee and pulla? Of course you will have some.', 'My late husband drove a Vuoksi tractor for forty years.'],
  raimo: ['Everything here is quality. Mostly.', 'You break it, you bought it. You buy it, you also bought it.', 'Bring me scrap and I pay cash.'],
  jari: ['Rally is on Saturdays, twelve to six. Entry 150 marks.', 'The stage is gravel, fast and full of jumps. Do not die.', 'Practice runs are free any time.'],
  leena: ['Kioski Pikku-Pala, what can I get you?', 'Salmiakki is the best thing ever invented.'],
  pertti: ['Hey neighbour! You wouldn\'t have a beer, would you?', 'I used to be a rally champion. Probably.', 'My wife left me. Took the dog. Left the cat. Smart cat.', 'Did you know the moose here are bigger than cars?', 'Perkele... my head.', 'Could you drive me to the pub? I will pay. Probably.'],
};

class NPC {
  constructor(game, def) {
    this.game = game; this.def = def;
    this.id = def.id; this.name = def.name; this.role = def.role;
    this.obj = buildHuman(def.look);
    this.rig = this.obj.userData.rig;
    game.scene.add(this.obj);
    const sp = game.spots[def.spot];
    this.home = sp ? sp.clone() : new THREE.Vector3(0, 0, 0);
    this.pos = this.home.clone();
    this.yaw = def.faceYaw ?? 0;
    this.t = Math.random() * 10;
    this.speed = 0;
    this.drunk = def.id === 'pertti' ? 0.6 : 0;
    this.state = 'idle';
    this.target = null;
    this.talkT = 0;
    this.knock = 0;
    const ph = game.physics, R = ph.R;
    this.body = ph.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(this.pos.x, this.pos.y + 0.9, this.pos.z));
    const cd = R.ColliderDesc.capsule(0.55, 0.28); ph.setGroups(cd, 'npc');
    this.collider = ph.world.createCollider(cd, this.body);
    ph.tag(this.collider, { npc: this, surface: 'flesh' });
    this.mood = '';
  }
  setVisible(v) { this.obj.visible = v; this.collider.setEnabled(v); }
  update(dt) {
    if (!this.obj.visible) return;
    const g = this.game, P = g.player;
    this.t += dt;
    const camP = g.camera.position;
    const d = this.pos.distanceTo(camP);
    if (d > 160) return;
    // movement
    if (this.knock > 0) {
      this.knock -= dt;
      animateHuman(this.rig, this.t, 0, { lying: true });
      this.place();
      return;
    }
    if (this.target) {
      const to = new THREE.Vector3().subVectors(this.target, this.pos); to.y = 0;
      const dist = to.length();
      if (dist < 0.6) { this.target = null; this.speed = 0; this.onArrive && this.onArrive(); this.onArrive = null; }
      else {
        to.normalize();
        const sp = this.walkSpeed || 1.2;
        this.speed = damp(this.speed, sp, 4, dt);
        this.pos.addScaledVector(to, this.speed * dt);
        this.pos.x += Math.sin(this.t * 1.1) * this.drunk * 0.01;
        const wantYaw = Math.atan2(to.x, to.z);
        this.yaw = lerpAngle(this.yaw, wantYaw, Math.min(1, dt * 5));
      }
    } else this.speed = damp(this.speed, 0, 6, dt);
    // face the player when close & idle
    if (!this.target && d < 4 && !P.inVehicle) {
      const to = new THREE.Vector3().subVectors(camP, this.pos);
      this.yaw = lerpAngle(this.yaw, Math.atan2(to.x, to.z), Math.min(1, dt * 3));
    }
    this.pos.y = this.groundY ? this.groundY(this.pos) : g.terrain.getHeight(this.pos.x, this.pos.z);
    if (this.indoorY !== undefined && this.pos.distanceTo(this.home) < 8) this.pos.y = this.home.y;
    this.talkT = Math.max(0, this.talkT - dt);
    animateHuman(this.rig, this.t, this.speed, { drunk: this.drunk, talk: this.talkT > 0, sit: this.sitting });
    this.place();
  }
  place() {
    this.obj.position.copy(this.pos);
    this.obj.rotation.y = this.yaw;
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y + 0.9, z: this.pos.z });
  }
  say(text, dur = 4) {
    this.talkT = dur;
    this.game.ui.subtitle(this.name, text, dur);
    audio.speak(this.pos.clone().setY(this.pos.y + 1.6), this.def.voice || 1, Math.min(14, 3 + text.length / 6));
  }
}
function lerpAngle(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; }

// ---------------------------------------------------------------- manager
export class NPCs {
  constructor(game) {
    this.game = game;
    this.list = [];
    for (const def of NPC_DEFS) {
      const n = new NPC(game, def);
      // indoor NPCs keep their spot height
      n.indoorY = true;
      n.groundY = () => n.home.y;
      this.list.push(n);
      this[def.id] = n;
    }
    // Pertti walks on terrain
    const pt = this.pertti; pt.groundY = (p) => game.terrain.getHeight(p.x, p.z); pt.indoorY = undefined;
    pt.walkSpeed = 0.9;
    this.perttiTimer = 5;
    this.perttiPassenger = null;
    this.moose = new Moose(game);
    this.spectators = [];
    this.makeSpectators();
    this.villagers = [];
    this.makeVillagers();
  }

  makeSpectators() {
    const g = this.game;
    const st = g.terrain.roads.find((r) => r.id === 'stage');
    for (let k = 0; k < 14; k++) {
      const s = st.samples[(k * 97 + 40) % st.samples.length];
      const side = k % 2 ? 1 : -1;
      const off = side * (st.width / 2 + 4 + Math.random() * 3);
      const x = s.x - s.dz * off, z = s.z + s.dx * off;
      const h = buildHuman({ shirt: [0xc02020, 0x2040a0, 0xe0c020, 0x208040][k % 4], pants: 0x2a2a3a, hat: k % 3 ? 'cap' : null, hatColor: 0x111111, face: { skin: '#e8b898' } });
      h.position.set(x, g.terrain.getHeight(x, z), z); h.rotation.y = Math.atan2(s.x - x, s.z - z);
      g.scene.add(h); this.spectators.push(h);
    }
  }
  makeVillagers() {
    const g = this.game;
    const spots = [[P.busstop.x - 1, P.busstop.z], [P.shop.x + 4, P.shop.z + 7], [P.town.x + 5, P.town.z + 30], [P.gas.x - 4, P.gas.z + 8]];
    spots.forEach(([x, z], i) => {
      const h = buildHuman({ shirt: [0x8a6a4a, 0x4a6a8a, 0xa04060, 0x5a7a3a][i], pants: 0x2a2a3a, hair: [0xd8c8a0, 0x3a2a1a, 0x9a9a9a, 0x6a4a2a][i], face: { skin: '#e8b898', glasses: i === 2 } });
      h.position.set(x, g.terrain.getHeight(x, z), z); h.rotation.y = i * 1.3;
      g.scene.add(h); this.villagers.push({ obj: h, t: i * 3 });
    });
  }

  update(dt) {
    const g = this.game;
    for (const n of this.list) n.update(dt);
    for (const s of this.spectators) { if (g.rally?.active) { s.userData.rig.armL.rotation.x = -2.6 + Math.sin(performance.now() / 150 + s.position.x) * 0.4; } }
    for (const v of this.villagers) { v.t += dt; animateHuman(v.obj.userData.rig, v.t, 0, { talk: Math.sin(v.t * 0.3) > 0.5 }); }
    this.updatePertti(dt);
    this.moose.update(dt);
    // shop/pub staff only visible during opening hours
    const open = (id) => g.actions.isOpen(id);
    this.tarja.setVisible(open('shop'));
    this.kaija.setVisible(open('pub'));
    this.jussi.setVisible(open('parts'));
    this.leena.setVisible(open('kiosk'));
    this.mattila.setVisible(open('parts'));
    this.seppo.setVisible(open('parts'));
  }

  updatePertti(dt) {
    const g = this.game, p = this.pertti;
    if (this.perttiPassenger) { p.setVisible(false); return; }
    if (!p.obj.visible && !this.perttiPassenger) p.setVisible(true);
    const hour = (g.time.minutes % 1440) / 60;
    this.perttiTimer -= dt;
    if (this.perttiTimer > 0 || p.target) return;
    this.perttiTimer = rand(20, 50);
    // schedule: pub in the evening, bench/bus stop at day, stumble home at night
    let dest;
    if (hour >= 16 && hour < 23 && g.actions.isOpen('pub')) dest = g.spots.pubSeats[2];
    else if (hour >= 23 || hour < 3) dest = pick([g.spots.perttiBench, new THREE.Vector3(P.village.x - 60 + Math.random() * 120, 0, P.village.z + 2)]);
    else if (hour < 9) dest = g.spots.perttiBench;
    else dest = pick([g.spots.perttiBench, g.spots.busstop, g.spots.shopFront]);
    if (dest) { p.target = dest.clone(); p.drunk = hour > 14 || hour < 4 ? 0.9 : 0.4; }
  }

  talk(n) {
    const g = this.game;
    g.dialog.open(n);
  }

  // ride system for Pertti
  givePerttiRide(vehicle) {
    this.perttiPassenger = vehicle;
    this.pertti.setVisible(false);
  }
}

// ---------------------------------------------------------------- Moose (dangerous wildlife)
class Moose {
  constructor(game) {
    this.game = game;
    const g = new THREE.Group();
    const fur = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 });
    const legM = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 });
    const mk = (geo, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; g.add(o); return o; };
    mk(roundBox(0.8, 0.95, 2.1, 0.3), fur, 0, 1.75, 0);
    mk(roundBox(0.7, 0.6, 0.5, 0.2), fur, 0, 2.05, 0.75);
    const head = new THREE.Group(); head.position.set(0, 2.1, 1.25); g.add(head);
    const hm = new THREE.Mesh(roundBox(0.32, 0.4, 0.75, 0.12), fur); hm.position.set(0, -0.15, 0.25); hm.rotation.x = 0.6; hm.castShadow = true; head.add(hm);
    const ant = new THREE.MeshStandardMaterial({ color: 0xc8b890, roughness: 0.8 });
    for (const s of [1, -1]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.05, 8, 1, false, 0, Math.PI), ant); a.position.set(s * 0.35, 0.18, -0.05); a.rotation.set(0.2, s > 0 ? -0.5 : Math.PI + 0.5, s * 0.5); head.add(a); }
    this.legs = [];
    for (const [x, z] of [[0.28, 0.75], [-0.28, 0.75], [0.28, -0.8], [-0.28, -0.8]]) {
      const piv = new THREE.Group(); piv.position.set(x, 1.35, z); g.add(piv);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 1.35, 6), legM); l.position.y = -0.67; l.castShadow = true; piv.add(l); this.legs.push(piv);
    }
    this.obj = g; game.scene.add(g);
    this.pos = new THREE.Vector3(); this.yaw = 0; this.t = 0; this.speed = 0; this.timer = 0; this.dead = 0;
    const ph = game.physics, R = ph.R;
    this.body = ph.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
    const cd = R.ColliderDesc.cuboid(0.45, 0.9, 1.1).setTranslation(0, 1.6, 0); ph.setGroups(cd, 'npc');
    this.collider = ph.world.createCollider(cd, this.body);
    ph.tag(this.collider, { moose: this, surface: 'flesh' });
    this.respawn();
  }
  respawn() {
    const g = this.game;
    const hw = g.terrain.roads.find((r) => r.id === 'highway');
    const s = pick(hw.samples);
    const off = (Math.random() < 0.5 ? -1 : 1) * 30;
    this.pos.set(s.x - s.dz * off, 0, s.z + s.dx * off);
    this.target = new THREE.Vector3(s.x + s.dz * off, 0, s.z - s.dx * off);
    this.timer = rand(5, 30);
  }
  update(dt) {
    const g = this.game;
    this.t += dt;
    const day = g.sky.daylight;
    const near = this.pos.distanceTo(g.camera.position);
    if (near > 600) { if (Math.random() < dt * 0.05) this.respawn(); }
    if (this.dead > 0) { this.dead -= dt; if (this.dead <= 0) this.respawn(); this.obj.rotation.z = 1.4; this.place(); return; }
    this.obj.rotation.z = 0;
    this.timer -= dt;
    // more active at dusk/night
    const active = day < 0.8 ? 1 : 0.35;
    if (this.timer <= 0) {
      this.timer = rand(8, 30);
      const tgt = this.target;
      this.target = new THREE.Vector3(this.pos.x + rand(-60, 60), 0, this.pos.z + rand(-60, 60));
      if (Math.random() < 0.5 * active && tgt) this.target = tgt;
    }
    const to = new THREE.Vector3().subVectors(this.target, this.pos); to.y = 0;
    const d = to.length();
    const want = d > 2 ? 1.6 * active : 0;
    this.speed += (want - this.speed) * Math.min(1, dt);
    if (d > 0.1) { to.normalize(); this.pos.addScaledVector(to, this.speed * dt); this.yaw = lerpAngle(this.yaw, Math.atan2(to.x, to.z), dt * 1.5); }
    this.pos.y = g.terrain.getHeight(this.pos.x, this.pos.z);
    const ph = this.t * 3;
    this.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.4 * Math.min(1, this.speed); });
    if (Math.random() < dt * 0.01 && near < 120) audio.play('moose', this.pos);
    this.place();
  }
  place() {
    this.obj.position.copy(this.pos); this.obj.rotation.y = this.yaw;
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    this.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
  }
  hit() { this.dead = 40; audio.play('thud', this.pos, 1); }
}

export { LINES, NPC_DEFS };
