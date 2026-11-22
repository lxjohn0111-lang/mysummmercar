import * as THREE from 'three';
import { MAP_SIZE, HALF, WATER_LEVEL, SITES, ROADS, FIELDS, baseHeight, lakeD, forestMask } from './layout.js';
import { smoothstep, fbm2, perlin2, hash2 } from '../core/noise.js';
import { tex } from '../core/assets.js';

export const GRID = 600;            // cells per side
export const CELL = MAP_SIZE / GRID; // 4 m
const N1 = GRID + 1;

export class Terrain {
  constructor() {
    this.heights = new Float32Array(N1 * N1);
    this.roads = [];
    this.siteHeights = new Map();
    this.roadGridRes = 4;
    this.roadGridN = MAP_SIZE / this.roadGridRes;
    this.roadDist = new Float32Array(this.roadGridN * this.roadGridN).fill(999);
    this.roadType = new Uint8Array(this.roadGridN * this.roadGridN);
  }

  build() {
    const H = this.heights;
    // 1. base heights
    for (let iz = 0; iz < N1; iz++) for (let ix = 0; ix < N1; ix++) {
      H[iz * N1 + ix] = baseHeight(ix * CELL - HALF, iz * CELL - HALF);
    }
    // 2. building sites flattening
    for (const s of SITES) {
      let sh = baseHeight(s.x, s.z);
      if (s.shore) sh = Math.max(sh, WATER_LEVEL + 1.0);
      sh = Math.max(sh, WATER_LEVEL + 1.2);
      s.h = sh;
      const R = s.r + s.b;
      this.forVertsIn(s.x, s.z, R, (i, d) => {
        const t = smoothstep(R, s.r, d);
        H[i] = H[i] + (sh - H[i]) * t;
      });
    }
    // 3. roads
    this.buildRoadProfiles();
    const best = new Float32Array(N1 * N1).fill(999);
    const bestH = new Float32Array(N1 * N1);
    const bestW = new Float32Array(N1 * N1);
    for (const road of this.roads) {
      const w = road.width / 2;
      for (const s of road.samples) {
        this.forVertsIn(s.x, s.z, w + 18, (i, d) => {
          if (d < best[i]) { best[i] = d; bestH[i] = s.h; bestW[i] = w; }
        });
        // road distance grid for vegetation/splat
        const R = w + 26, g = this.roadGridRes, n = this.roadGridN;
        const x0 = Math.max(0, Math.floor((s.x - R + HALF) / g)), x1 = Math.min(n - 1, Math.ceil((s.x + R + HALF) / g));
        const z0 = Math.max(0, Math.floor((s.z - R + HALF) / g)), z1 = Math.min(n - 1, Math.ceil((s.z + R + HALF) / g));
        for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
          const d = Math.hypot(gx * g + g / 2 - HALF - s.x, gz * g + g / 2 - HALF - s.z) - w;
          const k = gz * n + gx;
          if (d < this.roadDist[k]) { this.roadDist[k] = d; this.roadType[k] = road.type === 'asphalt' ? 1 : road.type === 'stage' ? 3 : 2; }
        }
      }
    }
    for (let i = 0; i < H.length; i++) {
      if (best[i] > 900) continue;
      const w = bestW[i];
      const t = smoothstep(w + 16, w + 6, best[i]);
      H[i] = H[i] + (bestH[i] - 0.28 - H[i]) * t;
    }
    this.buildSplat();
  }

  forVertsIn(x, z, R, fn) {
    const ix0 = Math.max(0, Math.floor((x - R + HALF) / CELL)), ix1 = Math.min(GRID, Math.ceil((x + R + HALF) / CELL));
    const iz0 = Math.max(0, Math.floor((z - R + HALF) / CELL)), iz1 = Math.min(GRID, Math.ceil((z + R + HALF) / CELL));
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const d = Math.hypot(ix * CELL - HALF - x, iz * CELL - HALF - z);
      if (d <= R) fn(iz * N1 + ix, d);
    }
  }

  // Height before road flattening (used for road profiles)
  preRoadHeight(x, z) { return this.getHeight(x, z); }

  buildRoadProfiles() {
    const placed = []; // spatial list of previous samples
    const hash = new Map();
    const key = (x, z) => `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
    for (const def of ROADS) {
      const pts = def.pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
      const curve = new THREE.CatmullRomCurve3(pts, !!def.closed, 'centripetal', 0.5);
      const len = curve.getLength();
      const n = Math.max(8, Math.round(len / 1.0));
      const sp = curve.getSpacedPoints(n);
      if (def.closed) sp.pop();
      const samples = sp.map((p) => ({ x: p.x, z: p.z, h: this.getHeight(p.x, p.z), pin: false }));
      // pin to existing roads at junctions
      for (const s of samples) {
        let bestD = 1e9, bh = 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const arr = hash.get(`${Math.floor(s.x / 16) + dx},${Math.floor(s.z / 16) + dz}`);
          if (arr) for (const o of arr) { const d = Math.hypot(o.x - s.x, o.z - s.z); if (d < bestD) { bestD = d; bh = o.h; } }
        }
        if (bestD < 7) { s.h = bh; s.pin = true; }
      }
      // smooth
      const W = def.type === 'asphalt' ? 30 : def.type === 'stage' ? 10 : 14;
      for (let pass = 0; pass < 4; pass++) {
        const out = samples.map((s) => s.h);
        for (let i = 0; i < samples.length; i++) {
          if (samples[i].pin) continue;
          let sum = 0, c = 0;
          for (let k = -W; k <= W; k++) {
            let j = i + k;
            if (def.closed) j = (j + samples.length) % samples.length; else if (j < 0 || j >= samples.length) continue;
            sum += samples[j].h; c++;
          }
          out[i] = sum / c;
        }
        for (let i = 0; i < samples.length; i++) samples[i].h = Math.max(out[i], WATER_LEVEL + 0.9);
      }
      // directions + cumulative distance
      let dist = 0;
      for (let i = 0; i < samples.length; i++) {
        const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
        let dx = b.x - a.x, dz = b.z - a.z;
        if (def.closed) { const a2 = samples[(i - 1 + samples.length) % samples.length], b2 = samples[(i + 1) % samples.length]; dx = b2.x - a2.x; dz = b2.z - a2.z; }
        const l = Math.hypot(dx, dz) || 1;
        samples[i].dx = dx / l; samples[i].dz = dz / l;
        if (i > 0) dist += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].z - samples[i - 1].z);
        samples[i].d = dist;
      }
      const road = { ...def, samples, curve, length: len };
      this.roads.push(road);
      for (const s of samples) {
        const k = key(s.x, s.z); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(s);
        placed.push(s);
      }
    }
  }

  getHeight(x, z) {
    const fx0 = (x + HALF) / CELL, fz0 = (z + HALF) / CELL;
    let ix = Math.floor(fx0), iz = Math.floor(fz0);
    if (ix < 0) ix = 0; if (iz < 0) iz = 0; if (ix >= GRID) ix = GRID - 1; if (iz >= GRID) iz = GRID - 1;
    const fx = Math.min(1, Math.max(0, fx0 - ix)), fz = Math.min(1, Math.max(0, fz0 - iz));
    const H = this.heights;
    const h00 = H[iz * N1 + ix], h10 = H[iz * N1 + ix + 1], h01 = H[(iz + 1) * N1 + ix], h11 = H[(iz + 1) * N1 + ix + 1];
    if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }
  getNormal(x, z, out = new THREE.Vector3()) {
    const e = 1.5;
    const hx = this.getHeight(x + e, z) - this.getHeight(x - e, z);
    const hz = this.getHeight(x, z + e) - this.getHeight(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }
  roadInfo(x, z) {
    const g = this.roadGridRes, n = this.roadGridN;
    const gx = Math.floor((x + HALF) / g), gz = Math.floor((z + HALF) / g);
    if (gx < 0 || gz < 0 || gx >= n || gz >= n) return { d: 999, type: 0 };
    const k = gz * n + gx;
    return { d: this.roadDist[k], type: this.roadType[k] };
  }
  inField(x, z) {
    for (const f of FIELDS) if (Math.abs(x - f.x) < f.w / 2 && Math.abs(z - f.z) < f.d / 2) return f;
    return null;
  }
  siteAt(x, z, pad = 0) {
    for (const s of SITES) if (s.yard > 0 && Math.hypot(x - s.x, z - s.z) < s.yard + pad) return s;
    return null;
  }

  buildSplat() {
    const S = 1024;
    const data = new Uint8Array(S * S * 4);
    this.splatSize = S;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = (i + 0.5) / S * MAP_SIZE - HALF, z = (j + 0.5) / S * MAP_SIZE - HALF;
      const h = this.getHeight(x, z);
      const nrm = this.getNormal(x, z, _n);
      const slope = 1 - nrm.y;
      let grass = 1, forest = 0, dirt = 0, rock = 0;
      const fm = forestMask(x, z);
      forest = smoothstep(0.35, 0.7, fm + perlin2(x / 25, z / 25, 3) * 0.15);
      rock = smoothstep(0.12, 0.3, slope) + smoothstep(0.55, 0.75, fbm2(x / 60, z / 60, 3, 77)) * 0.7;
      const ld = lakeD(x, z);
      if (h < WATER_LEVEL + 0.6) dirt = Math.max(dirt, smoothstep(WATER_LEVEL + 0.6, WATER_LEVEL, h));
      if (ld < 1) { dirt = 1; grass = 0; forest = 0; }
      const ri = this.roadInfo(x, z);
      const shoulder = smoothstep(3.5, 0.5, ri.d);
      dirt = Math.max(dirt, shoulder);
      const site = this.siteAt(x, z);
      if (site) {
        const k = smoothstep(site.yard * 0.75, site.yard * 0.35, Math.hypot(x - site.x, z - site.z));
        dirt = Math.max(dirt, k * smoothstep(-0.25, 0.25, perlin2(x / 9, z / 9, 9)));
        forest *= 1 - k; rock *= 1 - k;
      }
      const field = this.inField(x, z);
      if (field) { dirt = Math.max(dirt, field.crop === 'hay' ? 0.35 : 0.85); forest = 0; rock = 0; }
      // dirt patches in grass
      dirt = Math.max(dirt, smoothstep(0.55, 0.75, fbm2(x / 40, z / 40, 3, 78)) * 0.6);
      grass = Math.max(0, 1 - forest * 0.9 - dirt);
      rock = Math.min(1, rock);
      const sum = grass + forest + dirt + rock + 1e-4;
      const o = (j * S + i) * 4;
      data[o] = Math.round((grass / sum) * 255);
      data[o + 1] = Math.round((forest / sum) * 255);
      data[o + 2] = Math.round((dirt / sum) * 255);
      data[o + 3] = Math.round((rock / sum) * 255);
    }
    this.splatData = data;
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    this.splatTex = t;
    // grass density accessor
    // height texture for GPU grass & water depth
    const hd = new Uint16Array(N1 * N1);
    for (let i = 0; i < hd.length; i++) hd[i] = THREE.DataUtils.toHalfFloat(this.heights[i]);
    const ht = new THREE.DataTexture(hd, N1, N1, THREE.RedFormat, THREE.HalfFloatType);
    ht.magFilter = THREE.LinearFilter; ht.minFilter = THREE.LinearFilter; ht.needsUpdate = true;
    this.heightTex = ht;
  }

  clearGrass(x0, x1, z0, z1) {
    const S = this.splatSize, d = this.splatData;
    const i0 = Math.max(0, Math.floor((x0 + HALF) / MAP_SIZE * S)), i1 = Math.min(S - 1, Math.ceil((x1 + HALF) / MAP_SIZE * S));
    const j0 = Math.max(0, Math.floor((z0 + HALF) / MAP_SIZE * S)), j1 = Math.min(S - 1, Math.ceil((z1 + HALF) / MAP_SIZE * S));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const o = (j * S + i) * 4;
      d[o] = 0; d[o + 1] = 0; d[o + 2] = 255; d[o + 3] = 0;
    }
  }

  splatAt(x, z) {
    const S = this.splatSize;
    const i = Math.min(S - 1, Math.max(0, Math.floor((x + HALF) / MAP_SIZE * S)));
    const j = Math.min(S - 1, Math.max(0, Math.floor((z + HALF) / MAP_SIZE * S)));
    const o = (j * S + i) * 4, d = this.splatData;
    return [d[o] / 255, d[o + 1] / 255, d[o + 2] / 255, d[o + 3] / 255];
  }

  // ------------------------------------------------------------------ rendering
  createMesh(scene) {
    const mat = makeTerrainMaterial(this);
    this.material = mat;
    const CH = 8, per = GRID / CH;
    const group = new THREE.Group();
    for (let cz = 0; cz < CH; cz++) for (let cx = 0; cx < CH; cx++) {
      const n = per + 1;
      const pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const ix = cx * per + i, iz = cz * per + j;
        const x = ix * CELL - HALF, z = iz * CELL - HALF;
        const o = (j * n + i) * 3;
        pos[o] = x; pos[o + 1] = this.heights[iz * N1 + ix]; pos[o + 2] = z;
        const hl = this.heights[iz * N1 + Math.max(0, ix - 1)], hr = this.heights[iz * N1 + Math.min(GRID, ix + 1)];
        const hd = this.heights[Math.max(0, iz - 1) * N1 + ix], hu = this.heights[Math.min(GRID, iz + 1) * N1 + ix];
        const v = new THREE.Vector3(hl - hr, 2 * CELL, hd - hu).normalize();
        nor[o] = v.x; nor[o + 1] = v.y; nor[o + 2] = v.z;
      }
      const idx = new Uint32Array(per * per * 6); let k = 0;
      for (let j = 0; j < per; j++) for (let i = 0; i < per; i++) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        // matches the physics heightfield diagonal (b-c)
        idx[k++] = a; idx[k++] = c; idx[k++] = b;
        idx[k++] = b; idx[k++] = c; idx[k++] = d;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      m.userData.surface = 'terrain';
      group.add(m);
    }
    scene.add(group);
    this.mesh = group;
    this.createHorizon(scene);
    return group;
  }

  // Distant hills ring beyond the playable area
  createHorizon(scene) {
    const segs = 128, rings = 12;
    const pos = [], idx = [], col = [];
    for (let r = 0; r <= rings; r++) {
      const rad = HALF * 1.0 + r * r * 45 + r * 80;
      for (let s = 0; s <= segs; s++) {
        const a = s / segs * Math.PI * 2;
        let x = Math.cos(a) * rad, z = Math.sin(a) * rad;
        // square-ish inner ring to meet the square map
        if (r === 0) { const k = HALF / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))); x = Math.cos(a) * k; z = Math.sin(a) * k; }
        let h = r === 0 ? this.getHeight(Math.max(-HALF, Math.min(HALF, x)), Math.max(-HALF, Math.min(HALF, z))) : 30 + fbm2(x / 700, z / 700, 4, 600) * 45 + r * 4;
        if (r === rings) h = 20;
        pos.push(x, h, z);
        const f = 0.9 + fbm2(x / 300, z / 300, 2, 9) * 0.2;
        col.push(0.12 * f, 0.17 * f, 0.09 * f);
      }
    }
    for (let r = 0; r < rings; r++) for (let s = 0; s < segs; s++) {
      const a = r * (segs + 1) + s, b = a + 1, c = a + segs + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    scene.add(m);
    this.horizon = m;
  }

  createCollider(physics) {
    const R = physics.R;
    const hr = new Float32Array(N1 * N1);
    for (let iz = 0; iz < N1; iz++) for (let ix = 0; ix < N1; ix++) hr[ix * N1 + iz] = this.heights[iz * N1 + ix];
    const body = physics.world.createRigidBody(R.RigidBodyDesc.fixed());
    const desc = R.ColliderDesc.heightfield(GRID, GRID, hr, { x: MAP_SIZE, y: 1, z: MAP_SIZE }).setFriction(0.9);
    physics.setGroups(desc, 'static');
    const col = physics.world.createCollider(desc, body);
    physics.tag(col, { surface: 'terrain' });
    // map border walls
    for (const [x, z, hx, hz] of [[HALF + 1, 0, 1, HALF], [-HALF - 1, 0, 1, HALF], [0, HALF + 1, HALF, 1], [0, -HALF - 1, HALF, 1]]) {
      const d = R.ColliderDesc.cuboid(hx, 200, hz).setTranslation(x, 50, z);
      physics.setGroups(d, 'static');
      physics.world.createCollider(d, body);
    }
    this.collider = col;
  }
}
const _n = new THREE.Vector3();

function makeTerrainMaterial(terrain) {
  const T = (n, srgb = true) => tex(n, { srgb });
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  const uniforms = {
    uSplat: { value: terrain.splatTex },
    tGrass: { value: T('grass.jpg') }, nGrass: { value: T('grass_n.jpg', false) },
    tForest: { value: T('forest.jpg') }, nForest: { value: T('forest_n.jpg', false) },
    tDirt: { value: T('dirt.jpg') }, nDirt: { value: T('dirt_n.jpg', false) },
    tRock: { value: T('rock.jpg') }, nRock: { value: T('rock_n.jpg', false) },
    tNoise: { value: T('noise.jpg', false) },
    uWet: { value: 0 },
    uMapSize: { value: MAP_SIZE },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNor;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;\nvWNor = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWPos; varying vec3 vWNor;
uniform sampler2D uSplat, tGrass, nGrass, tForest, nForest, tDirt, nDirt, tRock, nRock, tNoise;
uniform float uWet, uMapSize;
vec4 gSplat; vec3 gNormalT; float gRough;
`)
      .replace('#include <map_fragment>', `
{
  vec2 suv = (vWPos.xz + uMapSize*0.5) / uMapSize;
  vec4 sp = texture2D(uSplat, suv);
  float nz = texture2D(tNoise, vWPos.xz / 180.0).r;
  float nz2 = texture2D(tNoise, vWPos.xz / 37.0).g;
  // perturb weights for organic transitions
  sp.g *= 0.6 + nz2 * 0.8; sp.b *= 0.5 + nz * 1.0; sp.a *= 0.6 + nz2 * 0.8;
  sp = pow(max(sp, 0.0), vec4(1.6));
  sp /= (sp.r + sp.g + sp.b + sp.a + 1e-4);
  gSplat = sp;
  vec2 uvA = vWPos.xz / 5.0;
  vec2 uvB = vWPos.xz / 13.7 + vec2(0.37, 0.11);
  float mixAB = smoothstep(0.3, 0.7, nz);
  vec3 cg = mix(texture2D(tGrass, uvA).rgb, texture2D(tGrass, uvB).rgb, mixAB);
  vec3 cf = texture2D(tForest, vWPos.xz / 4.5).rgb;
  vec3 cd = mix(texture2D(tDirt, vWPos.xz / 4.0).rgb, texture2D(tDirt, uvB*1.2).rgb, mixAB*0.5);
  vec2 ruv = abs(vWNor.x) > abs(vWNor.z) ? vWPos.zy : vWPos.xy;
  vec3 crTop = texture2D(tRock, vWPos.xz / 6.0).rgb;
  vec3 crSide = texture2D(tRock, ruv / 6.0).rgb;
  vec3 cr = mix(crTop, crSide, smoothstep(0.5, 0.9, 1.0 - abs(vWNor.y)));
  // macro color variation (dry / lush patches)
  float macro = texture2D(tNoise, vWPos.xz / 700.0).r;
  cg *= mix(vec3(1.08, 1.0, 0.75), vec3(0.85, 1.02, 0.9), macro);
  vec3 col = cg * sp.r + cf * sp.g + cd * sp.b + cr * sp.a;
  col *= 0.85 + 0.3 * texture2D(tNoise, vWPos.xz / 60.0).b;
  // wet darkening
  col *= 1.0 - uWet * 0.35;
  diffuseColor.rgb *= col;
  vec3 ng = normalize(mix(texture2D(nGrass, uvA).xyz, texture2D(nGrass, uvB).xyz, mixAB) * 2.0 - 1.0);
  vec3 nf = texture2D(nForest, vWPos.xz / 4.5).xyz * 2.0 - 1.0;
  vec3 nd = texture2D(nDirt, vWPos.xz / 4.0).xyz * 2.0 - 1.0;
  vec3 nr = texture2D(nRock, vWPos.xz / 6.0).xyz * 2.0 - 1.0;
  gNormalT = normalize(ng * sp.r + nf * sp.g + nd * sp.b + nr * sp.a * 1.5);
  gRough = clamp(0.95 * sp.r + 0.95 * sp.g + 0.9 * sp.b + 0.75 * sp.a - uWet * 0.55, 0.15, 1.0);
}
`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
      .replace('#include <normal_fragment_maps>', `
{
  vec3 Nw = normalize(vWNor);
  vec3 Tw = normalize(vec3(1.0, 0.0, 0.0) - Nw * Nw.x);
  vec3 Bw = normalize(cross(Tw, Nw));
  vec3 nw = normalize(Tw * gNormalT.x + Bw * gNormalT.y + Nw * gNormalT.z);
  normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
}
`);
  };
  return mat;
}
