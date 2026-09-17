"use server";

import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createCheckoutUrl, createPortalUrl } from "@/lib/billing";

export type BillingState = { error?: string };

export async function startCheckoutAction(): Promise<BillingState> {
  const { user, membership } = await requireMembership();
  if (membership.role !== "owner")
    return { error: "Seul le propriétaire de la marque peut gérer l'abonnement." };
  if (membership.organization.plan === "pro") redirect("/app/billing");
  let url: string;
  try {
    url = await createCheckoutUrl(membership.organization, user.email ?? "");
  } catch (err) {
    console.error("[billing] checkout", err);
    return {
      error: "Le paiement est indisponible pour le moment. Réessayez dans quelques instants.",
    };
  }
  redirect(url);
}

export async function openPortalAction(returnPath: string = "/app/billing"): Promise<BillingState> {
  const { user, membership } = await requireMembership();
  if (membership.role !== "owner")
    return { error: "Seul le propriétaire de la marque peut gérer l'abonnement." };
  if (!membership.organization.stripe_customer_id)
    return { error: "Aucun abonnement à gérer pour le moment." };
  let url: string;
  try {
    url = await createPortalUrl(
      membership.organization,
      user.email ?? "",
      returnPath.startsWith("/app") ? returnPath : "/app/billing",
    );
  } catch (err) {
    console.error("[billing] portal", err);
    return {
      error:
        "L'espace de gestion est indisponible pour le moment. Réessayez dans quelques instants.",
    };
  }
  redirect(url);
}
