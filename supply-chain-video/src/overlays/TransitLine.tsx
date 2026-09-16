import { useCurrentFrame, useVideoConfig } from "remotion";
import { DEFAULT_TIMING } from "../defaults";
import { fadeInOut } from "./fade";
import { FONT_FAMILY, useLayout } from "./layout";

type Props = { text: string; x: number; y: number; color: string; start: number; end: number };

/** Une seule ligne au milieu de l'arc de transit (nb d'intermédiaires ou sourcing). */
export const TransitLine = ({ text, x, y, color, start, end }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout();
  const opacity = fadeInOut(frame, start, end, Math.round(DEFAULT_TIMING.cardFadeSeconds * fps));
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y - L.pad * 2.4,
        transform: "translate(-50%, -100%)",
        opacity,
        fontFamily: FONT_FAMILY,
        fontSize: L.captionFont * 1.1,
        fontWeight: 700,
        color,
        background: "rgba(12, 12, 16, 0.8)",
        padding: `${L.pad * 0.5}px ${L.pad}px`,
        borderRadius: L.radius,
        whiteSpace: "nowrap",
        boxShadow: "0 8px 30px rgba(0,0,0,0.45)",
      }}
    >
      {text}
    </div>
  );
};
