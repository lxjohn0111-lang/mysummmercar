// Keyboard / mouse input with pointer lock; touch controls feed the same state on phones.
import { IS_MOBILE } from './device.js';
export class Input {
  constructor(canvas) {
    this.mobile = IS_MOBILE;
    this.analog = { x: 0, y: 0, active: false };
    this.lookScale = 1;
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();   // pressed this frame
    this.released = new Set();
    this.mouse = { dx: 0, dy: 0, wheel: 0, left: false, right: false, leftPressed: false, rightPressed: false, leftReleased: false, rightReleased: false };
    this.locked = false;
    this.enabled = true;
    this.sensitivity = 1;
    this.invertY = false;
    this.onLockChange = null;
    this.keyHoldTime = {};

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'AltLeft') e.preventDefault();
      if (!this.keys.has(e.code)) { this.pressed.add(e.code); this.keyHoldTime[e.code] = performance.now(); }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); this.released.add(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // Clamp crazy spikes some browsers produce on lock
      const dx = Math.max(-300, Math.min(300, e.movementX || 0));
      const dy = Math.max(-300, Math.min(300, e.movementY || 0));
      this.mouse.dx += dx; this.mouse.dy += dy;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { if (this.mouse.left) this.mouse.leftReleased = true; this.mouse.left = false; }
      if (e.button === 2) { if (this.mouse.right) this.mouse.rightReleased = true; this.mouse.right = false; }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.mouse.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.keys.clear(); this.mouse.left = this.mouse.right = false; }
      this.onLockChange && this.onLockChange(this.locked);
    });
  }

  // virtual key presses from touch buttons
  press(code) { if (!this.keys.has(code)) { this.pressed.add(code); this.keyHoldTime[code] = performance.now(); } this.keys.add(code); }
  release(code) { if (this.keys.has(code)) this.released.add(code); this.keys.delete(code); }
  tapKey(code) { this.press(code); setTimeout(() => this.release(code), 90); }
  addLook(dx, dy) { this.mouse.dx += dx * this.lookScale; this.mouse.dy += dy * this.lookScale; }

  lock() {
    if (this.mobile) { this.locked = true; return; }
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { this.canvas.requestPointerLock(); } catch (e) {} });
    } catch (e) { try { this.canvas.requestPointerLock(); } catch (e2) {} }
  }
  unlock() { if (this.mobile) { this.locked = false; this.keys.clear(); this.analog.active = false; this.analog.x = this.analog.y = 0; return; } if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.enabled && this.keys.has(code); }
  hit(code) { return this.enabled && this.pressed.has(code); }
  up(code) { return this.enabled && this.released.has(code); }
  heldFor(code) { return this.keys.has(code) ? (performance.now() - (this.keyHoldTime[code] || 0)) / 1000 : 0; }
  axis(neg, pos) { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }

  consumeMouse() {
    const s = 0.0022 * this.sensitivity;
    const r = { x: this.mouse.dx * s, y: this.mouse.dy * s * (this.invertY ? -1 : 1) };
    this.mouse.dx = 0; this.mouse.dy = 0;
    return r;
  }
  endFrame() {
    this.pressed.clear(); this.released.clear();
    this.mouse.wheel = 0;
    this.mouse.leftPressed = this.mouse.rightPressed = false;
    this.mouse.leftReleased = this.mouse.rightReleased = false;
  }
}
