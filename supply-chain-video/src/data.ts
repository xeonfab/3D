import { staticFile } from "remotion";
import { DEFAULT_CAMERA, DEFAULT_TIMING } from "./defaults";
import type { Brand, CameraSettings, Step, StepsFile, Timing } from "./types";

/** Charge et valide `public/steps.json`. */
export const loadSteps = async (): Promise<StepsFile> => {
  const res = await fetch(staticFile("steps.json"));
  if (!res.ok) throw new Error(`steps.json introuvable (${res.status})`);
  return validateSteps(await res.json());
};

/** Charge et valide `public/brand.json`. */
export const loadBrand = async (): Promise<Brand> => {
  const res = await fetch(staticFile("brand.json"));
  if (!res.ok) throw new Error(`brand.json introuvable (${res.status})`);
  return validateBrand(await res.json());
};

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
    throw new Error("steps.json : champ `product` manquant");
  if (!Array.isArray(file.steps) || file.steps.length < 2)
    throw new Error("steps.json : il faut au moins 2 étapes");

  file.steps.forEach((step: Step, i) => {
    const where = `steps[${i}]`;
    if (typeof step.title !== "string") throw new Error(`${where} : title manquant`);
    if (typeof step.caption !== "string") throw new Error(`${where} : caption manquant`);
    assertCoord(step.lat, step.lng, where);
    if (step.mode !== "land" && step.mode !== "sea")
      throw new Error(`${where} : mode doit être "land" ou "sea"`);
    if (step.waypoints !== undefined) {
      if (!Array.isArray(step.waypoints))
        throw new Error(`${where} : waypoints doit être un tableau [lat, lng][]`);
      step.waypoints.forEach((wp, j) =>
        assertCoord(wp?.[0], wp?.[1], `${where}.waypoints[${j}]`),
      );
    }
    const isLast = i === file.steps.length - 1;
    if (step.mode === "sea" && !isLast && !(step.waypoints && step.waypoints.length > 0)) {
      throw new Error(
        `${where} : un trajet "sea" doit fournir des waypoints pour contourner les terres`,
      );
    }
  });

  if (file.timing !== undefined) {
    for (const [k, v] of Object.entries(file.timing)) {
      if (!(k in DEFAULT_TIMING)) throw new Error(`steps.json : timing.${k} inconnu`);
      if (!isNum(v) || v < 0) throw new Error(`steps.json : timing.${k} invalide`);
    }
  }
  if (file.camera !== undefined) {
    for (const [k, v] of Object.entries(file.camera)) {
      if (!(k in DEFAULT_CAMERA)) throw new Error(`steps.json : camera.${k} inconnu`);
      const expectBool = typeof DEFAULT_CAMERA[k as keyof CameraSettings] === "boolean";
      if (expectBool ? typeof v !== "boolean" : !isNum(v) || v < 0)
        throw new Error(`steps.json : camera.${k} invalide`);
    }
  }
  return file;
};

export const validateBrand = (raw: unknown): Brand => {
  const brand = raw as Brand;
  if (!brand || typeof brand.name !== "string")
    throw new Error("brand.json : champ `name` manquant");
  if (typeof brand.color !== "string") throw new Error("brand.json : `color` manquant");
  // Tolère les backticks / espaces autour de la couleur.
  brand.color = brand.color.replace(/[`\s]/g, "");
  if (!/^#[0-9a-fA-F]{6}$/.test(brand.color))
    throw new Error(`brand.json : color doit être au format #RRGGBB (reçu ${brand.color})`);
  if (typeof brand.logo !== "string") throw new Error("brand.json : `logo` manquant");
  if (typeof brand.endLine !== "string") throw new Error("brand.json : `endLine` manquant");
  if (brand.musicGainDb !== undefined && !isNum(brand.musicGainDb))
    throw new Error("brand.json : musicGainDb doit être un nombre (dB)");
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

/** Convertit un gain en dB en facteur de volume linéaire (0 dB → 1). */
export const dbToGain = (db: number): number => Math.pow(10, db / 20);
