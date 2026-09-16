import "server-only";

import { limitsFor } from "@/lib/plans";
import { slugify, withRandomSuffix } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import type { OrganizationRow, ProductRow } from "@/lib/supabase/types";

export type CreateProductResult =
  { ok: true; product: ProductRow } | { ok: false; message: string };

/**
 * Crée un produit pour l'organisation, en appliquant la limite du plan côté
 * serveur (le trigger Postgres sert de dernier rempart).
 */
export async function createProduct(
  organization: OrganizationRow,
  rawName: string,
): Promise<CreateProductResult> {
  const name = rawName.trim();
  if (name.length < 1 || name.length > 80) {
    return { ok: false, message: "Le nom du produit doit faire entre 1 et 80 caractères." };
  }

  const supabase = await createClient();
  const limits = limitsFor(organization.plan);

  if (limits.maxProducts !== null) {
    const { count, error } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id);
    if (error) {
      console.error("[products] count", error);
      return { ok: false, message: "Impossible de vérifier votre plan pour le moment." };
    }
    if ((count ?? 0) >= limits.maxProducts) {
      return {
        ok: false,
        message:
          "Le plan gratuit permet un seul produit. Passez au plan Pro pour en créer d'autres.",
      };
    }
  }

  const baseSlug = slugify(name) || "produit";
  for (const slug of [baseSlug, withRandomSuffix(baseSlug), withRandomSuffix(baseSlug, 6)]) {
    const { data, error } = await supabase
      .from("products")
      .insert({ organization_id: organization.id, name, slug })
      .select("*")
      .single();
    if (!error) return { ok: true, product: data };
    if (error.code === "23505") continue; // slug déjà pris dans l'organisation : on réessaie
    console.error("[products] insert", error);
    if (error.message.includes("PLAN_LIMIT_PRODUCTS")) {
      return {
        ok: false,
        message:
          "Le plan gratuit permet un seul produit. Passez au plan Pro pour en créer d'autres.",
      };
    }
    return {
      ok: false,
      message: "Impossible de créer le produit. Réessayez dans quelques instants.",
    };
  }
  return { ok: false, message: "Impossible de générer un identifiant unique pour ce produit." };
}

export type ProductSummary = ProductRow & {
  thumbnail_path: string | null;
  steps_count: number;
};

/** Produits de l'organisation avec la miniature du dernier rendu terminé. */
export async function listProducts(organizationId: string): Promise<ProductSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, renders(thumbnail_path, status, created_at), steps(id)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[products] list", error);
    return [];
  }

  return data.map((row) => {
    const { renders, steps, ...product } = row;
    const lastDone = [...renders]
      .filter((r) => r.status === "done" && r.thumbnail_path)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    return {
      ...product,
      thumbnail_path: lastDone?.thumbnail_path ?? null,
      steps_count: steps.length,
    };
  });
}
