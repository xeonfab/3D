import "server-only";

import { withRandomSuffix } from "@/lib/slug";
import { publicUrl } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  OrganizationRow,
  ProductRow,
  PublicPageRow,
  RenderFormat,
  StepRow,
} from "@/lib/supabase/types";

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

export type PublicPageData = {
  page: PublicPageRow;
  product: Pick<ProductRow, "id" | "name" | "end_line" | "slug">;
  organization: Pick<OrganizationRow, "name" | "slug" | "brand_color" | "plan"> & {
    logoUrl: string | null;
  };
  steps: (Pick<StepRow, "id" | "title" | "caption" | "place_name" | "position"> & {
    photoUrl: string | null;
  })[];
  /** Vidéo verticale terminée la plus récente, sinon horizontale. */
  video: { url: string; thumbnailUrl: string | null; format: RenderFormat } | null;
};

/**
 * Données de la page publique. Lecture côté serveur avec le client
 * service_role (aucune policy anonyme) et uniquement si `products.public`.
 */
export async function loadPublicPage(slug: string): Promise<PublicPageData | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const admin = createAdminClient();
  const { data: page } = await admin
    .from("public_pages")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!page) return null;
  const { data: product } = await admin
    .from("products")
    .select("id, name, end_line, slug, public, organization_id")
    .eq("id", page.product_id)
    .maybeSingle();
  if (!product || !product.public) return null;

  const [{ data: org }, { data: steps }, { data: renders }] = await Promise.all([
    admin
      .from("organizations")
      .select("name, slug, brand_color, plan, logo_path")
      .eq("id", product.organization_id)
      .single(),
    admin
      .from("steps")
      .select("id, title, caption, place_name, position, photo_path, lat")
      .eq("product_id", product.id)
      .order("position", { ascending: true }),
    admin
      .from("renders")
      .select("format, video_path, thumbnail_path, created_at")
      .eq("product_id", product.id)
      .eq("status", "done")
      .not("video_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (!org) return null;

  const pick = (renders ?? []).find((r) => r.format === "vertical") ?? (renders ?? [])[0] ?? null;
  return {
    page,
    product: { id: product.id, name: product.name, end_line: product.end_line, slug: product.slug },
    organization: {
      name: org.name,
      slug: org.slug,
      brand_color: org.brand_color,
      plan: org.plan,
      logoUrl: publicUrl("logos", org.logo_path),
    },
    steps: (steps ?? [])
      .filter((s) => s.lat !== null)
      .map((s) => ({
        id: s.id,
        title: s.title,
        caption: s.caption,
        place_name: s.place_name,
        position: s.position,
        photoUrl: publicUrl("photos", s.photo_path),
      })),
    video: pick
      ? {
          url: publicUrl("renders", pick.video_path)!,
          thumbnailUrl: publicUrl("renders", pick.thumbnail_path),
          format: pick.format,
        }
      : null,
  };
}

/** Incrémente `views_count` (et `qr_scans_count` si la visite vient du QR). Jamais bloquant. */
export async function recordPublicPageView(slug: string, fromQr: boolean): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("increment_public_page_counters", {
      page_slug: slug,
      from_qr: fromQr,
    });
    if (error) console.error("[public-page] counters", error);
  } catch (err) {
    console.error("[public-page] counters", err);
  }
}

/** URL imprimée dans le QR code : la page publique, marquée `?src=qr`. */
export function qrTargetUrl(slug: string, siteUrl: string): string {
  return `${publicPageUrl(slug, siteUrl)}?src=qr`;
}

/** Snippet d'intégration pour Shopify, WooCommerce ou tout site. */
export function embedSnippet(slug: string, siteUrl: string): string {
  const src = `${siteUrl.replace(/\/$/, "")}/embed/${slug}`;
  return `<iframe src="${src}" width="360" height="640" style="border:0;max-width:100%;border-radius:16px" loading="lazy" allow="autoplay; fullscreen" title="Le voyage de ce produit"></iframe>`;
}
