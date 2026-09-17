/**
 * Continents simplifiés pour la carte de secours du rendu (sans token
 * Mapbox) : `remotion/assets/land-simplified.geojson`, ≈ 300 Ko.
 *
 *   npx tsx scripts/build-fallback-land.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { area, simplify } from "@turf/turf";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

const src = path.join(__dirname, "..", "lib", "geo", "data", "land.geojson");
const out = path.join(__dirname, "..", "remotion", "assets", "land-simplified.geojson");
const fc = JSON.parse(readFileSync(src, "utf8")) as FeatureCollection<Polygon | MultiPolygon>;

const features = fc.features
  .filter((f) => area(f) > 400e6) // < 400 km² : invisible à l'échelle d'une vidéo
  .flatMap((f) => {
    try {
      return [simplify(f, { tolerance: 0.04, highQuality: true })];
    } catch {
      return [f]; // anneau dégénéré après simplification : on garde l'original
    }
  })
  .map((f) => ({ ...f, properties: {} }));

const rounded = JSON.stringify({ type: "FeatureCollection", features }, (_k, v) =>
  typeof v === "number" ? Math.round(v * 1000) / 1000 : v,
);
writeFileSync(out, rounded);
console.log(`${features.length} polygones, ${Math.round(rounded.length / 1024)} Ko → ${out}`);
