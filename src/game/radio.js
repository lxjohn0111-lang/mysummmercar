import { audio } from '../core/audio.js';
import { mulberry32 } from '../core/noise.js';

// Procedurally composed radio music (all original, generated at runtime): humppa/schlager & a rock station.
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };

export class Radio {
  constructor(game) {
    this.game = game;
    this.on = false;
    this.station = 0;
    this.stations = ['Radio Kurki 94.5 — humppa & iskelmä', 'Kanava Rautala 101.2 — rock', 'Yle-ish News 88.1'];
    this.nextTime = 0;
    this.beat = 0;
    this.song = null;
    this.out = null;
    this.vol = 0.5;
    this.garageOn = false;
    this.source = null; // 'car' | 'garage'
    this.newsTimer = 0;
  }

  ensureOut() {
    if (!audio.ctx) return null;
    if (!this.out) {
      const c = audio.ctx;
      this.out = c.createGain(); this.out.gain.value = 0;
      this.filter = c.createBiquadFilter(); this.filter.type = 'bandpass'; this.filter.frequency.value = 1400; this.filter.Q.value = 0.35;
      this.panner = c.createPanner(); this.panner.panningModel = 'equalpower'; this.panner.distanceModel = 'inverse'; this.panner.refDistance = 3; this.panner.rolloffFactor = 1.4;
      this.out.connect(this.filter).connect(this.panner).connect(audio.music);
    }
    return this.out;
  }

  setPlaying(on, source = 'car') {
    this.on = on; this.source = source;
    if (!this.ensureOut()) return;
    this.out.gain.setTargetAtTime(on ? this.vol : 0, audio.t, 0.1);
    if (on) { this.nextTime = audio.t + 0.1; this.newSong(); this.game.ui.toast(`📻 ${this.stations[this.station]}`, 3); }
  }
  nextStation() {
    this.station = (this.station + 1) % this.stations.length;
    this.newSong();
    this.game.ui.toast(`📻 ${this.stations[this.station]}`, 3);
    audio.play('click');
  }

  newSong() {
    const rnd = mulberry32(Math.floor(Math.random() * 1e9));
    const rock = this.station === 1;
    const key = 52 + Math.floor(rnd() * 8);
    const mode = rock ? (rnd() < 0.5 ? 'minor' : 'major') : (rnd() < 0.7 ? 'minor' : 'major');
    const tempo = rock ? 118 + rnd() * 30 : 150 + rnd() * 40;
    // chord progression (scale degrees)
    const progs = mode === 'minor' ? [[0, 3, 4, 0], [0, 5, 3, 4], [0, 3, 6, 4], [0, 4, 0, 3]] : [[0, 3, 4, 0], [0, 5, 3, 4], [0, 4, 5, 3]];
    const prog = progs[Math.floor(rnd() * progs.length)];
    // melody phrase (2 bars of eighths), reused with variations
    const phrase = [];
    let deg = 4 + Math.floor(rnd() * 3);
    for (let i = 0; i < 16; i++) {
      if (rnd() < 0.3) phrase.push(null);
      else { deg += Math.floor(rnd() * 5) - 2; deg = Math.max(0, Math.min(11, deg)); phrase.push(deg); }
    }
    const phrase2 = phrase.map((d) => (d === null ? null : d + (rnd() < 0.3 ? 1 : 0)));
    this.song = { key, mode, tempo, prog, phrase, phrase2, rock, bars: 32 + Math.floor(rnd() * 16), bar: 0, rnd };
    this.beat = 0;
  }

  update(dt) {
    const g = this.game;
    // source position: car or garage
    let pos = null;
    const v = g.player.inVehicle;
    const carHasRadio = v && (v.isBuildCar ? !!v.slots.radio && v.electricsOk() : v.kind === 'van' || v.kind === 'tractor');
    if (this.source === 'car') {
      if (!v || !carHasRadio) { if (this.on) this.setPlaying(false); return; }
      pos = v.pos;
    } else if (this.source === 'garage') pos = g.spots.garageRadio;
    if (!this.on || !audio.ctx || audio.ctx.state !== 'running') return;
    if (pos && this.panner) { const p = this.panner; if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } }
    if (this.station === 2) return this.newsTick(dt, pos);
    // schedule ahead
    const ctx = audio.ctx;
    // never try to "catch up" on minutes of missed beats (tab in background, ads): skip ahead instead
    if (!(this.nextTime > ctx.currentTime - 0.5)) this.nextTime = ctx.currentTime + 0.05;
    let guard = 0;
    while (this.nextTime < ctx.currentTime + 0.25 && guard++ < 24) {
      this.playBeat(this.nextTime);
      this.nextTime += 60 / this.song.tempo / 2; // eighth notes
      this.beat++;
      if (this.beat % 8 === 0) { this.song.bar++; if (this.song.bar >= this.song.bars) { this.newSong(); this.nextTime += 1.2; } }
    }
  }

  playBeat(t) {
    const s = this.song, c = audio.ctx;
    const scale = SCALES[s.mode];
    const bar = s.bar, e = this.beat % 8;
    const chordDeg = s.prog[Math.floor(bar / 2) % s.prog.length];
    const deg = (d) => s.key + scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const root = deg(chordDeg);
    const third = deg(chordDeg + 2), fifth = deg(chordDeg + 4);
    if (!s.rock) {
      // humppa: bass on 1 & 3 (eighths 0 and 4), chord stabs on offbeats
      if (e === 0) this.note(t, NOTE(root - 24), 0.2, 'triangle', 0.5);
      if (e === 4) this.note(t, NOTE(fifth - 24), 0.2, 'triangle', 0.45);
      if (e % 2 === 1 || e === 2 || e === 6) { if (e % 4 === 2) for (const n of [root, third, fifth]) this.note(t, NOTE(n), 0.09, 'square', 0.05, true); }
      if (e % 2 === 0) this.drum(t, e % 4 === 0 ? 'kick' : 'snare');
      else this.drum(t, 'hat');
    } else {
      if (e % 2 === 0) this.note(t, NOTE(root - 24), 0.18, 'sawtooth', 0.22);
      for (const n of [root - 12, fifth - 12]) this.note(t, NOTE(n), 0.12, 'sawtooth', 0.04, true, true);
      if (e === 0 || e === 3 || e === 5) this.drum(t, 'kick');
      if (e === 2 || e === 6) this.drum(t, 'snare');
      this.drum(t, 'hat');
    }
    // melody (accordion-ish lead)
    const ph = Math.floor(bar / 2) % 4 === 3 ? s.phrase2 : s.phrase;
    const md = ph[(bar % 2) * 8 + e];
    if (md !== null && md !== undefined) this.note(t, NOTE(deg(md) + 12), 0.16, s.rock ? 'sawtooth' : 'square', s.rock ? 0.05 : 0.07, true, s.rock, !s.rock);
  }

  note(t, f, dur, type, vol, filt = false, dist = false, vib = false) {
    const c = audio.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (vib) { const l = c.createOscillator(); l.frequency.value = 6; const lg = c.createGain(); lg.gain.value = f * 0.008; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); const o2 = c.createOscillator(); o2.type = type; o2.frequency.value = f * 1.004; o2.connect(g); o2.start(t); o2.stop(t + dur + 0.05); }
    if (filt) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = dist ? 2400 : 3200; node.connect(fl); node = fl; }
    node.connect(g).connect(this.out);
    o.start(t); o.stop(t + dur + 0.05);
  }
  drum(t, kind) {
    const c = audio.ctx;
    if (kind === 'kick') {
      const o = c.createOscillator(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      const g = c.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(g).connect(this.out); o.start(t); o.stop(t + 0.2);
    } else {
      const n = c.createBufferSource(); n.buffer = audio.noiseBuf;
      const f = c.createBiquadFilter(); f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
      const g = c.createGain(); const d = kind === 'hat' ? 0.03 : 0.12;
      g.gain.setValueAtTime(kind === 'hat' ? 0.08 : 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      n.connect(f).connect(g).connect(this.out); n.start(t, Math.random()); n.stop(t + d + 0.02);
    }
  }
  newsTick(dt, pos) {
    this.newsTimer -= dt;
    if (this.newsTimer <= 0) {
      this.newsTimer = 2.5 + Math.random() * 2;
      // murmur through the radio channel
      const c = audio.ctx;
      for (let i = 0; i < 14; i++) {
        const t0 = audio.t + i * 0.12;
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(100 + Math.random() * 40, t0);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600 + Math.random() * 900; f.Q.value = 3;
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
        o.connect(f).connect(g).connect(this.out); o.start(t0); o.stop(t0 + 0.12);
      }
      const news = ['Weather: sunny with a chance of mosquitoes.', 'A moose was spotted near the Rautala road. Drive carefully.', 'Saturday rally at the Kurki-Sprint stage, entry 150 marks.', 'Police remind drivers: speed limit near Rautala is 80.', 'Local man claims his car is "almost finished". Third summer running.', 'Sauna sausage prices remain stable.'];
      if (Math.random() < 0.35) this.game.ui.subtitle('Radio', news[Math.floor(Math.random() * news.length)], 4);
    }
  }
}
