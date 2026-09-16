import {
  easeInOutCubic,
  flyToAt,
  zoomForBounds,
  zoomForContext,
} from "./camera";
import { legBbox } from "./geo";
import type {
  Camera,
  CameraSettings,
  Leg,
  Phase,
  Step,
  Timing,
} from "./types";

export type Timeline = {
  phases: Phase[];
  durationInFrames: number;
  /** Caméra d'arrêt de chaque étape. */
  holdCameras: Camera[];
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Durée de vol (frames) selon la longueur de la route, log-interpolée. */
export const travelFrames = (lengthKm: number, timing: Timing): number => {
  const km = Math.max(lengthKm, 1);
  const t = clamp01(Math.log10(km) / Math.log10(Math.max(timing.travelMaxDistanceKm, 10)));
  const seconds =
    timing.travelMinSeconds + (timing.travelMaxSeconds - timing.travelMinSeconds) * t;
  return Math.round(seconds * timing.fps);
};

/**
 * Caméra d'arrêt d'une étape : le zoom dépend de l'échelle locale (distance
 * à l'étape voisine la plus proche). L'étape finale est toujours serrée
 * sur la ville d'arrivée.
 */
export const computeHoldCameras = (
  steps: Step[],
  legs: Leg[],
  cam: CameraSettings,
): Camera[] =>
  steps.map((step, i) => {
    const isLast = i === steps.length - 1;
    const neighbours = [legs[i - 1]?.directKm, legs[i]?.directKm].filter(
      (d): d is number => typeof d === "number",
    );
    const contextKm = isLast || step.final ? 0 : Math.min(...neighbours);
    return {
      center: [step.lng, step.lat],
      zoom: zoomForContext(contextKm, cam.zoomCity, cam.zoomWorld),
    };
  });

export const buildTimeline = (
  steps: Step[],
  legs: Leg[],
  timing: Timing,
  cam: CameraSettings,
): Timeline => {
  const phases: Phase[] = [];
  let cursor = 0;
  const holdFrames = Math.round(timing.holdSeconds * timing.fps);
  const introFrames = Math.round(timing.introSeconds * timing.fps);

  steps.forEach((_, i) => {
    const length = holdFrames + (i === 0 ? introFrames : 0);
    phases.push({ kind: "hold", step: i, start: cursor, end: cursor + length });
    cursor += length;
    if (i < legs.length) {
      const length = travelFrames(legs[i].lengthKm, timing);
      phases.push({ kind: "travel", leg: i, start: cursor, end: cursor + length });
      cursor += length;
    }
  });

  const endingFrames = Math.round(timing.endingSeconds * timing.fps);
  phases.push({
    kind: "ending",
    step: steps.length - 1,
    start: cursor,
    end: cursor + endingFrames,
  });
  cursor += endingFrames;

  return {
    phases,
    durationInFrames: cursor,
    holdCameras: computeHoldCameras(steps, legs, cam),
  };
};

export const phaseAt = (timeline: Timeline, frame: number): Phase => {
  const found = timeline.phases.find((p) => frame >= p.start && frame < p.end);
  return found ?? timeline.phases[timeline.phases.length - 1];
};

/** Progression 0→1 (brute, non lissée) dans une phase. */
export const phaseProgress = (phase: Phase, frame: number): number =>
  clamp01((frame - phase.start) / Math.max(phase.end - phase.start, 1));

/** Caméra à une frame donnée : fonction pure du numéro de frame. */
export const cameraAt = (
  timeline: Timeline,
  legs: Leg[],
  frame: number,
  viewport: { width: number; height: number },
  cam: CameraSettings,
): Camera => {
  const phase = phaseAt(timeline, frame);
  if (phase.kind === "hold" || phase.kind === "ending") {
    return timeline.holdCameras[phase.step];
  }
  const leg = legs[phase.leg];
  const from = timeline.holdCameras[leg.from];
  const to = timeline.holdCameras[leg.to];
  const t = easeInOutCubic(phaseProgress(phase, frame));
  const minZoom = zoomForBounds(
    legBbox(leg),
    viewport.width,
    viewport.height,
    cam.flightPaddingPx,
    Math.min(from.zoom, to.zoom),
  );
  return flyToAt(from, to, t, viewport, { minZoom });
};

/** Progression du tracé de chaque tronçon à une frame donnée (0→1). */
export const legProgressAt = (timeline: Timeline, legs: Leg[], frame: number): number[] =>
  legs.map((_, i) => {
    const phase = timeline.phases.find((p) => p.kind === "travel" && p.leg === i);
    if (!phase) return 0;
    if (frame >= phase.end) return 1;
    if (frame < phase.start) return 0;
    return easeInOutCubic(phaseProgress(phase, frame));
  });
