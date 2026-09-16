/**
 * Construit le GeoJSON des terres émergées utilisé (1) par le routage maritime
 * côté serveur (`lib/geo/data/land.geojson`) et (2) par le test d'intersection
 * (`test/fixtures/continents.geojson`, copie identique).
 *
 * Source : Natural Earth 1:50M via `world-atlas`, avec les canaux de Suez et
 * de Panama creusés (voies navigables absentes à cette échelle).
 *
 *   npx tsx scripts/build-continents-fixture.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import {
  area,
  bbox,
  bboxClip,
  buffer,
  coordEach,
  difference,
  featureCollection,
  flatten,
  lineString,
} from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const topology = require("world-atlas/land-50m.json") as Topology<{ land: GeometryCollection }>;

const converted = feature(topology, topology.objects.land) as unknown as
  Feature<Polygon | MultiPolygon> | FeatureCollection<Polygon | MultiPolygon>;
const landFeatures = converted.type === "FeatureCollection" ? converted.features : [converted];

// Axe approximatif des canaux, élargi de 12 km pour absorber l'imprécision
// du trait de côte à 1:50M.
const CANALS: [number, number][][] = [
  // Suez : golfe de Suez → Port-Saïd
  [
    [32.58, 29.85],
    [32.4, 30.3],
    [32.32, 30.7],
    [32.3, 31.0],
    [32.3, 31.35],
  ],
  // Panama : Balboa → Colón
  [
    [-79.55, 8.85],
    [-79.7, 9.1],
    [-79.92, 9.4],
  ],
];

/**
 * Les polygones coupés à l'antiméridien (Eurasie via la Tchoukotka, Fidji,
 * île Wrangel, Antarctique) ressortent du TopoJSON comme un seul anneau dont
 * un segment saute de +180 à -180 : en coordonnées planes, c'est une bande
 * qui fait le tour du monde et que toute route « traverse ». On décale les
 * sommets proches de -180 de +360 pour rendre l'anneau contigu, puis on le
 * coupe en deux à x = 180.
 */
const clone = <T>(f: T): T => JSON.parse(JSON.stringify(f)) as T;

function splitAntimeridian(
  poly: Feature<Polygon | MultiPolygon>,
): Feature<Polygon | MultiPolygon>[] {
  const b = bbox(poly);
  if (b[2] - b[0] < 300) return [poly];
  const shifted = clone(poly);
  coordEach(shifted, (c) => {
    if (c[0] < -170) c[0] += 360;
  });
  const west = clone(bboxClip(shifted, [-180, -90, 180, 90]));
  const east = clone(bboxClip(shifted, [180, -90, 360, 90]));
  coordEach(east, (c) => {
    c[0] -= 360;
  });
  return [west, east].flatMap((f) => flatten(f).features as Feature<Polygon | MultiPolygon>[]);
}

let polygons: Feature<Polygon | MultiPolygon>[] = landFeatures
  .flatMap((f) => flatten(f).features as Feature<Polygon | MultiPolygon>[])
  .flatMap(splitAntimeridian)
  // Slivers dégénérés (anneaux plats) : aucune terre réelle.
  .filter((f) => area(f) > 1e6);
for (const axis of CANALS) {
  const corridor = buffer(lineString(axis), 12, { units: "kilometers" });
  if (!corridor) throw new Error("buffer a échoué");
  const cb = bbox(corridor);
  polygons = polygons.flatMap((poly) => {
    // On ne découpe que les polygones concernés : `difference` sur un polygone
    // traversant l'antiméridien (Fidji) produit des artefacts.
    const pb = bbox(poly);
    const overlaps = pb[0] <= cb[2] && pb[2] >= cb[0] && pb[1] <= cb[3] && pb[3] >= cb[1];
    if (!overlaps) return [poly];
    const result = difference(featureCollection([poly, corridor]));
    return result ? (flatten(result).features as Feature<Polygon | MultiPolygon>[]) : [];
  });
}
polygons = polygons.map((f, i) => ({ ...f, properties: { id: i } }));

const json = JSON.stringify(featureCollection(polygons));
for (const out of [
  path.join(__dirname, "..", "lib", "geo", "data", "land.geojson"),
  path.join(__dirname, "..", "test", "fixtures", "continents.geojson"),
]) {
  writeFileSync(out, json);
  console.log(`${polygons.length} polygones écrits dans ${out}`);
}
