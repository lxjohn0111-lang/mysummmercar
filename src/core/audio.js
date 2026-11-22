// Fully procedural audio: engines, ambience, foley. No audio files needed.
import { clamp, rand } from './util.js';

class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volumes = { master: 0.8, sfx: 1, music: 0.6, ambient: 0.8 };
    this.loops = new Set();
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.volumes.master;
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -12; this.comp.ratio.value = 4;
    this.master.connect(this.comp).connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = this.volumes.music; this.music.connect(this.master);
    this.ambient = c.createGain(); this.ambient.gain.value = this.volumes.ambient; this.ambient.connect(this.master);
    // Muffling filter used when indoors / in car / underwater
    this.muffle = c.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000;
    this.muffle.connect(this.sfx);
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Brown noise for rumbles / wind
    this.brownBuf = c.createBuffer(1, len, c.sampleRate);
    const b = this.brownBuf.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this.startAmbience();
    this.applyMute();
  }

  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  setMuted(m) { this.muted = m; this.applyMute(); }
  applyMute() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volumes.master, this.t, 0.05);
  }
  setVolume(kind, v) {
    this.volumes[kind] = v;
    if (!this.ctx) return;
    if (kind === 'master') this.applyMute();
    else if (this[kind]) this[kind].gain.setTargetAtTime(v, this.t, 0.05);
  }
  suspend() { this.ctx && this.ctx.suspend(); }
  resume() { this.ctx && this.ctx.resume(); }

  setListener(pos, fwd, up) {
    if (!this.ctx) return;
    const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.value = pos.x; L.positionY.value = pos.y; L.positionZ.value = pos.z;
      L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z;
      L.upX.value = up.x; L.upY.value = up.y; L.upZ.value = up.z;
    } else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
  }
  setMuffle(amount) {
    if (!this.ctx) return;
    this.muffle.frequency.setTargetAtTime(20000 * Math.pow(0.03, amount), this.t, 0.1);
  }

  // Create a spatial output node at a position (or non-spatial if pos null)
  out(pos, refDist = 4, maxDist = 120, bus = null) {
    const c = this.ctx;
    const g = c.createGain();
    if (pos) {
      const p = c.createPanner();
      p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
      p.refDistance = refDist; p.maxDistance = maxDist; p.rolloffFactor = 1.2;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
      else p.setPosition(pos.x, pos.y, pos.z);
      g.connect(p).connect(bus || this.muffle);
      g.panner = p;
    } else g.connect(bus || this.muffle);
    return g;
  }
  setPos(node, pos) {
    if (!node || !node.panner) return;
    const p = node.panner;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y, pos.z);
  }

  noise(brown = false) {
    const s = this.ctx.createBufferSource(); s.buffer = brown ? this.brownBuf : this.noiseBuf; s.loop = true;
    s.loopStart = Math.random(); return s;
  }

  // ----------------------------------------------------------------- one-shots
  env(g, a, peak, d, t0 = this.t) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  tone(freq, dur, { type = 'sine', vol = 0.3, pos = null, slide = 0, attack = 0.005, delay = 0, bus = null } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = this.t + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
    const g = c.createGain(); this.env(g, attack, vol, dur, t0);
    o.connect(g).connect(this.out(pos, 3, 80, bus)); o.start(t0); o.stop(t0 + attack + dur + 0.05);
  }
  burst(dur, { freq = 1000, q = 1, type = 'bandpass', vol = 0.3, pos = null, attack = 0.002, delay = 0, brown = false, sweep = 0 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = this.t + delay;
    const n = this.noise(brown);
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, freq * sweep), t0 + dur);
    const g = c.createGain(); this.env(g, attack, vol, dur, t0);
    n.connect(f).connect(g).connect(this.out(pos, 3, 80)); n.start(t0); n.stop(t0 + attack + dur + 0.05);
  }

  play(name, pos = null, k = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'ratchet':
        this.burst(0.025, { freq: 4200, q: 6, vol: 0.25, pos }); this.tone(2400, 0.02, { type: 'square', vol: 0.04, pos }); break;
      case 'boltTight':
        this.tone(900, 0.06, { type: 'triangle', vol: 0.2, pos }); this.burst(0.05, { freq: 2500, q: 3, vol: 0.2, pos }); break;
      case 'clunk':
        this.tone(120, 0.15, { type: 'sine', vol: 0.5 * k, pos, slide: 0.5 }); this.burst(0.08, { freq: 800, q: 1, vol: 0.3 * k, pos }); break;
      case 'metal':
        this.tone(rand(500, 900), 0.4, { type: 'triangle', vol: 0.12 * k, pos, slide: 0.98 }); this.tone(rand(1300, 2100), 0.25, { vol: 0.06 * k, pos }); this.burst(0.05, { freq: 3000, q: 2, vol: 0.2 * k, pos }); break;
      case 'thud':
        this.tone(80 + rand(0, 30), 0.18, { vol: 0.5 * k, pos, slide: 0.6 }); this.burst(0.06, { freq: 400, q: 1, vol: 0.25 * k, pos, brown: true }); break;
      case 'glass':
        for (let i = 0; i < 3; i++) this.tone(rand(2500, 4200), 0.25, { vol: 0.07 * k, pos, delay: i * 0.02 }); this.burst(0.04, { freq: 5000, q: 3, vol: 0.12 * k, pos }); break;
      case 'shatter':
        for (let i = 0; i < 10; i++) this.tone(rand(2500, 6000), rand(0.1, 0.4), { vol: 0.06, pos, delay: rand(0, 0.25) });
        this.burst(0.4, { freq: 4000, q: 0.7, vol: 0.4, pos, type: 'highpass' }); break;
      case 'door':
        this.tone(90, 0.2, { vol: 0.5, pos, slide: 0.7 }); this.burst(0.12, { freq: 600, q: 0.8, vol: 0.35, pos }); this.tone(1800, 0.08, { type: 'square', vol: 0.03, pos, delay: 0.02 }); break;
      case 'doorOpen':
        this.burst(0.08, { freq: 2000, q: 2, vol: 0.12, pos }); this.tone(400, 0.15, { type: 'sawtooth', vol: 0.03, pos, slide: 1.4 }); break;
      case 'creak':
        this.tone(220, 0.5, { type: 'sawtooth', vol: 0.03, pos, slide: 1.6, attack: 0.05 }); break;
      case 'pssht':
        this.burst(0.35, { freq: 5000, q: 0.6, vol: 0.25, pos, type: 'highpass', sweep: 0.5 }); break;
      case 'gulp':
        for (let i = 0; i < 3; i++) this.tone(rand(180, 260), 0.09, { vol: 0.25, pos, slide: 0.6, delay: i * 0.33 }); break;
      case 'burp':
        { const c = this.ctx, t0 = this.t; const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t0); o.frequency.linearRampToValueAtTime(70, t0 + 0.5);
          const lfo = c.createOscillator(); lfo.frequency.value = 28; const lg = c.createGain(); lg.gain.value = 30; lfo.connect(lg).connect(o.frequency);
          const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 5;
          const g = c.createGain(); this.env(g, 0.03, 0.5, 0.55, t0);
          o.connect(f).connect(g).connect(this.out(pos)); o.start(t0); lfo.start(t0); o.stop(t0 + 0.7); lfo.stop(t0 + 0.7); }
        break;
      case 'eat':
        for (let i = 0; i < 4; i++) this.burst(0.06, { freq: rand(1200, 2500), q: 1.5, vol: 0.2, pos, delay: i * 0.18 }); break;
      case 'hiss':
        this.burst(2.2, { freq: 3500, q: 0.4, vol: 0.4, pos, type: 'highpass', sweep: 0.6, attack: 0.05 }); this.burst(0.3, { freq: 300, q: 1, vol: 0.3, pos, brown: true }); break;
      case 'splash':
        this.burst(0.6 * k, { freq: 1200, q: 0.5, vol: 0.4 * k, pos, sweep: 0.4 }); this.tone(300, 0.2, { vol: 0.1 * k, pos, slide: 0.4 }); break;
      case 'step':
        this.burst(0.06, { freq: k === 1 ? 1800 : k === 2 ? 900 : k === 3 ? 400 : 2500, q: 0.8, vol: 0.06, pos, brown: k === 3 }); break;
      case 'crash':
        { const v = clamp(k, 0.2, 2);
          this.tone(60, 0.5, { vol: 0.8 * v, pos, slide: 0.5 }); this.burst(0.6 * v, { freq: 1500, q: 0.4, vol: 0.6 * v, pos });
          for (let i = 0; i < 6 * v; i++) this.tone(rand(300, 1500), rand(0.1, 0.5), { type: 'triangle', vol: 0.1 * v, pos, delay: rand(0, 0.2) });
          if (v > 0.8) this.play('shatter', pos); }
        break;
      case 'horn':
        this.tone(410, 0.6 * k, { type: 'square', vol: 0.18, pos, attack: 0.01 }); this.tone(515, 0.6 * k, { type: 'square', vol: 0.15, pos, attack: 0.01 }); break;
      case 'click':
        this.tone(1800, 0.02, { type: 'square', vol: 0.06, pos }); break;
      case 'ui':
        this.tone(880, 0.06, { type: 'triangle', vol: 0.08, bus: this.sfx }); break;
      case 'uiBack':
        this.tone(520, 0.06, { type: 'triangle', vol: 0.08, bus: this.sfx }); break;
      case 'cash':
        this.tone(2600, 0.15, { type: 'triangle', vol: 0.1 }); this.tone(3300, 0.4, { type: 'triangle', vol: 0.08, delay: 0.08 }); this.burst(0.1, { freq: 3000, q: 1, vol: 0.1, delay: 0.05 }); break;
      case 'achievement':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.12, delay: i * 0.09, bus: this.sfx })); break;
      case 'notify':
        this.tone(740, 0.12, { type: 'sine', vol: 0.08, bus: this.sfx }); this.tone(988, 0.2, { type: 'sine', vol: 0.08, delay: 0.1, bus: this.sfx }); break;
      case 'phone':
        for (let r = 0; r < 2; r++) for (let i = 0; i < 12; i++) this.tone(i % 2 ? 1200 : 1500, 0.04, { type: 'square', vol: 0.05, pos, delay: r * 0.6 + i * 0.04 }); break;
      case 'chop':
        this.tone(160, 0.12, { vol: 0.5, pos, slide: 0.5 }); this.burst(0.12, { freq: 1800, q: 1, vol: 0.35, pos }); this.tone(900, 0.1, { type: 'triangle', vol: 0.06, pos }); break;
      case 'swing':
        this.burst(0.18, { freq: 600, q: 1.5, vol: 0.12, pos, sweep: 3 }); break;
      case 'slap':
        this.burst(0.05, { freq: 2000, q: 0.7, vol: 0.4, pos }); break;
      case 'vomit':
        { this.burst(1.2, { freq: 500, q: 1.5, vol: 0.4, pos, sweep: 0.5 }); this.tone(130, 1.1, { type: 'sawtooth', vol: 0.08, pos, slide: 0.7 }); this.burst(0.8, { freq: 2500, q: 0.4, vol: 0.2, pos, delay: 0.3 }); }
        break;
      case 'starterFail':
        for (let i = 0; i < 8; i++) this.tone(55, 0.08, { type: 'sawtooth', vol: 0.15, pos, delay: i * 0.12 }); break;
      case 'click3':
        for (let i = 0; i < 3; i++) this.tone(1200, 0.02, { type: 'square', vol: 0.05, pos, delay: i * 0.08 }); break;
      case 'backfire':
        this.tone(70, 0.15, { vol: 0.9, pos, slide: 0.5 }); this.burst(0.12, { freq: 600, q: 0.6, vol: 0.8, pos, brown: true }); break;
      case 'blowoff':
        this.burst(0.5, { freq: 2500, q: 2, vol: 0.25, pos, sweep: 0.4 }); break;
      case 'fishBite':
        this.burst(0.15, { freq: 900, q: 2, vol: 0.2, pos }); break;
      case 'reel':
        for (let i = 0; i < 10; i++) this.tone(3000, 0.015, { type: 'square', vol: 0.03, pos, delay: i * 0.03 }); break;
      case 'coin':
        this.tone(1800, 0.08, { type: 'square', vol: 0.05 }); this.tone(2400, 0.12, { type: 'square', vol: 0.05, delay: 0.06 }); break;
      case 'jackpot':
        for (let i = 0; i < 16; i++) this.tone(1200 + (i % 4) * 300, 0.08, { type: 'square', vol: 0.05, delay: i * 0.07 }); break;
      case 'thunder':
        this.burst(3.5, { freq: 200, q: 0.5, vol: 0.8, brown: true, attack: 0.05, delay: rand(0.3, 2), type: 'lowpass' }); break;
      case 'mosquitoSlap':
        this.play('slap', pos); break;
      case 'zip':
        this.burst(0.25, { freq: 3000, q: 4, vol: 0.12, pos, sweep: 1.5 }); break;
      case 'pour':
        this.burst(1.2 * k, { freq: 900, q: 3, vol: 0.15, pos, sweep: 1.3, attack: 0.05 }); break;
      case 'lighter':
        this.burst(0.05, { freq: 4000, q: 2, vol: 0.2, pos }); this.burst(0.6, { freq: 600, q: 0.6, vol: 0.12, pos, delay: 0.05, brown: true }); break;
      case 'siren':
        for (let i = 0; i < 4; i++) { this.tone(700, 0.45, { type: 'square', vol: 0.06, pos, delay: i * 0.9 }); this.tone(950, 0.45, { type: 'square', vol: 0.06, pos, delay: i * 0.9 + 0.45 }); } break;
      case 'moose':
        this.tone(160, 1.0, { type: 'sawtooth', vol: 0.15, pos, slide: 0.6, attack: 0.1 }); break;
      case 'hey':
        this.tone(rand(140, 220), 0.25, { type: 'sawtooth', vol: 0.06, pos, slide: 1.2 }); break;
    }
  }

  // Gibberish speech murmurs for NPC lines
  speak(pos, pitch = 1, n = 6) {
    if (!this.ctx) return;
    const c = this.ctx;
    for (let i = 0; i < n; i++) {
      const t0 = this.t + i * 0.11 + rand(0, 0.04);
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(rand(95, 150) * pitch, t0);
      o.frequency.linearRampToValueAtTime(rand(90, 160) * pitch, t0 + 0.1);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rand(500, 1400); f.Q.value = 3;
      const g = c.createGain(); this.env(g, 0.01, 0.09, 0.09, t0);
      o.connect(f).connect(g).connect(this.out(pos, 2, 40)); o.start(t0); o.stop(t0 + 0.15);
    }
  }

  // ----------------------------------------------------------------- loops
  loop(kind, pos = null) {
    if (!this.ctx) return null;
    const c = this.ctx;
    const node = this.out(pos, 3, 80);
    const g = c.createGain(); g.gain.value = 0; g.connect(node);
    const L = { kind, g, out: node, nodes: [], set: () => {}, stop: () => {
      g.gain.setTargetAtTime(0, this.t, 0.05);
      setTimeout(() => { L.nodes.forEach((n) => { try { n.stop(); } catch (e) {} }); try { node.disconnect(); } catch (e) {} }, 300);
      this.loops.delete(L);
    } };
    if (kind === 'fire') {
      const n = this.noise(); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.5;
      const n2 = this.noise(true); const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 300;
      n.connect(f).connect(g); n2.connect(f2).connect(g); n.start(); n2.start(); L.nodes.push(n, n2);
      L.crackle = setInterval(() => { if (L.vol > 0.05 && Math.random() < 0.6) this.burst(0.02, { freq: rand(2000, 5000), q: 2, vol: 0.15 * L.vol, pos }); }, 90);
      const oldStop = L.stop; L.stop = () => { clearInterval(L.crackle); oldStop(); };
      L.set = (v) => { L.vol = v; g.gain.setTargetAtTime(v * 0.08, this.t, 0.2); };
    } else if (kind === 'starter') {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 90;
      const lfo = c.createOscillator(); lfo.frequency.value = 9; const lg = c.createGain(); lg.gain.value = 25; lfo.connect(lg).connect(o.frequency);
      const am = c.createGain(); const lfo2 = c.createOscillator(); lfo2.frequency.value = 9; const lg2 = c.createGain(); lg2.gain.value = 0.5; lfo2.connect(lg2).connect(am.gain); am.gain.value = 0.5;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      o.connect(f).connect(am).connect(g); o.start(); lfo.start(); lfo2.start(); L.nodes.push(o, lfo, lfo2);
      L.set = (v, weak = 1) => { g.gain.setTargetAtTime(v * 0.25, this.t, 0.03); lfo.frequency.value = lfo2.frequency.value = 5 + 5 * weak; };
    } else if (kind === 'siren') {
      const o = c.createOscillator(); o.type = 'square';
      const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 1.1; const lg = c.createGain(); lg.gain.value = 130; lfo.connect(lg).connect(o.frequency); o.frequency.value = 820;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2500;
      o.connect(f).connect(g); o.start(); lfo.start(); L.nodes.push(o, lfo);
      L.set = (v) => g.gain.setTargetAtTime(v * 0.08, this.t, 0.1);
    } else if (kind === 'mosquito') {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 620;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.7; const lg = c.createGain(); lg.gain.value = 40; lfo.connect(lg).connect(o.frequency);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 2;
      o.connect(f).connect(g); o.start(); lfo.start(); L.nodes.push(o, lfo);
      L.set = (v) => g.gain.setTargetAtTime(v * 0.03, this.t, 0.1);
    } else if (kind === 'skid') {
      const n = this.noise(); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 3;
      n.connect(f).connect(g); n.start(); L.nodes.push(n);
      L.set = (v, surf = 0) => { g.gain.setTargetAtTime(v * (surf ? 0.15 : 0.12), this.t, 0.05); f.frequency.value = surf ? 500 : 900; f.Q.value = surf ? 0.8 : 3; };
    } else if (kind === 'stream') {
      const n = this.noise(); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2;
      n.connect(f).connect(g); n.start(); L.nodes.push(n);
      L.set = (v) => g.gain.setTargetAtTime(v * 0.1, this.t, 0.05);
    } else if (kind === 'rolling') {
      const n = this.noise(true); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      const n2 = this.noise(); const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2500; f2.Q.value = 0.6;
      const g2 = c.createGain(); g2.gain.value = 0;
      n.connect(f).connect(g); n2.connect(f2).connect(g2).connect(g); n.start(); n2.start(); L.nodes.push(n, n2);
      L.set = (v, gravel = 0) => { g.gain.setTargetAtTime(v * 0.25, this.t, 0.1); g2.gain.setTargetAtTime(gravel * 0.6, this.t, 0.1); f.frequency.value = 200 + v * 500; };
    }
    this.loops.add(L);
    return L;
  }

  // Engine sound: several harmonics + noise; returns controller
  engine(pos, profile = {}) {
    if (!this.ctx) return null;
    const c = this.ctx;
    const out = this.out(pos, profile.ref || 5, 200);
    const master = c.createGain(); master.gain.value = 0; master.connect(out);
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * (profile.drive || 2.5)); }
    shaper.curve = curve;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200; lp.Q.value = 1.5;
    const body = c.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = profile.bodyFreq || 180; body.gain.value = 8; body.Q.value = 1;
    shaper.connect(body).connect(lp).connect(master);
    const oscs = [];
    const harm = profile.harmonics || [[1, 0.5, 'sawtooth'], [0.5, 0.35, 'square'], [2, 0.18, 'sawtooth'], [1.5, 0.08, 'triangle'], [3, 0.05, 'sawtooth']];
    for (const [mul, vol, type] of harm) {
      const o = c.createOscillator(); o.type = type; const g = c.createGain(); g.gain.value = vol;
      o.connect(g).connect(shaper); o.start(); oscs.push({ o, mul, g, vol });
    }
    // Combustion noise with AM at firing frequency
    const n = this.noise(); const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 600; nf.Q.value = 0.7;
    const ng = c.createGain(); ng.gain.value = 0.15; n.connect(nf).connect(ng).connect(shaper); n.start();
    // Intake / turbo whistle
    const wh = c.createOscillator(); wh.type = 'sine'; const whg = c.createGain(); whg.gain.value = 0; wh.connect(whg).connect(master); wh.start();
    const E = {
      cyl: profile.cylinders || 4,
      set: (rpm, throttle, load, vol = 1, exhaust = 0, turbo = 0, misfire = 0) => {
        const t = this.t;
        const fire = (rpm / 60) * (E.cyl / 2);
        const jitter = misfire > 0 && Math.random() < misfire ? 0.6 : 1;
        for (const h of oscs) { h.o.frequency.setTargetAtTime(Math.max(8, fire * h.mul * jitter), t, 0.015); }
        lp.frequency.setTargetAtTime(500 + rpm * 0.35 + throttle * 1800 + exhaust * 1200, t, 0.03);
        body.gain.value = 6 + exhaust * 6;
        nf.frequency.setTargetAtTime(400 + rpm * 0.15, t, 0.05);
        ng.gain.setTargetAtTime(0.08 + throttle * 0.25 + exhaust * 0.1, t, 0.05);
        const v = rpm < 50 ? 0 : (0.22 + throttle * 0.35 + load * 0.1 + exhaust * 0.15) * vol * (misfire > 0 && Math.random() < misfire * 0.5 ? 0.3 : 1);
        master.gain.setTargetAtTime(v, t, 0.03);
        wh.frequency.setTargetAtTime(2000 + rpm * 0.8, t, 0.05);
        whg.gain.setTargetAtTime(turbo * 0.02 * vol, t, 0.05);
      },
      setPos: (p) => this.setPos(out, p),
      stop: () => {
        master.gain.setTargetAtTime(0, this.t, 0.05);
        setTimeout(() => { oscs.forEach((h) => h.o.stop()); n.stop(); wh.stop(); try { out.disconnect(); } catch (e) {} }, 300);
      },
    };
    return E;
  }

  // ----------------------------------------------------------------- ambience
  startAmbience() {
    const c = this.ctx;
    // wind
    const wn = this.noise(true); const wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 500;
    this.windGain = c.createGain(); this.windGain.gain.value = 0.15;
    wn.connect(wf).connect(this.windGain).connect(this.ambient); wn.start();
    this.windFilter = wf;
    // leaves rustle
    const ln = this.noise(); const lf = c.createBiquadFilter(); lf.type = 'highpass'; lf.frequency.value = 3000;
    this.leafGain = c.createGain(); this.leafGain.gain.value = 0.02; ln.connect(lf).connect(this.leafGain).connect(this.ambient); ln.start();
    // rain
    const rn = this.noise(); const rf = c.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 800;
    this.rainGain = c.createGain(); this.rainGain.gain.value = 0; rn.connect(rf).connect(this.rainGain).connect(this.ambient); rn.start();
    // water lapping
    const wan = this.noise(true); const waf = c.createBiquadFilter(); waf.type = 'bandpass'; waf.frequency.value = 350; waf.Q.value = 0.8;
    this.waterGain = c.createGain(); this.waterGain.gain.value = 0; wan.connect(waf).connect(this.waterGain).connect(this.ambient); wan.start();
    // crickets
    this.cricketGain = c.createGain(); this.cricketGain.gain.value = 0; this.cricketGain.connect(this.ambient);
    const co = c.createOscillator(); co.frequency.value = 4400; const cam = c.createGain(); cam.gain.value = 0;
    const clfo = c.createOscillator(); clfo.type = 'square'; clfo.frequency.value = 28; const clg = c.createGain(); clg.gain.value = 0.5;
    clfo.connect(clg).connect(cam.gain); co.connect(cam).connect(this.cricketGain); co.start(); clfo.start();
    this.amb = { day: 1, wind: 0.3, rain: 0, water: 0, indoor: 0, forest: 0.5 };
    this.birdTimer = 0;
  }

  updateAmbience(dt, { daylight = 1, wind = 0.3, rain = 0, water = 0, indoor = 0, forest = 0.5, inCar = false }) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.t, ind = 1 - indoor * 0.75;
    this.windGain.gain.setTargetAtTime((0.05 + wind * 0.25) * ind * (inCar ? 0.4 : 1), t, 0.5);
    this.windFilter.frequency.setTargetAtTime(300 + wind * 700 + Math.sin(t * 0.3) * 150, t, 0.5);
    this.leafGain.gain.setTargetAtTime(forest * wind * 0.05 * ind, t, 0.5);
    this.rainGain.gain.setTargetAtTime(rain * 0.18 * (indoor ? 0.5 : 1), t, 0.5);
    this.waterGain.gain.setTargetAtTime(water * 0.25 * ind * (0.6 + 0.4 * Math.sin(t * 0.7)), t, 0.3);
    const night = 1 - daylight;
    this.cricketGain.gain.setTargetAtTime(night * 0.012 * ind * (rain > 0.3 ? 0 : 1), t, 1);
    // birds
    this.birdTimer -= dt;
    if (this.birdTimer < 0) {
      this.birdTimer = rand(0.6, 4) / Math.max(0.2, daylight);
      if (daylight > 0.3 && rain < 0.4 && Math.random() < 0.8 * ind) this.bird(forest);
    }
  }

  bird(forest) {
    const c = this.ctx;
    const pan = c.createStereoPanner(); pan.pan.value = rand(-0.9, 0.9); pan.connect(this.ambient);
    const kind = Math.floor(Math.random() * 5);
    const base = [3200, 4200, 2600, 5200, 1800][kind];
    const notes = [3, 6, 2, 8, 2][kind] + Math.floor(Math.random() * 3);
    const vol = rand(0.01, 0.04) * (0.5 + forest);
    for (let i = 0; i < notes; i++) {
      const t0 = this.t + i * [0.12, 0.07, 0.3, 0.05, 0.4][kind];
      const o = c.createOscillator(); o.type = 'sine';
      const f0 = base * rand(0.85, 1.15);
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(f0 * [1.4, 0.7, 1.1, 1.6, 0.8][kind], t0 + 0.06);
      if (kind === 4) o.frequency.exponentialRampToValueAtTime(f0 * 0.75, t0 + 0.25); // cuckoo-ish
      const g = c.createGain(); this.env(g, 0.005, vol, kind === 4 ? 0.3 : 0.07, t0);
      o.connect(g).connect(pan); o.start(t0); o.stop(t0 + 0.4);
    }
  }
}

export const audio = new Audio();
