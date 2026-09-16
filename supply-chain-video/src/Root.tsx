import { Composition, type CalculateMetadataFunction } from "remotion";
import { loadBrand, loadSteps, resolveCamera, resolveTiming } from "./data";
import { buildLegs } from "./geo";
import { SupplyChainVideo } from "./SupplyChainVideo";
import { buildTimeline } from "./timeline";
import type { VideoProps } from "./types";

/**
 * Charge steps.json + brand.json et calcule la durée de la vidéo à partir
 * du nombre d'étapes et des distances. Les props par défaut sont vides :
 * tout le contenu vient des fichiers JSON.
 */
const calculateMetadata: CalculateMetadataFunction<VideoProps> = async () => {
  const [stepsFile, brand] = await Promise.all([loadSteps(), loadBrand()]);
  const timing = resolveTiming(stepsFile);
  const legs = buildLegs(stepsFile.steps);
  const timeline = buildTimeline(stepsFile.steps, legs, timing, resolveCamera(stepsFile));
  return {
    props: { stepsFile, brand },
    fps: timing.fps,
    durationInFrames: timeline.durationInFrames,
  };
};

// Props de substitution le temps que calculateMetadata charge les JSON.
const placeholder: VideoProps = {
  stepsFile: { product: "", steps: [] },
  brand: { name: "", color: "#000000", logo: "", endLine: "" },
};

export const RemotionRoot = () => (
  <>
    <Composition
      id="SupplyChainVertical"
      component={SupplyChainVideo}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={1}
      defaultProps={placeholder}
      calculateMetadata={calculateMetadata}
    />
    <Composition
      id="SupplyChainHorizontal"
      component={SupplyChainVideo}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={1}
      defaultProps={placeholder}
      calculateMetadata={calculateMetadata}
    />
  </>
);
