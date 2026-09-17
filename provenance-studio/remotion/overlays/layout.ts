import { useVideoConfig } from "remotion";

/**
 * Dimensions des overlays dérivées de la taille de la composition, pour que
 * 9:16 et 16:9 partagent le même code. `u` = 1 pour un petit côté de 1080 px.
 */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const u = Math.min(width, height) / 1080;
  const margin = 64 * u;
  const pad = 28 * u;
  const photoWidth = (portrait ? 300 : 260) * u;
  return {
    u,
    portrait,
    margin,
    pad,
    radius: 16 * u,
    cartoucheWidth: portrait ? width - 2 * margin - photoWidth - pad : 720 * u,
    titleFont: 46 * u,
    captionFont: 28 * u,
    smallFont: 20 * u,
    photoWidth,
    photoHeight: photoWidth * 1.25,
    logoMax: 260 * u,
    endLineFont: 40 * u,
  };
};
