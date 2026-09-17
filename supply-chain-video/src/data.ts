import { staticFile } from "remotion";
import { DEFAULT_CAMERA, DEFAULT_LOOK, DEFAULT_TIMING, NIGHT_LOOK } from "./defaults";
import type { Brand, CameraSettings, MapLook, Step, StepsFile, Timing } from "./types";

const fetchJson = async (file: string): Promise<unknown> => {
  const res = await fetch(staticFile(file));
  if (!res.ok) throw new Error(`${file} introuvable dans public/ (${res.status})`);
  return res.json();
};

/** Charge et valide un fichier d'étapes de `public/`. */
export const loadSteps = async (file: string): Promise<StepsFile> =>
  validateSteps(await fetchJson(file));

/** Charge et valide un fichier de marque de `public/`. */
export const loadBrand = async (file: string): Promise<Brand> =>
  validateBrand(await fetchJson(file));

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const assertCoord = (lat: unknown, lng: unknown, where: string) => {
  if (!isNum(lat) || lat < -90 || lat > 90)
    throw new Error(`${where} : latitude invalide (${String(lat)})`);
  if (!isNum(lng) || lng < -180 || lng > 180)
    throw new Error(`${where} : longitude invalide (${String(lng)})`);
};

export const validateSteps = (raw: unknown): StepsFile => {
  const file = raw as StepsFile;
  if (!file || typeof file.product !== "string")
    throw new Error("steps : champ `product` manquant");
  if (file.narrative !== "origine" && file.narrative !== "terroir")
    throw new Error('steps : `narrative` doit valoir "origine" ou "terroir"');
  if (
    file.intermediariesCount !== undefined &&
    file.intermediariesCount !== null &&
    (!isNum(file.intermediariesCount) || file.intermediariesCount < 0)
  )
    throw new Error("steps : `intermediariesCount` doit être un nombre ≥ 0 ou null");
  if (
    file.sourcingLine !== undefined &&
    file.sourcingLine !== null &&
    typeof file.sourcingLine !== "string"
  )
    throw new Error("steps : `sourcingLine` doit être une chaîne ou null");
  if (!Array.isArray(file.steps) || file.steps.length < 2)
    throw new Error("steps : il faut au moins 2 étapes");

  const last = file.steps.length - 1;
  // Les rôles d'abord : ce sont les erreurs les plus utiles à lire.
  file.steps.forEach((step: Step, i) => {
    if (step.kind !== "actor" && step.kind !== "transit")
      throw new Error(`steps[${i}] : \`kind\` manquant ou invalide (attendu "actor" ou "transit")`);
  });
  if (file.steps[0].kind !== "actor")
    throw new Error("steps[0] : la première étape doit être un actor (c'est le premier héros)");
  if (file.steps[last].kind !== "actor")
    throw new Error(`steps[${last}] : la dernière étape doit être un actor (l'atelier)`);
  if (file.narrative === "terroir") {
    const bad = file.steps.findIndex((s) => s.kind !== "actor");
    if (bad >= 0)
      throw new Error(`steps[${bad}] : en mode terroir toutes les étapes sont des actors`);
  }

  file.steps.forEach((step: Step, i) => {
    const where = `steps[${i}]`;
    if (typeof step.title !== "string") throw new Error(`${where} : title manquant`);
    assertCoord(step.lat, step.lng, where);
    if (step.mode !== undefined && step.mode !== "land" && step.mode !== "sea")
      throw new Error(`${where} : mode doit être "land" ou "sea"`);
    if (step.personName !== undefined && step.personName !== null && typeof step.personName !== "string")
      throw new Error(`${where} : personName doit être une chaîne ou null`);
    if (step.kind === "transit" && step.personName)
      throw new Error(`${where} : personName n'a de sens que pour un actor`);
    if (step.waypoints !== undefined) {
      if (!Array.isArray(step.waypoints))
        throw new Error(`${where} : waypoints doit être un tableau [lat, lng][]`);
      step.waypoints.forEach((wp, j) =>
        assertCoord(wp?.[0], wp?.[1], `${where}.waypoints[${j}]`),
      );
    }
    if (step.mode === "sea" && i !== last && !(step.waypoints && step.waypoints.length > 0))
      throw new Error(
        `${where} : un trajet "sea" doit fournir des waypoints pour contourner les terres`,
      );
    if (step.country !== undefined && !/^[A-Z]{2}$/.test(step.country))
      throw new Error(`${where} : country doit être un code ISO alpha-2 en majuscules (ex. "FR")`);
  });

  if (file.timing !== undefined) {
    for (const [k, v] of Object.entries(file.timing)) {
      if (!(k in DEFAULT_TIMING)) throw new Error(`steps : timing.${k} inconnu`);
      if (!isNum(v) || v < 0) throw new Error(`steps : timing.${k} invalide`);
    }
  }
  if (file.camera !== undefined) {
    for (const [k, v] of Object.entries(file.camera)) {
      if (!(k in DEFAULT_CAMERA)) throw new Error(`steps : camera.${k} inconnu`);
      if (!isNum(v) || v < 0) throw new Error(`steps : camera.${k} invalide`);
    }
  }
  return file;
};

export const validateBrand = (raw: unknown): Brand => {
  const brand = raw as Brand;
  if (!brand || typeof brand.name !== "string")
    throw new Error("brand : champ `name` manquant");
  if (typeof brand.color !== "string") throw new Error("brand : `color` manquant");
  // Tolère les backticks / espaces autour de la couleur.
  brand.color = brand.color.replace(/[`\s]/g, "");
  if (!/^#[0-9a-fA-F]{6}$/.test(brand.color))
    throw new Error(`brand : color doit être au format #RRGGBB (reçu ${brand.color})`);
  if (typeof brand.logo !== "string") throw new Error("brand : `logo` manquant");
  if (typeof brand.endLine !== "string") throw new Error("brand : `endLine` manquant");
  if (brand.musicGainDb !== undefined && !isNum(brand.musicGainDb))
    throw new Error("brand : musicGainDb doit être un nombre (dB)");
  if (brand.map !== undefined) {
    for (const [k, v] of Object.entries(brand.map)) {
      if (!(k in DEFAULT_LOOK)) throw new Error(`brand : map.${k} inconnu`);
      if (typeof v !== typeof DEFAULT_LOOK[k as keyof MapLook])
        throw new Error(`brand : map.${k} invalide`);
    }
    if (brand.map.theme !== undefined && brand.map.theme !== "day" && brand.map.theme !== "night")
      throw new Error('brand : map.theme doit valoir "day" ou "night"');
  }
  if (brand.locale !== undefined && typeof brand.locale !== "string")
    throw new Error("brand : locale doit être une chaîne (ex. \"fr\")");
  return brand;
};

export const resolveTiming = (file: StepsFile): Timing => ({
  ...DEFAULT_TIMING,
  ...(file.timing ?? {}),
});

export const resolveCamera = (file: StepsFile): CameraSettings => ({
  ...DEFAULT_CAMERA,
  ...(file.camera ?? {}),
});

export const resolveLook = (brand: Brand): MapLook => {
  const theme = brand.map?.theme ?? DEFAULT_LOOK.theme;
  return {
    ...DEFAULT_LOOK,
    ...(theme === "night" ? NIGHT_LOOK : {}),
    ...(brand.map ?? {}),
    theme,
  };
};

/** Convertit un gain en dB en facteur de volume linéaire (0 dB → 1). */
export const dbToGain = (db: number): number => Math.pow(10, db / 20);
