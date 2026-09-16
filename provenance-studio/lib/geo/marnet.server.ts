/**
 * Réseau maritime mondial (données `searoute-js`, issues d'Eurostat) et plus
 * court chemin par Dijkstra (`geojson-path-finder`).
 *
 * `searoute-js` snappe chaque extrémité sur le sommet le plus proche d'une
 * seule ligne, qui peut appartenir à une composante isolée du réseau : la
 * route est alors introuvable. Ici, on essaie les K sommets les plus proches
 * de chaque extrémité jusqu'à trouver un chemin.
 */
import { createRequire } from "node:module";
import type { FeatureCollection, LineString } from "geojson";

import type { LngLat } from "@/lib/routes";

type PathFinderInstance = {
  findPath: (
    a: GeoJSON.Feature<GeoJSON.Point>,
    b: GeoJSON.Feature<GeoJSON.Point>,
  ) => { path: LngLat[]; weight: number } | null;
};
type PathFinderCtor = new (network: FeatureCollection<LineString>) => PathFinderInstance;

type Network = { finder: PathFinderInstance; vertices: LngLat[] };

let cached: Network | null = null;

function loadNetwork(): Network {
  if (cached) return cached;
  const require = createRequire(import.meta.url);
  const marnet = require("searoute-js/data/marnet_densified.json") as FeatureCollection<LineString>;
  const PathFinder = require("geojson-path-finder") as PathFinderCtor;
  const finder = new PathFinder(marnet);
  const seen = new Set<string>();
  const vertices: LngLat[] = [];
  for (const f of marnet.features) {
    for (const c of f.geometry.coordinates) {
      const key = `${c[0]},${c[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      vertices.push([c[0], c[1]]);
    }
  }
  cached = { finder, vertices };
  return cached;
}

const asPoint = (c: LngLat): GeoJSON.Feature<GeoJSON.Point> => ({
  type: "Feature",
  properties: {},
  geometry: { type: "Point", coordinates: c },
});

/** Distance équirectangulaire approchée (km), suffisante pour classer. */
function approxKm(a: LngLat, b: LngLat): number {
  const x = (a[0] - b[0]) * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  const y = a[1] - b[1];
  return Math.hypot(x, y) * 111.2;
}

function nearestVertices(p: LngLat, k: number): LngLat[] {
  const { vertices } = loadNetwork();
  const scored = vertices.map((v) => ({ v, d: approxKm(v, p) }));
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, k).map((s) => s.v);
}

const CANDIDATES = 8;

/**
 * Chemin sur le réseau entre les sommets les plus proches de `from` et `to`
 * (sans les extrémités réelles). `null` si aucune paire de candidats n'est
 * reliée.
 */
export function networkPath(from: LngLat, to: LngLat): LngLat[] | null {
  const { finder } = loadNetwork();
  const origins = nearestVertices(from, CANDIDATES);
  const destinations = nearestVertices(to, CANDIDATES);
  const pairs: { o: LngLat; d: LngLat; score: number }[] = [];
  for (const o of origins)
    for (const d of destinations) pairs.push({ o, d, score: approxKm(o, from) + approxKm(d, to) });
  pairs.sort((a, b) => a.score - b.score);

  for (const { o, d } of pairs) {
    if (o[0] === d[0] && o[1] === d[1]) return [o];
    const result = finder.findPath(asPoint(o), asPoint(d));
    if (result && result.path.length) {
      const cleaned: LngLat[] = [];
      for (const c of result.path) {
        const prev = cleaned[cleaned.length - 1];
        if (!prev || Math.hypot(prev[0] - c[0], prev[1] - c[1]) > 1e-6) cleaned.push([c[0], c[1]]);
      }
      return cleaned;
    }
  }
  return null;
}
