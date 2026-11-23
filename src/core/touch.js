// On-screen touch controls for phones and tablets: a floating move joystick, drag-to-look,
// and context-sensitive buttons that feed the same Input state as the keyboard and mouse.
const BTN = (id, label, opts = {}) => ({ id, label, ...opts });

const FOOT = [
  BTN('use', 'USE', { code: 'KeyE', cls: 'big' }),
  BTN('grab', 'GRAB', { mouse: 'left', cls: 'mid' }),
  BTN('throw', 'THROW', { mouse: 'right' }),
  BTN('jump', 'JUMP', { code: 'Space' }),
  BTN('run', 'RUN', { toggle: 'ShiftLeft' }),
  BTN('tool', '✋', { code: 'KeyF' }),
  BTN('tighten', '+', { wheel: -1, cls: 'mid' }),
  BTN('loosen', '−', { wheel: 1 }),
];
const CAR = [
  BTN('gas', 'GAS', { code: 'KeyW', cls: 'pedal' }),
  BTN('brake', 'BRAKE', { code: 'KeyS', cls: 'pedal' }),
  BTN('hb', 'HAND\nBRAKE', { code: 'Space' }),
  BTN('up', '▲', { code: 'ShiftLeft' }),
  BTN('down', '▼', { code: 'KeyQ' }),
  BTN('start', 'START\n(hold)', { code: 'KeyI', cls: 'mid' }),
  BTN('exit', 'EXIT', { code: 'KeyE' }),
  BTN('lights', '💡', { code: 'KeyL' }),
  BTN('cam', '🎥', { code: 'KeyV' }),
  BTN('horn', '📯', { code: 'KeyH' }),
  BTN('belt', 'BELT', { code: 'KeyB' }),
  BTN('radio', '📻', { code: 'KeyR' }),
  BTN('forkUp', 'FORK ▲', { code: 'KeyR' }),
  BTN('forkDn', 'FORK ▼', { code: 'KeyF' }),
  BTN('drop', 'DROP\nBALE', { code: 'KeyG' }),
];
const TOP = [
  BTN('pause', '☰', { action: 'pause' }),
  BTN('list', 'CAR LIST', { code: 'Tab' }),
  BTN('map', 'MAP', { code: 'KeyM' }),
  BTN('pee', '🚽', { code: 'KeyP' }),
];

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.input = game.input;
    const root = document.createElement('div');
    root.id = 'touch';
    document.body.appendChild(root);
    this.root = root;
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.look = { id: null, x: 0, y: 0 };
    this.btns = {};
    this.repeat = {};
    // joystick visuals
    this.base = el('div', 'tc-base'); this.knob = el('div', 'tc-knob'); this.base.appendChild(this.knob); root.appendChild(this.base);
    this.base.style.display = 'none';
    this.hint = el('div', 'tc-hint', 'Drag left side to move · drag right side to look'); root.appendChild(this.hint);
    for (const [group, list] of [['foot', FOOT], ['car', CAR], ['top', TOP]]) for (const b of list) {
      const e = el('div', `tc-btn tc-${group} ${b.cls || ''}`, b.label.replace('\n', '<br>'));
      e.dataset.id = b.id;
      root.appendChild(e);
      this.btns[b.id] = { def: b, el: e, group };
      this.bindButton(e, b);
    }
    // move / look zones
    root.addEventListener('pointerdown', (ev) => this.onDown(ev));
    root.addEventListener('pointermove', (ev) => this.onMove(ev));
    root.addEventListener('pointerup', (ev) => this.onUp(ev));
    root.addEventListener('pointercancel', (ev) => this.onUp(ev));
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    document.body.classList.add('mobile');
  }

  bindButton(e, b) {
    const inp = this.input;
    const down = (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      try { e.setPointerCapture(ev.pointerId); } catch (er) {}
      e.classList.add('on');
      this.game.audio.init();
      if (b.action === 'pause') { this.game.pause(); return; }
      if (b.code) inp.press(b.code);
      if (b.mouse === 'left') { inp.mouse.left = true; inp.mouse.leftPressed = true; }
      if (b.mouse === 'right') { inp.mouse.right = true; inp.mouse.rightPressed = true; }
      if (b.toggle) { if (inp.keys.has(b.toggle)) { inp.release(b.toggle); e.classList.remove('lit'); } else { inp.press(b.toggle); e.classList.add('lit'); } }
      if (b.wheel) { inp.mouse.wheel += b.wheel; this.repeat[b.id] = setInterval(() => { inp.mouse.wheel += b.wheel; }, 85); }
    };
    const up = (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      e.classList.remove('on');
      if (b.code) inp.release(b.code);
      if (b.mouse === 'left') { inp.mouse.left = false; inp.mouse.leftReleased = true; }
      if (b.mouse === 'right') { inp.mouse.right = false; inp.mouse.rightReleased = true; }
      if (this.repeat[b.id]) { clearInterval(this.repeat[b.id]); this.repeat[b.id] = null; }
    };
    e.addEventListener('pointerdown', down);
    e.addEventListener('pointerup', up);
    e.addEventListener('pointercancel', up);
  }

  onDown(ev) {
    if (ev.target !== this.root && !ev.target.classList.contains('tc-hint')) return;
    ev.preventDefault();
    this.game.audio.init();
    const w = window.innerWidth;
    if (ev.clientX < w * 0.42 && this.stick.id === null) {
      this.stick.id = ev.pointerId; this.stick.ox = ev.clientX; this.stick.oy = ev.clientY; this.stick.x = this.stick.y = 0;
      this.base.style.display = 'block';
      this.base.style.left = `${ev.clientX - 60}px`; this.base.style.top = `${ev.clientY - 60}px`;
      this.knob.style.transform = 'translate(0px, 0px)';
    } else if (this.look.id === null) {
      this.look.id = ev.pointerId; this.look.x = ev.clientX; this.look.y = ev.clientY;
    }
    try { this.root.setPointerCapture(ev.pointerId); } catch (e) {}
    this.hint.style.opacity = 0;
  }
  onMove(ev) {
    if (ev.pointerId === this.stick.id) {
      let dx = ev.clientX - this.stick.ox, dy = ev.clientY - this.stick.oy;
      const d = Math.hypot(dx, dy), R = 55;
      if (d > R) { dx *= R / d; dy *= R / d; }
      this.stick.x = dx / R; this.stick.y = dy / R;
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const a = this.input.analog;
      a.active = true; a.x = this.stick.x; a.y = this.stick.y;
    } else if (ev.pointerId === this.look.id) {
      const dx = ev.clientX - this.look.x, dy = ev.clientY - this.look.y;
      this.look.x = ev.clientX; this.look.y = ev.clientY;
      this.input.addLook(dx * 1.25, dy * 1.25);
    }
  }
  onUp(ev) {
    if (ev.pointerId === this.stick.id) {
      this.stick.id = null; this.base.style.display = 'none';
      const a = this.input.analog; a.active = false; a.x = a.y = 0;
    }
    if (ev.pointerId === this.look.id) this.look.id = null;
  }

  // show the buttons that make sense right now
  update() {
    const g = this.game, P = g.player;
    const hidden = g.paused || g.modalOpen || !g.started || P.dead || P.sleeping;
    this.root.style.display = hidden ? 'none' : 'block';
    if (hidden) return;
    const v = P.inVehicle;
    this.hintT = (this.hintT || 0) + 1;
    if (this.hintT > 900 && this.hint.style.opacity !== '0') this.hint.style.opacity = 0;
    const ht = v ? 'Drag left side to steer · drag right side to look around' : 'Drag left side to walk · drag right side to look';
    if (this.hint.textContent !== ht) this.hint.textContent = ht;
    const show = (id, on) => { const b = this.btns[id]; if (b) b.el.style.display = on ? 'flex' : 'none'; };
    for (const b of Object.values(this.btns)) if (b.group === 'foot') show(b.def.id, !v);
    for (const b of Object.values(this.btns)) if (b.group === 'car') show(b.def.id, !!v);
    if (v) {
      const tractor = v.kind === 'tractor';
      show('radio', !tractor && v.kind !== 'moped');
      show('forkUp', tractor); show('forkDn', tractor); show('drop', tractor && !!v.bale);
      show('belt', v.kind !== 'moped' && v.kind !== 'tractor');
      show('up', v.kind !== 'moped'); show('down', v.kind !== 'moped');
      this.btns.start.el.innerHTML = v.engineOn ? 'ENGINE<br>OFF' : 'START<br>(hold)';
    } else {
      const it = g.interact;
      const tool = it.tool;
      this.btns.tool.el.innerHTML = tool === 'wrench' ? '🔧' : tool === 'screwdriver' ? '🪛' : '✋';
      const held = !!it.held;
      this.btns.grab.el.innerHTML = held ? 'DROP' : 'GRAB';
      show('throw', held);
      const aimPart = it.target && it.target.kind === 'part';
      show('tighten', tool !== 'hands' && aimPart); show('loosen', tool !== 'hands' && aimPart);
      this.btns.tighten.el.innerHTML = tool === 'screwdriver' ? 'TUNE +' : 'TIGHTEN';
      this.btns.loosen.el.innerHTML = tool === 'screwdriver' ? 'TUNE −' : 'LOOSEN';
      const canUse = !!(it.prompt && it.prompt.keys && it.prompt.keys.some(([k]) => k === 'E'));
      this.btns.use.el.classList.toggle('ready', canUse);
    }
  }
}

function el(tag, cls, html) { const e = document.createElement(tag); e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
