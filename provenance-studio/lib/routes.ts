/**
 * Calcul des tracés — partagé entre l'aperçu navigateur et le rendu Remotion,
 * pour que la vidéo et l'aperçu soient identiques.
 *
 * Aucune dépendance au DOM ni au serveur : uniquement turf.
 *   - land / air : arc great-circle direct ;
 *   - sea : la route passe par les waypoints (calculés par searoute côté
 *     serveur, éditables), chaque segment étant un arc great-circle court.
 */
import { distance as turfDistance } from "@turf/distance";
import { greatCircle } from "@turf/great-circle";
import { lineString, point } from "@turf/helpers";
import { length as turfLength } from "@turf/length";
import { lineSliceAlong } from "@turf/line-slice-along";
import type { Feature, LineString } from "geojson";

import type { Json, TransportMode } from "@/lib/supabase/types";

/** Coordonnées `[lng, lat]`, comme GeoJSON et Mapbox. */
export type LngLat = [number, number];

export type RouteStep = {
  lat: number;
  lng: number;
  /** Mode du trajet qui PART de cette étape vers la suivante. */
  mode: TransportMode;
  /** Points de passage `[lng, lat]` du trajet qui part de cette étape. */
  waypoints: LngLat[];
};

export type Leg = {
  from: number;
  to: number;
  mode: TransportMode;
  line: Feature<LineString>;
  /** Longueur du tracé (km). */
  lengthKm: number;
  /** Distance à vol d'oiseau entre les deux étapes (km). */
  directKm: number;
};

const ARC_POINTS = 100;

export const toLngLat = (s: { lat: number; lng: number }): LngLat => [s.lng, s.lat];

/** Distance great-circle en km. */
export function distanceKm(a: LngLat, b: LngLat): number {
  return turfDistance(point(a), point(b), { units: "kilometers" });
}

/**
 * Arc great-circle entre deux points. turf renvoie une MultiLineString quand
 * l'arc coupe l'antiméridien : on la recolle en une seule ligne.
 */
export function greatCircleCoords(a: LngLat, b: LngLat, npoints = ARC_POINTS): LngLat[] {
  if (a[0] === b[0] && a[1] === b[1]) return [a, b];
  const gc = greatCircle(point(a), point(b), { npoints });
  if (gc.geometry.type === "LineString") return gc.geometry.coordinates as LngLat[];
  return (gc.geometry.coordinates as LngLat[][]).flat();
}

/**
 * Segment d'une route maritime entre deux points de passage : arc great-circle
 * court, densifié selon la distance. Utilisé par le tracé ET par le contrôle
 * d'intersection avec les terres, pour tester exactement ce qui est dessiné.
 */
export function seaSegmentCoords(a: LngLat, b: LngLat): LngLat[] {
  const n = Math.max(2, Math.min(24, Math.round(distanceKm(a, b) / 25)));
  return greatCircleCoords(a, b, n);
}

/**
 * Coordonnées complètes du tronçon `from → to`. Pour `sea`, la route suit les
 * waypoints ; sans waypoints elle retombe sur un arc direct (à corriger par
 * l'utilisateur, l'aperçu le signale).
 */
export function buildLegCoords(
  from: LngLat,
  to: LngLat,
  mode: TransportMode,
  waypoints: LngLat[] = [],
): LngLat[] {
  const anchors: LngLat[] = mode === "sea" ? [from, ...waypoints, to] : [from, to];
  const coords: LngLat[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    const seg = mode === "sea" ? seaSegmentCoords(a, b) : greatCircleCoords(a, b);
    coords.push(...(i === 0 ? seg : seg.slice(1)));
  }
  return coords;
}

export function buildLeg(steps: RouteStep[], fromIndex: number): Leg {
  const from = steps[fromIndex];
  const to = steps[fromIndex + 1];
  const a = toLngLat(from);
  const b = toLngLat(to);
  const coords = buildLegCoords(a, b, from.mode, from.waypoints);
  const line = lineString(coords, { mode: from.mode, from: fromIndex, to: fromIndex + 1 });
  return {
    from: fromIndex,
    to: fromIndex + 1,
    mode: from.mode,
    line,
    lengthKm: turfLength(line, { units: "kilometers" }),
    directKm: distanceKm(a, b),
  };
}

export function buildLegs(steps: RouteStep[]): Leg[] {
  return steps.slice(0, -1).map((_, i) => buildLeg(steps, i));
}

/**
 * Portion du tronçon déjà parcourue (0 ≤ progress ≤ 1), pour le tracé
 * progressif. `null` tant que rien n'est dessiné.
 */
export function partialLine(leg: Leg, progress: number): Feature<LineString> | null {
  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0) return null;
  if (p >= 1) return leg.line;
  return lineSliceAlong(leg.line, 0, leg.lengthKm * p, { units: "kilometers" });
}

/**
 * Altitude de caméra proportionnelle à la distance du vol :
 *   ≥ 2 000 km → vue globe, 200–2 000 km → vue région, < 200 km → vue ville.
 * Les valeurs sont des zooms Mapbox.
 */
export const CAMERA_ZOOM = { globe: 1.9, region: 4.6, city: 9.2 } as const;

export function zoomForDistance(km: number): number {
  if (km >= 2000) return CAMERA_ZOOM.globe;
  if (km >= 200) return CAMERA_ZOOM.region;
  return CAMERA_ZOOM.city;
}

/** Vue d'arrêt sur une étape : dépend de la distance jusqu'à l'étape suivante (ou précédente pour la dernière). */
export function stopZoom(steps: RouteStep[], index: number): number {
  const here = toLngLat(steps[index]);
  const neighbour = steps[index + 1] ?? steps[index - 1];
  if (!neighbour) return CAMERA_ZOOM.city;
  const km = distanceKm(here, toLngLat(neighbour));
  // Vue légèrement plus serrée qu'en vol pour lire le lieu.
  if (km >= 2000) return 3.2;
  if (km >= 200) return 5.6;
  return CAMERA_ZOOM.city;
}

/** Valide un jsonb `waypoints` venant de la base. */
export function parseWaypoints(json: Json | null | undefined): LngLat[] {
  if (!Array.isArray(json)) return [];
  const out: LngLat[] = [];
  for (const item of json) {
    if (
      Array.isArray(item) &&
      item.length === 2 &&
      typeof item[0] === "number" &&
      typeof item[1] === "number" &&
      Number.isFinite(item[0]) &&
      Number.isFinite(item[1]) &&
      item[0] >= -180 &&
      item[0] <= 180 &&
      item[1] >= -90 &&
      item[1] <= 90
    ) {
      out.push([item[0], item[1]]);
    }
  }
  return out;
}
