/**
 * Timeline de la vidéo, fonction pure des étapes :
 *   intro 3 s + Σ duration_seconds (vol + arrêt par étape) + fin 4 s.
 * Partagée par la composition, le calcul de durée et le choix de la
 * miniature.
 */
import { bbox as turfBbox } from "@turf/turf";

import {
  buildLegs,
  stopZoom,
  toLngLat,
  zoomForDistance,
  type Leg,
  type RouteStep,
} from "@/lib/routes";

import { easeInOutCubic, easeOutCubic, flyToAt, zoomForBounds } from "./camera";
import type { Camera, VideoStep } from "./types";

export const FPS = 30;
export const INTRO_SECONDS = 3;
export const ENDING_SECONDS = 4;
/** Part de la durée d'une étape consacrée au vol depuis l'étape précédente. */
const FLIGHT_RATIO = 0.45;
const MIN_FLIGHT_SECONDS = 1.6;
const MIN_HOLD_SECONDS = 1.2;
/** Zoom-in serré sur la dernière étape au début de la fin. */
const ENDING_ZOOM_IN_SECONDS = 1.2;
const ENDING_ZOOM_DELTA = 1.4;
const FLIGHT_PADDING_PX = 120;

export type Phase =
  | { kind: "intro"; start: number; end: number }
  | { kind: "travel"; leg: number; start: number; end: number }
  | { kind: "hold"; step: number; start: number; end: number }
  | { kind: "ending"; step: number; start: number; end: number };

export type Timeline = {
  phases: Phase[];
  durationInFrames: number;
  holdCameras: Camera[];
  legs: Leg[];
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const toRouteSteps = (steps: VideoStep[]): RouteStep[] =>
  steps.map((s) => ({ lat: s.lat, lng: s.lng, mode: s.mode, waypoints: s.waypoints }));

export function buildTimeline(steps: VideoStep[], fps = FPS): Timeline {
  const routeSteps = toRouteSteps(steps);
  const legs = buildLegs(routeSteps);
  const phases: Phase[] = [];
  let cursor = 0;

  const intro = Math.round(INTRO_SECONDS * fps);
  phases.push({ kind: "intro", start: 0, end: intro });
  cursor = intro;

  steps.forEach((step, i) => {
    const slot = Math.round(step.durationSeconds * fps);
    if (i === 0) {
      phases.push({ kind: "hold", step: 0, start: cursor, end: cursor + slot });
      cursor += slot;
      return;
    }
    const travel = Math.min(
      Math.max(Math.round(MIN_FLIGHT_SECONDS * fps), Math.round(slot * FLIGHT_RATIO)),
      slot - Math.round(MIN_HOLD_SECONDS * fps),
    );
    phases.push({ kind: "travel", leg: i - 1, start: cursor, end: cursor + travel });
    cursor += travel;
    phases.push({ kind: "hold", step: i, start: cursor, end: cursor + (slot - travel) });
    cursor += slot - travel;
  });

  const ending = Math.round(ENDING_SECONDS * fps);
  phases.push({ kind: "ending", step: steps.length - 1, start: cursor, end: cursor + ending });
  cursor += ending;

  const holdCameras: Camera[] = steps.map((s, i) => ({
    center: toLngLat(s),
    zoom: stopZoom(routeSteps, i),
  }));
  return { phases, durationInFrames: cursor, holdCameras, legs };
}

export const phaseAt = (timeline: Timeline, frame: number): Phase =>
  timeline.phases.find((p) => frame >= p.start && frame < p.end) ??
  timeline.phases[timeline.phases.length - 1];

export const phaseProgress = (phase: Phase, frame: number): number =>
  clamp01((frame - phase.start) / Math.max(phase.end - phase.start, 1));

/** Caméra à une frame donnée. */
export function cameraAt(
  timeline: Timeline,
  frame: number,
  viewport: { width: number; height: number },
  fps = FPS,
): Camera {
  const phase = phaseAt(timeline, frame);
  if (phase.kind === "intro") return timeline.holdCameras[0];
  if (phase.kind === "hold") return timeline.holdCameras[phase.step];
  if (phase.kind === "ending") {
    const base = timeline.holdCameras[phase.step];
    const t = easeOutCubic(clamp01((frame - phase.start) / (ENDING_ZOOM_IN_SECONDS * fps)));
    return { center: base.center, zoom: base.zoom + ENDING_ZOOM_DELTA * t };
  }
  const leg = timeline.legs[phase.leg];
  const from = timeline.holdCameras[leg.from];
  const to = timeline.holdCameras[leg.to];
  const t = easeInOutCubic(phaseProgress(phase, frame));
  const b = turfBbox(leg.line);
  const fitZoom = zoomForBounds(
    [b[0], b[1], b[2], b[3]],
    viewport.width,
    viewport.height,
    FLIGHT_PADDING_PX,
    Math.min(from.zoom, to.zoom),
  );
  // Altitude selon la distance (globe / région / ville), sans jamais perdre le tronçon de vue.
  const minZoom = Math.min(fitZoom, zoomForDistance(leg.directKm));
  return flyToAt(from, to, t, viewport, { minZoom });
}

/** Progression 0→1 du tracé de chaque tronçon à une frame donnée. */
export const legProgressAt = (timeline: Timeline, frame: number): number[] =>
  timeline.legs.map((_, i) => {
    const phase = timeline.phases.find((p) => p.kind === "travel" && p.leg === i);
    if (!phase) return 0;
    if (frame >= phase.end) return 1;
    if (frame < phase.start) return 0;
    return easeInOutCubic(phaseProgress(phase, frame));
  });

/** Frame représentative pour la miniature : au cœur de l'arrêt sur la dernière étape. */
export function thumbnailFrame(timeline: Timeline): number {
  const holds = timeline.phases.filter(
    (p): p is Extract<Phase, { kind: "hold" }> => p.kind === "hold",
  );
  const last = holds[holds.length - 1];
  if (!last) return 0;
  return Math.round(last.start + (last.end - last.start) * 0.6);
}

/** Durée totale en secondes, pour l'estimation affichée à l'utilisateur. */
export const videoDurationSeconds = (steps: { durationSeconds: number }[]): number =>
  INTRO_SECONDS + steps.reduce((sum, s) => sum + s.durationSeconds, 0) + ENDING_SECONDS;
