import { feature } from "topojson-client";
import land50m from "world-atlas/land-50m.json";
import { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { toScreen, unproject, project } from "./camera";
import type { SceneLine } from "./scene";
import type { Camera, LngLat } from "./types";

/*
 * Fond de carte hors ligne (REMOTION_MAP_OFFLINE=1) : terres Natural Earth
 * 50 m en SVG, projection Mercator pure. Sert à prévisualiser et tester
 * la timeline, les tracés et les overlays sans token Mapbox ni réseau.
 * Ce n'est PAS le rendu final : la vraie carte reste Mapbox GL JS.
 */

type Topology = Parameters<typeof feature>[0];
const topo = land50m as unknown as Topology;
const landRaw = feature(topo, topo.objects.land) as unknown as
  | GeoJSON.Feature<GeoJSON.MultiPolygon>
  | GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
const rings: LngLat[][] =
  landRaw.type === "Feature"
    ? landRaw.geometry.coordinates.map((poly) => poly[0] as LngLat[])
    : landRaw.features.flatMap((f) =>
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates[0] as LngLat[]]
          : f.geometry.coordinates.map((poly) => poly[0] as LngLat[]),
      );
const ringBoxes = rings.map((r) => {
  let w = 180, s = 90, e = -180, n = -90;
  for (const [x, y] of r) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return [w, s, e, n] as const;
});

type Props = { camera: Camera; lines: SceneLine[]; color: string };

export const OfflineMap = ({ camera, lines, color }: Props) => {
  const { width, height } = useVideoConfig();

  const landPath = useMemo(() => {
    // Emprise visible (avec marge) pour ne projeter que les polygones utiles.
    const [cx, cy] = project(camera.center, camera.zoom);
    const [w, n] = unproject([cx - width, cy - height], camera.zoom);
    const [e, s] = unproject([cx + width, cy + height], camera.zoom);
    const parts: string[] = [];
    rings.forEach((ring, i) => {
      const [rw, rs, re, rn] = ringBoxes[i];
      if (re < w || rw > e || rn < s || rs > n) return;
      parts.push(
        "M" +
          ring
            .map((c) => toScreen(c, camera, width, height).map((v) => v.toFixed(1)).join(","))
            .join("L") +
          "Z",
      );
    });
    return parts.join("");
  }, [camera, width, height]);

  // Ne garde que les portions visibles (marge d'un écran) : un tracé de
  // 8 000 km en pointillés au zoom ville ferait des millions de px à tirer.
  const toPath = (coords: GeoJSON.Position[]) => {
    const inside = (p: [number, number]) =>
      p[0] > -width && p[0] < 2 * width && p[1] > -height && p[1] < 2 * height;
    const pts = coords.map((c) => toScreen(c as LngLat, camera, width, height));
    let d = "";
    let open = false;
    pts.forEach((p, i) => {
      const keep = inside(p) || (i > 0 && inside(pts[i - 1])) || (i < pts.length - 1 && inside(pts[i + 1]));
      if (!keep) {
        open = false;
        return;
      }
      d += (open ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1);
      open = true;
    });
    return d;
  };

  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, background: "#0a1220" }}
    >
      <path d={landPath} fill="#1f2329" stroke="#6f8296" strokeWidth={1} strokeOpacity={0.55} />
      {lines.map((l, i) => {
        const d = toPath(l.feature.geometry.coordinates);
        if (l.style === "circle")
          return <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} opacity={0.9} />;
        if (l.style === "spoke")
          return <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} opacity={0.8} />;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={color} strokeWidth={14} opacity={0.18} />
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={l.mode === "sea" ? "1 9" : undefined}
            />
          </g>
        );
      })}
      <text x={16} y={height - 16} fill="#6f8296" fontSize={18} fontFamily="monospace">
        aperçu hors ligne — Natural Earth, pas Mapbox
      </text>
    </svg>
  );
};
