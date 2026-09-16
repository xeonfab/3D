import type { Metadata } from "next";

export const metadata: Metadata = { title: "Produits" };

/** Phase 1 : liste des produits. Pour l'instant, état vide. */
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-serif text-3xl">Vos produits</h1>
      <p className="text-muted-foreground">
        Vous n&apos;avez pas encore de produit. Le tableau de bord arrive dans la prochaine étape.
      </p>
    </div>
  );
}
