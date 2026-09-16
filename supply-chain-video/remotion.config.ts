import { Config } from "@remotion/cli/config";

// Mapbox GL JS a besoin de WebGL dans le Chrome headless de Remotion.
// "angle" utilise le GPU si présent ; sur un serveur sans GPU, passer
// `--gl=swangle` (SwiftShader) sur la ligne de commande.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Un seul onglet à la fois : chaque frame attend l'événement `idle` de Mapbox,
// ce qui est coûteux en mémoire GPU si plusieurs cartes tournent en parallèle.
Config.setConcurrency(1);
// Chaque frame attend le chargement des tuiles : on laisse de la marge.
Config.setDelayRenderTimeoutInMilliseconds(120_000);
