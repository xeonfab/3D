/**
 * Génère `remotion/sample-props.json` : le jeu de données de test
 * (« Torréfaction Lucie », Éthiopie Guji nature, 6 étapes) au format des
 * props de la composition, avec la route maritime Djibouti → Le Havre
 * calculée par lib/searoute.server. Sans token Mapbox : carte de secours.
 *
 *   npx tsx scripts/make-test-props.ts [--token pk.…]
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

import { computeSeaRoute } from "../lib/searoute.server";
import type { VideoProps } from "../remotion/types";

const tokenArg = process.argv.indexOf("--token");
const mapboxToken =
  tokenArg > -1 ? process.argv[tokenArg + 1] : process.env.NEXT_PUBLIC_MAPBOX_TOKEN || null;

const base = [
  {
    title: "Ferme Kayon Mountain",
    caption: "Récolte à la main, nov.–janv.",
    lat: 5.75,
    lng: 38.9,
    mode: "land",
    photoUrl: "samples/farm.jpg",
  },
  {
    title: "Station de lavage",
    caption: "Séchage 18 jours sur lits africains",
    lat: 5.9,
    lng: 38.8,
    mode: "land",
    photoUrl: null,
  },
  {
    title: "Port de Djibouti",
    caption: "Départ en conteneur, café vert en sacs GrainPro",
    lat: 11.6,
    lng: 43.15,
    mode: "sea",
    photoUrl: null,
  },
  {
    title: "Port du Havre",
    caption: "6 semaines de traversée",
    lat: 49.49,
    lng: 0.11,
    mode: "land",
    photoUrl: null,
  },
  {
    title: "Entrepôt Belco",
    caption: "Stocké à température contrôlée",
    lat: 44.84,
    lng: -0.58,
    mode: "land",
    photoUrl: null,
  },
  {
    title: "Atelier",
    caption: "Torréfié en petit lot chaque semaine",
    lat: 48.11,
    lng: -1.68,
    mode: "land",
    photoUrl: "samples/roaster.jpg",
  },
] as const;

const steps: VideoProps["steps"] = base.map((s, i) => {
  const next = base[i + 1];
  const waypoints =
    s.mode === "sea" && next
      ? (computeSeaRoute([s.lng, s.lat], [next.lng, next.lat])?.waypoints ?? [])
      : [];
  return { ...s, waypoints, durationSeconds: 6 };
});

const props: VideoProps = {
  product: { name: "Éthiopie Guji nature", endLine: "Récolté en janvier. Torréfié mardi dernier." },
  steps,
  brand: { name: "Torréfaction Lucie", color: "#D9822B", logoUrl: "samples/logo.png" },
  watermark: false,
  format: "vertical",
  mapboxToken,
};

const out = path.join(__dirname, "..", "remotion", "sample-props.json");
writeFileSync(out, JSON.stringify({ ...props, mapboxToken: null }, null, 2));
console.log(
  `Props écrites dans ${out} (${steps.length} étapes, route maritime : ${steps[2].waypoints.length} points)`,
);
if (mapboxToken) {
  const withToken = path.join(__dirname, "..", ".renders", "test-props.json");
  writeFileSync(withToken, JSON.stringify(props));
  console.log(`Props avec token Mapbox écrites dans ${withToken} (non versionné)`);
}
