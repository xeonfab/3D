import { distance as turfDistance, point } from "@turf/turf";
import type mapboxgl from "mapbox-gl";
import { useCallback, useMemo, useRef, useState } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { toScreen } from "./camera";
import { dbToGain, resolveCamera, resolveLook, resolveTiming } from "./data";
import { DEFAULT_MUSIC_FILE, DEFAULT_MUSIC_GAIN_DB, GLOBE_HIDE_KM } from "./defaults";
import { buildLegs, pointAlong } from "./geo";
import { MapScene } from "./MapScene";
import { Cartouche } from "./overlays/Cartouche";
import { Ending } from "./overlays/Ending";
import { useLayout } from "./overlays/layout";
import { Photo } from "./overlays/Photo";
import { Pulse } from "./overlays/Pulse";
import { Vehicle } from "./overlays/Vehicle";
import { buildTimeline, cameraAt, legProgressAt, phaseAt } from "./timeline";
import type { LngLat, VideoProps } from "./types";

export const SupplyChainVideo = ({ stepsFile, brand }: VideoProps) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const L = useLayout();
  const { steps, product } = stepsFile;
  const color = brand.color;

  const timing = useMemo(() => resolveTiming(stepsFile), [stepsFile]);
  const camSettings = useMemo(() => resolveCamera(stepsFile), [stepsFile]);
  const look = useMemo(() => resolveLook(brand), [brand]);
  const legs = useMemo(() => buildLegs(steps), [steps]);
  const timeline = useMemo(
    () => buildTimeline(steps, legs, timing, camSettings),
    [steps, legs, timing, camSettings],
  );

  const musicGain = dbToGain(brand.musicGainDb ?? DEFAULT_MUSIC_GAIN_DB);
  const viewport = { width, height };
  const camera = cameraAt(timeline, legs, frame, viewport, camSettings);
  const legProgress = legProgressAt(timeline, legs, frame);
  const phase = phaseAt(timeline, frame);

  // Étape courante (pendant un vol : celle de départ, jusqu'à l'arrivée).
  const currentStep = phase.kind === "travel" ? legs[phase.leg].from : phase.step;
  const holdPhases = timeline.phases.filter((p) => p.kind === "hold");
  const ending = timeline.phases.find((p) => p.kind === "ending");

  // Pays déjà atteints (teinte de marque) : ceux des étapes jusqu'à la courante.
  const reachedCountries = useMemo(
    () =>
      Array.from(
        new Set(
          steps
            .slice(0, currentStep + 1)
            .map((s) => s.country)
            .filter((c): c is string => Boolean(c)),
        ),
      ),
    [steps, currentStep],
  );

  /*
   * Projection des overlays : en projection globe, la position écran d'un
   * point n'est plus une simple formule Mercator ; on demande donc à la
   * carte (`map.project`) après le `jumpTo` de la frame. `appliedFrame`
   * force un nouveau rendu des overlays une fois la caméra positionnée.
   */
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [appliedFrame, setAppliedFrame] = useState(-1);
  const onReady = useCallback((map: mapboxgl.Map) => {
    mapRef.current = map;
  }, []);
  const onFrameApplied = useCallback((f: number) => setAppliedFrame(f), []);

  const project = (lngLat: LngLat): [number, number] | null => {
    const map = mapRef.current;
    if (map && appliedFrame === frame) {
      // Derrière le globe : invisible.
      if (
        look.globe &&
        turfDistance(point(camera.center), point(lngLat), { units: "kilometers" }) >
          GLOBE_HIDE_KM
      ) {
        return null;
      }
      const p = map.project(lngLat);
      return [p.x, p.y];
    }
    return toScreen(lngLat, camera, width, height);
  };
  const onScreen = (p: [number, number] | null): p is [number, number] =>
    p !== null && p[0] > -100 && p[0] < width + 100 && p[1] > -100 && p[1] < height + 100;

  // Tête du tracé pendant un vol : position + sens du déplacement.
  const head = (() => {
    if (phase.kind !== "travel") return null;
    const leg = legs[phase.leg];
    const t = legProgress[phase.leg];
    const now = project(pointAlong(leg, t));
    const before = project(pointAlong(leg, Math.max(0, t - 0.01)));
    if (!onScreen(now)) return null;
    const dirX = before ? Math.sign(now[0] - before[0]) || 1 : 1;
    return { x: now[0], y: now[1], dirX, mode: leg.mode };
  })();

  return (
    <AbsoluteFill style={{ background: "#0b0b0e" }}>
      <MapScene
        camera={camera}
        legs={legs}
        legProgress={legProgress}
        color={color}
        look={look}
        reachedCountries={reachedCountries}
        onReady={onReady}
        onFrameApplied={onFrameApplied}
      />

      {/* Points des étapes déjà atteintes (dont l'étape courante, pulsante). */}
      {steps.map((step, i) => {
        const hold = holdPhases[i];
        if (hold.kind !== "hold" || frame < hold.start) return null;
        const p = project([step.lng, step.lat]);
        if (!onScreen(p)) return null;
        const active = i === currentStep || (phase.kind === "ending" && i === phase.step) ? 1 : 0;
        return (
          <Pulse
            key={i}
            x={p[0]}
            y={p[1]}
            color={color}
            active={active}
            appearFrame={hold.start}
          />
        );
      })}

      {/* Tête du tracé en cours de vol : véhicule ou simple point. */}
      {head && phase.kind === "travel" ? (
        look.vehicle ? (
          <Vehicle
            x={head.x}
            y={head.y}
            dirX={head.dirX}
            mode={head.mode}
            color={color}
            size={L.vehicleSize}
          />
        ) : (
          <Pulse x={head.x} y={head.y} color={color} active={0} appearFrame={phase.start} />
        )
      ) : null}

      {/* Cartouche + photo pendant l'arrêt sur chaque étape. */}
      {steps.map((step, i) => {
        const hold = holdPhases[i];
        if (hold.kind !== "hold" || frame < hold.start || frame >= hold.end) return null;
        return (
          <div key={i}>
            <Cartouche
              title={step.title}
              caption={step.caption}
              color={color}
              index={i}
              total={steps.length}
              start={hold.start}
              end={hold.end}
            />
            {step.photo ? <Photo file={step.photo} start={hold.start} end={hold.end} /> : null}
          </div>
        );
      })}

      {ending && frame >= ending.start ? (
        <Ending brand={brand} product={product} start={ending.start} />
      ) : null}

      {/* Musique de fond : gain constant (dB → linéaire), défini dans brand.json. */}
      <Audio
        src={staticFile(brand.music ?? DEFAULT_MUSIC_FILE)}
        volume={() => musicGain}
      />
    </AbsoluteFill>
  );
};
