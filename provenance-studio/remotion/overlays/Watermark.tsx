import { SANS } from "../fonts";
import { useLayout } from "./layout";

/** Filigrane discret bas-droit (plan gratuit). */
export const Watermark = () => {
  const L = useLayout();
  return (
    <div
      style={{
        position: "absolute",
        right: L.margin * 0.5,
        bottom: L.margin * 0.4,
        fontFamily: SANS,
        fontSize: L.smallFont,
        fontWeight: 600,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.7)",
        textShadow: "0 1px 6px rgba(0,0,0,0.7)",
        pointerEvents: "none",
      }}
    >
      Provenance Studio
    </div>
  );
};
