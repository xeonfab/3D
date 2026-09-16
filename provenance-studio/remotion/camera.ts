/*
 * Mathématiques de caméra en pur TypeScript, sans dépendre de l'instance
 * Mapbox : la position à chaque frame est une fonction pure du numéro de
 * frame (rendu déterministe). Hypothèse : bearing 0, pitch 0, Web Mercator.
 */
import type { LngLat } from "@/lib/routes";

import type { Camera } from "./types";

const TILE_SIZE = 512;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Web Mercator → pixels « monde » au zoom donné. */
export const project = (lngLat: LngLat, zoom: number): [number, number] => {
  const worldSize = TILE_SIZE * Math.pow(2, zoom);
  const lat = clamp(lngLat[1], -85.051129, 85.051129);
  const x = ((lngLat[0] + 180) / 360) * worldSize;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize;
  return [x, y];
};

export const unproject = (xy: [number, number], zoom: number): LngLat => {
  const worldSize = TILE_SIZE * Math.pow(2, zoom);
  const lng = (xy[0] / worldSize) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * xy[1]) / worldSize;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lng, lat];
};

/** Position écran (px) d'un point pour une caméra donnée : place les overlays exactement sur la carte. */
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

/** Zoom fractionnaire qui fait tenir une emprise dans le viewport (équivalent pur de `cameraForBounds`). */
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
 * Trajectoire de `map.flyTo` (van Wijk & Nuij) sous forme de fonction pure
 * de t ∈ [0,1]. `minZoom` : zoom au sommet de la trajectoire.
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

  if (opts.minZoom !== undefined && u1 > 1e-6) {
    const minZoom = Math.min(opts.minZoom, startZoom, zoom);
    const wMax = w0 / zoomScale(minZoom - startZoom);
    rho = Math.sqrt((wMax / u1) * 2);
  }
  const rho2 = rho * rho;

  const r = (i: 0 | 1) => {
    const b =
      (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
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

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
