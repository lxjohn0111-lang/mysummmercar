import * as THREE from 'three';

// Draw-call reduction: merge many small meshes that share a material into a few big meshes.
// - batchStatic(): world-space merge of static scenery, clustered into spatial cells so frustum culling still works
// - mergeLocal(): merge the rigid sub-meshes of one object (vehicle body, car part) in its local space

function matKey(m) {
  if (!m) return 'none';
  const c = m.color ? m.color.getHexString() : '';
  const e = m.emissive ? m.emissive.getHexString() + (m.emissiveIntensity ?? 0) : '';
  return [m.type, m.uuid].join('|');
}

// Should this mesh stay untouched? (animated, raycast hitboxes, named lookups, special types)
function keepMesh(o) {
  if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return true;
  if (o.name) return true;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  if (mats.some((m) => !m || m.visible === false || m.vertexColors)) return true;
  if (o.geometry.morphAttributes && Object.keys(o.geometry.morphAttributes).length) return true;
  if (o.userData.interact || o.userData.partInst && o.userData.keep) return true;
  let p = o;
  while (p) { if (p.userData && p.userData.noBatch) return true; p = p.parent; }
  return false;
}

// Split a (possibly multi-material) mesh into [geometry, material] pieces in a target space
function pieces(o, toSpace) {
  const out = [];
  const g = o.geometry;
  const mats = Array.isArray(o.material) ? o.material : null;
  const m4 = new THREE.Matrix4().multiplyMatrices(toSpace, o.matrixWorld);
  const base = g.index ? g : withIndex(g);
  if (mats && base.groups.length) {
    for (const gr of base.groups) {
      const mat = mats[gr.materialIndex];
      if (!mat) continue;
      const sub = new THREE.BufferGeometry();
      for (const [k, a] of Object.entries(base.attributes)) sub.setAttribute(k, a);
      const idx = base.index.array.slice(gr.start, gr.start + gr.count);
      sub.setIndex(new THREE.BufferAttribute(idx, 1));
      out.push([sub, mat, m4]);
    }
  } else out.push([base, mats ? mats[0] : o.material, m4]);
  return out;
}
function withIndex(g) {
  const n = g.attributes.position.count;
  const c = g.clone();
  const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  c.setIndex(new THREE.BufferAttribute(idx, 1));
  return c;
}

// Merge a list of [geometry, matrix] (all indexed) into one indexed geometry
function mergeList(list) {
  const names = new Set();
  for (const [g] of list) for (const k of Object.keys(g.attributes)) names.add(k);
  if (!names.has('normal')) names.add('normal');
  let vCount = 0, iCount = 0;
  for (const [g] of list) { vCount += g.attributes.position.count; iCount += g.index.count; }
  const attrs = {};
  for (const k of names) {
    const ref = list.map(([g]) => g.attributes[k]).find(Boolean);
    const size = ref ? ref.itemSize : (k === 'uv' ? 2 : 3);
    attrs[k] = { size, arr: new Float32Array(vCount * size) };
  }
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0, io = 0;
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const [g, m4] of list) {
    const n = g.attributes.position.count;
    nm.getNormalMatrix(m4);
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of names) {
      const A = attrs[k], src = g.attributes[k];
      if (!src) continue; // stays zero
      for (let i = 0; i < n; i++) {
        if (k === 'position') { v.fromBufferAttribute(src, i).applyMatrix4(m4); A.arr[(vo + i) * 3] = v.x; A.arr[(vo + i) * 3 + 1] = v.y; A.arr[(vo + i) * 3 + 2] = v.z; }
        else if (k === 'normal') { v.fromBufferAttribute(src, i).applyMatrix3(nm).normalize(); A.arr[(vo + i) * 3] = v.x; A.arr[(vo + i) * 3 + 1] = v.y; A.arr[(vo + i) * 3 + 2] = v.z; }
        else for (let c = 0; c < A.size; c++) A.arr[(vo + i) * A.size + c] = src.array[i * src.itemSize + c] ?? 0;
      }
    }
    // keep triangle winding if the transform mirrors
    const flip = m4.determinant() < 0;
    const ia = g.index.array;
    for (let i = 0; i < ia.length; i += 3) {
      if (flip) { idx[io + i] = ia[i] + vo; idx[io + i + 1] = ia[i + 2] + vo; idx[io + i + 2] = ia[i + 1] + vo; }
      else { idx[io + i] = ia[i] + vo; idx[io + i + 1] = ia[i + 1] + vo; idx[io + i + 2] = ia[i + 2] + vo; }
    }
    vo += n; io += ia.length;
  }
  const out = new THREE.BufferGeometry();
  for (const [k, A] of Object.entries(attrs)) out.setAttribute(k, new THREE.BufferAttribute(A.arr, A.size));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

// Merge rigid sub-meshes of `root` in root-local space (kept meshes are left in place)
export function mergeLocal(root, { keep = null } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const victims = [];
  root.traverse((o) => {
    if (o === root || !o.isMesh) return;
    if (keepMesh(o) || (keep && keep(o))) return;
    // skip anything under a kept group (e.g. spinning wheels)
    let p = o.parent, skip = false;
    while (p && p !== root) { if (p.name || (keep && keep(p)) || (p.userData && p.userData.noBatch)) { skip = true; break; } p = p.parent; }
    if (skip) return;
    for (const [g, mat, m4] of pieces(o, inv)) {
      const k = matKey(mat);
      if (!buckets.has(k)) buckets.set(k, { mat, list: [], cast: false, order: 0 });
      const b = buckets.get(k); b.list.push([g, m4]); b.cast ||= o.castShadow; b.order = Math.max(b.order, o.renderOrder || 0);
    }
    victims.push(o);
  });
  if (victims.length < 2) return 0;
  for (const o of victims) o.removeFromParent();
  for (const b of buckets.values()) {
    const m = new THREE.Mesh(mergeList(b.list), b.mat);
    m.castShadow = b.cast; m.receiveShadow = true; m.renderOrder = b.order;
    root.add(m);
  }
  return victims.length;
}

// World-space static batching of scenery, clustered by spatial cells
export function batchStatic(scene, roots, cell = 160) {
  const buckets = new Map();
  const victims = [];
  const ident = new THREE.Matrix4();
  for (const root of roots) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh || keepMesh(o)) return;
      let p = o.parent, skip = false;
      while (p) { if ((p.userData && p.userData.noBatch) || (p.name && p !== root && p.parent !== scene && p.userData.keepName)) { skip = true; break; } p = p.parent; }
      if (skip) return;
      o.geometry.computeBoundingSphere();
      const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
      const cx = Math.floor(c.x / cell), cz = Math.floor(c.z / cell);
      for (const [g, mat, m4] of pieces(o, ident)) {
        const transparent = mat.transparent;
        const k = matKey(mat) + `@${cx},${cz}`;
        if (!buckets.has(k)) buckets.set(k, { mat, list: [], cast: false, order: 0, transparent });
        const b = buckets.get(k); b.list.push([g, m4]); b.cast ||= o.castShadow; b.order = Math.max(b.order, o.renderOrder || 0);
      }
      victims.push(o);
    });
  }
  for (const o of victims) o.removeFromParent();
  const group = new THREE.Group(); group.name = 'staticBatch';
  for (const b of buckets.values()) {
    const m = new THREE.Mesh(mergeList(b.list), b.mat);
    m.castShadow = b.cast; m.receiveShadow = true; m.renderOrder = b.order;
    group.add(m);
  }
  scene.add(group);
  return { merged: victims.length, meshes: buckets.size };
}
