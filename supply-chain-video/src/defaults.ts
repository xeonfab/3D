import type { CameraSettings, MapLook, Timing } from "./types";

/**
 * Rythme par défaut, surchargeable depuis `steps-*.json` → `"timing"`.
 * Origine (3 actors, 1 transit) : 3 + 8 + 6 + 3 + 8 + 4 = 32 s.
 * Terroir (3 fermes + atelier) : 3 + 5 + 3×6 + 8 + 4 = 38 s.
 */
export const DEFAULT_TIMING: Timing = {
  fps: 30,
  introSeconds: 3,
  firstActorSeconds: 8,
  lastActorSeconds: 8,
  actorSeconds: 6,
  actorFlightSeconds: 1.5,
  lastActorFlightSeconds: 2,
  transitMaxSeconds: 3,
  minActorRatio: 0.7,
  radiusSeconds: 5,
  cardFadeSeconds: 0.3,
  endingSeconds: 4,
};

/** Fichiers par défaut dans `public/` (surchargeables par les props de rendu). */
export const DEFAULT_STEPS_PATH = "steps-origine.json";
export const DEFAULT_BRAND_PATH = "brand.json";

/** Textes de l'intro selon le récit ; `{product}` est remplacé. */
export const INTRO_SUBTITLE: Record<"origine" | "terroir", string> = {
  origine: "Qui fait {product}",
  terroir: "Tout vient d'ici",
};
/** Terroir : mention de la vue rayon ; `{km}` est remplacé. */
export const RADIUS_LINE = "Tout vient de moins de {km} km";
/** Origine : ligne au milieu de l'arc de transit ; `{n}` est remplacé. */
export const INTERMEDIARIES_LINE = "{n} intermédiaires";
/** Terroir : arrondi du rayon (km). */
export const RADIUS_ROUND_KM = 10;

/** Réglages de caméra par défaut, surchargeables via `steps.json` → `"camera"`. */
export const DEFAULT_CAMERA: CameraSettings = {
  zoomCity: 11,
  zoomWorld: 5,
  flightPaddingPx: 140,
  farmZoomOffset: 1.2,
};

/**
 * Habillage par défaut, surchargeable via `brand.json` → `"map"`.
 * Thème `day` : outdoors-v12 tel quel (relief, végétation, noms de lieux).
 * Thème `night` : dark-v11 recoloré (voir NIGHT_LOOK).
 */
export const DEFAULT_LOOK: MapLook = {
  theme: "day",
  style: "",
  pitch: 0,
  terrain: false,
  terrainExaggeration: 1.5,
  cityLights: false,
  trailGlow: false,
  vehicleScale: 1,
  globe: true,
  atmosphere: true,
  hillshade: true,
  seaColor: "",
  landColor: "",
  coastline: false,
  countries: false,
  highlightCountries: true,
  vehicle: true,
};

/** Surcharges appliquées quand `theme` vaut `night` (avant celles de brand.json). */
export const NIGHT_LOOK: Partial<MapLook> = {
  seaColor: "#0a1220",
  landColor: "#2b3038",
  coastline: true,
  countries: true,
};

/** Surcharges du thème `satellite` : Terre vue en perspective, façon documentaire. */
export const SATELLITE_LOOK: Partial<MapLook> = {
  pitch: 55,
  terrain: true,
  terrainExaggeration: 1.5,
  cityLights: true,
  trailGlow: true,
  vehicleScale: 1.7,
  hillshade: false,
};

/** Style Mapbox de chaque thème. */
export const THEME_STYLE: Record<MapLook["theme"], string> = {
  day: "mapbox://styles/mapbox/outdoors-v12",
  night: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

/**
 * Lumières des villes : NASA Black Marble (VIIRS), servi par GIBS en tuiles
 * web-mercator publiques (pas de token). Composite annuel, zoom max 8.
 */
export const CITY_LIGHTS = {
  tiles:
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
  tileSize: 256,
  maxzoom: 8,
  opacity: 0.75,
  attribution: "NASA Earth Observatory / VIIRS Black Marble",
};

/** Traînée lumineuse : opacités le long du tracé en cours (queue → tête). */
export const TRAIL = { tailOpacity: 0.1, headWidth: 6, glowWidth: 22, glowOpacity: 0.35 };

/** Atmosphère (fog Mapbox) par thème. */
export const ATMOSPHERE: Record<
  MapLook["theme"],
  { color: string; highColor: string; horizonBlend: number; spaceColor: string; starIntensity: number }
> = {
  day: {
    color: "rgb(225, 232, 240)",
    highColor: "rgb(130, 170, 225)",
    horizonBlend: 0.05,
    spaceColor: "rgb(12, 16, 40)",
    starIntensity: 0.08,
  },
  night: {
    color: "rgb(14, 18, 30)",
    highColor: "rgb(28, 40, 80)",
    horizonBlend: 0.06,
    spaceColor: "rgb(3, 4, 9)",
    starIntensity: 0.35,
  },
  satellite: {
    color: "rgb(186, 210, 235)",
    highColor: "rgb(36, 92, 223)",
    horizonBlend: 0.03,
    spaceColor: "rgb(4, 6, 14)",
    starIntensity: 0.6,
  },
};

/** Couleurs de l'aperçu hors ligne (Natural Earth) par thème. */
export const OFFLINE_COLORS: Record<MapLook["theme"], { sea: string; land: string; coast: string; text: string }> = {
  day: { sea: "#a9c6e0", land: "#ece7da", coast: "#8aa0b4", text: "#5a6a7a" },
  night: { sea: "#0a1220", land: "#2b3038", coast: "#6f8296", text: "#6f8296" },
  satellite: { sea: "#0e2a4a", land: "#5a6a3c", coast: "#8fa4b8", text: "#b7c3cf" },
};

/** Opacité des voiles sombres d'intro et de fin. */
export const VEIL_OPACITY = { intro: 0.45, ending: 0.5 };

/** Langue par défaut des noms de pays (Intl.DisplayNames). */
export const DEFAULT_LOCALE = "fr";

/**
 * Chapeaux affichés au-dessus des cartouches, dérivés du rôle du plan.
 * `{i}` / `{n}` : numéro et nombre de fermes (terroir).
 */
export const CHAPTER_LINES = {
  origine: { first: "D'où ça vient", middle: "Qui le transforme", last: "Qui le fabrique" },
  terroir: { first: "Ferme {i} / {n}", middle: "Ferme {i} / {n}", last: "L'atelier" },
} as const;
/** Origine : ligne au milieu de l'arc ; `{text}` = intermédiaires ou sourcing. */
export const TRANSIT_LINE = "Et entre les deux : {text}";

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

