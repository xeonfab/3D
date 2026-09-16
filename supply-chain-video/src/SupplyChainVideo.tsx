import { useMemo } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { toScreen } from "./camera";
import { dbToGain, resolveCamera, resolveTiming } from "./data";
import { DEFAULT_MUSIC_FILE, DEFAULT_MUSIC_GAIN_DB } from "./defaults";
import { buildLegs, pointAlong } from "./geo";
import { MapScene } from "./MapScene";
import { Cartouche } from "./overlays/Cartouche";
import { Ending } from "./overlays/Ending";
import { Photo } from "./overlays/Photo";
import { Pulse } from "./overlays/Pulse";
import { buildTimeline, cameraAt, legProgressAt, phaseAt } from "./timeline";
import type { VideoProps } from "./types";

export const SupplyChainVideo = ({ stepsFile, brand }: VideoProps) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { steps, product } = stepsFile;
  const color = brand.color;

  const timing = useMemo(() => resolveTiming(stepsFile), [stepsFile]);
  const camSettings = useMemo(() => resolveCamera(stepsFile), [stepsFile]);
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

  return (
    <AbsoluteFill style={{ background: "#0b0b0e" }}>
      <MapScene camera={camera} legs={legs} legProgress={legProgress} color={color} />

      {/* Points des étapes déjà atteintes (dont l'étape courante, pulsante). */}
      {steps.map((step, i) => {
        const hold = holdPhases[i];
        if (hold.kind !== "hold" || frame < hold.start) return null;
        const [x, y] = toScreen([step.lng, step.lat], camera, width, height);
        if (x < -100 || x > width + 100 || y < -100 || y > height + 100) return null;
        const active = i === currentStep || (phase.kind === "ending" && i === phase.step) ? 1 : 0;
        return (
          <Pulse
            key={i}
            x={x}
            y={y}
            color={color}
            active={active}
            appearFrame={hold.start}
          />
        );
      })}

      {/* Tête du tracé en cours de vol. */}
      {phase.kind === "travel" &&
        (() => {
          const leg = legs[phase.leg];
          const head = pointAlong(leg, legProgress[phase.leg]);
          const [x, y] = toScreen(head, camera, width, height);
          return <Pulse x={x} y={y} color={color} active={0} appearFrame={phase.start} />;
        })()}

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
