import { useCurrentFrame, useVideoConfig } from "remotion";
import { DEFAULT_TIMING } from "../defaults";
import type { Card as CardModel } from "../scene";
import { fadeInOut } from "./fade";
import { FONT_FAMILY, useLayout } from "./layout";

type Props = { card: CardModel; color: string; fadeSeconds?: number };

/**
 * Cartouche d'un actor : ville en évidence si renseignée, personName en
 * grand si présent, puis title, puis caption. Aucun texte de logistique.
 */
export const Card = ({ card, color, fadeSeconds = DEFAULT_TIMING.cardFadeSeconds }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout();
  const fade = Math.round(fadeSeconds * fps);
  const opacity = fadeInOut(frame, card.start, card.end, fade);
  const slide = (1 - Math.min(1, Math.max(0, (frame - card.start) / Math.max(fade, 1)))) * 24;

  // En 9:16, la photo grand format occupe le bas : le cartouche se place au-dessus.
  const bottom = card.large && card.photo && L.portrait ? L.cardBottomAboveLargePhoto : L.margin;
  const maxWidth =
    card.large && card.photo && !L.portrait
      ? L.cardWidth
      : L.portrait && !card.large && card.photo
        ? L.cardWidth - L.photoSize - L.pad
        : L.cardWidth;

  return (
    <div
      style={{
        position: "absolute",
        left: L.margin,
        bottom,
        maxWidth,
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
      {card.city ? (
        <div
          style={{
            fontSize: L.smallFont * 1.3,
            letterSpacing: 3,
            textTransform: "uppercase",
            color,
            fontWeight: 800,
            marginBottom: L.pad * 0.35,
          }}
        >
          {card.city}
        </div>
      ) : null}
      {card.personName ? (
        <div style={{ fontSize: L.personFont, fontWeight: 800, lineHeight: 1.05 }}>
          {card.personName}
        </div>
      ) : null}
      <div
        style={{
          fontSize: card.personName ? L.titleFont * 0.85 : L.titleFont,
          fontWeight: 700,
          lineHeight: 1.15,
          marginTop: card.personName ? L.pad * 0.3 : 0,
        }}
      >
        {card.title}
      </div>
      {card.caption ? (
        <div
          style={{
            fontSize: L.captionFont,
            lineHeight: 1.3,
            marginTop: L.pad * 0.4,
            color: "rgba(255,255,255,0.82)",
          }}
        >
          {card.caption}
        </div>
      ) : null}
    </div>
  );
};
