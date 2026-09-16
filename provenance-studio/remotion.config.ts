import path from "node:path";

// Le fichier est chargé par la CLI : `process.cwd()` est la racine du projet.
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("remotion/index.ts");
Config.setPublicDir("remotion/assets");
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Mapbox GL a besoin de WebGL : "angle" utilise le GPU s'il existe ;
// sur une machine sans GPU, passer `--gl=swangle` (SwiftShader).
Config.setChromiumOpenGlRenderer("angle");
// Chaque frame attend l'événement `idle` de Mapbox : un seul onglet à la fois.
Config.setConcurrency(1);
Config.setDelayRenderTimeoutInMilliseconds(120_000);
// Alias `@/` du projet Next (lib/routes.ts est partagé avec la vidéo).
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: { ...(config.resolve?.alias ?? {}), "@": path.resolve(process.cwd()) },
  },
}));
