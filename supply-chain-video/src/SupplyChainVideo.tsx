import { distance as turfDistance, point } from "@turf/turf";
import type mapboxgl from "mapbox-gl";
import { useCallback, useMemo, useRef, useState } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { toScreen } from "./camera";
import { dbToGain, resolveCamera, resolveLook, resolveTiming } from "./data";
import { DEFAULT_MUSIC_FILE, DEFAULT_MUSIC_GAIN_DB, GLOBE_HIDE_KM } from "./defaults";
import { MapScene } from "./MapScene";
import { OfflineMap } from "./OfflineMap";
import { Card } from "./overlays/Card";
import { Ending } from "./overlays/Ending";
import { Intro } from "./overlays/Intro";
import { useLayout } from "./overlays/layout";
import { Photo } from "./overlays/Photo";
import { Pulse } from "./overlays/Pulse";
import { RadiusLine } from "./overlays/RadiusLine";
import { TransitLine } from "./overlays/TransitLine";
import { Vehicle } from "./overlays/Vehicle";
import { buildSceneContext, sceneAt } from "./scene";
import type { LngLat, VideoProps } from "./types";

/** Sans token / réseau : fond Natural Earth en SVG (REMOTION_MAP_OFFLINE=1). */
const OFFLINE = process.env.REMOTION_MAP_OFFLINE === "1";

export const SupplyChainVideo = ({ stepsFile, brand }: VideoProps) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const L = useLayout();

  const ctx = useMemo(
    () =>
      stepsFile
        ? buildSceneContext(stepsFile, resolveTiming(stepsFile), resolveCamera(stepsFile), {
            width,
            height,
          })
        : null,
    [stepsFile, width, height],
  );
  const look = useMemo(() => (brand ? resolveLook(brand) : null), [brand]);

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

  if (!ctx || !stepsFile || !brand || !look) return <AbsoluteFill style={{ background: "#0b0b0e" }} />;

  const scene = sceneAt(ctx, frame);
  const { camera } = scene;
  const color = brand.color;
  const { steps } = stepsFile;
  const musicGain = dbToGain(brand.musicGainDb ?? DEFAULT_MUSIC_GAIN_DB);

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

  const headPos = scene.head ? project(scene.head.lngLat) : null;
  const prevHead =
    scene.head && frame > 0 ? sceneAt(ctx, frame - 1).head : null;
  const prevHeadPos = prevHead ? project(prevHead.lngLat) : null;
  const dirX = headPos && prevHeadPos ? Math.sign(headPos[0] - prevHeadPos[0]) || 1 : 1;
  const transitPos = scene.transitLine ? project(scene.transitLine.anchor) : null;

  return (
    <AbsoluteFill style={{ background: "#0b0b0e" }}>
      {OFFLINE ? (
        <OfflineMap camera={camera} lines={scene.lines} color={color} />
      ) : (
        <MapScene
          camera={camera}
          lines={scene.lines}
          color={color}
          look={look}
          reachedCountries={scene.reachedCountries}
          onReady={onReady}
          onFrameApplied={onFrameApplied}
        />
      )}

      {/* Points des actors atteints (le courant pulse). */}
      {scene.points.map((pt) => {
        const step = steps[pt.step];
        const p = project([step.lng, step.lat]);
        if (!onScreen(p)) return null;
        return (
          <Pulse
            key={pt.step}
            x={p[0]}
            y={p[1]}
            color={color}
            active={pt.active ? 1 : 0}
            appearFrame={pt.appearFrame}
          />
        );
      })}

      {/* Tête du tracé pendant un vol : véhicule (ou point si désactivé). */}
      {scene.head && onScreen(headPos) ? (
        look.vehicle ? (
          <Vehicle
            x={headPos[0]}
            y={headPos[1]}
            dirX={dirX}
            mode={scene.head.mode}
            color={color}
            size={L.vehicleSize}
          />
        ) : (
          <Pulse x={headPos[0]} y={headPos[1]} color={color} active={0} appearFrame={0} />
        )
      ) : null}

      {scene.card ? (
        <>
          {scene.card.photo ? (
            <Photo
              file={scene.card.photo}
              large={scene.card.large}
              start={scene.card.start}
              end={scene.card.end}
            />
          ) : null}
          <Card card={scene.card} color={color} />
        </>
      ) : null}

      {scene.transitLine && onScreen(transitPos) ? (
        <TransitLine
          text={scene.transitLine.text}
          x={transitPos[0]}
          y={transitPos[1]}
          color={color}
          start={scene.transitLine.start}
          end={scene.transitLine.end}
        />
      ) : null}

      {scene.radiusLine ? (
        <RadiusLine
          text={scene.radiusLine.text}
          color={color}
          start={scene.radiusLine.start}
          end={scene.radiusLine.end}
        />
      ) : null}

      {scene.intro ? (
        <Intro
          brand={brand}
          subtitle={scene.intro.subtitle}
          start={scene.intro.start}
          end={scene.intro.end}
        />
      ) : null}

      {scene.ending ? <Ending brand={brand} start={scene.ending.start} /> : null}

      {/* Musique de fond : gain constant (dB → linéaire), défini dans brand.json. */}
      <Audio
        src={staticFile(brand.music ?? DEFAULT_MUSIC_FILE)}
        volume={() => musicGain}
      />
    </AbsoluteFill>
  );
};
