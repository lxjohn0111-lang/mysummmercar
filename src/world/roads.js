import * as THREE from 'three';
import { tex } from '../core/assets.js';
import { canvasTexture, mergeGeos, xform } from '../core/util.js';
import { hash2 } from '../core/noise.js';

// Builds road ribbon meshes + trimesh colliders + roadside furniture.
export function buildRoads(game) {
  const { terrain, scene, physics } = game;
  const R = physics.R;
  const matAsphalt = roadMaterial('asphalt');
  const matGravel = roadMaterial('gravel');
  const body = physics.world.createRigidBody(R.RigidBodyDesc.fixed());
  const group = new THREE.Group();
  for (const road of terrain.roads) {
    const s = road.samples;
    const w = road.width / 2;
    const step = 2;
    const pos = [], uv = [], idx = [], cpos = [], cidx = [];
    const cols = [[-w - 1.4, -0.32, 0], [-w, 0, 0.0], [-w * 0.5, 0.015, 0.25], [0, 0.03, 0.5], [w * 0.5, 0.015, 0.75], [w, 0, 1.0], [w + 1.4, -0.32, 1]];
    const nc = cols.length;
    let rows = 0;
    const list = [];
    for (let i = 0; i < s.length; i += step) list.push(s[i]);
    if (road.closed) list.push(s[0]);
    else if (list[list.length - 1] !== s[s.length - 1]) list.push(s[s.length - 1]);
    let dist = 0;
    for (let r = 0; r < list.length; r++) {
      const p = list[r];
      if (r > 0) dist += Math.hypot(p.x - list[r - 1].x, p.z - list[r - 1].z);
      const nx = -p.dz, nz = p.dx; // right vector
      for (let c = 0; c < nc; c++) {
        const [off, dy, u] = cols[c];
        const x = p.x + nx * off, z = p.z + nz * off;
        let y = p.h + dy;
        if (c === 0 || c === nc - 1) y = Math.min(y, terrain.getHeight(x, z) - 0.05);
        pos.push(x, y, z);
        uv.push(c === 0 ? -0.15 : c === nc - 1 ? 1.15 : u, dist / (road.type === 'asphalt' ? 7 : 5));
        if (c >= 1 && c <= nc - 2) cpos.push(x, y, z);
      }
      rows++;
    }
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < nc - 1; c++) {
        const a = r * nc + c, b = a + 1, cc = a + nc, d = cc + 1;
        idx.push(a, cc, b, b, cc, d);
      }
      const ncc = nc - 2;
      for (let c = 0; c < ncc - 1; c++) {
        const a = r * ncc + c, b = a + 1, cc = a + ncc, d = cc + 1;
        cidx.push(a, cc, b, b, cc, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mat = road.type === 'asphalt' ? matAsphalt : matGravel;
    const mesh = new THREE.Mesh(g, road.id === 'stage' || road.id === 'lakeroad' || road.type === 'gravel' && road.width < 4.5 ? matGravel.userData.rutted : mat);
    mesh.receiveShadow = true;
    group.add(mesh);
    const cd = R.ColliderDesc.trimesh(new Float32Array(cpos), new Uint32Array(cidx)).setFriction(road.type === 'asphalt' ? 1.0 : 0.75);
    physics.setGroups(cd, 'static');
    const col = physics.world.createCollider(cd, body);
    physics.tag(col, { surface: road.type === 'asphalt' ? 'asphalt' : 'gravel', road });
  }
  scene.add(group);
  buildRoadside(game);
  return group;
}

function roadMaterial(type) {
  const isA = type === 'asphalt';
  const m = new THREE.MeshStandardMaterial({
    map: tex(isA ? 'asphalt.jpg' : 'gravel.jpg'),
    normalMap: tex(isA ? 'asphalt_n.jpg' : 'gravel_n.jpg', { srgb: false }),
    roughness: isA ? 0.88 : 0.95, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  m.normalScale.set(1, 1);
  const uniforms = { uWet: { value: 0 }, tNoise: { value: tex('noise.jpg', { srgb: false }) }, tGrass: { value: tex('grass.jpg') } };
  m.userData.uniforms = uniforms;
  const build = (rutted) => (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vRUv; varying vec3 vRW;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRUv = uv;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRW = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vRUv; varying vec3 vRW; uniform float uWet; uniform sampler2D tNoise, tGrass;')
      .replace('#include <map_fragment>', `
  vec2 wuv = vRW.xz / ${isA ? '4.0' : '3.0'};
  vec4 texelColor = texture2D(map, wuv);
  vec3 c = texelColor.rgb;
  float u = vRUv.x;
  float edgeFade = smoothstep(-0.15, 0.04, u) * smoothstep(1.15, 0.96, u);
  float n = texture2D(tNoise, vRW.xz / 40.0).r;
  ${isA ? `
  // Finnish style markings: white edge lines, yellow dashed centre line
  float edgeL = smoothstep(0.045, 0.055, u) * smoothstep(0.085, 0.075, u);
  float edgeR = smoothstep(0.915, 0.925, u) * smoothstep(0.955, 0.945, u);
  float dash = step(0.45, fract(vRUv.y / 1.6));
  float centre = smoothstep(0.488, 0.494, u) * smoothstep(0.512, 0.506, u) * dash;
  float wear = 0.65 + 0.35 * texture2D(tNoise, vRW.xz / 3.0).g;
  c = mix(c, vec3(0.85, 0.85, 0.82), (edgeL + edgeR) * wear);
  c = mix(c, vec3(0.85, 0.65, 0.12), centre * wear);
  // tyre tracks polish
  float track = smoothstep(0.12, 0.0, abs(u - 0.3)) + smoothstep(0.12, 0.0, abs(u - 0.7));
  c *= 1.0 - track * 0.12;
  ` : `
  // wheel ruts & grass crown
  float rut = smoothstep(0.1, 0.0, abs(u - 0.27)) + smoothstep(0.1, 0.0, abs(u - 0.73));
  c = mix(c, c * vec3(0.78, 0.74, 0.7), rut * 0.6);
  float crown = smoothstep(0.08, 0.0, abs(u - 0.5)) * ${rutted ? '1.0' : '0.0'} * smoothstep(0.3, 0.6, n + 0.3);
  c = mix(c, texture2D(tGrass, vRW.xz / 2.0).rgb * 0.8, crown);
  c = mix(c, c * 1.12 + vec3(0.04, 0.035, 0.02), (1.0 - rut) * 0.3);
  `}
  // dirt blend toward edges
  c = mix(vec3(0.33, 0.29, 0.22) * (0.8 + n * 0.4), c, smoothstep(0.0, 0.08, u) * smoothstep(1.0, 0.92, u));
  c *= 1.0 - uWet * 0.4;
  diffuseColor.rgb *= c;
  diffuseColor.a *= edgeFade;
`)
      .replace('#include <normal_fragment_maps>', `
  vec3 mapN = texture2D(normalMap, wuv).xyz * 2.0 - 1.0;
  mapN.xy *= normalScale;
  normal = normalize(tbn * mapN);
`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness * (1.0 - uWet * 0.7);`);
  };
  m.transparent = false;
  m.alphaTest = 0.0;
  m.onBeforeCompile = build(false);
  m.customProgramCacheKey = () => type + '0';
  // tangent frame: normal map uses vNormalMapUv/tbn; ensure tbn exists via normalMap present
  const r = m.clone();
  r.onBeforeCompile = build(true);
  r.customProgramCacheKey = () => type + '1';
  r.userData.uniforms = uniforms;
  m.userData.rutted = r;
  return m;
}

// Signs, power poles, mailboxes, bus stop etc.
function buildRoadside(game) {
  const { terrain, scene } = game;
  const hw = terrain.roads.find((r) => r.id === 'highway');
  // Power line poles along the highway
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 9, 6); poleGeo.translate(0, 4.5, 0);
  const armGeo = new THREE.BoxGeometry(2.2, 0.12, 0.12); armGeo.translate(0, 8.4, 0);
  const insGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.18, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.9, map: tex('bark_spruce.jpg') });
  const poles = [];
  const S = hw.samples;
  for (let i = 0; i < S.length; i += 48) {
    const p = S[i];
    const off = 10;
    const x = p.x + -p.dz * off, z = p.z + p.dx * off;
    if (game.terrain.roadInfo(x, z).d < 4) continue;
    poles.push({ x, y: terrain.getHeight(x, z) - 0.3, z, a: Math.atan2(p.dx, p.dz) });
  }
  const geo = mergeGeos([poleGeo, armGeo, xform(insGeo, { p: [-0.9, 8.55, 0] }), xform(insGeo, { p: [0, 8.55, 0] }), xform(insGeo, { p: [0.9, 8.55, 0] })]);
  const im = new THREE.InstancedMesh(geo, poleMat, poles.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  poles.forEach((p, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.a + Math.PI / 2); m4.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); });
  im.castShadow = true;
  scene.add(im);
  // wires with sag
  const wpos = [];
  for (let i = 0; i < poles.length; i++) {
    const a = poles[i], b = poles[(i + 1) % poles.length];
    if (Math.hypot(a.x - b.x, a.z - b.z) > 140) continue;
    for (const o of [-0.9, 0, 0.9]) {
      const ax = a.x + Math.cos(a.a) * o * 0 + Math.sin(a.a + Math.PI / 2) * o, az = a.z + Math.cos(a.a + Math.PI / 2) * o;
      const bx = b.x + Math.sin(b.a + Math.PI / 2) * o, bz = b.z + Math.cos(b.a + Math.PI / 2) * o;
      const n = 10;
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        const y0 = a.y + 8.6 + (b.y - a.y) * t0 - Math.sin(Math.PI * t0) * 1.2;
        const y1 = a.y + 8.6 + (b.y - a.y) * t1 - Math.sin(Math.PI * t1) * 1.2;
        wpos.push(ax + (bx - ax) * t0, y0, az + (bz - az) * t0, ax + (bx - ax) * t1, y1, az + (bz - az) * t1);
      }
    }
  }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x222222 })));

  // Reflector posts (white posts with black band) along highway
  const postGeo = mergeGeos([xform(new THREE.BoxGeometry(0.1, 1.0, 0.1), { p: [0, 0.5, 0] })]);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.6, map: canvasTexture(16, 64, (c) => { c.fillStyle = '#eee'; c.fillRect(0, 0, 16, 64); c.fillStyle = '#111'; c.fillRect(0, 4, 16, 14); c.fillStyle = '#ffaa22'; c.fillRect(3, 6, 10, 8); }) });
  const posts = [];
  for (let i = 0; i < S.length; i += 50) {
    const p = S[i];
    for (const side of [-1, 1]) {
      const off = side * (hw.width / 2 + 1.6);
      const x = p.x - p.dz * off, z = p.z + p.dx * off;
      posts.push([x, terrain.getHeight(x, z) - 0.1, z, Math.atan2(p.dx, p.dz)]);
    }
  }
  const pim = new THREE.InstancedMesh(postGeo, postMat, posts.length);
  posts.forEach(([x, y, z, a], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); pim.setMatrixAt(i, m4); });
  scene.add(pim);

  // Signs
  const signs = [
    { at: [-392, 578], face: 0, text: ['KOTI', '← 0.2'], kind: 'blue' },
    { at: [350, 628], face: 1.2, text: ['KURKIMÄKI'], kind: 'town' },
    { at: [660, -560], face: -2.6, text: ['RAUTALA'], kind: 'town' },
    { at: [-540, -630], face: 2.3, text: ['RALLI', 'KURKI-SPRINT'], kind: 'brown' },
    { at: [730, 350], face: 2.0, text: ['TILA', 'HAAPALA'], kind: 'blue' },
    { at: [-520, 600], face: Math.PI / 2, text: ['Kurkimäki 9', 'Rautala 28'], kind: 'dir' },
    { at: [170, 640], face: -Math.PI / 2, text: ['Rautala ↑', 'Järvitie'], kind: 'dir' },
  ];
  for (const s of signs) makeSign(scene, terrain, s);
  // speed limit + moose warnings
  for (const [i, kind] of [[400, 'moose'], [2600, '80'], [4400, 'moose'], [5200, '80'], [7000, '60'], [7900, 'moose'], [9200, '80'], [1600, '60']]) {
    const p = S[Math.min(S.length - 1, i)];
    if (!p) continue;
    const off = hw.width / 2 + 2.2;
    makeSign(scene, terrain, { at: [p.x - p.dz * off, p.z + p.dx * off], face: Math.atan2(p.dx, p.dz) + Math.PI, kind });
  }
}

const signCache = {};
function makeSign(scene, terrain, s) {
  const [x, z] = s.at;
  const y = terrain.getHeight(x, z);
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.4 }));
  post.position.y = 1.3; g.add(post);
  let tex2, w = 1.6, h = 0.6;
  if (s.kind === 'moose' || s.kind === '80' || s.kind === '60') {
    const key = s.kind;
    tex2 = signCache[key] ||= canvasTexture(256, 256, (c) => {
      if (key === 'moose') {
        c.fillStyle = '#d02020'; c.beginPath(); c.moveTo(128, 8); c.lineTo(250, 236); c.lineTo(6, 236); c.closePath(); c.fill();
        c.fillStyle = '#f2c400'; c.beginPath(); c.moveTo(128, 40); c.lineTo(220, 216); c.lineTo(36, 216); c.closePath(); c.fill();
        c.fillStyle = '#111'; // simple moose silhouette
        c.beginPath(); c.ellipse(128, 160, 42, 22, 0, 0, Math.PI * 2); c.fill();
        c.fillRect(92, 165, 8, 40); c.fillRect(150, 165, 8, 40); c.fillRect(110, 168, 7, 38); c.fillRect(138, 168, 7, 38);
        c.beginPath(); c.ellipse(172, 135, 16, 10, -0.6, 0, Math.PI * 2); c.fill();
        c.fillRect(176, 108, 4, 18); c.fillRect(170, 104, 18, 4);
      } else {
        c.fillStyle = '#d02020'; c.beginPath(); c.arc(128, 128, 124, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#f2c400'; c.beginPath(); c.arc(128, 128, 98, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#111'; c.font = 'bold 110px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(key, 128, 134);
      }
    });
    w = 0.8; h = 0.8;
  } else {
    const colors = { blue: '#1a4fa0', town: '#1a4fa0', brown: '#6a3a1a', dir: '#1a4fa0' };
    tex2 = canvasTexture(512, 192, (c) => {
      c.fillStyle = '#fff'; c.fillRect(0, 0, 512, 192);
      c.fillStyle = colors[s.kind] || '#1a4fa0'; c.fillRect(8, 8, 496, 176);
      c.fillStyle = '#fff'; c.font = 'bold 64px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const lines = s.text || [];
      lines.forEach((t, i) => { c.font = `bold ${lines.length > 1 ? 58 : 76}px Arial`; c.fillText(t, 256, 96 + (i - (lines.length - 1) / 2) * 66); });
    });
  }
  const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex2, roughness: 0.5, side: THREE.DoubleSide, transparent: s.kind === 'moose' || s.kind === '80' || s.kind === '60', alphaTest: 0.5 }));
  board.position.y = 2.6 - h / 2 + 0.1;
  g.add(board);
  g.position.set(x, y - 0.1, z);
  g.rotation.y = s.face || 0;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
}
