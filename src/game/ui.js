import { fmtMoney, fmtTime, DAYS, clamp } from '../core/util.js';
import { audio } from '../core/audio.js';
import { MAP_SIZE, HALF, P } from '../world/layout.js';
import { IS_MOBILE } from '../core/device.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const NEED_ICONS = { hunger: '🍖', thirst: '💧', fatigue: '😴', stress: '💢', bladder: '🚽', dirt: '🧼', drunk: '🍺', health: '❤️' };
const NEED_NAMES = { hunger: 'Hunger', thirst: 'Thirst', fatigue: 'Fatigue', stress: 'Stress', bladder: 'Bladder', dirt: 'Dirtiness', drunk: 'Drunk', health: 'Health' };

// {E}-style tokens in guide texts -> key chips (desktop) or on-screen button names (phones)
const KEYS_DESK = { E: 'E', F: 'F', LMB: 'Left click', RMB: 'Right click', WHEEL: 'Mouse wheel', TAB: 'Tab', M: 'M', I: 'hold I', W: 'W', S: 'S', AD: 'A / D', P: 'P', R: 'R', G: 'G', SPACE: 'Space' };
const KEYS_TOUCH = { E: 'USE', F: '🔧', LMB: 'GRAB', RMB: 'THROW', WHEEL: 'TIGHTEN', TAB: 'CAR LIST', M: 'MAP', I: 'START', W: 'GAS', S: 'BRAKE', AD: 'left stick', P: '🚽', R: 'FORK ▲', G: 'DROP', SPACE: 'JUMP' };
export function keyText(text) {
  const map = IS_MOBILE ? KEYS_TOUCH : KEYS_DESK;
  return String(text || '').replace(/\{(\w+)\}/g, (m, k) => `<span class="key">${map[k] || k}</span>`);
}
// interaction prompt keys on phones
const PROMPT_TOUCH = { E: 'USE', LMB: 'GRAB', RMB: 'THROW', F: '🔧', 'Wheel↑/LMB': 'TIGHTEN', 'Wheel↓/RMB': 'LOOSEN', Wheel: 'TUNE ±', 3: '🔧' };
const promptKey = (k) => (IS_MOBILE ? PROMPT_TOUCH[k] ?? null : k);

// only touch the DOM when a value really changes (layout work every frame stutters on phones)
function setDisp(el, d) { if (el._d !== d) { el._d = d; el.style.display = d; } }

export class UI {
  constructor(game) {
    this.game = game;
    const root = document.getElementById('ui');
    this.root = root;
    root.innerHTML = '';
    this.hud = h('div', 'hud'); root.appendChild(this.hud);
    // crosshair + prompt
    this.cross = h('div', 'crosshair'); this.hud.appendChild(this.cross);
    this.promptEl = h('div', 'prompt'); this.hud.appendChild(this.promptEl);
    // needs
    this.needsEl = h('div', 'needs'); this.hud.appendChild(this.needsEl);
    this.needBars = {};
    for (const k of ['health', 'hunger', 'thirst', 'fatigue', 'stress', 'bladder', 'dirt', 'drunk']) {
      const row = h('div', 'need', `<span class="ni">${NEED_ICONS[k]}</span><div class="nb"><div class="nf"></div></div>`);
      row.title = NEED_NAMES[k];
      this.needsEl.appendChild(row); this.needBars[k] = { row, fill: row.querySelector('.nf') };
    }
    // info top-right
    this.info = h('div', 'info'); this.hud.appendChild(this.info);
    this.toasts = h('div', 'toasts'); this.hud.appendChild(this.toasts);
    this.guideEl = h('div', 'guide'); this.hud.appendChild(this.guideEl);
    this.edgeEl = h('div', 'gedge'); this.hud.appendChild(this.edgeEl);
    this.celebEl = h('div', 'celebrate'); root.appendChild(this.celebEl);
    this.jobText = null; this.jobSub = '';
    this.subEl = h('div', 'subtitle'); this.hud.appendChild(this.subEl);
    this.vehEl = h('div', 'vehicle'); this.hud.appendChild(this.vehEl);
    this.toolEl = h('div', 'tool'); this.hud.appendChild(this.toolEl);
    this.timerEl = h('div', 'racetimer'); this.hud.appendChild(this.timerEl);
    this.hintEl = h('div', 'hints'); this.hud.appendChild(this.hintEl);
    this.compass = h('div', 'compass'); this.hud.appendChild(this.compass);
    this.markerEls = [];
    // overlays
    this.overlay = h('div', 'overlay hidden'); root.appendChild(this.overlay);
    this.fadeEl = h('div', 'fadecard hidden'); root.appendChild(this.fadeEl);
    this.achEl = h('div', 'achievement'); root.appendChild(this.achEl);
    this.dialogEl = h('div', 'dialog hidden'); root.appendChild(this.dialogEl);
    this.sheetEl = h('div', 'sheet hidden'); root.appendChild(this.sheetEl);
    this.mapEl = h('div', 'mapview hidden'); root.appendChild(this.mapEl);
    if (IS_MOBILE) this.mapEl.addEventListener('pointerdown', (e) => { e.preventDefault(); this.toggleMap(); });
    this.setTool('hands');
    this.subT = 0;
    this.lastInfo = '';
    this.modal = null;
    this.hintsShown = true;
  }

  // ---------------------------------------------------------------- simple feedback
  toast(text, dur = 3) {
    const t = h('div', 'toast', text);
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), dur * 1000);
    setTimeout(() => t.remove(), dur * 1000 + 600);
  }
  subtitle(name, text, dur = 4) {
    this.subEl.innerHTML = `<b>${name}:</b> ${text}`;
    this.subEl.classList.add('show');
    this.subT = dur;
  }
  // short job / police / race goal; drawn by the guide card (see tutorial.js)
  objective(title, sub = '') { this.jobText = title || null; this.jobSub = title ? sub : ''; }

  // the one goal card at the top of the screen
  setGuide(gd) {
    const el = this.guideEl;
    this.guide = gd;
    if (!gd) { if (this.guideShown !== false) { this.guideShown = false; el.classList.remove('show'); } setDisp(this.edgeEl, 'none'); this.lastGuide = ''; return; }
    const dist = gd.dist != null ? (gd.dist > 1000 ? `${(gd.dist / 1000).toFixed(1)} km` : `${Math.round(gd.dist)} m`) : '';
    const head = gd.step ? `<span class="gs">STEP ${gd.step}/${gd.total}</span>` : gd.interrupt ? '<span class="gs need">NEED</span>' : gd.job ? '<span class="gs job">JOB</span>' : '';
    const nav = gd.angle != null ? `<div class="gnav"><div class="garrow" style="transform:rotate(${(gd.angle * 180 / Math.PI).toFixed(0)}deg)">▲</div><div class="gdist">${dist}</div></div>` : gd.arrived && gd.text ? '<div class="gnav here"><div class="gok">✓</div><div class="gdist">HERE</div></div>' : '';
    const prog = gd.progress != null ? `<div class="gprog"><div style="width:${Math.round(gd.progress * 100)}%"></div></div>` : '';
    const key = `${gd.title}|${gd.text}|${dist}|${gd.angle != null ? Math.round(gd.angle * 20) : 'x'}|${gd.arrived}|${prog}`;
    if (key !== this.lastGuide) {
      this.lastGuide = key;
      el.innerHTML = `${nav}<div class="gbody"><div class="gt">${head}${gd.title}</div>${gd.text ? `<div class="gx">${keyText(gd.text)}</div>` : ''}${prog}</div>`;
    }
    if (this.guideShown !== true) { this.guideShown = true; el.classList.add('show'); }
    const arrivedNow = !!(gd.arrived && gd.text);
    if (arrivedNow !== this.guideArrived) {
      this.guideArrived = arrivedNow;
      el.classList.toggle('arrived', arrivedNow);
      if (arrivedNow) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    }
    // screen-edge pointer to the target
    const g = this.game;
    if (!gd.target || g.uiBlocking) { setDisp(this.edgeEl, 'none'); return; }
    const p = gd.target.clone(); p.y += 1.5;
    p.project(g.camera);
    const W = window.innerWidth, H = window.innerHeight;
    let x = (p.x * 0.5 + 0.5) * W, y = (-p.y * 0.5 + 0.5) * H;
    const behind = p.z > 1;
    const m = 46;
    const onScreen = !behind && x > m && x < W - m && y > m + 60 && y < H - m;
    if (onScreen) {
      if (this.edgeEl.className !== 'gedge on') this.edgeEl.className = 'gedge on';
      this.edgeEl.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
      const eh = `<div class="ea">▼</div><div class="ed">${dist}</div>`; if (eh !== this.edgeH) { this.edgeH = eh; this.edgeEl.innerHTML = eh; }
    } else {
      // direction from the screen centre (flip when behind the camera)
      let dx = x - W / 2, dy = y - H / 2;
      if (behind) { dx = -dx; dy = -dy; if (Math.abs(dy) < 1) dy = 1; dy = Math.abs(dy); }
      const k = Math.min((W / 2 - m) / Math.max(1e-3, Math.abs(dx)), (H / 2 - m) / Math.max(1e-3, Math.abs(dy)));
      x = W / 2 + dx * k; y = H / 2 + dy * k;
      const ang = Math.atan2(dy, dx) * 180 / Math.PI + 90;
      if (this.edgeEl.className !== 'gedge off') this.edgeEl.className = 'gedge off';
      this.edgeEl.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
      const eh = `<div class="ea" style="transform:rotate(${(Math.round(ang / 3) * 3).toFixed(0)}deg)">▲</div><div class="ed">${dist}</div>`; if (eh !== this.edgeH) { this.edgeH = eh; this.edgeEl.innerHTML = eh; }
    }
    setDisp(this.edgeEl, 'block');
  }
  celebrate(title, sub) {
    const e = this.celebEl;
    e.innerHTML = `<div class="ct">✔ ${title}</div><div class="cs">${keyText(sub)}</div>`;
    e.classList.remove('show'); void e.offsetWidth; e.classList.add('show');
    clearTimeout(this.celebT); this.celebT = setTimeout(() => e.classList.remove('show'), 2600);
  }
  setTool(t) {
    const names = { hands: '✋ Hands', wrench: '🔧 Wrench', screwdriver: '🪛 Screwdriver' };
    this.toolEl.innerHTML = `${names[t]}<span>${IS_MOBILE ? '' : 'F / 1-3'}</span>`;
    this.toolEl.className = 'tool ' + t;
  }
  achievement(title, desc) {
    const e = h('div', 'ach', `<div class="ai">🏆</div><div><div class="at">${title}</div><div class="ad">${desc}</div></div>`);
    this.achEl.appendChild(e);
    setTimeout(() => e.classList.add('show'), 30);
    setTimeout(() => e.classList.remove('show'), 4500);
    setTimeout(() => e.remove(), 5200);
  }
  raceTimer(text) { this.timerEl.innerHTML = text || ''; this.timerEl.style.display = text ? 'block' : 'none'; }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const g = this.game, P = g.player;
    // prompt
    const pr = g.interact.prompt;
    if (pr.main && !g.uiBlocking) {
      let keys = pr.keys.map(([k, l]) => { if (!k) return `<span class="note">${l}</span>`; const kk = promptKey(k); return kk === null ? '' : `<span class="key">${kk}</span>${l}`; }).join('');
      const html = `<div class="pm">${pr.main}</div>${pr.sub ? `<div class="ps">${pr.sub}</div>` : ''}<div class="pk">${keys}</div>`;
      if (html !== this.lastPrompt) { this.promptEl.innerHTML = html; this.lastPrompt = html; }
      setDisp(this.promptEl, 'block');
    } else setDisp(this.promptEl, 'none');
    if (this.crossActive !== !!pr.main) { this.crossActive = !!pr.main; this.cross.classList.toggle('active', this.crossActive); }
    setDisp(this.cross, P.inVehicle && P.inVehicle.camMode === 1 ? 'none' : 'block');
    // needs
    for (const [k, o] of Object.entries(this.needBars)) {
      let v = P.n[k];
      if (k === 'drunk') v = Math.min(100, v * 80);
      const bad = k === 'health' ? 100 - v : v;
      const wq = Math.round(clamp(v, 0, 100) * 2) / 2;
      if (wq !== o.w) { o.w = wq; o.fill.style.width = `${wq}%`; }
      const col = k === 'health' ? (v < 35 ? '#e04030' : '#e86a6a') : bad > 85 ? '#e04030' : bad > 65 ? '#e8a030' : k === 'drunk' ? '#d8b040' : '#e8e2d0';
      if (col !== o.col) { o.col = col; o.fill.style.background = col; }
      if ((bad > 80) !== o.warn) { o.warn = bad > 80; o.row.classList.toggle('warn', o.warn); }
      setDisp(o.row, (k === 'drunk' && v < 2) ? 'none' : 'flex');
    }
    // info
    const mins = g.time.minutes % 1440;
    const day = Math.floor(g.time.minutes / 1440);
    const info = `<div class="clock">${fmtTime(mins)}</div><div class="day">${DAYS[day % 7]} · Day ${day + 1}</div><div class="money">${fmtMoney(g.state.money)}</div>`;
    if (info !== this.lastInfo) { this.info.innerHTML = info; this.lastInfo = info; }
    // subtitle
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.subEl.classList.remove('show'); }
    // vehicle
    const v = P.inVehicle;
    this.vehT = (this.vehT || 0) - dt;
    if (v && this.vehT > 0 && this.lastVeh === v) { /* keep the last panel */ } else if (v) {
      this.vehT = 1 / 12; this.lastVeh = v;
      const st = v.engineStats();
      const gear = v.gear === 0 ? 'N' : v.gear < 0 ? 'R' : v.gear;
      const rpmPct = clamp(v.rpm / (st.redline * 1.05), 0, 1) * 100;
      const temp = v.engineTemp ?? 80;
      const warn = [];
      if (v.isBuildCar) {
        if (v.engineOn && v.oil < 0.8) warn.push('<span class="w red">OIL</span>');
        if (temp > 110) warn.push('<span class="w red">TEMP</span>');
        if (v.ignition && !v.engineOn) warn.push('<span class="w amber">BATT</span>');
        if (!v.registered) warn.push('<span class="w amber">NO PLATES</span>');
      }
      if (v.fuel < v.fuelCap * 0.12) warn.push('<span class="w amber">FUEL</span>');
      if (v.choke) warn.push('<span class="w">CHOKE</span>');
      if (v.lights) warn.push('<span class="w blue">LIGHTS</span>');
      if (!v.seatbelt && v.kind !== 'moped' && v.kind !== 'tractor') warn.push('<span class="w dim">BELT</span>');
      this.vehEl.innerHTML = `<div class="vn">${v.name}</div><div class="spd">${Math.round(v.speedKmh)}<span>km/h</span></div>
        <div class="gear">${gear}</div><div class="rpm"><div style="width:${rpmPct}%" class="${rpmPct > 88 ? 'red' : ''}"></div></div>
        <div class="vrow"><span>⛽ ${v.fuel.toFixed(1)} L</span>${v.isBuildCar ? `<span>🌡 ${Math.round(temp)}°C</span>` : ''}<span>${v.engineOn ? '<b class="on">ENGINE ON</b>' : v.ignition ? 'IGN' : 'OFF'}</span></div>
        <div class="vrow">${warn.join('')}</div>`;
      setDisp(this.vehEl, 'block');
    } else if (!v) { setDisp(this.vehEl, 'none'); this.lastVeh = null; }
    setDisp(this.toolEl, v ? 'none' : 'block');
    // hints
    if (this.hintsShown && !IS_MOBILE) {
      const hk = v ? v.kind : 'foot';
      if (hk !== this.lastHints) this.hintEl.innerHTML = v ? `<b>Driving</b> W/S gas/brake · A/D steer · Space handbrake<br>Shift/X gear up · Q/Z gear down · C clutch<br>I ignition (hold to crank) · K choke · L lights · B belt<br>H horn · R radio · N station · V camera · E exit${v.kind === 'tractor' ? '<br>R/F raise/lower bale spear · G drop bale' : ''}`
        : `<b>On foot</b> WASD move · Shift run · Space jump · C crouch<br>LMB pick up · RMB throw · E use/attach · F tools<br>Wheel tighten/loosen bolts · P pee · T watch<br>Tab car checklist · M map · H hide hints · Esc pause`;
      this.lastHints = hk;
      setDisp(this.hintEl, 'block');
    } else setDisp(this.hintEl, 'none');
    // compass + markers
    this.updateMarkers();
  }

  updateMarkers() {
    const g = this.game;
    const markers = g.jobs ? g.jobs.markers() : [];
    while (this.markerEls.length < markers.length) { const e = h('div', 'marker'); this.hud.appendChild(e); this.markerEls.push(e); }
    const cam = g.camera;
    for (let i = 0; i < this.markerEls.length; i++) {
      const e = this.markerEls[i], m = markers[i];
      if (!m) { setDisp(e, 'none'); continue; }
      if (this.guide?.target && this.guide.target.distanceToSquared(m.pos) < 4) { setDisp(e, 'none'); continue; }
      const p = m.pos.clone(); p.y += 2;
      const d = p.distanceTo(cam.position);
      p.project(cam);
      if (p.z > 1 || d < 3) { setDisp(e, 'none'); continue; }
      const x = clamp((p.x * 0.5 + 0.5) * window.innerWidth, 30, window.innerWidth - 30), y = clamp((-p.y * 0.5 + 0.5) * window.innerHeight, 40, window.innerHeight - 60);
      setDisp(e, 'block');
      e.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
      const html = `<div class="mi">${m.icon || '▼'}</div><div class="md">${m.label ? m.label + ' · ' : ''}${d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'}</div>`;
      if (html !== e._h) { e._h = html; e.innerHTML = html; }
    }
  }

  // ---------------------------------------------------------------- overlays
  showOverlay(html, cls = '') {
    this.overlay.className = 'overlay ' + cls;
    this.overlay.innerHTML = html;
    this.overlay.onclick = null; // a new screen must not inherit the last one's click handler
    return this.overlay;
  }
  hideOverlay() { this.overlay.className = 'overlay hidden'; this.overlay.innerHTML = ''; }

  clickToPlay(first) {
    const o = this.showOverlay(`<div class="ctp">
      ${first ? `<div class="logo">KESÄKAARA</div><div class="tag">Summer 1997 · Kurkijärvi, Finland</div>
      <div class="story">Your uncle left for a job on the oil rigs and left you his house by the lake, a tired old van, a moped — and a <b>Ruska 1300</b> in a hundred pieces in the garage. Build it. Register it. Win the Saturday rally. Try not to die.</div>` : '<div class="logo small">PAUSED</div>'}
      <div class="go">${first ? (IS_MOBILE ? 'Tap to start your summer' : 'Click to start your summer') : (IS_MOBILE ? 'Tap to continue' : 'Click to continue')}</div>${IS_MOBILE ? '<div class="rot">📱↻ Turn your phone sideways for the best view</div>' : ''}</div>`, 'ctp-wrap');
    o.onclick = () => { this.game.resume(); };
  }

  pauseMenu() {
    const g = this.game;
    const o = this.showOverlay(`<div class="menu">
      <div class="logo small">KESÄKAARA</div>
      <button data-a="resume">Resume</button>
      <button data-a="save">Save game</button>
      <button data-a="settings">Settings</button>
      <button data-a="controls">Controls</button>
      <button data-a="stats">Statistics & achievements</button>
      <button data-a="tut">${g.tutorial?.active ? 'Skip the tutorial' : 'Show the tutorial again'}</button>
      <button data-a="new" class="danger">Start a new summer</button>
      <div class="ver">Save: autosaves every few minutes and when you sleep.</div></div>`, 'dim');
    o.querySelectorAll('button').forEach((b) => b.onclick = (ev) => {
      ev.stopPropagation(); audio.play('ui');
      const a = b.dataset.a;
      if (a === 'resume') g.resume();
      if (a === 'save') { g.saveGame(); this.toast('Game saved.'); }
      if (a === 'settings') this.settingsMenu();
      if (a === 'controls') this.controlsMenu();
      if (a === 'stats') this.statsMenu();
      if (a === 'tut') { if (g.tutorial.active) g.tutorial.skip(); else { g.tutorial.restart(); this.toast('Tutorial is back. Follow the yellow arrows!'); } this.pauseMenu(); }
      if (a === 'new') this.confirmNew();
    });
  }

  confirmNew() {
    const g = this.game;
    const o = this.showOverlay(`<div class="menu"><div class="mt">Start a new summer?</div><div class="mtext">This deletes your current save: the car, money and everything you have done.</div>
      <button data-a="yes" class="danger">Yes, start over</button><button data-a="no">No, go back</button></div>`, 'dim');
    o.querySelector('[data-a=yes]').onclick = (ev) => { ev.stopPropagation(); g.newGame(); };
    o.querySelector('[data-a=no]').onclick = (ev) => { ev.stopPropagation(); audio.play('uiBack'); this.pauseMenu(); };
  }

  settingsMenu() {
    const g = this.game, s = g.settings;
    const o = this.showOverlay(`<div class="menu wide"><div class="mt">Settings</div>
      <label>Graphics quality <select id="q">${['Low', 'Medium', 'High', 'Ultra'].map((n, i) => `<option value="${i}" ${i === s.quality ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Mouse sensitivity <input id="sens" type="range" min="0.2" max="3" step="0.05" value="${s.sensitivity}"></label>
      <label>Field of view <input id="fov" type="range" min="60" max="95" step="1" value="${s.fov}"></label>
      <label>Master volume <input id="vol" type="range" min="0" max="1" step="0.05" value="${s.volume}"></label>
      <label>Music / radio volume <input id="mvol" type="range" min="0" max="1" step="0.05" value="${s.music}"></label>
      <label><input id="inv" type="checkbox" ${s.invertY ? 'checked' : ''}> Invert mouse Y</label>
      <label><input id="clutch" type="checkbox" ${s.autoClutch ? 'checked' : ''}> Assisted clutch (no stalling)</label>
      <label><input id="hints" type="checkbox" ${this.hintsShown ? 'checked' : ''}> Show control hints</label>
      <button data-a="back">Back</button></div>`, 'dim');
    const q = (id) => o.querySelector('#' + id);
    const apply = () => {
      if (+q('q').value !== s.quality) s.manualQuality = true; s.quality = +q('q').value; s.sensitivity = +q('sens').value; s.fov = +q('fov').value; s.volume = +q('vol').value; s.music = +q('mvol').value;
      s.invertY = q('inv').checked; s.autoClutch = q('clutch').checked; this.hintsShown = q('hints').checked;
      g.applySettings();
    };
    o.querySelectorAll('input,select').forEach((e) => e.onchange = apply);
    o.querySelector('[data-a=back]').onclick = (ev) => { ev.stopPropagation(); audio.play('uiBack'); this.pauseMenu(); };
  }
  controlsMenu() {
    if (IS_MOBILE) {
      const o = this.showOverlay(`<div class="menu wide"><div class="mt">Touch controls</div><div class="controls">
        <div><b>On foot</b><br>Drag the left side — walk (push far to run) · Drag the right side — look<br>USE — open, talk, attach, eat/drink · GRAB — pick up / drop · THROW<br>✋ — switch hands / wrench / screwdriver<br>TIGHTEN / LOOSEN — bolts (with the wrench), tuning (with the screwdriver)<br>CAR LIST — what the car still needs · MAP · 🚽 — pee</div>
        <div><b>Driving</b><br>Left stick — steer · GAS / BRAKE pedals<br>START (hold) — crank the engine · ▲ ▼ — gears · HAND BRAKE<br>EXIT — get out · 💡 lights · 🎥 camera · 📯 horn · 📻 radio · BELT<br>Tractor: FORK ▲ / ▼ — lift and lower bales</div></div>
        <button data-a="back">Back</button></div>`, 'dim');
      o.querySelector('[data-a=back]').onclick = (ev) => { ev.stopPropagation(); audio.play('uiBack'); this.pauseMenu(); };
      return;
    }
    const o = this.showOverlay(`<div class="menu wide"><div class="mt">Controls</div><div class="controls">
      <div><b>On foot</b><br>WASD — move · Shift — run · Space — jump · C — crouch<br>Mouse — look · LMB — pick up / drop · RMB — throw<br>E — use, talk, attach a held part, drink/eat held item<br>F or 1/2/3 — hands / wrench / screwdriver<br>Mouse wheel (wrench) — tighten / loosen bolts<br>Mouse wheel (screwdriver) — tune carburettor & ignition<br>R (holding) — rotate item · P — pee · T — check watch<br>Tab — car build checklist · M — map · H — toggle hints</div>
      <div><b>Driving</b><br>W / S — throttle / brake · A / D — steer<br>Space — handbrake · Shift or X — gear up · Q or Z — gear down<br>C — clutch · I — ignition (hold to crank the starter)<br>K — choke (cold starts) · L — lights · B — seatbelt · H — horn<br>R — radio on/off · N — next station · V — camera · E — exit<br>Tractor: R / F — raise / lower bale spear</div></div>
      <button data-a="back">Back</button></div>`, 'dim');
    o.querySelector('[data-a=back]').onclick = (ev) => { ev.stopPropagation(); audio.play('uiBack'); this.pauseMenu(); };
  }
  statsMenu() {
    const g = this.game, st = g.stats;
    const ach = Object.entries(g.achievements).map(([k, a]) => `<div class="achrow">🏆 <b>${a.title}</b> — ${a.desc}</div>`).join('') || '<div class="achrow dim">None yet. Go cause some trouble.</div>';
    const comp = g.car.completion();
    const o = this.showOverlay(`<div class="menu wide"><div class="mt">Statistics</div>
      <div class="statgrid">
      <div>Days survived</div><div>${Math.floor(g.time.minutes / 1440) + 1}</div>
      <div>Car completion</div><div>${Math.round(comp.pct * 100)}% (${comp.have}/${comp.total} parts)</div>
      <div>Money earned</div><div>${fmtMoney(st.earned || 0)}</div>
      <div>Beers drunk</div><div>${st.beers || 0}</div>
      <div>Saunas taken</div><div>${st.saunas || 0}</div>
      <div>Jobs done</div><div>${st.jobs || 0}</div>
      <div>Times arrested</div><div>${st.arrests || 0}</div>
      <div>Crashes</div><div>${st.crashes || 0}</div>
      <div>Best rally time</div><div>${g.state.bestRally ? g.rally.fmt(g.state.bestRally) : '—'}</div>
      <div>Deaths</div><div>${st.deaths || 0}</div></div>
      <div class="mt2">Achievements (${Object.keys(g.achievements).length})</div><div class="achlist">${ach}</div>
      <button data-a="back">Back</button></div>`, 'dim');
    o.querySelector('[data-a=back]').onclick = (ev) => { ev.stopPropagation(); audio.play('uiBack'); this.pauseMenu(); };
  }

  // generic choice menu (needs mouse)
  menu({ title, text = '', options = [], onClose = null, wide = false }) {
    const g = this.game;
    g.openModal();
    const o = this.showOverlay(`<div class="menu ${wide ? 'wide' : ''}"><div class="mt">${title}</div>${text ? `<div class="mtext">${text}</div>` : ''}
      <div class="opts">${options.map((op, i) => `<button data-i="${i}" ${op.disabled ? 'disabled' : ''}><span>${op.label}</span>${op.sub ? `<small>${op.sub}</small>` : ''}</button>`).join('')}</div>
      <button data-a="close" class="ghost">Close</button></div>`, 'dim');
    const close = () => { this.hideOverlay(); g.closeModal(); onClose && onClose(); };
    o.querySelectorAll('[data-i]').forEach((b) => b.onclick = (ev) => {
      ev.stopPropagation(); audio.play('ui');
      const op = options[+b.dataset.i];
      const keep = op.action && op.action();
      if (!keep) close();
    });
    o.querySelector('[data-a=close]').onclick = (ev) => { ev.stopPropagation(); audio.play('uiBack'); close(); };
    this.modal = close;
  }

  // shop catalogue with cart
  shop({ title, items, onBuy, footer = '', delivery = null }) {
    const g = this.game;
    g.openModal();
    const cart = new Map();
    const cats = [...new Set(items.map((i) => i.cat || 'Items'))];
    let cat = cats[0];
    const render = () => {
      const total = [...cart.entries()].reduce((s, [id, n]) => s + items.find((i) => i.id === id).price * n, 0);
      const list = items.filter((i) => (i.cat || 'Items') === cat);
      const o = this.showOverlay(`<div class="shop"><div class="mt">${title}</div>
        <div class="tabs">${cats.map((c) => `<button class="tab ${c === cat ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>
        <div class="slist">${list.map((it) => `<div class="sitem"><div class="sn">${it.name}${it.note ? `<small>${it.note}</small>` : ''}</div><div class="sp">${fmtMoney(it.price)}</div>
          <div class="sq"><button data-m="${it.id}">−</button><span>${cart.get(it.id) || 0}</span><button data-p="${it.id}">+</button></div></div>`).join('')}</div>
        <div class="sfoot"><div>Cart: <b>${fmtMoney(total)}</b> · You have ${fmtMoney(g.state.money)}</div>${footer ? `<div class="sfn">${footer}</div>` : ''}
        <div class="sbtns">${delivery ? `<button data-a="deliver" ${total === 0 || total + delivery > g.state.money ? 'disabled' : ''}>Deliver to garage (+${fmtMoney(delivery)})</button>` : ''}<button data-a="buy" ${total === 0 || total > g.state.money ? 'disabled' : ''}>Buy</button><button data-a="close" class="ghost">Close</button></div></div></div>`, 'dim');
      o.querySelectorAll('[data-cat]').forEach((b) => b.onclick = (ev) => { ev.stopPropagation(); cat = b.dataset.cat; audio.play('ui'); render(); });
      o.querySelectorAll('[data-p]').forEach((b) => b.onclick = (ev) => { ev.stopPropagation(); cart.set(b.dataset.p, (cart.get(b.dataset.p) || 0) + 1); audio.play('ui'); render(); });
      o.querySelectorAll('[data-m]').forEach((b) => b.onclick = (ev) => { ev.stopPropagation(); cart.set(b.dataset.m, Math.max(0, (cart.get(b.dataset.m) || 0) - 1)); audio.play('uiBack'); render(); });
      const close = () => { this.hideOverlay(); g.closeModal(); };
      this.modal = close;
      o.querySelector('[data-a=close]').onclick = (ev) => { ev.stopPropagation(); audio.play('uiBack'); close(); };
      const buy = (deliver) => (ev) => {
        ev.stopPropagation();
        const list2 = [...cart.entries()].filter(([, n]) => n > 0).map(([id, n]) => ({ item: items.find((i) => i.id === id), n }));
        const sum = list2.reduce((s, { item, n }) => s + item.price * n, 0) + (deliver ? delivery : 0);
        if (sum > g.state.money) return;
        g.spend(sum);
        audio.play('cash');
        onBuy(list2, deliver);
        close();
      };
      o.querySelector('[data-a=buy]').onclick = buy(false);
      const dl = o.querySelector('[data-a=deliver]'); if (dl) dl.onclick = buy(true);
    };
    render();
  }

  // conversation box (keyboard driven, no pointer unlock)
  dialog(name, text, options) {
    this.dialogEl.className = 'dialog';
    this.dialogEl.innerHTML = `<div class="dn">${name}</div><div class="dt">${text}</div><div class="do">${options.map((o, i) => `<div class="dopt" data-i="${i}"><span class="key">${IS_MOBILE ? '›' : i + 1}</span>${o.label}</div>`).join('')}</div>`;
    this.dialogEl.querySelectorAll('.dopt').forEach((b) => b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); this.game.dialog.choose(+b.dataset.i); }));
  }
  closeDialog() { this.dialogEl.className = 'dialog hidden'; }

  fade(text, sub = '', ms = 2500) {
    return new Promise((res) => {
      this.fadeEl.className = 'fadecard';
      this.fadeEl.innerHTML = `<div class="ft">${text}</div><div class="fs">${sub}</div>`;
      this.game.fx.fade = 1;
      setTimeout(() => { this.fadeEl.className = 'fadecard hidden'; res(); }, ms);
    });
  }

  death(cause, onRevive, onLoad) {
    const g = this.game;
    g.openModal();
    const o = this.showOverlay(`<div class="death"><div class="dtitle">YOU DIED</div><div class="dcause">You ${cause}.</div>
      <div class="dstats">Survived ${Math.floor(g.time.minutes / 1440) + 1} days · Car ${Math.round(g.car.completion().pct * 100)}% complete</div>
      <div class="opts"><button data-a="revive">▶ Watch an ad to wake up in hospital</button><button data-a="load">Load last save (last time you slept)</button></div></div>`, 'deathbg');
    o.querySelector('[data-a=revive]').onclick = (ev) => { ev.stopPropagation(); audio.play('ui'); onRevive(); };
    o.querySelector('[data-a=load]').onclick = (ev) => { ev.stopPropagation(); audio.play('ui'); onLoad(); };
  }

  // ---------------------------------------------------------------- checklist (Tab) & map (M)
  toggleSheet(html) {
    if (html === null || !this.sheetEl.classList.contains('hidden')) { this.sheetEl.className = 'sheet hidden'; return false; }
    this.sheetEl.className = 'sheet'; this.sheetEl.innerHTML = html; return true;
  }
  toggleMap() {
    const g = this.game;
    if (!this.mapEl.classList.contains('hidden')) { this.mapEl.className = 'mapview hidden'; return; }
    this.mapEl.className = 'mapview';
    if (!this.mapCanvas) this.mapCanvas = g.renderMapImage();
    const c = document.createElement('canvas'); c.width = c.height = 760;
    const x = c.getContext('2d');
    x.drawImage(this.mapCanvas, 0, 0, 760, 760);
    const w2m = (p) => [((p.x + HALF) / MAP_SIZE) * 760, ((p.z + HALF) / MAP_SIZE) * 760];
    const labels = [['Home', P.home], ['Kurkimäki', P.village], ['Rautala', P.town], ['Haapala farm', P.farm], ['Rally', P.rally], ['Junkyard', P.junkyard], ['Kurkijärvi lake', { x: -170, z: 60 }]];
    x.font = 'bold 15px Segoe UI, Arial'; x.textAlign = 'center';
    for (const [t, p] of labels) { const [mx, my] = w2m(p); x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillText(t, mx + 1, my - 9); x.fillStyle = '#ffe9a0'; x.fillText(t, mx, my - 10); x.beginPath(); x.arc(mx, my, 4, 0, 7); x.fill(); }
    for (const m of (g.jobs ? g.jobs.markers() : [])) { const [mx, my] = w2m(m.pos); x.fillStyle = '#ff5030'; x.beginPath(); x.arc(mx, my, 6, 0, 7); x.fill(); }
    const pp = g.player.inVehicle ? g.player.inVehicle.pos : g.player.pos;
    const [px, py] = w2m(pp);
    const yaw = g.player.inVehicle ? Math.atan2(g.player.inVehicle.forwardVec().x, g.player.inVehicle.forwardVec().z) : Math.atan2(-Math.sin(g.player.yaw), -Math.cos(g.player.yaw));
    x.save(); x.translate(px, py); x.rotate(-yaw + Math.PI); x.fillStyle = '#40c8ff'; x.strokeStyle = '#002'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, -11); x.lineTo(7, 8); x.lineTo(0, 4); x.lineTo(-7, 8); x.closePath(); x.fill(); x.stroke(); x.restore();
    const [cx, cy] = w2m(g.car.pos); x.fillStyle = '#ffd040'; x.fillRect(cx - 4, cy - 4, 8, 8);
    this.mapEl.innerHTML = '<div class="mapt">Map of Kurkijärvi — <span style="color:#40c8ff">▲ you</span> · <span style="color:#ffd040">■ Ruska</span> · <span style="color:#ff5030">● objective</span> · M to close</div>';
    this.mapEl.appendChild(c);
  }
}
