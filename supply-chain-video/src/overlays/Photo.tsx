import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayout } from "./layout";

type Props = {
  file: string;
  start: number;
  end: number;
};

/** Photo de l'étape, coin bas droit, coins arrondis. */
export const Photo = ({ file, start, end }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout();

  const opacity = interpolate(
    frame,
    [start + fps * 0.15, start + fps * 0.55, end - fps * 0.3, end],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const scale = interpolate(frame, [start, start + fps * 0.55], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        right: L.margin,
        bottom: L.photoBottom,
        width: L.photoSize,
        height: L.photoSize,
        borderRadius: L.radius,
        overflow: "hidden",
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "bottom right",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        border: "3px solid rgba(255,255,255,0.85)",
      }}
    >
      <Img
        src={staticFile(file)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
};
