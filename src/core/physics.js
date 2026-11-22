import RAPIER from '@dimforge/rapier3d-compat';

export const GROUPS = { static: 1, player: 2, vehicle: 4, item: 8, npc: 16, ghost: 32 };
const FILTERS = {
  static: 0xffff,
  player: GROUPS.static | GROUPS.vehicle | GROUPS.npc,
  vehicle: 0xffff & ~GROUPS.ghost,
  item: GROUPS.static | GROUPS.vehicle | GROUPS.item,
  npc: GROUPS.static | GROUPS.vehicle | GROUPS.player,
  ghost: 0,
};

export class Physics {
  static async create() {
    await RAPIER.init();
    return new Physics(RAPIER);
  }
  constructor(R) {
    this.R = R;
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.tags = new Map(); // collider handle -> data
    this.acc = 0;
    this.step = 1 / 60;
    this.stepCallbacks = [];
  }
  groups(kind) { return (GROUPS[kind] << 16) | FILTERS[kind]; }
  setGroups(desc, kind) { desc.setCollisionGroups(this.groups(kind)); desc.setSolverGroups(this.groups(kind)); return desc; }
  tag(collider, data) { this.tags.set(collider.handle, data); return collider; }
  untag(collider) { this.tags.delete(collider.handle); }
  tagOf(collider) { return collider ? this.tags.get(collider.handle) : null; }

  // Fixed-step simulation. Callbacks run before each world step.
  update(dt) {
    this.acc += Math.min(dt, 0.1);
    let steps = 0;
    while (this.acc >= this.step && steps < 4) {
      for (const cb of this.stepCallbacks) cb(this.step);
      this.world.step();
      this.acc -= this.step;
      steps++;
    }
    if (steps === 4) this.acc = 0;
    return steps;
  }

  ray(origin, dir, maxDist, { exclude = null, excludeBody = null, mask = 0xffff, predicate = null } = {}) {
    const R = this.R;
    const ray = new R.Ray(origin, dir);
    const groups = (0xffff << 16) | mask;
    const hit = this.world.castRayAndGetNormal(ray, maxDist, true, undefined, groups, exclude || undefined, excludeBody || undefined, predicate || undefined);
    if (!hit) return null;
    return { collider: hit.collider, toi: hit.timeOfImpact, normal: hit.normal, tag: this.tagOf(hit.collider) };
  }
}
