/**
 * Types des données d'entrée. Tout le contenu de la vidéo vient de
 * `public/steps.json` et `public/brand.json` : rien n'est codé en dur.
 */

export type TravelMode = "land" | "sea";

export type Step = {
  title: string;
  caption: string;
  lat: number;
  lng: number;
  /** Nom de fichier dans `public/` (ex. "farm.jpg"). */
  photo?: string;
  /** Mode du trajet qui PART de cette étape vers la suivante. */
  mode: TravelMode;
  /**
   * Points de passage du trajet qui part de cette étape, au format
   * `[lat, lng]` (comme `lat`/`lng` de l'étape). Indispensable pour un
   * trajet "sea" : c'est le JSON qui porte la route, pas le code.
   */
  waypoints?: [number, number][];
  final?: boolean;
};

export type StepsFile = {
  product: string;
  steps: Step[];
  /** Réglages optionnels de rythme (voir `defaults.ts`). */
  timing?: Partial<Timing>;
  /** Réglages optionnels de caméra (voir `defaults.ts`). */
  camera?: Partial<CameraSettings>;
};

export type CameraSettings = {
  /** Zoom d'arrêt sur une étape "ville" (échelle locale ≤ 10 km). */
  zoomCity: number;
  /** Zoom d'arrêt pour une étape isolée à l'échelle mondiale (≥ 10 000 km). */
  zoomWorld: number;
  /** Marge (px) autour de la route lorsque la caméra survole un tronçon. */
  flightPaddingPx: number;
  /** Ombrage du relief (MNT Mapbox Terrain) sous les routes et labels. */
  hillshade: boolean;
};

export type Timing = {
  fps: number;
  /** Fondu d'ouverture sur la première étape (s). */
  introSeconds: number;
  /** Temps d'arrêt sur chaque étape, cartouche affiché (s). */
  holdSeconds: number;
  /** Durée de vol minimale / maximale entre deux étapes (s). */
  travelMinSeconds: number;
  travelMaxSeconds: number;
  /** Distance (km) à partir de laquelle la durée de vol est maximale. */
  travelMaxDistanceKm: number;
  /** Carte fixe avec logo + ligne de fin (s). */
  endingSeconds: number;
};

export type Brand = {
  name: string;
  /** Couleur de marque, hex CSS (#RRGGBB). */
  color: string;
  /** Nom de fichier du logo dans `public/`. */
  logo: string;
  endLine: string;
  /** Nom de fichier de la musique dans `public/` (défaut : music.mp3). */
  music?: string;
  /** Gain appliqué à la musique en dB (défaut : -18). */
  musicGainDb?: number;
};

export type LngLat = [number, number];

export type Camera = {
  center: LngLat;
  zoom: number;
};

/** Un tronçon de la chaîne : de l'étape `from` à l'étape `to`. */
export type Leg = {
  from: number;
  to: number;
  mode: TravelMode;
  /** Ligne complète (great-circle par morceaux, via les waypoints). */
  line: GeoJSON.Feature<GeoJSON.LineString>;
  /** Longueur totale du tronçon en km. */
  lengthKm: number;
  /** Distance à vol d'oiseau entre les deux étapes en km. */
  directKm: number;
};

/** Phase de la timeline, exprimée en frames absolues. */
export type Phase =
  | { kind: "hold"; step: number; start: number; end: number }
  | { kind: "travel"; leg: number; start: number; end: number }
  | { kind: "ending"; step: number; start: number; end: number };

export type VideoProps = {
  stepsFile: StepsFile;
  brand: Brand;
};
