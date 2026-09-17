import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { VEIL_OPACITY } from "../defaults";
import type { Brand } from "../types";
import { FONT_FAMILY, useLayout } from "./layout";

type Props = { brand: Brand; start: number };

/** Écran de fin : carte fixe assombrie, logo et ligne de fin de la marque. */
export const Ending = ({ brand, start }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout();

  const t = frame - start;
  const veil = interpolate(t, [0, fps * 0.6], [0, VEIL_OPACITY.ending], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoIn = interpolate(t, [fps * 0.2, fps * 0.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lineIn = interpolate(t, [fps * 0.6, fps * 1.2], [0, 1], {
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
        background: `rgba(8, 8, 12, ${veil})`,
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
      <div style={{ marginTop: L.pad, fontSize: L.titleFont, fontWeight: 700, opacity: logoIn }}>
        {brand.name}
      </div>
      <div
        style={{
          marginTop: L.pad * 1.2,
          fontSize: L.captionFont * 1.15,
          maxWidth: L.cardWidth,
          lineHeight: 1.35,
          color: "rgba(255,255,255,0.9)",
          opacity: lineIn,
          transform: `translateY(${(1 - lineIn) * 16}px)`,
        }}
      >
        {brand.endLine}
      </div>
    </div>
  );
};
