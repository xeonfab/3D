import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

import manifest from "./assets/fonts/manifest.json";

/**
 * Polices embarquées dans `remotion/assets/fonts` (Inter variable pour
 * l'interface, Fraunces pour la ligne de fin) : aucun appel réseau au rendu,
 * sur Lambda comme en local. `loadFont` retarde le rendu jusqu'au chargement.
 */
for (const face of manifest) {
  void loadFont({
    family: face.family,
    url: staticFile(face.file),
    format: "woff2",
    weight: face.weight,
    unicodeRange: face.unicodeRange,
  });
}

export const SANS = "Inter, 'Helvetica Neue', Arial, sans-serif";
export const SERIF = "Fraunces, Georgia, serif";
