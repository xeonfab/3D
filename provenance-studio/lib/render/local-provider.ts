import "server-only";

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { RenderJob, RenderPoll, RenderProvider } from "./types";

export type LocalStatusFile = {
  status: "rendering" | "done" | "failed";
  progress: number;
  error?: string;
  videoPath?: string;
  thumbnailPath?: string;
};

export const localRenderDir = (renderId: string) => path.join(process.cwd(), ".renders", renderId);

/**
 * Worker local (développement, ou serveur avec Chrome) : `scripts/render-worker.ts`
 * tourne en arrière-plan, écrit `status.json` dans `.renders/<id>/`.
 * Sélectionné par RENDER_PROVIDER=local.
 */
export class LocalRenderProvider implements RenderProvider {
  readonly name = "local";

  async start(job: RenderJob): Promise<string> {
    const dir = localRenderDir(job.renderId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "job.json"), JSON.stringify(job));
    writeFileSync(
      path.join(dir, "status.json"),
      JSON.stringify({ status: "rendering", progress: 0 } satisfies LocalStatusFile),
    );
    const tsx = path.join(process.cwd(), "node_modules", ".bin", "tsx");
    const child = spawn(tsx, [path.join(process.cwd(), "scripts", "render-worker.ts"), dir], {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      env: process.env,
    });
    child.unref();
    return `local:${job.renderId}`;
  }

  private read(providerRenderId: string): LocalStatusFile | null {
    const dir = localRenderDir(providerRenderId.replace(/^local:/, ""));
    const file = path.join(dir, "status.json");
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf8")) as LocalStatusFile;
  }

  async poll(providerRenderId: string): Promise<RenderPoll> {
    const s = this.read(providerRenderId);
    if (!s) return { status: "failed", progress: 0, error: "Suivi du rendu local introuvable." };
    if (s.status === "done" && s.videoPath) {
      return {
        status: "done",
        progress: 100,
        outputUrl: s.videoPath,
        thumbnailUrl: s.thumbnailPath,
      };
    }
    if (s.status === "failed")
      return { status: "failed", progress: s.progress, error: s.error ?? "Rendu local échoué." };
    return { status: "rendering", progress: Math.min(99, s.progress) };
  }

  async still(providerRenderId: string): Promise<string> {
    const s = this.read(providerRenderId);
    if (!s?.thumbnailPath) throw new Error("Miniature locale introuvable.");
    return s.thumbnailPath;
  }
}
