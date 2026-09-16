import type { TravelMode } from "../types";

type Props = {
  x: number;
  y: number;
  /** Direction horizontale du déplacement à l'écran (-1 : vers la gauche). */
  dirX: number;
  mode: TravelMode;
  color: string;
  size: number;
};

/** Bateau (mer) ou camion (terre) à la tête du tracé, orienté dans le sens du déplacement. */
export const Vehicle = ({ x, y, dirX, mode, color, size }: Props) => (
  <div
    style={{
      position: "absolute",
      left: x - size / 2,
      top: y - size * 0.7,
      width: size,
      height: size,
      transform: `scaleX(${dirX < 0 ? -1 : 1})`,
      filter: `drop-shadow(0 0 ${size * 0.25}px ${color})`,
      pointerEvents: "none",
    }}
  >
    {mode === "sea" ? (
      <svg viewBox="0 0 64 64" width={size} height={size}>
        {/* coque */}
        <path d="M6 40 L58 40 L50 54 L14 54 Z" fill={color} />
        {/* passerelle à l'arrière (le navire avance vers la droite) */}
        <rect x="10" y="18" width="8" height="22" rx="1" fill="white" opacity="0.92" />
        {/* pont et conteneurs */}
        <rect x="18" y="30" width="32" height="10" rx="1" fill="white" opacity="0.92" />
        <rect x="20" y="22" width="8" height="8" fill={color} />
        <rect x="30" y="22" width="8" height="8" fill="white" opacity="0.7" />
        <rect x="40" y="22" width="8" height="8" fill={color} />
      </svg>
    ) : (
      <svg viewBox="0 0 64 64" width={size} height={size}>
        {/* remorque */}
        <rect x="4" y="22" width="36" height="22" rx="2" fill="white" opacity="0.92" />
        {/* cabine */}
        <path d="M40 30 L52 30 L58 38 L58 44 L40 44 Z" fill={color} />
        <rect x="43" y="32" width="8" height="6" rx="1" fill="white" opacity="0.8" />
        {/* roues */}
        <circle cx="14" cy="47" r="5" fill="white" />
        <circle cx="30" cy="47" r="5" fill="white" />
        <circle cx="50" cy="47" r="5" fill="white" />
        <circle cx="14" cy="47" r="2" fill={color} />
        <circle cx="30" cy="47" r="2" fill={color} />
        <circle cx="50" cy="47" r="2" fill={color} />
      </svg>
    )}
  </div>
);
