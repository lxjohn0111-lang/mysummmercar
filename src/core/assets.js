import * as THREE from 'three';
import { IS_MOBILE } from './device.js';

// phones: shrink big textures once loaded (less memory, faster uploads)
const MAX_TEX = IS_MOBILE ? 512 : 4096;
function shrink(t) {
  const img = t.image;
  if (!img || !img.width || Math.max(img.width, img.height) <= MAX_TEX) return;
  const k = MAX_TEX / Math.max(img.width, img.height);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  t.image = c; t.needsUpdate = true;
}

const loader = new THREE.TextureLoader();
const cache = new Map();
let maxAniso = 8;
let pending = 0, done = 0;
export const progress = { get total() { return pending; }, get loaded() { return done; } };

export function setMaxAnisotropy(a) { maxAniso = a; }

export function tex(name, { srgb = true, repeat = [1, 1], wrap = true } = {}) {
  const key = name + (srgb ? ':s' : ':l');
  let t = cache.get(key);
  if (!t) {
    pending++;
    t = loader.load(`./textures/${name}`, (tt) => { try { shrink(tt); } catch (e) {} done++; }, undefined, () => { done++; console.warn('texture failed', name); });
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = IS_MOBILE ? 2 : maxAniso;
    cache.set(key, t);
  }
  if (repeat[0] !== 1 || repeat[1] !== 1) {
    const c = t.clone(); c.repeat.set(repeat[0], repeat[1]); c.needsUpdate = true; return c;
  }
  return t;
}

// Convenience: PBR material from a texture set name (albedo + _n normal)
const matCache = new Map();
export function pbr(name, { repeat = [1, 1], color = 0xffffff, roughness = 0.85, metalness = 0, normalScale = 1, side = THREE.FrontSide, key = '' } = {}) {
  const k = `${name}|${repeat}|${color}|${roughness}|${metalness}|${normalScale}|${side}|${key}`;
  if (matCache.has(k)) return matCache.get(k);
  const m = new THREE.MeshStandardMaterial({
    map: tex(`${name}.jpg`, { repeat }),
    normalMap: tex(`${name}_n.jpg`, { srgb: false, repeat }),
    color, roughness, metalness, side,
  });
  m.normalScale.set(normalScale, normalScale);
  matCache.set(k, m);
  return m;
}

export function waitTextures(onProgress) {
  return new Promise((resolve) => {
    const tick = () => {
      onProgress && onProgress(done, pending);
      if (done >= pending) resolve(); else setTimeout(tick, 50);
    };
    tick();
  });
}
