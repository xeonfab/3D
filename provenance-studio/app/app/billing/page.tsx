import type { Metadata } from "next";
import { Check } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireMembership } from "@/lib/auth";
import { getSubscriptionSummary, type SubscriptionSummary } from "@/lib/billing";
import { PLAN_LIMITS } from "@/lib/plans";

import { CheckoutButton, PortalButton } from "./plan-buttons";

export const metadata: Metadata = { title: "Abonnement" };

const dateFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(iso),
  );

function statusLine(sub: SubscriptionSummary | null): string | null {
  if (!sub) return null;
  if (sub.cancelAtPeriodEnd && sub.currentPeriodEnd)
    return `Abonnement résilié : le plan Pro reste actif jusqu'au ${dateFr(sub.currentPeriodEnd)}.`;
  if (sub.status === "past_due")
    return "Le dernier paiement a échoué. Mettez à jour votre moyen de paiement pour conserver le plan Pro.";
  if (sub.status === "trialing" && sub.currentPeriodEnd)
    return `Période d'essai jusqu'au ${dateFr(sub.currentPeriodEnd)}.`;
  if (sub.currentPeriodEnd) return `Prochain renouvellement le ${dateFr(sub.currentPeriodEnd)}.`;
  return null;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ succes?: string }>;
}) {
  const { membership } = await requireMembership();
  const { succes } = await searchParams;
  const org = membership.organization;
  const isOwner = membership.role === "owner";
  const isPro = org.plan === "pro";
  const subscription =
    isPro || org.stripe_subscription_id ? await getSubscriptionSummary(org) : null;
  const status = statusLine(subscription);

  const FEATURES: Record<"free" | "pro", string[]> = {
    free: [
      "1 produit",
      "3 étapes par produit",
      "Vidéo 720p",
      "Filigrane « Provenance Studio »",
      "Page publique et QR code",
    ],
    pro: [
      "Produits illimités",
      "12 étapes par produit",
      "Vidéo 1080p",
      "Sans filigrane",
      "Page publique et QR code",
    ],
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl">Abonnement</h1>
        <p className="mt-1 text-muted-foreground">
          Plan actuel : <span className="text-foreground">{PLAN_LIMITS[org.plan].label}</span>
          {status ? ` · ${status}` : ""}
        </p>
      </div>

      {succes === "1" ? (
        isPro ? (
          <Alert variant="success">
            <Check aria-hidden="true" />
            <AlertTitle>Bienvenue dans le plan Pro</AlertTitle>
            <AlertDescription>
              Les limites sont levées immédiatement : produits illimités, 12 étapes, 1080p, sans
              filigrane.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTitle>Paiement reçu, activation en cours</AlertTitle>
            <AlertDescription>
              Votre plan Pro s&apos;active dans quelques secondes. Rechargez la page si nécessaire.
            </AlertDescription>
          </Alert>
        )
      ) : null}

      {!isOwner ? (
        <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Seul le propriétaire de la marque peut modifier l&apos;abonnement.
        </p>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {(["free", "pro"] as const).map((plan) => {
          const current = org.plan === plan;
          return (
            <section
              key={plan}
              aria-labelledby={`plan-${plan}`}
              className={`flex flex-col gap-6 rounded-xl border p-6 ${current ? "border-foreground/40 bg-card" : "border-border bg-card"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id={`plan-${plan}`} className="font-serif text-2xl">
                    {PLAN_LIMITS[plan].label}
                  </h2>
                  <p className="mt-1 text-muted-foreground">
                    {plan === "free" ? "0 €" : `${PLAN_LIMITS.pro.priceMonthlyEur} € / mois`}
                    {plan === "pro" ? <span className="text-xs"> · sans engagement</span> : null}
                  </p>
                </div>
                {current ? <Badge variant="secondary">Votre plan</Badge> : null}
              </div>
              <ul className="flex flex-col gap-2 text-sm">
                {FEATURES[plan].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="size-4 text-muted-foreground" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                {plan === "pro" ? (
                  isPro ? (
                    isOwner ? (
                      <PortalButton />
                    ) : null
                  ) : (
                    <CheckoutButton
                      disabled={!isOwner}
                      reason={
                        isOwner
                          ? "Paiement sécurisé par Stripe. Résiliable à tout moment."
                          : undefined
                      }
                    />
                  )
                ) : isPro && isOwner ? (
                  <PortalButton label="Résilier ou modifier" />
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
