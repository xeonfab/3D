import { describe, expect, it } from "vitest";

import {
  buildTimeline,
  cameraAt,
  FPS,
  legProgressAt,
  thumbnailFrame,
  videoDurationSeconds,
} from "@/remotion/timeline";
import type { VideoStep } from "@/remotion/types";

const step = (
  lat: number,
  lng: number,
  mode: VideoStep["mode"] = "land",
  durationSeconds = 6,
): VideoStep => ({
  title: "",
  caption: "",
  lat,
  lng,
  mode,
  waypoints: [],
  photoUrl: null,
  durationSeconds,
});

const STEPS = [
  step(5.75, 38.9),
  step(5.9, 38.8),
  step(11.6, 43.15, "sea"),
  step(49.49, 0.11),
  step(44.84, -0.58),
  step(48.11, -1.68),
];

describe("timeline vidéo", () => {
  it("dure 3 s d'intro + Σ duration_seconds + 4 s de fin", () => {
    const t = buildTimeline(STEPS, FPS);
    expect(t.durationInFrames).toBe((3 + 6 * 6 + 4) * FPS);
    expect(videoDurationSeconds(STEPS)).toBe(43);
    expect(t.phases[0]).toMatchObject({ kind: "intro", start: 0, end: 3 * FPS });
    expect(t.phases[t.phases.length - 1]).toMatchObject({
      kind: "ending",
      step: 5,
      end: t.durationInFrames,
    });
  });

  it("chaque étape occupe exactement sa durée (vol + arrêt), sans trou", () => {
    const t = buildTimeline(STEPS, FPS);
    let cursor = 3 * FPS;
    STEPS.forEach((s, i) => {
      const travel = t.phases.find((p) => p.kind === "travel" && p.leg === i - 1);
      const hold = t.phases.find((p) => p.kind === "hold" && p.step === i)!;
      const start = i === 0 ? hold.start : travel!.start;
      expect(start).toBe(cursor);
      expect(hold.end - start).toBe(s.durationSeconds * FPS);
      if (travel) expect(travel.end).toBe(hold.start);
      cursor = hold.end;
    });
  });

  it("la caméra vole de l'étape précédente vers la suivante, plus haut pour les longues distances", () => {
    const t = buildTimeline(STEPS, FPS);
    const viewport = { width: 1080, height: 1920 };
    const sea = t.phases.find((p) => p.kind === "travel" && p.leg === 2)!;
    const mid = cameraAt(t, Math.round((sea.start + sea.end) / 2), viewport, FPS);
    expect(mid.zoom).toBeLessThan(t.holdCameras[2].zoom);
    expect(mid.zoom).toBeLessThan(3.5); // Djibouti → Le Havre : vue globe/région
    const short = t.phases.find((p) => p.kind === "travel" && p.leg === 0)!;
    const midShort = cameraAt(t, Math.round((short.start + short.end) / 2), viewport, FPS);
    expect(midShort.zoom).toBeGreaterThan(mid.zoom);
    expect(cameraAt(t, sea.end, viewport, FPS)).toEqual(t.holdCameras[3]);
  });

  it("le tracé se dessine pendant le vol et reste complet ensuite", () => {
    const t = buildTimeline(STEPS, FPS);
    const sea = t.phases.find((p) => p.kind === "travel" && p.leg === 2)!;
    expect(legProgressAt(t, sea.start - 1)[2]).toBe(0);
    const mid = legProgressAt(t, Math.round((sea.start + sea.end) / 2))[2];
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
    expect(legProgressAt(t, sea.end)[2]).toBe(1);
    expect(legProgressAt(t, t.durationInFrames - 1)).toEqual([1, 1, 1, 1, 1]);
  });

  it("la miniature tombe pendant l'arrêt sur la dernière étape", () => {
    const t = buildTimeline(STEPS, FPS);
    const last = t.phases.find((p) => p.kind === "hold" && p.step === 5)!;
    const f = thumbnailFrame(t);
    expect(f).toBeGreaterThan(last.start);
    expect(f).toBeLessThan(last.end);
  });
});
