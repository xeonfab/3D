"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

import { MapPlaceholder } from "@/components/map/map-placeholder";
import { publicEnv } from "@/lib/env";

import "mapbox-gl/dist/mapbox-gl.css";

type BrandPreviewProps = {
  name: string;
  color: string;
  logoUrl: string | null;
  className?: string;
};

// Tronçon d'exemple pour l'aperçu : Bordeaux → Rennes.
const SAMPLE_ROUTE: [number, number][] = [
  [-0.58, 44.84],
  [-0.9, 45.6],
  [-1.2, 46.4],
  [-1.45, 47.2],
  [-1.68, 48.11],
];
const ROUTE_SOURCE = "brand-preview-route";
const POINTS_SOURCE = "brand-preview-points";

/**
 * Mini-carte sombre montrant en direct le logo et la couleur de marque, tels
 * qu'ils apparaîtront dans la vidéo. Sans token Mapbox, une carte stylisée
 * prend le relais.
 */
export function BrandPreview({ name, color, logoUrl, className }: BrandPreviewProps) {
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [ready, setReady] = useState(false);
  // Couleur utilisée à la création des calques ; les changements suivants
  // passent par setPaintProperty, sans recréer la carte.
  const initialColorRef = useRef(color);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    const initialColor = initialColorRef.current;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-1.1, 46.5],
        zoom: 5.2,
        interactive: false,
        attributionControl: false,
        logoPosition: "bottom-right",
      });
      map.addControl(new mapboxgl.AttributionControl({ compact: true }));
      map.on("load", () => {
        map.addSource(ROUTE_SOURCE, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: SAMPLE_ROUTE },
          },
        });
        map.addSource(POINTS_SOURCE, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [SAMPLE_ROUTE[0], SAMPLE_ROUTE[SAMPLE_ROUTE.length - 1]].map((c) => ({
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: c },
            })),
          },
        });
        map.addLayer({
          id: `${ROUTE_SOURCE}-line`,
          type: "line",
          source: ROUTE_SOURCE,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": initialColor, "line-width": 3 },
        });
        map.addLayer({
          id: `${POINTS_SOURCE}-halo`,
          type: "circle",
          source: POINTS_SOURCE,
          paint: { "circle-color": initialColor, "circle-opacity": 0.25, "circle-radius": 12 },
        });
        map.addLayer({
          id: `${POINTS_SOURCE}-dot`,
          type: "circle",
          source: POINTS_SOURCE,
          paint: {
            "circle-color": initialColor,
            "circle-radius": 5,
            "circle-stroke-color": "#111214",
            "circle-stroke-width": 1.5,
          },
        });
        setReady(true);
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setPaintProperty(`${ROUTE_SOURCE}-line`, "line-color", color);
    map.setPaintProperty(`${POINTS_SOURCE}-halo`, "circle-color", color);
    map.setPaintProperty(`${POINTS_SOURCE}-dot`, "circle-color", color);
  }, [color, ready]);

  return (
    <div
      className={className}
      role="img"
      aria-label={`Aperçu de la marque ${name || ""} sur une carte sombre`}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-border bg-[#111214] sm:aspect-[16/10]">
        {token ? (
          <div ref={containerRef} className="absolute inset-0" />
        ) : (
          <MapPlaceholder color={color} className="absolute inset-0" />
        )}

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex items-start">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo en SVG ou PNG issu du Storage / d'un objet local
              <img
                src={logoUrl}
                alt=""
                className="max-h-12 max-w-[45%] object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
              />
            ) : (
              <span className="text-sm font-semibold tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                {name || "Votre marque"}
              </span>
            )}
          </div>
          <div className="flex items-end gap-3">
            <span
              aria-hidden="true"
              className="mb-1 inline-block size-3 shrink-0 rounded-full"
              style={{ backgroundColor: color, boxShadow: `0 0 0 6px ${color}33` }}
            />
            <div className="rounded-lg bg-black/55 px-3 py-2 backdrop-blur-sm">
              <p className="text-sm font-semibold text-white">Atelier</p>
              <p className="text-xs text-white/80">Torréfié en petit lot chaque semaine</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
