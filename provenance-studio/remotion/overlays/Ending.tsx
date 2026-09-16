import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { SANS, SERIF } from "../fonts";
import { useLayout } from "./layout";

type Props = {
  brandName: string;
  logoSrc: string | null;
  endLine: string;
  start: number;
  zoomInSeconds: number;
};

/** Fin : après le zoom serré, carte assombrie, logo + ligne de fin en typographie éditoriale. */
export const Ending = ({ brandName, logoSrc, endLine, start, zoomInSeconds }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout();
  const t0 = start + zoomInSeconds * fps * 0.6;
  const veil = interpolate(frame, [t0, t0 + fps * 0.8], [0, 0.62], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoIn = interpolate(frame, [t0 + fps * 0.3, t0 + fps * 0.9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lineIn = interpolate(frame, [t0 + fps * 0.7, t0 + fps * 1.3], [0, 1], {
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
        background: `rgba(8, 9, 11, ${veil})`,
        color: "white",
        textAlign: "center",
        padding: L.margin,
      }}
    >
      {logoSrc ? (
        <Img
          src={logoSrc}
          style={{
            maxWidth: L.logoMax,
            maxHeight: L.logoMax,
            objectFit: "contain",
            opacity: logoIn,
            transform: `scale(${0.94 + 0.06 * logoIn})`,
            filter: "drop-shadow(0 8px 30px rgba(0,0,0,0.6))",
          }}
        />
      ) : (
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: L.titleFont * 1.2,
            opacity: logoIn,
            letterSpacing: 1,
          }}
        >
          {brandName}
        </div>
      )}
      {endLine ? (
        <div
          style={{
            marginTop: L.pad * 1.4,
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: L.endLineFont,
            lineHeight: 1.3,
            maxWidth: L.portrait ? "86%" : "60%",
            opacity: lineIn,
            transform: `translateY(${(1 - lineIn) * 14}px)`,
            color: "rgba(255,255,255,0.92)",
          }}
        >
          {endLine}
        </div>
      ) : null}
    </div>
  );
};
