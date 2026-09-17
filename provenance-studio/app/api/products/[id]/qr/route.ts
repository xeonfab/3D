import { NextResponse, type NextRequest } from "next/server";

import { getMembership, getUser } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { ensurePublicPage, qrTargetUrl } from "@/lib/public-pages";
import { qrPng } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";

/** QR code PNG 1024 px de la page publique du produit (membres uniquement). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  const membership = user ? await getMembership() : null;
  if (!user || !membership) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, slug")
    .eq("id", id)
    .eq("organization_id", membership.organization.id)
    .maybeSingle();
  if (!product) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  const page = await ensurePublicPage(product.id, membership.organization.slug, product.slug);
  const png = await qrPng(qrTargetUrl(page.slug, publicEnv.NEXT_PUBLIC_SITE_URL));
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-${page.slug}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
