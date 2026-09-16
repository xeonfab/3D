import type { Metadata } from "next";

export const metadata: Metadata = { title: "Abonnement" };

/** Phase 5 : plans Gratuit / Pro, Stripe Checkout. */
export default function BillingPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-serif text-3xl">Abonnement</h1>
      <p className="text-muted-foreground">
        Le passage au plan Pro arrive dans une prochaine étape du chantier.
      </p>
    </div>
  );
}
