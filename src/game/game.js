import * as THREE from 'three';
import { SDK } from '../core/sdk.js';
import { Input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { Physics } from '../core/physics.js';
import { createRenderer, Post, QUALITY } from '../core/renderer.js';
import { waitTextures, setMaxAnisotropy } from '../core/assets.js';
import { clamp, rand, pick, fmtMoney, fmtTime, DAYS } from '../core/util.js';
import { Terrain } from '../world/terrain.js';
import { buildRoads } from '../world/roads.js';
import { Vegetation } from '../world/vegetation.js';
import { Water } from '../world/water.js';
import { SkySystem } from '../world/sky.js';
import { buildLocations } from '../world/locations.js';
import { mailbox as mailboxProp } from '../world/props.js';
import { mats } from '../world/mats.js';
import { batchStatic } from '../core/batch.js';
import { P, MAP_SIZE, HALF, WATER_LEVEL, SITES } from '../world/layout.js';
import { Player } from './player.js';
import { Items } from './items.js';
import { Interact } from './interact.js';
import { Particles } from './particles.js';
import { UI } from './ui.js';
import { Actions } from './actions.js';
import { NPCs } from './npcs.js';
import { Traffic } from './traffic.js';
import { Jobs, Rally } from './jobs.js';
import { Radio } from './radio.js';
import { Dialog } from './dialog.js';
import { Tutorial } from './tutorial.js';
import { TouchControls } from '../core/touch.js';
import { IS_MOBILE } from '../core/device.js';
import { updateTweens, updateTimers } from '../core/tween.js';
import { BuildCar } from '../vehicles/buildcar.js';
import { Van, Tractor, Moped } from '../vehicles/fleet.js';
import { PARTS, SLOTS } from '../vehicles/parts.js';

const SAVE_KEY = 'save_v1';
const TIPS = [
  'Tip: Loose bolts make parts fall off while driving. Tighten everything with the wrench (F, then mouse wheel).',
  'Tip: Sleeping in your bed saves the game.',
  'Tip: The sauna stove needs firewood. Throw water on the stones for löyly.',
  'Tip: Empty bottles can be returned to the village shop for the deposit.',
  'Tip: Drunk driving gets you arrested. The Rautala police have nothing better to do.',
  'Tip: Watch the oil and coolant, or the engine will cook itself.',
  'Tip: Saturday is rally day at the Kurki-Sprint stage. Prizes up to 2500 mk.',
  'Tip: Press Tab for the car checklist — it lists every missing part.',
];

export class Game {
  constructor() {
    this.paused = true;
    this.started = false;
    this.modalOpen = false;
    this.uiBlocking = false;
    this.time = { minutes: 9 * 60 + 5 };
    this.state = { money: 650 };
    this.stats = {};
    this.achievements = {};
    this.interactables = [];
    this.doors = [];
    this.lightSpots = [];
    this.flags = [];
    this.floaters = [];
    this.vehicles = [];
    this.fx = { drunk: 0, fade: 1, hurt: 0, water: 0, blur: 0, sleepy: 0, heat: 0 };
    this.sdk = SDK;
    this.audio = audio;
    this.settings = { quality: 2, sensitivity: 1, fov: 72, volume: 0.8, music: 0.6, invertY: false, autoClutch: true };
    this.saveTimer = 180;
    this.mailHour = -1;
  }

  setLoad(p, text) {
    const f = document.getElementById('load-fill'); if (f) f.style.width = `${Math.round(p * 100)}%`;
    const t = document.getElementById('load-text'); if (t && text) t.textContent = text;
  }
  frame() { return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); }

  async boot() {
    const tip = document.getElementById('load-tip');
    if (tip) tip.textContent = pick(TIPS);
    this.setLoad(0.02, 'Contacting the village…');
    await SDK.init();
    SDK.loadingStart();
    this.loadSettings();
    const lowres = location.search.includes('lowres');
    this.canvas = document.getElementById('game');
    this.renderer = createRenderer(this.canvas);
    setMaxAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, window.innerWidth / window.innerHeight, 0.05, 9000);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.post = new Post(this.renderer, this.scene, this.camera);
    if (lowres) this.settings.quality = 0;
    window.addEventListener('resize', () => this.post.resize());
    this.input = new Input(this.canvas);
    this.input.onLockChange = (locked) => this.onLockChange(locked);
    this.setLoad(0.06, 'Loading physics…');
    this.physics = await Physics.create();
    await this.frame();
    this.setLoad(0.12, 'Shaping the land…');
    this.terrain = new Terrain();
    this.terrain.build();
    await this.frame();
    this.setLoad(0.3, 'Laying gravel roads…');
    this.terrain.createMesh(this.scene);
    this.terrain.createCollider(this.physics);
    const before = new Set(this.scene.children);
    buildRoads(this);
    await this.frame();
    this.setLoad(0.38, 'Lighting the sky…');
    this.sky = new SkySystem(this);
    this.water = new Water(this);
    this.setLoad(0.42, 'Planting the forest…');
    await this.frame();
    this.vegetation = new Vegetation(this);
    this.vegetation.build();
    await this.frame();
    this.setLoad(0.6, 'Building the village…');
    this.ui = new UI(this);
    this.actions = new Actions(this);
    buildLocations(this);
    const statics = this.scene.children.filter((o) => !before.has(o) && o !== this.water?.mesh);
    const bs = batchStatic(this.scene, statics);
    console.log('[batch] static meshes merged', bs.merged, '->', bs.meshes);
    await this.frame();
    this.setLoad(0.72, 'Waking up the neighbours…');
    this.particles = new Particles(this.scene);
    this.items = new Items(this);
    this.player = new Player(this);
    this.interact = new Interact(this);
    this.dialog = new Dialog(this);
    this.car = new BuildCar(this);
    this.van = new Van(this);
    this.tractor = new Tractor(this);
    this.moped = new Moped(this);
    this.vehicles = [this.car, this.van, this.tractor, this.moped];
    this.__slots = Object.keys(SLOTS);
    this.npcs = new NPCs(this);
    this.traffic = new Traffic(this);
    this.jobs = new Jobs(this);
    this.rally = new Rally(this);
    this.radio = new Radio(this);
    this.tutorial = new Tutorial(this);
    if (this.input.mobile) this.touch = new TouchControls(this);
    // inspector / mechanic interaction hitboxes are NPCs; physics callbacks
    this.physics.stepCallbacks.push((dt) => { for (const v of this.vehicles) v.physicsStep(dt); });
    this.setupLights();
    await this.frame();
    this.setLoad(0.82, 'Unpacking the garage…');
    const loaded = this.loadGame(true);
    if (loaded && !this.state.tut) this.tutorial.fastForward();
    if (this.state.tvOn) this.actions.setTV(true);
    if (!this.state.fridge) this.state.fridge = {};
    if (!loaded) this.newWorld();
    this.applySettings();
    this.setLoad(0.9, 'Loading textures…');
    await waitTextures((d, n) => this.setLoad(0.9 + 0.1 * (n ? d / n : 1)));
    this.setLoad(0.99, 'Warming up the shaders…');
    await this.precompile();
    // warm-up frame
    this.vegetation.updateLOD(this.camera.position, true);
    this.vegetation.updateColliders(this.player.pos);
    for (let i = 0; i < 30; i++) this.physics.world.step();
    this.setLoad(1, 'Ready');
    SDK.loadingStop();
    document.getElementById('loading').classList.add('hide');
    this.started = true;
    this.paused = true;
    this.player.updateCamera(0);
    this.sky.update(0.016, this.time.minutes % 1440, 0, this.player.pos);
    this.vegetation.updateLOD(this.camera.position, true);
    this.ui.update(0);
    this.ui.clickToPlay(!loaded);
    this.fx.fade = 0;
    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this.tick());
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.ui.modal) { this.ui.modal(); this.ui.modal = null; } });
    document.addEventListener('visibilitychange', () => { if (document.hidden && !this.paused) this.pause(); });
    SDK.on('adStart', () => { audio.suspend(); });
    SDK.on('adEnd', () => { audio.resume(); });
    SDK.on('settings', (s) => audio.setMuted(!!s.muteAudio));
    audio.setMuted(SDK.muteAudio);
  }

  // ---------------------------------------------------------------- pause & focus
  resume() {
    audio.init();
    audio.setMuted(SDK.muteAudio);
    audio.resume();
    this.ui.hideOverlay();
    this.input.lock();
    this.paused = false;
    this.modalOpen = false; this.uiBlocking = false;
    SDK.gameplayStart();
    this.last = performance.now();
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    SDK.gameplayStop();
    this.ui.pauseMenu();
  }
  onLockChange(locked) {
    if (!locked && !this.modalOpen && this.started && !this.paused) this.pause();
  }
  openModal() {
    this.modalOpen = true; this.uiBlocking = true;
    this.input.unlock();
  }
  closeModal() {
    this.modalOpen = false; this.uiBlocking = false;
    this.ui.modal = null;
    if (!this.player.dead) {
      this.input.lock(); this.paused = false;
      // browsers may refuse pointer lock right after Esc; fall back to the click-to-continue pause screen
      setTimeout(() => { if (!this.input.locked && !this.paused && !this.modalOpen && !this.player.dead) this.pause(); }, 700);
    }
    this.last = performance.now();
  }

  // ---------------------------------------------------------------- money & progress
  earn(amount, why = '') {
    this.state.money += amount;
    this.stats.earned = (this.stats.earned || 0) + amount;
    audio.play('cash');
    this.ui.toast(`+${fmtMoney(amount)}${why ? ' — ' + why : ''}`, 3);
    if (this.stats.earned >= 5000) this.achieve('rich', 'Markka Millionaire (almost)', 'Earned 5000 mk in total');
  }
  spend(amount) { this.state.money = Math.max(0, this.state.money - amount); }
  achieve(id, title, desc) {
    if (this.achievements[id]) return;
    this.achievements[id] = { title, desc, t: this.time.minutes };
    this.ui.achievement(title, desc);
    audio.play('achievement');
  }
  advanceTime(mins, sleeping = false) {
    const before = this.time.minutes;
    this.time.minutes += mins;
    this.actions.updateCharger(mins);
    // daily events crossing midnight/mail hour
    const d0 = Math.floor(before / 1440), d1 = Math.floor(this.time.minutes / 1440);
    for (let d = d0; d < d1; d++) this.newDay();
    this.actions.checkDelivery();
    if (!sleeping) {
      const n = this.player.n;
      n.hunger = Math.min(100, n.hunger + mins * 0.1); n.thirst = Math.min(100, n.thirst + mins * 0.14);
    }
  }
  newDay() {
    this.actions.deliverMail();
    this.state.firewood = Math.min(60, (this.state.firewood ?? 30) + 0);
    if ((this.state.bills || 0) >= 3 && !this.state.powerCut) { this.state.powerCut = true; this.ui.toast('⚡ Your electricity was cut off — unpaid bills!', 5); }
    if ((this.state.bills || 0) < 3) this.state.powerCut = false;
  }

  // ---------------------------------------------------------------- lights pooling
  setupLights() {
    this.pointPool = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffd0a0, 0, 10, 2); this.scene.add(l); this.pointPool.push(l); }
    this.spots = this.spots || {};
    this.headlights = [];
    for (let i = 0; i < 2; i++) {
      const s = new THREE.SpotLight(0xfff0d8, 0, 60, 0.5, 0.45, 1.3);
      this.scene.add(s); this.scene.add(s.target); this.headlights.push(s);
    }
    this.lightTimer = 0;
  }
  updateLights(dt) {
    this.lightTimer -= dt;
    if (this.lightTimer <= 0) {
      this.lightTimer = 0.3;
      const cam = this.camera.position;
      const on = this.lightSpots.filter((l) => l.pos.distanceToSquared(cam) < 45 * 45 && l.on(this) && !(this.state.powerCut && l.pos.distanceTo(this.spots.spawn) < 30)).sort((a, b) => a.pos.distanceToSquared(cam) - b.pos.distanceToSquared(cam));
      this.pointPool.forEach((pl, i) => {
        const l = on[i];
        if (l) { pl.position.copy(l.pos); pl.color.setHex(l.color); pl.intensity = l.intensity; pl.distance = l.range; }
        else pl.intensity = 0;
      });
    }
    // headlights follow the vehicle the player is in (or the build car)
    const v = this.player.inVehicle;
    const active = v && v.headlightsActive;
    this.headlights.forEach((s, i) => {
      if (!active) { s.intensity = 0; return; }
      const side = i === 0 ? 1 : -1;
      const front = v === this.car ? 2.0 : v.kind === 'van' ? 2.4 : v.kind === 'tractor' ? 1.5 : 0.8;
      const y = v === this.car ? 0.62 : v.kind === 'van' ? 1.0 : v.kind === 'tractor' ? 1.35 : 1.0;
      s.position.copy(v.toWorld(new THREE.Vector3(side * (v.kind === 'moped' ? 0 : 0.56), y, front)));
      s.target.position.copy(v.toWorld(new THREE.Vector3(side * 0.6, y - 1.2, front + 22)));
      s.intensity = (v === this.car && v.rallyLightsActive ? 110 : 60) * (v.kind === 'moped' && i === 1 ? 0 : 1);
      s.angle = v === this.car && v.rallyLightsActive ? 0.62 : 0.5;
    });
  }

  // ---------------------------------------------------------------- new world
  newWorld() {
    const g = this;
    this.state = { money: 650, firewood: 30, mail: [], bills: 0 };
    this.stats = {}; this.achievements = {};
    this.time.minutes = 9 * 60 + 5;
    const car = this.car;
    car.placeOnStands(this.spots.carStands, 0);
    // body panels attached
    for (const t of ['doorL', 'doorR', 'fenderL', 'fenderR', 'hood', 'trunk']) { const inst = car.createPart('panel:' + t); car.attach(inst, t, { silent: true, tight: car.maxTight(inst) }); }
    // engine block on the stand
    const block = car.createPart('block', { data: { oil: 0 } });
    car.standRoot.position.copy(this.spots.engineStand).add(new THREE.Vector3(0, -0.22, 0));
    car.standRoot.add(block.mesh); block.mesh.position.set(...SLOTS.stand.pos); block.slot = 'stand'; car.slots.stand = block; block.tight = car.maxTight(block);
    // loose parts in the garage
    const list = [
      'crank', 'piston', 'piston', 'piston', 'piston', 'gasket', 'head', 'cam', 'camgear', 'chain', 'tcover', 'rockers', 'rcover', 'oilpan', 'dipstick',
      'wpump', 'wpulley', 'cpulley', 'fan', 'alt', 'flywheel', 'clutchdisc', 'clutchplate', 'gearbox', 'starter', 'dist', 'plug', 'plug', 'plug', 'plug', 'wires',
      'intake', 'carb', 'airfilter', 'header', 'fpump', 'radiator', 'hoseU', 'hoseL', 'battery', 'wiring', 'fuses', 'coil', 'brakemaster', 'rack', 'column', 'swheel',
      'dash', 'gauges', 'strut', 'strut', 'disc', 'disc', 'caliper', 'caliper', 'axle', 'shock', 'shock', 'coilspring', 'coilspring', 'drum', 'drum',
      'wheel', 'wheel', 'wheel', 'wheel', 'driveshaft', 'pipe', 'muffler', 'tank', 'fuelline', 'seat', 'seat', 'rearseat', 'bumperF', 'bumperR', 'grille',
      'headlight', 'headlight', 'taillight', 'taillight', 'mirror', 'mirror',
    ];
    const insts = list.map((id) => {
      let cond = rand(0.72, 1);
      const data = {};
      if (id === 'plug') cond = rand(0.05, 0.14);
      if (id === 'battery') data.charge = 0.06;
      if (id === 'tank') data.fuel = 0;
      if (id === 'radiator') data.coolant = 0;
      if (id === 'brakemaster') data.fluid = 0;
      if (id === 'muffler') cond = 0.45;
      return car.createPart(id, { cond, data });
    });
    this.layoutGarageParts(insts);
    // supplies
    const gp = this.spots.partsArea;
    this.items.spawn('oilCan', gp.bench.clone().add(new THREE.Vector3(-0.8, 0.25, 0)));
    this.items.spawn('coolant', gp.bench.clone().add(new THREE.Vector3(-0.5, 0.25, 0)));
    const jc = this.items.spawn('fuelCan', gp.floor.clone().add(new THREE.Vector3(1.5, 0.4, 1.5))); jc.data.amount = 8;
    // house supplies (on the kitchen table)
    const t = this.spots.fridgeDrop.clone().add(new THREE.Vector3(1.9, -0.05, 0.6));
    const bc = this.items.spawn('beerCase', t.clone().add(new THREE.Vector3(0.0, 0.2, 0))); bc.count = 6;
    this.state.fridge = { sausage: 2, beer: 2, milk: 1, soda: 1 };
    this.items.spawn('bread', t.clone().add(new THREE.Vector3(0.35, 0.15, 0.1)));
    this.items.spawn('milk', t.clone().add(new THREE.Vector3(0.35, 0.25, -0.2)));
    this.items.spawn('axe', this.spots.choppingBlock.clone().add(new THREE.Vector3(0.7, 0.4, 0.2)));
    // vehicles
    const vanP = new THREE.Vector3(P.home.x + 14, 0, P.home.z + 14); vanP.y = this.terrain.getHeight(vanP.x, vanP.z) + 0.6;
    this.van.createBody(vanP, Math.PI * 0.9);
    const mp = new THREE.Vector3(P.garage.x - 5.5, 0, P.garage.z + 7); mp.y = this.terrain.getHeight(mp.x, mp.z) + 0.3;
    this.moped.createBody(mp, Math.PI);
    const tp = this.spots.tractorShed.clone(); tp.y += 1.0;
    this.tractor.createBody(tp, this.spots.tractorShedRy);
    // player
    this.player.teleport(this.spots.garage.clone().add(new THREE.Vector3(-1.0, 0.1, 6.8)), 0);
    this.garageDoor.toggle();
    this.sky.setWeatherNow({ clouds: 0.3, rain: 0, wind: 0.3, storm: 0 });
    this.state.mail = [{ kind: 'gift', uncle: true, title: 'Letter from your uncle', text: 'Hi kid! The Ruska is in the garage. All the parts are there, mostly. Spark plugs are shot and you\'ll need a fan belt and an oil filter from Rautala. Battery needs charging. Keys are in the ignition. Don\'t burn the house down. — Uncle Veikko<br><br>P.S. here is some money for parts.', amount: 300 }];
  }

  layoutGarageParts(insts) {
    const G = this.spots.garage; // garage centre at floor
    const floorY = G.y + 0.06;
    const toW = (x, y, z) => new THREE.Vector3(G.x + x, floorY + y, G.z + z);
    const small = [], big = [];
    for (const inst of insts) { const h = inst.def.half; (inst.def.mass <= 5 && Math.max(...h) < 0.3 ? small : big).push(inst); }
    // shelves: [xCentre, zStart, zEnd]
    const shelves = [[-3.6, -3.45, -1.15], [3.6, -0.95, 1.35], [3.6, 2.55, 4.05]];
    const levels = [0.16, 0.76, 1.36];
    let si = 0, li = 0, z = shelves[0][1];
    for (const inst of small) {
      const h = inst.def.half;
      const w = Math.max(h[0], h[2]) * 2 + 0.06;
      if (z + w > shelves[si][2]) { li++; z = shelves[si][1]; if (li >= levels.length) { li = 0; si++; if (si >= shelves.length) si = 0; } }
      const pos = toW(shelves[si][0], levels[li] + h[1] + 0.05, z + w / 2);
      this.car.spawnLoose(inst, pos);
      inst.ent.body.setRotation({ x: 0, y: 0.7071, z: 0, w: 0.7071 }, true);
      z += w;
    }
    // floor regions (local coords)
    const regions = [[-3.4, -0.6, -1.3, 2.2], [1.7, 3.1, -3.9, -1.5], [-1.4, 1.6, 3.0, 4.5], [1.8, 3.1, 1.9, 4.4], [-3.4, -1.5, -4.6, -2.6]];
    let ri = 0, cx = regions[0][0], cz = regions[0][2], rowD = 0;
    for (const inst of big) {
      const h = inst.def.half;
      // orient long axis along x
      const sx = Math.max(h[0], h[2]) * 2 + 0.08, sz = Math.min(h[0], h[2]) * 2 + 0.08;
      if (cx + sx > regions[ri][1]) { cx = regions[ri][0]; cz += rowD; rowD = 0; }
      if (cz + sz > regions[ri][3]) { ri = (ri + 1) % regions.length; cx = regions[ri][0]; cz = regions[ri][2]; rowD = 0; }
      const lying = inst.def.type === 'wheel';
      const hy = lying ? h[0] : h[1];
      const pos = toW(cx + sx / 2, hy + 0.06, cz + sz / 2);
      this.car.spawnLoose(inst, pos);
      if (h[2] > h[0]) inst.ent.body.setRotation({ x: 0, y: 0.7071, z: 0, w: 0.7071 }, true);
      if (lying) inst.ent.body.setRotation({ x: 0, y: 0, z: 0.7071, w: 0.7071 }, true);
      cx += sx; rowD = Math.max(rowD, sz);
    }
  }

  makeMailbox(pos) {
    const mb = mailboxProp('');
    mb.position.set(pos.x, pos.y - 1.2, pos.z);
    this.scene.add(mb);
    return mb;
  }

  // ---------------------------------------------------------------- settings
  loadSettings() {
    try { const s = JSON.parse(SDK.getItem('settings') || 'null'); if (s) Object.assign(this.settings, s); } catch (e) {}
    if (this.settings.quality === undefined) this.settings.quality = IS_MOBILE ? 0 : 2;
  }
  applySettings() {
    const s = this.settings;
    SDK.setItem('settings', JSON.stringify(s));
    const q = QUALITY[s.quality];
    this.quality = q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.sky.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    if (this.sky.sun.shadow.map) { this.sky.sun.shadow.map.dispose(); this.sky.sun.shadow.map = null; }
    this.post.build(q);
    this.vegetation.setQuality(q.veg);
    this.camera.fov = s.fov; this.camera.updateProjectionMatrix();
    this.input.sensitivity = s.sensitivity; this.input.invertY = s.invertY;
    audio.setVolume('master', s.volume); audio.setVolume('music', s.music);
    for (const v of this.vehicles) v.autoClutch = s.autoClutch;
    this.fogMul = s.quality === 0 ? 1.6 : 1;
  }

  // ---------------------------------------------------------------- save / load
  saveGame() {
    try {
      const items = this.items.list.filter((e) => !e.part && e.body && e.defId && !['hayBale', 'deliveryBox'].includes(e.defId)).map((e) => {
        const t = e.body.translation(), r = e.body.rotation();
        return { id: e.defId, p: [t.x, t.y, t.z], r: [r.x, r.y, r.z, r.w], d: e.data, c: e.count };
      });
      const veh = (v) => { const t = v.body.translation(), r = v.body.rotation(); return { p: [t.x, t.y, t.z], r: [r.x, r.y, r.z, r.w], fuel: v.fuel, locked: v.locked }; };
      const data = {
        v: 1, time: this.time.minutes, state: this.state, stats: this.stats, ach: this.achievements,
        player: { p: this.player.inVehicle ? this.player.inVehicle.exitWorld().toArray() : [this.player.pos.x, this.player.feetY(), this.player.pos.z], yaw: this.player.yaw, n: this.player.n },
        car: this.car.save(), van: veh(this.van), tractor: veh(this.tractor), moped: veh(this.moped), items,
        sauna: { wood: this.sauna.wood, temp: this.sauna.temp }, weather: this.sky.weather,
        garageDoor: this.garageDoor.open,
      };
      SDK.setItem(SAVE_KEY, JSON.stringify(data));
      this.saveTimer = 180;
    } catch (e) { console.warn('save failed', e); }
  }

  loadGame(initial = false) {
    let data = null;
    try { data = JSON.parse(SDK.getItem(SAVE_KEY) || 'null'); } catch (e) { data = null; }
    if (!data) return false;
    if (!initial) { location.reload(); return true; }
    try {
      this.time.minutes = data.time;
      this.state = { money: 0, ...data.state };
      this.stats = data.stats || {}; this.achievements = data.ach || {};
      const car = this.car;
      car.tuning = data.car.tuning || car.tuning;
      car.registered = data.car.registered; car.plates = data.car.plates; car.odometer = data.car.odometer || 0; car.engineTemp = data.car.engineTemp || 20;
      const cp = new THREE.Vector3(...data.car.pos);
      if (data.car.onStands) car.placeOnStands(this.spots.carStands, 0);
      else { car.createBody(cp, 0); car.onStands = false; const r = data.car.rot; car.body.setRotation({ x: r[0], y: r[1], z: r[2], w: r[3] }, true); }
      car.setPaint(data.car.paint ?? car.paint);
      car.standRoot.position.copy(this.spots.engineStand).add(new THREE.Vector3(0, -0.22, 0));
      // parts: create all, then attach in dependency order
      const pending = [];
      for (const e of data.car.parts) {
        const inst = car.createPart(e.defId, { cond: e.cond, data: e.data, uid: e.uid });
        if (!inst) continue;
        inst.tight = e.tight;
        if (e.slot) pending.push([inst, e.slot, e.tight]);
        else { const pos = e.pos ? new THREE.Vector3(...e.pos) : this.spots.partsArea.floor.clone().add(new THREE.Vector3(0, 1, 0)); car.spawnLoose(inst, pos, e.rot ? new THREE.Quaternion(...e.rot) : null); }
      }
      // block first
      const blockE = pending.find(([i, s]) => s === 'engine' || s === 'stand');
      if (blockE) {
        const [inst, slot, tight] = blockE;
        const parent = slot === 'engine' ? car.root : car.standRoot;
        parent.add(inst.mesh); inst.mesh.position.set(...SLOTS[slot].pos); inst.slot = slot; inst.tight = tight; car.slots[slot] = inst;
        pending.splice(pending.indexOf(blockE), 1);
      }
      for (let pass = 0; pass < 12 && pending.length; pass++) {
        for (let i = pending.length - 1; i >= 0; i--) {
          const [inst, slot, tight] = pending[i];
          const s = SLOTS[slot];
          const parentOk = s.parent === 'root' || s.parent === 'stand' || car.parentInst(slot);
          const reqOk = !s.req || s.req.every((r) => car.slots[r]);
          if (parentOk && reqOk) { car.attach(inst, slot, { silent: true, tight }); pending.splice(i, 1); }
        }
      }
      for (const [inst] of pending) car.spawnLoose(inst, this.spots.partsArea.floor.clone().add(new THREE.Vector3(0, 1, 0)));
      car.dirty = true;
      const lv = (v, d) => { const p = new THREE.Vector3(...d.p); v.createBody(p, 0); v.body.setRotation({ x: d.r[0], y: d.r[1], z: d.r[2], w: d.r[3] }, true); v.fuel = d.fuel; v.locked = !!d.locked; };
      lv(this.van, data.van); lv(this.tractor, data.tractor); lv(this.moped, data.moped);
      car.locked = !!this.state.impounded;
      for (const it of data.items || []) {
        const e = this.items.spawn(it.id, new THREE.Vector3(...it.p), { rot: { x: it.r[0], y: it.r[1], z: it.r[2], w: it.r[3] }, data: it.d });
        if (e && it.c !== undefined) e.count = it.c;
      }
      Object.assign(this.player.n, data.player.n);
      this.player.teleport(new THREE.Vector3(...data.player.p), data.player.yaw);
      if (data.sauna) { this.sauna.wood = data.sauna.wood || 0; this.sauna.temp = data.sauna.temp || 20; }
      if (data.weather) this.sky.setWeatherNow(data.weather);
      if (data.garageDoor) this.garageDoor.toggle();
      if (this.state.logOnBlock) this.actions.blockLog(true);
      return true;
    } catch (e) {
      console.error('load failed, starting fresh', e);
      return false;
    }
  }
  newGame() {
    SDK.removeItem(SAVE_KEY);
    location.reload();
  }
  get sauna() { return this.actions.sauna; }

  // ---------------------------------------------------------------- map image
  renderMapImage() {
    const S = 760, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d');
    const img = x.createImageData(S, S);
    const T = this.terrain;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const wx = (i + 0.5) / S * MAP_SIZE - HALF, wz = (j + 0.5) / S * MAP_SIZE - HALF;
      const h = T.getHeight(wx, wz);
      const sp = T.splatAt(wx, wz);
      let r, g2, b;
      if (h < WATER_LEVEL) { const d = Math.min(1, (WATER_LEVEL - h) / 8); r = 60 - d * 30; g2 = 110 - d * 40; b = 150 - d * 30; }
      else {
        r = 90 * sp[0] + 40 * sp[1] + 130 * sp[2] + 120 * sp[3]; g2 = 130 * sp[0] + 70 * sp[1] + 110 * sp[2] + 115 * sp[3]; b = 60 * sp[0] + 35 * sp[1] + 80 * sp[2] + 110 * sp[3];
        const shade = 0.75 + (h - 10) / 80; r *= shade; g2 *= shade; b *= shade;
      }
      const o = (j * S + i) * 4; img.data[o] = r; img.data[o + 1] = g2; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    for (const road of T.roads) {
      x.strokeStyle = road.type === 'asphalt' ? '#3a3a3a' : road.type === 'stage' ? '#b06030' : '#c8b890';
      x.lineWidth = road.type === 'asphalt' ? 3.5 : 2.2;
      x.beginPath();
      road.samples.forEach((s, k) => { const px = (s.x + HALF) / MAP_SIZE * S, py = (s.z + HALF) / MAP_SIZE * S; k ? x.lineTo(px, py) : x.moveTo(px, py); });
      if (road.closed) x.closePath();
      x.stroke();
    }
    return c;
  }

  // ---------------------------------------------------------------- checklist
  checklistHTML() {
    const car = this.car;
    const groups = {};
    for (const [sid, s] of Object.entries(SLOTS)) {
      if (['stand'].includes(sid)) continue;
      const inst = car.slots[sid];
      const optional = ['plateF', 'plateR', 'spoiler', 'rallylights', 'cage', 'mudflaps', 'radio'].includes(sid);
      const cat = sid === 'engine' ? 'Engine' : (s.parent === 'root' ? (PARTS[s.accepts[0]]?.cat || car.defOf('panel:' + s.accepts[0])?.cat || 'Body') : 'Engine');
      const name = inst ? inst.def.name : (s.name || PARTS[s.accepts[0]]?.name || sid);
      let st = '<span class="miss">missing</span>';
      if (inst) { const f = car.tightFrac(inst); st = f >= 0.999 ? '<span class="ok">✓</span>' : `<span class="loose">bolts ${Math.round(f * 100)}%</span>`; if (inst.cond < 0.5) st += ' <span class="miss">worn</span>'; }
      if (sid === 'engine' && !inst && car.slots.stand) st = '<span class="loose">on the stand</span>';
      if (optional && !inst) st = '<span class="opt">optional</span>';
      (groups[cat] ||= []).push(`<div class="cl ${inst ? 'have' : ''}"><span>${name}</span>${st}</div>`);
    }
    const comp = car.completion();
    const probs = car.startProblems();
    const n = this.player.n;
    return `<div class="sheet-in"><div class="mt">Ruska 1300 — build sheet <small>${Math.round(comp.pct * 100)}% complete · ${comp.have}/${comp.total} parts · ${comp.bolted} fully bolted</small></div>
      <div class="fluids"><span>🛢 Oil ${car.oil.toFixed(1)}/3.5 L</span><span>💧 Coolant ${car.coolant.toFixed(1)}/5 L</span><span>🛑 Brake fluid ${(car.brakeFluid * 1000).toFixed(0)} ml</span><span>⛽ Fuel ${car.fuel.toFixed(1)}/36 L</span><span>🔋 Battery ${Math.round(car.batteryLevel() * 100)}%</span><span>${car.registered ? '✅ Registered ' + car.plates : '❌ Not registered'}</span></div>
      <div class="probs">${probs.length ? '<b>Why it won\'t start:</b> ' + probs.slice(0, 6).join(', ') + (probs.length > 6 ? '…' : '') : '<b class="ok">Engine should start!</b> Hold I to crank (pull the choke with K when cold).'}</div>
      <div class="cols">${Object.entries(groups).map(([k, v]) => `<div class="grp"><div class="gt">${k}</div>${v.join('')}</div>`).join('')}</div>
      <div class="needsx">${['health', 'hunger', 'thirst', 'fatigue', 'stress', 'bladder', 'dirt'].map((k) => `<span>${k}: ${Math.round(n[k])}</span>`).join(' · ')} · drunk: ${(n.drunk * 1.6).toFixed(2)}‰</div>
      <div class="hint">Tab to close · Need parts? Rautalan Varaosa in Rautala, or order by phone at home.</div></div>`;
  }

  // ---------------------------------------------------------------- main loop
  // One bad frame must never freeze the game: errors are caught, reported once, and the frame still
  // renders and clears input. Repeated errors from the same place are counted, not re-logged.
  tick() {
    try { this.frameTick(); } catch (err) {
      this.errors = this.errors || new Map();
      const key = String(err && err.message).slice(0, 120);
      const n = (this.errors.get(key) || 0) + 1; this.errors.set(key, n);
      if (n === 1) { console.error('[game] frame error (recovered):', err); }
      try { this.renderFrame(0.016); } catch (e2) {}
      try { this.input.endFrame(); } catch (e3) {}
    }
  }
  frameTick() {
    const now = performance.now();
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.started) return;
    const inp = this.input;
    this.touch?.update();
    if (this.paused || this.modalOpen) {
      // still render (frozen) so menus show the world behind; doors and lids keep animating
      if (this.modalOpen) updateTweens(dt);
      this.renderFrame(0.0001);
      inp.endFrame();
      return;
    }
    const g = this, P = this.player;
    // ---- global keys
    if (inp.hit('Tab')) { this.sheetOpen = this.ui.toggleSheet(this.sheetOpen ? null : this.checklistHTML()); if (this.sheetOpen) this.tutSheetSeen = true; }
    if (this.sheetOpen && Math.random() < 0.05) this.ui.sheetEl.innerHTML = this.checklistHTML();
    if (inp.hit('KeyM')) this.ui.toggleMap();
    if (inp.hit('KeyH') && !P.inVehicle) this.ui.hintsShown = !this.ui.hintsShown;
    if (inp.hit('KeyT')) this.ui.toast(`⌚ ${fmtTime(this.time.minutes % 1440)} — ${DAYS[Math.floor(this.time.minutes / 1440) % 7]}`, 2);
    if (inp.hit('KeyP') && !P.inVehicle) P.startPee();
    if (inp.up('KeyP') && P.peeing) P.stopPee();
    // ---- time
    const gameDt = dt * 0.8; // 1 real second = 0.8 game minutes (one day = 30 real minutes)
    this.time.minutes += gameDt;
    this.actions.updateCharger(gameDt);
    const hr = (this.time.minutes % 1440) / 60;
    const dayIdx = Math.floor(this.time.minutes / 1440);
    if (this._lastDay !== undefined && dayIdx !== this._lastDay) this.newDay();
    this._lastDay = dayIdx;
    if (Math.floor(this.time.minutes) % 30 === 0) this.actions.checkDelivery();
    if (this.state.pizzaAt && this.time.minutes > this.state.pizzaAt) { this.state.pizzaAt = 0; this.items.spawn('pizzaHot', this.spots.homeDoor.clone().add(new THREE.Vector3(0.5, 0.4, 0))); this.ui.toast('🍕 Ding dong! Pizza delivered to your porch.'); }
    // ---- player / vehicle control
    const v = P.inVehicle;
    if (v) {
      if (!P.dead) v.drive(dt, inp);
      if (inp.hit('KeyE')) this.actions.exitVehicle();
      if (inp.hit('KeyR') && v.kind !== 'tractor') { const hasRadio = v.isBuildCar ? !!v.slots.radio : v.kind !== 'moped'; if (hasRadio) this.radio.setPlaying(!(this.radio.on && this.radio.source === 'car'), 'car'); else this.ui.toast('No radio in this vehicle.'); }
      if (inp.hit('KeyN') && this.radio.on) this.radio.nextStation();
      P.updateNeeds(dt, gameDt);
    } else {
      P.update(dt, gameDt);
    }
    this.interact.update(dt);
    this.dialog.update();
    // ---- physics
    this.physics.update(dt);
    // ---- systems
    this.items.update(dt);
    for (const veh of this.vehicles) veh.update(dt);
    this.npcs.update(dt);
    this.traffic.update(dt);
    this.jobs.update(dt);
    this.rally.update(dt);
    this.actions.updateSauna(dt, gameDt);
    updateTweens(dt); updateTimers(dt);
    this.actions.updateHome(dt);
    this.actions.updateFishing(dt);
    this.radio.update(dt);
    // doors animation
    for (const d of this.doors) {
      d.angle += (d.target - d.angle) * Math.min(1, dt * 6);
      if (d.axis === 'x') d.pivot.rotation.x = d.angle; else d.pivot.rotation.y = d.angle;
    }
    for (const f of this.flags) { const p = f.geometry.attributes.position; if (!f.userData.base) f.userData.base = p.array.slice(); const b = f.userData.base; const t = now / 1000; for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(t * 4 + x * 3) * 0.12 * (x + 0.9) * (0.5 + this.sky.weather.wind)); } p.needsUpdate = true; }
    for (const fl of this.floaters) { fl.ph += dt; fl.obj.position.y = fl.base + Math.sin(fl.ph * 1.3) * 0.04; fl.obj.rotation.z = Math.sin(fl.ph) * 0.03; }
    if (this.homeClock) { const m = this.time.minutes % 720; this.homeClock.userData.hands.hh.rotation.z = -m / 720 * Math.PI * 2; this.homeClock.userData.hands.mh.rotation.z = -(m % 60) / 60 * Math.PI * 2; }
    // camera
    const mouse = v ? inp.consumeMouse() : null;
    if (v) v.updateCamera(dt, this.camera, P.dead ? { x: 0, y: 0 } : mouse);
    // world systems
    const focus = v ? v.pos : P.pos;
    this.sky.update(dt, this.time.minutes % 1440, gameDt, focus);
    this.water.update(dt, this.sky);
    this.vegetation.update(dt, this.camera.position, focus);
    this.particles.update(dt, this);
    this.updateLights(dt);
    // materials: lit windows at night
    const M = this.sky.daylight;
    mats().windowLit.emissiveIntensity = Math.max(0, (1 - M) * 1.4);
    // ambience & audio
    const cam = this.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    audio.setListener(cam.position, fwd, up);
    const indoor = this.isIndoors(cam.position);
    const lakeNear = this.terrain.getHeight(cam.position.x + 15, cam.position.z) < WATER_LEVEL || this.terrain.getHeight(cam.position.x - 15, cam.position.z) < WATER_LEVEL || this.terrain.getHeight(cam.position.x, cam.position.z + 15) < WATER_LEVEL || this.terrain.getHeight(cam.position.x, cam.position.z - 15) < WATER_LEVEL;
    audio.updateAmbience(dt, { daylight: M, wind: this.sky.weather.wind, rain: this.sky.weather.rain, water: lakeNear ? 1 : 0, indoor: indoor ? 1 : 0, forest: 0.6, inCar: !!v && v.kind !== 'moped' && v.kind !== 'tractor' });
    audio.setMuffle(P.underwater ? 1 : (v && v.kind === 'car' && v.camMode === 0) ? 0.25 : indoor ? 0.15 : 0);
    // mosquitoes at dusk near the lake
    const mozzie = lakeNear && M < 0.85 && M > 0.1 && !v && !indoor;
    if (mozzie) { if (!this.mozzSnd) this.mozzSnd = audio.loop('mosquito', null); this.mozzSnd?.set(0.6 + Math.sin(now / 900) * 0.4); this.mozzT = (this.mozzT || 0) + dt; if (this.mozzT > 12) { this.mozzT = 0; P.n.stress = Math.min(100, P.n.stress + 2); if (Math.random() < 0.3) this.ui.toast('Bzzzz... mosquitoes! *slap*'); audio.play('slap'); } }
    else if (this.mozzSnd) { this.mozzSnd.stop(); this.mozzSnd = null; }
    // fx
    const n = P.n;
    this.fx.drunk = Math.max(0, n.drunk - 0.15) * 1.3;
    this.fx.hurt = Math.max(0, this.fx.hurt - dt * 0.8);
    this.fx.water = P.underwater ? 1 : 0;
    this.fx.sleepy = clamp((n.fatigue - 80) / 20, 0, 1) * (0.5 + 0.5 * Math.sin(now / 1500));
    this.fx.blur = Math.max(this.fx.drunk * 0.5, (this.fx.heat || 0) > 0.6 ? (this.fx.heat - 0.6) * 2 : 0);
    this.fx.fade = Math.max(0, this.fx.fade - dt * 1.2);
    if (n.health < 30) this.fx.hurt = Math.max(this.fx.hurt, 0.25 + 0.1 * Math.sin(now / 300));
    // adaptive quality: drop a level if the frame rate stays low (never automatically down to Low:
    // that switches the render path and recompiles every shader, which would itself cause a freeze)
    if (!this.settings.manualQuality) {
      this.perf = this.perf || { t: 0, frames: 0, cool: 6 };
      const pf = this.perf; pf.t += dt; pf.frames++; pf.cool -= dt;
      if (pf.t > 5) {
        const fps = pf.frames / pf.t;
        if (pf.cool <= 0 && fps < 26 && this.settings.quality > 1) {
          this.settings.quality--; this.applySettings(); pf.cool = 8;
          this.ui.toast(`Graphics lowered to ${QUALITY[this.settings.quality].name} for smoother play (change in Settings).`, 4);
        }
        pf.t = 0; pf.frames = 0;
      }
    }
    // autosave
    this.saveTimer -= dt;
    if (this.saveTimer <= 0 && !v && !P.dead) this.saveGame();
    this.tutorial.update(dt);
    this.ui.update(dt);
    this.renderFrame(dt);
    inp.endFrame();
  }

  isIndoors(p) {
    for (const k of ['homeIndoor', 'garageIndoor', 'shopIndoor', 'pubIndoor', 'partsIndoor', 'saunaRoom', 'inspectionIndoor']) {
      const r = this.spots[k]; if (!r) continue;
      const lp = p.clone().sub(r.center).applyAxisAngle(new THREE.Vector3(0, 1, 0), -r.ry);
      if (Math.abs(lp.x) < r.half.x && Math.abs(lp.y) < r.half.y + 0.5 && Math.abs(lp.z) < r.half.z) return true;
    }
    return false;
  }

  renderFrame(dt) {
    this.post.render(dt, this.fx);
    if (this.post.direct) this.fxOverlay(); else if (this.fxEl && this.fxEl._on) { this.fxEl.style.opacity = 0; this.fxEl._on = false; }
  }
  // Low quality: fade, injury, underwater and sleepiness as a DOM layer over the canvas
  fxOverlay() {
    if (!this.fxEl) {
      const e = document.createElement('div');
      e.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;';
      document.body.appendChild(e); this.fxEl = e;
    }
    const f = this.fx, q = (v) => Math.round(Math.min(1, Math.max(0, v)) * 40) / 40;
    const fade = q(f.fade), hurt = q(f.hurt), water = q(f.water ? 1 : 0), sleepy = q(f.sleepy + f.drunk * 0.25);
    const key = `${fade}|${hurt}|${water}|${sleepy}`;
    if (key === this.fxKey) return;
    this.fxKey = key;
    const layers = [];
    if (fade > 0) layers.push(`linear-gradient(rgba(0,0,0,${fade}),rgba(0,0,0,${fade}))`);
    if (hurt > 0) layers.push(`radial-gradient(ellipse at center, rgba(150,0,0,0) 35%, rgba(150,0,0,${0.55 * hurt}) 100%)`);
    if (sleepy > 0) layers.push(`radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,${0.85 * sleepy}) 100%)`);
    if (water > 0) layers.push('linear-gradient(rgba(10,50,45,0.55),rgba(10,50,45,0.55))');
    this.fxEl.style.background = layers.join(',') || 'none';
    this.fxEl.style.opacity = layers.length ? 1 : 0; this.fxEl._on = layers.length > 0;
  }
  // compile every material's shader during loading so nothing stalls the first time it is seen
  async precompile() {
    const r = this.renderer;
    try {
      if (!this.post.direct) r.setRenderTarget(this.post.composer.readBuffer);
      if (r.compileAsync) await r.compileAsync(this.scene, this.camera); else r.compile(this.scene, this.camera);
    } catch (e) { console.warn('precompile failed', e); }
    r.setRenderTarget(null);
  }
}
