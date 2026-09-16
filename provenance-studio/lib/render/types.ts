import type { VideoProps } from "@/remotion/types";

export type CompositionId = "vertical" | "horizontal";

export type RenderJob = {
  /** id de la ligne `renders` : sert de nom de fichier et de clé de suivi. */
  renderId: string;
  composition: CompositionId;
  inputProps: VideoProps;
  /** 1 = 1080p, 2/3 = 720p. */
  scale: number;
  /** Frame de la miniature. */
  thumbnailFrame: number;
};

export type RenderPoll =
  | { status: "rendering"; progress: number }
  | { status: "done"; progress: 100; outputUrl: string; thumbnailUrl?: string }
  | { status: "failed"; progress: number; error: string };

/**
 * Abstraction du moteur de rendu. Implémentations : Remotion Lambda (prod)
 * et worker local (développement). `providerRenderId` est opaque et stocké
 * dans `renders.render_id_provider`.
 */
export interface RenderProvider {
  readonly name: string;
  start(job: RenderJob): Promise<string>;
  poll(providerRenderId: string, job: RenderJob): Promise<RenderPoll>;
  /** Miniature JPEG : URL http(s) ou chemin local. */
  still(providerRenderId: string, job: RenderJob): Promise<string>;
}
