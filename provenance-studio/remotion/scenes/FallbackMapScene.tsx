import { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, staticFile, useVideoConfig } from "remotion";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

import { partialLine, type Leg, type LngLat } from "@/lib/routes";

import { project } from "../camera";
import type { Camera } from "../types";

type Props = { camera: Camera; legs: Leg[]; legProgress: number[]; color: string };

let landCache: Promise<FeatureCollection<Polygon | MultiPolygon>> | null = null;
const loadLand = () => {
  if (!landCache) landCache = fetch(staticFile("land-simplified.geojson")).then((r) => r.json());
  return landCache;
};

/**
 * Carte de secours sans token Mapbox : continents simplifiés en SVG, même
 * projection et même caméra que la scène Mapbox. Sert aux rendus de test ;
 * en production le token est toujours présent.
 */
export const FallbackMapScene = ({ camera, legs, legProgress, color }: Props) => {
  const { width, height } = useVideoConfig();
  const [land, setLand] = useState<FeatureCollection<Polygon | MultiPolygon> | null>(null);

  useEffect(() => {
    const handle = delayRender("Chargement des continents");
    loadLand().then((fc) => {
      setLand(fc);
      continueRender(handle);
    });
  }, []);

  const [cx, cy] = project(camera.center, camera.zoom);
  const toPx = (c: LngLat) => {
    const [x, y] = project(c, camera.zoom);
    return `${(width / 2 + x - cx).toFixed(1)},${(height / 2 + y - cy).toFixed(1)}`;
  };
  const ring = (coords: LngLat[]) => `M${coords.map(toPx).join("L")}Z`;

  const landPath = useMemo(() => {
    if (!land) return "";
    const worldSize = 512 * Math.pow(2, camera.zoom);
    // Ne dessine que les polygones dont l'emprise touche l'écran (marge large).
    const visible = (coords: LngLat[]) =>
      coords.some((c) => {
        const [x, y] = project(c, camera.zoom);
        return Math.abs(x - cx) < worldSize && Math.abs(y - cy) < worldSize;
      });
    const parts: string[] = [];
    for (const f of land.features) {
      const polys =
        f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) {
        const outer = poly[0] as LngLat[];
        const [minX, minY, maxX, maxY] = outer.reduce(
          (b, c) => {
            const [x, y] = project(c, camera.zoom);
            return [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
          },
          [Infinity, Infinity, -Infinity, -Infinity],
        );
        if (maxX < cx - width || minX > cx + width || maxY < cy - height || minY > cy + height)
          continue;
        if (!visible(outer)) continue;
        parts.push(poly.map((r) => ring(r as LngLat[])).join(""));
      }
    }
    return parts.join("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [land, camera.center[0], camera.center[1], camera.zoom, width, height]);

  const graticule = useMemo(() => {
    const lines: string[] = [];
    for (let lng = -180; lng <= 180; lng += 10)
      lines.push(`M${toPx([lng, 85])}L${toPx([lng, -85])}`);
    for (let lat = -80; lat <= 80; lat += 10)
      lines.push(`M${toPx([-180, lat])}L${toPx([180, lat])}`);
    return lines.join("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.center[0], camera.center[1], camera.zoom, width, height]);

  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, background: "#0c0d0f" }}
    >
      <path d={graticule} stroke="rgba(255,255,255,0.05)" strokeWidth={1} fill="none" />
      <path
        d={landPath}
        fill="#1c1e22"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth={1.2}
        fillRule="evenodd"
      />
      {legs.map((leg, i) => {
        const part = partialLine(leg, legProgress[i]);
        if (!part) return null;
        const d = `M${(part.geometry.coordinates as LngLat[]).map(toPx).join("L")}`;
        const dash = leg.mode === "sea" ? "1 10" : leg.mode === "air" ? "12 8" : undefined;
        return (
          <g key={i}>
            <path
              d={d}
              stroke={color}
              strokeWidth={14}
              strokeOpacity={0.18}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: "blur(6px)" }}
            />
            <path
              d={d}
              stroke={color}
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={dash}
            />
          </g>
        );
      })}
    </svg>
  );
};
