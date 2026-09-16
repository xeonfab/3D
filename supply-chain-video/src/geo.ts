import {
  bbox as turfBbox,
  circle as turfCircle,
  distance as turfDistance,
  greatCircle,
  length as turfLength,
  lineSliceAlong,
  point,
} from "@turf/turf";
import type { Leg, LngLat, Step, TravelMode } from "./types";

/** Nombre de sommets par arc great-circle (lissage visuel). */
const ARC_POINTS = 100;

export const toLngLat = (step: Pick<Step, "lat" | "lng">): LngLat => [step.lng, step.lat];

/**
 * Arc great-circle entre deux points, en coordonnées `[lng, lat]`.
 * turf gère l'antiméridien en renvoyant une MultiLineString ; on la
 * recolle en une seule ligne pour faciliter le découpage progressif.
 */
const arc = (a: LngLat, b: LngLat): LngLat[] => {
  const gc = greatCircle(point(a), point(b), { npoints: ARC_POINTS });
  if (gc.geometry.type === "LineString") return gc.geometry.coordinates as LngLat[];
  return (gc.geometry.coordinates as LngLat[][]).flat();
};

const lineFeature = (
  coords: LngLat[],
  properties: GeoJSON.GeoJsonProperties,
): GeoJSON.Feature<GeoJSON.LineString> => ({
  type: "Feature",
  properties,
  geometry: { type: "LineString", coordinates: coords },
});

/**
 * Construit le tronçon `from → from+1`. La route passe par les waypoints du
 * step de départ (format JSON `[lat, lng]`), chaque segment étant un
 * great-circle. Sans waypoints : great-circle direct.
 */
export const buildLeg = (steps: Step[], fromIndex: number): Leg => {
  const from = steps[fromIndex];
  const to = steps[fromIndex + 1];
  const mode: TravelMode = from.mode ?? "land";
  const anchors: LngLat[] = [
    toLngLat(from),
    ...(from.waypoints ?? []).map(([lat, lng]): LngLat => [lng, lat]),
    toLngLat(to),
  ];

  const coords: LngLat[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const seg = arc(anchors[i], anchors[i + 1]);
    // Évite le doublon de sommet à la jonction de deux arcs.
    coords.push(...(i === 0 ? seg : seg.slice(1)));
  }
  const line = lineFeature(coords, { mode, from: fromIndex, to: fromIndex + 1 });

  return {
    from: fromIndex,
    to: fromIndex + 1,
    mode,
    line,
    lengthKm: turfLength(line, { units: "kilometers" }),
    directKm: turfDistance(point(toLngLat(from)), point(toLngLat(to)), {
      units: "kilometers",
    }),
  };
};

export const buildLegs = (steps: Step[]): Leg[] =>
  steps.slice(0, -1).map((_, i) => buildLeg(steps, i));

/** Great-circle direct entre deux étapes, sans waypoints (rayon ferme → atelier). */
export const buildSpoke = (steps: Step[], from: number, to: number): Leg => {
  const line = lineFeature(arc(toLngLat(steps[from]), toLngLat(steps[to])), {
    mode: "land",
    from,
    to,
    spoke: true,
  });
  const km = turfLength(line, { units: "kilometers" });
  return { from, to, mode: "land", line, lengthKm: km, directKm: km };
};

/**
 * Chaîne de tronçons consécutifs (`from → … → to`), avec la longueur
 * cumulée : sert à dessiner un seul arc continu à travers les transits.
 */
export type Chain = { legs: Leg[]; totalKm: number; offsetsKm: number[] };

export const buildChain = (steps: Step[], from: number, to: number): Chain => {
  const legs: Leg[] = [];
  const offsetsKm: number[] = [];
  let total = 0;
  for (let i = from; i < to; i++) {
    const leg = buildLeg(steps, i);
    offsetsKm.push(total);
    total += leg.lengthKm;
    legs.push(leg);
  }
  return { legs, totalKm: total, offsetsKm };
};

/** Progression (0→1) de chaque tronçon d'une chaîne pour une progression globale. */
export const chainLegProgress = (chain: Chain, progress: number): number[] => {
  const km = Math.min(1, Math.max(0, progress)) * chain.totalKm;
  return chain.legs.map((leg, i) =>
    Math.min(1, Math.max(0, (km - chain.offsetsKm[i]) / Math.max(leg.lengthKm, 1e-9))),
  );
};

/**
 * Portion du tronçon déjà parcourue (0 ≤ progress ≤ 1), pour le tracé
 * progressif. Renvoie `null` tant que rien n'est dessiné.
 */
export const partialLine = (
  leg: Leg,
  progress: number,
): GeoJSON.Feature<GeoJSON.LineString> | null => {
  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0) return null;
  if (p >= 1) return leg.line;
  const sliced = lineSliceAlong(leg.line, 0, leg.lengthKm * p, {
    units: "kilometers",
  });
  return { ...sliced, properties: leg.line.properties };
};

/** Position sur le tronçon à `progress` (tête du tracé), en `[lng, lat]`. */
export const pointAlong = (leg: Leg, progress: number): LngLat => {
  const partial = partialLine(leg, progress);
  if (!partial) return leg.line.geometry.coordinates[0] as LngLat;
  const c = partial.geometry.coordinates;
  return c[c.length - 1] as LngLat;
};

/** Point à mi-longueur d'une chaîne, en `[lng, lat]`. */
export const chainMidpoint = (chain: Chain): LngLat => {
  const half = chain.totalKm / 2;
  const i = Math.max(
    0,
    chain.legs.findIndex((leg, k) => chain.offsetsKm[k] + leg.lengthKm >= half),
  );
  const leg = chain.legs[i];
  return pointAlong(leg, (half - chain.offsetsKm[i]) / Math.max(leg.lengthKm, 1e-9));
};

export type Bbox = [number, number, number, number];

/** Emprise `[west, south, east, north]` d'un ensemble de lignes / points. */
export const bboxOf = (features: GeoJSON.Feature[]): Bbox => {
  const b = turfBbox({ type: "FeatureCollection", features });
  return [b[0], b[1], b[2], b[3]];
};

export const legsBbox = (legs: Leg[]): Bbox => bboxOf(legs.map((l) => l.line));

export const pointsBbox = (pts: LngLat[]): Bbox => bboxOf(pts.map((p) => point(p)));

export const distanceKm = (a: LngLat, b: LngLat): number =>
  turfDistance(point(a), point(b), { units: "kilometers" });

/** Cercle géodésique de rayon `km` autour de `center`, en ligne fermée. */
export const circleLine = (center: LngLat, km: number): GeoJSON.Feature<GeoJSON.LineString> => {
  const poly = turfCircle(point(center), km, { units: "kilometers", steps: 128 });
  return lineFeature(poly.geometry.coordinates[0] as LngLat[], { circle: true });
};
