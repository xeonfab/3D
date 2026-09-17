import "server-only";

import { readFileSync } from "node:fs";

import { sendVideoReadyEmail } from "@/lib/email";
import { publicEnv } from "@/lib/env";
import { limitsFor } from "@/lib/plans";
import { ensurePublicPage, publicPageUrl } from "@/lib/public-pages";
import { parseWaypoints } from "@/lib/routes";
import { publicUrl } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  OrganizationRow,
  ProductRow,
  RenderFormat,
  RenderRow,
  StepRow,
} from "@/lib/supabase/types";
import { buildTimeline, thumbnailFrame, videoDurationSeconds } from "@/remotion/timeline";
import type { VideoProps } from "@/remotion/types";

import { getRenderProvider } from "./index";
import type { RenderJob } from "./types";

export const FORMAT_LABEL: Record<RenderFormat, string> = { vertical: "9:16", horizontal: "16:9" };

export type RenderView = Pick<
  RenderRow,
  | "id"
  | "format"
  | "status"
  | "progress"
  | "error"
  | "watermark"
  | "duration_seconds"
  | "created_at"
> & {
  videoUrl: string | null;
  thumbnailUrl: string | null;
};

export function toRenderView(r: RenderRow): RenderView {
  return {
    id: r.id,
    format: r.format,
    status: r.status,
    progress: r.progress,
    error:
      r.status === "failed"
        ? "La génération a échoué. Vous pouvez réessayer, cela ne vous coûte rien."
        : null,
    watermark: r.watermark,
    duration_seconds: r.duration_seconds,
    created_at: r.created_at,
    videoUrl: publicUrl("renders", r.video_path),
    thumbnailUrl: publicUrl("renders", r.thumbnail_path),
  };
}

/** Props de la composition à partir des données du produit. */
export function buildVideoProps(
  org: OrganizationRow,
  product: ProductRow,
  steps: StepRow[],
  format: RenderFormat,
  watermark: boolean,
): VideoProps {
  const located = steps.filter((s) => s.lat !== null && s.lng !== null);
  return {
    product: { name: product.name, endLine: product.end_line },
    steps: located.map((s) => ({
      title: s.title,
      caption: s.caption,
      lat: s.lat!,
      lng: s.lng!,
      mode: s.mode,
      waypoints: parseWaypoints(s.waypoints),
      photoUrl: publicUrl("photos", s.photo_path),
      durationSeconds: s.duration_seconds,
    })),
    brand: { name: org.name, color: org.brand_color, logoUrl: publicUrl("logos", org.logo_path) },
    watermark,
    format,
    mapboxToken: publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN ?? null,
  };
}

function jobFor(render: RenderRow, props: VideoProps, scale: number): RenderJob {
  return {
    renderId: render.id,
    composition: render.format,
    inputProps: props,
    scale,
    thumbnailFrame: thumbnailFrame(buildTimeline(props.steps)),
  };
}

/** Estimation grossière de la durée du rendu, en secondes. */
export function estimateRenderSeconds(videoSeconds: number): number {
  return 25 + videoSeconds * 2.2;
}

/**
 * Lance un rendu par format. Applique les limites de plan (watermark,
 * résolution) côté serveur. Un rendu qui échoue au démarrage passe en
 * `failed` : aucun quota n'est consommé.
 */
export async function startRenders(
  org: OrganizationRow,
  product: ProductRow,
  steps: StepRow[],
  formats: RenderFormat[],
): Promise<RenderView[]> {
  const admin = createAdminClient();
  const limits = limitsFor(org.plan);
  const scale = limits.resolution === "1080p" ? 1 : 2 / 3;
  const provider = getRenderProvider();
  await ensurePublicPage(product.id, org.slug, product.slug);

  const views: RenderView[] = [];
  for (const format of formats) {
    const props = buildVideoProps(org, product, steps, format, limits.watermark);
    const { data: render, error } = await admin
      .from("renders")
      .insert({
        product_id: product.id,
        format,
        status: "queued",
        watermark: limits.watermark,
        duration_seconds: Math.round(videoDurationSeconds(props.steps)),
      })
      .select("*")
      .single();
    if (error) throw error;

    try {
      const providerId = await provider.start(jobFor(render, props, scale));
      const { data: updated } = await admin
        .from("renders")
        .update({ status: "rendering", render_id_provider: providerId, progress: 0 })
        .eq("id", render.id)
        .select("*")
        .single();
      views.push(toRenderView(updated ?? render));
    } catch (err) {
      console.error("[render] start", render.id, err);
      const { data: failed } = await admin
        .from("renders")
        .update({ status: "failed", error: err instanceof Error ? err.message : String(err) })
        .eq("id", render.id)
        .select("*")
        .single();
      views.push(toRenderView(failed ?? render));
    }
  }
  return views;
}

async function fetchBytes(urlOrPath: string): Promise<Buffer> {
  if (/^https?:\/\//.test(urlOrPath)) {
    const res = await fetch(urlOrPath);
    if (!res.ok) throw new Error(`Téléchargement du rendu : HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return readFileSync(urlOrPath);
}

/**
 * Rafraîchit un rendu en cours auprès du fournisseur. Quand il est terminé,
 * un seul appel (celui qui « réclame » la ligne) transfère la vidéo et la
 * miniature dans le Storage, marque le produit public et envoie l'email.
 */
export async function refreshRender(
  render: RenderRow,
  ctx: { org: OrganizationRow; product: ProductRow; steps: StepRow[]; userEmail: string | null },
): Promise<RenderRow> {
  if (render.status !== "rendering" || !render.render_id_provider) return render;
  const admin = createAdminClient();
  const provider = getRenderProvider();
  const limits = limitsFor(ctx.org.plan);
  const props = buildVideoProps(ctx.org, ctx.product, ctx.steps, render.format, render.watermark);
  const job = jobFor(render, props, limits.resolution === "1080p" ? 1 : 2 / 3);

  let poll;
  try {
    poll = await provider.poll(render.render_id_provider, job);
  } catch (err) {
    console.error("[render] poll", render.id, err);
    return render;
  }

  if (poll.status === "rendering") {
    if (poll.progress !== render.progress && render.progress < 100) {
      const { data } = await admin
        .from("renders")
        .update({ progress: poll.progress })
        .eq("id", render.id)
        .select("*")
        .single();
      return data ?? render;
    }
    return render;
  }

  if (poll.status === "failed") {
    console.error("[render] failed", render.id, poll.error);
    const { data } = await admin
      .from("renders")
      .update({ status: "failed", error: poll.error, progress: poll.progress })
      .eq("id", render.id)
      .select("*")
      .single();
    return data ?? render;
  }

  // Terminé : réclame la finalisation (progress 100 = jeton, un seul gagnant).
  const { data: claimed } = await admin
    .from("renders")
    .update({ progress: 100 })
    .eq("id", render.id)
    .eq("status", "rendering")
    .lt("progress", 100)
    .select("*")
    .maybeSingle();
  if (!claimed) return render;

  try {
    const base = `${ctx.org.id}/${ctx.product.id}/${render.id}`;
    const video = await fetchBytes(poll.outputUrl);
    const { error: upError } = await admin.storage
      .from("renders")
      .upload(`${base}.mp4`, video, { contentType: "video/mp4", upsert: true });
    if (upError) throw upError;

    let thumbnailPath: string | null = null;
    try {
      const thumbSrc = poll.thumbnailUrl ?? (await provider.still(render.render_id_provider, job));
      const thumb = await fetchBytes(thumbSrc);
      const { error: thumbError } = await admin.storage
        .from("renders")
        .upload(`${base}.jpg`, thumb, { contentType: "image/jpeg", upsert: true });
      if (!thumbError) thumbnailPath = `${base}.jpg`;
      else console.error("[render] thumbnail upload", thumbError);
    } catch (err) {
      console.error("[render] thumbnail", render.id, err);
    }

    const { data: done, error } = await admin
      .from("renders")
      .update({
        status: "done",
        progress: 100,
        video_path: `${base}.mp4`,
        thumbnail_path: thumbnailPath,
        error: null,
      })
      .eq("id", render.id)
      .select("*")
      .single();
    if (error) throw error;

    await admin.from("products").update({ public: true }).eq("id", ctx.product.id);

    const page = await ensurePublicPage(ctx.product.id, ctx.org.slug, ctx.product.slug);
    const site = publicEnv.NEXT_PUBLIC_SITE_URL;
    if (ctx.userEmail) {
      await sendVideoReadyEmail({
        to: ctx.userEmail,
        productName: ctx.product.name,
        formatLabel: FORMAT_LABEL[render.format],
        videoUrl: publicUrl("renders", done.video_path)!,
        pageUrl: publicPageUrl(page.slug, site),
        editorUrl: `${site.replace(/\/$/, "")}/app/products/${ctx.product.id}`,
      });
    }
    return done;
  } catch (err) {
    console.error("[render] finalize", render.id, err);
    const { data } = await admin
      .from("renders")
      .update({ status: "failed", error: err instanceof Error ? err.message : String(err) })
      .eq("id", render.id)
      .select("*")
      .single();
    return data ?? render;
  }
}
