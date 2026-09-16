import { Composition, type CalculateMetadataFunction } from "remotion";
import { loadBrand, loadSteps, resolveTiming } from "./data";
import { DEFAULT_BRAND_PATH, DEFAULT_STEPS_PATH } from "./defaults";
import { SupplyChainVideo } from "./SupplyChainVideo";
import { buildTimeline } from "./timeline";
import type { VideoProps } from "./types";

/**
 * Charge les JSON désignés par les props (`stepsPath`, `brandPath`, dans
 * `public/`) et calcule la durée depuis la timeline. Exemple :
 *   npx remotion render SupplyChainVertical out/terroir.mp4 \
 *     --props='{"stepsPath":"steps-terroir.json","brandPath":"brand-terroir.json"}'
 */
const calculateMetadata: CalculateMetadataFunction<VideoProps> = async ({ props }) => {
  const [stepsFile, brand] = await Promise.all([
    loadSteps(props.stepsPath),
    loadBrand(props.brandPath),
  ]);
  const timing = resolveTiming(stepsFile);
  const timeline = buildTimeline(stepsFile, timing);
  return {
    props: { ...props, stepsFile, brand },
    fps: timing.fps,
    durationInFrames: timeline.durationInFrames,
  };
};

const defaultProps: VideoProps = {
  stepsPath: DEFAULT_STEPS_PATH,
  brandPath: DEFAULT_BRAND_PATH,
  stepsFile: null,
  brand: null,
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
      defaultProps={defaultProps}
      calculateMetadata={calculateMetadata}
    />
    <Composition
      id="SupplyChainHorizontal"
      component={SupplyChainVideo}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={1}
      defaultProps={defaultProps}
      calculateMetadata={calculateMetadata}
    />
  </>
);
