import type { Camera, LngLat } from "./types";

/*
 * Mathématiques de caméra, en pur TypeScript et sans dépendance sur
 * l'instance Mapbox : la position à chaque frame est une fonction pure
 * du numéro de frame, ce qui garantit un rendu déterministe.
 *
 * Hypothèse : bearing = 0 et pitch = 0 (projection Web Mercator
 * classique). C'est aussi ce qui garantit l'exactitude géographique.
 */

/** Taille de tuile de référence de Mapbox GL. */
const TILE_SIZE = 512;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Projection Web Mercator → pixels "monde" au zoom donné. */
export const project = (lngLat: LngLat, zoom: number): [number, number] => {
  const worldSize = TILE_SIZE * Math.pow(2, zoom);
  const lat = clamp(lngLat[1], -85.051129, 85.051129);
  const x = ((lngLat[0] + 180) / 360) * worldSize;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize;
  return [x, y];
};

/** Inverse de `project`. */
export const unproject = (xy: [number, number], zoom: number): LngLat => {
  const worldSize = TILE_SIZE * Math.pow(2, zoom);
  const lng = (xy[0] / worldSize) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * xy[1]) / worldSize;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lng, lat];
};

/**
 * Position à l'écran (px) d'un point géographique pour une caméra donnée.
 * Sert à placer les overlays HTML (point pulsant) exactement sur la carte.
 */
export const toScreen = (
  lngLat: LngLat,
  camera: Camera,
  width: number,
  height: number,
): [number, number] => {
  const [cx, cy] = project(camera.center, camera.zoom);
  const [px, py] = project(lngLat, camera.zoom);
  return [width / 2 + (px - cx), height / 2 + (py - cy)];
};

/**
 * Zoom (fractionnaire) qui fait tenir une emprise dans le viewport,
 * avec une marge en pixels. Équivalent pur de `map.cameraForBounds`.
 */
export const zoomForBounds = (
  bounds: [number, number, number, number],
  width: number,
  height: number,
  paddingPx: number,
  maxZoom: number,
): number => {
  const [w, s, e, n] = bounds;
  const [x0, y0] = project([w, n], 0);
  const [x1, y1] = project([e, s], 0);
  const dx = Math.max(x1 - x0, 1e-9);
  const dy = Math.max(y1 - y0, 1e-9);
  const availW = Math.max(width - 2 * paddingPx, 1);
  const availH = Math.max(height - 2 * paddingPx, 1);
  const zoom = Math.min(Math.log2(availW / dx), Math.log2(availH / dy));
  return clamp(zoom, 0, maxZoom);
};

/**
 * Reproduit la trajectoire de `map.flyTo` (van Wijk & Nuij, « Smooth and
 * efficient zooming and panning ») sous forme de fonction pure de t∈[0,1].
 * `minZoom` : zoom au sommet de la trajectoire — on le fixe à l'emprise du
 * tronçon pour que la route entière reste visible en vol.
 */
export const flyToAt = (
  from: Camera,
  to: Camera,
  t: number,
  viewport: { width: number; height: number },
  opts: { curve?: number; minZoom?: number } = {},
): Camera => {
  const k = clamp(t, 0, 1);
  if (k <= 0) return from;
  if (k >= 1) return to;

  const startZoom = from.zoom;
  const zoom = to.zoom;
  const zoomScale = (z: number) => Math.pow(2, z);
  const scaleZoom = (s: number) => Math.log(s) / Math.LN2;

  const fromPx = project(from.center, startZoom);
  const toPx = project(to.center, startZoom);
  const delta: [number, number] = [toPx[0] - fromPx[0], toPx[1] - fromPx[1]];

  let rho = opts.curve ?? 1.42;
  const w0 = Math.max(viewport.width, viewport.height);
  const w1 = w0 / zoomScale(zoom - startZoom);
  const u1 = Math.hypot(delta[0], delta[1]);

  if (opts.minZoom !== undefined) {
    const minZoom = Math.min(opts.minZoom, startZoom, zoom);
    const wMax = w0 / zoomScale(minZoom - startZoom);
    rho = Math.sqrt((wMax / u1) * 2);
  }
  const rho2 = rho * rho;

  const r = (i: 0 | 1) => {
    const b =
      (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) /
      (2 * (i ? w1 : w0) * rho2 * u1);
    return Math.log(Math.sqrt(b * b + 1) - b);
  };
  const sinh = (n: number) => (Math.exp(n) - Math.exp(-n)) / 2;
  const cosh = (n: number) => (Math.exp(n) + Math.exp(-n)) / 2;
  const tanh = (n: number) => sinh(n) / cosh(n);

  const r0 = r(0);
  let w = (s: number) => cosh(r0) / cosh(r0 + rho * s);
  let u = (s: number) => (w0 * ((cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2)) / u1;
  let S = (r(1) - r0) / rho;

  if (Math.abs(u1) < 1e-6 || !Number.isFinite(S)) {
    // Pas de déplacement : simple zoom linéaire (cas dégénéré de mapbox).
    if (Math.abs(w0 - w1) < 1e-6) return { center: to.center, zoom: to.zoom };
    const sign = w1 < w0 ? -1 : 1;
    S = Math.abs(Math.log(w1 / w0)) / rho;
    u = () => 0;
    w = (s: number) => Math.exp(sign * rho * s);
  }

  const s = k * S;
  const scale = 1 / w(s);
  const newZoom = startZoom + scaleZoom(scale);
  const us = u(s);
  const center = unproject(
    [(fromPx[0] + delta[0] * us) * scale, (fromPx[1] + delta[1] * us) * scale],
    newZoom,
  );
  return { center, zoom: newZoom };
};

/** Easing doux (ease-in-out cubique). */
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Zoom "d'arrêt" sur une étape, adapté à l'échelle du contexte :
 * serré pour une ville, large pour un saut intercontinental. On prend la
 * plus grande des distances vers les étapes voisines comme échelle.
 * (log-interpolation : 10 km → zoomCity, 10 000 km → zoomWorld)
 */
export const zoomForContext = (
  contextKm: number,
  zoomCity: number,
  zoomWorld: number,
): number => {
  const km = clamp(contextKm, 10, 10000);
  const t = (Math.log10(km) - 1) / 3; // 0 → 10 km, 1 → 10 000 km
  return zoomCity + (zoomWorld - zoomCity) * t;
};
