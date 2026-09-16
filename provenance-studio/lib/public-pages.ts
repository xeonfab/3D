import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { withRandomSuffix } from "@/lib/slug";
import type { PublicPageRow } from "@/lib/supabase/types";

/**
 * Page publique d'un produit : créée à la demande (première génération de
 * vidéo), slug global unique `<marque>-<produit>`.
 */
export async function ensurePublicPage(
  productId: string,
  orgSlug: string,
  productSlug: string,
): Promise<PublicPageRow> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("public_pages")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();
  if (existing) return existing;

  const base = `${orgSlug}-${productSlug}`.slice(0, 90);
  for (const slug of [base, withRandomSuffix(base), withRandomSuffix(base, 6)]) {
    const { data, error } = await admin
      .from("public_pages")
      .insert({ product_id: productId, slug })
      .select("*")
      .single();
    if (!error) return data;
    if (error.code !== "23505") throw error;
  }
  throw new Error("Impossible de créer un slug unique pour la page publique.");
}

export function publicPageUrl(slug: string, siteUrl: string): string {
  return `${siteUrl.replace(/\/$/, "")}/v/${slug}`;
}
