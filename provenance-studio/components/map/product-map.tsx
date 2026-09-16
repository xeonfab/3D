"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ExpressionSpecification, Map as MapboxMap, Marker } from "mapbox-gl";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";

import { MapPlaceholder } from "@/components/map/map-placeholder";
import { publicEnv } from "@/lib/env";
import {
  buildLegs,
  distanceKm,
  stopZoom,
  toLngLat,
  type LngLat,
  type RouteStep,
} from "@/lib/routes";
import type { TransportMode } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

import "mapbox-gl/dist/mapbox-gl.css";

export type MapStep = {
  id: string;
  title: string;
  caption: string;
  place_name: string;
  lat: number | null;
  lng: number | null;
  mode: TransportMode;
  waypoints: LngLat[];
  photoUrl: string | null;
};

export type ProductMapHandle = {
  play: () => Promise<void>;
  stop: () => void;
};

type ProductMapProps = {
  steps: MapStep[];
  brandColor: string;
  logoUrl: string | null;
  brandName: string;
  selectedStepId: string | null;
  onWaypointsChange: (stepId: string, waypoints: LngLat[]) => void;
  onPlayingChange?: (playing: boolean) => void;
  className?: string;
};

const SRC = { legs: "legs", points: "points" } as const;
const HOLD_MS = 1600;

function located(steps: MapStep[]) {
  return steps.filter(
    (s): s is MapStep & { lat: number; lng: number } => s.lat !== null && s.lng !== null,
  );
}

/**
 * Carte Mapbox `dark-v11` de l'éditeur : points, tracés (mer en pointillés),
 * points de passage déplaçables pour l'étape sélectionnée, et lecture de
 * l'aperçu caméra (flyTo enchaînés). Les tracés viennent de lib/routes,
 * partagé avec le rendu vidéo.
 */
export const ProductMap = forwardRef<ProductMapHandle, ProductMapProps>(function ProductMap(
  {
    steps,
    brandColor,
    logoUrl,
    brandName,
    selectedStepId,
    onWaypointsChange,
    onPlayingChange,
    className,
  },
  ref,
) {
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const playingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  // --- création ------------------------------------------------------------
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        projection: "globe",
        center: [10, 30],
        zoom: 1.4,
        attributionControl: false,
        logoPosition: "bottom-right",
      });
      map.addControl(new mapboxgl.AttributionControl({ compact: true }));
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("style.load", () => {
        map.setFog({
          color: "rgb(12, 13, 15)",
          "high-color": "rgb(20, 22, 26)",
          "horizon-blend": 0.04,
          "space-color": "rgb(8, 9, 11)",
          "star-intensity": 0,
        });
        map.addSource(SRC.legs, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addSource(SRC.points, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "legs-land",
          type: "line",
          source: SRC.legs,
          filter: ["==", ["get", "mode"], "land"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": brandColor, "line-width": 3, "line-opacity": 1 },
        });
        map.addLayer({
          id: "legs-sea",
          type: "line",
          source: SRC.legs,
          filter: ["==", ["get", "mode"], "sea"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": brandColor,
            "line-width": 3,
            "line-dasharray": [0.1, 2.2],
            "line-opacity": 1,
          },
        });
        map.addLayer({
          id: "legs-air",
          type: "line",
          source: SRC.legs,
          filter: ["==", ["get", "mode"], "air"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": brandColor,
            "line-width": 2,
            "line-dasharray": [3, 2],
            "line-opacity": 1,
          },
        });
        map.addLayer({
          id: "points-halo",
          type: "circle",
          source: SRC.points,
          paint: { "circle-color": brandColor, "circle-opacity": 0.25, "circle-radius": 14 },
        });
        map.addLayer({
          id: "points-dot",
          type: "circle",
          source: SRC.points,
          paint: {
            "circle-color": brandColor,
            "circle-radius": 6,
            "circle-stroke-color": "#0c0d0f",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "points-label",
          type: "symbol",
          source: SRC.points,
          layout: {
            "text-field": ["get", "label"],
            "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
            "text-size": 12,
            "text-offset": [0, -1.6],
            "text-allow-overlap": true,
          },
          paint: { "text-color": "#ffffff", "text-halo-color": "#0c0d0f", "text-halo-width": 1.2 },
        });
        setReady(true);
      });
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // brandColor : appliqué par l'effet dédié ci-dessous
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // --- redimensionnement (changement de format 9:16 / 16:9) -----------------
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // --- couleur de marque ----------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const id of ["legs-land", "legs-sea", "legs-air"])
      map.setPaintProperty(id, "line-color", brandColor);
    map.setPaintProperty("points-halo", "circle-color", brandColor);
    map.setPaintProperty("points-dot", "circle-color", brandColor);
  }, [brandColor, ready]);

  // --- données : points et tracés -------------------------------------------
  const fitAll = useCallback((animate: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    const pts = located(stepsRef.current);
    if (pts.length === 0) {
      map.easeTo({ center: [10, 30], zoom: 1.4, duration: animate ? 600 : 0 });
      return;
    }
    if (pts.length === 1) {
      map.easeTo({ center: toLngLat(pts[0]), zoom: 6, duration: animate ? 800 : 0 });
      return;
    }
    const routeSteps: RouteStep[] = pts.map((s) => ({
      lat: s.lat,
      lng: s.lng,
      mode: s.mode,
      waypoints: s.waypoints,
    }));
    const coords = buildLegs(routeSteps).flatMap((l) => l.line.geometry.coordinates as LngLat[]);
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 60, duration: animate ? 800 : 0, maxZoom: 9 },
    );
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const pts = located(steps);
    const routeSteps: RouteStep[] = pts.map((s) => ({
      lat: s.lat,
      lng: s.lng,
      mode: s.mode,
      waypoints: s.waypoints,
    }));
    const legs = buildLegs(routeSteps);
    const legsFc: FeatureCollection<LineString> = {
      type: "FeatureCollection",
      features: legs.map((l) => l.line as Feature<LineString>),
    };
    const pointsFc: FeatureCollection<Point> = {
      type: "FeatureCollection",
      features: pts.map((s, i) => ({
        type: "Feature",
        properties: { label: String(steps.indexOf(s) + 1), index: i },
        geometry: { type: "Point", coordinates: toLngLat(s) },
      })),
    };
    (map.getSource(SRC.legs) as import("mapbox-gl").GeoJSONSource).setData(legsFc);
    (map.getSource(SRC.points) as import("mapbox-gl").GeoJSONSource).setData(pointsFc);
    if (!playingRef.current) fitAll(true);
  }, [steps, ready, fitAll]);

  // --- points de passage déplaçables (étape sélectionnée, mode mer) ---------
  useEffect(() => {
    const map = mapRef.current;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (!map || !ready || playing) return;
    const step = steps.find((s) => s.id === selectedStepId);
    if (!step || step.mode !== "sea" || step.lat === null) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      step.waypoints.forEach((wp, i) => {
        const el = document.createElement("button");
        el.type = "button";
        el.setAttribute("aria-label", `Point de passage ${i + 1}, glisser pour déplacer`);
        el.className =
          "size-3 rounded-full border-2 border-white/90 cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-white";
        el.style.backgroundColor = brandColor;
        const marker = new mapboxgl.Marker({ element: el, draggable: true })
          .setLngLat(wp)
          .addTo(map);
        marker.on("dragend", () => {
          const ll = marker.getLngLat();
          const next = step.waypoints.map((w, j): LngLat => (j === i ? [ll.lng, ll.lat] : w));
          onWaypointsChange(step.id, next);
        });
        markersRef.current.push(marker);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [steps, selectedStepId, ready, playing, brandColor, onWaypointsChange]);

  // --- lecture de l'aperçu --------------------------------------------------
  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    setCurrent(null);
    onPlayingChange?.(false);
    const map = mapRef.current;
    if (map) {
      map.stop();
      for (const id of ["legs-land", "legs-sea", "legs-air"])
        map.setPaintProperty(id, "line-opacity", 1);
      fitAll(true);
    }
  }, [fitAll, onPlayingChange]);

  const waitMoveEnd = (map: MapboxMap) =>
    new Promise<void>((resolve) => {
      const done = () => {
        map.off("moveend", done);
        resolve();
      };
      map.on("moveend", done);
    });
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const play = useCallback(async () => {
    const map = mapRef.current;
    const pts = located(stepsRef.current);
    if (!map || pts.length === 0 || playingRef.current) return;
    playingRef.current = true;
    setPlaying(true);
    onPlayingChange?.(true);
    const routeSteps: RouteStep[] = pts.map((s) => ({
      lat: s.lat,
      lng: s.lng,
      mode: s.mode,
      waypoints: s.waypoints,
    }));
    const opacity = (visited: number): ExpressionSpecification => [
      "case",
      ["<", ["get", "from"], visited],
      1,
      0.2,
    ];
    for (const id of ["legs-land", "legs-sea", "legs-air"])
      map.setPaintProperty(id, "line-opacity", opacity(0));

    for (let i = 0; i < pts.length; i++) {
      if (!playingRef.current) return;
      const km = i === 0 ? 0 : distanceKm(toLngLat(pts[i - 1]), toLngLat(pts[i]));
      const duration = i === 0 ? 1200 : 1200 + Math.min(2600, (km / 2000) * 1800);
      map.flyTo({
        center: toLngLat(pts[i]),
        zoom: stopZoom(routeSteps, i),
        duration,
        essential: true,
        curve: 1.3,
      });
      await waitMoveEnd(map);
      if (!playingRef.current) return;
      for (const id of ["legs-land", "legs-sea", "legs-air"])
        map.setPaintProperty(id, "line-opacity", opacity(i));
      setCurrent(stepsRef.current.indexOf(pts[i]));
      await sleep(HOLD_MS);
      setCurrent(null);
      await sleep(200);
    }
    if (playingRef.current) stop();
  }, [onPlayingChange, stop]);

  useImperativeHandle(ref, () => ({ play, stop }), [play, stop]);

  const currentStep = current !== null ? steps[current] : null;

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-[#0c0d0f]", className)}>
      {token ? (
        <div ref={containerRef} className="absolute inset-0" />
      ) : (
        <MapPlaceholder color={brandColor} className="absolute inset-0" />
      )}
      {!token ? (
        <p className="absolute inset-x-4 top-16 rounded-md bg-black/60 px-3 py-2 text-center text-xs text-white/80">
          Ajoutez un token Mapbox (NEXT_PUBLIC_MAPBOX_TOKEN) pour afficher la carte.
        </p>
      ) : null}

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex items-start">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo du Storage
            <img
              src={logoUrl}
              alt=""
              className="max-h-10 max-w-[40%] object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
            />
          ) : (
            <span className="text-sm font-semibold tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
              {brandName}
            </span>
          )}
        </div>
        <div
          className={cn(
            "flex items-end justify-between gap-3 transition-opacity duration-300",
            currentStep ? "opacity-100" : "opacity-0",
          )}
          aria-live="polite"
        >
          {currentStep ? (
            <>
              <div className="max-w-[60%] rounded-lg bg-black/60 px-3 py-2 backdrop-blur-sm">
                <p className="text-sm font-semibold text-white">
                  {currentStep.title || currentStep.place_name}
                </p>
                {currentStep.caption ? (
                  <p className="text-xs text-white/80">{currentStep.caption}</p>
                ) : null}
              </div>
              {currentStep.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- photo du Storage
                <img
                  src={currentStep.photoUrl}
                  alt=""
                  className="aspect-[4/5] w-[28%] max-w-40 rounded-2xl object-cover shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
                />
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
});
