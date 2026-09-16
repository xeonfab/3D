/**
 * Terres émergées (Natural Earth 1:50M, canaux creusés — voir
 * scripts/build-continents-fixture.ts) et recherche de chemin en mer.
 * Côté serveur uniquement : le GeoJSON pèse 2,5 Mo et n'est chargé qu'à la
 * première route maritime calculée.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  bbox as turfBbox,
  bboxClip,
  booleanIntersects,
  booleanPointInPolygon,
  lineString,
  point,
} from "@turf/turf";
import type { BBox, Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

import { seaSegmentCoords, type LngLat } from "@/lib/routes";

type LandPolygon = Feature<Polygon | MultiPolygon>;
type Indexed = { feature: LandPolygon; bbox: BBox };

let index: Indexed[] | null = null;

function loadLand(): Indexed[] {
  if (index) return index;
  const file = path.join(process.cwd(), "lib", "geo", "data", "land.geojson");
  const fc = JSON.parse(readFileSync(file, "utf8")) as FeatureCollection<Polygon | MultiPolygon>;
  index = fc.features.map((feature) => ({ feature, bbox: turfBbox(feature) }));
  return index;
}

const bboxOverlaps = (a: BBox, b: BBox) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

function expand(b: BBox, margin: number): BBox {
  return [b[0] - margin, b[1] - margin, b[2] + margin, b[3] + margin];
}

/** Polygones terrestres découpés à la zone (rapides à tester). */
export function landWithin(area: BBox): LandPolygon[] {
  const out: LandPolygon[] = [];
  for (const { feature, bbox } of loadLand()) {
    if (!bboxOverlaps(bbox, area)) continue;
    const clipped = bboxClip(feature, area);
    const coords = clipped.geometry.coordinates;
    if (coords.length === 0) continue;
    out.push(clipped as LandPolygon);
  }
  return out;
}

function lineCrossesLand(coords: LngLat[], polys: LandPolygon[]): boolean {
  const line = lineString(coords);
  const lb = turfBbox(line);
  for (const poly of polys) {
    if (!bboxOverlaps(turfBbox(poly), lb)) continue;
    if (booleanIntersects(line, poly)) return true;
  }
  return false;
}

/** Le point est-il à terre ? (nœuds de réseau maritime imprécis, saisies) */
export function isOnLand(p: LngLat): boolean {
  const pt = point(p);
  for (const { feature, bbox } of loadLand()) {
    if (p[0] < bbox[0] || p[0] > bbox[2] || p[1] < bbox[1] || p[1] > bbox[3]) continue;
    if (booleanPointInPolygon(pt, feature)) return true;
  }
  return false;
}

/** Le segment maritime a → b (tel qu'il sera dessiné) touche-t-il une terre ? */
export function seaSegmentCrossesLand(a: LngLat, b: LngLat, polys?: LandPolygon[]): boolean {
  const coords = seaSegmentCoords(a, b);
  const area = expand(turfBbox(lineString(coords)), 0.05);
  return lineCrossesLand(coords, polys ?? landWithin(area));
}

/**
 * Chemin en mer entre a et b : A* sur une grille locale (cellules d'environ
 * 1 à 5 km, marge d'une cellule le long des côtes), puis lissage par ligne de
 * visée. Renvoie les points intermédiaires, ou null si aucun chemin n'existe
 * dans la zone (points enclavés, par exemple).
 */
export function findWaterPath(a: LngLat, b: LngLat): LngLat[] | null {
  const raw: BBox = [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
  ];
  const span = Math.max(raw[2] - raw[0], raw[3] - raw[1]);
  const area = expand(raw, Math.max(0.35, span * 0.5));
  const polys = landWithin(area);
  if (polys.length === 0) return [];

  const cell = Math.min(0.05, Math.max(0.01, span / 120));
  const cols = Math.ceil((area[2] - area[0]) / cell) + 1;
  const rows = Math.ceil((area[3] - area[1]) / cell) + 1;
  const lngOf = (c: number) => area[0] + c * cell;
  const latOf = (r: number) => area[1] + r * cell;

  // 0 = eau, 1 = terre, 2 = eau collée à une terre (marge)
  const grid = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = point([lngOf(c), latOf(r)]);
      for (const poly of polys) {
        if (booleanPointInPolygon(p, poly)) {
          grid[r * cols + c] = 1;
          break;
        }
      }
    }
  }
  // Îlots plus petits qu'une cellule : aucun centre de cellule ne tombe
  // dedans, on bloque toutes les cellules couvrant leur emprise.
  for (const poly of polys) {
    const pb = turfBbox(poly);
    if (pb[2] - pb[0] > 2 * cell || pb[3] - pb[1] > 2 * cell) continue;
    const c0 = Math.max(0, Math.floor((pb[0] - area[0]) / cell));
    const c1 = Math.min(cols - 1, Math.ceil((pb[2] - area[0]) / cell));
    const r0 = Math.max(0, Math.floor((pb[1] - area[1]) / cell));
    const r1 = Math.min(rows - 1, Math.ceil((pb[3] - area[1]) / cell));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) grid[r * cols + c] = 1;
  }
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r * cols + c] === 1) {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) blocked[rr * cols + cc] = 1;
          }
      }
    }
  }

  const toCell = (p: LngLat): [number, number] => [
    Math.min(cols - 1, Math.max(0, Math.round((p[0] - area[0]) / cell))),
    Math.min(rows - 1, Math.max(0, Math.round((p[1] - area[1]) / cell))),
  ];
  const nearestFree = ([c0, r0]: [number, number]): [number, number] | null => {
    for (let radius = 0; radius < Math.max(cols, rows); radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
          if (!blocked[r * cols + c]) return [c, r];
        }
      }
    }
    return null;
  };
  const start = nearestFree(toCell(a));
  const goal = nearestFree(toCell(b));
  if (!start || !goal) return null;

  const cosLat = Math.cos((((area[1] + area[3]) / 2) * Math.PI) / 180);
  const h = (c: number, r: number) => Math.hypot((c - goal[0]) * cosLat, r - goal[1]);
  const gScore = new Float64Array(cols * rows).fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(cols * rows).fill(-1);
  const closed = new Uint8Array(cols * rows);
  const open: { i: number; f: number }[] = [];
  const push = (i: number, f: number) => {
    open.push({ i, f });
    let k = open.length - 1;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (open[parent].f <= open[k].f) break;
      [open[parent], open[k]] = [open[k], open[parent]];
      k = parent;
    }
  };
  const pop = () => {
    const top = open[0];
    const last = open.pop()!;
    if (open.length) {
      open[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const rgt = l + 1;
        let m = k;
        if (l < open.length && open[l].f < open[m].f) m = l;
        if (rgt < open.length && open[rgt].f < open[m].f) m = rgt;
        if (m === k) break;
        [open[m], open[k]] = [open[k], open[m]];
        k = m;
      }
    }
    return top;
  };

  const startI = start[1] * cols + start[0];
  const goalI = goal[1] * cols + goal[0];
  gScore[startI] = 0;
  push(startI, h(start[0], start[1]));

  let found = false;
  while (open.length) {
    const { i } = pop();
    if (closed[i]) continue;
    if (i === goalI) {
      found = true;
      break;
    }
    closed[i] = 1;
    const c = i % cols;
    const r = (i - c) / cols;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const cc = c + dc;
        const rr = r + dr;
        if (cc < 0 || cc >= cols || rr < 0 || rr >= rows) continue;
        const j = rr * cols + cc;
        if (blocked[j] || closed[j]) continue;
        const tentative = gScore[i] + Math.hypot(dc * cosLat, dr);
        if (tentative < gScore[j]) {
          gScore[j] = tentative;
          cameFrom[j] = i;
          push(j, tentative + h(cc, rr));
        }
      }
    }
  }
  if (!found) return null;

  const cells: LngLat[] = [];
  for (let i = goalI; i !== -1; i = cameFrom[i]) {
    const c = i % cols;
    cells.push([lngOf(c), latOf((i - c) / cols)]);
  }
  cells.reverse();

  // Lissage : on saute au point le plus lointain visible sans toucher une terre.
  const pts: LngLat[] = [a, ...cells, b];
  const smoothed: LngLat[] = [a];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && lineCrossesLand(seaSegmentCoords(pts[i], pts[j]), polys)) j--;
    smoothed.push(pts[j]);
    i = j;
  }
  return smoothed.slice(1, -1);
}
