import { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { toScreen } from "./camera";
import { Cartouche } from "./overlays/Cartouche";
import { Ending } from "./overlays/Ending";
import { Intro } from "./overlays/Intro";
import { Photo } from "./overlays/Photo";
import { Pulse } from "./overlays/Pulse";
import { Watermark } from "./overlays/Watermark";
import { FallbackMapScene } from "./scenes/FallbackMapScene";
import { MapboxScene } from "./scenes/MapboxScene";
import { buildTimeline, cameraAt, legProgressAt, phaseAt } from "./timeline";
import type { VideoProps } from "./types";

const MUSIC_GAIN_DB = -18;
const dbToGain = (db: number) => Math.pow(10, db / 20);

/** URL absolue telle quelle, sinon fichier de `remotion/assets`. */
const asset = (src: string | null) =>
  src ? (/^https?:\/\//.test(src) || src.startsWith("data:") ? src : staticFile(src)) : null;

export const ProvenanceVideo = ({ product, steps, brand, watermark, mapboxToken }: VideoProps) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const color = brand.color;

  const timeline = useMemo(() => buildTimeline(steps, fps), [steps, fps]);
  const camera = cameraAt(timeline, frame, { width, height }, fps);
  const legProgress = legProgressAt(timeline, frame);
  const phase = phaseAt(timeline, frame);
  const holds = timeline.phases.filter(
    (p): p is Extract<typeof p, { kind: "hold" }> => p.kind === "hold",
  );
  const intro = timeline.phases[0];
  const ending = timeline.phases[timeline.phases.length - 1];
  const currentStep =
    phase.kind === "travel"
      ? timeline.legs[phase.leg].from
      : phase.kind === "intro"
        ? -1
        : phase.step;

  // Intro : carte floue et assombrie, puis mise au point sur la première étape.
  const blur = interpolate(frame, [intro.end - fps * 0.9, intro.end], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const introVeil = interpolate(frame, [intro.end - fps * 0.9, intro.end], [0.45, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoSrc = asset(brand.logoUrl);
  const cartoucheDelay = Math.round(fps * 0.3);

  const musicVolume = (f: number) =>
    dbToGain(MUSIC_GAIN_DB) *
    interpolate(f, [0, fps * 1.5, durationInFrames - fps * 2, durationInFrames], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  return (
    <AbsoluteFill style={{ background: "#0c0d0f" }}>
      <AbsoluteFill
        style={{
          filter: blur > 0.2 ? `blur(${blur}px)` : undefined,
          transform: blur > 0.2 ? "scale(1.04)" : undefined,
        }}
      >
        {mapboxToken ? (
          <MapboxScene
            token={mapboxToken}
            camera={camera}
            legs={timeline.legs}
            legProgress={legProgress}
            color={color}
          />
        ) : (
          <FallbackMapScene
            camera={camera}
            legs={timeline.legs}
            legProgress={legProgress}
            color={color}
          />
        )}
      </AbsoluteFill>
      {introVeil > 0 ? (
        <AbsoluteFill style={{ background: `rgba(8, 9, 11, ${introVeil})` }} />
      ) : null}

      {/* Points des étapes atteintes ; l'étape courante pulse. */}
      {frame >= intro.end
        ? steps.map((step, i) => {
            const hold = holds[i];
            if (!hold || frame < hold.start) return null;
            const [x, y] = toScreen([step.lng, step.lat], camera, width, height);
            if (x < -100 || x > width + 100 || y < -100 || y > height + 100) return null;
            const active =
              i === currentStep || (phase.kind === "ending" && i === phase.step) ? 1 : 0;
            return (
              <Pulse
                key={i}
                x={x}
                y={y}
                color={color}
                active={active}
                appearFrame={hold.start}
                scale={Math.min(width, height) / 1080}
              />
            );
          })
        : null}

      {/* Cartouche + photo pendant l'arrêt (apparition 300 ms après l'arrivée, disparition 300 ms avant le vol suivant). */}
      {steps.map((step, i) => {
        const hold = holds[i];
        if (!hold || frame < hold.start || frame >= hold.end) return null;
        const start = hold.start + cartoucheDelay;
        const end = hold.end;
        const photo = asset(step.photoUrl);
        return (
          <div key={i}>
            <Cartouche
              title={step.title}
              caption={step.caption}
              color={color}
              start={start}
              end={end}
            />
            {photo ? <Photo src={photo} start={start} end={end} /> : null}
          </div>
        );
      })}

      {frame < intro.end ? (
        <Intro
          brandName={brand.name}
          logoSrc={logoSrc}
          productName={product.name}
          start={intro.start}
          end={intro.end}
        />
      ) : null}

      {ending.kind === "ending" && frame >= ending.start ? (
        <Ending
          brandName={brand.name}
          logoSrc={logoSrc}
          endLine={product.endLine}
          start={ending.start}
          zoomInSeconds={1.2}
        />
      ) : null}

      {watermark ? <Watermark /> : null}

      <Audio src={staticFile("music.mp3")} loop volume={musicVolume} />
    </AbsoluteFill>
  );
};
