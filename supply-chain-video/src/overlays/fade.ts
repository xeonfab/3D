import { interpolate } from "remotion";

/** Fondu entrant/sortant de `fadeFrames` aux deux bornes d'une fenêtre. */
export const fadeInOut = (frame: number, start: number, end: number, fadeFrames: number) =>
  interpolate(frame, [start, start + fadeFrames, end - fadeFrames, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
