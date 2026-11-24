import * as THREE from 'three';
import { audio } from '../core/audio.js';
import { clamp, rand, pick, fmtMoney, fmtTime, DAYS } from '../core/util.js';
import { PARTS, SLOTS } from '../vehicles/parts.js';
import { ITEMS } from './items.js';
import { tween, after } from '../core/tween.js';
import { LINES } from './npcs.js';
import { WATER_LEVEL, P } from '../world/layout.js';

const PAINTS = [['Ruska red', 0x8a2a1a], ['Lake blue', 0x1e4a7a], ['Forest green', 0x2a4a2a], ['Sunny yellow', 0xe0b020], ['Snow white', 0xeeeee8], ['Night black', 0x111114], ['Rally orange', 0xd85a10], ['Sauna brown', 0x5a3a22]];

// Central gameplay actions invoked from interactables, items and UI.
const FRIDGE_OK = ['beer', 'lonkero', 'soda', 'milk', 'coffee', 'sausage', 'sausageCooked', 'bread', 'pizza', 'pizzaHot', 'chips', 'candy', 'fishRaw', 'fishCooked'];

export class Actions {
  constructor(game) {
    this.game = game;
    this.sauna = { fire: 0, temp: 20, wood: 0, steam: 0, playerInside: false, time: 0, snd: null };
  }
  get g() { return this.game; }

  // ---------------------------------------------------------------- opening hours
  isOpen(id) {
    const g = this.g;
    const hr = (g.time.minutes % 1440) / 60, day = Math.floor(g.time.minutes / 1440) % 7;
    if (id === 'shop') return hr >= 8 && hr < 21;
    if (id === 'pub') return hr >= 14 || hr < 2;
    if (id === 'parts') return day !== 6 && hr >= 8 && hr < 18;
    if (id === 'kiosk') return hr >= 7 && hr < 23;
    return true;
  }

  // ---------------------------------------------------------------- consumption
  consume(eff, e) {
    const g = this.g, n = g.player.n;
    for (const k of ['hunger', 'thirst', 'fatigue', 'stress', 'bladder']) if (eff[k]) n[k] = clamp(n[k] + eff[k], 0, 100);
    if (eff.drunk) n.drunk = Math.max(0, n.drunk + eff.drunk);
    if (eff.hunger && eff.hunger < 0) g.stats.meals = (g.stats.meals || 0) + 1;
    if (eff.sound) audio.play(eff.sound, g.camera.position);
    if (eff.msg) g.ui.toast(eff.msg);
    if (eff.burp && Math.random() < 0.5) setTimeout(() => audio.play('burp', g.camera.position), 1400);
    if (eff.sick && Math.random() < 0.5) setTimeout(() => this.vomit(), 8000);
    if (e.defId === 'beer' || e.defId === 'lonkero') {
      g.stats.beers = (g.stats.beers || 0) + 1;
      if (g.stats.beers === 1) g.achieve('beer1', 'Kippis!', 'Drank your first beer');
      if (g.stats.beers >= 24) g.achieve('beer24', 'One Whole Case', 'Drank 24 beers');
      if (g.player.inVehicle) g.achieve('drinkdrive', 'Bad Idea', 'Drank while driving');
    }
    if (n.drunk > 0.9) g.achieve('wasted', 'Kännissä', 'Got properly drunk');
    // replace item
    const pos = e.mesh.position.clone();
    const held = g.interact.held === e;
    if (e.defId === 'beerCase') return;
    g.items.remove(e);
    if (eff.after) {
      const ne = g.items.spawn(eff.after, pos);
      if (held && ne) g.interact.pickUp(ne);
    }
  }
  spawnInHand(id) {
    const g = this.g;
    if (g.interact.held) g.interact.drop();
    const p = g.camera.position.clone().add(new THREE.Vector3(0, -0.2, -0.6).applyQuaternion(g.camera.quaternion));
    const e = g.items.spawn(id, p);
    g.interact.pickUp(e);
    audio.play('glass', p);
  }
  spawnNear(id, pos, opts = {}) {
    const p = pos.clone().add(new THREE.Vector3(rand(-0.5, 0.5), 1.2, rand(-0.5, 0.5)));
    return this.g.items.spawn(id, p, opts);
  }
  vomit() {
    const g = this.g, n = g.player.n;
    audio.play('vomit', g.camera.position);
    g.ui.toast('Bleaaargh!');
    n.hunger = Math.min(100, n.hunger + 25); n.thirst = Math.min(100, n.thirst + 15); n.drunk *= 0.85; n.stress = Math.min(100, n.stress + 5);
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(g.camera.quaternion);
    for (let i = 0; i < 30; i++) g.particles.emit(g.camera.position.clone().add(f.clone().multiplyScalar(0.3)).add(new THREE.Vector3(0, -0.15, 0)), { color: 0x8a8a30, alpha: 0.8, size: 0.05, grow: 0.5, life: 1.2, vel: f.clone().multiplyScalar(2 + Math.random() * 2).add(new THREE.Vector3(rand(-0.4, 0.4), rand(-0.2, 0.5), rand(-0.4, 0.4))), grav: 9.8, drag: 0.2 });
    g.player.shake = 0.5;
    g.stats.vomits = (g.stats.vomits || 0) + 1;
    if (g.player.inVehicle) g.achieve('vomitcar', 'Interior Redecoration', 'Threw up inside a vehicle');
  }
  peeStarted() {
    const g = this.g;
    // public indecency check
    for (const n of g.npcs.list) if (n.obj.visible && n.pos.distanceTo(g.player.pos) < 8) { n.say(pick(['Hey! Not here!', 'Disgusting!', 'Have you no shame?']), 3); g.player.n.stress = Math.min(100, g.player.n.stress + 5); }
    if (g.spots.toilet.distanceTo(g.player.pos) > 3) g.achieve('pee', 'Nature Calls', 'Relieved yourself in nature');
  }
  toilet() {
    const g = this.g, T = g.home?.toilet?.userData.parts;
    if (T) { tween(T.lid, 'rotation.x', -1.75, 0.4); after(2.6, () => tween(T.lid, 'rotation.x', 0, 0.5)); }
    if (g.player.n.bladder < 8) { g.ui.toast('You don\'t need to go right now.'); return; }
    g.player.n.bladder = 0; g.player.n.stress = Math.max(0, g.player.n.stress - 5);
    audio.play('pour', g.camera.position, 2); after(1.4, () => audio.play('pour', g.camera.position, 1.2));
    g.ui.toast('Ahh. Much better. *flush*');
  }
  drinkTap() {
    const g = this.g, S = g.home?.sink?.userData.parts;
    if (S?.lever) {
      tween(S.lever, 'rotation.x', -0.6, 0.2);
      S.water.visible = true; S.water.scale.set(1, 1, 1);
      after(1.6, () => { tween(S.lever, 'rotation.x', 0, 0.25); S.water.visible = false; });
    }
    g.player.n.thirst = Math.max(0, g.player.n.thirst - 25); g.player.n.bladder = Math.min(100, g.player.n.bladder + 8);
    audio.play('pour', g.camera.position, 0.8); after(0.8, () => audio.play('gulp', g.camera.position));
    g.ui.toast('Cold, fresh well water.');
  }
  // fridge: the door opens, the light comes on and you take or store food
  fridge() {
    const g = this.g, F = g.home?.fridge?.userData.parts;
    const stock = g.state.fridge ||= {};
    if (F) { tween(F.door, 'rotation.y', 1.8, 0.45); F.light.material.emissiveIntensity = 1.8; audio.play('creak', g.camera.position, 0.5); }
    const close = () => { if (F) { tween(F.door, 'rotation.y', 0, 0.4, { onDone: () => { F.light.material.emissiveIntensity = 0; audio.play('door', g.camera.position, 0.5); } }); } };
    const held = g.interact.held;
    const opts = [];
    if (held && !held.part && FRIDGE_OK.includes(held.defId)) opts.push({ label: `Put the ${held.def.name.toLowerCase()} in the fridge`, action: () => { stock[held.defId] = (stock[held.defId] || 0) + 1; g.items.remove(held); } });
    for (const [id, n] of Object.entries(stock)) if (n > 0 && ITEMS[id]) opts.push({ label: `Take: ${ITEMS[id].name}`, sub: `${n} in the fridge`, action: () => { stock[id]--; after(0.1, () => this.spawnInHand(id)); } });
    if (!opts.length) opts.push({ label: 'It is empty. (Buy food at the village shop.)', disabled: true });
    after(0.4, () => g.ui.menu({ title: '🧊 Fridge', text: 'Cold and humming. What do you want?', options: opts, onClose: close }));
  }
  tv() {
    const g = this.g;
    g.state.tvOn = !g.state.tvOn;
    this.setTV(g.state.tvOn);
    audio.play('click', g.camera.position);
    if (g.state.tvOn) {
      const shows = ['Ski jumping reruns. Somehow relaxing.', 'A documentary about moose. Gripping.', 'Weather forecast: summer continues.', 'Humppa hour. Your foot starts tapping.', 'A game show where people guess sausage weights.'];
      g.ui.toast(`📺 ${pick(shows)}`, 4);
      g.player.n.stress = Math.max(0, g.player.n.stress - 12);
      g.advanceTime(20);
    }
  }
  cook() {
    const g = this.g, e = g.interact.held;
    if (!e || !e.def.cookTo) { g.ui.toast('Hold something cookable (sausage, pizza, fish) and use the stove.'); return; }
    const to = e.def.cookTo;
    g.items.remove(e);
    audio.play('hiss', g.camera.position);
    g.ui.toast('Cooking... sizzle sizzle.');
    this.heatPlate(0, 14);
    g.advanceTime(10);
    // the cooked food lands back in your hand
    const hand = g.camera.position.clone().add(new THREE.Vector3(0, 0, -0.75).applyQuaternion(g.camera.quaternion));
    const ne = g.items.spawn(to, hand);
    g.interact.pickUp(ne);
    g.ui.toast('Cooked! Press E to eat it.');
  }

  // hotplate glows red while it cools down, with a wisp of steam
  heatPlate(i, sec) {
    const S = this.g.home?.stove?.userData.parts; if (!S) return;
    const p = S.plates[i]; this.hot = { p, lamp: S.lamp, t: sec, T: sec };
  }
  updateHome(dt) {
    const g = this.g;
    const h = this.hot;
    if (h) {
      h.t -= dt; const k = Math.max(0, Math.min(1, h.t / (h.T * 0.6)));
      h.p.material.emissiveIntensity = k * 1.6; h.lamp.material.emissiveIntensity = h.t > 0 ? 2 : 0;
      if (h.t > 2 && Math.random() < dt * 6) { const w = h.p.getWorldPosition(new THREE.Vector3()); g.particles.emit(w.add(new THREE.Vector3(0, 0.08, 0)), { color: 0xdddddd, alpha: 0.18, size: 0.08, grow: 1.5, life: 1.6, vel: new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.35, (Math.random() - 0.5) * 0.1) }); }
      if (h.t <= 0) this.hot = null;
    }
    const W = g.home?.sink?.userData.parts?.water;
    if (W?.visible) W.scale.set(0.85 + Math.random() * 0.3, 1, 0.85 + Math.random() * 0.3);
    // TV picture
    if (g.state.tvOn && this.tvTex && g.homeTV && g.homeTV.position && g.camera.position.distanceToSquared(g.spots.homeDoor) < 400) {
      this.tvT = (this.tvT || 0) + dt;
      if (this.tvT > 0.12) { this.tvT = 0; this.drawTV(); }
    }
    this.updateMailbox();
    // charger feedback
    const C = g.chargerObj ? (this._needle ||= g.chargerObj.getObjectByName('chargerNeedle')) : null;
    if (C) { const on = !!this.chargingBattery && (this.chargingBattery.data.charge ?? 0) < 1; C.rotation.z += ((on ? -0.6 + Math.sin(performance.now() / 700) * 0.04 : 0.6) - C.rotation.z) * Math.min(1, dt * 3); const led = (this._led ||= g.chargerObj.getObjectByName('chargerLed')); led.material.emissiveIntensity = this.chargingBattery ? ((this.chargingBattery.data.charge ?? 0) >= 1 ? 2 : (Math.sin(performance.now() / 300) > 0 ? 2 : 0.2)) : 0; }
    const rd = g.garageRadioObj?.userData.parts?.dial;
    if (rd) rd.material.emissiveIntensity = g.radio?.garageOn ? 1.2 : 0;
  }
  setTV(on) {
    const g = this.g, screen = g.homeTV?.getObjectByName('screen'); if (!screen) return;
    if (!this.tvTex) {
      this.tvCanvas = document.createElement('canvas'); this.tvCanvas.width = 160; this.tvCanvas.height = 120;
      this.tvTex = new THREE.CanvasTexture(this.tvCanvas); this.tvTex.colorSpace = THREE.SRGBColorSpace;
    }
    screen.material.emissiveMap = on ? this.tvTex : null;
    screen.material.emissive.setHex(on ? 0xffffff : 0); screen.material.emissiveIntensity = on ? 1.1 : 0;
    screen.material.needsUpdate = true;
    this.tvShow = Math.floor(Math.random() * 3); this.tvClock = 0;
    if (on) this.drawTV();
  }
  drawTV() {
    const c = this.tvCanvas.getContext('2d'), W = 160, H = 120;
    this.tvClock = (this.tvClock || 0) + 0.12;
    const t = this.tvClock;
    if (this.tvShow === 0) { // ski jumping
      const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#7ab0e8'); gr.addColorStop(1, '#dfefff'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
      c.fillStyle = '#f4f8ff'; c.beginPath(); c.moveTo(0, 40); c.quadraticCurveTo(70, 70, 160, 110); c.lineTo(160, 120); c.lineTo(0, 120); c.fill();
      c.fillStyle = '#2a4a2a'; for (let i = 0; i < 12; i++) c.fillRect(((i * 37 - t * 30) % 180 + 180) % 180 - 10, 95 + (i % 3) * 6, 6, 14);
      const x = (t * 40) % 200 - 20; c.fillStyle = '#c02020'; c.save(); c.translate(x, 40 + x * 0.35); c.rotate(0.5); c.fillRect(-8, -3, 16, 6); c.fillStyle = '#222'; c.fillRect(-14, 3, 30, 2); c.restore();
      c.fillStyle = 'rgba(0,0,40,0.7)'; c.fillRect(0, 100, 80, 14); c.fillStyle = '#fff'; c.font = 'bold 9px Arial'; c.fillText('LAHTI  K90  128.5 m', 4, 110);
    } else if (this.tvShow === 1) { // moose documentary
      c.fillStyle = '#4a6a3a'; c.fillRect(0, 0, W, H); c.fillStyle = '#9ac0e0'; c.fillRect(0, 0, W, 45);
      c.fillStyle = '#2a3a22'; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(i * 20 - 4, 50); c.lineTo(i * 20 + 6, 8 + (i % 3) * 6); c.lineTo(i * 20 + 16, 50); c.fill(); }
      const x = 40 + Math.sin(t * 0.4) * 30; c.fillStyle = '#3a2416'; c.fillRect(x, 60, 46, 22); c.fillRect(x + 40, 52, 16, 16); for (const lx of [4, 14, 32, 40]) c.fillRect(x + lx, 80, 5, 22 + Math.sin(t * 3 + lx) * 2);
      c.fillStyle = '#c8b890'; c.fillRect(x + 46, 44, 18, 4); c.fillRect(x + 44, 40, 4, 8); c.fillRect(x + 58, 40, 4, 8);
    } else { // test card
      const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0']; bars.forEach((b, i) => { c.fillStyle = b; c.fillRect(i * W / 7, 0, W / 7 + 1, 80); });
      c.fillStyle = '#111'; c.fillRect(0, 80, W, 40); c.fillStyle = '#fff'; c.font = 'bold 12px Arial'; c.fillText('YLE TV1', 52, 100); c.font = '10px monospace'; const d = new Date(0, 0, 0, 0, 0, Math.floor(t)); c.fillText(d.toTimeString().slice(0, 8), 54, 114);
    }
    // scanlines + snow
    c.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
    for (let i = 0; i < 120; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'; c.fillRect(Math.random() * W, Math.random() * H, 1, 1); }
    this.tvTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- mail: the mailbox opens and you read the letters right there
  mailboxLabel() {
    const n = (this.g.state.mail || []).length;
    return n ? `Mailbox — ${n} letter${n > 1 ? 's' : ''} inside` : 'Mailbox (empty)';
  }
  setMailbox(open) {
    const P = this.g.homeMailbox?.userData.parts; if (!P) return;
    tween(P.door, 'rotation.x', open ? 1.55 : 0, open ? 0.45 : 0.35);
    audio.play(open ? 'creak' : 'click', this.g.spots.mailbox, 0.8);
  }
  updateMailbox() {
    const g = this.g, P = g.homeMailbox?.userData.parts; if (!P) return;
    const has = (g.state.mail || []).length > 0;
    if (has !== this._mbHas) { this._mbHas = has; tween(P.flag, 'rotation.x', has ? -Math.PI / 2 : 0, 0.6); P.letters.visible = has; }
  }
  readMailQueue(queue) {
    const g = this.g;
    const m = queue.shift();
    if (!m) { this.setMailbox(false); return; }
    (g.state.tutFlags ||= {}).letter = true;
    const remove = () => { const i = (g.state.mail || []).indexOf(m); if (i >= 0) g.state.mail.splice(i, 1); };
    const opts = [];
    if (m.kind === 'gift') opts.push({ label: `Take the money (${fmtMoney(m.amount)})`, action: () => { remove(); g.earn(m.amount, m.title); } });
    else if (m.kind === 'bill') {
      opts.push({ label: `Pay now (${fmtMoney(m.amount)})`, disabled: g.state.money < m.amount, action: () => { remove(); g.spend(m.amount); g.state.bills = Math.max(0, (g.state.bills || 0) - 1); g.ui.toast('Bill paid.'); } });
      opts.push({ label: 'Leave it in the mailbox for now' });
    } else opts.push({ label: 'OK', action: () => { remove(); } });
    const more = queue.length ? `<br><br><small>${queue.length} more letter${queue.length > 1 ? 's' : ''} in the mailbox.</small>` : '';
    g.ui.menu({ title: `✉ ${m.title}`, text: m.text + more, options: opts, onClose: () => after(0.3, () => this.readMailQueue(queue)) });
  }

  // ---------------------------------------------------------------- sleep / pass out
  async sleep(force = false) {
    const g = this.g, p = g.player;
    if (!force && p.n.fatigue < 15) { g.ui.toast('You are not tired.'); return; }
    if (g.traffic.pol.state === 'pursuit') { g.ui.toast('Not now, the police are after you!'); return; }
    p.sleeping = true;
    const hours = clamp(p.n.fatigue / 12, 2, 10);
    await g.ui.fade('Zzz...', `Sleeping ${Math.round(hours)} hours`, 1800);
    g.advanceTime(hours * 60, true);
    p.n.fatigue = 0; p.n.stress = Math.max(0, p.n.stress - 25); p.n.drunk = Math.max(0, p.n.drunk - hours * 0.15);
    p.n.hunger = Math.min(95, p.n.hunger + hours * 3); p.n.thirst = Math.min(95, p.n.thirst + hours * 4); p.n.bladder = Math.min(95, p.n.bladder + hours * 5);
    p.n.health = Math.min(100, p.n.health + hours * 8);
    p.sleeping = false;
    g.saveGame();
    const day = Math.floor(g.time.minutes / 1440);
    g.ui.toast(`Good morning! ${DAYS[day % 7]}, ${fmtTime(g.time.minutes % 1440)}. Game saved.`, 4);
    g.achieve('sleep', 'Well Rested', 'Slept in your own bed');
    // natural break: midgame ad
    g.sdk.requestAd('midgame');
  }
  async passOut(msg) {
    const g = this.g, p = g.player;
    if (p.sleeping || p.dead) return;
    p.sleeping = true;
    if (p.inVehicle) this.exitVehicle(true);
    await g.ui.fade(msg, 'You wake up somewhere...', 2200);
    g.advanceTime(rand(4, 7) * 60, true);
    p.n.fatigue = 20; p.n.drunk = Math.max(0, p.n.drunk - 0.6); p.n.stress = Math.min(100, p.n.stress + 15);
    // wake up near where you collapsed, maybe robbed
    if (Math.random() < 0.3 && g.state.money > 20) { const lost = Math.round(g.state.money * rand(0.05, 0.2)); g.state.money -= lost; g.ui.toast(`Your wallet feels lighter... (−${fmtMoney(lost)})`, 4); }
    p.sleeping = false;
    g.achieve('passout', 'Lights Out', 'Passed out somewhere');
  }

  // ---------------------------------------------------------------- sauna
  stoveLabel() {
    const s = this.sauna, g = this.g, e = g.interact.held;
    if (e && e.defId === 'firewood') return `Put firewood in the stove (${Math.round(s.temp)}°C)`;
    if (e && e.def.cookTo === 'sausageCooked') return 'Grill sausage on the stones';
    if (s.wood > 0 && s.fire <= 0) return `Light the fire (${s.wood} logs in)`;
    return `Sauna stove — ${Math.round(s.temp)}°C ${s.fire > 0 ? '🔥' : '(cold, add firewood)'}`;
  }
  saunaStove() {
    const s = this.sauna, g = this.g, e = g.interact.held;
    if (e && e.defId === 'firewood') { g.items.remove(e); s.wood = Math.min(8, s.wood + 1); audio.play('thud', g.spots.kiuas, 0.5); if (s.fire > 0) s.fire = Math.min(1, s.fire + 0.2); return; }
    if (e && e.defId === 'sausage') {
      if (s.temp < 50) { g.ui.toast('The stones are not hot enough.'); return; }
      g.items.remove(e); audio.play('hiss', g.spots.kiuas);
      const ne = this.spawnNear('sausageCooked', g.spots.kiuas); g.interact.pickUp(ne);
      g.achieve('saunamakkara', 'Saunamakkara', 'Grilled a sausage on the sauna stove'); return;
    }
    if (s.wood > 0 && s.fire <= 0) { s.fire = 1; audio.play('lighter', g.spots.kiuas); g.ui.toast('The fire catches. Give it some time to heat up.'); return; }
    if (s.wood <= 0) g.ui.toast('Bring firewood from the woodshed (or chop some logs).');
  }
  throwWater() {
    const s = this.sauna, g = this.g;
    if (s.temp < 45) { g.ui.toast('The stones are cold. Nothing happens.'); return; }
    s.steam = Math.min(1, s.steam + 0.6); s.temp = Math.min(115, s.temp + 4);
    audio.play('hiss', g.spots.kiuas);
    for (let i = 0; i < 25; i++) g.particles.emit(g.spots.kiuas.clone().add(new THREE.Vector3(rand(-0.2, 0.2), 0.1, rand(-0.2, 0.2))), { color: 0xffffff, alpha: 0.25, size: 0.2, grow: 4, life: 2.5, vel: new THREE.Vector3(rand(-0.3, 0.3), 1.2, rand(-0.3, 0.3)) });
    g.achieve('loyly', 'Löylyä!', 'Threw water on the sauna stones');
  }
  saunaSit() {
    const g = this.g, p = g.player;
    if (p.sitting) { p.sitting = null; g.ui.toast('You stand up.'); return; }
    p.sitting = { pos: g.spots.saunaBench.clone().add(new THREE.Vector3(0, 0.75, 0)) };
    g.ui.toast('You sit on the top bench. Press E again to stand. RMB at the stove to throw löyly.');
  }
  updateSauna(dt, gameDt) {
    const s = this.sauna, g = this.g, p = g.player;
    // fire burns wood: each log ~25 game minutes
    if (s.fire > 0) {
      s.burn = (s.burn || 0) + gameDt;
      if (s.burn > 25) { s.burn = 0; s.wood--; if (s.wood <= 0) { s.fire = 0; s.wood = 0; } }
    }
    const target = s.fire > 0 ? 40 + 62 * Math.min(1, (s.wood + 1) / 4) : 18;
    s.temp += (target - s.temp) * (1 - Math.exp(-gameDt / (s.fire > 0 ? 35 : 60)));
    s.steam = Math.max(0, s.steam - dt * 0.08);
    if (g.kiuasGlow) g.kiuasGlow.material.emissiveIntensity = s.fire > 0 ? 2 + Math.sin(performance.now() / 90) * 0.5 : 0;
    // fire sound
    const near = g.spots.kiuas.distanceTo(g.camera.position) < 12;
    if (s.fire > 0 && near) { if (!s.snd) s.snd = audio.loop('fire', g.spots.kiuas); s.snd?.set(1); }
    else if (s.snd) { s.snd.stop(); s.snd = null; }
    if (s.fire > 0 && Math.random() < dt * 2) g.particles.emit(g.spots.kiuas.clone().add(new THREE.Vector3(0.0, 2.6, -0.15)), { color: 0x777777, alpha: 0.12, size: 0.4, grow: 3, life: 4, vel: new THREE.Vector3(0.3, 1, 0) });
    // player inside?
    const r = g.spots.saunaRoom;
    const lp = p.pos.clone().sub(r.center).applyAxisAngle(new THREE.Vector3(0, 1, 0), -r.ry);
    const inside = Math.abs(lp.x) < r.half.x && Math.abs(lp.z) < r.half.z && Math.abs(lp.y) < 2;
    s.playerInside = inside || !!p.sitting;
    if (s.playerInside && !p.inVehicle) {
      s.time += gameDt;
      const heatRate = Math.max(0, (s.temp + s.steam * 25 - 55) / 35) * (p.sitting ? 1.3 : 0.8);
      p.n.heat = clamp(p.n.heat + heatRate * gameDt * 1.2 - (s.temp < 50 ? gameDt : 0), 0, 100);
      if (s.temp > 55) {
        p.n.dirt = Math.max(0, p.n.dirt - gameDt * 2.2);
        p.n.stress = Math.max(0, p.n.stress - gameDt * 0.9);
        p.n.thirst = Math.min(100, p.n.thirst + gameDt * 0.25);
      }
      g.fx.heat = p.n.heat / 100;
      if (p.n.heat > 70 && !s.warned) { s.warned = true; g.ui.toast('It\'s getting VERY hot. Go cool off in the lake!'); }
      if (s.time > 20 && s.temp > 70) { if (!s.counted) { s.counted = true; g.stats.saunas = (g.stats.saunas || 0) + 1; g.achieve('sauna', 'Saunan Henki', 'Bathed in a proper hot sauna'); } }
    } else { s.time = 0; s.warned = false; s.counted = false; g.fx.heat = Math.max(0, (g.fx.heat || 0) - dt * 0.3); }
    // avanto bonus: jump in the lake after sauna
    if (p.swimming && p.n.heat > 35) { p.n.stress = Math.max(0, p.n.stress - 25); p.n.heat = 0; g.ui.toast('AAAAH! Refreshing!'); g.achieve('avanto', 'Hot and Cold', 'Jumped in the lake straight from the sauna'); }
  }

  // ---------------------------------------------------------------- firewood
  takeFirewood() {
    const g = this.g;
    if (g.interact.held) { g.ui.toast('Your hands are full.'); return; }
    if ((g.state.firewood ?? 30) <= 0) { g.ui.toast('The woodshed is empty. Chop some logs!'); return; }
    g.state.firewood = (g.state.firewood ?? 30) - 1;
    const e = this.spawnNear('firewood', g.camera.position.clone().add(new THREE.Vector3(0, -1.2, 0)));
    g.interact.pickUp(e);
  }
  chopLabel() {
    const g = this.g, e = g.interact.held;
    if (e?.defId === 'axe') return 'Chop the log (E)';
    if (e?.defId === 'log') return 'Place the log on the block';
    return g.state.logOnBlock ? 'A log is on the block — bring the axe' : 'Chopping block (bring a log from the pile)';
  }
  chop() {
    const g = this.g, e = g.interact.held;
    if (e?.defId === 'log') { g.items.remove(e); g.state.logOnBlock = true; this.blockLog(true); return; }
    if (e?.defId === 'axe') return this.swingAxe(e, true);
    if (!g.state.logOnBlock) {
      if (g.interact.held) return;
      const l = this.spawnNear('log', g.spots.logPile); g.interact.pickUp(l);
    }
  }
  blockLog(on) {
    const g = this.g;
    if (on && !this.logMesh) {
      this.logMesh = ITEMS.log.build(); this.logMesh.position.copy(g.spots.choppingBlock).add(new THREE.Vector3(0, 0.25, 0)); g.scene.add(this.logMesh);
    } else if (!on && this.logMesh) { this.logMesh.removeFromParent(); this.logMesh = null; }
  }
  swingAxe(e, atBlock = false) {
    const g = this.g;
    audio.play('swing', g.camera.position);
    const near = g.spots.choppingBlock.distanceTo(g.player.pos) < 2.6;
    if (near && g.state.logOnBlock) {
      setTimeout(() => {
        audio.play('chop', g.spots.choppingBlock);
        g.state.logOnBlock = false; this.blockLog(false);
        for (let i = 0; i < 4; i++) this.spawnNear('firewood', g.spots.choppingBlock, { vel: { x: rand(-2, 2), y: 2, z: rand(-2, 2) } });
        g.player.n.fatigue = Math.min(100, g.player.n.fatigue + 1.2); g.player.n.stress = Math.max(0, g.player.n.stress - 1.5);
        g.stats.chopped = (g.stats.chopped || 0) + 1;
        if (g.stats.chopped >= 10) g.achieve('lumber', 'Lumberjack', 'Split 10 logs');
      }, 180);
    } else if (near) g.ui.toast('Put a log on the chopping block first (grab one from the pile).');
    // hitting things with the axe
    const hit = g.interact.target;
    if (hit?.kind === 'npc') { hit.npc.say('OUCH! Are you crazy?!', 3); g.player.n.stress += 5; }
  }

  // ---------------------------------------------------------------- fluids & paint
  pourFluid(e) {
    const g = this.g, car = g.car, def = e.def;
    if ((e.data.amount || 0) <= 0.01) { g.ui.toast('It\'s empty.'); return true; }
    // near gas pump: fill the can instead
    if (def.fluid === 'fuel') {
      const pumpNear = g.spots.pumps.some((p) => p.distanceTo(g.player.pos) < 3);
      if (pumpNear && e.data.amount < def.capacity) return this.fillCan(e);
    }
    const target = g.interact.lastAimPart || this.aimedPart();
    const cam = g.camera.position;
    const near = (slot) => car.slots[slot] && car.slots[slot].mesh.getWorldPosition(new THREE.Vector3()).distanceTo(cam) < 2.2;
    let amt = Math.min(e.data.amount, 1.0);
    let msg = null;
    if (def.fluid === 'oil') {
      if (!near('rcover') && !near('head')) { g.ui.toast('Aim at the engine (the oil filler is on the rocker cover).'); return true; }
      if (!car.slots.oilpan) { e.data.amount -= amt; msg = 'The oil pours straight through onto the floor. No oil pan!'; }
      else { amt = Math.min(amt, 3.5 - car.oil); if (amt <= 0) { g.ui.toast('Oil is full (3.5 L).'); return true; } car.oil += amt; e.data.amount -= amt; msg = `Oil ${car.oil.toFixed(1)} / 3.5 L`; }
    } else if (def.fluid === 'coolant') {
      if (!near('radiator')) { g.ui.toast('Aim at the radiator.'); return true; }
      amt = Math.min(amt, 5 - car.coolant); if (amt <= 0) { g.ui.toast('Radiator is full.'); return true; }
      car.coolant += amt; e.data.amount -= amt; msg = `Coolant ${car.coolant.toFixed(1)} / 5 L`;
    } else if (def.fluid === 'brake') {
      if (!near('brakemaster')) { g.ui.toast('Aim at the brake master cylinder (driver side, at the firewall).'); return true; }
      amt = Math.min(0.25, e.data.amount, 0.5 - car.brakeFluid); if (amt <= 0) { g.ui.toast('Brake fluid is full.'); return true; }
      car.brakeFluid += amt; e.data.amount -= amt; msg = `Brake fluid ${(car.brakeFluid * 1000).toFixed(0)} / 500 ml`;
    } else if (def.fluid === 'fuel') {
      // car tank or other vehicles
      let v = null;
      for (const veh of g.vehicles) if (veh.pos.distanceTo(g.player.pos) < 3.5) v = veh;
      if (!v) { g.ui.toast('Stand next to a vehicle (or a gas pump to fill the can).'); return true; }
      if (v === car && !car.slots.tank) { g.ui.toast('The Ruska has no fuel tank installed.'); return true; }
      amt = Math.min(e.data.amount, 2, v.fuelCap - v.fuel); if (amt <= 0) { g.ui.toast('The tank is full.'); return true; }
      v.fuel += amt; e.data.amount -= amt; msg = `${v.name}: ${v.fuel.toFixed(1)} / ${v.fuelCap} L`;
    }
    audio.play('pour', cam, 0.6);
    car.dirty = true;
    if (msg) g.ui.toast(msg, 1.5);
    return true;
  }
  aimedPart() { return null; }
  spray(e) {
    const g = this.g, car = g.car;
    if (car.pos.distanceTo(g.player.pos) > 4) { g.ui.toast('Stand next to the Ruska to paint it.'); return true; }
    const col = e.data.color ?? 0xb02018;
    e.data.uses = (e.data.uses || 0) + 1;
    audio.play('pssht', g.camera.position);
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(g.camera.quaternion);
    for (let i = 0; i < 12; i++) g.particles.emit(g.camera.position.clone().add(f.clone().multiplyScalar(0.5)), { color: col, alpha: 0.4, size: 0.1, grow: 3, life: 0.8, vel: f.clone().multiplyScalar(3).add(new THREE.Vector3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3))) });
    const cur = new THREE.Color(car.paint), tgt = new THREE.Color(col);
    cur.lerp(tgt, 0.34);
    if (e.data.uses >= 3) cur.copy(tgt);
    car.setPaint(cur.getHex());
    if (e.data.uses >= 3) { g.items.remove(e); g.ui.toast('New paint job done! The can is empty.'); g.achieve('paint', 'Fresh Coat', 'Repainted the Ruska'); }
    return true;
  }
  fillCan(e) {
    const g = this.g;
    const litres = e.def.capacity - e.data.amount, price = 5.2;
    const afford = Math.min(litres, g.state.money / price);
    if (afford < 0.5) { g.ui.toast('Not enough money for fuel.'); return true; }
    e.data.amount += afford; g.spend(afford * price);
    audio.play('pour', g.camera.position, 2); audio.play('cash');
    g.ui.toast(`Filled ${afford.toFixed(1)} L for ${fmtMoney(afford * price)}`);
    return true;
  }
  pumpLabel() { return 'Fuel pump — 5.20 mk/L (stand next to your vehicle, or hold a jerry can)'; }
  pump() {
    const g = this.g;
    const e = g.interact.held;
    if (e && e.def.fluid === 'fuel') return this.fillCan(e);
    let v = null, bd = 7;
    for (const veh of g.vehicles) { const d = veh.pos.distanceTo(g.player.pos); if (d < bd) { bd = d; v = veh; } }
    if (!v) { g.ui.toast('Park your vehicle next to the pump first.'); return; }
    if (v === g.car && !g.car.slots.tank) { g.ui.toast('That car has no fuel tank!'); return; }
    if (v.engineOn) { g.ui.toast('Turn the engine off before refuelling!'); return; }
    const litres = v.fuelCap - v.fuel, price = 5.2;
    const afford = Math.min(litres, g.state.money / price);
    if (afford < 0.5) { g.ui.toast(litres < 0.5 ? 'The tank is already full.' : 'Not enough money.'); return; }
    v.fuel += afford; g.spend(afford * price);
    audio.play('pour', g.camera.position, 3); audio.play('cash');
    g.ui.toast(`${v.name}: +${afford.toFixed(1)} L for ${fmtMoney(afford * price)}`);
  }

  // ---------------------------------------------------------------- garage equipment
  hoistLabel() {
    const car = this.g.car;
    if (car.slots.stand) return car.onStands || car.pos.distanceTo(this.g.spots.hoist) < 6 ? 'Engine hoist: lift engine into the car' : 'Engine hoist (bring the car into the garage)';
    if (car.slots.engine) return car.pos.distanceTo(this.g.spots.hoist) < 6 ? 'Engine hoist: pull engine out onto the stand' : 'Engine hoist';
    return 'Engine hoist (no engine)';
  }
  async hoist() {
    const g = this.g, car = g.car;
    if (car.pos.distanceTo(g.spots.hoist) > 6.5) { g.ui.toast('The car has to be in the garage next to the hoist.'); return; }
    const toCar = !!car.slots.stand;
    const inst = car.slots.stand || car.slots.engine;
    if (!inst) { g.ui.toast('There is no engine block on the stand or in the car.'); return; }
    if (toCar && car.slots.engine) return;
    if (!toCar && car.childrenOf('engine').some((s) => ['driveshaft', 'pipe', 'fuelline', 'hoseU', 'hoseL'].includes(s))) { g.ui.toast('Disconnect the driveshaft and exhaust pipe first.'); return; }
    if (!toCar && car.tightFrac(inst) > 0) { g.ui.toast('Unbolt the engine mounts first (wrench on the engine block).'); return; }
    audio.play('creak', g.spots.hoist); audio.play('metal', g.spots.hoist);
    await g.ui.fade(toCar ? 'Lowering the engine into the bay...' : 'Hoisting the engine out...', '', 1300);
    const from = toCar ? 'stand' : 'engine', to = toCar ? 'engine' : 'stand';
    car.slots[from] = null;
    const parent = to === 'engine' ? car.root : car.standRoot;
    parent.add(inst.mesh);
    inst.mesh.position.set(...SLOTS[to].pos); inst.mesh.rotation.set(0, 0, 0);
    inst.slot = to; inst.tight = 0; car.slots[to] = inst; car.dirty = true;
    audio.play('clunk', g.spots.hoist, 1);
    g.ui.toast(toCar ? 'Engine is in! Bolt down the engine mounts (wrench on the block).' : 'Engine is on the stand.');
    if (toCar) g.achieve('enginein', 'Heart Transplant', 'Installed the engine in the Ruska');
  }
  chargerLabel() {
    const car = this.g.car, e = this.g.interact.held;
    if (e?.part?.defId === 'battery') return `Put the battery on the charger (${Math.round((e.part.data.charge ?? 0) * 100)}%)`;
    if (this.chargingBattery) return `Charging battery: ${Math.round((this.chargingBattery.data.charge ?? 0) * 100)}% (E to take it)`;
    return 'Battery charger (bring the battery)';
  }
  charger() {
    const g = this.g, e = g.interact.held;
    if (e?.part?.defId === 'battery') {
      const inst = e.part; g.items.detachPhysics(e); inst.ent = null;
      g.scene.add(inst.mesh); inst.mesh.position.copy(g.spots.charger).add(new THREE.Vector3(0, -0.05, 0.2)); inst.mesh.rotation.set(0, 0, 0);
      this.chargingBattery = inst; g.interact.held = null;
      audio.play('click3', g.spots.charger); g.ui.toast('Charging... it takes a few hours.');
      return;
    }
    if (this.chargingBattery) {
      const inst = this.chargingBattery; this.chargingBattery = null;
      g.car.spawnLoose(inst, inst.mesh.position.clone().add(new THREE.Vector3(0, 0.15, 0)));
      g.interact.pickUp(inst.ent);
    }
  }
  updateCharger(gameDt) {
    const b = this.chargingBattery;
    if (b) b.data.charge = Math.min(1, (b.data.charge ?? 0) + gameDt / 50); // about a minute of real time
  }
  garageRadio(pos) {
    const r = this.g.radio;
    if (r.on && r.source === 'garage') { r.setPlaying(false); r.garageOn = false; }
    else { r.setPlaying(true, 'garage'); r.garageOn = true; }
  }

  // ---------------------------------------------------------------- vehicles
  enterVehicle(v) {
    const g = this.g, p = g.player;
    if (v.locked) { g.ui.toast(v.lockedMsg || 'It\'s locked.'); return; }
    if (g.interact.held) g.interact.drop();
    p.inVehicle = v; v.driver = p;
    p.setEnabled(false);
    v.autoClutch = g.settings.autoClutch;
    v.lookYaw = 0; v.lookPitch = -0.08;
    audio.play('door', v.pos);
    if (v.kind === 'moped' || v.kind === 'tractor') v.seatbelt = true;
    g.achieve('drive_' + v.kind, ...{ car: ['First Drive', 'Drove the Ruska under its own power'], van: ['Van Life', 'Took the Kuormuri for a spin'], tractor: ['Farmer\'s Boy', 'Drove the Vuoksi tractor'], moped: ['Easy Rider', 'Rode the Pappa 50 moped'] }[v.kind] || ['Driver', 'Drove something']);
    if (v === g.car && !v.registered) g.ui.toast('No plates on the Ruska — avoid the police on public roads until it passes inspection in Rautala.', 5);
  }
  exitVehicle(force = false) {
    const g = this.g, p = g.player, v = p.inVehicle;
    if (!v) return;
    if (!force && v.speedKmh > 20) { g.ui.toast('Slow down first!'); return; }
    // find a free exit spot
    let ex = v.exitWorld();
    for (const off of [0, 1, -1, 2]) {
      const cand = v.toWorld(new THREE.Vector3(v.cfg.exit[0] * (off === -1 ? -1 : 1), v.cfg.exit[1] + 0.5, v.cfg.exit[2] + (off === 2 ? 2 : 0)));
      const hit = g.physics.ray({ x: cand.x, y: cand.y + 1.5, z: cand.z }, { x: 0, y: -1, z: 0 }, 4, { exclude: p.collider });
      if (hit) { ex = cand; ex.y = cand.y + 1.5 - hit.toi; break; }
    }
    p.inVehicle = null; v.driver = null;
    v.throttle = 0; v.brake = 0; v.handbrake = 1; v.clutchPedal = 0;
    if (v.gear !== 0 && v.engineOn && v.speedKmh < 3) v.parkBrake = true;
    p.teleport(ex);
    p.setEnabled(true);
    p.yaw = Math.atan2(-(v.forwardVec().x), -(v.forwardVec().z)) + Math.PI;
    audio.play('door', v.pos);
    if (g.radio.on && g.radio.source === 'car') g.radio.setPlaying(false);
  }
  eject(v, impact) {
    const g = this.g, p = g.player;
    const fwd = v.forwardVec();
    this.exitVehicle(true);
    const pos = v.toWorld(new THREE.Vector3(0, 1.3, 2.5));
    p.teleport(pos);
    p.vel.set(fwd.x * impact * 0.6, 4, fwd.z * impact * 0.6);
    p.grounded = false;
    g.ui.toast('You flew through the windscreen! Seatbelt (B) next time...', 5);
    p.hurt(impact > 22 ? 120 : 45, 'flew through the windscreen');
    g.achieve('eject', 'Human Cannonball', 'Got launched through the windscreen');
  }
  vehicleImpact(v, impact) {
    const g = this.g;
    if (v.driver) { g.stats.crashes = (g.stats.crashes || 0) + (impact > 8 ? 1 : 0); if (impact > 8) g.achieve('crash', 'Insurance Claim', 'Had your first proper crash'); }
    // moose collision
    const m = g.npcs.moose;
    if (m.pos.distanceTo(v.pos) < 4 && m.dead <= 0 && impact > 5) { m.hit(); g.ui.toast('You hit a MOOSE!', 4); g.achieve('moose', 'Hirvikolari', 'Collided with a moose (and survived?)'); if (v.driver) g.player.hurt(impact * 2.5, 'hit a moose'); }
    // police car collision
    const pc = g.traffic.police;
    if (pc.pos.distanceTo(v.pos) < 5 && v.driver && g.traffic.pol.state !== 'pursuit') g.traffic.startPursuit([{ id: 'ram', text: 'hitting a police car', fine: 800 }]);
    // pedestrians
    for (const n of g.npcs.list) if (n.obj.visible && n.pos.distanceTo(v.pos) < 3 && v.speedKmh > 15) { n.knock = 6; n.say('AAARGH!', 2); g.state.money -= 0; if (g.traffic.pol.state !== 'pursuit') g.traffic.startPursuit([{ id: 'hitrun', text: 'running over a pedestrian', fine: 1500 }]); }
  }
  honk(v) {
    const g = this.g;
    for (const n of g.npcs.list) if (n.obj.visible && n.pos.distanceTo(v.pos) < 15 && Math.random() < 0.05) n.say(pick(['Yeah yeah!', 'Moi!', 'What?', 'Perkele, quiet!']), 2);
  }
  carStarted(v) {
    const g = this.g;
    if (v === g.car) {
      if (!g.state.carStartedOnce) { g.state.carStartedOnce = true; g.ui.toast('🎉 THE RUSKA IS ALIVE!', 5); g.achieve('firststart', 'It\'s Alive!', 'Started the Ruska for the first time'); g.sdk.happytime(); }
    }
  }
  partAttached(inst, slot) {
    const g = this.g;
    const c = g.car.completion();
    if (c.have >= 20) g.achieve('parts20', 'Getting There', 'Attached 20 parts to the Ruska');
    if (c.have >= c.total) g.achieve('allparts', 'Complete Build', 'Every part slot of the Ruska filled');
  }

  // ---------------------------------------------------------------- police
  policeStop(reasons, arrest) {
    const g = this.g;
    const total = reasons.reduce((s, r) => s + r.fine, 0);
    const list = reasons.map((r) => `• ${r.text} — ${fmtMoney(r.fine)}`).join('<br>');
    if (arrest) {
      g.stats.arrests = (g.stats.arrests || 0) + 1;
      g.ui.menu({ title: '🚔 You are under arrest!', text: `Constable Nieminen: "Step out of the vehicle."<br><br>${list}<br><br>You will spend the night in the cell. Fine: <b>${fmtMoney(total)}</b> (taken from your wallet, the rest becomes debt).`, options: [{ label: 'Go quietly', action: () => { this.arrest(total); } }] });
      g.achieve('arrest', 'Jailbird', 'Got arrested');
    } else {
      g.ui.menu({ title: '🚔 Pulled over', text: `Constable Nieminen: "Do you know why I stopped you?"<br><br>${list}<br><br>Total fine: <b>${fmtMoney(total)}</b>`, options: [{ label: `Pay the fine (${fmtMoney(total)})`, action: () => { g.spend(Math.min(total, g.state.money)); if (total > g.state.money) g.state.debt = (g.state.debt || 0) + total - g.state.money; g.ui.toast('Fine paid. Drive safely.'); } }] });
      g.achieve('ticket', 'Ticketed', 'Got fined by the police');
    }
  }
  async arrest(fine) {
    const g = this.g, p = g.player;
    const v = p.inVehicle;
    if (v) this.exitVehicle(true);
    const paid = Math.min(fine, g.state.money); g.spend(paid);
    if (fine > paid) g.state.debt = (g.state.debt || 0) + fine - paid;
    p.sleeping = true;
    await g.ui.fade('A night in the Rautala lock-up', 'The bed is hard. The constable snores.', 2600);
    if (v) { v.setPose(g.spots.impound, 0); v.engineOn = false; if (v === g.car) { v.locked = true; v.lockedMsg = 'Impounded. Pay the release fee at the police desk.'; g.state.impounded = true; } }
    const toMorning = ((8 * 60 - (g.time.minutes % 1440)) + 1440) % 1440;
    g.advanceTime(Math.max(120, toMorning), true);
    p.teleport(g.spots.jailBed.clone().add(new THREE.Vector3(0.8, 0, 0)));
    p.n.fatigue = 10; p.n.drunk = 0; p.n.stress = Math.min(100, p.n.stress + 20);
    p.sleeping = false;
    g.ui.toast('You are released. The police station is in Rautala. Taxi home costs money...', 6);
    g.saveGame();
  }
  policeDesk() {
    const g = this.g;
    const opts = [];
    if (g.state.impounded) opts.push({ label: 'Release the impounded Ruska (300 mk)', disabled: g.state.money < 300, action: () => { g.spend(300); g.car.locked = false; g.state.impounded = false; g.ui.toast('Keys returned. The car is in the yard outside.'); } });
    if (g.state.debt > 0) opts.push({ label: `Pay outstanding fines (${fmtMoney(g.state.debt)})`, disabled: g.state.money < 1, action: () => { const p = Math.min(g.state.debt, g.state.money); g.spend(p); g.state.debt -= p; } });
    opts.push({ label: 'Ask about the law', action: () => { g.npcs.nieminen.say(pick(LINES.nieminen)); } });
    g.ui.menu({ title: 'Rautala Police', text: 'Constable Nieminen looks up from his coffee.', options: opts });
  }

  // ---------------------------------------------------------------- mail, phone
  mailbox() {
    const g = this.g;
    const mail = g.state.mail ||= [];
    this.setMailbox(true);
    if (!mail.length) { g.ui.toast('The mailbox is empty. New mail comes in the morning.'); after(1.4, () => this.setMailbox(false)); return; }
    after(0.5, () => this.readMailQueue([...mail]));
  }
  readMail(e) {
    const g = this.g, m = e.data;
    (g.state.tutFlags ||= {}).letter = true;
    const opts = [];
    if (m.kind === 'bill' && !m.paid) opts.push({ label: `Pay now (${fmtMoney(m.amount)})`, disabled: g.state.money < m.amount, action: () => { g.spend(m.amount); m.paid = true; g.state.bills = Math.max(0, (g.state.bills || 0) - 1); g.items.remove(e); g.ui.toast('Bill paid.'); } });
    if (m.kind === 'gift' && !m.taken) opts.push({ label: `Take the money (${fmtMoney(m.amount)})`, action: () => { m.taken = true; g.earn(m.amount, m.title); g.items.remove(e); } });
    g.ui.menu({ title: m.title, text: m.text, options: opts.length ? opts : [{ label: 'OK' }] });
    return true;
  }
  deliverMail() {
    const g = this.g;
    const day = Math.floor(g.time.minutes / 1440);
    const mail = g.state.mail ||= [];
    if (day % 7 === 0 && day > 0) { mail.push({ kind: 'bill', title: 'Electricity bill', text: 'Kurkijärven Sähkö Oy<br>Electricity for the past week: 140 mk.<br>Unpaid bills will result in the power being cut.', amount: 140 }); g.state.bills = (g.state.bills || 0) + 1; }
    if (Math.random() < 0.25) mail.push({ kind: 'gift', title: 'Letter from Mum', text: 'Dear son, are you eating properly? Here is a little something. Don\'t spend it on beer. Love, Mum', amount: Math.round(rand(80, 200)) });
    if (Math.random() < 0.35) mail.push({ kind: 'ad', title: 'Advert: Rautalan Varaosa', text: 'SUMMER SALE! Racing parts for your Ruska! Twin carbs, rally axles and more. Order by phone for next-morning delivery.' });
    if (day % 7 === 4) mail.push({ kind: 'ad', title: 'Rally invitation', text: 'KURKI-SPRINT gravel rally this Saturday 12:00–18:00. Entry 150 mk. Prizes up to 2500 mk! — Jari, organiser' });
    if (mail.length) g.ui.toast('📬 You have mail.', 3);
  }
  phone() {
    const g = this.g, H = g.home?.phone?.userData.parts?.handset;
    if (H) { tween(H, 'position.y', 0.24, 0.3); tween(H, 'rotation.z', 0.5, 0.3); }
    audio.play('click', g.camera.position);
    after(0.35, () => g.ui.menu({
      onClose: () => { if (H) { tween(H, 'position.y', 0.13, 0.3); tween(H, 'rotation.z', 0, 0.3); } },
      title: '☎ Telephone', text: 'Who do you want to call?',
      options: [
        { label: 'Rautalan Varaosa — order parts', sub: 'Delivered to your garage the next morning (+80 mk)', action: () => { setTimeout(() => this.shop('parts', true), 50); } },
        { label: 'Seppo — tow the Ruska home', sub: '250 mk', disabled: g.state.money < 250, action: () => { this.tow(); } },
        { label: 'Taxi Kurkijärvi', sub: 'Pick a destination (120 mk)', disabled: g.state.money < 120, action: () => { setTimeout(() => this.taxi(), 50); } },
        { label: 'Pizza Kurkimäki — order a pizza', sub: '28 mk, delivered to your porch', disabled: g.state.money < 28, action: () => { g.spend(28); g.ui.toast('Pizza ordered. 30 minutes or so.'); g.state.pizzaAt = g.time.minutes + 30; } },
        { label: 'Call a random number', action: () => { this.prankCall(); } },
      ],
    }));
  }
  prankCall() {
    const lines = ['"Hello? Is this the sausage factory? ...No? Then why did you answer?"', '"...*heavy breathing*... sorry, wrong number."', '"This is your neighbour Pertti. Do you have beer? No? *click*"', '"Have you considered upgrading your phone line to the new digital—" *you hang up*', '"Is your refrigerator running? Then you\'d better go catch it!" ...You prank called yourself somehow.'];
    this.g.ui.menu({ title: '☎ Ring ring...', text: pick(lines), options: [{ label: 'Hang up' }] });
  }
  async tow() {
    const g = this.g, car = g.car;
    if (car.onStands) { g.ui.toast('The Ruska is already in the garage.'); return; }
    g.spend(250);
    await g.ui.fade('Seppo tows the Ruska home', '"That will be 250 marks."', 1800);
    car.setPose(g.spots.garage.clone().add(new THREE.Vector3(0.4, 0.8, 2.5)), 0);
    car.engineOn = false;
    g.advanceTime(45);
  }
  taxi() {
    const g = this.g;
    const dests = [['Home', g.spots.spawn], ['Kurkimäki village', g.spots.shopFront], ['Rautala town', g.spots.jailExit], ['Haapala farm', g.spots.barnDoor], ['Rally HQ', g.spots.rallyHQ]];
    g.ui.menu({ title: '🚕 Taxi', text: 'Where to?', options: dests.map(([n, p]) => ({ label: n, action: async () => { g.spend(120); await g.ui.fade('Taxi ride', `To ${n}`, 1500); g.advanceTime(25); g.player.teleport(p.clone().add(new THREE.Vector3(0, 0.3, 0))); } })) });
  }

  // ---------------------------------------------------------------- shops
  shop(kind, delivery = false) {
    const g = this.g;
    if (!delivery && !this.isOpen(kind) && kind !== 'junk') { g.ui.toast('Closed.'); return; }
    if (kind === 'shop') {
      const items = [
        ...[['beer', 'Drinks'], ['beerCase', 'Drinks'], ['lonkero', 'Drinks'], ['soda', 'Drinks'], ['milk', 'Drinks'], ['coffee', 'Drinks'], ['sausage', 'Food'], ['bread', 'Food'], ['pizza', 'Food'], ['chips', 'Food'], ['candy', 'Food'], ['oilCan', 'Car care'], ['coolant', 'Car care'], ['brakeFluid', 'Car care'], ['fuelCan', 'Car care'], ['fishingRod', 'Other'], ['firstAid', 'Other']]
          .map(([id, cat]) => ({ id, cat, name: ITEMS[id].name, price: ITEMS[id].price })),
        ...PAINTS.map(([n, c], i) => ({ id: 'paint' + i, cat: 'Car care', name: `Spray paint: ${n}`, price: 35, paint: c })),
      ];
      // pay bills at the counter
      const footer = (g.state.bills || 0) > 0 ? `You have ${g.state.bills} unpaid bill(s) — read them from your mailbox to pay.` : '';
      g.ui.shop({ title: 'Kurkimäen Kauppa', items, footer, onBuy: (list) => this.dispense(list, g.spots.shopDrop) });
      g.npcs.tarja.say(pick(LINES.tarja));
    } else if (kind === 'pub') {
      const items = [
        { id: 'beer', name: 'Draught beer (in a bottle, it is 1997)', price: 7 }, { id: 'lonkero', name: 'Lonkero', price: 8 },
        { id: 'sausageCooked', name: 'Grilled sausage with mustard', price: 9 }, { id: 'soda', name: 'Lemon soda', price: 4 }, { id: 'chips', name: 'Chips', price: 4 },
      ];
      g.ui.shop({ title: 'Baari Kontio', items, onBuy: (list) => this.dispense(list, g.spots.pubDrop, false) });
      g.npcs.kaija.say(pick(LINES.kaija));
    } else if (kind === 'kiosk') {
      const items = ['candy', 'soda', 'chips', 'coffee', 'sausageCooked'].map((id) => ({ id, name: ITEMS[id].name, price: (ITEMS[id].price || 8) + 1 }));
      items.push({ id: 'newspaper', name: 'Kurki-Sanomat newspaper', price: 5 });
      g.ui.shop({ title: 'Kioski Pikku-Pala', items, onBuy: (list) => this.dispense(list, g.spots.kiosk.clone().add(new THREE.Vector3(0, 1.4, 0)), false) });
    } else if (kind === 'parts') {
      const items = Object.entries(PARTS).filter(([id, d]) => d.price > 0).map(([id, d]) => ({ id, cat: d.cat === 'Performance' || d.cat === 'Cosmetic' || d.cat === 'Safety' ? 'Performance & tuning' : d.cat === 'Engine' || d.cat === 'Ignition' || d.cat === 'Fuel' || d.cat === 'Cooling' ? 'Engine & ignition' : 'Body & chassis', name: d.name, price: d.price }));
      items.push({ id: 'ratchet', cat: 'Tools', name: ITEMS.ratchet.name, price: ITEMS.ratchet.price }, { id: 'afrGauge', cat: 'Tools', name: ITEMS.afrGauge.name, price: ITEMS.afrGauge.price });
      for (const t of ['doorL', 'doorR', 'hood', 'trunk', 'fenderL', 'fenderR']) items.push({ id: 'panel:' + t, cat: 'Body & chassis', name: `Body panel: ${g.car.defOf('panel:' + t).name}`, price: g.car.defOf('panel:' + t).price });
      g.ui.shop({ title: delivery ? 'Rautalan Varaosa — phone order' : 'Rautalan Varaosa', items: items.sort((a, b) => a.cat.localeCompare(b.cat)), delivery: 80, footer: delivery ? 'Phone orders are always delivered to your garage.' : 'Parts are placed on the counter, or delivered to your garage tomorrow morning.',
        onBuy: (list, deliver) => {
          if (deliver || delivery) { g.state.deliveryPending = { list: list.map(({ item, n }) => ({ id: item.id, n })), ready: false, at: Math.floor(g.time.minutes / 1440) + 1 }; g.ui.toast('Order placed: delivery to your garage tomorrow morning.'); }
          else this.dispenseParts(list, g.spots.partsDrop);
        } });
      if (!delivery) g.npcs.jussi.say(pick(LINES.jussi));
    } else if (kind === 'junk') this.junkShop();
  }
  dispense(list, pos, bag = true) {
    const g = this.g;
    let k = 0;
    for (const { item, n } of list) for (let i = 0; i < n; i++) {
      const p = pos.clone().add(new THREE.Vector3((k % 4) * 0.18 - 0.27, 0.1 + Math.floor(k / 4) * 0.25, (Math.floor(k / 2) % 2) * 0.15));
      if (item.paint !== undefined) g.items.spawn('sprayCan', p, { data: { color: item.paint } });
      else if (ITEMS[item.id]) g.items.spawn(item.id, p);
      else this.dispenseParts([{ item, n: 1 }], pos);
      k++;
    }
    g.ui.toast('Your purchase is on the counter.');
  }
  dispenseParts(list, pos) {
    const g = this.g, car = g.car;
    let k = 0;
    for (const { item, n } of list) for (let i = 0; i < n; i++) {
      const p = pos.clone().add(new THREE.Vector3((k % 3) * 0.35 - 0.35, 0.2 + Math.floor(k / 3) * 0.35, 0));
      if (ITEMS[item.id]) g.items.spawn(item.id, p);
      else { const inst = car.createPart(item.id, { data: item.id === 'battery' ? { charge: 1 } : item.id === 'tank' ? { fuel: 0 } : {} }); car.spawnLoose(inst, p); }
      k++;
    }
  }
  checkDelivery() {
    const g = this.g, d = g.state.deliveryPending;
    if (!d) return;
    const day = Math.floor(g.time.minutes / 1440), hr = (g.time.minutes % 1440) / 60;
    if (day >= d.at && hr >= 7) {
      const list = d.list.map(({ id, n }) => ({ item: { id }, n }));
      this.dispenseParts(list, g.spots.partsArea.floor.clone().add(new THREE.Vector3(0, 0.3, 0)));
      g.state.deliveryPending = null;
      g.ui.toast('📦 Your parts order was delivered to the garage.', 5);
    }
  }
  junkShop() {
    const g = this.g, car = g.car;
    const day = Math.floor(g.time.minutes / 1440);
    if (!g.state.junkStock || g.state.junkDay !== day) {
      g.state.junkDay = day;
      const ids = Object.keys(PARTS).filter((k) => PARTS[k].price > 40 && !PARTS[k].variant);
      g.state.junkStock = Array.from({ length: 10 }, () => { const id = pick(ids); const cond = +rand(0.3, 0.85).toFixed(2); return { id, cond, price: Math.round(PARTS[id].price * 0.3 * (0.5 + cond)) }; });
    }
    // parts in the drop zone can be sold
    const sellable = [...car.parts.values()].filter((i) => !i.slot && i.ent?.body && i.mesh.position.distanceTo(g.spots.junkDrop) < 3.5);
    const opts = g.state.junkStock.map((s, i) => ({ label: `${PARTS[s.id].name} (${Math.round(s.cond * 100)}% condition)`, sub: fmtMoney(s.price), disabled: g.state.money < s.price, action: () => { g.spend(s.price); g.state.junkStock.splice(i, 1); const inst = car.createPart(s.id, { cond: s.cond, data: s.id === 'battery' ? { charge: 0.3 } : {} }); car.spawnLoose(inst, g.spots.junkDrop.clone().add(new THREE.Vector3(0, 0.5, 0))); audio.play('cash'); } }));
    if (sellable.length) opts.unshift({ label: `Sell ${sellable.length} part(s) on the ground next to me`, sub: fmtMoney(sellable.reduce((s, i) => s + Math.round(i.def.price * 0.2 * i.cond), 0)), action: () => { let sum = 0; for (const i of sellable) { sum += Math.round(i.def.price * 0.2 * i.cond); g.items.remove(i.ent); car.parts.delete(i.uid); i.mesh.removeFromParent(); } g.earn(sum, 'Sold scrap parts'); } });
    g.ui.menu({ title: 'Romu-Raimo\'s Junkyard', text: 'Used parts, cheap. Condition varies. Drop parts next to the shack to sell them.', options: opts, wide: true });
    g.npcs.raimo.say(pick(LINES.raimo));
  }

  // ---------------------------------------------------------------- slot machine & fishing
  slot() {
    const g = this.g;
    if (g.state.money < 5) { g.ui.toast('You need 5 mk.'); return; }
    g.spend(5); audio.play('coin');
    const syms = ['🍒', '🍋', '⭐', '7️⃣', '🔔', '🍺'];
    const r = [pick(syms), pick(syms), pick(syms)];
    let win = 0;
    if (r[0] === r[1] && r[1] === r[2]) win = r[0] === '7️⃣' ? 250 : r[0] === '⭐' ? 100 : 40;
    else if (r[0] === r[1] || r[1] === r[2]) win = 8;
    setTimeout(() => {
      g.ui.toast(`🎰 ${r.join(' ')} ${win ? `— WIN ${fmtMoney(win)}!` : ''}`, 3);
      if (win) { g.earn(win, 'Slot machine'); audio.play(win > 50 ? 'jackpot' : 'cash'); if (win >= 100) g.achieve('jackpot', 'Onnenpekka', 'Won big on the slot machine'); }
      g.stats.slots = (g.stats.slots || 0) + 1;
      if (g.stats.slots >= 20) g.achieve('gambler', 'Problem Gambler', 'Played the slot machine 20 times');
    }, 600);
  }
  fishLabel() { return this.g.interact.held?.defId === 'fishingRod' ? 'Cast the line (E)' : 'Dock (bring a fishing rod to fish)'; }
  fish() {
    const g = this.g;
    const rod = g.interact.held?.defId === 'fishingRod';
    if (!rod) { g.ui.toast('You need a fishing rod (sold at the shop).'); return; }
    const p = g.player.pos;
    if (g.terrain.getHeight(p.x + Math.sin(-g.player.yaw) * 4, p.z - Math.cos(g.player.yaw) * 4) > WATER_LEVEL - 0.3 && g.spots.dockEnd.distanceTo(p) > 4) { g.ui.toast('Find deeper water — the end of the dock is good.'); return; }
    if (this.fishing) return;
    this.fishing = { t: rand(4, 14), bite: 0 };
    audio.play('swing', g.camera.position); setTimeout(() => audio.play('splash', g.spots.dockEnd, 0.3), 500);
    g.ui.toast('Waiting for a bite... press E when the bobber dips!', 4);
  }
  updateFishing(dt) {
    const f = this.fishing, g = this.g;
    if (!f) return;
    if (g.interact.held?.defId !== 'fishingRod') { this.fishing = null; return; }
    f.t -= dt;
    if (f.t <= 0 && !f.bite) { f.bite = 1.4; audio.play('fishBite', g.spots.dockEnd); g.ui.toast('!!! BITE !!! Press E', 1.4); }
    if (f.bite) {
      f.bite -= dt;
      if (g.input.hit('KeyE')) {
        this.fishing = null;
        const r = Math.random();
        const kind = r < 0.15 ? 'pike' : r < 0.6 ? 'perch' : 'roach';
        audio.play('reel', g.camera.position); audio.play('splash', g.spots.dockEnd, 0.6);
        // land the catch on the dock behind you (not in the lake)
        const y = g.player.yaw, back = new THREE.Vector3(Math.sin(y), 0, Math.cos(y)).multiplyScalar(0.7);
        const e = g.items.spawn('fishRaw', new THREE.Vector3(g.player.pos.x, g.player.feetY() + 0.3, g.player.pos.z).add(back), { data: { kind } });
        e.def = { ...e.def, name: { pike: 'Pike (hauki)', perch: 'Perch (ahven)', roach: 'Roach (särki)' }[kind] };
        g.ui.toast(`You caught a ${e.def.name}!`);
        g.stats.fish = (g.stats.fish || 0) + 1;
        g.achieve('fish', 'Kalamies', 'Caught a fish');
        if (kind === 'pike') g.achieve('pike', 'The Big One', 'Caught a pike');
        return;
      }
      if (f.bite <= 0) { this.fishing = null; g.ui.toast('It got away...'); }
    }
  }
  returnBottles() {
    const g = this.g;
    const near = g.items.list.filter((e) => e.defId === 'emptyBottle' && e.mesh.position.distanceTo(g.player.pos) < 3.5);
    const held = g.interact.held?.defId === 'emptyBottle' ? [g.interact.held] : [];
    const all = [...new Set([...near, ...held])];
    if (!all.length) { g.ui.toast('Bring empty bottles here (put them on the floor next to the machine).'); return; }
    for (const e of all) g.items.remove(e);
    g.earn(all.length * 0.5, `Returned ${all.length} bottles`);
    audio.play('glass');
    g.stats.bottles = (g.stats.bottles || 0) + all.length;
    if (g.stats.bottles >= 24) g.achieve('recycler', 'Pullonpalauttaja', 'Returned 24 bottles');
  }

  // ---------------------------------------------------------------- rally & inspection
  rallyOffice() {
    const g = this.g, r = g.rally;
    const day = Math.floor(g.time.minutes / 1440);
    const opts = [];
    if (r.active) opts.push({ label: 'Cancel current run', action: () => r.abort('Run cancelled.') });
    else {
      if (r.isRaceDay() && g.state.rallyDone !== day) opts.push({ label: 'Enter the Kurki-Sprint rally (150 mk)', sub: 'Prizes: 2500 / 1200 / 600 mk', disabled: g.state.money < 150, action: () => { g.spend(150); r.begin(true); } });
      else opts.push({ label: 'Rally race (Saturdays 12–18)', sub: g.state.rallyDone === day ? 'You already raced today' : 'Come back on Saturday', disabled: true });
      opts.push({ label: 'Practice run (free)', action: () => r.begin(false) });
    }
    const rivals = r.rivals().map((x) => `${x.name}: ${r.fmt(x.time)}`).join('<br>');
    g.ui.menu({ title: 'Kurki-Sprint rally office', text: `Jari: "Stage length ${(r.length / 1000).toFixed(1)} km of gravel. Your best: ${g.state.bestRally ? r.fmt(g.state.bestRally) : 'none'}."<br><small>Last week's top times:<br>${rivals}</small>`, options: opts });
  }
  inspection() {
    const g = this.g, car = g.car;
    if (car.pos.distanceTo(g.spots.inspectionBay) > 8 || car.onStands) { g.npcs.mattila.say('Bring the Ruska into the inspection bay first.'); return; }
    if (car.registered) { g.npcs.mattila.say('Your car is already registered. Drive safely.'); return; }
    g.ui.menu({ title: 'Vehicle inspection — 280 mk', text: 'Inspector Mattila will check brakes, lights, steering, wheels, exhaust and emissions.', options: [{ label: 'Inspect my car (280 mk)', disabled: g.state.money < 280, action: () => { g.spend(280); setTimeout(() => this.runInspection(), 50); } }] });
  }
  runInspection() {
    const g = this.g, car = g.car, s = car.slots;
    const fails = [];
    const need = (k, txt) => { if (!s[k]) fails.push(`Missing: ${txt}`); else if (car.tightFrac(s[k]) < 0.99 && s[k].def.bolts > 0) fails.push(`Loose: ${txt}`); else if (s[k].cond < 0.35) fails.push(`Worn out: ${txt}`); };
    [['headlightL', 'left headlight'], ['headlightR', 'right headlight'], ['taillightL', 'left tail light'], ['taillightR', 'right tail light'], ['caliperFL', 'front left brake'], ['caliperFR', 'front right brake'], ['drumRL', 'rear left brake'], ['drumRR', 'rear right brake'], ['rack', 'steering rack'], ['swheel', 'steering wheel'], ['muffler', 'muffler'], ['pipe', 'exhaust pipe'], ['seatL', 'driver seat'], ['mirrorL', 'left mirror'], ['bumperF', 'front bumper'], ['bumperR', 'rear bumper'], ['wheelFL', 'front left wheel'], ['wheelFR', 'front right wheel'], ['wheelRL', 'rear left wheel'], ['wheelRR', 'rear right wheel'], ['doorL', 'left door'], ['doorR', 'right door'], ['hood', 'hood'], ['trunk', 'trunk lid'], ['fenderL', 'left fender'], ['fenderR', 'right fender']].forEach(([k, t]) => need(k, t));
    if (car.brakeFluid < 0.2) fails.push('Brake fluid low');
    if (s.muffler?.def.variant === 'straight') fails.push('Exhaust too loud (straight pipe)');
    if (car.tuning.afr < 12.4 || car.tuning.afr > 15.6) fails.push(`Emissions out of range (AFR ${car.tuning.afr.toFixed(1)}, must be 12.5–15.5)`);
    if (car.startProblems().length) fails.push('Engine does not run');
    if (fails.length) {
      g.ui.menu({ title: '❌ Inspection FAILED', text: `Mattila shakes his head.<br><br>${fails.slice(0, 12).map((f) => '• ' + f).join('<br>')}${fails.length > 12 ? `<br>…and ${fails.length - 12} more` : ''}<br><br>Fix these and come back.`, options: [{ label: 'Perkele.' }], wide: true });
      return;
    }
    const plate = 'RKA-' + (100 + Math.floor(Math.random() * 899));
    car.registered = true; car.plates = plate;
    for (const k of ['plateF', 'plateR']) { const inst = car.createPart('plate', { data: { text: plate } }); car.attach(inst, k, { silent: true, tight: car.maxTight(inst) }); }
    g.ui.menu({ title: '✅ Inspection PASSED', text: `Mattila: "Well I never. It actually passed."<br><br>Your Ruska is now registered: <b>${plate}</b>. You can drive on public roads legally.`, options: [{ label: 'YES!' }] });
    g.achieve('registered', 'Street Legal', 'Passed the vehicle inspection');
    g.sdk.happytime();
  }
  mechanic() {
    const g = this.g, car = g.car;
    const near = car.pos.distanceTo(g.spots.mechanicBay) < 12 && !car.onStands;
    const damaged = [...car.parts.values()].filter((i) => i.slot && i.cond < 0.9);
    const cost = Math.round(damaged.reduce((s, i) => s + i.def.price * (1 - i.cond) * 0.6, 0));
    const opts = [
      { label: `Repair all damaged parts`, sub: near ? fmtMoney(cost) : 'Bring the Ruska to the workshop', disabled: !near || cost === 0 || g.state.money < cost, action: async () => { g.spend(cost); await g.ui.fade('Seppo works his magic', 'Clanking, swearing, more clanking', 1800); for (const i of damaged) { i.cond = 1; i._dented = false; } car.dirty = true; g.advanceTime(120); } },
      { label: 'Tune carburettor & ignition', sub: near ? '150 mk' : 'Bring the Ruska', disabled: !near || g.state.money < 150, action: () => { g.spend(150); car.tuning.afr = 13.4; car.tuning.timing = 11.5; car.dirty = true; g.ui.toast('Seppo: "Now it runs sweet. AFR 13.4, timing 11.5."'); } },
      { label: 'Fill all fluids', sub: near ? '160 mk' : 'Bring the Ruska', disabled: !near || g.state.money < 160, action: () => { g.spend(160); if (car.slots.oilpan) car.oil = 3.5; if (car.slots.radiator) car.coolant = 5; if (car.slots.brakemaster) car.brakeFluid = 0.5; car.dirty = true; g.ui.toast('Oil, coolant and brake fluid topped up.'); } },
    ];
    g.ui.menu({ title: 'Seppo\'s workshop', text: pick(LINES.seppo), options: opts });
  }

  // ---------------------------------------------------------------- death
  death(cause) {
    const g = this.g;
    g.stats.deaths = (g.stats.deaths || 0) + 1;
    if (g.player.inVehicle) this.exitVehicle(true);
    g.fx.fade = 0.6;
    g.ui.death(cause, async () => {
      const ok = await g.sdk.requestAd('rewarded');
      if (!ok) { g.ui.toast('Ad not available. Loading your last save.'); g.loadGame(); return; }
      g.ui.hideOverlay(); g.closeModal();
      const p = g.player;
      p.dead = false; p.n.health = 60; p.n.hunger = Math.min(p.n.hunger, 50); p.n.thirst = Math.min(p.n.thirst, 50); p.n.heat = 0; p.n.drunk = 0; p.n.fatigue = 30;
      await g.ui.fade('Rautala hospital', 'The doctor sighs. "You again?" (−150 mk)', 2200);
      g.spend(Math.min(150, g.state.money));
      p.teleport(g.spots.jailExit.clone());
      g.advanceTime(180);
    }, () => { g.loadGame(); });
  }
}
