"use server";

import { z } from "zod";

import { requireMembership } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { embedSnippet, ensurePublicPage, publicPageUrl } from "@/lib/public-pages";
import {
  estimateRenderSeconds,
  refreshRender,
  startRenders,
  toRenderView,
  type RenderView,
} from "@/lib/render/service";
import { createClient } from "@/lib/supabase/server";
import type { RenderFormat } from "@/lib/supabase/types";
import { videoDurationSeconds } from "@/remotion/timeline";

export type RenderActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const uuid = z.string().uuid();
const formatsSchema = z
  .array(z.enum(["vertical", "horizontal"]))
  .min(1)
  .max(2);

async function loadContext(productId: string) {
  const { user, membership } = await requireMembership();
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("organization_id", membership.organization.id)
    .maybeSingle();
  if (!product) return null;
  const { data: steps } = await supabase
    .from("steps")
    .select("*")
    .eq("product_id", productId)
    .order("position");
  return { user, org: membership.organization, product, steps: steps ?? [], supabase };
}

export type RenderOverview = {
  renders: RenderView[];
  publicUrl: string | null;
  embedSnippet: string | null;
  estimateSeconds: number;
};

/** Derniers rendus du produit (au plus un par format), rafraîchis auprès du fournisseur. */
export async function getRendersAction(
  productId: string,
): Promise<RenderActionResult<RenderOverview>> {
  if (!uuid.safeParse(productId).success) return { ok: false, error: "Produit introuvable." };
  const ctx = await loadContext(productId);
  if (!ctx) return { ok: false, error: "Produit introuvable." };

  const { data: rows } = await ctx.supabase
    .from("renders")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(10);

  const latest = new Map<RenderFormat, typeof rows extends (infer R)[] | null ? R : never>();
  for (const r of rows ?? []) if (!latest.has(r.format)) latest.set(r.format, r);

  const renders: RenderView[] = [];
  for (const r of latest.values()) {
    const fresh =
      r.status === "rendering"
        ? await refreshRender(r, {
            org: ctx.org,
            product: ctx.product,
            steps: ctx.steps,
            userEmail: ctx.user.email ?? null,
          })
        : r;
    renders.push(toRenderView(fresh));
  }

  const { data: page } = await ctx.supabase
    .from("public_pages")
    .select("slug")
    .eq("product_id", productId)
    .maybeSingle();
  const located = ctx.steps.filter((s) => s.lat !== null);
  return {
    ok: true,
    data: {
      renders: renders.sort((a, b) => (a.format < b.format ? 1 : -1)),
      publicUrl: page ? publicPageUrl(page.slug, publicEnv.NEXT_PUBLIC_SITE_URL) : null,
      embedSnippet: page ? embedSnippet(page.slug, publicEnv.NEXT_PUBLIC_SITE_URL) : null,
      estimateSeconds: estimateRenderSeconds(
        videoDurationSeconds(located.map((s) => ({ durationSeconds: s.duration_seconds }))),
      ),
    },
  };
}

/** Lance la génération pour les formats choisis. */
export async function startRendersAction(
  productId: string,
  formats: RenderFormat[],
): Promise<RenderActionResult<RenderOverview>> {
  const parsedFormats = formatsSchema.safeParse(formats);
  if (!uuid.safeParse(productId).success || !parsedFormats.success)
    return { ok: false, error: "Demande invalide." };
  const ctx = await loadContext(productId);
  if (!ctx) return { ok: false, error: "Produit introuvable." };

  const located = ctx.steps.filter((s) => s.lat !== null && s.lng !== null);
  if (located.length < 2 || ctx.product.status !== "ready") {
    return { ok: false, error: "Localisez au moins deux étapes avant de générer la vidéo." };
  }

  // Un rendu déjà en cours pour ce format n'est pas relancé.
  const { data: inProgress } = await ctx.supabase
    .from("renders")
    .select("format")
    .eq("product_id", productId)
    .in("status", ["queued", "rendering"]);
  const busy = new Set((inProgress ?? []).map((r) => r.format));
  const toStart = [...new Set(parsedFormats.data)].filter((f) => !busy.has(f));

  try {
    if (toStart.length) await startRenders(ctx.org, ctx.product, ctx.steps, toStart);
  } catch (err) {
    console.error("[render] startRendersAction", err);
    return {
      ok: false,
      error: "Impossible de lancer la génération pour le moment. Réessayez dans quelques instants.",
    };
  }
  const page = await ensurePublicPage(ctx.product.id, ctx.org.slug, ctx.product.slug);
  const overview = await getRendersAction(productId);
  if (!overview.ok) return overview;
  return {
    ok: true,
    data: { ...overview.data, publicUrl: publicPageUrl(page.slug, publicEnv.NEXT_PUBLIC_SITE_URL) },
  };
}
