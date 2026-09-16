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
  const photoSize = 300 * u;
  // Photo grand format : bas plein cadre en 9:16, tiers droit en 16:9.
  const largePhotoHeight = portrait ? Math.round(height * 0.36) : height;
  const largePhotoWidth = portrait ? width : Math.round(width / 3);
  return {
    portrait,
    margin,
    pad,
    radius: 22 * u,
    accent: 8 * u,
    cardWidth: portrait ? width - 2 * margin : Math.round(width * 0.55),
    personFont: 64 * u,
    titleFont: 40 * u,
    captionFont: 28 * u,
    smallFont: 20 * u,
    photoSize,
    largePhotoHeight,
    largePhotoWidth,
    logoSize: 220 * u,
    vehicleSize: 64 * u,
    /** Bas du cartouche quand la photo grand format occupe le bas (9:16). */
    cardBottomAboveLargePhoto: largePhotoHeight + pad,
  };
};
