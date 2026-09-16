import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { requireMembership } from "@/lib/auth";
import { limitsFor } from "@/lib/plans";
import { listProducts } from "@/lib/products";

import { NewProductDialog } from "./new-product-dialog";

export const metadata: Metadata = { title: "Produits" };

export default async function DashboardPage() {
  const { membership } = await requireMembership();
  const org = membership.organization;
  const products = await listProducts(org.id);
  const limits = limitsFor(org.plan);
  const limitReached = limits.maxProducts !== null && products.length >= limits.maxProducts;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Vos produits</h1>
          <p className="mt-1 text-muted-foreground">
            {products.length === 0
              ? "Chaque produit a son voyage et sa vidéo."
              : `${products.length} ${products.length > 1 ? "produits" : "produit"} · plan ${limits.label}`}
          </p>
        </div>
        <NewProductDialog disabled={limitReached} />
      </div>

      {limitReached ? (
        <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Le plan gratuit permet un seul produit.{" "}
          <Link href="/app/billing" className="text-foreground underline underline-offset-4">
            Passez au plan Pro
          </Link>{" "}
          pour en créer d&apos;autres, avec jusqu&apos;à 12 étapes, en 1080p et sans filigrane.
        </p>
      ) : null}

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <p className="font-serif text-xl">Vous n&apos;avez pas encore de produit.</p>
          <p className="mt-2 text-muted-foreground">
            Créez-en un pour décrire son parcours, de la ferme à l&apos;atelier.
          </p>
        </div>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} brandColor={org.brand_color} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
