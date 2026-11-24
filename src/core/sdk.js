// CrazyGames SDK v3 wrapper. Works without the SDK (local dev / blocked script) by falling back to no-ops + localStorage.
const LS_PREFIX = 'kesakaara:'; // old internal name kept so existing saves still load

class CrazySDK {
  constructor() {
    this.sdk = null;
    this.ready = false;
    this.env = 'none';
    this.adPlaying = false;
    this.gameplayActive = false;
    this.lastMidgame = 0;
    this.listeners = { adStart: [], adEnd: [], settings: [] };
    this.muteAudio = false;
  }

  async init() {
    try {
      const w = window;
      if (!w.CrazyGames || !w.CrazyGames.SDK) {
        // The script tag may still be loading; wait a little.
        await new Promise((r) => setTimeout(r, 400));
      }
      if (w.CrazyGames && w.CrazyGames.SDK) {
        this.sdk = w.CrazyGames.SDK;
        await Promise.race([this.sdk.init(), new Promise((_, rej) => setTimeout(() => rej(new Error('sdk init timeout')), 6000))]);
        this.env = this.sdk.environment || 'unknown';
        this.ready = this.env !== 'disabled';
        try {
          const s = this.sdk.game.settings;
          if (s) this.muteAudio = !!s.muteAudio;
          this.sdk.game.addSettingsChangeListener((ns) => {
            this.muteAudio = !!ns.muteAudio;
            this.listeners.settings.forEach((f) => f(ns));
          });
        } catch (e) { /* settings optional */ }
      }
    } catch (e) {
      console.warn('[SDK] unavailable, running standalone:', e.message);
      this.sdk = null; this.ready = false;
    }
    console.log('[SDK] environment:', this.env, 'ready:', this.ready);
    return this.ready;
  }

  on(ev, fn) { this.listeners[ev]?.push(fn); }

  loadingStart() { try { this.ready && this.sdk.game.loadingStart(); } catch (e) {} }
  loadingStop() { try { this.ready && this.sdk.game.loadingStop(); } catch (e) {} }

  gameplayStart() {
    if (this.gameplayActive) return;
    this.gameplayActive = true;
    try { this.ready && this.sdk.game.gameplayStart(); } catch (e) {}
  }
  gameplayStop() {
    if (!this.gameplayActive) return;
    this.gameplayActive = false;
    try { this.ready && this.sdk.game.gameplayStop(); } catch (e) {}
  }
  happytime() { try { this.ready && this.sdk.game.happytime(); } catch (e) {} }

  // type: 'midgame' | 'rewarded'. Resolves true if the ad completed (rewarded => grant reward).
  requestAd(type = 'midgame') {
    return new Promise((resolve) => {
      if (!this.ready) {
        // Standalone: midgame silently skipped; rewarded granted so the feature remains testable offline.
        resolve(type === 'rewarded');
        return;
      }
      if (type === 'midgame' && performance.now() - this.lastMidgame < 3 * 60 * 1000) { resolve(false); return; }
      const wasActive = this.gameplayActive;
      const done = (ok) => {
        this.adPlaying = false;
        this.listeners.adEnd.forEach((f) => f());
        if (wasActive) this.gameplayStart();
        resolve(ok);
      };
      try {
        this.sdk.ad.requestAd(type, {
          adStarted: () => {
            this.adPlaying = true;
            this.gameplayStop();
            this.listeners.adStart.forEach((f) => f());
          },
          adFinished: () => { if (type === 'midgame') this.lastMidgame = performance.now(); done(true); },
          adError: (err) => { console.warn('[SDK] ad error', err); done(false); },
        });
      } catch (e) { done(false); }
    });
  }

  // Persistent data (CrazyGames data module syncs to the cloud for logged in users; falls back to localStorage).
  setItem(key, value) {
    try { if (this.ready && this.sdk.data) { this.sdk.data.setItem(key, value); return; } } catch (e) {}
    try { localStorage.setItem(LS_PREFIX + key, value); } catch (e) {}
  }
  getItem(key) {
    try { if (this.ready && this.sdk.data) return this.sdk.data.getItem(key); } catch (e) {}
    try { return localStorage.getItem(LS_PREFIX + key); } catch (e) { return null; }
  }
  removeItem(key) {
    try { if (this.ready && this.sdk.data) { this.sdk.data.removeItem(key); return; } } catch (e) {}
    try { localStorage.removeItem(LS_PREFIX + key); } catch (e) {}
  }
}

export const SDK = new CrazySDK();
