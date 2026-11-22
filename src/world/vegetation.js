import * as THREE from 'three';
import { tex, pbr } from '../core/assets.js';
import { mergeGeos, xform } from '../core/util.js';
import { mulberry32, hash2, fbm2, perlin2, smoothstep } from '../core/noise.js';
import { MAP_SIZE, HALF, WATER_LEVEL, SITES, FIELDS, lakeD, forestMask } from './layout.js';

// ------------------------------------------------------------------ shared wind shader injection
export const windUniforms = { uTime: { value: 0 }, uWind: { value: 0.4 } };
function addWind(mat, strength = 1, isInstanced = true) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev && prev(sh, r);
    sh.uniforms.uTime = windUniforms.uTime; sh.uniforms.uWind = windUniforms.uWind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  vec4 wp0 = modelMatrix * ${isInstanced ? 'instanceMatrix *' : ''} vec4(position, 1.0);
  float hgt = max(0.0, position.y);
  float sway = (sin(uTime * 1.3 + wp0.x * 0.05 + wp0.z * 0.07) * 0.6 + sin(uTime * 2.7 + wp0.x * 0.3) * 0.25) * uWind * ${strength.toFixed(2)};
  float flutter = sin(uTime * 7.0 + position.x * 5.0 + position.z * 3.0) * 0.03 * uWind;
  transformed.x += sway * hgt * 0.015 + flutter * hgt * 0.1;
  transformed.z += sway * hgt * 0.01 + flutter * hgt * 0.1;
}`);
  };
  mat.customProgramCacheKey = () => 'wind' + strength + isInstanced;
}

// ------------------------------------------------------------------ tree builders
function cardGeo(w, h, anchorLeft = true) {
  const g = new THREE.PlaneGeometry(w, h);
  if (anchorLeft) g.translate(w / 2, 0, 0);
  return g;
}
function setFoliageNormals(g, cy, cyScale = 0.5) {
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), (p.getY(i) - cy) * cyScale + 0.6, p.getZ(i)).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
}
function trunkGeo(H, r0, r1, segs = 7, lean = 0) {
  const g = new THREE.CylinderGeometry(r1, r0, H, segs, 6, true);
  g.translate(0, H / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + lean * (y / H) * (y / H)); }
  // uv: wrap texture around ~ every 1.2m vertically
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * H / 2.5);
  g.computeVertexNormals();
  return g;
}

function buildSpruce(seed, lod) {
  const rnd = mulberry32(seed);
  const H = 15 + rnd() * 6, maxR = 2.4 + rnd() * 0.8, base = 1.0 + rnd() * 0.8;
  const trunk = trunkGeo(H, 0.26, 0.03, lod ? 5 : 8);
  const cards = [];
  const step = lod === 0 ? 0.42 : 1.05;
  let rot = rnd() * 6;
  for (let y = base; y < H - 0.4; y += step * (0.8 + rnd() * 0.4)) {
    const t = (y - base) / (H - base);
    const L = 0.35 + maxR * Math.pow(1 - t, 0.95) * (0.85 + rnd() * 0.3);
    const n = lod === 0 ? 5 + Math.floor(rnd() * 3) : 4;
    rot += 0.7 + rnd();
    for (let k = 0; k < n; k++) {
      const a = rot + k / n * Math.PI * 2 + (rnd() - 0.5) * 0.4;
      const droop = 0.18 + 0.35 * (1 - t) + rnd() * 0.15;
      const w = L * (lod ? 1.35 : 1.2), h = L * (lod ? 1.0 : 0.85);
      for (const tilt of lod ? [0.45, -0.7] : [0.25, -0.55, 1.2]) {
        let g = cardGeo(w, h);
        g.rotateX(Math.PI / 2 + tilt);
        g.rotateZ(-droop);
        g.rotateY(a);
        g.translate(0, y, 0);
        cards.push(g);
      }
    }
  }
  // top spike
  for (let k = 0; k < 3; k++) { const g = new THREE.PlaneGeometry(0.6, 1.6); g.rotateZ(Math.PI / 2); g.translate(0, H - 0.3, 0); g.rotateY(k * Math.PI / 3); cards.push(g); }
  const fol = mergeGeos(cards);
  setFoliageNormals(fol, H * 0.5, 0.35);
  return { trunk, fol, H, R: maxR + 0.4 };
}

function buildPine(seed, lod) {
  const rnd = mulberry32(seed);
  const H = 16 + rnd() * 6, crownStart = H * (0.55 + rnd() * 0.12);
  const lean = (rnd() - 0.5) * 0.8;
  const trunk = trunkGeo(H, 0.24, 0.05, lod ? 5 : 8, lean);
  const parts = [], limbs = [];
  const cards = lod === 0 ? 70 : 22;
  for (let i = 0; i < cards; i++) {
    const t = rnd();
    const y = crownStart + t * (H - crownStart) + 0.3;
    const rr = (1 - Math.abs(t - 0.4) * 1.2) * (2.2 + rnd() * 1.6);
    const a = rnd() * Math.PI * 2;
    const r = rr * Math.sqrt(rnd());
    const s = (lod ? 2.2 : 1.4) * (0.7 + rnd() * 0.6);
    const g = new THREE.PlaneGeometry(s, s);
    g.rotateX(-Math.PI / 2 + (rnd() - 0.5) * 0.9);
    g.rotateY(rnd() * Math.PI);
    g.translate(Math.cos(a) * r + lean * (y / H) ** 2, y, Math.sin(a) * r);
    parts.push(g);
    if (lod === 0 && i % 6 === 0) {
      const lg = new THREE.CylinderGeometry(0.025, 0.06, r + 0.2, 4, 1, true);
      lg.translate(0, (r + 0.2) / 2, 0); lg.rotateZ(-Math.PI / 2 + 0.3); lg.rotateY(-a);
      lg.translate(lean * (y / H) ** 2, y - 0.3, 0); limbs.push(lg);
    }
  }
  const fol = mergeGeos(parts);
  setFoliageNormals(fol, (crownStart + H) / 2, 0.6);
  const trunkAll = limbs.length ? mergeGeos([trunk, ...limbs]) : trunk;
  return { trunk: trunkAll, fol, H, R: 3.6 };
}

function buildBirch(seed, lod) {
  const rnd = mulberry32(seed);
  const H = 11 + rnd() * 5, crownStart = H * (0.3 + rnd() * 0.15);
  const lean = (rnd() - 0.5) * 1.2;
  const trunk = trunkGeo(H, 0.17, 0.03, lod ? 5 : 7, lean);
  const parts = [];
  const cards = lod === 0 ? 80 : 26;
  const cr = 2.2 + rnd() * 1.2;
  for (let i = 0; i < cards; i++) {
    const t = rnd();
    const y = crownStart + t * (H - crownStart);
    const prof = Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.1));
    const a = rnd() * Math.PI * 2, r = cr * prof * (0.4 + rnd() * 0.7);
    const s = (lod ? 2.6 : 1.7) * (0.7 + rnd() * 0.5);
    const g = new THREE.PlaneGeometry(s, s);
    g.translate(0, -s * 0.3, 0);
    g.rotateX((rnd() - 0.5) * 0.6);
    g.rotateY(-a + Math.PI / 2 + (rnd() - 0.5) * 1.2);
    g.translate(Math.cos(a) * r + lean * (y / H) ** 2, y, Math.sin(a) * r);
    parts.push(g);
  }
  const fol = mergeGeos(parts);
  setFoliageNormals(fol, (crownStart + H) / 2, 0.5);
  return { trunk, fol, H, R: cr + 1 };
}

const TYPES = [
  { name: 'spruce', build: buildSpruce, bark: 'bark_spruce', leaf: 'spruce_branch.png', color: 0xffffff, variants: [101, 202, 303] },
  { name: 'pine', build: buildPine, bark: 'bark_pine', leaf: 'pine_tuft.png', color: 0xffffff, variants: [404, 505] },
  { name: 'birch', build: buildBirch, bark: 'bark_birch', leaf: 'birch_leaves.png', color: 0xffffff, variants: [606, 707, 808] },
];

// ------------------------------------------------------------------ Vegetation system
export class Vegetation {
  constructor(game) {
    this.game = game;
    this.trees = null;
    this.lodTimer = 0;
    this.lastLodPos = new THREE.Vector3(1e9, 0, 0);
    this.colliderCells = new Map();
    this.lod0Dist = 75; this.lod1Dist = 230;
  }

  build() {
    const { scene, renderer } = this.game;
    this.makeTreeAssets(renderer);
    this.placeTrees();
    this.createInstances(scene);
    this.buildRocks(scene);
    this.buildGrass(scene);
    this.buildFlowers(scene);
    this.buildReeds(scene);
  }

  makeTreeAssets(renderer) {
    this.assets = [];
    for (const [ti, T] of TYPES.entries()) {
      const barkMat = new THREE.MeshStandardMaterial({ map: tex(`${T.bark}.jpg`), normalMap: tex(`${T.bark}_n.jpg`, { srgb: false }), roughness: 0.95 });
      const leafMat = new THREE.MeshStandardMaterial({ map: tex(T.leaf, { wrap: false }), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, color: T.color });
      leafMat.map.wrapS = leafMat.map.wrapT = THREE.ClampToEdgeWrapping;
      addWind(leafMat, ti === 2 ? 1.4 : 0.8);
      for (const seed of T.variants) {
        const l0 = T.build(seed, 0), l1 = T.build(seed, 1);
        const imp = this.captureImpostor(renderer, l0, barkMat, leafMat);
        this.assets.push({ type: ti, seed, l0, l1, barkMat, leafMat, imp });
      }
    }
  }

  captureImpostor(renderer, l, barkMat, leafMat) {
    const W = 256, Hh = 512;
    const rt = new THREE.WebGLRenderTarget(W, Hh, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    const sc = new THREE.Scene();
    const g = new THREE.Group();
    const bm = barkMat.clone(), lm = leafMat.clone(); lm.onBeforeCompile = () => {};
    g.add(new THREE.Mesh(l.trunk, bm), new THREE.Mesh(l.fol, lm));
    sc.add(g);
    sc.add(new THREE.AmbientLight(0xffffff, 2.2));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(0.3, 1, 1); sc.add(dl);
    const half = Math.max(l.R, l.H / 4);
    const cam = new THREE.OrthographicCamera(-half, half, l.H + 0.5, -0.5, 0.1, 100);
    const aspect = (2 * half) / (l.H + 1);
    cam.left = -(l.H + 1) * 0.25; cam.right = (l.H + 1) * 0.25; // fixed 1:2 aspect
    cam.position.set(0, 0, 50); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
    const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x2a3a20, 0); renderer.clear();
    renderer.render(sc, cam);
    // a side view too, rotated 90 degrees, blended into same texture is not needed: crossed quads reuse it
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClear, prevAlpha);
    renderer.toneMapping = tm;
    const w = (l.H + 1) * 0.5;
    const quads = [];
    for (const a of [0, Math.PI / 2]) {
      const q = new THREE.PlaneGeometry(w, l.H + 1); q.translate(0, (l.H + 1) / 2 - 0.5, 0); q.rotateY(a); quads.push(q);
    }
    const geo = mergeGeos(quads);
    setFoliageNormals(geo, l.H * 0.5, 0.4);
    const mat = new THREE.MeshStandardMaterial({ map: rt.texture, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
    return { geo, mat, rt };
  }

  placeTrees() {
    const T = this.game.terrain;
    const rnd = mulberry32(777);
    const xs = [], ys = [], zs = [], ss = [], rs = [], as = [];
    const step = 7.5;
    for (let gz = -HALF + step / 2; gz < HALF; gz += step) for (let gx = -HALF + step / 2; gx < HALF; gx += step) {
      const x = gx + (rnd() - 0.5) * step * 0.9, z = gz + (rnd() - 0.5) * step * 0.9;
      const fm = forestMask(x, z);
      let p = smoothstep(0.25, 0.75, fm) * 0.95;
      const ri = T.roadInfo(x, z);
      if (ri.d < 3.5) continue;
      const ld = lakeD(x, z);
      if (ld < 1.03) continue;
      if (T.inField(x, z)) continue;
      let nearSite = false;
      for (const s of SITES) { const d = Math.hypot(x - s.x, z - s.z); if (d < s.r + 6) { nearSite = true; break; } }
      if (nearSite) continue;
      // sparse trees in open areas, edges of roads get birches
      p = Math.max(p, 0.04 + smoothstep(14, 5, ri.d) * 0.2 * (fm > 0.1 ? 1 : 0.3));
      if (rnd() > p) continue;
      const h = T.getHeight(x, z);
      if (h < WATER_LEVEL + 0.4) continue;
      const nrm = T.getNormal(x, z);
      // choose type
      const decid = fbm2(x / 160, z / 160, 3, 333) + (ri.d < 25 ? 0.25 : 0) + (ld < 1.25 ? 0.3 : 0) + (fm < 0.4 ? 0.3 : 0);
      const pineP = smoothstep(26, 42, h) * 0.6 + (1 - nrm.y) * 3 + fbm2(x / 200, z / 200, 2, 334) * 0.4;
      let type = 0;
      if (decid > 0.35 && rnd() < 0.8) type = 2; else if (pineP > 0.3 && rnd() < 0.7) type = 1;
      const variants = this.assets.filter((a) => a.type === type);
      const asset = this.assets.indexOf(variants[Math.floor(rnd() * variants.length)]);
      let s = 0.75 + rnd() * 0.5;
      if (type === 0 && rnd() < 0.18) s = 0.12 + rnd() * 0.25; // saplings
      xs.push(x); ys.push(h - 0.15); zs.push(z); ss.push(s); rs.push(rnd() * Math.PI * 2); as.push(asset);
    }
    const n = xs.length;
    this.trees = { n, x: Float32Array.from(xs), y: Float32Array.from(ys), z: Float32Array.from(zs), s: Float32Array.from(ss), r: Float32Array.from(rs), a: Uint8Array.from(as) };
    // cell index for colliders
    this.cellSize = 64;
    this.cells = new Map();
    for (let i = 0; i < n; i++) {
      const k = `${Math.floor(xs[i] / this.cellSize)},${Math.floor(zs[i] / this.cellSize)}`;
      if (!this.cells.has(k)) this.cells.set(k, []);
      this.cells.get(k).push(i);
    }
    console.log('[veg] trees', n);
  }

  createInstances(scene) {
    const n = this.trees.n;
    const counts = this.assets.map(() => 0);
    for (let i = 0; i < n; i++) counts[this.trees.a[i]]++;
    this.inst = this.assets.map((A, ai) => {
      const max = counts[ai] + 1;
      const mk = (geo, mat, shadow) => {
        const m = new THREE.InstancedMesh(geo, mat, max);
        m.count = 0; m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(m); return m;
      };
      return {
        l0t: mk(A.l0.trunk, A.barkMat, true), l0f: mk(A.l0.fol, A.leafMat, true),
        l1t: mk(A.l1.trunk, A.barkMat, true), l1f: mk(A.l1.fol, A.leafMat, true),
        imp: mk(A.imp.geo, A.imp.mat, false),
      };
    });
    // per-instance tint
    this.tints = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = 0.8 + hash2(i, 3) * 0.35;
      this.tints[i * 3] = v * (0.95 + hash2(i, 4) * 0.1); this.tints[i * 3 + 1] = v; this.tints[i * 3 + 2] = v * (0.9 + hash2(i, 5) * 0.1);
    }
  }

  clearArea(x0, x1, z0, z1) {
    const t = this.trees;
    for (let i = 0; i < t.n; i++) if (t.x[i] > x0 && t.x[i] < x1 && t.z[i] > z0 && t.z[i] < z1) t.s[i] = 0;
    this.lastLodPos.set(1e9, 0, 0);
  }

  updateLOD(camPos, force = false) {
    if (!force && camPos.distanceToSquared(this.lastLodPos) < 64) return;
    this.lastLodPos.copy(camPos);
    const t = this.trees, m4 = _m4, q = _q, sv = _s, pv = _p, c = _c;
    for (const I of this.inst) { I.l0t.count = I.l0f.count = I.l1t.count = I.l1f.count = I.imp.count = 0; }
    const d0 = this.lod0Dist * this.lod0Dist, d1 = this.lod1Dist * this.lod1Dist, dMax = this.maxDist * this.maxDist;
    for (let i = 0; i < t.n; i++) {
      const dx = t.x[i] - camPos.x, dz = t.z[i] - camPos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > dMax || t.s[i] === 0) continue;
      const I = this.inst[t.a[i]];
      q.setFromAxisAngle(_up, t.r[i]);
      sv.setScalar(t.s[i]);
      pv.set(t.x[i], t.y[i], t.z[i]);
      m4.compose(pv, q, sv);
      c.setRGB(this.tints[i * 3], this.tints[i * 3 + 1], this.tints[i * 3 + 2]);
      if (d2 < d0) { I.l0t.setMatrixAt(I.l0t.count++, m4); I.l0f.setColorAt(I.l0f.count, c); I.l0f.setMatrixAt(I.l0f.count++, m4); }
      else if (d2 < d1) { I.l1t.setMatrixAt(I.l1t.count++, m4); I.l1f.setColorAt(I.l1f.count, c); I.l1f.setMatrixAt(I.l1f.count++, m4); }
      else { I.imp.setColorAt(I.imp.count, c); I.imp.setMatrixAt(I.imp.count++, m4); }
    }
    for (const I of this.inst) for (const m of [I.l0t, I.l0f, I.l1t, I.l1f, I.imp]) {
      m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  // Stream trunk colliders around a focus point
  updateColliders(focus) {
    const ph = this.game.physics, R = ph.R;
    const cs = this.cellSize;
    const cx = Math.floor(focus.x / cs), cz = Math.floor(focus.z / cs);
    const want = new Set();
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) want.add(`${cx + dx},${cz + dz}`);
    for (const [k, body] of this.colliderCells) if (!want.has(k)) { ph.world.removeRigidBody(body); this.colliderCells.delete(k); }
    for (const k of want) {
      if (this.colliderCells.has(k)) continue;
      const list = this.cells.get(k);
      const body = ph.world.createRigidBody(R.RigidBodyDesc.fixed());
      if (list) for (const i of list) {
        const s = this.trees.s[i];
        if (s < 0.3) continue;
        const type = this.assets[this.trees.a[i]].type;
        const r = (type === 2 ? 0.16 : 0.24) * s;
        const d = R.ColliderDesc.cylinder(2.5, r).setTranslation(this.trees.x[i], this.trees.y[i] + 2.5, this.trees.z[i]);
        ph.setGroups(d, 'static');
        const col = ph.world.createCollider(d, body);
        ph.tag(col, { surface: 'wood', tree: i });
      }
      this.colliderCells.set(k, body);
    }
  }

  // ------------------------------------------------------------------ rocks
  buildRocks(scene) {
    const T = this.game.terrain, ph = this.game.physics, R = ph.R;
    const rnd = mulberry32(999);
    const geos = [];
    for (let v = 0; v < 4; v++) {
      const g = new THREE.IcosahedronGeometry(1, 3);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = 1 + fbm2(x * 1.3 + v * 10, z * 1.3 + y * 0.7, 4, v) * 0.35 + perlin2(x * 4 + v, y * 4 + z * 2, v + 9) * 0.06;
        p.setXYZ(i, x * n * 1.15, y * n * (0.62 + v * 0.06), z * n);
      }
      g.computeVertexNormals();
      geos.push(g);
    }
    const mat = new THREE.MeshStandardMaterial({ map: tex('rock.jpg'), normalMap: tex('rock_n.jpg', { srgb: false }), roughness: 0.85 });
    mat.onBeforeCompile = (sh) => {
      // triplanar-ish: use world position for uv
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRP; varying vec3 vRN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRP = (modelMatrix * instanceMatrix * vec4(transformed,1.0)).xyz; vRN = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRP; varying vec3 vRN;')
        .replace('#include <map_fragment>', `
          vec3 bw = pow(abs(vRN), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
          vec3 rc = texture2D(map, vRP.zy / 4.0).rgb * bw.x + texture2D(map, vRP.xz / 4.0).rgb * bw.y + texture2D(map, vRP.xy / 4.0).rgb * bw.z;
          float moss = smoothstep(0.6, 0.95, vRN.y);
          rc = mix(rc, vec3(0.16, 0.24, 0.08), moss * 0.6);
          diffuseColor.rgb *= rc;`);
    };
    const lists = geos.map(() => []);
    const body = ph.world.createRigidBody(R.RigidBodyDesc.fixed());
    for (let k = 0; k < 2200; k++) {
      const x = (rnd() - 0.5) * MAP_SIZE * 0.98, z = (rnd() - 0.5) * MAP_SIZE * 0.98;
      const ri = T.roadInfo(x, z);
      if (ri.d < 4) continue;
      if (T.inField(x, z) || T.siteAt(x, z, 10)) continue;
      let nearSite = false; for (const s of SITES) if (Math.hypot(x - s.x, z - s.z) < s.r + 8) nearSite = true;
      if (nearSite) continue;
      const fm = forestMask(x, z);
      if (rnd() > 0.35 + fm * 0.5) continue;
      const big = rnd() < 0.12;
      const s = big ? 1.6 + rnd() * 2.4 : 0.3 + rnd() * 0.8;
      const h = T.getHeight(x, z);
      const v = Math.floor(rnd() * geos.length);
      lists[v].push([x, h - s * 0.25, z, s, rnd() * 6.28]);
      if (s > 0.7) {
        const d = R.ColliderDesc.ball(s * 0.85).setTranslation(x, h - s * 0.25, z);
        ph.setGroups(d, 'static');
        ph.tag(ph.world.createCollider(d, body), { surface: 'rock' });
      }
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    geos.forEach((g, i) => {
      const L = lists[i];
      const im = new THREE.InstancedMesh(g, mat, L.length);
      L.forEach(([x, y, z, s, r], j) => { q.setFromEuler(new THREE.Euler(0, r, (hash2(j, i) - 0.5) * 0.3)); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s)); im.setMatrixAt(j, m4); });
      im.castShadow = true; im.receiveShadow = true;
      scene.add(im);
    });
  }

  // ------------------------------------------------------------------ GPU grass
  buildGrass(scene) {
    const T = this.game.terrain;
    const R = 46, sp = 0.5;
    const n = Math.floor((2 * R) / sp);
    this.grassRadius = R;
    const base = new THREE.InstancedBufferGeometry();
    const quads = [];
    for (const a of [0, Math.PI / 3, -Math.PI / 3]) { const q = new THREE.PlaneGeometry(1, 1, 1, 2); q.translate(0, 0.5, 0); q.rotateY(a); quads.push(q); }
    const g = mergeGeos(quads);
    base.index = g.index; base.attributes.position = g.attributes.position; base.attributes.uv = g.attributes.uv; base.attributes.normal = g.attributes.normal;
    const offs = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const o = (j * n + i) * 3;
      offs[o] = (i - n / 2) * sp; offs[o + 1] = (j - n / 2) * sp; offs[o + 2] = Math.random();
    }
    base.setAttribute('aOff', new THREE.InstancedBufferAttribute(offs, 3));
    base.instanceCount = n * n;
    const fieldsU = FIELDS.map((f) => new THREE.Vector4(f.x, f.z, f.w / 2, f.d / 2));
    const fieldType = FIELDS.map((f) => (f.crop === 'hay' ? 0 : f.crop === 'barley' ? 1 : 2));
    const mat = new THREE.MeshStandardMaterial({ map: tex('grass_card.png', { wrap: false }), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 });
    const uniforms = {
      uCam: { value: new THREE.Vector3() }, uSp: { value: sp }, uR: { value: R },
      uHeight: { value: T.heightTex }, uSplat: { value: T.splatTex }, uMapSize: { value: MAP_SIZE }, uDensity: { value: 1 },
      uFields: { value: fieldsU }, uFieldType: { value: fieldType }, uTime: windUniforms.uTime, uWind: windUniforms.uWind,
      uCut: { value: new THREE.Vector4(0, 0, 0, 0) },
    };
    this.grassUniforms = uniforms;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec3 aOff;
uniform vec3 uCam; uniform float uSp, uR, uMapSize, uDensity, uTime, uWind;
uniform sampler2D uHeight, uSplat;
uniform vec4 uFields[4]; uniform int uFieldType[4];
varying vec3 vGTint; varying float vGFade;
float gh(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
`).replace('#include <begin_vertex>', `
vec2 snap = floor(uCam.xz / uSp) * uSp;
vec2 cellW = snap + aOff.xy;
float r1 = gh(cellW), r2 = gh(cellW + 7.13), r3 = gh(cellW + 3.7);
vec2 wxz = cellW + (vec2(r1, r2) - 0.5) * uSp * 1.6;
vec2 suv = (wxz + uMapSize * 0.5) / uMapSize;
vec4 spl = texture2D(uSplat, suv);
float hgt = texture2D(uHeight, suv).r;
float dens = spl.r * 1.15 + spl.g * 0.25 - spl.b * 0.6 - spl.a;
float d = length(wxz - uCam.xz);
float fade = smoothstep(uR, uR * 0.6, d);
float scaleH = mix(0.28, 0.62, r3);
vec3 tint = mix(vec3(0.95, 1.0, 0.8), vec3(1.1, 1.05, 0.75), r2) ;
for (int i = 0; i < 4; i++) {
  vec2 q = abs(wxz - uFields[i].xy);
  if (q.x < uFields[i].z && q.y < uFields[i].w) {
    dens = 1.2;
    if (uFieldType[i] == 0) { scaleH = mix(0.6, 0.95, r3); tint = vec3(1.15, 1.1, 0.7); }
    else if (uFieldType[i] == 1) { scaleH = mix(0.75, 0.95, r3); tint = vec3(1.6, 1.45, 0.55); }
    else { scaleH = mix(0.7, 0.9, r3); tint = vec3(1.35, 1.35, 0.7); }
  }
}
float keep = step(r1 * 0.9 + 0.1, dens * uDensity);
// cut-out around a point (e.g. tent or player built stuff) - unused by default
float sc = keep * fade * scaleH;
vec3 transformed = vec3(position.x * (0.42 + r2 * 0.3) * (0.4 + 0.6 * fade), position.y * sc, position.z * (0.42 + r2 * 0.3));
float ang = r3 * 6.2831;
transformed.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * transformed.xz;
float bend = position.y * position.y * (sin(uTime * 1.8 + wxz.x * 0.35 + wxz.y * 0.2) * 0.12 + 0.05) * uWind * 2.0;
transformed.x += bend; transformed.z += bend * 0.6;
transformed += vec3(wxz.x, hgt - 0.04, wxz.y);
vGTint = tint * (1.05 + 0.6 * position.y) * 1.25; vGFade = fade;
`).replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
        .replace('#include <project_vertex>', 'vec4 mvPosition = viewMatrix * vec4(transformed, 1.0); gl_Position = projectionMatrix * mvPosition;')
        .replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4(transformed, 1.0);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGTint; varying float vGFade;')
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= vGTint;');
    };
    const mesh = new THREE.Mesh(base, mat);
    mesh.frustumCulled = false; mesh.receiveShadow = true;
    scene.add(mesh);
    this.grass = mesh;
  }

  // Lupines & daisies along roadsides and meadows (static instanced cards)
  buildFlowers(scene) {
    const T = this.game.terrain;
    const rnd = mulberry32(4242);
    const list = [];
    for (const road of T.roads) {
      if (road.type === 'stage') continue;
      for (let i = 0; i < road.samples.length; i += 3) {
        if (rnd() > 0.55) continue;
        const s = road.samples[i];
        const side = rnd() < 0.5 ? -1 : 1;
        const off = side * (road.width / 2 + 1.8 + rnd() * 4);
        const x = s.x - s.dz * off, z = s.z + s.dx * off;
        if (T.roadInfo(x, z).d < 1.2 || T.siteAt(x, z)) continue;
        const cluster = fbm2(x / 40, z / 40, 2, 77);
        if (cluster < -0.1) continue;
        const kind = cluster > 0.2 ? (rnd() < 0.7 ? 0 : 1) : Math.floor(rnd() * 4);
        list.push([x, T.getHeight(x, z), z, kind]);
      }
    }
    for (let k = 0; k < 9000; k++) {
      const x = (rnd() - 0.5) * MAP_SIZE, z = (rnd() - 0.5) * MAP_SIZE;
      const sp = T.splatAt(x, z);
      if (sp[0] < 0.6 || T.siteAt(x, z, 4)) continue;
      list.push([x, T.getHeight(x, z), z, 2 + Math.floor(rnd() * 2)]);
    }
    const quads = [];
    for (const a of [0, Math.PI / 2]) { const q = new THREE.PlaneGeometry(1, 1); q.translate(0, 0.5, 0); q.rotateY(a); quads.push(q); }
    const base = mergeGeos(quads);
    const mats = [];
    const ft = tex('flowers.png', { wrap: false });
    for (let k = 0; k < 4; k++) {
      const t = ft.clone(); t.repeat.set(0.5, 0.5); t.offset.set((k % 2) * 0.5, k < 2 ? 0.5 : 0); t.needsUpdate = true;
      const m = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
      addWind(m, 3);
      mats.push(m);
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let k = 0; k < 4; k++) {
      const L = list.filter((f) => f.f === undefined && f[3] === k);
      const im = new THREE.InstancedMesh(base, mats[k], L.length);
      L.forEach(([x, y, z], j) => {
        const s = k < 2 ? 0.9 + rnd() * 0.6 : 0.35 + rnd() * 0.25;
        q.setFromAxisAngle(_up, rnd() * 6.28);
        m4.compose(new THREE.Vector3(x, y - 0.05, z), q, new THREE.Vector3(s, s, s)); im.setMatrixAt(j, m4);
      });
      im.receiveShadow = true;
      scene.add(im);
    }
  }

  buildReeds(scene) {
    const T = this.game.terrain;
    const rnd = mulberry32(5151);
    const L = [];
    for (let k = 0; k < 60000 && L.length < 5000; k++) {
      const x = (rnd() - 0.5) * 1400 - 150, z = (rnd() - 0.5) * 1200 + 20;
      const h = T.getHeight(x, z);
      if (h > WATER_LEVEL - 0.1 || h < WATER_LEVEL - 1.4) continue;
      if (fbm2(x / 50, z / 50, 2, 61) < 0) continue;
      if (Math.hypot(x - (-296), z - 332) < 18) continue; // keep the dock clear
      L.push([x, h, z]);
    }
    const quads = [];
    for (const a of [0, Math.PI / 3, -Math.PI / 3]) { const q = new THREE.PlaneGeometry(1.2, 1); q.translate(0, 0.5, 0); q.rotateY(a); quads.push(q); }
    const mat = new THREE.MeshStandardMaterial({ map: tex('grass_card.png', { wrap: false }), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: 0xb8c070 });
    addWind(mat, 4);
    const im = new THREE.InstancedMesh(mergeGeos(quads), mat, L.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    L.forEach(([x, y, z], j) => { const s = 1.6 + rnd() * 1.2; q.setFromAxisAngle(_up, rnd() * 6.28); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s * 0.8, s + (WATER_LEVEL - y), s * 0.8)); im.setMatrixAt(j, m4); });
    scene.add(im);
  }

  setQuality(q) {
    this.lod0Dist = [40, 60, 80, 110][q];
    this.lod1Dist = [140, 200, 260, 320][q];
    this.maxDist = [600, 900, 1300, 1700][q];
    if (this.grassUniforms) this.grassUniforms.uDensity.value = [0.35, 0.65, 1.0, 1.2][q];
    if (this.grass) this.grass.visible = q > 0 || true;
    this.lastLodPos.set(1e9, 0, 0);
  }

  update(dt, camPos, focus) {
    windUniforms.uTime.value += dt;
    if (this.grassUniforms) this.grassUniforms.uCam.value.copy(camPos);
    this.lodTimer -= dt;
    if (this.lodTimer <= 0) {
      this.lodTimer = 0.25;
      this.updateLOD(camPos);
      this.updateColliders(focus);
    }
  }
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0);
