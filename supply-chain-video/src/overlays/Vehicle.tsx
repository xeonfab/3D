import type { TravelMode } from "../types";

type Props = {
  x: number;
  y: number;
  /** Cap à l'écran en degrés (0 = vers le haut, sens horaire). */
  heading: number;
  mode: TravelMode;
  color: string;
  size: number;
};

/**
 * Avion (air), porte-conteneurs (sea) ou camion (land) vus de dessus,
 * ombrés pour lire le volume, tournés dans le sens du déplacement, avec
 * une ombre portée décalée qui les décolle de la carte.
 */
export const Vehicle = ({ x, y, heading, mode, color, size }: Props) => (
  <div
    style={{
      position: "absolute",
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      transform: `rotate(${heading}deg)`,
      transformOrigin: "50% 50%",
      filter: `drop-shadow(${size * 0.08}px ${size * 0.14}px ${size * 0.08}px rgba(0,0,0,0.55)) drop-shadow(0 0 ${size * 0.2}px ${color})`,
      pointerEvents: "none",
    }}
  >
    <svg viewBox="0 0 64 64" width={size} height={size}>
      <defs>
        <linearGradient id="veh-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#f2f2f2" />
          <stop offset="1" stopColor="#b8bcc4" />
        </linearGradient>
        <linearGradient id="veh-accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor="#7a4a18" />
        </linearGradient>
      </defs>
      {mode === "air" ? (
        <g>
          {/* fuselage (nez en haut) */}
          <path d="M32 3 C36 3 37 10 37 20 L37 48 C37 54 35 60 32 61 C29 60 27 54 27 48 L27 20 C27 10 28 3 32 3 Z" fill="url(#veh-body)" />
          {/* ailes */}
          <path d="M28 24 L4 40 L4 45 L28 38 Z" fill="url(#veh-body)" />
          <path d="M36 24 L60 40 L60 45 L36 38 Z" fill="#c9cdd3" />
          {/* empennage */}
          <path d="M29 50 L18 58 L18 61 L29 57 Z" fill="url(#veh-body)" />
          <path d="M35 50 L46 58 L46 61 L35 57 Z" fill="#c9cdd3" />
          <rect x="31" y="46" width="2" height="12" fill="#9aa0a8" />
          {/* dérive et cockpit */}
          <rect x="29" y="8" width="6" height="4" rx="2" fill={color} />
          {/* moteurs */}
          <rect x="14" y="33" width="5" height="9" rx="2" fill="#8d939b" />
          <rect x="45" y="33" width="5" height="9" rx="2" fill="#8d939b" />
        </g>
      ) : mode === "sea" ? (
        <g>
          {/* coque (proue en haut) */}
          <path d="M32 4 C40 12 42 22 42 34 L42 56 C42 59 40 61 37 61 L27 61 C24 61 22 59 22 56 L22 34 C22 22 24 12 32 4 Z" fill="url(#veh-body)" />
          {/* conteneurs */}
          <rect x="25" y="18" width="6" height="8" fill="url(#veh-accent)" />
          <rect x="33" y="18" width="6" height="8" fill="#d0d4da" />
          <rect x="25" y="28" width="6" height="8" fill="#d0d4da" />
          <rect x="33" y="28" width="6" height="8" fill="url(#veh-accent)" />
          <rect x="25" y="38" width="6" height="8" fill="url(#veh-accent)" />
          <rect x="33" y="38" width="6" height="8" fill="#d0d4da" />
          {/* passerelle à l'arrière */}
          <rect x="25" y="49" width="14" height="7" rx="1" fill="#e9ebee" />
          <rect x="29" y="50" width="6" height="2" fill={color} />
        </g>
      ) : (
        <g>
          {/* remorque (avant en haut) */}
          <rect x="21" y="18" width="22" height="42" rx="2" fill="url(#veh-body)" />
          <rect x="24" y="22" width="16" height="34" rx="1" fill="#e4e7eb" />
          {/* cabine */}
          <rect x="22" y="5" width="20" height="12" rx="3" fill="url(#veh-accent)" />
          <rect x="25" y="7" width="14" height="4" rx="1" fill="#f6dcc0" opacity="0.85" />
          {/* roues */}
          <rect x="17" y="9" width="4" height="6" rx="1" fill="#2a2d33" />
          <rect x="43" y="9" width="4" height="6" rx="1" fill="#2a2d33" />
          <rect x="17" y="44" width="4" height="8" rx="1" fill="#2a2d33" />
          <rect x="43" y="44" width="4" height="8" rx="1" fill="#2a2d33" />
          <rect x="17" y="53" width="4" height="8" rx="1" fill="#2a2d33" />
          <rect x="43" y="53" width="4" height="8" rx="1" fill="#2a2d33" />
        </g>
      )}
    </svg>
  </div>
);
