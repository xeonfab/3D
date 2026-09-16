"use server";

import { z } from "zod";

import { requireMembership } from "@/lib/auth";
import { limitsFor } from "@/lib/plans";
import { parseWaypoints, type LngLat } from "@/lib/routes";
import { computeSeaRoute } from "@/lib/searoute.server";
import { createClient } from "@/lib/supabase/server";
import type { ProductStatus, StepRow, TransportMode } from "@/lib/supabase/types";

export type ActionResult<T = undefined> =
  { ok: true; data: T; status?: ProductStatus } | { ok: false; error: string };

const GENERIC_ERROR = "Enregistrement impossible. Vérifiez votre connexion et réessayez.";

const uuid = z.string().uuid();

const productPatchSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Le nom du produit est requis.")
      .max(80, "80 caractères maximum."),
    end_line: z.string().trim().max(140, "140 caractères maximum."),
  })
  .partial();

const lngLatSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const stepPatchSchema = z
  .object({
    title: z.string().trim().max(60, "60 caractères maximum."),
    caption: z.string().trim().max(90, "90 caractères maximum."),
    place_name: z.string().trim().max(120),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    mode: z.enum(["land", "sea", "air"]),
    waypoints: z.array(lngLatSchema).max(400),
    duration_seconds: z.number().int().min(2).max(20),
  })
  .partial()
  .refine((p) => (p.lat === undefined) === (p.lng === undefined), {
    message: "Latitude et longitude vont ensemble.",
  })
  .refine((p) => p.lat === undefined || (p.lat === null) === (p.lng === null), {
    message: "Latitude et longitude vont ensemble.",
  });

export type ProductPatch = z.infer<typeof productPatchSchema>;
export type StepPatch = z.infer<typeof stepPatchSchema>;

/** Le produit appartient-il à l'organisation de l'utilisateur ? (la RLS le garantit aussi) */
async function ownedProduct(productId: string) {
  const { membership } = await requireMembership();
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, organization_id, status")
    .eq("id", productId)
    .eq("organization_id", membership.organization.id)
    .maybeSingle();
  return product ? { supabase, product, organization: membership.organization } : null;
}

/**
 * Statut du produit : `ready` dès que toutes les étapes sont localisées et
 * qu'il y en a au moins deux, `draft` sinon.
 */
async function recomputeStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
): Promise<ProductStatus> {
  const { data: steps } = await supabase.from("steps").select("lat").eq("product_id", productId);
  const all = steps ?? [];
  const status: ProductStatus =
    all.length >= 2 && all.every((s) => s.lat !== null) ? "ready" : "draft";
  await supabase.from("products").update({ status }).eq("id", productId);
  return status;
}

export async function updateProduct(productId: string, patch: ProductPatch): Promise<ActionResult> {
  const parsedId = uuid.safeParse(productId);
  const parsed = productPatchSchema.safeParse(patch);
  if (!parsedId.success || !parsed.success) {
    return { ok: false, error: parsed.success ? GENERIC_ERROR : parsed.error.issues[0].message };
  }
  const owned = await ownedProduct(productId);
  if (!owned) return { ok: false, error: "Produit introuvable." };

  const { error } = await owned.supabase.from("products").update(parsed.data).eq("id", productId);
  if (error) {
    console.error("[editor] updateProduct", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true, data: undefined };
}

export async function addStep(productId: string): Promise<ActionResult<StepRow>> {
  if (!uuid.safeParse(productId).success) return { ok: false, error: GENERIC_ERROR };
  const owned = await ownedProduct(productId);
  if (!owned) return { ok: false, error: "Produit introuvable." };
  const { supabase, organization } = owned;

  const { count } = await supabase
    .from("steps")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  const limits = limitsFor(organization.plan);
  if ((count ?? 0) >= limits.maxSteps) {
    return {
      ok: false,
      error:
        organization.plan === "free"
          ? "Le plan gratuit permet 3 étapes par produit. Passez au plan Pro pour aller jusqu'à 12."
          : "Un produit ne peut pas dépasser 12 étapes.",
    };
  }

  const { data, error } = await supabase
    .from("steps")
    .insert({ product_id: productId, position: count ?? 0 })
    .select("*")
    .single();
  if (error) {
    console.error("[editor] addStep", error);
    return {
      ok: false,
      error: error.message.includes("PLAN_LIMIT_STEPS")
        ? "Vous avez atteint le nombre maximal d'étapes pour votre plan."
        : GENERIC_ERROR,
    };
  }
  const status = await recomputeStatus(supabase, productId);
  return { ok: true, data, status };
}

export async function updateStep(
  productId: string,
  stepId: string,
  patch: StepPatch,
): Promise<ActionResult> {
  const parsed = stepPatchSchema.safeParse(patch);
  if (!uuid.safeParse(productId).success || !uuid.safeParse(stepId).success || !parsed.success) {
    return { ok: false, error: parsed.success ? GENERIC_ERROR : parsed.error.issues[0].message };
  }
  const owned = await ownedProduct(productId);
  if (!owned) return { ok: false, error: "Produit introuvable." };

  const { error } = await owned.supabase
    .from("steps")
    .update(parsed.data)
    .eq("id", stepId)
    .eq("product_id", productId);
  if (error) {
    console.error("[editor] updateStep", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  const status =
    parsed.data.lat !== undefined ? await recomputeStatus(owned.supabase, productId) : undefined;
  return { ok: true, data: undefined, status };
}

export async function deleteStep(productId: string, stepId: string): Promise<ActionResult> {
  if (!uuid.safeParse(productId).success || !uuid.safeParse(stepId).success) {
    return { ok: false, error: GENERIC_ERROR };
  }
  const owned = await ownedProduct(productId);
  if (!owned) return { ok: false, error: "Produit introuvable." };
  const { supabase } = owned;

  const { data: step } = await supabase
    .from("steps")
    .select("photo_path")
    .eq("id", stepId)
    .eq("product_id", productId)
    .maybeSingle();
  const { error } = await supabase
    .from("steps")
    .delete()
    .eq("id", stepId)
    .eq("product_id", productId);
  if (error) {
    console.error("[editor] deleteStep", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (step?.photo_path) await supabase.storage.from("photos").remove([step.photo_path]);

  // Renumérote les positions restantes.
  const { data: rest } = await supabase
    .from("steps")
    .select("id, position")
    .eq("product_id", productId)
    .order("position", { ascending: true });
  for (const [i, s] of (rest ?? []).entries()) {
    if (s.position !== i) await supabase.from("steps").update({ position: i }).eq("id", s.id);
  }
  const status = await recomputeStatus(supabase, productId);
  return { ok: true, data: undefined, status };
}

export async function reorderSteps(productId: string, orderedIds: string[]): Promise<ActionResult> {
  if (!uuid.safeParse(productId).success || !z.array(uuid).max(50).safeParse(orderedIds).success) {
    return { ok: false, error: GENERIC_ERROR };
  }
  const owned = await ownedProduct(productId);
  if (!owned) return { ok: false, error: "Produit introuvable." };
  const { supabase } = owned;

  const { data: existing } = await supabase.from("steps").select("id").eq("product_id", productId);
  const ids = new Set((existing ?? []).map((s) => s.id));
  if (ids.size !== orderedIds.length || orderedIds.some((id) => !ids.has(id))) {
    return { ok: false, error: "La liste des étapes a changé. Rechargez la page." };
  }

  // Décalage temporaire pour éviter toute collision transitoire.
  for (const [i, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from("steps")
      .update({ position: 1000 + i })
      .eq("id", id);
    if (error) return { ok: false, error: GENERIC_ERROR };
  }
  for (const [i, id] of orderedIds.entries()) {
    const { error } = await supabase.from("steps").update({ position: i }).eq("id", id);
    if (error) return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true, data: undefined };
}

const PHOTO_MAX_BYTES = 600 * 1024;

export async function uploadStepPhoto(
  productId: string,
  stepId: string,
  formData: FormData,
): Promise<ActionResult<{ photo_path: string }>> {
  if (!uuid.safeParse(productId).success || !uuid.safeParse(stepId).success) {
    return { ok: false, error: GENERIC_ERROR };
  }
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Aucune photo reçue." };
  if (file.type !== "image/jpeg") return { ok: false, error: "La photo doit être au format JPEG." };
  if (file.size > PHOTO_MAX_BYTES)
    return { ok: false, error: "La photo dépasse la taille autorisée." };

  const owned = await ownedProduct(productId);
  if (!owned) return { ok: false, error: "Produit introuvable." };
  const { supabase, organization } = owned;

  const { data: step } = await supabase
    .from("steps")
    .select("photo_path")
    .eq("id", stepId)
    .eq("product_id", productId)
    .maybeSingle();
  if (!step) return { ok: false, error: "Étape introuvable." };

  const path = `${organization.id}/${productId}/${stepId}-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (uploadError) {
    console.error("[editor] uploadStepPhoto", uploadError);
    return { ok: false, error: "Le téléversement de la photo a échoué." };
  }
  const { error } = await supabase.from("steps").update({ photo_path: path }).eq("id", stepId);
  if (error) {
    console.error("[editor] uploadStepPhoto update", error);
    await supabase.storage.from("photos").remove([path]);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (step.photo_path) await supabase.storage.from("photos").remove([step.photo_path]);
  return { ok: true, data: { photo_path: path } };
}

export async function removeStepPhoto(productId: string, stepId: string): Promise<ActionResult> {
  if (!uuid.safeParse(productId).success || !uuid.safeParse(stepId).success) {
    return { ok: false, error: GENERIC_ERROR };
  }
  const owned = await ownedProduct(productId);
  if (!owned) return { ok: false, error: "Produit introuvable." };
  const { supabase } = owned;

  const { data: step } = await supabase
    .from("steps")
    .select("photo_path")
    .eq("id", stepId)
    .eq("product_id", productId)
    .maybeSingle();
  if (!step) return { ok: false, error: "Étape introuvable." };
  const { error } = await supabase.from("steps").update({ photo_path: null }).eq("id", stepId);
  if (error) return { ok: false, error: GENERIC_ERROR };
  if (step.photo_path) await supabase.storage.from("photos").remove([step.photo_path]);
  return { ok: true, data: undefined };
}

export type SeaRouteData = { waypoints: LngLat[]; incomplete: boolean };

/**
 * Calcule la route maritime entre deux points (searoute + contrôle des terres).
 * Pure : les waypoints sont renvoyés au client, qui les enregistre via
 * l'autosave de l'étape.
 */
export async function computeSeaRouteAction(
  from: LngLat,
  to: LngLat,
): Promise<ActionResult<SeaRouteData>> {
  const parsed = z.tuple([lngLatSchema, lngLatSchema]).safeParse([from, to]);
  if (!parsed.success) return { ok: false, error: "Coordonnées invalides." };
  await requireMembership();
  try {
    const result = computeSeaRoute(parsed.data[0], parsed.data[1]);
    if (!result) {
      return {
        ok: false,
        error:
          "Aucune route maritime trouvée entre ces deux lieux. Vérifiez qu'ils sont proches d'une côte.",
      };
    }
    return {
      ok: true,
      data: { waypoints: parseWaypoints(result.waypoints), incomplete: result.incomplete },
    };
  } catch (error) {
    console.error("[editor] computeSeaRoute", error);
    return { ok: false, error: "Le calcul de la route maritime a échoué. Réessayez." };
  }
}

export type { TransportMode };
