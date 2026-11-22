import * as THREE from 'three';
import { mats, boxUV } from './mats.js';

// Helper to assemble static buildings with matching physics colliders, in a local frame.
export class Builder {
  constructor(game, x, y, z, ry = 0) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);
    this.group.rotation.y = ry;
    this.ry = ry;
    this.origin = new THREE.Vector3(x, y, z);
    this.q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    game.scene.add(this.group);
    (game.builders ||= []).push(this);
    const R = game.physics.R;
    this.body = game.physics.world.createRigidBody(R.RigidBodyDesc.fixed());
    this.M = mats();
  }
  w(lx, ly, lz) { return new THREE.Vector3(lx, ly, lz).applyQuaternion(this.q).add(this.origin); }

  col(w, h, d, lx, ly, lz, ry = 0, surface = 'wood') {
    const ph = this.game.physics, R = ph.R;
    const p = this.w(lx, ly, lz);
    const q = this.q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry));
    const desc = R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    ph.setGroups(desc, 'static');
    const c = ph.world.createCollider(desc, this.body);
    ph.tag(c, { surface });
    return c;
  }

  box(w, h, d, lx, ly, lz, mat, { col = true, cast = true, receive = true, ry = 0, rx = 0, rz = 0, uv = 2, surface = 'wood' } = {}) {
    const m = new THREE.Mesh(boxUV(w, h, d, uv), mat);
    m.position.set(lx, ly, lz); m.rotation.set(rx, ry, rz);
    m.castShadow = cast; m.receiveShadow = receive;
    this.group.add(m);
    if (col) this.col(w, h, d, lx, ly, lz, ry, surface);
    return m;
  }

  add(obj, lx, ly, lz, ry = 0) {
    obj.position.set(lx, ly, lz); obj.rotation.y = ry;
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });
    this.group.add(obj);
    return obj;
  }

  // Wall running along X (from x0 to x1) at z, exterior face direction outZ (+1 or -1)
  wallX(x0, x1, z, h, t, outer, inner, openings = [], outZ = 1, y0 = 0) { return this._wall('x', x0, x1, z, h, t, outer, inner, openings, outZ, y0); }
  wallZ(z0, z1, x, h, t, outer, inner, openings = [], outX = 1, y0 = 0) { return this._wall('z', z0, z1, x, h, t, outer, inner, openings, outX, y0); }

  _wall(axis, a0, a1, c, h, t, outer, inner, openings, outDir, y0) {
    const M = this.M;
    // material array for box faces: +x,-x,+y,-y,+z,-z
    const mk = (len) => {
      const edge = inner || outer;
      if (axis === 'x') return outDir > 0 ? [edge, edge, edge, edge, outer, inner || outer] : [edge, edge, edge, edge, inner || outer, outer];
      return outDir > 0 ? [outer, inner || outer, edge, edge, edge, edge] : [inner || outer, outer, edge, edge, edge, edge];
    };
    const seg = (s0, s1, yb, yt) => {
      const len = s1 - s0, hh = yt - yb; if (len < 0.01 || hh < 0.01) return;
      const mid = (s0 + s1) / 2;
      const g = axis === 'x' ? boxUV(len, hh, t, 2) : boxUV(t, hh, len, 2);
      const m = new THREE.Mesh(g, mk(len));
      if (axis === 'x') m.position.set(mid, y0 + (yb + yt) / 2, c); else m.position.set(c, y0 + (yb + yt) / 2, mid);
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
      if (axis === 'x') this.col(len, hh, t, mid, y0 + (yb + yt) / 2, c); else this.col(t, hh, len, c, y0 + (yb + yt) / 2, mid);
    };
    const ops = openings.slice().sort((p, q) => p.a - q.a);
    let cur = a0;
    for (const o of ops) {
      seg(cur, o.a, 0, h);
      seg(o.a, o.b, 0, o.y0);
      seg(o.a, o.b, o.y1, h);
      if (o.type === 'window') this._window(axis, o, c, t, outDir, y0, o.lit);
      cur = o.b;
    }
    seg(cur, a1, 0, h);
  }

  _window(axis, o, c, t, outDir, y0, lit) {
    const M = this.M;
    const w = o.b - o.a, h = o.y1 - o.y0, mid = (o.a + o.b) / 2, my = y0 + (o.y0 + o.y1) / 2;
    const glassMat = lit ? M.windowLit : M.glass;
    const fr = 0.07;
    const parts = [];
    const add = (gw, gh, gd, px, py, pz, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, gd), mat);
      if (axis === 'x') m.position.set(px, py, pz); else { m.position.set(pz, py, px); m.rotation.y = Math.PI / 2; }
      this.group.add(m); return m;
    };
    const cz = c + outDir * (t / 2 - 0.04);
    // frame
    add(w, fr, 0.1, mid, y0 + o.y0 + fr / 2, cz, M.whitePaint);
    add(w, fr, 0.1, mid, y0 + o.y1 - fr / 2, cz, M.whitePaint);
    add(fr, h, 0.1, o.a + fr / 2, my, cz, M.whitePaint);
    add(fr, h, 0.1, o.b - fr / 2, my, cz, M.whitePaint);
    add(fr * 0.7, h, 0.08, mid, my, cz, M.whitePaint); // mullion
    if (h > 1) add(w, fr * 0.7, 0.08, mid, my + h * 0.15, cz, M.whitePaint);
    // outer trim
    add(w + 0.2, 0.06, 0.16, mid, y0 + o.y0 - 0.03, c + outDir * (t / 2 + 0.03), M.whitePaint);
    add(w + 0.24, 0.12, 0.06, mid, y0 + o.y1 + 0.06, c + outDir * (t / 2 + 0.03), M.whitePaint);
    const gl = add(w - fr, h - fr, 0.02, mid, my, cz, glassMat);
    gl.renderOrder = 3;
    if (!lit) gl.castShadow = false;
  }

  floor(w, d, lx, ly, lz, mat, uv = 2) { return this.box(w, 0.12, d, lx, ly - 0.06, lz, mat, { uv, surface: mat === this.M.concrete ? 'concrete' : 'wood', cast: false }); }
  ceiling(w, d, lx, ly, lz, mat) { return this.box(w, 0.08, d, lx, ly + 0.04, lz, mat, { col: false, cast: false }); }

  // Gable roof: ridge along X; spans w (x) by d (z); base at y, rise r
  gable(w, d, y, r, over, roofMat, gableMat, fascia = true) {
    const M = this.M;
    const halfD = d / 2 + over, slopeLen = Math.hypot(halfD, r);
    const ang = Math.atan2(r, halfD);
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(boxUV(w + over * 2, 0.08, slopeLen, 2.5), roofMat);
      m.position.set(0, y + r / 2 + 0.04, s * halfD / 2);
      m.rotation.x = s * ang;
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
      if (fascia) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(w + over * 2, 0.2, 0.04), M.whitePaint);
        f.position.set(0, y - 0.05, s * (halfD - 0.02)); this.group.add(f);
      }
    }
    // gable triangles
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, r); shape.closePath();
    const tg = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
    const uv = tg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(tg, gableMat);
      m.rotation.y = Math.PI / 2; m.position.set(s * (w / 2) - 0.06, y, 0);
      m.castShadow = true; this.group.add(m);
      if (fascia) for (const side of [1, -1]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, slopeLen + 0.05), M.whitePaint);
        b.position.set(s * (w / 2 + over), y + r / 2, side * halfD / 2); b.rotation.x = side * ang; this.group.add(b);
      }
    }
    // ridge cap
    const rc = new THREE.Mesh(new THREE.BoxGeometry(w + over * 2, 0.1, 0.3), roofMat); rc.position.set(0, y + r + 0.08, 0); this.group.add(rc);
  }

  // Simple corner boards (white trims typical of Finnish houses)
  corners(w, d, h, y = 0) {
    for (const [x, z] of [[w / 2, d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16), this.M.whitePaint);
      m.position.set(x, y + h / 2, z); m.castShadow = true; this.group.add(m);
    }
  }

  // Invisible interaction volume
  hit(w, h, d, lx, ly, lz, data) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.M.hidden);
    m.position.set(lx, ly, lz);
    this.group.add(m);
    m.updateMatrixWorld(true);
    const it = { mesh: m, pos: this.w(lx, ly, lz), ...data };
    m.userData.interact = it;
    this.game.interactables.push(it);
    return it;
  }

  // Hinged door: returns door object with toggle()
  door(lx, lz, w, h, alongX, mat, { y0 = 0, hingeLeft = true, label = 'Door', locked = null } = {}) {
    const pivot = new THREE.Group();
    pivot.userData.noBatch = true;
    pivot.position.set(lx + (alongX ? (hingeLeft ? -w / 2 : w / 2) : 0), y0, lz + (alongX ? 0 : (hingeLeft ? -w / 2 : w / 2)));
    const panel = new THREE.Mesh(boxUV(alongX ? w : 0.05, h, alongX ? 0.05 : w, 1.5), mat);
    panel.position.set(alongX ? (hingeLeft ? w / 2 : -w / 2) : 0, h / 2, alongX ? 0 : (hingeLeft ? w / 2 : -w / 2));
    panel.castShadow = true;
    pivot.add(panel);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), this.M.metal);
    knob.position.set(alongX ? (hingeLeft ? w - 0.1 : -w + 0.1) : 0.05, h * 0.47, alongX ? 0.05 : (hingeLeft ? w - 0.1 : -w + 0.1));
    pivot.add(knob);
    const knob2 = knob.clone(); knob2.position.set(alongX ? knob.position.x : -0.05, knob.position.y, alongX ? -0.05 : knob.position.z); pivot.add(knob2);
    this.group.add(pivot);
    const collider = this.col(alongX ? w : 0.08, h, alongX ? 0.08 : w, lx, y0 + h / 2, lz);
    const door = { open: false, angle: 0, target: 0, pivot, collider, sign: hingeLeft ? 1 : -1 };
    const B = this;
    door.toggle = () => {
      if (!door.open && locked && locked()) { B.game.ui?.toast(locked()); return; }
      door.open = !door.open; door.target = door.open ? -door.sign * Math.PI * 0.55 : 0;
      collider.setEnabled(!door.open);
      B.game.audio?.play(door.open ? 'doorOpen' : 'door', B.w(lx, y0 + 1, lz));
    };
    this.hit(alongX ? w : 0.3, h, alongX ? 0.3 : w, lx, y0 + h / 2, lz, { label: () => (door.open ? `Close ${label}` : `Open ${label}`), use: door.toggle });
    this.game.doors.push(door);
    return door;
  }
}
