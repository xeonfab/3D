import { cn } from "@/lib/utils";

/**
 * Carte sombre stylisée, sans Mapbox : utilisée comme aperçu de secours (pas
 * de token) et comme miniature de produit sans rendu. Purement décorative.
 */
export function MapPlaceholder({
  color = "#D9822B",
  className,
}: {
  color?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("relative h-full w-full overflow-hidden bg-[#111214]", className)}
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 50% 60%, rgba(255,255,255,0.05), transparent 60%), linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "auto, 40px 40px, 40px 40px",
      }}
    >
      <svg
        viewBox="0 0 400 240"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          d="M40 60 C 90 20, 140 30, 170 90 S 240 150, 300 120 S 360 170, 370 200"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          d="M0 200 C 60 190, 90 210, 140 180 S 230 160, 280 190 S 360 220, 400 190"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="24"
          strokeLinecap="round"
        />
        <path
          d="M70 170 C 120 80, 220 70, 320 100"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="70" cy="170" r="5" fill={color} />
        <circle cx="320" cy="100" r="5" fill={color} />
        <circle cx="320" cy="100" r="12" fill={color} opacity="0.25" />
      </svg>
    </div>
  );
}
