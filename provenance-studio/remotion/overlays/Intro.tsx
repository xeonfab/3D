import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { SANS, SERIF } from "../fonts";
import { useLayout } from "./layout";

type Props = {
  brandName: string;
  logoSrc: string | null;
  productName: string;
  start: number;
  end: number;
};

/** Intro : logo centré en fondu, sous-titre « Le voyage de … ». Le flou de la carte est géré par la scène. */
export const Intro = ({ brandName, logoSrc, productName, start, end }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout();
  const logoIn = interpolate(frame, [start + fps * 0.2, start + fps * 0.9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textIn = interpolate(frame, [start + fps * 0.7, start + fps * 1.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const out = interpolate(frame, [end - fps * 0.6, end], [1, 0], {
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
        padding: L.margin,
        opacity: out,
        color: "white",
        textAlign: "center",
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
      <div
        style={{
          marginTop: L.pad * 1.4,
          fontFamily: SERIF,
          fontWeight: 400,
          fontSize: L.endLineFont,
          lineHeight: 1.25,
          opacity: textIn,
          transform: `translateY(${(1 - textIn) * 12}px)`,
          color: "rgba(255,255,255,0.92)",
        }}
      >
        Le voyage de {productName}
      </div>
    </div>
  );
};
