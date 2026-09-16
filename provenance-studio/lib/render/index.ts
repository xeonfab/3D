import "server-only";

import { LambdaRenderProvider } from "./lambda-provider";
import { LocalRenderProvider } from "./local-provider";
import type { RenderProvider } from "./types";

let provider: RenderProvider | null = null;

/** RENDER_PROVIDER=lambda (défaut) | local */
export function getRenderProvider(): RenderProvider {
  if (provider) return provider;
  provider =
    process.env.RENDER_PROVIDER === "local"
      ? new LocalRenderProvider()
      : new LambdaRenderProvider();
  return provider;
}

export type { RenderJob, RenderPoll, RenderProvider } from "./types";
