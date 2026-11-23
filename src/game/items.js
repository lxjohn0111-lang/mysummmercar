import * as THREE from 'three';
import { mats } from '../world/mats.js';
import { roundBox, canvasTexture } from '../core/util.js';
import { tex } from '../core/assets.js';
import { audio } from '../core/audio.js';
import * as IM from './itemmodels.js';

// ---------------------------------------------------------------- item meshes
const labelCache = {};
function label(text, bg, fg, w = 128, h = 64) {
  const k = text + bg + fg;
  return (labelCache[k] ||= canvasTexture(w, h, (c) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = fg; c.font = `bold ${Math.floor(h * 0.42)}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((l, i) => c.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * h * 0.45));
  }));
}
const mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; };

function bottleMesh(color = 0x4a2a08, lbl = 'KURKI\nOLUT', empty = false) {
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color, roughness: 0.08, metalness: 0.1, transparent: true, opacity: empty ? 0.55 : 0.92 });
  const body = new THREE.LatheGeometry([[0, 0], [0.032, 0], [0.034, 0.01], [0.034, 0.15], [0.03, 0.18], [0.014, 0.21], [0.013, 0.25], [0, 0.25]].map(([x, y]) => new THREE.Vector2(x, y)), 14);
  body.translate(0, -0.125, 0);
  g.add(mesh(body, glass));
  const l = mesh(new THREE.CylinderGeometry(0.0345, 0.0345, 0.07, 14, 1, true), new THREE.MeshStandardMaterial({ map: label(lbl, '#e8d8a0', '#7a1a10'), roughness: 0.6 }));
  l.position.y = -0.04; g.add(l);
  if (!empty) { const cap = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.012, 10), mats().chrome); cap.position.y = 0.128; g.add(cap); }
  return g;
}
function canMesh(color, lbl) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 16), new THREE.MeshStandardMaterial({ map: label(lbl, color, '#fff'), roughness: 0.3, metalness: 0.6 })));
  return g;
}
function boxMesh(w, h, d, color, lbl, fg = '#fff') {
  const t = lbl ? label(lbl, color, fg, 256, 128) : null;
  const mat = new THREE.MeshStandardMaterial({ color: t ? 0xffffff : color, map: t, roughness: 0.7 });
  return mesh(new THREE.BoxGeometry(w, h, d), mat);
}
function jugMesh(color, lbl, size = 1) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  g.add(mesh(roundBox(0.18 * size, 0.26 * size, 0.1 * size, 0.02), m));
  const neck = mesh(new THREE.CylinderGeometry(0.02 * size, 0.02 * size, 0.05 * size, 10), mats().blackPlastic); neck.position.set(0.05 * size, 0.15 * size, 0); g.add(neck);
  const l = mesh(new THREE.PlaneGeometry(0.12 * size, 0.1 * size), new THREE.MeshStandardMaterial({ map: label(lbl, '#f0f0f0', '#111'), roughness: 0.6 })); l.position.set(0, -0.02, 0.051 * size); g.add(l);
  return g;
}
function sausageMesh(cooked) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: cooked ? 0x7a3a1a : 0xc8806a, roughness: cooked ? 0.6 : 0.4 });
  const s = mesh(new THREE.CapsuleGeometry(0.028, 0.16, 4, 10), m); s.rotation.z = Math.PI / 2; g.add(s);
  if (!cooked) { const pk = mesh(new THREE.BoxGeometry(0.24, 0.07, 0.1), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.1 })); g.add(pk); }
  return g;
}
function fishMesh(kind) {
  const g = new THREE.Group();
  const col = kind === 'pike' ? 0x5a6a3a : kind === 'perch' ? 0x7a8a4a : 0x9a9a8a;
  const len = kind === 'pike' ? 0.55 : 0.25;
  const b = mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.3 }));
  b.scale.set(len, len * 0.28, len * 0.12); g.add(b);
  const tail = mesh(new THREE.ConeGeometry(len * 0.15, len * 0.25, 4), b.material); tail.rotation.z = Math.PI / 2; tail.position.x = -len * 0.55; g.add(tail);
  return g;
}

// ---------------------------------------------------------------- item definitions
// half: collider half extents; use(game, ent) returns true if consumed/handled
export const ITEMS = {
  beer: {
    name: 'Kurki Olut (beer)', half: [0.035, 0.125, 0.035], mass: 0.6, price: 4.5, build: () => bottleMesh(),
    useLabel: 'Drink', use: (g, e) => { g.actions.consume({ thirst: -12, hunger: -2, drunk: 0.11, stress: -7, bladder: 16, sound: 'gulp', after: 'emptyBottle', msg: 'Kippis!', burp: true }, e); return true; },
  },
  emptyBottle: { name: 'Empty bottle (0.50 mk deposit)', half: [0.035, 0.125, 0.035], mass: 0.3, build: () => bottleMesh(0x4a2a08, 'KURKI\nOLUT', true) },
  beerCase: {
    name: 'Case of Kurki Olut', half: [0.2, 0.14, 0.14], mass: 9, price: 58, build: (e) => {
      const g = new THREE.Group();
      g.add(boxMesh(0.4, 0.28, 0.28, '#c8a020', 'KURKI OLUT\n24 x 0.33', '#5a1a0a'));
      return g;
    },
    stack: 24, useLabel: (e) => `Take a beer (${e.count} left)`,
    use: (g, e) => { if (e.count <= 0) { g.ui.toast('The case is empty.'); return false; } e.count--; g.actions.spawnInHand('beer'); if (e.count <= 0) e.def.name = 'Empty beer case'; return true; },
  },
  lonkero: {
    name: 'Lonkero (long drink)', half: [0.033, 0.06, 0.033], mass: 0.4, price: 6, build: () => canMesh('#d02a40', 'LONK'),
    useLabel: 'Drink', use: (g, e) => { g.actions.consume({ thirst: -12, drunk: 0.14, stress: -8, bladder: 15, sound: 'gulp', msg: 'Grapefruit and gin. Classic.' }, e); return true; },
  },
  soda: {
    name: 'Lemon soda', half: [0.033, 0.06, 0.033], mass: 0.4, price: 3, build: () => canMesh('#e8c820', 'LIMU'),
    useLabel: 'Drink', use: (g, e) => { g.actions.consume({ thirst: -22, stress: -2, bladder: 12, sound: 'gulp' }, e); return true; },
  },
  milk: {
    name: 'Milk carton', half: [0.045, 0.1, 0.045], mass: 1.0, price: 4, build: () => boxMesh(0.09, 0.2, 0.09, '#2a6ab8', 'MAITO'),
    useLabel: 'Drink', use: (g, e) => { g.actions.consume({ thirst: -30, hunger: -10, bladder: 14, sound: 'gulp' }, e); return true; },
  },
  coffee: {
    name: 'Thermos of coffee', half: [0.045, 0.14, 0.045], mass: 0.8, price: 7, build: () => { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 14), new THREE.MeshStandardMaterial({ color: 0xb02a1a, roughness: 0.3, metalness: 0.5 }))); return g; },
    useLabel: 'Drink coffee', use: (g, e) => { g.actions.consume({ thirst: -15, fatigue: -22, stress: 4, bladder: 12, sound: 'gulp', msg: 'Strong enough to stand a spoon in.' }, e); return true; },
  },
  sausage: {
    name: 'Sausage (raw)', half: [0.12, 0.035, 0.05], mass: 0.4, price: 7, build: () => sausageMesh(false), cookTo: 'sausageCooked',
    useLabel: 'Eat raw (bad idea)', use: (g, e) => { g.actions.consume({ hunger: -15, stress: 6, msg: 'Raw sausage... your stomach is not happy.', sound: 'eat', sick: true }, e); return true; },
  },
  sausageCooked: {
    name: 'Grilled sausage', half: [0.11, 0.03, 0.03], mass: 0.3, build: () => sausageMesh(true),
    useLabel: 'Eat', use: (g, e) => { g.actions.consume({ hunger: -38, stress: -6, thirst: 5, sound: 'eat', msg: 'Makkara. The national dish.' }, e); return true; },
  },
  bread: {
    name: 'Rye bread (ruisleipä)', half: [0.1, 0.03, 0.1], mass: 0.5, price: 4, build: () => { const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.9 }); const b = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), m); g.add(b); const h = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8), new THREE.MeshStandardMaterial({ color: 0x8a6a4a })); g.add(h); return g; },
    useLabel: 'Eat', use: (g, e) => { g.actions.consume({ hunger: -28, thirst: 8, sound: 'eat' }, e); return true; },
  },
  pizza: {
    name: 'Frozen pizza', half: [0.14, 0.02, 0.14], mass: 0.4, price: 9, build: () => boxMesh(0.28, 0.04, 0.28, '#c02020', 'PIZZA'), cookTo: 'pizzaHot',
    useLabel: 'Eat frozen (crunchy)', use: (g, e) => { g.actions.consume({ hunger: -20, stress: 8, sound: 'eat', msg: 'It is frozen solid. Brave.' }, e); return true; },
  },
  pizzaHot: {
    name: 'Hot pizza', half: [0.13, 0.015, 0.13], mass: 0.35, build: () => { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 20), new THREE.MeshStandardMaterial({ color: 0xd8902a, roughness: 0.7 }))); return g; },
    useLabel: 'Eat', use: (g, e) => { g.actions.consume({ hunger: -55, thirst: 10, stress: -8, sound: 'eat' }, e); return true; },
  },
  chips: {
    name: 'Potato chips', half: [0.1, 0.13, 0.04], mass: 0.2, price: 4, build: () => boxMesh(0.2, 0.26, 0.08, '#e8a020', 'SIPSI'),
    useLabel: 'Eat', use: (g, e) => { g.actions.consume({ hunger: -15, thirst: 12, stress: -3, sound: 'eat' }, e); return true; },
  },
  candy: {
    name: 'Salmiakki (salty liquorice)', half: [0.06, 0.08, 0.02], mass: 0.1, price: 3, build: () => boxMesh(0.12, 0.16, 0.04, '#111', 'SALMIAKKI'),
    useLabel: 'Eat', use: (g, e) => { g.actions.consume({ hunger: -6, stress: -6, thirst: 6, sound: 'eat', msg: 'Salty. Black. Perfect.' }, e); return true; },
  },
  fishRaw: {
    name: 'Fish', half: [0.15, 0.04, 0.04], mass: 0.6, build: (e) => fishMesh(e?.data?.kind || 'perch'), cookTo: 'fishCooked',
    useLabel: 'Eat raw (sushi?)', use: (g, e) => { g.actions.consume({ hunger: -18, stress: 10, sound: 'eat', sick: true, msg: 'Raw lake fish. Hmm.' }, e); return true; },
  },
  fishCooked: {
    name: 'Fried fish', half: [0.14, 0.03, 0.04], mass: 0.5, build: () => { const g = fishMesh('perch'); g.children[0].material = new THREE.MeshStandardMaterial({ color: 0xa8702a, roughness: 0.6 }); return g; },
    useLabel: 'Eat', use: (g, e) => { g.actions.consume({ hunger: -45, stress: -5, sound: 'eat' }, e); return true; },
  },
  // ---- fluids & tools
  oilCan: {
    name: 'Engine oil 4 L', half: [0.09, 0.13, 0.05], mass: 4, price: 55, build: () => jugMesh(0xd8b020, 'MOOTTORI-\nÖLJY'),
    fluid: 'oil', capacity: 4, useLabel: 'Pour oil (aim at engine)', use: (g, e) => g.actions.pourFluid(e),
  },
  coolant: {
    name: 'Coolant 4 L', half: [0.09, 0.13, 0.05], mass: 4, price: 35, build: () => jugMesh(0x30a040, 'JÄÄHDYTIN-\nNESTE'),
    fluid: 'coolant', capacity: 4, useLabel: 'Pour coolant (aim at radiator)', use: (g, e) => g.actions.pourFluid(e),
  },
  brakeFluid: {
    name: 'Brake fluid 1 L', half: [0.05, 0.09, 0.05], mass: 1, price: 25, build: () => jugMesh(0xe8e8e0, 'JARRU-\nNESTE', 0.6),
    fluid: 'brake', capacity: 1, useLabel: 'Pour brake fluid', use: (g, e) => g.actions.pourFluid(e),
  },
  fuelCan: {
    name: 'Jerry can', half: [0.17, 0.22, 0.08], mass: 2, price: 45, build: () => { const g = new THREE.Group(); g.add(mesh(roundBox(0.34, 0.44, 0.16, 0.03), new THREE.MeshStandardMaterial({ color: 0x2a6a2a, roughness: 0.5, metalness: 0.4 }))); const h = mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), mats().darkMetal); h.position.y = 0.24; g.add(h); return g; },
    fluid: 'fuel', capacity: 20, startEmpty: true, useLabel: (e) => `Pour fuel (${(e.data.amount || 0).toFixed(1)} L)`, use: (g, e) => g.actions.pourFluid(e),
  },
  sprayCan: {
    name: 'Spray paint', half: [0.03, 0.1, 0.03], mass: 0.4, price: 35, build: (e) => { const g = new THREE.Group(); const c = new THREE.Color(e?.data?.color ?? 0xb02018); g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 12), new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.6 }))); const t = mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.03, 8), mats().white); t.position.y = 0.1; g.add(t); return g; },
    useLabel: 'Spray paint (aim at the car body)', use: (g, e) => g.actions.spray(e),
  },
  axe: {
    name: 'Axe', half: [0.05, 0.4, 0.1], mass: 1.5, build: () => { const g = new THREE.Group(); const h = mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.75, 8), new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.6 })); g.add(h); const b = mesh(new THREE.BoxGeometry(0.03, 0.1, 0.18), mats().darkMetal); b.position.set(0, 0.32, 0.06); g.add(b); return g; },
    useLabel: 'Swing axe', use: (g, e) => g.actions.swingAxe(e), tool: true,
  },
  log: {
    name: 'Birch log', half: [0.13, 0.25, 0.13], mass: 9, build: () => { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 10), [new THREE.MeshStandardMaterial({ map: tex('bark_birch.jpg'), roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0xd8b888, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0xd8b888, roughness: 0.9 })])); return g; },
  },
  firewood: {
    name: 'Firewood', half: [0.06, 0.06, 0.22], mass: 1.2, build: () => { const g = new THREE.Group(); const s = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.44, 3), [new THREE.MeshStandardMaterial({ map: tex('bark_birch.jpg'), roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0xd8b888 }), new THREE.MeshStandardMaterial({ color: 0xd8b888 })]); s.rotation.x = Math.PI / 2; g.add(s); return g; },
  },
  fishingRod: {
    name: 'Fishing rod', half: [0.03, 0.03, 0.8], mass: 0.6, price: 60, build: () => { const g = new THREE.Group(); const r = mesh(new THREE.CylinderGeometry(0.005, 0.014, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.3 })); r.rotation.x = Math.PI / 2; g.add(r); const reel = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), mats().metal); reel.position.set(0, -0.03, -0.55); reel.rotation.z = Math.PI / 2; g.add(reel); return g; },
    useLabel: 'Cast line (stand near water)', use: (g, e) => g.actions.fish(e),
  },
  newspaper: {
    name: 'Newspaper', half: [0.12, 0.02, 0.08], mass: 0.3, build: () => boxMesh(0.24, 0.04, 0.16, '#e8e4d8', 'KURKI-\nSANOMAT', '#222'),
  },
  deliveryBox: {
    name: 'Delivery box', half: [0.25, 0.2, 0.2], mass: 8, build: (e) => { const g = new THREE.Group(); g.add(boxMesh(0.5, 0.4, 0.4, '#b08a58', e?.data?.dest ? `→ ${e.data.dest}` : 'FRAGILE', '#2a1a0a')); return g; },
  },
  hayBale: {
    name: 'Hay bale', half: [0.6, 0.6, 0.6], mass: 250, build: () => { const g = new THREE.Group(); const m = mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.2, 20), new THREE.MeshStandardMaterial({ color: 0xf0f0ea, roughness: 0.35 })); m.rotation.z = Math.PI / 2; g.add(m); return g; }, noCarry: true,
  },
  mail: {
    name: 'Letter', half: [0.1, 0.005, 0.06], mass: 0.05, build: (e) => boxMesh(0.2, 0.01, 0.12, '#f4f0e4', e?.data?.title || 'POSTI', '#333'),
    useLabel: 'Read', use: (g, e) => g.actions.readMail(e),
  },
  trophy: {
    name: 'Rally trophy', half: [0.08, 0.15, 0.08], mass: 1.5, build: () => { const g = new THREE.Group(); const gold = new THREE.MeshStandardMaterial({ color: 0xe8b830, metalness: 1, roughness: 0.2 }); const c = mesh(new THREE.CylinderGeometry(0.08, 0.03, 0.15, 16), gold); c.position.y = 0.06; g.add(c); g.add(mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), mats().darkWood)); return g; },
  },
  antler: {
    name: 'Moose antler (collectible)', half: [0.25, 0.05, 0.2], mass: 2, build: () => { const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 0.7 }); const p = mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.04, 8, 1, false, 0, Math.PI), m); g.add(p); for (let i = 0; i < 5; i++) { const t = mesh(new THREE.ConeGeometry(0.02, 0.14, 5), m); t.position.set(Math.cos(i * 0.7) * 0.22, 0.04, Math.sin(i * 0.7) * 0.22); t.rotation.x = -0.4; g.add(t); } return g; },
  },
  ratchet: {
    name: 'Ratchet set (faster bolting)', half: [0.15, 0.04, 0.08], mass: 2, price: 180, build: () => boxMesh(0.3, 0.08, 0.16, '#b02018', 'RATCHET SET'),
    useLabel: 'Equip ratchet set', use: (g, e) => { g.state.ratchet = true; g.ui.toast('Ratchet set equipped: bolting is twice as fast.'); g.items.remove(e); return true; },
  },
  afrGauge: {
    name: 'Mixture & timing gauge', half: [0.08, 0.06, 0.04], mass: 0.6, price: 240, build: () => boxMesh(0.16, 0.12, 0.08, '#1a1a1a', 'AFR\n13.2', '#30ff60'),
    useLabel: 'Equip tuning gauge', use: (g, e) => { g.state.afrGauge = true; g.ui.toast('Tuning gauge equipped: you now see mixture and timing readings.'); g.items.remove(e); return true; },
  },
  firstAid: {
    name: 'First aid kit', half: [0.12, 0.05, 0.08], mass: 0.5, price: 30, build: () => boxMesh(0.24, 0.1, 0.16, '#f0f0f0', '✚', '#c02020'),
    useLabel: 'Patch yourself up', use: (g, e) => { g.player.n.health = Math.min(100, g.player.n.health + 45); g.ui.toast('Feeling better.'); g.items.remove(e); return true; },
  },
  shoppingBag: {
    name: 'Shopping bag', half: [0.15, 0.17, 0.1], mass: 2, build: () => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.3, 0.34, 0.18), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.6, map: label('KURKIMÄEN\nKAUPPA', '#ffffff', '#b02018') }))); return g; },
    useLabel: (e) => `Unpack bag (${(e.data.contents || []).length} items)`, use: (g, e) => g.actions.unpackBag(e),
  },
};

// detailed models (itemmodels.js) replace the simple placeholder meshes above
const BUILD = {
  beer: () => IM.bottle(), emptyBottle: () => IM.bottle(0x4a2a08, 'KURKI', true), beerCase: () => IM.beerCase(),
  lonkero: () => IM.can('#d02a40', '#ffffff', 'LONKERO'), soda: () => IM.can('#e8c820', '#1a4a1a', 'LIMU'),
  milk: () => IM.milkCarton(), coffee: () => IM.thermos(),
  sausage: () => IM.sausage(false), sausageCooked: () => IM.sausage(true), bread: () => IM.ryeBread(),
  pizza: () => IM.pizzaBox(), pizzaHot: () => IM.pizzaHot(), chips: () => IM.chipsBag(), candy: () => IM.salmiakki(),
  fishRaw: (e) => IM.fish(e?.data?.kind || 'perch'), fishCooked: () => IM.fish('perch', true),
  oilCan: () => IM.jug(0xd8b020, 'MOOTTORI-\nÖLJY', '4 L · 10W-40'), coolant: () => IM.jug(0x30a040, 'JÄÄHDYTIN-\nNESTE', '4 L'), brakeFluid: () => IM.jug(0xe8e8e0, 'JARRU-\nNESTE', '1 L · DOT 4', 0.6),
  fuelCan: () => IM.jerryCan(), sprayCan: (e) => IM.sprayCan(e?.data?.color ?? 0xb02018), axe: () => IM.axe(), log: () => IM.log(), firewood: () => IM.firewood(),
  fishingRod: () => IM.fishingRod(), newspaper: () => IM.newspaper(), deliveryBox: (e) => IM.deliveryBox(e?.data?.dest), hayBale: () => IM.hayBale(),
  mail: (e) => IM.letter(e?.data?.title), trophy: () => IM.trophy(), antler: () => IM.antler(), ratchet: () => IM.toolCase(0xb02018, 'RATCHET SET'),
  afrGauge: () => IM.gauge(), firstAid: () => IM.firstAid(), shoppingBag: () => IM.shoppingBag(),
};
for (const [k, b] of Object.entries(BUILD)) if (ITEMS[k]) ITEMS[k].build = b;

// ---------------------------------------------------------------- physical entity system
export class Items {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.byHandle = new Map();
    this.nextId = 1;
  }

  // def: string id in ITEMS, or part object (from parts system)
  spawn(defId, pos, { rot = null, data = {}, count = null, part = null, vel = null, sleeping = false } = {}) {
    const g = this.game, ph = g.physics, R = ph.R;
    const def = part ? part.def : { ...ITEMS[defId], id: defId };
    if (!def) { console.warn('unknown item', defId); return null; }
    const e = { id: this.nextId++, defId: part ? null : defId, def, data: { ...data }, part, count: count ?? def.stack ?? 1 };
    if (def.fluid && e.data.amount === undefined) e.data.amount = def.startEmpty ? 0 : def.capacity;
    e.mesh = part ? part.mesh : def.build(e);
    e.mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.scene.add(e.mesh);
    const h = def.half || [0.1, 0.1, 0.1];
    const bd = R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setLinearDamping(0.1).setAngularDamping(0.3).setCcdEnabled((def.mass || 1) < 5);
    if (rot) bd.setRotation(rot);
    if (sleeping) bd.setSleeping(true);
    e.body = ph.world.createRigidBody(bd);
    const vol = h[0] * h[1] * h[2] * 8;
    const cd = R.ColliderDesc.cuboid(h[0], h[1], h[2]).setDensity((def.mass || 1) / Math.max(vol, 1e-4)).setFriction(0.8).setRestitution(0.15);
    if (h.offset) cd.setTranslation(...h.offset);
    ph.setGroups(cd, 'item');
    e.collider = ph.world.createCollider(cd, e.body);
    ph.tag(e.collider, { item: e, surface: 'item' });
    if (vel) e.body.setLinvel(vel, true);
    this.list.push(e);
    this.byHandle.set(e.collider.handle, e);
    e.lastImpact = 0;
    return e;
  }

  remove(e) {
    const g = this.game, ph = g.physics;
    if (g.interact.held === e) g.interact.drop(true);
    if (e.body) { ph.untag(e.collider); this.byHandle.delete(e.collider.handle); ph.world.removeRigidBody(e.body); e.body = null; e.collider = null; }
    if (!e.part) { e.mesh.removeFromParent(); }
    const i = this.list.indexOf(e); if (i >= 0) this.list.splice(i, 1);
  }

  // Convert a physical entity into an attached (kinematic visual) object: removes physics, keeps mesh
  detachPhysics(e) {
    const ph = this.game.physics;
    if (!e.body) return;
    ph.untag(e.collider); this.byHandle.delete(e.collider.handle);
    ph.world.removeRigidBody(e.body); e.body = null; e.collider = null;
    const i = this.list.indexOf(e); if (i >= 0) this.list.splice(i, 1);
  }

  update(dt) {
    for (const e of this.list) {
      if (!e.body) continue;
      const t = e.body.translation(), r = e.body.rotation();
      e.mesh.position.set(t.x, t.y, t.z);
      e.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      // impact sounds
      const v = e.body.linvel();
      const sp = Math.hypot(v.x, v.y, v.z);
      if (e.prevSpeed !== undefined && e.prevSpeed - sp > 2.5 && performance.now() - e.lastImpact > 150) {
        e.lastImpact = performance.now();
        const k = Math.min(1, (e.prevSpeed - sp) / 8);
        const kind = e.part ? (e.def.material === 'rubber' ? 'thud' : 'metal') : (e.defId === 'beer' || e.defId === 'emptyBottle') ? 'glass' : 'thud';
        audio.play(kind, e.mesh.position, k);
        // bottles may break on hard impacts
        if ((e.defId === 'beer' || e.defId === 'emptyBottle') && e.prevSpeed - sp > 9 && this.game.interact.held !== e) {
          audio.play('shatter', e.mesh.position);
          this.remove(e); break;
        }
      }
      e.prevSpeed = sp;
      if (t.y < -30) { this.respawnLost(e); }
    }
  }

  respawnLost(e) {
    const p = this.game.spots.garage;
    e.body.setTranslation({ x: p.x, y: p.y + 1.5, z: p.z }, true);
    e.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  fromCollider(c) { return c ? this.byHandle.get(c.handle) : null; }
}
