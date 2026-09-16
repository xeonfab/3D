import type { CameraSettings, MapLook, Timing } from "./types";

/**
 * Valeurs de rythme par défaut, toutes surchargeables depuis
 * `steps.json` → `"timing": { … }`. Avec 5 étapes on obtient ≈ 40 s.
 */
export const DEFAULT_TIMING: Timing = {
  fps: 30,
  introSeconds: 1,
  holdSeconds: 4,
  travelMinSeconds: 2.5,
  travelMaxSeconds: 5,
  travelMaxDistanceKm: 5000,
  endingSeconds: 3,
};

/** Réglages de caméra par défaut, surchargeables via `steps.json` → `"camera"`. */
export const DEFAULT_CAMERA: CameraSettings = {
  zoomCity: 11,
  zoomWorld: 5,
  flightPaddingPx: 140,
};

/** Habillage par défaut, surchargeable via `brand.json` → `"map"`. */
export const DEFAULT_LOOK: MapLook = {
  globe: true,
  atmosphere: true,
  hillshade: true,
  seaColor: "#0a1220",
  landColor: "#1f2329",
  coastline: true,
  countries: true,
  highlightCountries: true,
  vehicle: true,
};

/** Atmosphère (fog Mapbox) : nuit profonde, halo bleu à l'horizon, étoiles. */
export const ATMOSPHERE = {
  color: "rgb(14, 18, 30)",
  highColor: "rgb(28, 40, 80)",
  horizonBlend: 0.06,
  spaceColor: "rgb(3, 4, 9)",
  starIntensity: 0.35,
};

/** Liseré de côte, frontières et labels de pays. */
export const COASTLINE = { color: "#6f8296", width: 1.1, opacity: 0.55 };
export const COUNTRY_BORDERS = { color: "#8a93a3", width: 1.2, opacity: 0.6 };
export const COUNTRY_LABELS = { color: "#c9d1dc", haloColor: "#0a0d14", sizeFactor: 1.25 };
/** Opacité de la teinte des pays des étapes (couleur de marque). */
export const COUNTRY_HIGHLIGHT_OPACITY = 0.14;
/** Tileset Mapbox des frontières (données officielles, worldview « US »). */
export const COUNTRY_BOUNDARIES = {
  url: "mapbox://mapbox.country-boundaries-v1",
  sourceLayer: "country_boundaries",
  worldview: "US",
};
/** Au-delà de cette distance angulaire du centre, un point est derrière le globe. */
export const GLOBE_HIDE_KM = 8500;

/**
 * Relief : MNT Mapbox Terrain (vraies altitudes) rendu en ombrage
 * `hillshade`, réglé pour rester discret sur le style sombre.
 */
export const HILLSHADE = {
  source: "mapbox://mapbox.mapbox-terrain-dem-v1",
  tileSize: 512,
  maxzoom: 14,
  exaggeration: 0.55,
  shadowColor: "#000000",
  highlightColor: "#4a5059",
  accentColor: "#22262d",
};

/** Fichier de musique et gain par défaut si `brand.json` ne les précise pas. */
export const DEFAULT_MUSIC_FILE = "music.mp3";
export const DEFAULT_MUSIC_GAIN_DB = -18;

/** Style Mapbox utilisé pour la carte. */
export const MAPBOX_STYLE = "mapbox://styles/mapbox/dark-v11";
