/**
 * Types des données d'entrée. Tout le contenu de la vidéo vient de
 * `public/steps-*.json` et `public/brand*.json` : rien n'est codé en dur.
 */

export type TravelMode = "land" | "sea" | "air";
export type Narrative = "origine" | "terroir";
export type StepKind = "actor" | "transit";

export type Step = {
  /** `actor` : quelqu'un fait le produit ici (héros). `transit` : simple passage, jamais nommé à l'écran. */
  kind: StepKind;
  title: string;
  /** Prénom / nom de la personne (actor uniquement). */
  personName?: string | null;
  /** Ignoré pour un transit. */
  caption?: string;
  /** Lieu lisible (ville, région) : ligne « Place, Pays » du cartouche. */
  place?: string;
  lat: number;
  lng: number;
  /** Nom de fichier dans `public/` (ex. "farm.jpg"). Ignoré pour un transit. */
  photo?: string;
  /** Mode du trajet qui PART de cette étape : land (camion), sea (bateau), air (avion). Défaut : land. */
  mode?: TravelMode;
  /**
   * Points de passage du trajet qui part de cette étape, au format
   * `[lat, lng]`. Indispensable pour un trajet "sea" : c'est le JSON qui
   * porte la route, pas le code.
   */
  waypoints?: [number, number][];
  /** Code pays ISO 3166-1 alpha-2 (ex. "FR") : le pays se teinte à l'arrivée de l'étape. */
  country?: string;
  final?: boolean;
};

export type StepsFile = {
  product: string;
  /** `origine` : héros + transport compressé. `terroir` : tout vient d'un rayon local. */
  narrative: Narrative;
  /** Nombre d'intermédiaires, affiché au milieu de l'arc de transit (origine). */
  intermediariesCount?: number | null;
  /** Ligne de sourcing, alternative à `intermediariesCount` (origine). */
  sourcingLine?: string | null;
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
  /** Marge (px) autour de la route / du rayon lorsque la caméra cadre l'ensemble. */
  flightPaddingPx: number;
  /** Terroir : zoom sur une ferme = zoom de la vue rayon + ce supplément. */
  farmZoomOffset: number;
};

/** Habillage de la carte, surchargeable depuis `brand.json` → `"map"`. */
export type MapLook = {
  /**
   * `day` : outdoors-v12, couleurs naturelles. `night` : dark-v11 recoloré.
   * `satellite` : imagerie satellite, vue inclinée, terrain 3D, traînée lumineuse.
   */
  theme: "day" | "night" | "satellite";
  /** Inclinaison de la caméra en degrés (0 = vue du dessus). */
  pitch: number;
  /** Terrain 3D (MNT Mapbox) et son exagération verticale. */
  terrain: boolean;
  terrainExaggeration: number;
  /** Lumières des villes (NASA Black Marble, tuiles publiques GIBS) fondues sur la carte. */
  cityLights: boolean;
  /** Traînée lumineuse : dégradé tête éclatante → queue estompée sur le tracé en cours. */
  trailGlow: boolean;
  /** Facteur de taille des véhicules (avion, bateau, camion). */
  vehicleScale: number;
  /** URL de style Mapbox ; vide = style du thème. */
  style: string;
  /** Projection globe (Terre ronde aux petits zooms) au lieu de Mercator. */
  globe: boolean;
  /** Atmosphère / halo d'horizon / étoiles (fog Mapbox). */
  atmosphere: boolean;
  /** Ombrage du relief (MNT Mapbox Terrain) sous l'eau, les routes et les labels. */
  hillshade: boolean;
  /** Couleur de la mer et de la terre (hex) ; vide = couleurs du style. */
  seaColor: string;
  landColor: string;
  /** Liseré le long des côtes (utile sur dark-v11 ; outdoors en a déjà). */
  coastline: boolean;
  /** Frontières et labels de pays renforcés (pensé pour dark-v11). */
  countries: boolean;
  /** Teinte les pays des étapes (champ `country`) dans la couleur de marque. */
  highlightCountries: boolean;
  /** Bateau / camion à la tête du tracé pendant les vols. */
  vehicle: boolean;
};

export type Timing = {
  fps: number;
  /** Intro : logo en fondu + sous-titre (s). */
  introSeconds: number;
  /** Premier et dernier actor, les héros (s). */
  firstActorSeconds: number;
  lastActorSeconds: number;
  /** Actors intermédiaires (s), vol d'entrée compris. */
  actorSeconds: number;
  /** Vol d'entrée sur un actor intermédiaire / sur le dernier actor (s). */
  actorFlightSeconds: number;
  lastActorFlightSeconds: number;
  /** Tous les transits consécutifs fusionnés en un seul vol d'au plus (s). */
  transitMaxSeconds: number;
  /** Part minimale des plans actor sur (actor + transit). */
  minActorRatio: number;
  /** Terroir : vue rayon (s). */
  radiusSeconds: number;
  /** Cartouches et photos : durée d'apparition / disparition (s). */
  cardFadeSeconds: number;
  /** Carte fixe assombrie avec logo + ligne de fin (s). */
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
  /** Langue des noms de pays (BCP 47, défaut "fr"). */
  locale?: string;
};

export type LngLat = [number, number];

export type Camera = {
  center: LngLat;
  zoom: number;
};

/** Un tronçon entre deux étapes consécutives. */
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

/** Segment de la timeline, en frames absolues (`end` exclu). */
export type Segment =
  | { kind: "intro"; start: number; end: number }
  | {
      kind: "actor";
      step: number;
      role: "first" | "middle" | "last";
      start: number;
      /** Fin du vol d'entrée (= start pour le premier actor : caméra déjà posée). */
      flightEnd: number;
      end: number;
    }
  | {
      kind: "transit";
      /** Actors de départ et d'arrivée ; `via` = indices des transits traversés. */
      from: number;
      to: number;
      via: number[];
      start: number;
      end: number;
    }
  | { kind: "radius"; start: number; end: number }
  | { kind: "ending"; start: number; end: number };

/** Props de la composition : chemins des JSON (dans `public/`) puis contenu chargé. */
export type VideoProps = {
  stepsPath: string;
  brandPath: string;
  stepsFile: StepsFile | null;
  brand: Brand | null;
};
