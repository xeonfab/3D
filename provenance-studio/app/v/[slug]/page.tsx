import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { PublicProductView } from "@/components/public/public-product-view";
import { publicEnv } from "@/lib/env";
import { loadPublicPage, publicPageUrl, recordPublicPageView } from "@/lib/public-pages";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type Search = Promise<{ src?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicPage(slug);
  if (!data) return { title: "Page introuvable" };
  const title = `${data.product.name} · ${data.organization.name}`;
  const description =
    data.product.end_line || `Le voyage de ${data.product.name}, étape par étape.`;
  const url = publicPageUrl(slug, publicEnv.NEXT_PUBLIC_SITE_URL);
  const image = data.video?.thumbnailUrl ?? data.organization.logoUrl ?? undefined;
  return {
    title,
    description,
    robots: { index: true, follow: false },
    alternates: { canonical: url },
    openGraph: {
      type: "video.other",
      locale: "fr_FR",
      url,
      siteName: "Provenance Studio",
      title,
      description,
      images: image ? [{ url: image, alt: `Le voyage de ${data.product.name}` }] : [],
      videos: data.video
        ? [
            {
              url: data.video.url,
              type: "video/mp4",
              width: data.video.format === "vertical" ? 1080 : 1920,
              height: data.video.format === "vertical" ? 1920 : 1080,
            },
          ]
        : [],
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : [],
    },
  };
}

export default async function PublicPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const [{ slug }, { src }] = await Promise.all([params, searchParams]);
  const data = await loadPublicPage(slug);
  if (!data) notFound();

  // Compteurs après la réponse : n'ajoute rien au temps de chargement.
  after(() => recordPublicPageView(slug, src === "qr"));

  return <PublicProductView data={data} />;
}
