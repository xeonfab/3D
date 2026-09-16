import type { Segment, StepsFile, Timing } from "./types";

/*
 * Timeline : fonction pure (étapes + récit + rythme) → segments en frames.
 * Aucune dépendance à la carte ni à React : testable en isolation.
 */

export type Timeline = {
  segments: Segment[];
  durationInFrames: number;
  /** Frames des plans actor (vol d'entrée compris) et des vols de transit. */
  actorFrames: number;
  transitFrames: number;
  /** actorFrames / (actorFrames + transitFrames). */
  actorRatio: number;
};

const frames = (seconds: number, fps: number) => Math.round(seconds * fps);

/** Indices des actors et, pour chacun, les transits qui le précèdent. */
export const actorGroups = (file: StepsFile): { actor: number; via: number[] }[] => {
  const groups: { actor: number; via: number[] }[] = [];
  let via: number[] = [];
  file.steps.forEach((step, i) => {
    if (step.kind === "transit") {
      via.push(i);
    } else {
      groups.push({ actor: i, via });
      via = [];
    }
  });
  return groups;
};

const buildOrigine = (file: StepsFile, timing: Timing): Segment[] => {
  const { fps } = timing;
  const groups = actorGroups(file);
  const segments: Segment[] = [];
  let cursor = 0;

  segments.push({ kind: "intro", start: 0, end: frames(timing.introSeconds, fps) });
  cursor = frames(timing.introSeconds, fps);

  // Durée totale des plans actor, pour plafonner les transits (règle 70 / 30).
  const actorSeconds =
    timing.firstActorSeconds +
    timing.lastActorSeconds +
    Math.max(0, groups.length - 2) * timing.actorSeconds;
  const transitRuns = groups.filter((g) => g.via.length > 0).length;
  const transitBudget = (actorSeconds * (1 - timing.minActorRatio)) / timing.minActorRatio;
  const transitSeconds =
    transitRuns === 0 ? 0 : Math.min(timing.transitMaxSeconds, transitBudget / transitRuns);

  groups.forEach((group, g) => {
    const isFirst = g === 0;
    const isLast = g === groups.length - 1;

    if (group.via.length > 0) {
      const length = frames(transitSeconds, fps);
      segments.push({
        kind: "transit",
        from: groups[g - 1].actor,
        to: group.actor,
        via: group.via,
        start: cursor,
        end: cursor + length,
      });
      cursor += length;
    }

    const seconds = isFirst
      ? timing.firstActorSeconds
      : isLast
        ? timing.lastActorSeconds
        : timing.actorSeconds;
    const flight = isFirst
      ? 0
      : Math.min(seconds, isLast ? timing.lastActorFlightSeconds : timing.actorFlightSeconds);
    const length = frames(seconds, fps);
    segments.push({
      kind: "actor",
      step: group.actor,
      role: isFirst ? "first" : isLast ? "last" : "middle",
      start: cursor,
      flightEnd: cursor + frames(flight, fps),
      end: cursor + length,
    });
    cursor += length;
  });

  segments.push({ kind: "ending", start: cursor, end: cursor + frames(timing.endingSeconds, fps) });
  return segments;
};

const buildTerroir = (file: StepsFile, timing: Timing): Segment[] => {
  const { fps } = timing;
  const segments: Segment[] = [];
  let cursor = 0;

  segments.push({ kind: "intro", start: 0, end: frames(timing.introSeconds, fps) });
  cursor += frames(timing.introSeconds, fps);

  segments.push({ kind: "radius", start: cursor, end: cursor + frames(timing.radiusSeconds, fps) });
  cursor += frames(timing.radiusSeconds, fps);

  const last = file.steps.length - 1;
  file.steps.forEach((_, i) => {
    const isLast = i === last;
    const seconds = isLast ? timing.lastActorSeconds : timing.actorSeconds;
    const flight = Math.min(
      seconds,
      isLast ? timing.lastActorFlightSeconds : timing.actorFlightSeconds,
    );
    const length = frames(seconds, fps);
    segments.push({
      kind: "actor",
      step: i,
      role: isLast ? "last" : "middle",
      start: cursor,
      flightEnd: cursor + frames(flight, fps),
      end: cursor + length,
    });
    cursor += length;
  });

  segments.push({ kind: "ending", start: cursor, end: cursor + frames(timing.endingSeconds, fps) });
  return segments;
};

export const buildTimeline = (file: StepsFile, timing: Timing): Timeline => {
  const segments =
    file.narrative === "terroir" ? buildTerroir(file, timing) : buildOrigine(file, timing);
  const len = (s: Segment) => s.end - s.start;
  const actorFrames = segments.filter((s) => s.kind === "actor").reduce((a, s) => a + len(s), 0);
  const transitFrames = segments
    .filter((s) => s.kind === "transit")
    .reduce((a, s) => a + len(s), 0);
  return {
    segments,
    durationInFrames: segments[segments.length - 1].end,
    actorFrames,
    transitFrames,
    actorRatio: actorFrames / Math.max(actorFrames + transitFrames, 1),
  };
};

export const segmentAt = (timeline: Timeline, frame: number): Segment => {
  const found = timeline.segments.find((s) => frame >= s.start && frame < s.end);
  return found ?? timeline.segments[timeline.segments.length - 1];
};

/** Progression 0→1 (brute, non lissée) entre deux frames. */
export const progress = (start: number, end: number, frame: number): number =>
  Math.min(1, Math.max(0, (frame - start) / Math.max(end - start, 1)));
