import * as THREE from 'three';
import { rand, pick, fmtMoney, clamp } from '../core/util.js';
import { audio } from '../core/audio.js';
import { P, FIELDS } from '../world/layout.js';

// Jobs: hay bales (tractor), newspaper round (moped), van deliveries, firewood sale, Pertti taxi.
export class Jobs {
  constructor(game) {
    this.game = game;
    this.active = null;
  }

  markers() {
    const out = [];
    const j = this.active;
    if (j) {
      if (j.type === 'hay') {
        // most urgent first: get the tractor, then a bale, then the barn
        const left = j.bales.filter((b) => !b.done);
        const tr = this.game.tractor;
        if (this.game.player.inVehicle !== tr) out.push({ pos: tr.pos.clone(), label: 'Tractor', icon: '🚜' });
        if (tr.bale === null) { const nb = left.find(() => true); if (nb) out.push({ pos: nb.ent.mesh.position.clone(), label: 'Hay bale', icon: '⬤' }); }
        if (left.length) out.push({ pos: this.game.spots.barnDrop, label: `Barn (${j.delivered}/${j.bales.length})`, icon: '🏠' });
      }
      if (j.type === 'paper') { const n = j.stops.find((s) => !s.done); if (n) out.push({ pos: n.pos, label: `Mailbox ${j.stops.filter((s) => s.done).length + 1}/${j.stops.length}`, icon: '📰' }); }
      if (j.type === 'delivery') out.push({ pos: j.dest, label: j.destName, icon: '📦' });
      if (j.type === 'taxi') out.push({ pos: j.dest, label: j.destName, icon: '🍺' });
    }
    const r = this.game.rally;
    if (r && r.active) { const cp = r.nextCheckpoint(); if (cp) out.push({ pos: cp, label: 'Checkpoint', icon: '🏁' }); }
    if (this.game.state.deliveryPending && this.game.state.deliveryPending.ready) out.push({ pos: this.game.spots.partsArea.floor, label: 'Parts delivery', icon: '📦' });
    return out;
  }

  // ---------------------------------------------------------------- hay job (farm)
  startHay() {
    const g = this.game;
    if (this.active) { g.ui.toast('Finish your current job first.'); return; }
    const bales = [];
    const fields = FIELDS.filter((f) => f.crop === 'hay');
    for (let i = 0; i < 8; i++) {
      const f = fields[i % fields.length];
      const x = f.x + rand(-f.w * 0.35, f.w * 0.35), z = f.z + rand(-f.d * 0.35, f.d * 0.35);
      const ent = g.items.spawn('hayBale', new THREE.Vector3(x, g.terrain.getHeight(x, z) + 0.8, z), { rot: { x: 0, y: Math.sin(i), z: 0, w: Math.cos(i) } });
      bales.push({ ent, done: false });
    }
    this.active = { type: 'hay', bales, delivered: 0, pay: 95 };
    g.ui.objective('Hay job: bales to the barn', 'Take the tractor. Drive the fork into a bale, lift it with {R}, bring it to the barn and lower it with {F}.');
  }
  updateHay(dt) {
    const g = this.game, j = this.active, tr = g.tractor;
    // spear: bale near fork tip attaches
    const tip = tr.forkTipWorld(_v);
    if (!tr.bale) {
      for (const b of j.bales) {
        if (b.done || !b.ent.body) continue;
        if (b.ent.mesh.position.distanceTo(tip) < 1.1 && g.player.inVehicle === tr) {
          tr.bale = b; b.ent.body.setBodyType(g.physics.R.RigidBodyType.KinematicPositionBased, true);
          audio.play('thud', tip, 0.6); break;
        }
      }
    } else {
      const b = tr.bale;
      const p = tr.toWorld(_v2.set(0, tr.forkHeight + 0.25, 2.55));
      b.ent.body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
      const q = tr.quat.clone(); b.ent.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      // drop in barn
      if (p.distanceTo(g.spots.barnDrop) < 7) {
        b.done = true; j.delivered++;
        tr.bale = null;
        g.items.remove(b.ent);
        g.earn(j.pay, `Hay bale delivered (${j.delivered}/${j.bales.length})`);
        audio.play('thud', p, 0.8);
        if (j.delivered >= j.bales.length) this.finish('Aune: "Kiitos! You are a good boy. Here, take some pulla too."', 120);
      } else if (g.input.hit('KeyG') && g.player.inVehicle === tr) {
        b.ent.body.setBodyType(g.physics.R.RigidBodyType.Dynamic, true); tr.bale = null;
      }
    }
  }

  // ---------------------------------------------------------------- newspaper round
  startPaper() {
    const g = this.game;
    if (this.active) { g.ui.toast('Finish your current job first.'); return; }
    const hw = g.terrain.roads.find((r) => r.id === 'highway');
    const lake = g.terrain.roads.find((r) => r.id === 'lakeroad');
    const stops = [];
    const pts = [[hw, 0.0], [hw, 0.05], [hw, 0.1], [lake, 0.2], [lake, 0.45], [lake, 0.7], [hw, 0.92], [hw, 0.96]];
    for (const [road, f] of pts) {
      const s = road.samples[Math.floor(f * (road.samples.length - 1))];
      const x = s.x - s.dz * (road.width / 2 + 2.5), z = s.z + s.dx * (road.width / 2 + 2.5);
      const pos = new THREE.Vector3(x, g.terrain.getHeight(x, z) + 1.2, z);
      const mb = g.makeMailbox(pos);
      stops.push({ pos, done: false, mb });
    }
    this.active = { type: 'paper', stops, start: g.time.minutes, pay: 35 };
    g.ui.objective('Newspaper round', 'Stop at each mailbox and press {E}. Faster = bonus.');
  }
  updatePaper(dt) {
    const g = this.game, j = this.active;
    const pp = g.player.inVehicle ? g.player.inVehicle.pos : g.player.pos;
    const next = j.stops.find((s) => !s.done);
    if (!next) return;
    const d = pp.distanceTo(next.pos);
    if (d < 6) {
      g.interact.prompt = { main: 'Mailbox', sub: 'Deliver the newspaper', keys: [['E', 'Deliver']] };
      if (g.input.hit('KeyE') || (g.player.inVehicle && g.input.hit('KeyG'))) this.deliverPaper(next);
    }
    // thrown papers
    for (const e of g.items.list) if (e.defId === 'newspaper' && e.mesh.position.distanceTo(next.pos) < 1.2) { g.items.remove(e); this.deliverPaper(next); break; }
  }
  deliverPaper(stop) {
    const g = this.game, j = this.active;
    stop.done = true;
    audio.play('thud', stop.pos, 0.3);
    g.earn(j.pay, 'Newspaper delivered');
    if (stop.mb) setTimeout(() => stop.mb.removeFromParent(), 20000);
    if (j.stops.every((s) => s.done)) {
      const mins = g.time.minutes - j.start;
      const bonus = Math.max(0, Math.round(160 - mins * 2));
      this.finish(`Round complete in ${Math.round(mins)} game minutes.`, bonus);
    }
  }

  // ---------------------------------------------------------------- van deliveries
  startDelivery() {
    const g = this.game;
    if (this.active) { g.ui.toast('Finish your current job first.'); return; }
    const dests = [
      { name: 'Summer cottage', pos: g.spots.cottage },
      { name: 'Haapala farm', pos: g.spots.barnDoor },
      { name: 'Kurkimäki shop', pos: g.spots.shopFront },
      { name: 'Rally HQ', pos: g.spots.rallyHQ },
    ];
    const d = pick(dests);
    const van = g.van;
    const crates = [];
    for (let i = 0; i < 4; i++) {
      const lp = new THREE.Vector3((i % 2 ? 0.35 : -0.35), 1.25 + Math.floor(i / 2) * 0.45, -1.2 - (i % 2) * 0.1);
      const p = van.toWorld(lp);
      crates.push(g.items.spawn('deliveryBox', p, { data: { dest: d.name } }));
    }
    this.active = { type: 'delivery', dest: d.pos.clone(), destName: d.name, crates, pay: 120 };
    g.ui.objective(`Delivery to ${d.name}`, 'The 4 crates are in your van. Drive there, then carry them to the marker.');
  }
  updateDelivery(dt) {
    const g = this.game, j = this.active;
    for (const c of j.crates) {
      if (c.done || !c.body) continue;
      if (c.mesh.position.distanceTo(j.dest) < 4.5 && c.body.linvel && Math.hypot(c.body.linvel().x, c.body.linvel().z) < 0.5 && g.interact.held !== c) {
        c.done = true; g.items.remove(c);
        g.earn(j.pay, 'Crate delivered');
      }
    }
    const lost = j.crates.filter((c) => !c.done && !c.body).length;
    if (j.crates.every((c) => c.done || !c.body)) this.finish(lost ? `Delivered ${j.crates.length - lost}/4 crates.` : 'All crates delivered!', lost ? 0 : 60);
  }

  // ---------------------------------------------------------------- taxi for Pertti
  startTaxi(vehicle, destName, dest) {
    const g = this.game;
    this.active = { type: 'taxi', vehicle, dest: dest.clone(), destName, pay: Math.round(rand(70, 130)), t: 0, comment: 8 };
    g.npcs.givePerttiRide(vehicle);
    g.ui.objective(`Taxi: Pertti to ${destName}`, 'Drive gently or he will throw up.');
  }
  updateTaxi(dt) {
    const g = this.game, j = this.active, v = j.vehicle;
    j.t += dt; j.comment -= dt;
    if (j.comment <= 0) {
      j.comment = rand(10, 25);
      const lines = ['Faster! The pub closes at two!', 'Did I ever tell you about my rally days?', 'Watch out for moose. They are everywhere. EVERYWHERE.', 'Ooh I don\'t feel so good...', 'This car smells like engine oil. I like it.', 'Turn left. No, right. No... whatever.'];
      g.ui.subtitle('Pertti', pick(lines), 4);
      audio.speak(v.pos, 0.8, 8);
      if (Math.random() < 0.25 && g.player.inVehicle === v) { v.grabSteer = rand(-0.35, 0.35); setTimeout(() => (v.grabSteer = 0), 700); g.ui.subtitle('Pertti', 'WHEEE! Let me drive!', 2); }
      if (Math.random() < 0.15) { audio.play('vomit', v.pos); g.ui.toast('Pertti threw up in the car. Lovely.'); g.player.n.stress = Math.min(100, g.player.n.stress + 15); j.pay = Math.round(j.pay * 0.7); }
    }
    if (v.pos.distanceTo(j.dest) < 18 && v.speedKmh < 5) {
      g.npcs.perttiPassenger = null;
      const p = g.npcs.pertti; p.pos.copy(v.exitWorld()); p.target = j.dest.clone();
      p.setVisible(true);
      this.finish('Pertti: "You are a true friend! Here, have some marks... and a beer."', 0);
      g.actions.spawnNear('beer', g.player.pos);
    }
  }

  finish(msg, bonus) {
    const g = this.game, j = this.active;
    this.active = null;
    g.ui.objective(null);
    if (bonus > 0) g.earn(bonus, 'Job bonus');
    if (j?.type === 'taxi') g.earn(j.pay, 'Taxi fare');
    g.ui.toast(msg, 5);
    g.stats.jobs = (g.stats.jobs || 0) + 1;
    g.achieve('job1', 'Working Class Hero', 'Completed your first job');
    if (g.stats.jobs >= 10) g.achieve('job10', 'Kova Työmies', 'Completed 10 jobs');
    if (j?.type === 'paper') for (const s of j.stops) if (s.mb) s.mb.removeFromParent();
  }
  cancel() {
    const g = this.game, j = this.active;
    if (!j) return;
    if (j.type === 'hay') for (const b of j.bales) if (!b.done && b.ent.body) g.items.remove(b.ent);
    if (j.type === 'paper') for (const s of j.stops) s.mb && s.mb.removeFromParent();
    if (j.type === 'taxi') { g.npcs.perttiPassenger = null; g.npcs.pertti.pos.copy(j.vehicle.exitWorld()); }
    this.active = null; g.ui.objective(null); g.ui.toast('Job cancelled.');
  }

  update(dt) {
    const j = this.active;
    if (!j) return;
    if (j.type === 'hay') this.updateHay(dt);
    else if (j.type === 'paper') this.updatePaper(dt);
    else if (j.type === 'delivery') this.updateDelivery(dt);
    else if (j.type === 'taxi') this.updateTaxi(dt);
  }
}
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

// ---------------------------------------------------------------- Rally
export class Rally {
  constructor(game) {
    this.game = game;
    this.road = game.terrain.roads.find((r) => r.id === 'stage');
    this.cps = [];
    const S = this.road.samples;
    for (let i = 120; i < S.length - 40; i += 120) this.cps.push(new THREE.Vector3(S[i].x, S[i].h + 1, S[i].z));
    this.finishPos = new THREE.Vector3(S[0].x, S[0].h, S[0].z);
    this.active = false; this.state = 'idle';
    this.length = this.road.length;
    // checkpoint flags
    this.flags = this.cps.map((p, i) => {
      const s = S[120 * (i + 1)];
      const g = new THREE.Group();
      for (const side of [-1, 1]) {
        const off = side * (this.road.width / 2 + 0.8);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
        pole.position.set(s.x - s.dz * off, s.h + 1.3, s.z + s.dx * off); g.add(pole);
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshStandardMaterial({ color: 0xff4020, side: THREE.DoubleSide, emissive: 0x401000 }));
        fl.position.set(pole.position.x + 0.35, s.h + 2.3, pole.position.z); g.add(fl);
      }
      game.scene.add(g); return g;
    });
  }
  fmt(t) { const m = Math.floor(t / 60), s = (t % 60).toFixed(2); return `${m}:${s.padStart(5, '0')}`; }
  rivals() {
    // stage length based times (original rival names)
    const L = this.length;
    return [['Kalle "Sora" Virta', 92], ['Mikko Ränni', 86], ['Tiina Lehto', 81], ['Hannu Peltomaa', 76], ['Esa Kivinen', 70]].map(([n, kmh]) => ({ name: n, time: L / (kmh / 3.6) * (1 + (n.length % 5) * 0.004) }));
  }
  isRaceDay() { const g = this.game; const day = Math.floor(g.time.minutes / 1440) % 7; const hr = (g.time.minutes % 1440) / 60; return day === 5 && hr >= 12 && hr < 18; }
  nextCheckpoint() { if (!this.active) return null; return this.idx < this.cps.length ? this.cps[this.idx] : this.finishPos; }

  begin(competitive) {
    const g = this.game;
    this.competitive = competitive;
    this.state = 'toStart';
    this.active = true;
    g.ui.objective(competitive ? 'Rally race' : 'Rally practice', 'Drive under the start arch and stop.');
  }
  update(dt) {
    if (!this.active) return;
    const g = this.game, v = g.player.inVehicle;
    if (this.state === 'toStart') {
      if (v && v.pos.distanceTo(this.finishPos) < 9 && v.speedKmh < 3) {
        this.state = 'countdown'; this.cd = 3.5;
        g.ui.objective(null);
      }
      return;
    }
    if (this.state === 'countdown') {
      this.cd -= dt;
      const n = Math.ceil(this.cd - 0.5);
      g.ui.raceTimer(`<div class="big">${n > 0 ? n : 'GO!'}</div>`);
      if (Math.floor(this.cd * 2) !== Math.floor((this.cd + dt) * 2)) audio.play('notify');
      if (this.cd <= 0.5) { this.state = 'run'; this.t = 0; this.idx = 0; audio.play('horn'); }
      return;
    }
    if (this.state === 'run') {
      this.t += dt;
      g.ui.raceTimer(`${this.fmt(this.t)}<small>Checkpoint ${this.idx}/${this.cps.length}</small>`);
      if (!v) { this.abort('You left the car. Run aborted.'); return; }
      const target = this.nextCheckpoint();
      if (v.pos.distanceTo(target) < 16) {
        if (this.idx < this.cps.length) { this.idx++; audio.play('notify'); }
        else this.finishRun();
      }
      if (this.t > 900) this.abort('Too slow. The marshals went home.');
    }
  }
  finishRun() {
    const g = this.game;
    this.active = false; this.state = 'idle';
    const t = this.t;
    g.ui.raceTimer(null);
    const best = g.state.bestRally;
    if (!best || t < best) g.state.bestRally = t;
    g.achieve('rally1', 'Gravel Rookie', 'Finished a rally stage');
    if (!this.competitive) { g.ui.menu({ title: 'Practice finished', text: `Your time: <b>${this.fmt(t)}</b>${best ? `<br>Best: ${this.fmt(Math.min(best, t))}` : ''}`, options: [{ label: 'OK' }] }); return; }
    const all = [...this.rivals(), { name: 'YOU', time: t, me: true }].sort((a, b) => a.time - b.time);
    const pos = all.findIndex((r) => r.me) + 1;
    const prizes = [2500, 1200, 600, 200];
    const prize = prizes[pos - 1] || 0;
    const rows = all.map((r, i) => `<div class="rrow ${r.me ? 'me' : ''}"><span>${i + 1}.</span><span>${r.name}</span><span>${this.fmt(r.time)}</span></div>`).join('');
    if (prize) g.earn(prize, `Rally prize (P${pos})`);
    if (pos === 1) { g.achieve('rallywin', 'Kurki-Sprint Champion', 'Won the Saturday rally'); g.actions.spawnNear('trophy', g.player.pos); g.sdk.happytime(); }
    g.state.rallyDone = Math.floor(g.time.minutes / 1440);
    g.ui.menu({ title: `Rally results — P${pos}`, text: `<div class="results">${rows}</div>${prize ? `Prize money: <b>${fmtMoney(prize)}</b>` : 'No prize this time.'}`, options: [{ label: 'Continue' }], wide: true });
  }
  abort(msg) {
    this.active = false; this.state = 'idle';
    this.game.ui.raceTimer(null); this.game.ui.objective(null);
    this.game.ui.toast(msg, 4);
  }
}
