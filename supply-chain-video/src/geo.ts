import {
  bbox as turfBbox,
  distance as turfDistance,
  greatCircle,
  length as turfLength,
  lineSliceAlong,
  point,
} from "@turf/turf";
import type { Leg, LngLat, Step } from "./types";

/** Nombre de sommets par arc great-circle (lissage visuel). */
const ARC_POINTS = 100;

const toLngLat = (step: Step): LngLat => [step.lng, step.lat];

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

/**
 * Construit le tronçon `from → to`. La route passe par les waypoints du
 * step de départ (format JSON `[lat, lng]`), chaque segment étant un
 * great-circle. Sans waypoints : great-circle direct.
 */
export const buildLeg = (steps: Step[], fromIndex: number): Leg => {
  const from = steps[fromIndex];
  const to = steps[fromIndex + 1];
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

  const line: GeoJSON.Feature<GeoJSON.LineString> = {
    type: "Feature",
    properties: { mode: from.mode, from: fromIndex, to: fromIndex + 1 },
    geometry: { type: "LineString", coordinates: coords },
  };

  return {
    from: fromIndex,
    to: fromIndex + 1,
    mode: from.mode,
    line,
    lengthKm: turfLength(line, { units: "kilometers" }),
    directKm: turfDistance(point(toLngLat(from)), point(toLngLat(to)), {
      units: "kilometers",
    }),
  };
};

export const buildLegs = (steps: Step[]): Leg[] =>
  steps.slice(0, -1).map((_, i) => buildLeg(steps, i));

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

/** Emprise `[west, south, east, north]` d'un tronçon. */
export const legBbox = (leg: Leg): [number, number, number, number] => {
  const b = turfBbox(leg.line);
  return [b[0], b[1], b[2], b[3]];
};
