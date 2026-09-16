"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getMembership, requireUser } from "@/lib/auth";
import { createProduct } from "@/lib/products";
import { slugify, withRandomSuffix } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string };

const nameSchema = z
  .string()
  .trim()
  .min(1, "Indiquez le nom de votre marque.")
  .max(80, "Le nom ne peut pas dépasser 80 caractères.");

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "La couleur doit être un code hexadécimal, par exemple #D9822B.");

const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/svg+xml": "svg",
};
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** Écran 1 : crée l'organisation ; le trigger SQL rend l'utilisateur propriétaire. */
export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/onboarding");
  if (await getMembership()) redirect("/onboarding?etape=2");

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const name = parsed.data;

  const supabase = await createClient();
  const base = slugify(name, 50) || "marque";
  const candidates = [base, withRandomSuffix(base), withRandomSuffix(base, 6)];

  for (const slug of candidates) {
    const { error } = await supabase.from("organizations").insert({ name, slug });
    if (!error) redirect("/onboarding?etape=2");
    if (error.code !== "23505") {
      console.error("[onboarding] createOrganization", error);
      return {
        error: "Impossible de créer votre marque pour le moment. Réessayez dans quelques instants.",
      };
    }
  }
  return { error: "Impossible de générer un identifiant unique pour cette marque." };
}

/** Écran 2 : logo (optionnel, PNG/SVG ≤ 2 Mo) et couleur de marque. */
export async function updateBrand(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/onboarding");
  const membership = await getMembership();
  if (!membership) redirect("/onboarding?etape=1");
  const org = membership.organization;

  const color = colorSchema.safeParse(formData.get("brand_color"));
  if (!color.success) return { error: color.error.issues[0]?.message };

  const supabase = await createClient();
  let logoPath: string | null = org.logo_path;

  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    const ext = LOGO_TYPES[file.type];
    if (!ext) return { error: "Le logo doit être un fichier PNG ou SVG." };
    if (file.size > LOGO_MAX_BYTES) return { error: "Le logo ne doit pas dépasser 2 Mo." };

    const path = `${org.id}/logo-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) {
      console.error("[onboarding] upload logo", uploadError);
      return { error: "Le téléversement du logo a échoué. Réessayez avec un autre fichier." };
    }
    if (org.logo_path && org.logo_path !== path) {
      await supabase.storage.from("logos").remove([org.logo_path]);
    }
    logoPath = path;
  }

  const { error } = await supabase
    .from("organizations")
    .update({ brand_color: color.data.toUpperCase(), logo_path: logoPath })
    .eq("id", org.id);
  if (error) {
    console.error("[onboarding] updateBrand", error);
    return { error: "Impossible d'enregistrer votre marque pour le moment." };
  }

  redirect("/onboarding?etape=3");
}

/** Écran 3 : crée le premier produit et ouvre l'éditeur. */
export async function createFirstProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/onboarding");
  const membership = await getMembership();
  if (!membership) redirect("/onboarding?etape=1");

  const result = await createProduct(membership.organization, String(formData.get("name") ?? ""));
  if (!result.ok) return { error: result.message };
  redirect(`/app/products/${result.product.id}`);
}
