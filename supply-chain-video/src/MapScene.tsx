import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  ATMOSPHERE,
  COASTLINE,
  COUNTRY_BORDERS,
  COUNTRY_BOUNDARIES,
  COUNTRY_HIGHLIGHT_OPACITY,
  COUNTRY_LABELS,
  HILLSHADE,
  THEME_STYLE,
} from "./defaults";
import type { SceneLine } from "./scene";
import type { Camera, MapLook } from "./types";

const ROUTE_SOURCE = "route";
const DEM_SOURCE = "mapbox-dem";
const COUNTRIES_SOURCE = "country-boundaries";
const HIGHLIGHT_LAYER = "country-highlight";

type Props = {
  camera: Camera;
  /** Tracés à dessiner à la frame courante (état de scène, déjà découpés). */
  lines: SceneLine[];
  color: string;
  look: MapLook;
  /** Codes ISO des pays déjà atteints à la frame courante. */
  reachedCountries: string[];
  /** Appelé une fois la carte prête (pour projeter les overlays). */
  onReady: (map: mapboxgl.Map) => void;
  /** Appelé après positionnement de la caméra pour la frame donnée. */
  onFrameApplied: (frame: number) => void;
};

/** Première couche de type symbol (labels) : on insère nos couches dessous. */
const firstSymbolLayer = (map: mapboxgl.Map) =>
  map.getStyle()?.layers?.find((l) => l.type === "symbol")?.id;

const addHillshade = (map: mapboxgl.Map) => {
  // Le style a déjà son propre relief (outdoors) : on n'en ajoute pas un second.
  if (map.getStyle()?.layers?.some((l) => l.type === "hillshade")) return;
  map.addSource(DEM_SOURCE, {
    type: "raster-dem",
    url: HILLSHADE.source,
    tileSize: HILLSHADE.tileSize,
    maxzoom: HILLSHADE.maxzoom,
  });
  map.addLayer(
    {
      id: "hillshade",
      type: "hillshade",
      source: DEM_SOURCE,
      paint: {
        "hillshade-exaggeration": HILLSHADE.exaggeration,
        "hillshade-shadow-color": HILLSHADE.shadowColor,
        "hillshade-highlight-color": HILLSHADE.highlightColor,
        "hillshade-accent-color": HILLSHADE.accentColor,
        "hillshade-illumination-anchor": "map",
      },
    },
    map.getLayer("water") ? "water" : firstSymbolLayer(map),
  );
};

/** Contraste terre / mer : recolore les couches de fond du style. */
const applyLandSea = (map: mapboxgl.Map, look: MapLook) => {
  if (look.seaColor && map.getLayer("water"))
    map.setPaintProperty("water", "fill-color", look.seaColor);
  if (look.landColor && map.getLayer("land"))
    map.setPaintProperty("land", "background-color", look.landColor);
};

/** Liseré le long des côtes : contour des polygones d'eau du style. */
const addCoastline = (map: mapboxgl.Map) => {
  if (!map.getSource("composite")) return;
  map.addLayer(
    {
      id: "coastline",
      type: "line",
      source: "composite",
      "source-layer": "water",
      paint: {
        "line-color": COASTLINE.color,
        "line-width": COASTLINE.width,
        "line-opacity": COASTLINE.opacity,
      },
    },
    firstSymbolLayer(map),
  );
};

/**
 * Multiplie une valeur `text-size` par un facteur sans casser les règles des
 * expressions Mapbox (`["zoom"]` doit rester l'entrée directe d'un
 * `interpolate` / `step` de premier niveau : on met donc à l'échelle les
 * sorties, pas l'expression entière).
 */
const scaleSize = (size: unknown, factor: number): unknown => {
  if (typeof size === "number") return size * factor;
  if (Array.isArray(size)) {
    const [head] = size;
    if (head === "interpolate") {
      // ["interpolate", interp, input, stop, out, stop, out, …]
      return size.map((v, i) => (i >= 4 && i % 2 === 0 ? scaleSize(v, factor) : v));
    }
    if (head === "step") {
      // ["step", input, out0, stop, out, stop, out, …]
      return size.map((v, i) => (i >= 2 && i % 2 === 0 ? scaleSize(v, factor) : v));
    }
    if (!JSON.stringify(size).includes('["zoom"]')) return ["*", size, factor];
    return size;
  }
  if (size && typeof size === "object" && Array.isArray((size as { stops?: unknown }).stops)) {
    const legacy = size as { stops: [number, number][] };
    return { ...legacy, stops: legacy.stops.map(([z, v]) => [z, v * factor]) };
  }
  return size;
};

/** Frontières et labels de pays renforcés. */
const emphasizeCountries = (map: mapboxgl.Map) => {
  for (const id of ["admin-0-boundary", "admin-0-boundary-disputed"]) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, "line-color", COUNTRY_BORDERS.color);
    map.setPaintProperty(id, "line-width", COUNTRY_BORDERS.width);
    map.setPaintProperty(id, "line-opacity", COUNTRY_BORDERS.opacity);
  }
  for (const id of ["country-label", "continent-label"]) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, "text-color", COUNTRY_LABELS.color);
    map.setPaintProperty(id, "text-halo-color", COUNTRY_LABELS.haloColor);
    const size = map.getLayoutProperty(id, "text-size");
    const scaled = scaleSize(size, COUNTRY_LABELS.sizeFactor);
    if (scaled !== size) {
      map.setLayoutProperty(id, "text-size", scaled as mapboxgl.DataDrivenPropertyValueSpecification<number>);
    }
  }
};

/** Couche de teinte des pays atteints (filtre mis à jour à chaque frame). */
const addCountryHighlight = (map: mapboxgl.Map, color: string) => {
  map.addSource(COUNTRIES_SOURCE, { type: "vector", url: COUNTRY_BOUNDARIES.url });
  map.addLayer(
    {
      id: HIGHLIGHT_LAYER,
      type: "fill",
      source: COUNTRIES_SOURCE,
      "source-layer": COUNTRY_BOUNDARIES.sourceLayer,
      filter: ["==", ["get", "iso_3166_1"], ""],
      paint: {
        "fill-color": color,
        "fill-opacity": COUNTRY_HIGHLIGHT_OPACITY,
        // Aucune transition : l'état ne dépend que de la frame.
        "fill-opacity-transition": { duration: 0, delay: 0 },
      },
    },
    map.getLayer("hillshade") ? "hillshade" : map.getLayer("water") ? "water" : firstSymbolLayer(map),
  );
};

const setReachedCountries = (map: mapboxgl.Map, codes: string[]) => {
  if (!map.getLayer(HIGHLIGHT_LAYER)) return;
  map.setFilter(HIGHLIGHT_LAYER, [
    "all",
    ["in", ["get", "iso_3166_1"], ["literal", codes]],
    // Une seule géométrie par pays : celle de la vue du monde choisie.
    [
      "any",
      ["==", "all", ["get", "worldview"]],
      ["in", COUNTRY_BOUNDARIES.worldview, ["get", "worldview"]],
    ],
  ]);
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
export const MapScene = ({
  camera,
  lines,
  color,
  look,
  reachedCountries,
  onReady,
  onFrameApplied,
}: Props) => {
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
      style: look.style || THEME_STYLE[look.theme],
      projection: look.globe ? "globe" : "mercator",
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
      const message = `Mapbox : ${err?.message || "erreur inconnue"}${status ? ` (HTTP ${status})` : ""}`;
      if (status === undefined) {
        // Erreur de style (validation, couche inconnue…) : on prévient sans
        // interrompre le rendu, la carte reste pilotable.
        console.warn(message);
        return;
      }
      const hint =
        status === 401 || status === 403
          ? " — token Mapbox refusé : vérifiez REMOTION_MAPBOX_TOKEN dans .env (et ses restrictions d'URL sur account.mapbox.com)"
          : "";
      // Différé : `cancelRender` lève une exception, on ne l'envoie pas au
      // milieu d'un appel interne de Mapbox.
      queueMicrotask(() => cancelRender(new Error(message + hint)));
    });

    map.on("load", () => {
      if (look.atmosphere) {
        const fog = ATMOSPHERE[look.theme];
        map.setFog({
          color: fog.color,
          "high-color": fog.highColor,
          "horizon-blend": fog.horizonBlend,
          "space-color": fog.spaceColor,
          "star-intensity": fog.starIntensity,
        });
      }
      const cosmetic: [string, boolean, () => void][] = [
        ["terre/mer", true, () => applyLandSea(map, look)],
        ["pays", look.countries, () => emphasizeCountries(map)],
        ["relief", look.hillshade, () => addHillshade(map)],
        ["pays teintés", look.highlightCountries, () => addCountryHighlight(map, color)],
        ["côtes", look.coastline, () => addCoastline(map)],
      ];
      for (const [name, enabled, apply] of cosmetic) {
        if (!enabled) continue;
        try {
          apply();
        } catch (err) {
          console.warn(`Habillage « ${name} » ignoré :`, err);
        }
      }

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
        filter: ["==", ["get", "style"], "route"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": 14, "line-opacity": 0.18, "line-blur": 6 },
      });
      // Trajet terrestre : trait plein.
      map.addLayer({
        id: "route-land",
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["all", ["==", ["get", "style"], "route"], ["==", ["get", "mode"], "land"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": 4 },
      });
      // Trajet maritime : pointillés.
      map.addLayer({
        id: "route-sea",
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["all", ["==", ["get", "style"], "route"], ["==", ["get", "mode"], "sea"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": 4, "line-dasharray": [0.2, 2.2] },
      });
      // Terroir : trait fin ferme → atelier, et cercle du rayon.
      map.addLayer({
        id: "spoke",
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["==", ["get", "style"], "spoke"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": 2, "line-opacity": 0.8 },
      });
      map.addLayer({
        id: "radius-circle",
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["==", ["get", "style"], "circle"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": 2, "line-opacity": 0.9 },
      });
      mapRef.current = map;
      onReady(map);
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
  // useLayoutEffect : les overlays sont re-projetés avant l'affichage de la frame.
  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    const handle = delayRender(`Rendu Mapbox frame ${frame}`);

    map.jumpTo({ center: camera.center, zoom: camera.zoom, bearing: 0, pitch: 0 });

    const features = lines.map((l) => ({
      ...l.feature,
      properties: { ...l.feature.properties, mode: l.mode, style: l.style },
    }));
    (map.getSource(ROUTE_SOURCE) as mapboxgl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
    setReachedCountries(map, reachedCountries);

    onFrameApplied(frame);

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
