import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { MapPlaceholder } from "@/components/map/map-placeholder";
import { PublicVideo } from "@/components/public/public-video";
import { loadPublicPage, publicPageUrl, recordPublicPageView } from "@/lib/public-pages";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicPage(slug);
  return {
    title: data ? `${data.product.name} · ${data.organization.name}` : "Page introuvable",
    robots: { index: false },
  };
}

/** Version à intégrer en iframe (Shopify, WooCommerce…) : la vidéo seule, avec un lien vers la page. */
export default async function EmbedPage({ params }: { params: Params }) {
  const { slug } = await params;
  const data = await loadPublicPage(slug);
  if (!data) notFound();
  after(() => recordPublicPageView(slug, false));

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black">
      {data.video ? (
        <PublicVideo
          src={data.video.url}
          poster={data.video.thumbnailUrl}
          format={data.video.format}
          className="h-full w-full"
        />
      ) : (
        <MapPlaceholder color={data.organization.brand_color} className="h-full w-full" />
      )}
      <a
        href={publicPageUrl(slug, publicEnv.NEXT_PUBLIC_SITE_URL)}
        target="_blank"
        rel="noopener"
        className="absolute top-3 left-3 rounded-full bg-black/55 px-3 py-1.5 text-xs text-white backdrop-blur-sm hover:bg-black/70"
      >
        {data.product.name} · voir le voyage
      </a>
    </main>
  );
}
