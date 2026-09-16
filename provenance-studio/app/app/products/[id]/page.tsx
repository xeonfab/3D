import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Produit" };
}

/** Phase 2 : l'éditeur complet. Pour l'instant, page d'attente. */
export default async function ProductPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/app">
          <ArrowLeft aria-hidden="true" />
          Tous les produits
        </Link>
      </Button>
      <div>
        <h1 className="font-serif text-3xl">{product.name}</h1>
        <p className="mt-2 text-muted-foreground">
          L&apos;éditeur d&apos;étapes arrive dans la prochaine étape du chantier. Votre produit est
          bien créé.
        </p>
      </div>
    </div>
  );
}
