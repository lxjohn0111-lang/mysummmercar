// Tiny tween system for doors, lids, handsets and other moving prop parts.
// tween(obj, 'rotation.x', 1.2, 0.4) animates obj.rotation.x to 1.2 in 0.4 s.
const list = [];
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function resolve(obj, path) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  return [o, keys[keys.length - 1]];
}

export function tween(obj, path, to, dur = 0.35, { delay = 0, onDone = null, easing = ease } = {}) {
  const [o, k] = resolve(obj, path);
  // replace a running tween on the same property
  for (let i = list.length - 1; i >= 0; i--) if (list[i].o === o && list[i].k === k) list.splice(i, 1);
  list.push({ o, k, from: o[k], to, dur: Math.max(0.001, dur), t: -delay, onDone, easing });
}

export function updateTweens(dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const tw = list[i];
    tw.t += dt;
    if (tw.t < 0) continue;
    const f = Math.min(1, tw.t / tw.dur);
    tw.o[tw.k] = tw.from + (tw.to - tw.from) * tw.easing(f);
    if (f >= 1) { list.splice(i, 1); tw.onDone && tw.onDone(); }
  }
}

// run fn after `sec` seconds of game time (pauses with the game)
const timers = [];
export function after(sec, fn) { timers.push({ t: sec, fn }); }
export function updateTimers(dt) {
  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } }
}
