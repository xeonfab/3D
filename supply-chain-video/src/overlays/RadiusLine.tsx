import { useCurrentFrame, useVideoConfig } from "remotion";
import { DEFAULT_TIMING } from "../defaults";
import { fadeInOut } from "./fade";
import { FONT_FAMILY, useLayout } from "./layout";

type Props = { text: string; color: string; start: number; end: number };

/** Terroir : « Tout vient de moins de N km », en haut de l'image. */
export const RadiusLine = ({ text, color, start, end }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout();
  const opacity = fadeInOut(frame, start, end, Math.round(DEFAULT_TIMING.cardFadeSeconds * fps));
  return (
    <div
      style={{
        position: "absolute",
        top: L.margin * 1.5,
        left: "50%",
        transform: "translateX(-50%)",
        opacity,
        fontFamily: FONT_FAMILY,
        fontSize: L.titleFont * 0.8,
        fontWeight: 800,
        color: "white",
        background: "rgba(12, 12, 16, 0.78)",
        borderLeft: `${L.accent}px solid ${color}`,
        padding: `${L.pad * 0.6}px ${L.pad * 1.2}px`,
        borderRadius: L.radius,
        whiteSpace: "nowrap",
        boxShadow: "0 8px 30px rgba(0,0,0,0.45)",
      }}
    >
      {text}
    </div>
  );
};
