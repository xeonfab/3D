import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { SANS } from "../fonts";
import { useLayout } from "./layout";

type Props = {
  title: string;
  caption: string;
  color: string;
  /** Fenêtre d'affichage (frames), fondus de 300 ms inclus. */
  start: number;
  end: number;
};

/** Cartouche bas-gauche : titre en gras, légende dessous. */
export const Cartouche = ({ title, caption, color, start, end }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout();
  const fade = Math.round(fps * 0.3);
  const opacity = interpolate(frame, [start, start + fade, end - fade, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const slide = interpolate(frame, [start, start + fade], [18, 0], {
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
        fontFamily: SANS,
        color: "white",
        background: "rgba(12, 13, 15, 0.72)",
        backdropFilter: "blur(12px)",
        borderRadius: L.radius,
        borderLeft: `${6 * L.u}px solid ${color}`,
        padding: `${L.pad * 0.9}px ${L.pad * 1.1}px`,
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ fontSize: L.titleFont, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.5 }}>
        {title}
      </div>
      {caption ? (
        <div
          style={{
            fontSize: L.captionFont,
            lineHeight: 1.3,
            marginTop: L.pad * 0.35,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
};
