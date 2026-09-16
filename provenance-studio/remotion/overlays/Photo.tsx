import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { useLayout } from "./layout";

type Props = { src: string; start: number; end: number };

/** Photo bas-droit, coins arrondis 16 px, ombre douce. Même fenêtre que le cartouche. */
export const Photo = ({ src, start, end }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout();
  const fade = Math.round(fps * 0.3);
  const opacity = interpolate(frame, [start, start + fade, end - fade, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [start, start + fade], [0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        right: L.margin,
        bottom: L.margin,
        width: L.photoWidth,
        height: L.photoHeight,
        borderRadius: L.radius,
        overflow: "hidden",
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "bottom right",
        boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
      }}
    >
      <Img
        src={src}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
};
