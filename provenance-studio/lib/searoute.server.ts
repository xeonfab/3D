/**
 * Route maritime entre deux points :
 *   1. le réseau maritime de `searoute-js` (Eurostat) + Dijkstra donne le
 *      squelette de la route : canaux, détroits, caps (lib/geo/marnet.server) ;
 *   2. chaque segment (y compris l'approche des ports, absente du réseau) est
 *      contrôlé contre les terres émergées (1:50M) et, s'il en touche une,
 *      remplacé par un chemin en mer calculé localement (lib/geo/land.server).
 *
 * Côté serveur uniquement (réseau : 600 Ko, terres : 2,5 Mo).
 *
 * Renvoie les points de passage `[lng, lat]` SANS les extrémités : ils sont
 * stockés dans `steps.waypoints` et rejoints par `buildLegCoords` (lib/routes).
 */
import { findWaterPath, isOnLand, seaSegmentCrossesLand } from "@/lib/geo/land.server";
import { networkPath } from "@/lib/geo/marnet.server";
import { distanceKm, type LngLat } from "@/lib/routes";

export type SeaRouteResult = {
  waypoints: LngLat[];
  /** true si un segment n'a pas pu être écarté des terres (à corriger à la main). */
  incomplete: boolean;
};

export function computeSeaRoute(from: LngLat, to: LngLat): SeaRouteResult | null {
  const raw = networkPath(from, to);
  if (!raw) return null;
  // Le réseau est grossier : certains nœuds (canal de Suez, ports) tombent à
  // terre. On les écarte, le contrôle segment par segment comble les trous.
  const skeleton = raw.filter((p) => !isOnLand(p));

  // Un premier/dernier nœud trop proche de l'extrémité crée un zigzag.
  if (skeleton.length && distanceKm(skeleton[0], from) < 5) skeleton.shift();
  if (skeleton.length && distanceKm(skeleton[skeleton.length - 1], to) < 5) skeleton.pop();

  const anchors: LngLat[] = [from, ...skeleton, to];
  const out: LngLat[] = [from];
  let incomplete = false;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (seaSegmentCrossesLand(a, b)) {
      const detour = findWaterPath(a, b);
      if (detour) out.push(...detour);
      else incomplete = true;
    }
    out.push(b);
  }
  return { waypoints: out.slice(1, -1), incomplete };
}

/** Raccourci : points de passage seuls (null si aucune route). */
export function computeSeaWaypoints(from: LngLat, to: LngLat): LngLat[] | null {
  return computeSeaRoute(from, to)?.waypoints ?? null;
}
