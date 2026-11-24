// Map definition for the original world of "Rustbucket Summer": the lakeside countryside around Kurkijärvi.
// Coordinates: x = east, z = south (north = -z). Units: metres.
import { fbm2, ridged2, smoothstep, perlin2 } from '../core/noise.js';

export const MAP_SIZE = 2400;
export const HALF = MAP_SIZE / 2;
export const WATER_LEVEL = 10;

export const LAKE_BLOBS = [
  { x: -150, z: 80, r: 300 },
  { x: -380, z: -80, r: 190 },
  { x: 40, z: 230, r: 170 },
  { x: -60, z: -190, r: 160 },
  { x: -470, z: 120, r: 120 },
];
export const ISLANDS = [{ x: -170, z: 20, r: 45, h: 6 }, { x: -380, z: -110, r: 30, h: 4 }, { x: 10, z: 180, r: 22, h: 3 }];

// Key places
export const P = {
  home: { x: -385, z: 418 },
  garage: { x: -352, z: 442 },
  sauna: { x: -318, z: 352 },
  shed: { x: -410, z: 452 },
  village: { x: 380, z: 640 },
  shop: { x: 385, z: 598 },
  gas: { x: 458, z: 606 },
  pub: { x: 312, z: 598 },
  pertti: { x: 352, z: 696 },
  busstop: { x: 420, z: 660 },
  farm: { x: 930, z: 220 },
  barn: { x: 965, z: 260 },
  town: { x: 700, z: -640 },
  parts: { x: 760, z: -662 },
  inspection: { x: 808, z: -560 },
  police: { x: 628, z: -706 },
  apartments: { x: 610, z: -560 },
  kiosk: { x: 700, z: -600 },
  rally: { x: -620, z: -690 },
  dock: { x: -296, z: 332 },
  junkyard: { x: 120, z: 410 },
  cottage: { x: -560, z: 160 },
};

// Building sites that get flattened terrain: x, z, radius, blend radius
export const SITES = [
  { ...P.home, r: 38, b: 30, yard: 30 },
  { ...P.sauna, r: 9, b: 10, yard: 6, shore: true },
  { ...P.village, r: 70, b: 40, yard: 0 },
  { ...P.shop, r: 26, b: 20, yard: 22 },
  { ...P.gas, r: 26, b: 18, yard: 22 },
  { ...P.pub, r: 24, b: 18, yard: 20 },
  { ...P.pertti, r: 20, b: 18, yard: 14 },
  { ...P.farm, r: 40, b: 40, yard: 30 },
  { ...P.barn, r: 26, b: 20, yard: 20 },
  { ...P.town, r: 150, b: 60, yard: 0 },
  { ...P.parts, r: 26, b: 20, yard: 24 },
  { ...P.inspection, r: 30, b: 20, yard: 28 },
  { ...P.police, r: 26, b: 20, yard: 24 },
  { ...P.rally, r: 45, b: 35, yard: 40 },
  { ...P.junkyard, r: 30, b: 25, yard: 28 },
  { ...P.cottage, r: 18, b: 18, yard: 12 },
];

// Fields at the farm (axis aligned rectangles: cx, cz, w, d, crop)
export const FIELDS = [
  { x: 1010, z: 120, w: 150, d: 110, crop: 'barley' },
  { x: 850, z: 340, w: 120, d: 100, crop: 'hay' },
  { x: 1050, z: 330, w: 110, d: 120, crop: 'hay' },
  { x: 840, z: 90, w: 90, d: 120, crop: 'oats' },
];

// Road network. type: 'asphalt' | 'gravel' | 'stage'
export const ROADS = [
  {
    id: 'highway', type: 'asphalt', width: 7.2, closed: true, limit: 80,
    pts: [[-520, 590], [-300, 588], [-80, 628], [130, 652], [380, 642], [600, 540], [740, 340], [800, 100], [810, -150], [790, -380], [720, -600], [560, -760], [320, -830], [40, -830], [-250, -780], [-560, -650], [-770, -470], [-860, -220], [-870, 40], [-800, 300], [-680, 500]],
  },
  { id: 'driveway', type: 'gravel', width: 4.2, pts: [[-386, 590], [-384, 540], [-372, 492], [-360, 462]] },
  { id: 'saunapath', type: 'gravel', width: 3.0, pts: [[-372, 432], [-350, 400], [-330, 370]] },
  { id: 'farmroad', type: 'gravel', width: 5, pts: [[742, 330], [800, 300], [870, 262], [920, 245], [960, 238]] },
  { id: 'fieldroad', type: 'gravel', width: 4, pts: [[920, 245], [940, 180], [930, 60], [900, -40], [810, -110]] },
  { id: 'lakeroad', type: 'gravel', width: 5.2, pts: [[200, 650], [230, 520], [250, 400], [330, 260], [430, 90], [520, -90], [640, -230], [790, -300]] },
  { id: 'junkroad', type: 'gravel', width: 4.2, pts: [[240, 430], [180, 425], [140, 412]] },
  { id: 'cottageroad', type: 'gravel', width: 4.0, pts: [[-812, 260], [-720, 220], [-640, 180], [-575, 165]] },
  { id: 'townstreet', type: 'asphalt', width: 6.5, pts: [[720, -600], [700, -660], [660, -700], [600, -712]] },
  { id: 'townstreet2', type: 'asphalt', width: 6.5, pts: [[720, -600], [770, -590], [808, -585]] },
  { id: 'townstreet3', type: 'asphalt', width: 6.0, pts: [[745, -615], [762, -640]] },
  { id: 'villagestreet', type: 'gravel', width: 5.0, pts: [[380, 642], [370, 680], [356, 700]] },
  { id: 'rallyaccess', type: 'gravel', width: 6, pts: [[-560, -650], [-600, -672], [-640, -690]] },
  {
    id: 'stage', type: 'stage', width: 5.6, closed: true,
    pts: [[-640, -690], [-700, -760], [-770, -840], [-880, -930], [-990, -950], [-1080, -880], [-1120, -760], [-1100, -640], [-1040, -560], [-960, -540], [-900, -600], [-860, -680], [-800, -700], [-740, -690]],
  },
];

export function lakeD(x, z) {
  // normalized distance to the lake (<1 inside water)
  let d = 99;
  for (const b of LAKE_BLOBS) {
    const dd = Math.hypot(x - b.x, z - b.z) / b.r;
    d = Math.min(d, dd);
  }
  d += perlin2(x / 90, z / 90, 404) * 0.08 + perlin2(x / 30, z / 30, 405) * 0.02;
  return d;
}

// Base terrain before roads/sites flattening
export function baseHeight(x, z) {
  let h = 20 + fbm2(x / 650, z / 650, 4, 1) * 18 + ridged2(x / 380, z / 380, 3, 2) * 10 + fbm2(x / 120, z / 120, 3, 3) * 3.2;
  // higher hills toward the north-west (rally forest) and map edges
  const edge = Math.max(Math.abs(x), Math.abs(z)) / HALF;
  h += smoothstep(0.75, 1.0, edge) * 22;
  h += smoothstep(200, -900, z) * smoothstep(0, -900, x) * 14;
  const d = lakeD(x, z);
  if (d < 1) {
    h = WATER_LEVEL - 0.6 - smoothstep(1.0, 0.55, d) * 11;
  } else {
    const s = smoothstep(1.0, 1.65, d);
    h = (WATER_LEVEL - 0.6) + (h - (WATER_LEVEL - 0.6)) * s + s * 0;
    h = Math.max(h, WATER_LEVEL - 0.6 + (d - 1) * 12);
  }
  for (const is of ISLANDS) {
    const k = smoothstep(is.r, is.r * 0.3, Math.hypot(x - is.x, z - is.z));
    h = Math.max(h, WATER_LEVEL - 2 + k * (is.h + 2) + k * fbm2(x / 15, z / 15, 2, 9) * 2);
  }
  return h;
}

export function forestMask(x, z) {
  const n = fbm2(x / 380, z / 380, 4, 50) + fbm2(x / 90, z / 90, 2, 51) * 0.25;
  const edge = Math.max(Math.abs(x), Math.abs(z)) / HALF;
  return smoothstep(-0.25, 0.15, n) * 0.85 + smoothstep(0.8, 0.95, edge);
}
