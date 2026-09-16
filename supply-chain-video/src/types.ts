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
  /** Code pays ISO 3166-1 alpha-2 (ex. "FR") : le pays se teinte à l'arrivée de l'étape. */
  country?: string;
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
};

/** Habillage de la carte, surchargeable depuis `brand.json` → `"map"`. */
export type MapLook = {
  /** Projection globe (Terre ronde aux petits zooms) au lieu de Mercator. */
  globe: boolean;
  /** Atmosphère / halo d'horizon / étoiles (fog Mapbox). */
  atmosphere: boolean;
  /** Ombrage du relief (MNT Mapbox Terrain) sous l'eau, les routes et les labels. */
  hillshade: boolean;
  /** Couleur de la mer et de la terre (hex) ; vide = couleurs du style. */
  seaColor: string;
  landColor: string;
  /** Liseré lumineux le long des côtes. */
  coastline: boolean;
  /** Frontières et labels de pays renforcés. */
  countries: boolean;
  /** Teinte les pays des étapes (champ `country`) dans la couleur de marque. */
  highlightCountries: boolean;
  /** Bateau / camion à la tête du tracé pendant les vols. */
  vehicle: boolean;
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
  /** Habillage de la carte (voir `MapLook` et `defaults.ts`). */
  map?: Partial<MapLook>;
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
