import { useCurrentFrame, useVideoConfig } from "remotion";
import { DEFAULT_TIMING } from "../defaults";
import type { Card as CardModel } from "../scene";
import { fadeInOut } from "./fade";
import { FONT_FAMILY, useLayout } from "./layout";

type Props = { card: CardModel; color: string; fadeSeconds?: number };

/**
 * Cartouche d'un actor : chapeau (rôle du plan), personName en grand si
 * présent, title, lieu « Place, Pays », caption. Aucun texte de logistique.
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
      <div
        style={{
          fontSize: L.smallFont * 1.15,
          letterSpacing: 3,
          textTransform: "uppercase",
          color,
          fontWeight: 800,
          marginBottom: L.pad * 0.35,
        }}
      >
        {card.chapter}
      </div>
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
      {card.location ? (
        <div
          style={{
            fontSize: L.captionFont * 0.95,
            marginTop: L.pad * 0.3,
            color: "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "center",
            gap: L.pad * 0.3,
          }}
        >
          <svg width={L.captionFont * 0.8} height={L.captionFont * 0.8} viewBox="0 0 24 24" aria-hidden>
            <path
              d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
              fill={color}
            />
          </svg>
          {card.location}
        </div>
      ) : null}
      {card.caption ? (
        <div
          style={{
            fontSize: L.captionFont,
            lineHeight: 1.3,
            marginTop: L.pad * 0.4,
            color: "rgba(255,255,255,0.88)",
          }}
        >
          {card.caption}
        </div>
      ) : null}
    </div>
  );
};
