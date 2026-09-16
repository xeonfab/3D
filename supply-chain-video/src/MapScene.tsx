import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { MAPBOX_STYLE } from "./defaults";
import { partialLine } from "./geo";
import type { Camera, Leg } from "./types";

const ROUTE_SOURCE = "route";

type Props = {
  camera: Camera;
  legs: Leg[];
  /** Progression du tracé de chaque tronçon (0→1) à la frame courante. */
  legProgress: number[];
  color: string;
};

/**
 * Carte Mapbox GL JS pilotée frame par frame.
 *
 * Principe : à chaque frame Remotion, on positionne la caméra avec
 * `jumpTo` (pas de `flyTo` interne à Mapbox, qui dépend de l'horloge),
 * on met à jour la source GeoJSON de la route, puis on retarde le rendu
 * jusqu'à l'événement `idle` de Mapbox (tuiles chargées et dessinées).
 * La sortie est donc identique à chaque `remotion render`.
 */
export const MapScene = ({ camera, legs, legProgress, color }: Props) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);

  // Initialisation (une seule fois par instance de composition).
  useEffect(() => {
    const token = process.env.REMOTION_MAPBOX_TOKEN;
    if (!token) {
      cancelRender(
        new Error(
          "REMOTION_MAPBOX_TOKEN manquant : ajoutez-le dans un fichier .env (voir .env.example)",
        ),
      );
      return;
    }
    if (!/^pk\.[^.]+\.[^.]+$/.test(token)) {
      cancelRender(
        new Error(
          `REMOTION_MAPBOX_TOKEN mal formé (« ${token.slice(0, 8)}… ») : attendu un token public « pk.xxx.yyy ». ` +
            "Vérifiez qu'il n'y a pas de préfixe en double (pk.pk.…), d'espace ni de guillemet dans .env",
        ),
      );
      return;
    }
    if (!containerRef.current) return;

    const handle = delayRender("Chargement du style Mapbox");
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE,
      center: camera.center,
      zoom: camera.zoom,
      bearing: 0,
      pitch: 0,
      interactive: false,
      attributionControl: false,
      // Aucune animation interne : tout est piloté par le numéro de frame.
      fadeDuration: 0,
      preserveDrawingBuffer: true,
      antialias: true,
    });

    map.on("error", (e) => {
      const err = e.error as (Error & { status?: number }) | undefined;
      const status = err?.status;
      const hint =
        status === 401 || status === 403
          ? " — token Mapbox refusé : vérifiez REMOTION_MAPBOX_TOKEN dans .env (et ses restrictions d'URL sur account.mapbox.com)"
          : "";
      cancelRender(
        new Error(
          `Mapbox : ${err?.message || "erreur inconnue"}${status ? ` (HTTP ${status})` : ""}${hint}`,
        ),
      );
    });

    map.on("load", () => {
      map.addSource(ROUTE_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        lineMetrics: true,
      });
      // Halo sous le tracé.
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": 14, "line-opacity": 0.18, "line-blur": 6 },
      });
      // Trajet terrestre : trait plein.
      map.addLayer({
        id: "route-land",
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["==", ["get", "mode"], "land"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": 4 },
      });
      // Trajet maritime : pointillés.
      map.addLayer({
        id: "route-sea",
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["==", ["get", "mode"], "sea"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": 4, "line-dasharray": [0.2, 2.2] },
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

  // Mise à jour à chaque frame : caméra + tracé progressif, puis attente de `idle`.
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
    // Force un cycle de rendu même si rien n'a changé (frames de fin fixes),
    // sinon `idle` ne serait jamais réémis.
    map.triggerRepaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, frame]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, width, height, background: "#0b0b0e" }}
    />
  );
};
