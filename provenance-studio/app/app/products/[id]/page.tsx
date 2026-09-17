import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { limitsFor } from "@/lib/plans";
import { parseWaypoints } from "@/lib/routes";
import { publicUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

import { ProductEditor } from "./editor/product-editor";
import { getRendersAction } from "./render-actions";
import type { EditorStep } from "./editor/types";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Produit" };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { id } = await params;
  const { membership } = await requireMembership();
  const org = membership.organization;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, name, end_line, status")
    .eq("id", id)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (!product) notFound();

  const { data: steps } = await supabase
    .from("steps")
    .select("*")
    .eq("product_id", product.id)
    .order("position", { ascending: true });

  const editorSteps: EditorStep[] = (steps ?? []).map((s) => ({
    ...s,
    waypoints: parseWaypoints(s.waypoints),
  }));
  const limits = limitsFor(org.plan);
  const rendersResult = await getRendersAction(product.id);
  const initialRenders = rendersResult.ok
    ? rendersResult.data
    : { renders: [], publicUrl: null, embedSnippet: null, estimateSeconds: 60 };

  return (
    <ProductEditor
      initialProduct={product}
      initialSteps={editorSteps}
      brand={{ name: org.name, color: org.brand_color, logoUrl: publicUrl("logos", org.logo_path) }}
      plan={{
        maxSteps: limits.maxSteps,
        isFree: org.plan === "free",
        resolution: limits.resolution,
        watermark: limits.watermark,
      }}
      initialRenders={initialRenders}
    />
  );
}
