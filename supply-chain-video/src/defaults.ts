import type { CameraSettings, Timing } from "./types";

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
  flightPaddingPx: 120,
};

/** Fichier de musique et gain par défaut si `brand.json` ne les précise pas. */
export const DEFAULT_MUSIC_FILE = "music.mp3";
export const DEFAULT_MUSIC_GAIN_DB = -18;

/** Style Mapbox utilisé pour la carte. */
export const MAPBOX_STYLE = "mapbox://styles/mapbox/dark-v11";
