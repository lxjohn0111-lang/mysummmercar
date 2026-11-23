import * as THREE from 'three';
import { Builder } from './builder.js';
import { mats, boxUV } from './mats.js';
import * as PR from './props.js';
import { P, SITES, WATER_LEVEL } from './layout.js';
import { canvasTexture } from '../core/util.js';
import { tex } from '../core/assets.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const siteH = (p) => SITES.find((s) => s.x === p.x && s.z === p.z)?.h;

export function buildLocations(game) {
  game.spots = {};
  buildHome(game);
  buildGarage(game);
  buildSauna(game);
  buildShed(game);
  buildVillage(game);
  buildTown(game);
  buildFarm(game);
  buildRally(game);
  buildJunkyard(game);
  buildCottage(game);
  // clear grass, trees and rocks under every building footprint
  const box = new THREE.Box3();
  for (const b of game.builders) {
    box.setFromObject(b.group);
    if (box.isEmpty()) continue;
    const pad = 0.6;
    game.terrain.clearGrass(box.min.x - pad, box.max.x + pad, box.min.z - pad, box.max.z + pad);
    game.vegetation.clearArea(box.min.x - 1.5, box.max.x + 1.5, box.min.z - 1.5, box.max.z + 1.5);
  }
  game.terrain.splatTex.needsUpdate = true;
}

function light(game, pos, color = 0xffd8a8, intensity = 6, range = 9, on = null) {
  game.lightSpots.push({ pos, color, intensity, range, on: on || ((g) => g.sky.daylight < 0.75) });
}

// ------------------------------------------------------------------ HOME
function buildHome(game) {
  const M = mats();
  const y = game.terrain.getHeight(P.home.x, P.home.z);
  const B = new Builder(game, P.home.x, y, P.home.z, 0);
  const W = 10, D = 7, H = 2.7, F = 0.55; // floor height
  // foundation
  B.box(W + 0.2, F, D + 0.2, 0, F / 2 - 0.1, 0, M.stone, { uv: 1.5, surface: 'rock' });
  B.floor(W, D, 0, F, 0, M.floorPlanks, 1.6);
  // exterior walls
  const t = 0.18;
  const win = (a, b, lit = false) => ({ a, b, y0: 0.9, y1: 2.15, type: 'window', lit });
  B.wallX(-W / 2, W / 2, -D / 2, H, t, M.redBoards, M.wallpaper, [win(-3.6, -2.4), win(1.0, 2.4), win(3.2, 4.2)], -1, F);
  B.wallX(-W / 2, W / 2, D / 2, H, t, M.redBoards, M.wallpaper, [win(-3.8, -2.6), win(-1.6, -0.8), win(1.5, 2.7)], 1, F);
  B.wallZ(-D / 2, D / 2, -W / 2, H, t, M.redBoards, M.wallpaper, [win(-1.0, 0.2)], -1, F);
  B.wallZ(-D / 2, D / 2, W / 2, H, t, M.redBoards, M.wallpaper, [{ a: 0.9, b: 1.95, y0: 0, y1: 2.1 }, win(-2.4, -1.2)], 1, F);
  B.corners(W + 0.18, D + 0.18, H, F);
  B.door(W / 2, 1.425, 1.0, 2.05, false, M.whitePaint, { y0: F, label: 'front door' });
  // interior partition (bedroom west / living east) with doorway
  B.wallZ(-D / 2 + t / 2, D / 2 - t / 2, -0.5, H, 0.1, M.wallpaper, M.wallpaper, [{ a: -1.9, b: -1.0, y0: 0, y1: 2.05 }], 1, F);
  // WC partition
  B.wallX(-W / 2 + t / 2, -3.2, 1.6, H, 0.08, M.plaster, M.plaster, [], 1, F);
  B.wallZ(1.6, D / 2 - t / 2, -3.2, H, 0.08, M.plaster, M.plaster, [{ a: 1.8, b: 2.6, y0: 0, y1: 2.0 }], 1, F);
  B.ceiling(W, D, 0, F + H, 0, M.plaster);
  B.gable(W + 0.4, D + 0.4, F + H, 2.0, 0.5, M.roof, M.redBoards);
  // chimney
  B.box(0.6, 2.4, 0.6, 1.0, F + H + 1.4, -1.2, new THREE.MeshStandardMaterial({ color: 0x7a3a2a, roughness: 0.9, map: tex('concrete.jpg') }), { col: false });
  // porch & steps
  B.box(1.8, 0.1, 3.0, W / 2 + 0.9, F - 0.05, 1.2, M.darkPlanks, { uv: 1.5 });
  for (let i = 0; i < 3; i++) B.box(0.35, 0.1, 1.6, W / 2 + 1.95 + i * 0.3, F - 0.18 - i * 0.17, 1.4, M.darkPlanks, { uv: 1.5 });
  B.box(0.08, 1.0, 0.08, W / 2 + 1.75, F + 0.45, -0.25, M.whitePaint); B.box(0.08, 1.0, 0.08, W / 2 + 1.75, F + 0.45, 2.65, M.whitePaint);
  B.box(0.06, 0.06, 2.9, W / 2 + 1.75, F + 0.95, 1.2, M.whitePaint, { col: false });

  // ---- furniture
  const fy = F;
  game.home = {};
  game.home.sink = B.add(PR.counter(2.4, true), 2.6, fy, -D / 2 + 0.42, 0);
  B.col(2.4, 0.9, 0.6, 2.6, fy + 0.45, -D / 2 + 0.42);
  game.home.stove = B.add(PR.stove(), 4.2, fy, -D / 2 + 0.42, 0); B.col(0.6, 0.9, 0.6, 4.2, fy + 0.45, -D / 2 + 0.42);
  game.home.fridge = B.add(PR.fridge(), 0.5, fy, -D / 2 + 0.42, 0); B.col(0.6, 1.6, 0.6, 0.5, fy + 0.8, -D / 2 + 0.42);
  B.add(PR.table(1.3, 0.85), 2.4, fy, -0.3, 0); B.col(1.3, 0.78, 0.85, 2.4, fy + 0.39, -0.3);
  B.add(PR.chair(), 2.0, fy, 0.35, Math.PI); B.add(PR.chair(), 2.8, fy, 0.35, Math.PI); B.add(PR.chair(), 2.4, fy, -0.95, 0);
  B.add(PR.sofa(), 1.6, fy, D / 2 - 0.55, Math.PI); B.col(1.9, 0.8, 0.8, 1.6, fy + 0.4, D / 2 - 0.55);
  const tvp = B.add(PR.tv(), 1.6, fy, 1.0, 0); B.col(0.7, 0.9, 0.45, 1.6, fy + 0.45, 1.0);
  game.homeTV = tvp; game.home.tv = tvp;
  B.add(PR.rug(2.2, 1.5), 1.6, fy + 0.005, 2.0);
  const ph = PR.phone(); B.add(ph, W / 2 - 0.25, fy + 1.0, 2.6, -Math.PI / 2); game.home.phone = ph;
  B.box(0.3, 0.04, 0.25, W / 2 - 0.2, fy + 0.98, 2.6, M.darkWood, { col: false });
  game.spots.phone = B.w(W / 2 - 0.25, fy + 1.1, 2.6);
  const clk = PR.clock(); B.add(clk, 2.6, fy + 2.0, -D / 2 + 0.11, 0); game.homeClock = clk;
  B.add(PR.lamp(1.4), 4.4, fy, D / 2 - 0.4);
  B.add(PR.poster('KESÄ 1997\nKurkimäen\nKyläjuhlat\nla 21.6.', 0.5, 0.7), -0.43, fy + 1.6, 2.5, Math.PI / 2);
  // bedroom
  B.add(PR.bed(), -3.9, fy, -2.3, 0); B.col(1.0, 0.7, 2.0, -3.9, fy + 0.35, -2.3);
  game.spots.bed = B.w(-3.9, fy + 0.7, -2.3);
  game.spots.stove = B.w(4.2, fy + 0.95, -D / 2 + 0.42);
  game.spots.tap = B.w(2.0, fy + 1.0, -D / 2 + 0.42);
  B.add(PR.shelf(1.0, 1.9, 0.5, 4, M.darkWood), -1.3, fy, -D / 2 + 0.3, 0); B.col(1.0, 1.9, 0.5, -1.3, fy + 0.95, -D / 2 + 0.3);
  B.add(PR.rug(1.6, 1.0, 0x2a4a6a), -2.6, fy + 0.005, -1.0);
  B.add(PR.lamp(1.2), -3.0, fy, -3.0);
  game.home.toilet = B.add(PR.toilet(), -4.5, fy, 2.8, Math.PI);
  game.spots.toilet = B.w(-4.5, fy + 0.4, 2.8);
  B.add(PR.counter(0.7, true), -4.4, fy, 1.95, 0);
  // interactions
  B.hit(1.1, 0.8, 2.1, -3.9, fy + 0.4, -2.3, { label: 'Sleep', use: () => game.actions.sleep() });
  B.hit(0.62, 0.3, 0.62, 4.2, fy + 0.95, -D / 2 + 0.42, { label: () => (game.interact.held?.def.cookTo ? `Cook the ${game.interact.held.def.name.replace(' (raw)', '').toLowerCase()}` : 'Stove: hold food here to cook it'), use: () => game.actions.cook(), held: (e) => !!e.def.cookTo });
  B.hit(0.6, 0.3, 0.5, 2.0, fy + 1.0, -D / 2 + 0.42, { label: 'Drink tap water', use: () => game.actions.drinkTap() });
  B.hit(0.45, 0.5, 0.5, -4.5, fy + 0.35, 2.8, { label: 'Use toilet', use: () => game.actions.toilet() });
  B.hit(0.3, 0.25, 0.3, W / 2 - 0.25, fy + 1.05, 2.6, { label: 'Telephone', use: () => game.actions.phone() });
  B.hit(0.7, 0.6, 0.5, 1.6, fy + 0.7, 1.0, { label: () => (game.state.tvOn ? 'Turn TV off' : 'Watch TV'), use: () => game.actions.tv() });
  B.hit(0.65, 1.6, 0.3, 0.5, fy + 0.8, -D / 2 + 0.7, { label: 'Fridge', use: () => game.actions.fridge() });
  light(game, B.w(2.4, fy + 2.4, -0.3), 0xffd0a0, 8, 8, (g) => g.sky.daylight < 0.85);
  light(game, B.w(-2.6, fy + 2.4, -1.5), 0xffd0a0, 6, 7, (g) => g.sky.daylight < 0.85);
  game.spots.homeDoor = B.w(W / 2 + 1.2, F, 1.4);
  game.spots.spawn = B.w(W / 2 + 2.5, F, 2.5);
  game.spots.fridgeDrop = B.w(0.5, fy + 1.0, -D / 2 + 1.1);
  game.spots.homeIndoor = { center: B.w(0, F + 1, 0), half: V(W / 2, 2, D / 2), ry: 0 };

  // yard: flagpole, mailbox, clothesline
  const fp = PR.flagpole();
  const fpx = W / 2 + 7, fpz = -5;
  B.add(fp, fpx, game.terrain.getHeight(P.home.x + fpx, P.home.z + fpz) - y, fpz);
  game.flags.push(fp.userData.flag);
  const mbx = -386 + 3.5, mbz = 584;
  const mb = PR.mailbox('KOTI', '12');
  const mgy = game.terrain.getHeight(mbx, mbz);
  const mry = Math.atan2(P.home.x - mbx, P.home.z - mbz); // door faces the house
  mb.position.set(mbx, mgy, mbz); mb.rotation.y = mry;
  game.scene.add(mb);
  game.homeMailbox = mb;
  const boxPos = V(mbx, mgy + mb.userData.boxY, mbz);
  const mbHit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.7), M.hidden); mbHit.position.copy(boxPos); mbHit.rotation.y = mry; game.scene.add(mbHit); mbHit.updateMatrixWorld();
  const mbIt = { mesh: mbHit, pos: boxPos.clone(), label: () => game.actions.mailboxLabel(), use: () => game.actions.mailbox() };
  mbHit.userData.interact = mbIt; // (this link was missing before, so the mailbox could never be used)
  game.interactables.push(mbIt);
  game.spots.mailbox = mbIt.pos.clone();
  // apple tree-ish bush and garden table
  B.add(PR.table(1.4, 0.8, 0.72, M.whitePaint), W / 2 + 3.5, 0.0 - 0.02, 5.5);
  B.add(PR.bench(), W / 2 + 3.5, -0.02, 6.4, Math.PI);
}

// ------------------------------------------------------------------ GARAGE
function buildGarage(game) {
  const M = mats();
  const y = game.terrain.getHeight(P.garage.x, P.garage.z);
  const B = new Builder(game, P.garage.x, y, P.garage.z, 0);
  const W = 8, D = 10, H = 3.2, t = 0.2;
  B.box(W + 0.4, 0.3, D + 0.4, 0, -0.1, 0, M.concrete, { uv: 3, surface: 'concrete' });
  B.floor(W, D, 0, 0.06, 0, M.concrete, 3);
  const win = (a, b) => ({ a, b, y0: 1.2, y1: 2.2, type: 'window' });
  B.wallX(-W / 2, W / 2, -D / 2, H, t, M.redBoards, M.rawPlanks, [], -1);
  B.wallX(-W / 2, W / 2, D / 2, H, t, M.redBoards, M.rawPlanks, [{ a: -1.9, b: 1.9, y0: 0, y1: 2.8 }], 1);
  B.wallZ(-D / 2, D / 2, -W / 2, H, t, M.redBoards, M.rawPlanks, [{ a: 2.5, b: 3.45, y0: 0, y1: 2.05 }, win(-2.5, -1.0)], -1);
  B.wallZ(-D / 2, D / 2, W / 2, H, t, M.redBoards, M.rawPlanks, [win(-2.0, -0.2), win(1.2, 3.0)], 1);
  B.corners(W + 0.2, D + 0.2, H);
  B.door(-W / 2, 2.975, 0.95, 2.05, false, M.whitePaint, { label: 'side door' });
  B.ceiling(W, D, 0, H, 0, M.rawPlanks);
  // roof ridge along z: build gable in a rotated sub-builder
  const R2 = new Builder(game, P.garage.x, y, P.garage.z, Math.PI / 2);
  R2.gable(D + 0.4, W + 0.4, H, 1.6, 0.5, M.roof, M.redBoards);
  // Big up-and-over door
  const doorPivot = new THREE.Group(); doorPivot.position.set(0, 2.8, D / 2); doorPivot.userData.noBatch = true;
  const panel = new THREE.Mesh(boxUV(3.8, 2.8, 0.06, 1.5), M.whitePaint); panel.position.set(0, -1.4, 0); panel.castShadow = true;
  doorPivot.add(panel);
  for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.03, 0.02), M.white); s.position.set(0, -0.2 - i * 0.4, 0.04); doorPivot.add(s); }
  B.group.add(doorPivot);
  const doorCol = B.col(3.8, 2.8, 0.1, 0, 1.4, D / 2);
  const gdoor = { open: false, angle: 0, target: 0, pivot: doorPivot, collider: doorCol, axis: 'x' };
  gdoor.toggle = () => { gdoor.open = !gdoor.open; gdoor.target = gdoor.open ? Math.PI / 2 * 0.97 : 0; doorCol.setEnabled(!gdoor.open); game.audio.play('creak', B.w(0, 1.5, D / 2)); game.audio.play('door', B.w(0, 1.5, D / 2)); };
  game.doors.push(gdoor);
  game.garageDoor = gdoor;
  B.hit(3.8, 2.8, 0.5, 0, 1.4, D / 2, { label: () => (gdoor.open ? 'Close garage door' : 'Open garage door'), use: gdoor.toggle });

  // equipment
  B.add(PR.workbench(), 0.2, 0.06, -D / 2 + 0.55, 0); B.col(2.2, 0.95, 0.8, 0.2, 0.5, -D / 2 + 0.55);
  B.add(PR.metalShelf(2.6, 2.0, 0.55), -W / 2 + 0.4, 0.06, -2.3, Math.PI / 2); B.col(0.55, 2.0, 2.6, -W / 2 + 0.4, 1.0, -2.3);
  B.add(PR.metalShelf(2.6, 2.0, 0.55), W / 2 - 0.4, 0.06, 0.2, -Math.PI / 2); B.col(0.55, 2.0, 2.6, W / 2 - 0.4, 1.0, 0.2);
  B.add(PR.metalShelf(1.8, 2.0, 0.55), W / 2 - 0.4, 0.06, 3.3, -Math.PI / 2); B.col(0.55, 2.0, 1.8, W / 2 - 0.4, 1.0, 3.3);
  B.add(PR.oilDrum(0x2a5a8a), 3.4, 0.06, -4.4); B.col(0.6, 0.9, 0.6, 3.4, 0.5, -4.4);
  B.add(PR.oilDrum(0xa02a1a), 2.75, 0.06, -4.45); B.col(0.6, 0.9, 0.6, 2.75, 0.5, -4.45);
  B.add(PR.tireStack(4), -3.4, 0.06, 4.2); B.col(0.7, 0.9, 0.7, -3.4, 0.45, 4.2);
  B.add(PR.engineStand(), -2.6, 0.06, -3.4, 0);
  game.spots.engineStand = B.w(-2.6, 0.06 + 0.78, -3.15);
  const hoist = PR.engineHoist(); B.add(hoist, -2.6, 0.06, -1.6, Math.PI); game.engineHoist = hoist;
  game.spots.hoist = B.w(-2.6, 0.06, -1.6);
  B.hit(0.6, 1.8, 1.4, -2.6, 0.9, -1.6, { label: () => game.actions.hoistLabel(), use: () => game.actions.hoist() });
  const ch = PR.batteryCharger(); B.add(ch, -0.7, 0.99, -D / 2 + 0.5); game.chargerObj = ch;
  game.spots.charger = B.w(-0.7, 1.1, -D / 2 + 0.75);
  B.hit(0.35, 0.3, 0.3, -0.7, 1.08, -D / 2 + 0.5, { label: () => game.actions.chargerLabel(), use: () => game.actions.charger(), held: (e) => e.part?.defId === 'battery' });
  B.add(PR.poster('RUSKA 1300\nHUOLTO-OHJE\n\nKiristä pultit!\nÖljy 3.5 L\nVesi 5 L', 0.55, 0.8, '#f0f0e0', '#202020'), 2.2, 1.7, -D / 2 + 0.11);
  B.add(PR.poster('KURKI-SPRINT\nRALLI\nLAUANTAISIN\nklo 12-18', 0.5, 0.7, '#ffd020', '#111'), -1.6, 1.7, -D / 2 + 0.11);
  // radio on workbench
  const radio = PR.radio(); B.add(radio, 1.1, 0.99, -D / 2 + 0.45, 0); game.garageRadioObj = radio;
  B.hit(0.4, 0.25, 0.25, 1.1, 1.09, -D / 2 + 0.45, { label: () => (game.radio?.garageOn ? 'Turn radio off' : 'Turn radio on'), use: () => game.actions.garageRadio(B.w(1.1, 1.1, -D / 2 + 0.45)) });
  game.spots.garageRadio = B.w(1.1, 1.1, -D / 2 + 0.45);
  // car position on jack stands
  game.spots.carStands = B.w(0.4, 0.06, 0.6);
  for (const [x, z] of [[-0.75, 1.9], [0.75, 1.9], [-0.75, -1.2], [0.75, -1.2]]) B.add(PR.jackStand(), 0.4 + x, 0.06, 0.6 + z);
  // fluorescent tube lights
  for (const z of [-2, 2]) {
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 1.3), M.lampOn); tube.position.set(0, H - 0.08, z); B.group.add(tube);
    light(game, B.w(0, H - 0.4, z), 0xe8f0ff, 7, 9, (g) => g.sky.daylight < 0.95);
  }
  game.spots.garage = B.w(0, 0, 0);
  game.spots.garageIndoor = { center: B.w(0, 1.5, 0), half: V(W / 2, 1.7, D / 2), ry: 0 };
  game.spots.partsArea = { shelfA: B.w(-W / 2 + 0.4, 0.06, -2.3), shelfB: B.w(W / 2 - 0.4, 0.06, 0.2), shelfC: B.w(W / 2 - 0.4, 0.06, 3.3), bench: B.w(0.2, 0.96, -D / 2 + 0.55), floor: B.w(-1.8, 0.1, 2.5) };
  // driveway gravel patch in front
}

// ------------------------------------------------------------------ SAUNA + DOCK
function buildSauna(game) {
  const M = mats();
  const s = SITES.find((q) => q.x === P.sauna.x && q.z === P.sauna.z);
  const y = s ? s.h : game.terrain.getHeight(P.sauna.x, P.sauna.z);
  const lakeDir = new THREE.Vector2(-150 - P.sauna.x, 80 - P.sauna.z).normalize();
  const ry = Math.atan2(lakeDir.x, lakeDir.y); // local +z faces the lake
  const B = new Builder(game, P.sauna.x, y, P.sauna.z, ry);
  const W = 4.6, D = 3.6, H = 2.3, t = 0.22, F = 0.35;
  const logMat = new THREE.MeshStandardMaterial({ map: tex('planks_dark.jpg'), normalMap: tex('planks_dark_n.jpg', { srgb: false }), color: 0x9a7a5a, roughness: 0.9 });
  B.box(W + 0.2, F, D + 0.2, 0, F / 2 - 0.1, 0, M.stone, { surface: 'rock' });
  B.floor(W, D, 0, F, 0, M.rawPlanks, 1.5);
  B.wallX(-W / 2, W / 2, D / 2, H, t, logMat, M.rawPlanks, [{ a: 0.8, b: 1.6, y0: 1.0, y1: 1.6, type: 'window' }], 1, F);
  B.wallX(-W / 2, W / 2, -D / 2, H, t, logMat, M.rawPlanks, [{ a: -1.8, b: -1.0, y0: 0, y1: 1.95 }], -1, F);
  B.wallZ(-D / 2, D / 2, -W / 2, H, t, logMat, M.rawPlanks, [], -1, F);
  B.wallZ(-D / 2, D / 2, W / 2, H, t, logMat, M.rawPlanks, [], 1, F);
  B.wallZ(-D / 2 + t / 2, D / 2 - t / 2, -0.4, H, 0.1, M.rawPlanks, M.rawPlanks, [{ a: -0.5, b: 0.3, y0: 0, y1: 1.9 }], 1, F);
  // log ends at corners
  for (const [x, z] of [[W / 2, D / 2], [-W / 2, D / 2], [W / 2, -D / 2], [-W / 2, -D / 2]]) for (let i = 0; i < 9; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.35, 8), logMat); l.rotation.z = (i % 2) ? Math.PI / 2 : 0; l.rotation.x = (i % 2) ? 0 : Math.PI / 2;
    l.position.set(x, F + 0.12 + i * 0.25, z); B.group.add(l);
  }
  B.ceiling(W, D, 0, F + H, 0, M.rawPlanks);
  B.gable(W + 0.4, D + 0.4, F + H, 1.2, 0.4, M.shingles, logMat, false);
  B.box(0.25, 1.4, 0.25, 1.2, F + H + 1.0, -0.6, M.darkMetal, { col: false });
  B.door(-1.4, -D / 2, 0.8, 1.95, true, M.darkPlanks, { y0: F, label: 'sauna door' });
  // steam room furniture
  const benches = PR.saunaBenches(2.6); B.add(benches, 1.0, F, 0.8, Math.PI);
  B.col(2.6, 1.0, 0.95, 1.0, F + 0.5, 1.25);
  const k = PR.kiuas(); B.add(k, 0.1, F, -1.25); B.col(0.55, 0.9, 0.55, 0.1, F + 0.45, -1.25);
  game.kiuasGlow = k.getObjectByName('glow');
  B.add(PR.bucket(), 1.0, F, -1.3);
  game.spots.kiuas = B.w(0.1, F + 0.9, -1.25);
  game.spots.saunaBench = B.w(1.0, F + 1.0, 1.3);
  game.spots.saunaSeatLook = B.w(0.1, F + 0.9, -1.25);
  game.spots.saunaRoom = { center: B.w(0.95, F + 1.2, 0), half: V(1.35, 1.2, D / 2), ry };
  B.hit(0.6, 0.9, 0.6, 0.1, F + 0.45, -1.25, { label: () => game.actions.stoveLabel(), use: () => game.actions.saunaStove(), held: (e) => e.defId === 'firewood' || e.defId === 'sausage', alt: () => game.actions.throwWater() });
  B.hit(2.6, 0.5, 0.9, 1.0, F + 1.0, 1.25, { label: () => (game.player.sitting ? 'Stand up' : 'Sit on the bench'), use: () => game.actions.saunaSit() });
  B.hit(0.35, 0.3, 0.35, 1.0, F + 0.15, -1.3, { label: 'Throw löyly (water on stones)', use: () => game.actions.throwWater() });
  // dressing room bench + towels
  B.add(PR.bench(), -1.4, F, 1.3, Math.PI);
  light(game, B.w(1.0, F + 2.0, 0), 0xffb070, 4, 5, (g) => g.sauna?.fire > 0 || g.sky.daylight < 0.6);
  // firewood next to sauna (outside)
  B.add(PR.firewoodStack(1.6, 1.0, 0.45), -W / 2 - 0.5, 0.0, 0, Math.PI / 2);
  // dock
  let sx = P.sauna.x, sz = P.sauna.z;
  for (let i = 0; i < 80; i++) { sx += lakeDir.x * 0.5; sz += lakeDir.y * 0.5; if (game.terrain.getHeight(sx, sz) < WATER_LEVEL + 0.2) break; }
  const DB = new Builder(game, sx, WATER_LEVEL, sz, ry);
  const dockLen = 11;
  DB.box(2.0, 0.12, dockLen, 0, 0.55, dockLen / 2 - 1.5, M.darkPlanks, { uv: 1.2 });
  for (let i = 0; i < 5; i++) for (const x of [-0.9, 0.9]) DB.box(0.14, 2.4, 0.14, x, -0.6, -1 + i * (dockLen / 4.4), M.darkWood, { col: false });
  DB.box(0.1, 0.9, 0.1, 0.85, 1.0, dockLen - 1.6, M.metal); // ladder rails
  DB.box(0.1, 0.9, 0.1, 0.5, 1.0, dockLen - 1.6, M.metal);
  game.spots.dockEnd = DB.w(0, 0.65, dockLen - 2);
  game.spots.dockSit = DB.w(0, 0.65, dockLen - 2.5);
  DB.hit(1.8, 0.5, 1.2, 0, 0.8, dockLen - 2.2, { label: () => game.actions.fishLabel(), use: () => game.actions.fish() });
  // rowing boat tied to dock
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 3.6, 12, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x2a5a3a, roughness: 0.6, side: THREE.DoubleSide, map: tex('planks_raw.jpg') }));
  hull.rotation.z = Math.PI / 2; hull.rotation.y = Math.PI / 2; hull.scale.set(1, 1, 0.55); boat.add(hull);
  boat.position.copy(DB.w(2.1, 0.08, 4)); boat.rotation.y = ry + 0.15;
  boat.userData.noBatch = true;
  game.scene.add(boat); game.floaters.push({ obj: boat, base: boat.position.y, ph: 0 });
}

// ------------------------------------------------------------------ SHED / OUTHOUSE
function buildShed(game) {
  const M = mats();
  const y = game.terrain.getHeight(P.shed.x, P.shed.z);
  const B = new Builder(game, P.shed.x, y, P.shed.z, Math.PI * 0.08);
  B.box(4.4, 0.1, 2.6, 0, 0.0, 0, M.darkPlanks, { surface: 'wood' });
  B.wallX(-2.2, 2.2, -1.3, 2.2, 0.12, M.redBoards, M.darkPlanks, [], -1);
  B.wallZ(-1.3, 1.3, -2.2, 2.2, 0.12, M.redBoards, M.darkPlanks, [], -1);
  B.wallZ(-1.3, 1.3, 2.2, 2.2, 0.12, M.redBoards, M.darkPlanks, [], 1);
  const roof = B.box(4.8, 0.08, 3.2, 0, 2.45, 0, M.roof, { col: false, rx: -0.12 });
  B.add(PR.firewoodStack(4.0, 1.6, 0.6), 0, 0.05, -0.8);
  B.add(PR.choppingBlock(), 0.6, 0.0, 2.6);
  B.col(0.6, 0.5, 0.6, 0.6, 0.25, 2.6, 0, 'wood');
  game.spots.choppingBlock = B.w(0.6, 0.5, 2.6);
  game.spots.logPile = B.w(-1.6, 0.4, 3.2);
  game.spots.firewoodPile = B.w(0, 1.0, -0.3);
  B.hit(4.0, 1.6, 0.8, 0, 0.8, -0.6, { label: 'Take firewood', use: () => game.actions.takeFirewood() });
  B.hit(0.7, 0.6, 0.7, 0.6, 0.3, 2.6, { label: () => game.actions.chopLabel(), use: () => game.actions.chop(), held: (e) => e.defId === 'log' || e.defId === 'axe' });
  // log pile (unsplit)
  const logs = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 2.2, 14), [new THREE.MeshStandardMaterial({ map: tex('bark_birch.jpg', { repeat: [2, 3] }), normalMap: tex('bark_birch_n.jpg', { srgb: false, repeat: [2, 3] }), roughness: 0.85 }), new THREE.MeshStandardMaterial({ color: 0xdcc094, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0xdcc094, roughness: 0.9 })]);
    l.rotation.z = Math.PI / 2; l.position.set(0, 0.16 + Math.floor(i / 4) * 0.28, (i % 4) * 0.33 - 0.5 + Math.floor(i / 4) * 0.16); l.castShadow = true; logs.add(l);
  }
  B.add(logs, -1.6, 0, 3.3, 0.2);
  // outhouse
  const O = new Builder(game, P.shed.x + 9, game.terrain.getHeight(P.shed.x + 9, P.shed.z + 3), P.shed.z + 3, -0.4);
  O.box(1.3, 0.1, 1.3, 0, 0.05, 0, M.darkPlanks);
  O.wallX(-0.65, 0.65, -0.65, 2.1, 0.06, M.redBoards, M.darkPlanks, [], -1, 0.1);
  O.wallZ(-0.65, 0.65, -0.65, 2.1, 0.06, M.redBoards, M.darkPlanks, [], -1, 0.1);
  O.wallZ(-0.65, 0.65, 0.65, 2.1, 0.06, M.redBoards, M.darkPlanks, [], 1, 0.1);
  O.box(1.5, 0.06, 1.6, 0, 2.3, 0, M.roof, { col: false, rx: 0.15 });
  const heart = canvasTexture(128, 256, (c) => { c.fillStyle = '#8a2a1e'; c.fillRect(0, 0, 128, 256); c.fillStyle = '#111'; c.beginPath(); c.moveTo(64, 70); c.bezierCurveTo(64, 50, 30, 40, 30, 62); c.bezierCurveTo(30, 82, 64, 96, 64, 110); c.bezierCurveTo(64, 96, 98, 82, 98, 62); c.bezierCurveTo(98, 40, 64, 50, 64, 70); c.fill(); });
  const od = O.door(0, 0.65, 1.2, 1.95, true, new THREE.MeshStandardMaterial({ map: heart, roughness: 0.9 }), { y0: 0.1, label: 'outhouse door' });
  O.box(1.2, 0.5, 0.5, 0, 0.35, -0.38, M.darkPlanks);
  O.hit(0.6, 0.4, 0.4, 0, 0.6, -0.38, { label: 'Use the outhouse', use: () => game.actions.toilet() });
}

// ------------------------------------------------------------------ VILLAGE (Kurkimäki)
function buildVillage(game) {
  const M = mats();
  // shop
  {
    const y = game.terrain.getHeight(P.shop.x, P.shop.z);
    const B = new Builder(game, P.shop.x, y, P.shop.z, 0);
    const W = 12, D = 9, H = 3.4;
    const wallMat = M.yellowBoards;
    B.box(W + 0.3, 0.35, D + 0.3, 0, 0.0, 0, M.concrete, { surface: 'concrete' });
    B.floor(W, D, 0, 0.18, 0, new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.5, map: tex('concrete.jpg') }), 2);
    const big = (a, b) => ({ a, b, y0: 0.6, y1: 2.6, type: 'window' });
    B.wallX(-W / 2, W / 2, D / 2, H, 0.2, wallMat, M.plaster, [big(-5.2, -2.6), { a: -1.8, b: -0.2, y0: 0, y1: 2.3 }, big(0.6, 3.0), big(3.4, 5.4)], 1, 0.18);
    B.wallX(-W / 2, W / 2, -D / 2, H, 0.2, wallMat, M.plaster, [], -1, 0.18);
    B.wallZ(-D / 2, D / 2, -W / 2, H, 0.2, wallMat, M.plaster, [big(-1, 1)], -1, 0.18);
    B.wallZ(-D / 2, D / 2, W / 2, H, 0.2, wallMat, M.plaster, [], 1, 0.18);
    B.corners(W + 0.2, D + 0.2, H, 0.18);
    B.ceiling(W, D, 0, H + 0.18, 0, M.plaster);
    B.box(W + 1, 0.3, D + 1, 0, H + 0.3, 0, M.roof, { col: false });
    B.box(W + 1.2, 0.5, 0.15, 0, H + 0.2, D / 2 + 0.55, M.whitePaint, { col: false });
    const sign = PR.signBoard('KURKIMÄEN KAUPPA', 7, 0.9, '#b02018', '#ffffff', 'bold 96px Arial');
    B.add(sign, 0, H + 0.75, D / 2 + 0.3);
    const door = B.door(-1.0, D / 2, 1.5, 2.25, true, M.glass, { y0: 0.18, label: 'shop door', locked: () => (game.actions.isOpen('shop') ? null : 'Closed. Open 08–21.') });
    // interior
    for (let i = 0; i < 3; i++) { B.add(PR.shopShelf(3.2), 1.5, 0.18, -2.6 + i * 2.0, 0); B.col(3.2, 1.9, 0.5, 1.5, 1.1, -2.6 + i * 2.0); }
    B.add(PR.shopShelf(3.6), -3.3, 0.18, -D / 2 + 0.35, 0); B.col(3.6, 1.9, 0.5, -3.3, 1.1, -D / 2 + 0.35);
    B.add(PR.beerFridge(), 5.3, 0.18, -2.5, -Math.PI / 2); B.col(0.7, 2.0, 0.9, 5.3, 1.1, -2.5);
    B.add(PR.beerFridge(), 5.3, 0.18, -1.5, -Math.PI / 2); B.col(0.7, 2.0, 0.9, 5.3, 1.1, -1.5);
    // counter
    B.box(0.8, 1.0, 3.0, -3.8, 0.68, 1.6, new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.6, map: tex('planks_dark.jpg') }));
    B.add(PR.register(), -3.8, 1.18, 1.0, Math.PI / 2);
    // bottle return machine
    const brm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.7), new THREE.MeshStandardMaterial({ color: 0x2a7a3a, roughness: 0.4 }));
    brm.position.set(-5.4, 1.08, -1.8); B.group.add(brm); B.col(0.8, 1.8, 0.7, -5.4, 1.08, -1.8);
    B.add(PR.poster('PULLOPALAUTUS\npantti 0,50 mk', 0.7, 0.4, '#2a7a3a', '#fff'), -5.0, 1.5, -1.8, Math.PI / 2);
    B.hit(0.9, 1.8, 0.9, -5.2, 1.08, -1.8, { label: 'Return bottles (0.50 mk each)', use: () => game.actions.returnBottles(), held: (e) => e.defId === 'emptyBottle' });
    B.add(PR.poster('MAKKARA\ntarjous!\n2 pkt 15 mk', 0.6, 0.8, '#ffe040', '#c02020'), 0.5, 1.6, -D / 2 + 0.12);
    B.add(PR.poster('KESÄ-\nKAMPANJA', 0.5, 0.5, '#20a0e0', '#fff'), -3.3, 2.5, -D / 2 + 0.12);
    game.spots.shopCounter = B.w(-3.0, 1.2, 1.6);
    game.spots.shopkeeper = B.w(-4.7, 0.18, 1.6);
    game.spots.shopDrop = B.w(-3.6, 1.35, 2.6);
    game.spots.shopFront = B.w(-1.0, 0.2, D / 2 + 2.5);
    game.spots.shopIndoor = { center: B.w(0, 1.8, 0), half: V(W / 2, 1.8, D / 2), ry: 0 };
    B.hit(0.9, 1.0, 3.0, -3.6, 1.2, 1.6, { label: 'Shop counter', use: () => game.actions.shop('shop') });
    for (const x of [-4, 0, 4]) light(game, B.w(x, H - 0.2, 0), 0xf0f4ff, 7, 9, (g) => g.actions.isOpen('shop'));
    B.add(PR.bench(), 3.5, 0.18, D / 2 + 1.2, 0);
    B.add(PR.streetLamp(), -6.5, 0.0, D / 2 + 2.5, 0);
    light(game, B.w(-6.5, 5.6, D / 2 + 3.8), 0xffc890, 10, 18, (g) => g.sky.daylight < 0.55);
  }
  // gas station
  {
    const y = game.terrain.getHeight(P.gas.x, P.gas.z);
    const B = new Builder(game, P.gas.x, y, P.gas.z, 0);
    B.box(16, 0.2, 14, 0, -0.02, 0, M.concrete, { uv: 4, surface: 'concrete', cast: false });
    for (const [x, z] of [[-4, 1], [4, 1], [-4, 6], [4, 6]]) B.box(0.35, 4.2, 0.35, x, 2.1, z, M.whitePaint);
    B.box(10, 0.5, 7.5, 0, 4.4, 3.5, M.whitePaint, { col: false });
    B.box(10.1, 0.35, 7.6, 0, 4.45, 3.5, new THREE.MeshStandardMaterial({ color: 0x1a6a3a, roughness: 0.4 }), { col: false });
    B.add(PR.signBoard('HUOLTO KURKI', 6, 0.6, '#1a6a3a', '#ffffff', 'bold 90px Arial'), 0, 4.45, 7.35);
    B.add(PR.gasPump(), -1.8, 0.08, 3.5); B.col(0.8, 1.7, 0.5, -1.8, 0.9, 3.5);
    B.add(PR.gasPump(), 1.8, 0.08, 3.5); B.col(0.8, 1.7, 0.5, 1.8, 0.9, 3.5);
    game.spots.pumps = [B.w(-1.8, 1.0, 3.5), B.w(1.8, 1.0, 3.5)];
    B.hit(0.8, 1.7, 0.8, -1.8, 0.9, 3.5, { label: () => game.actions.pumpLabel(), use: () => game.actions.pump(0), held: (e) => e.def.fluid === 'fuel' });
    B.hit(0.8, 1.7, 0.8, 1.8, 0.9, 3.5, { label: () => game.actions.pumpLabel(), use: () => game.actions.pump(1), held: (e) => e.def.fluid === 'fuel' });
    // kiosk building (closed box)
    B.box(5, 3, 4, 0, 1.5, -3.5, M.whitePaint);
    const kb = new Builder(game, P.gas.x, y, P.gas.z, 0);
    kb.box(3.2, 1.5, 0.05, 0, 1.4, -1.48, M.windowLit, { col: false });
    B.box(5.4, 0.25, 4.4, 0, 3.1, -3.5, M.roof, { col: false });
    for (const x of [-3, 0, 3]) light(game, B.w(x, 4.0, 3.5), 0xffffff, 10, 14, (g) => g.sky.daylight < 0.6);
  }
  // pub
  {
    const y = game.terrain.getHeight(P.pub.x, P.pub.z);
    const B = new Builder(game, P.pub.x, y, P.pub.z, 0);
    const W = 11, D = 8.5, H = 3.0;
    B.box(W + 0.2, 0.4, D + 0.2, 0, 0.0, 0, M.stone, { surface: 'rock' });
    B.floor(W, D, 0, 0.2, 0, M.darkPlanks, 1.5);
    const win = (a, b) => ({ a, b, y0: 1.0, y1: 2.2, type: 'window' });
    const extMat = new THREE.MeshStandardMaterial({ map: tex('planks_dark.jpg'), normalMap: tex('planks_dark_n.jpg', { srgb: false }), color: 0x6a5a4a, roughness: 0.9 });
    const intMat = new THREE.MeshStandardMaterial({ map: tex('planks_dark.jpg'), color: 0xa08060, roughness: 0.8 });
    B.wallX(-W / 2, W / 2, D / 2, H, 0.2, extMat, intMat, [win(-4.5, -3), { a: -1.0, b: 0.2, y0: 0, y1: 2.1 }, win(1.5, 3), win(3.6, 4.8)], 1, 0.2);
    B.wallX(-W / 2, W / 2, -D / 2, H, 0.2, extMat, intMat, [], -1, 0.2);
    B.wallZ(-D / 2, D / 2, -W / 2, H, 0.2, extMat, intMat, [win(-1, 0.5)], -1, 0.2);
    B.wallZ(-D / 2, D / 2, W / 2, H, 0.2, extMat, intMat, [], 1, 0.2);
    B.ceiling(W, D, 0, H + 0.2, 0, intMat);
    B.gable(W + 0.4, D + 0.4, H + 0.2, 1.8, 0.4, M.shingles, extMat);
    B.add(PR.signBoard('BAARI KONTIO', 4.5, 0.8, '#3a1a0a', '#f2c040', 'bold 100px Georgia'), 0, H + 0.55, D / 2 + 0.2);
    B.door(-0.4, D / 2, 1.2, 2.05, true, M.darkPlanks, { y0: 0.2, label: 'pub door', locked: () => (game.actions.isOpen('pub') ? null : 'Closed. Open 14–02.') });
    // bar counter
    const barMat = new THREE.MeshStandardMaterial({ color: 0x5a2a12, roughness: 0.4, map: tex('planks_dark.jpg') });
    B.box(4.5, 1.1, 0.7, -2.0, 0.75, -2.3, barMat);
    B.box(4.7, 0.06, 0.85, -2.0, 1.33, -2.3, new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.25 }), { col: false });
    B.add(PR.shelf(4.0, 2.0, 0.3, 3, barMat), -2.0, 0.2, -D / 2 + 0.25);
    for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 8), new THREE.MeshStandardMaterial({ color: [0x3a5a1a, 0x5a2a0a, 0xc0c0c0, 0x8a1a1a][i % 4], roughness: 0.1, transparent: true, opacity: 0.85 })); b.position.set(-3.7 + i * 0.3, 0.2 + 0.85 + (i % 2) * 0.66, -D / 2 + 0.28); B.group.add(b); }
    for (let i = 0; i < 5; i++) B.add(PR.barStool(), -3.8 + i * 0.9, 0.2, -1.6);
    for (const [x, z] of [[2.5, -1.5], [2.5, 1.5], [-1.5, 2.2]]) {
      B.add(PR.table(1.0, 1.0, 0.75, barMat), x, 0.2, z); B.col(1.0, 0.78, 1.0, x, 0.6, z);
      B.add(PR.chair(barMat), x + 0.6, 0.2, z, -Math.PI / 2); B.add(PR.chair(barMat), x - 0.6, 0.2, z, Math.PI / 2);
    }
    B.add(PR.slotMachine(), 5.0, 0.2, -3.6, -Math.PI / 4); B.col(0.7, 1.6, 0.6, 5.0, 1.0, -3.6);
    B.hit(0.7, 1.6, 0.7, 5.0, 1.0, -3.6, { label: 'Slot machine (5 mk)', use: () => game.actions.slot() });
    B.add(PR.dartboard(), W / 2 - 0.12, 1.75, 0.5, -Math.PI / 2);
    B.add(PR.poster('TANSSIT\nla klo 21\nHumppa-\nVeikot', 0.5, 0.7, '#2a1a4a', '#f0d040'), -W / 2 + 0.12, 1.6, 1.5, Math.PI / 2);
    game.spots.bartender = B.w(-2.0, 0.2, -3.2);
    game.spots.pubCounter = B.w(-2.0, 1.4, -1.9);
    game.spots.pubDrop = B.w(-1.2, 1.45, -2.25);
    game.spots.pubIndoor = { center: B.w(0, 1.6, 0), half: V(W / 2, 1.6, D / 2), ry: 0 };
    game.spots.pubSeats = [B.w(2.5, 0.2, -1.5), B.w(2.5, 0.2, 1.5), B.w(-1.5, 0.2, 2.2), B.w(-3.8, 0.2, -1.6), B.w(-2.0, 0.2, -1.6)];
    B.hit(4.5, 0.6, 1.0, -2.0, 1.4, -2.1, { label: 'Order at the bar', use: () => game.actions.shop('pub') });
    for (const x of [-3, 1, 4]) light(game, B.w(x, H - 0.2, 0), 0xffa860, 5, 8, (g) => g.actions.isOpen('pub'));
  }
  // Pertti's house (closed) with yard junk
  houseClosed(game, P.pertti.x, P.pertti.z, 0, { w: 7, d: 6, color: 'yellow', name: 'pertti' });
  {
    const y = game.terrain.getHeight(P.pertti.x + 5, P.pertti.z + 4);
    const w = PR.wreck(0x4a5a6a); w.position.set(P.pertti.x + 7, y, P.pertti.z + 5); w.rotation.y = 0.6; game.scene.add(w);
    const b = PR.bench(); b.position.set(P.pertti.x - 1, game.terrain.getHeight(P.pertti.x - 1, P.pertti.z + 4.5), P.pertti.z + 4.5); game.scene.add(b);
    game.spots.perttiBench = new THREE.Vector3(P.pertti.x - 1, b.position.y, P.pertti.z + 4.5);
  }
  // bus stop
  {
    const bs = PR.busShelter(); const y = game.terrain.getHeight(P.busstop.x, P.busstop.z);
    bs.position.set(P.busstop.x, y, P.busstop.z); bs.rotation.y = Math.PI; game.scene.add(bs);
    const B = new Builder(game, P.busstop.x, y, P.busstop.z, Math.PI);
    B.col(3, 2.2, 0.1, 0, 1.2, -0.75); B.col(0.1, 2.2, 1.6, -1.5, 1.2, 0); B.col(0.1, 2.2, 1.6, 1.5, 1.2, 0);
    game.spots.busstop = B.w(0, y, 0);
  }
  // misc village houses
  for (const [x, z, r, c] of [[262, 690, 0.3, 'red'], [455, 702, -0.2, 'white'], [520, 585, 1.6, 'red'], [245, 600, 1.4, 'yellow'], [300, 520, 0.9, 'red'], [470, 520, 0.1, 'white']]) {
    if (game.terrain.roadInfo(x, z).d < 8) continue;
    houseClosed(game, x, z, r, { w: 7 + (x % 3), d: 6, color: c });
  }
  const fp = PR.flagpole(); fp.position.set(P.shop.x + 8, game.terrain.getHeight(P.shop.x + 8, P.shop.z + 8), P.shop.z + 8); game.scene.add(fp); game.flags.push(fp.userData.flag);
}

export function houseClosed(game, x, z, ry, { w = 7, d = 6, h = 2.6, color = 'red', name = '', storeys = 1, roofColor = null } = {}) {
  const M = mats();
  const y = game.terrain.getHeight(x, z);
  const B = new Builder(game, x, y, z, ry);
  const wall = color === 'yellow' ? M.yellowBoards : color === 'white' ? new THREE.MeshStandardMaterial({ map: tex('planks_yellow.jpg'), color: 0xf0f0f0, roughness: 0.8 }) : M.redBoards;
  const HH = h * storeys;
  B.box(w + 0.2, 0.5, d + 0.2, 0, 0.0, 0, M.stone, { surface: 'rock' });
  B.box(w, HH, d, 0, 0.25 + HH / 2, 0, wall, { uv: 2 });
  B.corners(w + 0.05, d + 0.05, HH, 0.25);
  // windows as frames + lit glass
  for (let s = 0; s < storeys; s++) for (const side of [1, -1]) {
    const n = Math.max(1, Math.floor(w / 2.6));
    for (let i = 0; i < n; i++) {
      const wx = -w / 2 + (i + 0.5) * (w / n);
      if (side === 1 && i === Math.floor(n / 2) && s === 0) {
        B.box(1.0, 2.0, 0.08, wx, 0.25 + 1.0, d / 2 + 0.02, M.darkPlanks, { col: false });
        continue;
      }
      const gl = B.box(1.0, 1.15, 0.05, wx, 0.25 + s * h + 1.55, side * (d / 2 + 0.01), M.windowLit, { col: false, cast: false });
      B.box(1.15, 0.08, 0.1, wx, 0.25 + s * h + 0.95, side * (d / 2 + 0.03), M.whitePaint, { col: false });
      B.box(1.15, 0.08, 0.1, wx, 0.25 + s * h + 2.15, side * (d / 2 + 0.03), M.whitePaint, { col: false });
      B.box(0.08, 1.2, 0.1, wx - 0.55, 0.25 + s * h + 1.55, side * (d / 2 + 0.03), M.whitePaint, { col: false });
      B.box(0.08, 1.2, 0.1, wx + 0.55, 0.25 + s * h + 1.55, side * (d / 2 + 0.03), M.whitePaint, { col: false });
    }
  }
  B.gable(w + 0.2, d + 0.2, 0.25 + HH, d * 0.3, 0.45, roofColor || (color === 'red' ? M.roof : M.redRoof), wall);
  return B;
}

// ------------------------------------------------------------------ TOWN (Rautala)
function buildTown(game) {
  const M = mats();
  // Auto parts store (enterable)
  {
    const y = game.terrain.getHeight(P.parts.x, P.parts.z);
    const B = new Builder(game, P.parts.x, y, P.parts.z, Math.PI * 0.75);
    const W = 10, D = 8, H = 3.4;
    const wallM = new THREE.MeshStandardMaterial({ color: 0x8a8a90, roughness: 0.6, metalness: 0.3, map: tex('roof.jpg') });
    B.box(W + 0.3, 0.3, D + 0.3, 0, 0, 0, M.concrete, { surface: 'concrete' });
    B.floor(W, D, 0, 0.15, 0, M.concrete, 2.5);
    B.wallX(-W / 2, W / 2, D / 2, H, 0.2, wallM, M.plaster, [{ a: -4, b: -1.6, y0: 0.7, y1: 2.5, type: 'window' }, { a: -1, b: 0.4, y0: 0, y1: 2.2 }, { a: 1, b: 4.2, y0: 0.7, y1: 2.5, type: 'window' }], 1, 0.15);
    B.wallX(-W / 2, W / 2, -D / 2, H, 0.2, wallM, M.plaster, [], -1, 0.15);
    B.wallZ(-D / 2, D / 2, -W / 2, H, 0.2, wallM, M.plaster, [], -1, 0.15);
    B.wallZ(-D / 2, D / 2, W / 2, H, 0.2, wallM, M.plaster, [], 1, 0.15);
    B.ceiling(W, D, 0, H + 0.15, 0, M.plaster);
    B.box(W + 0.6, 0.3, D + 0.6, 0, H + 0.3, 0, M.roof, { col: false });
    B.add(PR.signBoard('RAUTALAN VARAOSA', 6.5, 0.9, '#1a1a1a', '#f2c020', 'bold 92px Arial'), 0, H + 0.7, D / 2 + 0.2);
    B.door(-0.3, D / 2, 1.4, 2.1, true, M.glass, { y0: 0.15, label: 'store door', locked: () => (game.actions.isOpen('parts') ? null : 'Closed. Open 08–18 (Mon–Sat).') });
    for (let i = 0; i < 3; i++) { B.add(PR.metalShelf(2.8, 2.0, 0.6), -2.5 + i * 0.0, 0.15, -3.4 + i * 0, 0); }
    B.add(PR.metalShelf(2.8, 2.0, 0.6), 2.5, 0.15, -3.5, 0); B.col(2.8, 2.0, 0.6, 2.5, 1.1, -3.5);
    B.add(PR.metalShelf(2.8, 2.0, 0.6), -2.5, 0.15, -3.5, 0); B.col(2.8, 2.0, 0.6, -2.5, 1.1, -3.5);
    B.add(PR.tireStack(5), 4.3, 0.15, -1.0); B.add(PR.tireStack(5), 4.3, 0.15, 0.2);
    B.add(PR.oilDrum(0xd0a020), -4.3, 0.15, -1.2);
    B.box(3.5, 1.05, 0.8, 0, 0.67, 0.2, new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.5, metalness: 0.4 }));
    B.add(PR.register(), 1.0, 1.2, 0.2);
    B.add(PR.poster('TARJOUS!\nKilpa-\nkaasutin\n1450 mk', 0.6, 0.8, '#f2c020', '#111'), -4.88, 1.6, 1.5, Math.PI / 2);
    game.spots.partsClerk = B.w(0, 0.15, -0.6);
    game.spots.partsDrop = B.w(-1.0, 1.3, 0.5);
    game.spots.partsIndoor = { center: B.w(0, 1.8, 0), half: V(W / 2, 1.8, D / 2), ry: Math.PI * 0.75 };
    B.hit(3.5, 1.0, 1.2, 0, 1.2, 0.4, { label: 'Parts counter', use: () => game.actions.shop('parts') });
    for (const x of [-3, 0, 3]) light(game, B.w(x, H - 0.2, 0), 0xf0f4ff, 7, 9, (g) => g.actions.isOpen('parts'));
  }
  // Inspection / mechanic hall
  {
    const y = game.terrain.getHeight(P.inspection.x, P.inspection.z);
    const B = new Builder(game, P.inspection.x, y, P.inspection.z, Math.PI);
    const W = 14, D = 12, H = 5;
    const wallM = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.7, map: tex('concrete.jpg') });
    B.box(W + 10, 0.2, D + 14, 0, -0.05, 2, M.concrete, { uv: 4, surface: 'concrete', cast: false });
    B.wallX(-W / 2, W / 2, -D / 2, H, 0.3, wallM, wallM, [], -1);
    B.wallZ(-D / 2, D / 2, -W / 2, H, 0.3, wallM, wallM, [], -1);
    B.wallZ(-D / 2, D / 2, W / 2, H, 0.3, wallM, wallM, [], 1);
    B.wallX(-W / 2, W / 2, D / 2, H, 0.3, wallM, wallM, [{ a: -5.5, b: -1.5, y0: 0, y1: 4 }, { a: 1.5, b: 5.5, y0: 0, y1: 4 }], 1);
    B.box(W + 0.8, 0.4, D + 0.8, 0, H + 0.2, 0, M.roof, { col: false });
    B.add(PR.signBoard('KATSASTUS • KORJAAMO', 9, 1.0, '#0a4a8a', '#ffffff', 'bold 88px Arial'), 0, H - 0.5, D / 2 + 0.2);
    // inspection pit lines
    B.box(2.6, 0.02, 6, -3.5, 0.06, 1.5, M.yellowPaint, { col: false, cast: false });
    B.box(2.4, 0.03, 5.8, -3.5, 0.065, 1.5, M.darkMetal, { col: false, cast: false });
    light(game, B.w(-3.5, H - 0.4, 0), 0xf0f4ff, 9, 14, () => true);
    light(game, B.w(3.5, H - 0.4, 0), 0xf0f4ff, 9, 14, () => true);
    game.spots.inspectionBay = B.w(-3.5, 0.1, 1.5);
    game.spots.mechanicBay = B.w(3.5, 0.1, 1.5);
    game.spots.inspector = B.w(-1.2, 0.1, 3.5);
    game.spots.mechanic = B.w(5.6, 0.1, 3.5);
    game.spots.inspectionIndoor = { center: B.w(0, 2.5, 0), half: V(W / 2, 2.5, D / 2), ry: Math.PI };
    B.add(PR.workbench(), 4.0, 0.0, -D / 2 + 0.6);
    B.add(PR.tireStack(4), 6.2, 0.0, -4);
    B.add(PR.oilDrum(), 6.2, 0.0, -2.8);
  }
  // Police station + jail
  {
    const y = game.terrain.getHeight(P.police.x, P.police.z);
    const B = new Builder(game, P.police.x, y, P.police.z, Math.PI * 0.55);
    const W = 12, D = 9, H = 3.2;
    const wallM = new THREE.MeshStandardMaterial({ color: 0xc8c0b0, roughness: 0.8, map: tex('concrete.jpg') });
    B.box(W + 0.4, 0.3, D + 0.4, 0, 0, 0, M.concrete, { surface: 'concrete' });
    B.floor(W, D, 0, 0.15, 0, M.concrete, 2);
    B.wallX(-W / 2, W / 2, D / 2, H, 0.25, wallM, M.plaster, [{ a: -4.5, b: -3, y0: 1, y1: 2.2, type: 'window' }, { a: -0.6, b: 0.6, y0: 0, y1: 2.1 }, { a: 3, b: 4.5, y0: 1, y1: 2.2, type: 'window' }], 1, 0.15);
    B.wallX(-W / 2, W / 2, -D / 2, H, 0.25, wallM, M.plaster, [{ a: 3.5, b: 4.2, y0: 1.7, y1: 2.2, type: 'window' }], -1, 0.15);
    B.wallZ(-D / 2, D / 2, -W / 2, H, 0.25, wallM, M.plaster, [], -1, 0.15);
    B.wallZ(-D / 2, D / 2, W / 2, H, 0.25, wallM, M.plaster, [], 1, 0.15);
    B.ceiling(W, D, 0, H + 0.15, 0, M.plaster);
    B.box(W + 0.6, 0.3, D + 0.6, 0, H + 0.3, 0, M.roof, { col: false });
    B.add(PR.signBoard('POLIISI', 3.2, 0.8, '#0a2a6a', '#ffffff', 'bold 110px Arial'), 0, H + 0.6, D / 2 + 0.2);
    B.door(0, D / 2, 1.2, 2.1, true, M.bluePaint, { y0: 0.15, label: 'police station door' });
    // jail cell with bars at back right
    B.wallX(2.2, W / 2, -0.8, H, 0.1, M.plaster, M.plaster, [], 1, 0.15);
    B.wallZ(-D / 2, -0.8, 2.2, H, 0.1, M.plaster, M.plaster, [], -1, 0.15);
    for (let i = 0; i < 10; i++) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, H, 6), M.darkMetal); bar.position.set(2.25 + 0.01, 0.15 + H / 2, -0.9 - i * 0.0); }
    B.add(PR.bed(), 4.6, 0.15, -3.2, Math.PI / 2);
    game.spots.jailBed = B.w(4.6, 0.8, -3.2);
    game.spots.jailExit = B.w(0, 0.2, D / 2 + 2.0);
    game.spots.policeYard = B.w(-4, 0.2, D / 2 + 7);
    game.spots.impound = B.w(5, 0.2, D / 2 + 9);
    B.box(3, 1.05, 0.7, -2.5, 0.67, 1.2, new THREE.MeshStandardMaterial({ color: 0x3a4a6a, roughness: 0.5 }));
    game.spots.policeDesk = B.w(-2.5, 0.15, 0.4);
    B.hit(3.0, 1.0, 1.0, -2.5, 1.2, 1.5, { label: 'Police desk', use: () => game.actions.policeDesk() });
    light(game, B.w(-2, H - 0.2, 1), 0xf0f4ff, 6, 9, () => true);
    light(game, B.w(4.2, H - 0.2, -2.5), 0xf0f4ff, 4, 6, () => true);
    B.box(16, 0.15, 12, 0, 0.0, D / 2 + 7, M.concrete, { uv: 4, surface: 'concrete', cast: false, col: false });
  }
  // Apartments (kerrostalo)
  for (const [x, z, r] of [[600, -545, 0.2], [575, -610, 1.75], [640, -500, 0.2]]) {
    const y = game.terrain.getHeight(x, z);
    const B = new Builder(game, x, y, z, r);
    const W = 22, D = 11, H = 3 * 4;
    const wallM = new THREE.MeshStandardMaterial({ color: [0xd8c8a8, 0xc8b8a0, 0xb8b0a8][Math.floor(x) % 3], roughness: 0.85, map: tex('concrete.jpg') });
    B.box(W, H, D, 0, H / 2, 0, wallM, { uv: 4 });
    B.box(W + 0.4, 0.3, D + 0.4, 0, H + 0.15, 0, M.roof, { col: false });
    for (let fl = 0; fl < 4; fl++) for (let i = 0; i < 7; i++) for (const s of [1, -1]) {
      B.box(1.3, 1.4, 0.05, -W / 2 + 1.6 + i * 3.1, fl * 3 + 1.6, s * (D / 2 + 0.02), M.windowLit, { col: false, cast: false });
      if (s === 1 && fl > 0 && i % 2 === 0) B.box(2.4, 1.0, 1.2, -W / 2 + 1.6 + i * 3.1, fl * 3 + 0.5, D / 2 + 0.6, wallM, { col: false });
    }
    B.box(1.8, 2.3, 0.1, 0, 1.15, D / 2 + 0.05, M.darkWood, { col: false });
  }
  // kiosk
  {
    const y = game.terrain.getHeight(P.kiosk.x, P.kiosk.z);
    const B = new Builder(game, P.kiosk.x, y, P.kiosk.z, Math.PI * 0.9);
    B.box(4, 2.8, 3, 0, 1.4, 0, M.yellowPaint);
    B.box(4.6, 0.25, 3.6, 0, 2.9, 0.2, M.redPaint, { col: false });
    B.box(2.6, 1.0, 0.05, 0, 1.6, 1.52, M.windowLit, { col: false });
    B.add(PR.signBoard('KIOSKI PIKKU-PALA', 3.8, 0.5, '#c02020', '#ffffff', 'bold 80px Arial'), 0, 2.6, 1.6);
    game.spots.kiosk = B.w(0, 0.0, 2.4);
    B.hit(2.6, 1.2, 0.6, 0, 1.4, 1.7, { label: 'Kiosk window', use: () => game.actions.shop('kiosk') });
  }
  // church
  {
    const x = 540, z = -700;
    const y = game.terrain.getHeight(x, z);
    const B = new Builder(game, x, y, z, 0.3);
    const wh = new THREE.MeshStandardMaterial({ map: tex('planks_yellow.jpg'), color: 0xf4f0e8, roughness: 0.8 });
    B.box(9, 6, 16, 0, 3, 0, wh);
    const R2 = new Builder(game, x, y, z, 0.3 + Math.PI / 2); R2.gable(16.2, 9.2, 6, 4, 0.5, M.redRoof, wh);
    B.box(4, 12, 4, 0, 6, 9.5, wh);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.9, 7, 4), M.redRoof); spire.position.set(0, 15.5, 9.5); spire.rotation.y = Math.PI / 4; B.group.add(spire);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.15), M.chrome); cross.position.set(0, 19.6, 9.5); B.group.add(cross);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.15), M.chrome); cross2.position.set(0, 19.8, 9.5); B.group.add(cross2);
    for (let i = 0; i < 4; i++) for (const s of [1, -1]) B.box(0.05, 2.5, 1.2, s * 4.52, 3.2, -5 + i * 3.3, M.windowLit, { col: false });
  }
  // a few houses
  for (const [x, z, r, c] of [[690, -760, 0.5, 'red'], [820, -700, 2.0, 'white'], [760, -500, 3.3, 'yellow'], [860, -630, 1.6, 'red'], [655, -585, 0.1, 'white']]) {
    if (game.terrain.roadInfo(x, z).d < 8) continue;
    houseClosed(game, x, z, r, { w: 8, d: 7, color: c, storeys: c === 'white' ? 2 : 1 });
  }
  for (const [x, z] of [[705, -620], [740, -600], [690, -680], [770, -590]]) {
    const l = PR.streetLamp(); l.position.set(x, game.terrain.getHeight(x, z), z); game.scene.add(l);
    light(game, new THREE.Vector3(x, game.terrain.getHeight(x, z) + 5.6, z + 1.3), 0xffc890, 10, 18, (g) => g.sky.daylight < 0.55);
  }
}

// ------------------------------------------------------------------ FARM
function buildFarm(game) {
  const M = mats();
  const fh = houseClosed(game, P.farm.x, P.farm.z, Math.PI * 0.6, { w: 10, d: 7.5, color: 'yellow', storeys: 2 });
  game.spots.aune = fh.w(1.5, 0.5, 5.0);
  // barn
  const y = game.terrain.getHeight(P.barn.x, P.barn.z);
  const B = new Builder(game, P.barn.x, y, P.barn.z, Math.PI * 0.1);
  const W = 18, D = 12, H = 5;
  B.box(W + 0.4, 0.2, D + 0.4, 0, 0, 0, M.concrete, { surface: 'concrete', cast: false });
  B.wallX(-W / 2, W / 2, -D / 2, H, 0.25, M.redBoards, M.darkPlanks, [], -1);
  B.wallX(-W / 2, W / 2, D / 2, H, 0.25, M.redBoards, M.darkPlanks, [{ a: -3, b: 3, y0: 0, y1: 4.3 }], 1);
  B.wallZ(-D / 2, D / 2, -W / 2, H, 0.25, M.redBoards, M.darkPlanks, [], -1);
  B.wallZ(-D / 2, D / 2, W / 2, H, 0.25, M.redBoards, M.darkPlanks, [], 1);
  B.corners(W + 0.2, D + 0.2, H);
  B.gable(W + 0.4, D + 0.4, H, 4.5, 0.6, M.roof, M.redBoards);
  // hay stacked inside
  for (let i = 0; i < 6; i++) { const hb = PR.hayBale(); B.add(hb, -6 + (i % 3) * 1.4, 0.1 + Math.floor(i / 3) * 1.3, -4); }
  game.spots.barnDrop = B.w(0, 0.2, 1.5);
  game.spots.barnDoor = B.w(0, 0.2, D / 2 + 3);
  light(game, B.w(0, H - 0.4, 0), 0xffd8a8, 7, 12, (g) => g.sky.daylight < 0.7);
  // tractor shed
  const T = new Builder(game, P.farm.x - 20, game.terrain.getHeight(P.farm.x - 20, P.farm.z + 12), P.farm.z + 12, Math.PI * 0.6);
  for (const [x, z] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) T.box(0.25, 3.6, 0.25, x, 1.8, z, M.darkWood);
  T.box(9, 0.15, 7, 0, 3.7, 0, M.roof, { col: false, rx: 0.08 });
  T.wallX(-4, 4, -3, 3.6, 0.12, M.redBoards, M.darkPlanks, [], -1);
  game.spots.tractorShed = T.w(0, 0.3, 0);
  game.spots.tractorShedRy = Math.PI * 0.6;
  // fences around fields
  for (const f of [{ x: 850, z: 340 }, { x: 1050, z: 330 }]) {
    for (let i = -2; i <= 2; i++) { const fe = PR.fence(10); const fx = f.x + i * 10; const fz = f.z - 52; fe.position.set(fx, game.terrain.getHeight(fx, fz), fz); game.scene.add(fe); }
  }
  // mailbox & milk stand
  const mb = PR.mailbox('HAAPALA'); mb.position.set(748, game.terrain.getHeight(748, 322), 322); game.scene.add(mb);
}

// ------------------------------------------------------------------ RALLY
function buildRally(game) {
  const M = mats();
  const st = game.terrain.roads.find((r) => r.id === 'stage');
  const s0 = st.samples[0];
  const a = Math.atan2(s0.dx, s0.dz);
  const archObj = PR.arch('KURKI-SPRINT  •  START / MAALI', 8);
  archObj.position.set(s0.x, s0.h, s0.z); archObj.rotation.y = a; game.scene.add(archObj);
  const y = game.terrain.getHeight(P.rally.x, P.rally.z);
  const B = new Builder(game, P.rally.x, y, P.rally.z, 0.4);
  B.add(PR.tent(5, 5, '#c02020'), 6, 0, 6);
  B.add(PR.tent(4, 4, '#2040c0'), -6, 0, 8);
  B.box(6, 2.6, 2.5, -4, 1.3, -6, new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.6 }));
  B.box(1.8, 0.9, 0.05, -4, 1.6, -4.74, M.windowLit, { col: false });
  B.add(PR.signBoard('RALLI-TOIMISTO', 4, 0.6, '#c02020', '#fff', 'bold 90px Arial'), -4, 2.9, -4.7);
  B.box(1.2, 1.0, 0.6, 0, 0.5, 4, new THREE.MeshStandardMaterial({ color: 0xe8e8e0 }));
  game.spots.rallyDesk = B.w(-4, 0, -3.5);
  game.spots.rallyStart = new THREE.Vector3(s0.x, s0.h, s0.z);
  game.spots.rallyDir = a;
  game.spots.rallyHQ = B.w(0, 0, 0);
  B.hit(2, 1.5, 1.2, -4, 1.0, -4.3, { label: 'Rally office', use: () => game.actions.rallyOffice() });
  // spectator fences along the start straight
  for (let i = 5; i < 120; i += 6) {
    const s = st.samples[i]; if (!s) continue;
    for (const side of [-1, 1]) {
      const off = side * (st.width / 2 + 2.5);
      const f = PR.fence(5, 0.9); f.position.set(s.x - s.dz * off, game.terrain.getHeight(s.x - s.dz * off, s.z + s.dx * off), s.z + s.dx * off); f.rotation.y = Math.atan2(s.dx, s.dz) + Math.PI / 2; game.scene.add(f);
    }
  }
  // flags
  for (let i = 0; i < 6; i++) { const fp = PR.flagpole(); fp.scale.setScalar(0.7); fp.position.set(P.rally.x - 12 + i * 4.5, y, P.rally.z - 14); game.scene.add(fp); game.flags.push(fp.userData.flag); }
}

// ------------------------------------------------------------------ JUNKYARD
function buildJunkyard(game) {
  const M = mats();
  const y = game.terrain.getHeight(P.junkyard.x, P.junkyard.z);
  const B = new Builder(game, P.junkyard.x, y, P.junkyard.z, 0);
  const cols = [0x6a3a2a, 0x3a4a5a, 0x7a6a3a, 0x2a4a2a, 0x8a8a7a, 0x5a2a2a];
  for (let i = 0; i < 14; i++) {
    const w = PR.wreck(cols[i % cols.length]);
    const a = i * 0.9, r = 9 + (i % 4) * 4;
    B.add(w, Math.cos(a) * r, (i % 5 === 0) ? 1.0 : 0, Math.sin(a) * r, a * 1.7);
    B.col(1.7, 1.4, 4.0, Math.cos(a) * r, 0.7 + ((i % 5 === 0) ? 1.0 : 0), Math.sin(a) * r, a * 1.7, 'metal');
  }
  B.add(PR.tireStack(6), 3, 0, -3); B.add(PR.tireStack(5), 4, 0, -2.2); B.add(PR.oilDrum(0x6a2a1a), 2, 0, 3);
  // shack
  B.box(4, 2.5, 3, -4, 1.25, 3, M.darkPlanks);
  B.box(4.5, 0.15, 3.6, -4, 2.6, 3, M.roof, { col: false, rx: 0.1 });
  B.add(PR.signBoard('ROMU-RAIMO', 3, 0.5, '#5a3a1a', '#f0e0a0', 'bold 90px Georgia'), -4, 2.2, 4.56);
  game.spots.junkman = B.w(-4, 0, 5.4);
  game.spots.junkDrop = B.w(-1.5, 0.5, 5.5);
  for (let i = -3; i <= 3; i++) { const f = PR.fence(8, 1.6); f.position.set(P.junkyard.x + i * 8, game.terrain.getHeight(P.junkyard.x + i * 8, P.junkyard.z - 24), P.junkyard.z - 24); game.scene.add(f); }
}

// ------------------------------------------------------------------ COTTAGE
function buildCottage(game) {
  const B = houseClosed(game, P.cottage.x, P.cottage.z, 2.4, { w: 8, d: 6, color: 'red' });
  game.spots.cottage = B.w(0, 0.3, 5.0);
  const t = PR.table(1.4, 0.9, 0.75, mats().whitePaint); B.add(t, 2.5, 0.0, 5.5);
}
