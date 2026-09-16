import { useVideoConfig } from "remotion";

export const FONT_FAMILY =
  "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * Dimensions des overlays, dérivées de la taille de la composition pour
 * que 9:16 et 16:9 partagent le même code.
 */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  // Unité de base : proportionnelle au plus petit côté.
  const u = Math.min(width, height) / 1080;
  const margin = 56 * u;
  const pad = 26 * u;
  const photoSize = (portrait ? 320 : 280) * u;
  return {
    portrait,
    margin,
    pad,
    radius: 22 * u,
    accent: 8 * u,
    cartoucheWidth: portrait ? width - 2 * margin - photoSize - pad : 640 * u,
    titleFont: 44 * u,
    captionFont: 28 * u,
    smallFont: 18 * u,
    photoSize,
    photoBottom: margin,
    logoSize: 220 * u,
    vehicleSize: 64 * u,
  };
};
