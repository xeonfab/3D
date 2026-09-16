import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Brand } from "../types";
import { FONT_FAMILY, useLayout } from "./layout";

type Props = { brand: Brand; subtitle: string; start: number; end: number };

/** Intro : carte assombrie, logo en fondu, sous-titre (« Qui fait … » / « Tout vient d'ici »). */
export const Intro = ({ brand, subtitle, start, end }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout();
  const out = fps * 0.5;
  const whole = interpolate(frame, [end - out, end], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoIn = interpolate(frame, [start, start + fps * 0.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textIn = interpolate(frame, [start + fps * 0.5, start + fps * 1.1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: `rgba(8, 8, 12, ${0.6 * whole})`,
        opacity: whole,
        fontFamily: FONT_FAMILY,
        color: "white",
        textAlign: "center",
        padding: L.margin,
      }}
    >
      <Img
        src={staticFile(brand.logo)}
        style={{
          width: L.logoSize,
          height: L.logoSize,
          objectFit: "contain",
          opacity: logoIn,
          transform: `scale(${0.9 + 0.1 * logoIn})`,
          filter: "drop-shadow(0 8px 30px rgba(0,0,0,0.6))",
        }}
      />
      <div
        style={{
          marginTop: L.pad * 1.2,
          fontSize: L.titleFont,
          fontWeight: 700,
          opacity: textIn,
          transform: `translateY(${(1 - textIn) * 14}px)`,
          maxWidth: L.cardWidth,
          lineHeight: 1.2,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
};
