import { easeInOutCubic, flyToAt, zoomForBounds, zoomForContext } from "./camera";
import {
  CHAPTER_LINES,
  DEFAULT_LOCALE,
  INTERMEDIARIES_LINE,
  INTRO_SUBTITLE,
  RADIUS_LINE,
  RADIUS_ROUND_KM,
  TRANSIT_LINE,
} from "./defaults";
import {
  buildChain,
  buildLeg,
  buildSpoke,
  chainLegProgress,
  chainMidpoint,
  circleLine,
  distanceKm,
  legsBbox,
  partialLine,
  pointAlong,
  pointsBbox,
  toLngLat,
  type Chain,
} from "./geo";
import { buildTimeline, progress, segmentAt, type Timeline } from "./timeline";
import type {
  Camera,
  CameraSettings,
  Leg,
  LngLat,
  Segment,
  StepsFile,
  Timing,
  TravelMode,
} from "./types";

/*
 * Scène : fonction pure (contexte + frame) → tout ce qui doit être affiché.
 * Les overlays et la carte ne font que dessiner cet état. Les titres des
 * transits n'y apparaissent jamais (vérifié par le test).
 */

export type Viewport = { width: number; height: number };

export type SceneLine = {
  feature: GeoJSON.Feature<GeoJSON.LineString>;
  mode: TravelMode;
  /** Tracé en train de se dessiner (reçoit la traînée lumineuse). */
  active: boolean;
  /** `route` : tracé du produit ; `spoke` : trait fin ferme → atelier ; `circle` : rayon. */
  style: "route" | "spoke" | "circle";
};

export type Card = {
  /** Chapeau dérivé du rôle du plan (« D'où ça vient », « Ferme 1 / 3 »…). */
  chapter: string;
  personName: string | null;
  title: string;
  caption: string | null;
  /** « Guji, Éthiopie » : `place` + nom du pays traduit (Intl.DisplayNames). */
  location: string | null;
  photo: string | null;
  /** Héros (premier / dernier actor) : photo grand format. */
  large: boolean;
  start: number;
  end: number;
};

export type SceneState = {
  segment: Segment;
  camera: Camera;
  lines: SceneLine[];
  points: { step: number; active: boolean; appearFrame: number }[];
  card: Card | null;
  /** Une seule ligne au milieu de l'arc de transit (origine). */
  transitLine: { text: string; anchor: LngLat; start: number; end: number } | null;
  /** Terroir : mention du rayon. */
  radiusLine: { text: string; start: number; end: number } | null;
  intro: { subtitle: string; start: number; end: number } | null;
  ending: { start: number; end: number } | null;
  /** Tête du tracé pendant un vol (véhicule). */
  head: { lngLat: LngLat; mode: TravelMode } | null;
  /** Codes ISO des pays des actors déjà atteints. */
  reachedCountries: string[];
};

export type SceneContext = {
  file: StepsFile;
  timing: Timing;
  cam: CameraSettings;
  viewport: Viewport;
  /** Langue des noms de pays. */
  locale: string;
  timeline: Timeline;
  /** Caméra d'arrêt de chaque étape (actors seulement pour origine). */
  holdCameras: (Camera | null)[];
  /** Origine : chaîne de tronçons de chaque segment transit (clé = start). */
  chains: Map<number, Chain>;
  /** Origine : tronçon direct actor → actor consécutifs (clé = actor d'arrivée). */
  directLegs: Map<number, Leg>;
  /** Terroir. */
  terroir: {
    atelier: number;
    radiusKm: number;
    radiusCamera: Camera;
    circle: GeoJSON.Feature<GeoJSON.LineString>;
    spokes: Map<number, Leg>;
  } | null;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const buildSceneContext = (
  file: StepsFile,
  timing: Timing,
  cam: CameraSettings,
  viewport: Viewport,
  locale: string = DEFAULT_LOCALE,
): SceneContext => {
  const { steps } = file;
  const timeline = buildTimeline(file, timing);
  const chains = new Map<number, Chain>();
  const directLegs = new Map<number, Leg>();
  const holdCameras: (Camera | null)[] = steps.map(() => null);
  let terroir: SceneContext["terroir"] = null;

  if (file.narrative === "terroir") {
    const atelier = steps.length - 1;
    const center = toLngLat(steps[atelier]);
    const maxKm = Math.max(
      ...steps.slice(0, atelier).map((s) => distanceKm(center, toLngLat(s))),
    );
    const radiusKm = Math.max(RADIUS_ROUND_KM, Math.ceil(maxKm / RADIUS_ROUND_KM) * RADIUS_ROUND_KM);
    const circle = circleLine(center, radiusKm);
    const bbox = legsBbox([{ line: circle } as Leg]);
    const radiusZoom = zoomForBounds(bbox, viewport.width, viewport.height, cam.flightPaddingPx, 18);
    const radiusCamera: Camera = { center, zoom: radiusZoom };
    const spokes = new Map<number, Leg>();
    steps.forEach((s, i) => {
      if (i === atelier) {
        holdCameras[i] = radiusCamera;
      } else {
        holdCameras[i] = { center: toLngLat(s), zoom: radiusZoom + cam.farmZoomOffset };
        spokes.set(i, buildSpoke(steps, i, atelier));
      }
    });
    terroir = { atelier, radiusKm, radiusCamera, circle, spokes };
  } else {
    const actors = steps.map((s, i) => (s.kind === "actor" ? i : -1)).filter((i) => i >= 0);
    actors.forEach((i, k) => {
      const step = steps[i];
      const isLast = k === actors.length - 1;
      const neighbours = [steps[i - 1], steps[i + 1]]
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .map((s) => distanceKm(toLngLat(step), toLngLat(s)));
      const contextKm = isLast || step.final ? 0 : Math.min(...neighbours);
      holdCameras[i] = {
        center: toLngLat(step),
        zoom: zoomForContext(contextKm, cam.zoomCity, cam.zoomWorld),
      };
    });
    for (const seg of timeline.segments) {
      if (seg.kind === "transit") chains.set(seg.start, buildChain(steps, seg.from, seg.to));
      if (seg.kind === "actor" && seg.role !== "first") {
        const prev = seg.step - 1;
        if (steps[prev]?.kind === "actor") directLegs.set(seg.step, buildLeg(steps, prev));
      }
    }
  }

  return { file, timing, cam, viewport, locale, timeline, holdCameras, chains, directLegs, terroir };
};

const cameraOf = (ctx: SceneContext, step: number): Camera =>
  ctx.holdCameras[step] ?? { center: toLngLat(ctx.file.steps[step]), zoom: ctx.cam.zoomCity };

/** Caméra de région qui cadre toute la chaîne de transit. */
const transitCamera = (ctx: SceneContext, chain: Chain): Camera => {
  const [w, s, e, n] = legsBbox(chain.legs);
  const zoom = zoomForBounds(
    [w, s, e, n],
    ctx.viewport.width,
    ctx.viewport.height,
    ctx.cam.flightPaddingPx,
    ctx.cam.zoomCity,
  );
  return { center: [(w + e) / 2, (s + n) / 2], zoom };
};

/** Caméra à la fin du segment précédent (point de départ d'un vol). */
const cameraBefore = (ctx: SceneContext, segment: Segment): Camera => {
  const idx = ctx.timeline.segments.indexOf(segment);
  const prev = ctx.timeline.segments[idx - 1];
  if (!prev) return cameraAtSegmentEnd(ctx, segment);
  return cameraAtSegmentEnd(ctx, prev);
};

const cameraAtSegmentEnd = (ctx: SceneContext, segment: Segment): Camera => {
  switch (segment.kind) {
    case "actor":
      return cameraOf(ctx, segment.step);
    case "transit":
      return transitCamera(ctx, ctx.chains.get(segment.start)!);
    case "radius":
    case "intro":
      return ctx.terroir
        ? ctx.terroir.radiusCamera
        : cameraOf(ctx, firstActor(ctx));
    case "ending":
      return cameraOf(ctx, ctx.file.steps.length - 1);
  }
};

const firstActor = (ctx: SceneContext) =>
  ctx.file.steps.findIndex((s) => s.kind === "actor");

const flyBetween = (ctx: SceneContext, from: Camera, to: Camera, t: number): Camera => {
  const bbox = pointsBbox([from.center, to.center]);
  const minZoom = Math.min(
    from.zoom,
    to.zoom,
    zoomForBounds(bbox, ctx.viewport.width, ctx.viewport.height, ctx.cam.flightPaddingPx, to.zoom),
  );
  return flyToAt(from, to, easeInOutCubic(t), ctx.viewport, { minZoom });
};

const cameraAt = (ctx: SceneContext, segment: Segment, frame: number): Camera => {
  switch (segment.kind) {
    case "intro":
    case "radius":
    case "ending":
      return cameraAtSegmentEnd(ctx, segment);
    case "actor": {
      const target = cameraOf(ctx, segment.step);
      if (frame >= segment.flightEnd || segment.flightEnd === segment.start) return target;
      return flyBetween(
        ctx,
        cameraBefore(ctx, segment),
        target,
        progress(segment.start, segment.flightEnd, frame),
      );
    }
    case "transit": {
      const target = transitCamera(ctx, ctx.chains.get(segment.start)!);
      const from = cameraBefore(ctx, segment);
      // Dézoom vers la région : le vol se termine un peu avant la fin du
      // segment pour laisser l'arc finir de se dessiner sur une vue stable.
      const t = progress(segment.start, segment.start + (segment.end - segment.start) * 0.7, frame);
      return flyToAt(from, target, easeInOutCubic(t), ctx.viewport, { minZoom: target.zoom });
    }
  }
};

/** Nom du pays dans la langue demandée (« ET » → « Éthiopie »), sans liste en dur. */
export const countryName = (iso: string, locale: string): string => {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(iso) ?? iso;
  } catch {
    return iso;
  }
};

const locationOf = (ctx: SceneContext, step: StepsFile["steps"][number]): string | null => {
  const parts = [step.place, step.country ? countryName(step.country, ctx.locale) : null].filter(
    (p): p is string => Boolean(p),
  );
  return parts.length ? parts.join(", ") : null;
};

const chapterOf = (ctx: SceneContext, segment: Extract<Segment, { kind: "actor" }>): string => {
  const lines = CHAPTER_LINES[ctx.file.narrative];
  const template = lines[segment.role];
  const farms = ctx.file.steps.length - 1;
  return template.replace("{i}", String(segment.step + 1)).replace("{n}", String(farms));
};

const cardFor = (ctx: SceneContext, segment: Extract<Segment, { kind: "actor" }>): Card => {
  const step = ctx.file.steps[segment.step];
  const fade = Math.round(ctx.timing.cardFadeSeconds * ctx.timing.fps);
  return {
    chapter: chapterOf(ctx, segment),
    personName: step.personName ?? null,
    title: step.title,
    caption: step.caption ?? null,
    location: locationOf(ctx, step),
    photo: step.photo ?? null,
    large: segment.role !== "middle",
    start: segment.flightEnd,
    // Disparu `cardFadeSeconds` avant le vol suivant.
    end: segment.end - fade,
  };
};

const transitText = (file: StepsFile): string | null => {
  const inner =
    typeof file.intermediariesCount === "number"
      ? INTERMEDIARIES_LINE.replace("{n}", String(file.intermediariesCount))
      : file.sourcingLine || null;
  return inner ? TRANSIT_LINE.replace("{text}", inner) : null;
};

export const sceneAt = (ctx: SceneContext, frame: number): SceneState => {
  const { file, timing, timeline } = ctx;
  const { steps } = file;
  const segment = segmentAt(timeline, frame);
  const fade = Math.round(timing.cardFadeSeconds * timing.fps);
  const camera = cameraAt(ctx, segment, frame);
  const lines: SceneLine[] = [];
  const points: SceneState["points"] = [];
  let head: SceneState["head"] = null;
  let card: Card | null = null;
  let transitLine: SceneState["transitLine"] = null;
  let radiusLine: SceneState["radiusLine"] = null;

  const activeStep =
    segment.kind === "actor"
      ? segment.step
      : segment.kind === "ending"
        ? steps.length - 1
        : -1;

  if (ctx.terroir) {
    const { atelier, radiusKm, circle, spokes } = ctx.terroir;
    const radius = timeline.segments.find((s) => s.kind === "radius")!;
    // Cercle : se dessine pendant la première moitié de la vue rayon, puis reste.
    const circleProgress = easeInOutCubic(progress(radius.start, radius.start + (radius.end - radius.start) / 2, frame));
    const circlePartial = partialLine({ line: circle, lengthKm: 2 * Math.PI * radiusKm } as Leg, circleProgress);
    if (circlePartial) lines.push({ feature: circlePartial, mode: "land", active: false, style: "circle" });
    if (frame >= radius.start + fade && frame < radius.end) {
      radiusLine = {
        text: RADIUS_LINE.replace("{km}", String(radiusKm)),
        start: radius.start + fade,
        end: radius.end,
      };
    }
    // Les fermes s'allument une à une pendant la vue rayon ; l'atelier dès le début.
    const farms = steps.length - 1;
    steps.forEach((_, i) => {
      const appearFrame =
        i === atelier
          ? radius.start
          : radius.start + Math.round(((i + 1) / (farms + 1)) * (radius.end - radius.start) * 0.8);
      if (frame >= appearFrame) points.push({ step: i, active: i === activeStep, appearFrame });
    });
    // Rayon ferme → atelier : apparaît quand on quitte la ferme (vol du segment suivant).
    const actorSegs = timeline.segments.filter((s) => s.kind === "actor");
    actorSegs.forEach((seg, k) => {
      if (seg.kind !== "actor" || seg.step === atelier) return;
      const next = actorSegs[k + 1];
      if (!next || next.kind !== "actor") return;
      const p = easeInOutCubic(progress(next.start, next.flightEnd, frame));
      const partial = partialLine(spokes.get(seg.step)!, p);
      if (partial) lines.push({ feature: partial, mode: "land", active: false, style: "spoke" });
    });
    if (segment.kind === "actor" && frame >= segment.flightEnd && frame < segment.end - fade) {
      card = cardFor(ctx, segment);
    }
  } else {
    // Origine : tronçons directs actor → actor, dessinés pendant le vol d'entrée.
    for (const seg of timeline.segments) {
      if (seg.kind !== "actor") continue;
      const leg = ctx.directLegs.get(seg.step);
      if (!leg) continue;
      const p = easeInOutCubic(progress(seg.start, seg.flightEnd, frame));
      const partial = partialLine(leg, p);
      const active = segment === seg && frame < seg.flightEnd && p > 0 && p < 1;
      if (partial) lines.push({ feature: partial, mode: leg.mode, active, style: "route" });
      if (active) head = { lngLat: pointAlong(leg, p), mode: leg.mode };
    }
    // Un seul arc continu à travers tous les transits, dessiné en accéléré.
    for (const seg of timeline.segments) {
      if (seg.kind !== "transit") continue;
      const chain = ctx.chains.get(seg.start)!;
      const p = easeInOutCubic(progress(seg.start, seg.end, frame));
      const per = chainLegProgress(chain, p);
      chain.legs.forEach((leg, i) => {
        const partial = partialLine(leg, per[i]);
        const active = segment === seg && per[i] > 0 && per[i] < 1;
        if (partial) lines.push({ feature: partial, mode: leg.mode, active, style: "route" });
        if (active) head = { lngLat: pointAlong(leg, per[i]), mode: leg.mode };
      });
      if (segment === seg) {
        const text = transitText(file);
        const start = seg.start + Math.round((seg.end - seg.start) * 0.35);
        if (text && frame >= start && frame < seg.end - fade) {
          transitLine = { text, anchor: chainMidpoint(chain), start, end: seg.end - fade };
        }
      }
    }
    // Points : les actors atteints, jamais les transits.
    for (const seg of timeline.segments) {
      if (seg.kind !== "actor" || frame < seg.flightEnd) continue;
      points.push({ step: seg.step, active: seg.step === activeStep, appearFrame: seg.flightEnd });
    }
    if (segment.kind === "actor" && frame >= segment.flightEnd && frame < segment.end - fade) {
      card = cardFor(ctx, segment);
    }
  }

  const intro = timeline.segments[0];
  const ending = timeline.segments[timeline.segments.length - 1];
  const reachedCountries = Array.from(
    new Set(points.map((p) => steps[p.step].country).filter((c): c is string => Boolean(c))),
  );

  return {
    segment,
    camera,
    lines,
    points,
    card,
    transitLine,
    radiusLine,
    intro:
      intro.kind === "intro" && frame < intro.end
        ? {
            subtitle: INTRO_SUBTITLE[file.narrative].replace("{product}", file.product),
            start: intro.start,
            end: intro.end,
          }
        : null,
    ending: ending.kind === "ending" && frame >= ending.start ? { start: ending.start, end: ending.end } : null,
    head,
    reachedCountries,
  };
};

/** Utilitaire de test / debug : toutes les chaînes de caractères d'un état. */
export const sceneStrings = (state: SceneState): string[] => {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk({ ...state, lines: undefined });
  return out;
};

export { clamp01 };
