/**
 * Vérification géographique des routes, sans rendu vidéo :
 *
 *   npm run check:route            # public/steps.json
 *   npm run check:route -- autre.json --svg out/route-check.svg --max-land-km 200
 *
 * Pour chaque tronçon :
 *  - longueur de la route et distance directe ;
 *  - pour un tronçon "sea", portions de la route qui passent sur la terre
 *    (Natural Earth 50 m, via `world-atlas`) avec leur position, pour
 *    repérer un waypoint mal placé. Les isthmes à canal (Suez, Panama)
 *    apparaissent comme de courts passages « terrestres » : c'est attendu ;
 *  - distance de la route au point d'arrivée de chaque waypoint (doit être ≈ 0).
 * Le script produit aussi un SVG (terres + route) pour contrôle visuel.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { feature } from "topojson-client";
import { along, booleanPointInPolygon, point, pointToLineDistance } from "@turf/turf";
import { validateSteps } from "../src/data";
import { buildLegs } from "../src/geo";
import type { Leg } from "../src/types";

type Topology = Parameters<typeof feature>[0];

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const svgPath = opt("--svg") ?? "out/route-check.svg";
/** Passage sur terre toléré (km) : longueur d'un canal (Suez ≈ 160 km). */
const maxLandKm = Number(opt("--max-land-km") ?? 200);
const stepsPath =
  args.find((a, i) => !a.startsWith("--") && !(args[i - 1] ?? "").startsWith("--")) ??
  "public/steps.json";

const stepsFile = validateSteps(JSON.parse(readFileSync(resolve(stepsPath), "utf8")));
const legs = buildLegs(stepsFile.steps);

const topo = JSON.parse(
  readFileSync(resolve("node_modules/world-atlas/land-50m.json"), "utf8"),
) as Topology;
const landRaw = feature(topo, topo.objects.land) as unknown as
  | GeoJSON.Feature<GeoJSON.MultiPolygon>
  | GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
// Fusionne en un seul MultiPolygon, quel que soit le format du TopoJSON.
const land: GeoJSON.Feature<GeoJSON.MultiPolygon> =
  landRaw.type === "Feature"
    ? landRaw
    : {
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiPolygon",
          coordinates: landRaw.features.flatMap((f) =>
            f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates,
          ),
        },
      };

/** Pas d'échantillonnage (km) pour la détection des passages sur terre. */
const SAMPLE_KM = 5;

const fmt = (n: number) => n.toFixed(1).padStart(8);

/**
 * Passages sur terre : on échantillonne la route tous les SAMPLE_KM et on
 * regroupe les échantillons consécutifs situés dans un polygone terrestre.
 */
const landCrossings = (leg: Leg) => {
  const runs: { km: number; lat: number; lng: number }[] = [];
  let run: { startKm: number; mid: GeoJSON.Position } | null = null;
  for (let d = 0; d <= leg.lengthKm; d += SAMPLE_KM) {
    const p = along(leg.line, Math.min(d, leg.lengthKm), { units: "kilometers" });
    const onLand = booleanPointInPolygon(p, land);
    if (onLand && !run) run = { startKm: d, mid: p.geometry.coordinates };
    if (onLand && run) run.mid = p.geometry.coordinates;
    if (!onLand && run) {
      const km = d - run.startKm;
      const mid = along(leg.line, run.startKm + km / 2, { units: "kilometers" }).geometry.coordinates;
      runs.push({ km, lat: mid[1], lng: mid[0] });
      run = null;
    }
  }
  if (run) {
    const km = leg.lengthKm - run.startKm;
    const mid = along(leg.line, run.startKm + km / 2, { units: "kilometers" }).geometry.coordinates;
    runs.push({ km, lat: mid[1], lng: mid[0] });
  }
  return runs;
};

let problems = 0;
console.log(`Produit : ${stepsFile.product} — ${stepsFile.steps.length} étapes, ${legs.length} tronçons\n`);

for (const leg of legs) {
  const from = stepsFile.steps[leg.from];
  const to = stepsFile.steps[leg.to];
  console.log(`[${leg.from}→${leg.to}] ${from.title} → ${to.title} (${leg.mode})`);
  console.log(`   route ${fmt(leg.lengthKm)} km   direct ${fmt(leg.directKm)} km`);

  (from.waypoints ?? []).forEach(([lat, lng], i) => {
    const d = pointToLineDistance(point([lng, lat]), leg.line, { units: "kilometers" });
    if (d > 1) {
      problems++;
      console.log(`   ✗ waypoint ${i} [${lat}, ${lng}] à ${d.toFixed(1)} km de la route`);
    }
  });

  if (leg.mode === "sea") {
    const crossings = landCrossings(leg);
    const totalLand = crossings.reduce((s, c) => s + c.km, 0);
    if (crossings.length === 0) {
      console.log("   ✓ aucune traversée de terre");
    } else {
      console.log(`   passages sur terre : ${crossings.length} (${totalLand.toFixed(0)} km au total)`);
      for (const c of crossings) {
        const long = c.km > maxLandKm;
        if (long) problems++;
        console.log(
          `   ${long ? "✗" : "~"} ${c.km.toFixed(0).padStart(5)} km autour de [${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}]${long ? "  ← un continent est traversé : ajoutez des waypoints" : "  (canal / port : normal)"}`,
        );
      }
    }
  }
  console.log();
}

// --- SVG de contrôle (équirectangulaire, emprise = route + marge) ---------
const all = legs.flatMap((l) => l.line.geometry.coordinates);
const lngs = all.map((c) => c[0]);
const lats = all.map((c) => c[1]);
const pad = 6;
const W = Math.max(...lngs) + pad, E = Math.min(...lngs) - pad;
const west = Math.min(E, W), east = Math.max(E, W);
const south = Math.min(...lats) - pad, north = Math.max(...lats) + pad;
const scale = 1400 / (east - west);
const width = 1400, height = Math.round((north - south) * scale);
const X = (lng: number) => (lng - west) * scale;
const Y = (lat: number) => (north - lat) * scale;
const ring = (r: GeoJSON.Position[]) => r.map((c) => `${X(c[0]).toFixed(1)},${Y(c[1]).toFixed(1)}`).join(" ");
const landPolys = land.geometry.coordinates
  .map((poly) => `<polygon points="${ring(poly[0])}" fill="#2a2f36" stroke="#5c6570" stroke-width="0.8"/>`)
  .join("\n");
const routes = legs
  .map(
    (l) =>
      `<polyline points="${ring(l.line.geometry.coordinates)}" fill="none" stroke="#D9822B" stroke-width="3" ${l.mode === "sea" ? 'stroke-dasharray="6 5"' : ""}/>`,
  )
  .join("\n");
const dots = stepsFile.steps
  .map(
    (s, i) =>
      `<circle cx="${X(s.lng)}" cy="${Y(s.lat)}" r="7" fill="#D9822B" stroke="white" stroke-width="2"/><text x="${X(s.lng) + 12}" y="${Y(s.lat) + 5}" fill="white" font-family="sans-serif" font-size="18">${i + 1}. ${s.title}</text>`,
  )
  .join("\n");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="100%" height="100%" fill="#0f1a2b"/>
${landPolys}
${routes}
${dots}
</svg>`;
mkdirSync(dirname(resolve(svgPath)), { recursive: true });
writeFileSync(resolve(svgPath), svg);
console.log(`SVG de contrôle : ${svgPath}`);

if (problems > 0) {
  console.error(`\n✗ ${problems} problème(s) détecté(s)`);
  process.exit(1);
}
console.log("\n✓ routes cohérentes");
