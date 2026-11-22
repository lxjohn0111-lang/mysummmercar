import * as THREE from 'three';
import { tex, pbr } from '../core/assets.js';

// Shared materials, created lazily
const M = {};
export function mats() {
  if (M.ready) return M;
  M.ready = true;
  M.redBoards = pbr('planks_red', { roughness: 0.85 });
  M.yellowBoards = pbr('planks_yellow', { roughness: 0.85 });
  M.rawPlanks = pbr('planks_raw', { roughness: 0.8 });
  M.darkPlanks = pbr('planks_dark', { roughness: 0.85 });
  M.floorPlanks = pbr('planks_raw', { roughness: 0.6, color: 0xc89a70 });
  M.concrete = pbr('concrete', { roughness: 0.9 });
  M.roof = pbr('roof', { roughness: 0.6, metalness: 0.4 });
  M.redRoof = pbr('roof', { roughness: 0.6, metalness: 0.3, color: 0xa83a2a, key: 'red' });
  M.shingles = pbr('shingles', { roughness: 0.9 });
  M.white = new THREE.MeshStandardMaterial({ color: 0xece8e0, roughness: 0.6 });
  M.whitePaint = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.45 });
  M.wallpaper = new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 0.9, map: wallpaperTex() });
  M.plaster = new THREE.MeshStandardMaterial({ color: 0xe0dcd0, roughness: 0.95 });
  M.glass = new THREE.MeshStandardMaterial({ color: 0x223038, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
  M.glassDark = new THREE.MeshStandardMaterial({ color: 0x0c1418, roughness: 0.08, metalness: 0.3, emissive: 0x000000 });
  M.windowLit = new THREE.MeshStandardMaterial({ color: 0x0c1418, roughness: 0.1, metalness: 0.3, emissive: 0xffb860, emissiveIntensity: 0 });
  M.metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.9 });
  M.darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.5, metalness: 0.8 });
  M.chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 1.0 });
  M.rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  M.blackPlastic = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  M.redPaint = new THREE.MeshStandardMaterial({ color: 0xb02018, roughness: 0.5, metalness: 0.2 });
  M.bluePaint = new THREE.MeshStandardMaterial({ color: 0x1e4a8a, roughness: 0.5, metalness: 0.2 });
  M.greenPaint = new THREE.MeshStandardMaterial({ color: 0x2a5a2a, roughness: 0.5, metalness: 0.2 });
  M.yellowPaint = new THREE.MeshStandardMaterial({ color: 0xe8b818, roughness: 0.5, metalness: 0.2 });
  M.orangePaint = new THREE.MeshStandardMaterial({ color: 0xd86018, roughness: 0.5, metalness: 0.2 });
  M.wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.7, map: tex('planks_raw.jpg') });
  M.darkWood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.6, map: tex('planks_raw.jpg') });
  M.fabric = new THREE.MeshStandardMaterial({ map: tex('fabric.jpg'), normalMap: tex('fabric_n.jpg', { srgb: false }), roughness: 0.95 });
  M.fabricBlue = new THREE.MeshStandardMaterial({ color: 0x6a86b8, roughness: 0.95, map: tex('fabric.jpg') });
  M.vinyl = new THREE.MeshStandardMaterial({ map: tex('vinyl.jpg'), normalMap: tex('vinyl_n.jpg', { srgb: false }), roughness: 0.55 });
  M.stone = new THREE.MeshStandardMaterial({ map: tex('rock.jpg'), normalMap: tex('rock_n.jpg', { srgb: false }), roughness: 0.9 });
  M.cast = new THREE.MeshStandardMaterial({ map: tex('cast.jpg'), normalMap: tex('cast_n.jpg', { srgb: false }), roughness: 0.6, metalness: 0.6 });
  M.lampOn = new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffd8a0, emissiveIntensity: 2 });
  M.hay = new THREE.MeshStandardMaterial({ color: 0xd8c070, roughness: 1, map: tex('grass.jpg') });
  M.dirt = new THREE.MeshStandardMaterial({ map: tex('dirt.jpg'), roughness: 1 });
  M.gravel = new THREE.MeshStandardMaterial({ map: tex('gravel.jpg'), roughness: 1 });
  M.hidden = new THREE.MeshBasicMaterial({ visible: false });
  return M;
}

function wallpaperTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#d9cba6'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#c4a878';
  for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) {
    g.beginPath(); g.ellipse(x + 16 + (y % 64 ? 16 : 0), y + 16, 5, 9, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#b89868'; for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 1, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  return t;
}

// Box geometry with world-scale UVs (1 texture repeat per `scale` metres)
export function boxUV(w, h, d, scale = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, n = g.attributes.normal, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    let u, v;
    if (nx > 0.5) { u = p.getZ(i); v = p.getY(i); }
    else if (ny > 0.5) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv.setXY(i, u / scale, v / scale);
  }
  return g;
}
