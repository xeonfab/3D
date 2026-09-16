/**
 * Worker de rendu local : bundle Remotion, rend la vidéo et la miniature,
 * écrit la progression dans `<dir>/status.json`. Lancé par
 * LocalRenderProvider (RENDER_PROVIDER=local) ou à la main :
 *
 *   npx tsx scripts/render-worker.ts .renders/<id>
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

import type { RenderJob } from "../lib/render/types";

config({ path: ".env.local" });

const dir = process.argv[2];
if (!dir) {
  console.error("Usage : tsx scripts/render-worker.ts <dossier du job>");
  process.exit(1);
}

const statusFile = path.join(dir, "status.json");
const write = (s: object) => writeFileSync(statusFile, JSON.stringify(s));

async function main() {
  const job = JSON.parse(readFileSync(path.join(dir, "job.json"), "utf8")) as RenderJob;
  const root = process.cwd();
  const serveUrl = await bundle({
    entryPoint: path.join(root, "remotion", "index.ts"),
    publicDir: path.join(root, "remotion", "assets"),
    webpackOverride: (c) => ({
      ...c,
      resolve: { ...c.resolve, alias: { ...(c.resolve?.alias ?? {}), "@": root } },
    }),
  });
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const chromiumOptions = { gl: (process.env.REMOTION_GL as "angle" | "swangle") || "angle" };
  // "headless-shell" (défaut Remotion) ou "chrome-for-testing" (Chrome/Chromium complet récent).
  const chromeMode =
    (process.env.REMOTION_CHROME_MODE as "headless-shell" | "chrome-for-testing") ||
    "headless-shell";
  const composition = await selectComposition({
    serveUrl,
    id: job.composition,
    inputProps: job.inputProps,
    browserExecutable,
    chromiumOptions,
  });

  const videoPath = path.join(dir, `${job.renderId}.mp4`);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: videoPath,
    inputProps: job.inputProps,
    scale: job.scale,
    imageFormat: "jpeg",
    concurrency: 1,
    browserExecutable,
    chromiumOptions,
    chromeMode,
    timeoutInMilliseconds: 120_000,
    onProgress: ({ progress }) =>
      write({ status: "rendering", progress: Math.round(progress * 99) }),
  });

  const thumbnailPath = path.join(dir, `${job.renderId}-thumb.jpg`);
  await renderStill({
    composition,
    serveUrl,
    output: thumbnailPath,
    inputProps: job.inputProps,
    frame: job.thumbnailFrame,
    imageFormat: "jpeg",
    jpegQuality: 85,
    scale: Math.min(job.scale, 2 / 3),
    browserExecutable,
    chromiumOptions,
    chromeMode,
    timeoutInMilliseconds: 120_000,
  });

  write({ status: "done", progress: 100, videoPath, thumbnailPath });
}

main().catch((err) => {
  console.error(err);
  write({ status: "failed", progress: 0, error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
