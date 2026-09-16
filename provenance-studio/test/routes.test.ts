import { readFileSync } from "node:fs";
import path from "node:path";
import { booleanIntersects, lineString, point, distance } from "@turf/turf";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { describe, expect, it } from "vitest";

import {
  buildLegCoords,
  buildLegs,
  greatCircleCoords,
  parseWaypoints,
  partialLine,
  zoomForDistance,
  type LngLat,
} from "@/lib/routes";
import { computeSeaWaypoints } from "@/lib/searoute.server";

const DJIBOUTI: LngLat = [43.15, 11.6];
const LE_HAVRE: LngLat = [0.11, 49.49];
const SUEZ: LngLat = [32.35, 30.6];
const GIBRALTAR: LngLat = [-5.6, 35.95];

const continents = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures", "continents.geojson"), "utf8"),
) as FeatureCollection<Polygon | MultiPolygon>;

function landIntersections(coords: LngLat[]): Feature<Polygon | MultiPolygon>[] {
  const line = lineString(coords);
  return continents.features.filter((poly) => booleanIntersects(line, poly));
}

function passesNear(coords: LngLat[], target: LngLat, maxKm: number): boolean {
  return coords.some((c) => distance(point(c), point(target), { units: "kilometers" }) <= maxKm);
}

describe("route maritime Djibouti → Le Havre", () => {
  const waypoints = computeSeaWaypoints(DJIBOUTI, LE_HAVRE);
  const coords = buildLegCoords(DJIBOUTI, LE_HAVRE, "sea", waypoints ?? []);

  it("est calculée par searoute", () => {
    expect(waypoints).not.toBeNull();
    expect(waypoints!.length).toBeGreaterThan(5);
  });

  it("passe par Suez et Gibraltar", () => {
    expect(passesNear(coords, SUEZ, 60)).toBe(true);
    expect(passesNear(coords, GIBRALTAR, 60)).toBe(true);
  });

  it("ne traverse aucune terre", () => {
    const hits = landIntersections(coords);
    expect(hits.map((h) => h.properties?.id)).toEqual([]);
  });

  it("commence et finit exactement aux étapes", () => {
    expect(coords[0]).toEqual(DJIBOUTI);
    expect(coords[coords.length - 1]).toEqual(LE_HAVRE);
  });
});

describe("tracés terrestres et aériens", () => {
  it("un arc great-circle relie les deux étapes", () => {
    const arc = greatCircleCoords([0.11, 49.49], [-0.58, 44.84]);
    expect(arc[0]).toEqual([0.11, 49.49]);
    expect(arc[arc.length - 1]).toEqual([-0.58, 44.84]);
    expect(arc.length).toBeGreaterThan(10);
  });

  it("buildLegs enchaîne les tronçons du jeu de test", () => {
    const legs = buildLegs([
      { lat: 5.75, lng: 38.9, mode: "land", waypoints: [] },
      { lat: 5.9, lng: 38.8, mode: "land", waypoints: [] },
      {
        lat: 11.6,
        lng: 43.15,
        mode: "sea",
        waypoints: computeSeaWaypoints(DJIBOUTI, LE_HAVRE) ?? [],
      },
      { lat: 49.49, lng: 0.11, mode: "land", waypoints: [] },
    ]);
    expect(legs).toHaveLength(3);
    expect(legs[0].directKm).toBeLessThan(30);
    expect(legs[2].mode).toBe("sea");
    expect(legs[2].lengthKm).toBeGreaterThan(legs[2].directKm);
    expect(legs[2].lengthKm).toBeGreaterThan(5500);
  });

  it("partialLine découpe progressivement", () => {
    const [leg] = buildLegs([
      { lat: 49.49, lng: 0.11, mode: "land", waypoints: [] },
      { lat: 44.84, lng: -0.58, mode: "land", waypoints: [] },
    ]);
    expect(partialLine(leg, 0)).toBeNull();
    expect(partialLine(leg, 1)).toBe(leg.line);
    const half = partialLine(leg, 0.5)!;
    expect(half.geometry.coordinates.length).toBeLessThan(leg.line.geometry.coordinates.length);
  });
});

describe("caméra et waypoints", () => {
  it("choisit l'altitude selon la distance", () => {
    expect(zoomForDistance(5000)).toBeLessThan(zoomForDistance(800));
    expect(zoomForDistance(800)).toBeLessThan(zoomForDistance(50));
  });

  it("parseWaypoints ignore les valeurs invalides", () => {
    expect(parseWaypoints([[1, 2], [200, 3], "x", [1], [0, 0]])).toEqual([
      [1, 2],
      [0, 0],
    ]);
    expect(parseWaypoints(null)).toEqual([]);
  });
});
