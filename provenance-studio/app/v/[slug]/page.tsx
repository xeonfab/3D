import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { PublicProductView } from "@/components/public/public-product-view";
import { loadPublicPage, recordPublicPageView } from "@/lib/public-pages";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type Search = Promise<{ src?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicPage(slug);
  if (!data) return { title: "Page introuvable" };
  return {
    title: `${data.product.name} · ${data.organization.name}`,
    description: data.product.end_line || `Le voyage de ${data.product.name}, étape par étape.`,
    robots: { index: true, follow: false },
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
