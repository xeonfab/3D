import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { partialLine, type Leg } from "@/lib/routes";

import type { Camera } from "../types";

import "mapbox-gl/dist/mapbox-gl.css";

const ROUTE_SOURCE = "route";
const STYLE = "mapbox://styles/mapbox/dark-v11";

type Props = { token: string; camera: Camera; legs: Leg[]; legProgress: number[]; color: string };

/**
 * Carte Mapbox GL JS pilotée frame par frame : `jumpTo` à chaque frame (jamais
 * d'animation interne ni de setTimeout), tracé progressif via la source
 * GeoJSON, et attente de l'événement `idle` (tuiles chargées) avant de
 * laisser Remotion capturer la frame. Sortie déterministe.
 */
export const MapboxScene = ({ token, camera, legs, legProgress, color }: Props) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const handle = delayRender("Chargement du style Mapbox");
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE,
      projection: { name: "mercator" },
      center: camera.center,
      zoom: camera.zoom,
      bearing: 0,
      pitch: 0,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      preserveDrawingBuffer: true,
      antialias: true,
    });
    map.on("error", (e) =>
      cancelRender(new Error(`Mapbox : ${e.error?.message ?? "erreur inconnue"}`)),
    );
    map.on("load", () => {
      map.addSource(ROUTE_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": 14, "line-opacity": 0.18, "line-blur": 6 },
      });
      map.addLayer({
        id: "route-land",
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["==", ["get", "mode"], "land"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": 4 },
      });
      map.addLayer({
        id: "route-sea",
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["==", ["get", "mode"], "sea"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": 4, "line-dasharray": [0.1, 2.2] },
      });
      map.addLayer({
        id: "route-air",
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["==", ["get", "mode"], "air"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": 3, "line-dasharray": [3, 2] },
      });
      mapRef.current = map;
      setReady(true);
      continueRender(handle);
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const handle = delayRender(`Rendu Mapbox frame ${frame}`);
    map.jumpTo({ center: camera.center, zoom: camera.zoom, bearing: 0, pitch: 0 });
    const features = legs
      .map((leg, i) => partialLine(leg, legProgress[i]))
      .filter((f): f is GeoJSON.Feature<GeoJSON.LineString> => f !== null);
    (map.getSource(ROUTE_SOURCE) as mapboxgl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
    map.once("idle", () => continueRender(handle));
    map.triggerRepaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, frame]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, width, height, background: "#0c0d0f" }}
    />
  );
};
