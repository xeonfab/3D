import "server-only";

import {
  getRenderProgress,
  renderMediaOnLambda,
  renderStillOnLambda,
  type AwsRegion,
} from "@remotion/lambda/client";

import type { RenderJob, RenderPoll, RenderProvider } from "./types";

/**
 * Remotion Lambda. Variables requises : REMOTION_AWS_ACCESS_KEY_ID,
 * REMOTION_AWS_SECRET_ACCESS_KEY (lues par le SDK), REMOTION_AWS_REGION,
 * REMOTION_LAMBDA_FUNCTION_NAME, REMOTION_SERVE_URL.
 */
export class LambdaRenderProvider implements RenderProvider {
  readonly name = "lambda";
  private readonly region: AwsRegion;
  private readonly functionName: string;
  private readonly serveUrl: string;

  constructor() {
    const region = process.env.REMOTION_AWS_REGION;
    const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
    const serveUrl = process.env.REMOTION_SERVE_URL;
    if (!region || !functionName || !serveUrl) {
      throw new Error(
        "Remotion Lambda : REMOTION_AWS_REGION, REMOTION_LAMBDA_FUNCTION_NAME et REMOTION_SERVE_URL sont requis.",
      );
    }
    this.region = region as AwsRegion;
    this.functionName = functionName;
    this.serveUrl = serveUrl;
  }

  async start(job: RenderJob): Promise<string> {
    const { renderId, bucketName } = await renderMediaOnLambda({
      region: this.region,
      functionName: this.functionName,
      serveUrl: this.serveUrl,
      composition: job.composition,
      inputProps: job.inputProps,
      codec: "h264",
      imageFormat: "jpeg",
      scale: job.scale,
      outName: `${job.renderId}.mp4`,
      privacy: "public",
      // Mapbox : un onglet par Lambda, WebGL via ANGLE/SwiftShader.
      concurrencyPerLambda: 1,
      chromiumOptions: { gl: "swangle" },
      downloadBehavior: { type: "download", fileName: `${job.renderId}.mp4` },
    });
    return `${bucketName}/${renderId}`;
  }

  async poll(providerRenderId: string): Promise<RenderPoll> {
    const [bucketName, renderId] = providerRenderId.split("/");
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName: this.functionName,
      region: this.region,
    });
    if (progress.fatalErrorEncountered) {
      const message = progress.errors.map((e) => e.message).join(" | ") || "Erreur Lambda inconnue";
      return {
        status: "failed",
        progress: Math.round(progress.overallProgress * 100),
        error: message,
      };
    }
    if (progress.done && progress.outputFile) {
      return { status: "done", progress: 100, outputUrl: progress.outputFile };
    }
    return {
      status: "rendering",
      progress: Math.min(99, Math.round(progress.overallProgress * 100)),
    };
  }

  async still(_providerRenderId: string, job: RenderJob): Promise<string> {
    const { url } = await renderStillOnLambda({
      region: this.region,
      functionName: this.functionName,
      serveUrl: this.serveUrl,
      composition: job.composition,
      inputProps: job.inputProps,
      frame: job.thumbnailFrame,
      imageFormat: "jpeg",
      jpegQuality: 85,
      scale: Math.min(job.scale, 2 / 3),
      privacy: "public",
      outName: `${job.renderId}-thumb.jpg`,
      chromiumOptions: { gl: "swangle" },
    });
    return url;
  }
}
