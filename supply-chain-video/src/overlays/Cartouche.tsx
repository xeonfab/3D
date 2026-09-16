import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, useLayout } from "./layout";

type Props = {
  title: string;
  caption: string;
  color: string;
  index: number;
  total: number;
  /** Frames de début / fin de l'affichage (fondu géré ici). */
  start: number;
  end: number;
};

/** Cartouche titre + légende de l'étape courante. */
export const Cartouche = ({ title, caption, color, index, total, start, end }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout();

  const fadeIn = fps * 0.4;
  const fadeOut = fps * 0.3;
  const opacity = interpolate(
    frame,
    [start, start + fadeIn, end - fadeOut, end],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const slide = interpolate(frame, [start, start + fadeIn], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: L.margin,
        bottom: L.margin,
        maxWidth: L.cartoucheWidth,
        opacity,
        transform: `translateY(${slide}px)`,
        fontFamily: FONT_FAMILY,
        color: "white",
        background: "rgba(12, 12, 16, 0.78)",
        backdropFilter: "blur(10px)",
        borderRadius: L.radius,
        borderLeft: `${L.accent}px solid ${color}`,
        padding: `${L.pad}px ${L.pad * 1.2}px`,
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
      }}
    >
      <div
        style={{
          fontSize: L.smallFont,
          letterSpacing: 2,
          textTransform: "uppercase",
          color,
          fontWeight: 700,
          marginBottom: L.pad * 0.35,
        }}
      >
        Étape {index + 1} / {total}
      </div>
      <div style={{ fontSize: L.titleFont, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
      <div
        style={{
          fontSize: L.captionFont,
          lineHeight: 1.3,
          marginTop: L.pad * 0.4,
          color: "rgba(255,255,255,0.82)",
        }}
      >
        {caption}
      </div>
    </div>
  );
};
