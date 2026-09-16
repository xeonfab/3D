import { Composition, type CalculateMetadataFunction } from "remotion";

import sampleProps from "./sample-props.json";
import { ProvenanceVideo } from "./ProvenanceVideo";
import { buildTimeline, FPS } from "./timeline";
import { videoPropsSchema, type VideoProps } from "./types";

/** Durée = 3 s d'intro + Σ duration_seconds + 4 s de fin, calculée depuis les props. */
const calculateMetadata: CalculateMetadataFunction<VideoProps> = async ({ props }) => ({
  durationInFrames: buildTimeline(props.steps, FPS).durationInFrames,
});

const defaults = videoPropsSchema.parse(sampleProps);

export const RemotionRoot = () => (
  <>
    <Composition
      id="vertical"
      component={ProvenanceVideo}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={FPS * 10}
      schema={videoPropsSchema}
      defaultProps={{ ...defaults, format: "vertical" }}
      calculateMetadata={calculateMetadata}
    />
    <Composition
      id="horizontal"
      component={ProvenanceVideo}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={FPS * 10}
      schema={videoPropsSchema}
      defaultProps={{ ...defaults, format: "horizontal" }}
      calculateMetadata={calculateMetadata}
    />
  </>
);
